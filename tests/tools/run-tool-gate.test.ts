import {describe, it, expect} from "vitest";
import {WIDGET_SAFE_TOOLS, isWidgetSafeTool, executeTool} from "../../electron/tools";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Security regression shield (audit A1). The generic "run-tool" IPC channel
// bypasses the agent loop's approval gate, so main.ts only forwards tools that
// pass isWidgetSafeTool. These tests lock down the allowlist itself: it must
// contain exactly what the widgets call and must never grow a destructive tool.
// ─────────────────────────────────────────────────────────────────────────────

describe("widget allowlist — membership", () => {
    it("allows the read-only/state tools widgets actually use", () => {
        for (const t of ["list_facts", "pomodoro_status", "smart_home_devices", "steam_game_running", "list_scheduled_tasks"]) {
            expect(isWidgetSafeTool(t), t).toBe(true);
        }
    });

    it("blocks destructive and system tools", () => {
        for (const t of [
            "run_command", "delete_file", "move_file", "write_file",
            "kill_heavy_process", "organize_folder", "bulk_rename",
            "clear_old_data", "computer_use", "mouse_click", "type_text",
            "quit_app", "vault_store", "set_profile",
        ]) {
            expect(isWidgetSafeTool(t), t).toBe(false);
        }
    });

    it("blocks unknown/garbage names", () => {
        expect(isWidgetSafeTool("")).toBe(false);
        expect(isWidgetSafeTool("__proto__")).toBe(false);
        expect(isWidgetSafeTool("run_command ")).toBe(false); // no trimming tricks
    });
});

describe("widget allowlist — stays in sync with src/", () => {
    it("covers every runTool() call site in src/components", () => {
        // Collect every literal tool name passed to window.jarvis.runTool("...")
        // plus the tool names in DomainPanel's TABS definition (tool: "...").
        const dir = path.join(__dirname, "..", "..", "src", "components");
        const used = new Set<string>();
        const walk = (d: string): void => {
            for (const entry of fs.readdirSync(d, {withFileTypes: true})) {
                const p = path.join(d, entry.name);
                if (entry.isDirectory()) { walk(p); continue; }
                if (!/\.(ts|tsx)$/.test(entry.name)) continue;
                const src = fs.readFileSync(p, "utf-8");
                for (const m of src.matchAll(/runTool\(\s*"([a-z_]+)"/g)) used.add(m[1]);
                for (const m of src.matchAll(/\btool:\s*"([a-z_]+)"/g)) used.add(m[1]);
            }
        };
        walk(dir);
        expect(used.size).toBeGreaterThan(0);
        for (const t of used) {
            expect(WIDGET_SAFE_TOOLS.has(t), `src/ calls runTool("${t}") but it is not in WIDGET_SAFE_TOOLS`).toBe(true);
        }
    });
});

describe("executeTool still enforces its own guards behind the allowlist", () => {
    it("unknown tool name returns a not-defined message (never throws)", async () => {
        const res = await executeTool("definitely_not_a_tool", "{}");
        expect(typeof res).toBe("string");
        expect(res).toMatch(/not defined/i);
    });
});
