import {describe, it, expect, beforeEach} from "vitest";
import * as os from "os";
import * as path from "path";
import {
    recordTaintFromTool, isTainted, taintSource, taintRequiresApproval,
    clearTaint, TAINT_ESCALATED_TOOLS,
} from "../../electron/taint";

// ─────────────────────────────────────────────────────────────────────────────
// Security regression shield (audit A3). Once external content (web/RSS/
// clipboard/foreign files) enters the conversation, destructive tools must
// require mandatory approval — pattern checks and "always allow" grants are
// bypassed by prompt injection, so the taint flag is the actual boundary.
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => clearTaint());

describe("taint sources", () => {
    it("web/RSS/clipboard tools set the taint flag", () => {
        for (const t of ["fetch_url", "web_search", "rss_fetch", "reading_summarize", "read_clipboard", "clipboard_history", "clipboard_search"]) {
            clearTaint();
            expect(isTainted()).toBe(false);
            recordTaintFromTool(t);
            expect(isTainted(), t).toBe(true);
        }
    });

    it("safe tools do not taint", () => {
        for (const t of ["spotify_play", "list_facts", "get_time", "steam_launch", "set_volume"]) {
            recordTaintFromTool(t);
        }
        expect(isTainted()).toBe(false);
    });

    it("read_file on a foreign path taints; AEGIS' own data dir does not", () => {
        recordTaintFromTool("read_file", {path: path.join(os.homedir(), ".aegis", "facts.json")});
        expect(isTainted()).toBe(false);
        recordTaintFromTool("read_file", {path: "~/.aegis/settings.json"});
        expect(isTainted()).toBe(false);
        recordTaintFromTool("read_file", {path: "C:\\Users\\x\\Downloads\\invoice.txt"});
        expect(isTainted()).toBe(true);
    });

    it("remembers the first taint source for the approval dialog", () => {
        recordTaintFromTool("fetch_url");
        recordTaintFromTool("rss_fetch");
        expect(taintSource()).toBe("fetch_url");
    });
});

describe("taint escalation", () => {
    it("clean conversation: no escalation even for run_command", () => {
        expect(taintRequiresApproval("run_command")).toBe(false);
        expect(taintRequiresApproval("delete_file")).toBe(false);
    });

    it("tainted conversation: run_command and destructive tools require approval", () => {
        recordTaintFromTool("fetch_url");
        for (const t of ["run_command", "delete_file", "move_file", "kill_heavy_process", "organize_folder", "bulk_rename", "clear_old_data", "format_code"]) {
            expect(taintRequiresApproval(t), t).toBe(true);
        }
    });

    it("tainted conversation: read-only tools stay free", () => {
        recordTaintFromTool("fetch_url");
        for (const t of ["list_files", "get_time", "spotify_play", "web_search", "read_file"]) {
            expect(taintRequiresApproval(t), t).toBe(false);
        }
    });

    it("taint clears on session reset", () => {
        recordTaintFromTool("fetch_url");
        expect(taintRequiresApproval("run_command")).toBe(true);
        clearTaint();
        expect(isTainted()).toBe(false);
        expect(taintRequiresApproval("run_command")).toBe(false);
        expect(taintSource()).toBeNull();
    });
});

describe("cross-check with permissions.ts", () => {
    it("TAINT_ESCALATED_TOOLS covers run_command + every ALWAYS_DESTRUCTIVE tool", async () => {
        // permissions.ts doesn't export the set — reconstruct via classifyRisk with
        // empty args (ALWAYS_DESTRUCTIVE tools are destructive regardless of args).
        const {classifyRisk} = await import("../../electron/permissions");
        const candidates = [
            "delete_file", "move_file", "kill_heavy_process", "organize_folder",
            "bulk_rename", "clear_old_data", "format_code",
        ];
        for (const t of candidates) {
            if (classifyRisk(t, {}) === "destructive") {
                expect(TAINT_ESCALATED_TOOLS.has(t), `${t} is ALWAYS_DESTRUCTIVE but missing from TAINT_ESCALATED_TOOLS`).toBe(true);
            }
        }
        expect(TAINT_ESCALATED_TOOLS.has("run_command")).toBe(true);
    });
});
