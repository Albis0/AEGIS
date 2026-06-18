import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
    classifyRisk, needsApproval, isAlwaysAllowed, grantAlways, revokeAlways, _resetCache,
} from "../../electron/permissions";

// ─────────────────────────────────────────────────────────────────────────────
// Faz 54 — Yıkıcı eylem izin kapısı. Model tek yanlış argümanla geri dönülmez
// hasar verebilir. Bu modül her tool'u risk seviyesine atar + "her zaman izin ver"
// kararlarını ~/.aegis/permissions.json'da kalıcı tutar. Salt-okuma ASLA sormaz.
// ─────────────────────────────────────────────────────────────────────────────

const STORE = path.join(os.homedir(), ".aegis", "permissions.json");
function cleanup() { try { fs.rmSync(STORE, {force: true}); } catch { /* yok */ } }
beforeEach(() => { cleanup(); _resetCache(); });
afterEach(cleanup);

describe("risk sınıflandırma", () => {
    it("salt-okuma tool'lar safe (kapı sormaz)", () => {
        for (const t of ["get_telemetry", "list_files", "web_search", "spotify_play", "read_clipboard"]) {
            expect(classifyRisk(t, {}), t).toBe("safe");
            expect(needsApproval(t, {})).toBe(false);
        }
    });

    it("sabit yıkıcı tool'lar destructive", () => {
        for (const t of ["delete_file", "move_file", "kill_heavy_process", "bulk_rename", "clear_old_data"]) {
            expect(classifyRisk(t, {}), t).toBe("destructive");
        }
    });

    it("run_command: zararsız komut safe", () => {
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
});

describe("kalıcı izin store", () => {
    it("grantAlways sonrası needsApproval false döner", () => {
        expect(needsApproval("delete_file", {})).toBe(true);
        grantAlways("delete_file");
        expect(isAlwaysAllowed("delete_file")).toBe(true);
        expect(needsApproval("delete_file", {})).toBe(false);
    });

    it("izin diske kalıcı yazılır (yeni cache okumasında da geçerli)", () => {
        grantAlways("kill_heavy_process");
        _resetCache(); // diskten yeniden yükle
        expect(isAlwaysAllowed("kill_heavy_process")).toBe(true);
    });

    it("revokeAlways izni geri alır", () => {
        grantAlways("move_file");
        revokeAlways("move_file");
        expect(isAlwaysAllowed("move_file")).toBe(false);
        expect(needsApproval("move_file", {})).toBe(true);
    });

    it("aynı tool iki kez grantAlways → tek kayıt (duplicate yok)", () => {
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

describe("bozuk store dosyası", () => {
    it("geçersiz JSON → boş izin listesi (çökmeme)", () => {
        fs.mkdirSync(path.dirname(STORE), {recursive: true});
        fs.writeFileSync(STORE, "{bozuk", "utf-8");
        _resetCache();
        expect(isAlwaysAllowed("delete_file")).toBe(false);
    });
});
