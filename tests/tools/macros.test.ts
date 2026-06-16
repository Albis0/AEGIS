import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const MACROS_PATH = path.join(os.homedir(), ".aegis", "macros.json");

import {
    startMacroRecording, addMacroStep, stopMacroRecording, isRecording,
    listMacros, deleteMacro, getMacroSteps,
} from "../../electron/macros";

function clearMacros(): void {
    try { fs.writeFileSync(MACROS_PATH, "[]", "utf-8"); } catch { /* yok */ }
}

// recording durumu modül-düzeyinde; her test için sıfırla
function resetRecording(): void {
    if (isRecording()) stopMacroRecording();
}

beforeEach(() => {
    fs.mkdirSync(path.dirname(MACROS_PATH), {recursive: true});
    clearMacros();
    resetRecording();
});
afterEach(() => {
    resetRecording();
    clearMacros();
});

// ─── Kayıt başlatma ────────────────────────────────────────────────────────
describe("startMacroRecording", () => {
    it("kayıt başlatır", () => {
        const msg = startMacroRecording("Oyun Modu");
        expect(isRecording()).toBe(true);
        expect(msg).toContain("Oyun Modu");
    });

    it("ikinci eşzamanlı kayıt reddedilir", () => {
        startMacroRecording("A");
        const msg = startMacroRecording("B");
        expect(msg).toContain("Zaten");
        expect(msg).toContain("Oyun Modu");
    });
});

// ─── Kayıt durdurma ────────────────────────────────────────────────────────
describe("stopMacroRecording", () => {
    it("adımsız makro kaydedilmez", () => {
        startMacroRecording("Boş Makro");
        const msg = stopMacroRecording();
        expect(msg).toContain("adım eklenmedi");
        const macros = JSON.parse(fs.readFileSync(MACROS_PATH, "utf-8"));
        expect(macros.length).toBe(0);
    });

    it("adımlı makro kaydedilir", () => {
        startMacroRecording("İş Modu");
        addMacroStep("VS Code aç");
        addMacroStep("Müziği aç");
        const msg = stopMacroRecording();
        expect(msg).toContain("2 adım");
        expect(isRecording()).toBe(false);
    });

    it("aktif kayıt yokken durdurma hata verir", () => {
        const msg = stopMacroRecording();
        expect(msg).toContain("Aktif makro kaydı yok");
    });
});

// ─── Adım ekleme ───────────────────────────────────────────────────────────
describe("addMacroStep", () => {
    it("adımlar sıralı eklenir", () => {
        startMacroRecording("Sıra Testi");
        addMacroStep("Adım 1");
        addMacroStep("Adım 2");
        addMacroStep("Adım 3");
        stopMacroRecording();
        const steps = getMacroSteps("Sıra Testi");
        expect(steps).toEqual(["Adım 1", "Adım 2", "Adım 3"]);
    });

    it("kayıt yokken addMacroStep sessizce geçilir", () => {
        // recording=null; exception olmamalı
        expect(() => addMacroStep("fantasma")).not.toThrow();
    });
});

// ─── Aynı adda üzerine yazma ───────────────────────────────────────────────
describe("overwrite existing macro", () => {
    it("aynı adlı makro güncellenir", () => {
        startMacroRecording("Oyun");
        addMacroStep("Steam aç");
        stopMacroRecording();

        startMacroRecording("Oyun");
        addMacroStep("Steam aç");
        addMacroStep("Sesi 50 yap");
        stopMacroRecording();

        const steps = getMacroSteps("Oyun");
        expect(steps?.length).toBe(2);
        const macros = JSON.parse(fs.readFileSync(MACROS_PATH, "utf-8"));
        expect(macros.length).toBe(1); // tekrar eklenmedi
    });
});

// ─── Listeleme ─────────────────────────────────────────────────────────────
describe("listMacros", () => {
    it("makro yokken mesaj döner", () => {
        expect(listMacros()).toContain("Kayıtlı makro yok");
    });

    it("makroları listeler", () => {
        startMacroRecording("Çalışma");
        addMacroStep("VS Code aç");
        stopMacroRecording();
        expect(listMacros()).toContain("Çalışma");
    });
});

// ─── Silme ─────────────────────────────────────────────────────────────────
describe("deleteMacro", () => {
    it("isim ile siler", () => {
        startMacroRecording("Silinecek");
        addMacroStep("adım");
        stopMacroRecording();
        const msg = deleteMacro("Silinecek");
        expect(msg).toContain("silindi");
        expect(listMacros()).toContain("Kayıtlı makro yok");
    });

    it("ID ile siler", () => {
        startMacroRecording("ID Testi");
        addMacroStep("adım");
        stopMacroRecording();
        const macros = JSON.parse(fs.readFileSync(MACROS_PATH, "utf-8"));
        const id = macros[0].id;
        expect(deleteMacro(id)).toContain("silindi");
    });

    it("olmayan makro için hata döner", () => {
        expect(deleteMacro("yok-abc")).toContain("bulunamadı");
    });
});

// ─── getMacroSteps ─────────────────────────────────────────────────────────
describe("getMacroSteps", () => {
    it("doğru adımları döner", () => {
        startMacroRecording("Müzik");
        addMacroStep("Spotify aç");
        addMacroStep("Sesi 70 yap");
        stopMacroRecording();
        const steps = getMacroSteps("Müzik");
        expect(steps).toHaveLength(2);
        expect(steps?.[0]).toBe("Spotify aç");
    });

    it("olmayan makro null döner", () => {
        expect(getMacroSteps("yok")).toBeNull();
    });

    it("substring ile bulur", () => {
        startMacroRecording("Uzun Makro Adı");
        addMacroStep("test");
        stopMacroRecording();
        expect(getMacroSteps("Uzun")).not.toBeNull();
    });
});
