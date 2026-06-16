import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const AUTO_PATH = path.join(os.homedir(), ".aegis", "automations.json");

import {
    addAutomation, listAutomations, removeAutomation, toggleAutomation,
    loadAutomations, checkAutomations,
} from "../../electron/automations";

function clearAutos(): void {
    try { fs.writeFileSync(AUTO_PATH, "[]", "utf-8"); } catch { /* yok */ }
}

beforeEach(() => {
    fs.mkdirSync(path.dirname(AUTO_PATH), {recursive: true});
    clearAutos();
});
afterEach(clearAutos);

// ─── Ekleme ────────────────────────────────────────────────────────────────
describe("addAutomation", () => {
    it("geçerli koşulla otomasyon ekler", () => {
        const msg = addAutomation("cpu > 80", "işlemci uyarısı ver");
        expect(msg).toContain("Otomasyon oluşturuldu");
        expect(msg).toContain("cpu > 80");
        expect(loadAutomations().length).toBe(1);
    });

    it("geçersiz koşul hata döner", () => {
        const msg = addAutomation("cpu yüksek", "uyar");
        expect(msg).toContain("HATA");
        expect(loadAutomations().length).toBe(0);
    });

    it("tüm operatörleri kabul eder", () => {
        for (const op of [">", "<", ">=", "<=", "==", "!="]) {
            clearAutos();
            const msg = addAutomation(`cpu ${op} 50`, "uyar");
            expect(msg).not.toContain("HATA");
        }
    });

    it("float threshold kabul edilir", () => {
        const msg = addAutomation("ram > 75.5", "uyar");
        expect(msg).not.toContain("HATA");
    });

    it("eklenen otomasyon enabled=true ile başlar", () => {
        addAutomation("gpu > 90", "gpu uyarısı");
        const list = loadAutomations();
        expect(list[0].enabled).toBe(true);
    });
});

// ─── Listeleme ─────────────────────────────────────────────────────────────
describe("listAutomations", () => {
    it("boşken mesaj döner", () => {
        expect(listAutomations()).toContain("Tanımlı otomasyon yok");
    });

    it("otomasyon listeler", () => {
        addAutomation("ram > 75", "ram temizle");
        const list = listAutomations();
        expect(list).toContain("ram > 75");
        expect(list).toContain("ram temizle");
    });
});

// ─── Silme ─────────────────────────────────────────────────────────────────
describe("removeAutomation", () => {
    it("ID ile siler", () => {
        addAutomation("cpu > 90", "uyar");
        const id = loadAutomations()[0].id;
        const msg = removeAutomation(id);
        expect(msg).toContain("silindi");
        expect(loadAutomations().length).toBe(0);
    });

    it("koşul substring ile siler", () => {
        addAutomation("hour == 23", "gece bildirimi");
        const msg = removeAutomation("hour");
        expect(msg).toContain("silindi");
    });

    it("olmayan otomasyon hata döner", () => {
        expect(removeAutomation("yok-abc")).toContain("bulunamadı");
    });
});

// ─── Toggle ────────────────────────────────────────────────────────────────
describe("toggleAutomation", () => {
    it("enabled → disabled", () => {
        addAutomation("cpu > 80", "uyar");
        const id = loadAutomations()[0].id;
        const msg = toggleAutomation(id);
        expect(msg).toContain("devre dışı");
        expect(loadAutomations()[0].enabled).toBe(false);
    });

    it("disabled → enabled", () => {
        addAutomation("cpu > 80", "uyar");
        const id = loadAutomations()[0].id;
        toggleAutomation(id);                // devre dışı
        const msg = toggleAutomation(id);   // tekrar etkin
        expect(msg).toContain("etkinleştirildi");
        expect(loadAutomations()[0].enabled).toBe(true);
    });

    it("olmayan otomasyon hata döner", () => {
        expect(toggleAutomation("yok")).toContain("bulunamadı");
    });
});

// ─── checkAutomations ──────────────────────────────────────────────────────
describe("checkAutomations", () => {
    it("eşik aşılınca onTrigger çağrılır", () => {
        addAutomation("cpu > 80", "cpu yüksek uyarısı");
        const triggered: string[] = [];
        checkAutomations({cpu: 95}, (action) => triggered.push(action));
        expect(triggered).toContain("cpu yüksek uyarısı");
    });

    it("eşik aşılmayınca tetiklenmez", () => {
        addAutomation("cpu > 80", "uyar");
        const triggered: string[] = [];
        checkAutomations({cpu: 50}, (a) => triggered.push(a));
        expect(triggered).toHaveLength(0);
    });

    it("devre dışı otomasyon tetiklenmez", () => {
        addAutomation("ram > 75", "ram uyarısı");
        const id = loadAutomations()[0].id;
        toggleAutomation(id); // devre dışı
        const triggered: string[] = [];
        checkAutomations({ram: 90}, (a) => triggered.push(a));
        expect(triggered).toHaveLength(0);
    });

    it("metric yoksa tetiklenmez", () => {
        addAutomation("gpu > 90", "gpu uyarısı");
        const triggered: string[] = [];
        checkAutomations({cpu: 100}, (a) => triggered.push(a)); // gpu metriği yok
        expect(triggered).toHaveLength(0);
    });

    it("<= operatörü çalışır", () => {
        addAutomation("hour <= 6", "gece modu");
        const triggered: string[] = [];
        checkAutomations({hour: 3}, (a) => triggered.push(a));
        expect(triggered).toContain("gece modu");
    });

    it("== operatörü çalışır", () => {
        addAutomation("hour == 9", "sabah bildirimi");
        const triggered: string[] = [];
        checkAutomations({hour: 9}, (a) => triggered.push(a));
        expect(triggered).toContain("sabah bildirimi");
    });

    it("!= operatörü çalışır", () => {
        addAutomation("cpu != 0", "cpu aktif");
        const triggered: string[] = [];
        checkAutomations({cpu: 50}, (a) => triggered.push(a));
        expect(triggered).toContain("cpu aktif");
    });
});
