import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// os.homedir() is pinned — uses the real workspace directory, clean before each test
const WORKSPACES_DIR = path.join(os.homedir(), ".aegis", "workspaces");
const ACTIVE_WS_PATH = path.join(os.homedir(), ".aegis", "active-workspace.json");

import {workspaceCreate, workspaceSwitch, workspaceList, workspaceDelete, workspaceExport, workspaceImport} from "../../electron/workspace";

function cleanupWorkspaces(): void {
    try { fs.rmSync(WORKSPACES_DIR, {recursive: true, force: true}); } catch {}
    try { fs.unlinkSync(ACTIVE_WS_PATH); } catch {}
    fs.mkdirSync(WORKSPACES_DIR, {recursive: true});
}

beforeEach(() => {
    cleanupWorkspaces();
});

afterEach(() => {
    cleanupWorkspaces();
});

describe("workspace CRUD", () => {
    it("creates a workspace", () => {
        const result = workspaceCreate("crud-ws", "Test workspace");
        expect(result).toContain("created");
    });

    it("prevents duplicate creation", () => {
        workspaceCreate("dup-ws", "First");
        const result = workspaceCreate("dup-ws", "Duplicate");
        expect(result).toContain("ERROR");
    });

    it("lists workspaces", () => {
        workspaceCreate("list-ws", "For listing");
        const list = workspaceList();
        expect(list).toContain("list-ws");
    });

    it("switches workspace", () => {
        workspaceCreate("switch-ws", "For switching");
        const {result} = workspaceSwitch("switch-ws");
        expect(result).toContain("switched");
    });

    it("returns error for unknown workspace", () => {
        const {result} = workspaceSwitch("yoktur-bilinmeyen");
        expect(result).toContain("ERROR");
    });

    it("exports and imports workspace", () => {
        workspaceCreate("export-ws", "Export test");
        const exportResult = workspaceExport("export-ws");
        expect(exportResult).toContain("exported");

        const exportPath = path.join(os.homedir(), ".aegis", "workspace_export-ws_export.json");
        expect(fs.existsSync(exportPath)).toBe(true);

        workspaceDelete("export-ws");
        const importResult = workspaceImport(exportPath);
        expect(importResult).toContain("imported");

        const list = workspaceList();
        expect(list).toContain("export-ws");
    });

    it("deletes a workspace", () => {
        workspaceCreate("delete-me", "To be deleted");
        const result = workspaceDelete("delete-me");
        expect(result).toContain("deleted");
    });
});
