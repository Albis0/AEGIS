/**
 * Faz CC-2 — Safe general-purpose shell runner (Claude-Code Bash/PowerShell parity).
 *
 * The existing `run_command` runs a one-shot PowerShell script with a fixed short
 * timeout, no working directory, and no background mode. This module adds those:
 * a configurable timeout (2 min default, 10 min hard cap), an explicit `cwd`,
 * background (detached) execution, and 30k output clipping — matching Claude
 * Code's Bash tool while staying behind RealJarvis's approval gate (run_shell is
 * classified destructive in permissions.ts, so the agent loop asks first).
 *
 * ELECTRON_RUN_AS_NODE: the dev shell sets this so `node launch-electron.js`
 * works, but a child that inherits it and happens to be Electron would silently
 * run as plain Node. We strip it (and ELECTRON_NO_ATTACH_CONSOLE) from every
 * spawned child's environment. (See memory: electron-run-as-node-gotcha.)
 */

import {spawn} from "child_process";

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const MAX_TIMEOUT_MS = 600_000;     // 10 minutes
const MAX_OUTPUT_CHARS = 30_000;

// Env for a spawned child: inherit ours minus the Electron-mode leak.
function childEnv(): NodeJS.ProcessEnv {
    const env = {...process.env};
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ELECTRON_NO_ATTACH_CONSOLE;
    return env;
}

function clampTimeout(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
    // Callers pass seconds; convert and cap.
    const ms = n * 1000;
    return Math.min(ms, MAX_TIMEOUT_MS);
}

function clip(s: string): string {
    return s.length > MAX_OUTPUT_CHARS ? s.slice(0, MAX_OUTPUT_CHARS) + "\n…(output truncated at 30k chars)" : s;
}

export interface RunShellOptions {
    cwd?: string;
    timeoutSeconds?: number;
    /** When true, the shell runs on a PowerShell interpreter; default is PowerShell on Windows. */
    background?: boolean;
    /** Called when a background job finishes (for a feed/notification). */
    onBackgroundDone?: (summary: string) => void;
}

/**
 * Run a shell command. On Windows it runs through PowerShell (-NoProfile). Returns
 * the combined stdout/stderr (clipped). For background jobs it returns immediately
 * and invokes onBackgroundDone later.
 */
export function runShell(command: string, opts: RunShellOptions = {}): Promise<string> {
    const cmd = String(command ?? "").trim();
    if (!cmd) return Promise.resolve("ERROR: command is required.");

    const cwd = opts.cwd && opts.cwd.trim() ? opts.cwd : process.cwd();
    const timeoutMs = clampTimeout(opts.timeoutSeconds);
    const isWin = process.platform === "win32";

    // PowerShell on Windows, /bin/sh elsewhere. We pass the command as a single
    // argument to the interpreter (no shell:true string interpolation).
    const [bin, args] = isWin
        ? ["powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd]]
        : ["/bin/sh", ["-c", cmd]];

    if (opts.background) {
        try {
            const child = spawn(bin, args as string[], {
                cwd,
                env: childEnv(),
                windowsHide: true,
                detached: true,
                stdio: "ignore",
            });
            const pid = child.pid;
            let out = "";
            // We can't stream ignored stdio; re-attach a light listener only for exit.
            child.on("exit", (code) => {
                out = `Background command finished (pid ${pid}, exit ${code ?? "?"}): ${cmd.slice(0, 120)}`;
                opts.onBackgroundDone?.(out);
            });
            child.on("error", (e) => opts.onBackgroundDone?.(`Background command error: ${e.message}`));
            child.unref();
            return Promise.resolve(`Started in background (pid ${pid}). You'll be notified when it finishes.`);
        } catch (e) {
            return Promise.resolve(`ERROR: could not start background command: ${(e as Error).message}`);
        }
    }

    return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let settled = false;
        const done = (text: string) => { if (!settled) { settled = true; resolve(clip(text)); } };

        let child;
        try {
            child = spawn(bin, args as string[], {cwd, env: childEnv(), windowsHide: true});
        } catch (e) {
            return done(`ERROR: could not start command: ${(e as Error).message}`);
        }

        const timer = setTimeout(() => {
            try { child.kill(); } catch { /* already gone */ }
            done(`ERROR: command timed out after ${Math.round(timeoutMs / 1000)}s.\n${(stdout + stderr).trim()}`);
        }, timeoutMs);

        child.stdout?.on("data", (d) => { stdout += d.toString(); });
        child.stderr?.on("data", (d) => { stderr += d.toString(); });
        child.on("error", (e) => { clearTimeout(timer); done(`ERROR: ${e.message}`); });
        child.on("close", (code) => {
            clearTimeout(timer);
            const out = stdout.trim();
            const err = stderr.trim();
            if (code !== 0 && !out) {
                done(`ERROR: command exited with code ${code}.\n${err}`);
            } else {
                const tail = err && code !== 0 ? `\n[stderr]\n${err}` : "";
                done((out || err || "(no output, command ran)") + tail);
            }
        });
    });
}

// Exposed for tests.
export const _internals = {childEnv, clampTimeout, clip, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, MAX_OUTPUT_CHARS};
