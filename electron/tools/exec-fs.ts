/**
 * Faz CC-1 — Code-aware file tools (glob / grep / edit).
 *
 * These bring RealJarvis toward Claude Code's core edge: finding files by name
 * pattern, searching contents by regex, and doing exact-string edits. Executors
 * only — schemas live in tools/schemas.ts (codeToolSchemas group).
 *
 * Path safety: mirrors the read_file/write_file convention in tools.ts — when
 * Full PC Access is OFF, everything is confined to the home directory. The
 * caller passes the current `fullPcAccess` flag (tools.ts owns that state).
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type {ToolExecutor} from "./executor-types";

// ── Path resolution (same semantics as tools.ts resolvePath) ─────────────────
function resolvePath(p: string): string {
    if (!p) return process.cwd();
    if (typeof p !== "string") p = String(p);
    if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) {
        return path.join(os.homedir(), p.slice(1));
    }
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

// Confine to home dir when Full PC Access is off. Returns an error string if
// blocked, otherwise null.
function guardRoot(full: string, fullPcAccess: boolean): string | null {
    if (fullPcAccess) return null;
    const home = path.resolve(os.homedir());
    if (!path.resolve(full).startsWith(home)) {
        return `BLOCKED: Only paths under the home directory are allowed while Full PC Access is off (${home}).`;
    }
    return null;
}

// Directories that are never worth walking — huge, machine-generated, or VCS metadata.
const IGNORED_DIRS = new Set([
    "node_modules", ".git", ".svn", ".hg", "dist", "build", "out", ".next",
    ".cache", "coverage", ".vite", "__pycache__", ".venv", "venv", ".idea", ".vscode",
]);

// Skip clearly-binary content when grepping (a NUL byte in the first chunk is the
// classic heuristic ripgrep/git use).
function looksBinary(buf: Buffer): boolean {
    const n = Math.min(buf.length, 8000);
    for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
    return false;
}

// ── Minimal glob → RegExp (supports **, *, ?, and brace {a,b}) ────────────────
// We only need enough to cover "**/*.ts", "src/**/*.{ts,tsx}", "*.md" etc.
function globToRegExp(glob: string): RegExp {
    let re = "";
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === "*") {
            if (glob[i + 1] === "*") {
                // ** → any path depth (including zero dirs). Consume an optional trailing slash.
                re += "(?:.*)";
                i++;
                if (glob[i + 1] === "/") i++;
            } else {
                re += "[^/\\\\]*"; // single segment
            }
        } else if (c === "?") {
            re += "[^/\\\\]";
        } else if (c === "{") {
            const end = glob.indexOf("}", i);
            if (end > i) {
                const alts = glob.slice(i + 1, end).split(",").map((a) => a.replace(/[.+^${}()|[\]\\]/g, "\\$&"));
                re += `(?:${alts.join("|")})`;
                i = end;
            } else {
                re += "\\{";
            }
        } else if ("/\\".includes(c)) {
            re += "[/\\\\]"; // match either separator regardless of OS
        } else {
            re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        }
    }
    return new RegExp(`^${re}$`, "i");
}

interface WalkEntry {full: string; rel: string; mtimeMs: number}

// Recursively walk `root`, skipping IGNORED_DIRS, bounded by a file cap so a
// giant tree can't hang the tool. Returns files only.
function walk(root: string, cap = 20000): WalkEntry[] {
    const out: WalkEntry[] = [];
    const stack: string[] = [root];
    while (stack.length && out.length < cap) {
        const dir = stack.pop()!;
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch { continue; }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (IGNORED_DIRS.has(e.name)) continue;
                stack.push(full);
            } else if (e.isFile()) {
                let mtimeMs = 0;
                try { mtimeMs = fs.statSync(full).mtimeMs; } catch { /* keep 0 */ }
                out.push({full, rel: path.relative(root, full), mtimeMs});
                if (out.length >= cap) break;
            }
        }
    }
    return out;
}

export function makeFsExecutors(getFullPcAccess: () => boolean): Record<string, ToolExecutor> {
    return {
        // glob_files(pattern, cwd?) — find files by name pattern, newest first.
        async glob_files(args: Record<string, string>) {
            const pattern = String(args.pattern ?? "").trim();
            if (!pattern) return "ERROR: pattern is required (e.g. '**/*.ts', 'src/**/*.{ts,tsx}').";
            const root = resolvePath(args.cwd ?? "");
            const blocked = guardRoot(root, getFullPcAccess());
            if (blocked) return blocked;
            try {
                if (!fs.existsSync(root)) return `ERROR: Directory not found: ${root}`;
                const re = globToRegExp(pattern);
                const files = walk(root)
                    .filter((f) => re.test(f.rel) || re.test(f.rel.replace(/\\/g, "/")))
                    .sort((a, b) => b.mtimeMs - a.mtimeMs);
                if (files.length === 0) return `No files match "${pattern}" under ${root}.`;
                const shown = files.slice(0, 100).map((f) => f.full);
                const more = files.length > 100 ? `\n…and ${files.length - 100} more (showing newest 100).` : "";
                return `${files.length} match(es) for "${pattern}":\n${shown.join("\n")}${more}`;
            } catch (e) {
                return `ERROR: ${(e as Error).message}`;
            }
        },

        // grep_content(pattern, glob?, path?, ignore_case?) — regex search across files.
        async grep_content(args: Record<string, string>) {
            const pattern = String(args.pattern ?? "");
            if (!pattern) return "ERROR: pattern (regex) is required.";
            const root = resolvePath(args.path ?? "");
            const blocked = guardRoot(root, getFullPcAccess());
            if (blocked) return blocked;
            let rx: RegExp;
            try {
                rx = new RegExp(pattern, args.ignore_case === "true" ? "i" : "");
            } catch (e) {
                return `ERROR: invalid regex: ${(e as Error).message}`;
            }
            const globRe = args.glob ? globToRegExp(args.glob) : null;
            try {
                if (!fs.existsSync(root)) return `ERROR: Path not found: ${root}`;
                const stat = fs.statSync(root);
                const candidates = stat.isDirectory()
                    ? walk(root).filter((f) => !globRe || globRe.test(f.rel) || globRe.test(f.rel.replace(/\\/g, "/")))
                    : [{full: root, rel: path.basename(root), mtimeMs: 0}];

                const lines: string[] = [];
                let fileHits = 0;
                let totalMatches = 0;
                const MAX_PER_FILE = 250;
                const MAX_TOTAL = 1000;

                for (const f of candidates) {
                    if (totalMatches >= MAX_TOTAL) break;
                    let buf: Buffer;
                    try { buf = fs.readFileSync(f.full); } catch { continue; }
                    if (buf.length > 5 * 1024 * 1024 || looksBinary(buf)) continue;
                    const content = buf.toString("utf-8");
                    const fileLines = content.split(/\r?\n/);
                    let perFile = 0;
                    for (let i = 0; i < fileLines.length; i++) {
                        if (rx.test(fileLines[i])) {
                            rx.lastIndex = 0; // reset in case a /g slips in later
                            const snippet = fileLines[i].length > 300 ? fileLines[i].slice(0, 300) + "…" : fileLines[i];
                            lines.push(`${f.full}:${i + 1}: ${snippet.trim()}`);
                            perFile++;
                            totalMatches++;
                            if (perFile >= MAX_PER_FILE || totalMatches >= MAX_TOTAL) break;
                        }
                    }
                    if (perFile > 0) fileHits++;
                }

                if (totalMatches === 0) return `No matches for /${pattern}/${args.glob ? ` in ${args.glob}` : ""}.`;
                const cap = totalMatches >= MAX_TOTAL ? `\n…(capped at ${MAX_TOTAL} matches)` : "";
                return `${totalMatches} match(es) in ${fileHits} file(s):\n${lines.join("\n")}${cap}`;
            } catch (e) {
                return `ERROR: ${(e as Error).message}`;
            }
        },

        // edit_file(path, old_string, new_string, replace_all?) — exact-string replace.
        // Claude Code semantics: old_string must be unique unless replace_all.
        async edit_file(args: Record<string, string>) {
            const p = String(args.path ?? "");
            if (!p) return "ERROR: path is required.";
            const oldStr = args.old_string ?? "";
            const newStr = args.new_string ?? "";
            if (oldStr === "") return "ERROR: old_string is required and must not be empty.";
            if (oldStr === newStr) return "ERROR: old_string and new_string are identical — nothing to change.";
            const full = resolvePath(p);
            const blocked = guardRoot(full, getFullPcAccess());
            if (blocked) return blocked;
            try {
                if (!fs.existsSync(full)) return `ERROR: File not found: ${full}`;
                if (fs.statSync(full).isDirectory()) return `ERROR: ${full} is a directory.`;
                const before = fs.readFileSync(full, "utf-8");
                const occurrences = before.split(oldStr).length - 1;
                if (occurrences === 0) {
                    return `ERROR: old_string not found in ${full}. It must match the file exactly, including whitespace.`;
                }
                const replaceAll = args.replace_all === "true";
                if (occurrences > 1 && !replaceAll) {
                    return `ERROR: old_string is not unique (${occurrences} occurrences) in ${full}. Provide a longer, unique old_string or set replace_all=true.`;
                }
                const after = replaceAll
                    ? before.split(oldStr).join(newStr)
                    : before.replace(oldStr, newStr);
                fs.writeFileSync(full, after, "utf-8");
                const n = replaceAll ? occurrences : 1;
                return `Edited ${full} — replaced ${n} occurrence(s).`;
            } catch (e) {
                return `ERROR: ${(e as Error).message}`;
            }
        },
    };
}
