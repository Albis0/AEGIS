import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
    classifyRisk, needsApproval, isAlwaysAllowed, grantAlways, revokeAlways, _resetCache,
} from "../../electron/permissions";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 54 — Destructive action permission gate. The model could cause
// irreversible damage with a single wrong argument. This module assigns each
// tool a risk level and persists "always allow" decisions in
// ~/.aegis/permissions.json. Read-only tools NEVER prompt.
// ─────────────────────────────────────────────────────────────────────────────

const STORE = path.join(os.homedir(), ".aegis", "permissions.json");
function cleanup() { try { fs.rmSync(STORE, {force: true}); } catch { /* none */ } }
beforeEach(() => { cleanup(); _resetCache(); });
afterEach(cleanup);

describe("risk classification", () => {
    it("read-only tools are safe (no gate prompt)", () => {
        for (const t of ["get_telemetry", "list_files", "web_search", "spotify_play", "read_clipboard"]) {
            expect(classifyRisk(t, {}), t).toBe("safe");
            expect(needsApproval(t, {})).toBe(false);
        }
    });

    it("fixed destructive tools are destructive", () => {
        for (const t of ["delete_file", "move_file", "kill_heavy_process", "bulk_rename", "clear_old_data"]) {
            expect(classifyRisk(t, {}), t).toBe("destructive");
        }
    });

    it("run_command: harmless command is safe", () => {
        expect(classifyRisk("run_command", {command: "Get-Date"})).toBe("safe");
        expect(classifyRisk("run_command", {command: "echo merhaba"})).toBe("safe");
    });

    it("run_command: tehlikeli komut destructive", () => {
        for (const cmd of [
            "Remove-Item -Recurse C:\\proj",
            "rm -rf /tmp/x",
            "Stop-Process -Name node",
            "taskkill /F /IM app.exe",
            "reg delete HKCU\\Software\\X",
            "Restart-Computer",
        ]) {
            expect(classifyRisk("run_command", {command: cmd}), cmd).toBe("destructive");
        }
    });

    it("edit_file is destructive (Faz CC-1)", () => {
        expect(classifyRisk("edit_file", {path: "a.ts"})).toBe("destructive");
        expect(needsApproval("edit_file", {})).toBe(true);
    });

    it("run_shell (Faz CC-2): harmless foreground is safe, dangerous is destructive", () => {
        expect(classifyRisk("run_shell", {command: "npm test"})).toBe("safe");
        expect(classifyRisk("run_shell", {command: "Remove-Item -Recurse C:\\x"})).toBe("destructive");
    });

    it("run_shell: background always requires approval", () => {
        expect(classifyRisk("run_shell", {command: "echo hi", background: "true"})).toBe("destructive");
        expect(classifyRisk("run_shell", {command: "echo hi", background: true})).toBe("destructive");
    });

    it("glob_files / grep_content are read-only (safe)", () => {
        expect(classifyRisk("glob_files", {pattern: "**/*.ts"})).toBe("safe");
        expect(classifyRisk("grep_content", {pattern: "foo"})).toBe("safe");
    });
});

describe("persistent permission store", () => {
    it("needsApproval returns false after grantAlways", () => {
        expect(needsApproval("delete_file", {})).toBe(true);
        grantAlways("delete_file");
        expect(isAlwaysAllowed("delete_file")).toBe(true);
        expect(needsApproval("delete_file", {})).toBe(false);
    });

    it("permission is persisted to disk (also valid on a fresh cache read)", () => {
        grantAlways("kill_heavy_process");
        _resetCache(); // reload from disk
        expect(isAlwaysAllowed("kill_heavy_process")).toBe(true);
    });

    it("revokeAlways revokes the permission", () => {
        grantAlways("move_file");
        revokeAlways("move_file");
        expect(isAlwaysAllowed("move_file")).toBe(false);
        expect(needsApproval("move_file", {})).toBe(true);
    });

    it("calling grantAlways twice on the same tool → single record (no duplicate)", () => {
        grantAlways("delete_file");
        grantAlways("delete_file");
        const raw = JSON.parse(fs.readFileSync(STORE, "utf-8"));
        expect(raw.alwaysAllow.filter((t: string) => t === "delete_file")).toHaveLength(1);
    });

    it("safe tool'a izin verilse bile needsApproval zaten false", () => {
        grantAlways("get_telemetry");
        expect(needsApproval("get_telemetry", {})).toBe(false);
    });
});

describe("corrupted store file", () => {
    it("invalid JSON → empty permission list (no crash)", () => {
        fs.mkdirSync(path.dirname(STORE), {recursive: true});
        fs.writeFileSync(STORE, "{bozuk", "utf-8");
        _resetCache();
        expect(isAlwaysAllowed("delete_file")).toBe(false);
    });
});
