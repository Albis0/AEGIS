import {describe, it, expect} from "vitest";
import {parseRunning, prettyName} from "../../src/components/SteamWidget";
import {parseFacts} from "../../src/components/MemoryModal";
import {parseHome} from "../../src/components/SmartHomeWidget";
import {parsePomo, fmt} from "../../src/components/PomodoroWidget";

// ─────────────────────────────────────────────────────────────────────────────
// Faz 63 — Domain UI widget/modal'larının parse mantığı. Widget'lar mevcut tool
// çıktısını (metin) parse edip görsel sunar; parse kırılırsa UI boş/yanlış görünür.
// Saf parse fonksiyonlarını kilitliyoruz (render'sız — hızlı, jsdom gerekmez).
// ─────────────────────────────────────────────────────────────────────────────

describe("SteamWidget.parseRunning", () => {
    it("çalışan oyunları ayrıştırır", () => {
        expect(parseRunning("Çalışan oyun(lar): hl2.exe, dota2")).toEqual(["hl2.exe", "dota2"]);
    });
    it("oyun yokken boş döner", () => {
        expect(parseRunning("Şu an çalışan Steam oyunu yok.")).toEqual([]);
    });
    it("HATA/bağlantı sorununda boş döner", () => {
        expect(parseRunning("HATA: Steam kurulu değil.")).toEqual([]);
    });
    it("tek oyun", () => {
        expect(parseRunning("Çalışan oyun(lar): cs2.exe")).toEqual(["cs2.exe"]);
    });
});

describe("SteamWidget.prettyName", () => {
    it("uzantı ve alt çizgi temizler, baş harf büyütür", () => {
        expect(prettyName("hl2.exe")).toBe("Hl2");
        expect(prettyName("dead_by_daylight")).toBe("Dead By Daylight");
        expect(prettyName("cs2")).toBe("Cs2");
    });
});

describe("MemoryModal.parseFacts", () => {
    it("id + içerik + etiketleri ayrıştırır", () => {
        const raw = "• [abc] Kullanıcının adı Ahmet. (profil, isim)\n• [def] Python kullanıyor.";
        const facts = parseFacts(raw);
        expect(facts).toHaveLength(2);
        expect(facts[0]).toEqual({id: "abc", content: "Kullanıcının adı Ahmet.", tags: ["profil", "isim"]});
        expect(facts[1]).toEqual({id: "def", content: "Python kullanıyor.", tags: []});
    });
    it("gerçek yokken boş döner", () => {
        expect(parseFacts("Kayıtlı gerçek yok. 'Bunu bil: …' ile ekleyebilirsin.")).toEqual([]);
    });
    it("biçimsiz satırları atlar", () => {
        expect(parseFacts("rastgele metin\n• [x] geçerli")).toEqual([{id: "x", content: "geçerli", tags: []}]);
    });
});

describe("SmartHomeWidget.parseHome", () => {
    it("cihaz sayısı + açık ışıkları sayar", () => {
        const raw = "Akıllı ev cihazları (5):\n📍 Salon:\n  • Lamba: açık (%70)\n  • Priz: kapalı\n📍 Yatak:\n  • Tavan: açık";
        expect(parseHome(raw)).toEqual({deviceCount: 5, lightsOn: 2});
    });
    it("HA yapılandırılmamışsa null", () => {
        expect(parseHome("HATA: Home Assistant yapılandırılmamış.")).toBeNull();
        expect(parseHome("Akıllı ev cihazları alınamadı: timeout")).toBeNull();
    });
    it("cihaz yoksa null (sayı eşleşmez)", () => {
        expect(parseHome("Home Assistant'a bağlanıldı ama kontrol edilebilir cihaz bulunamadı.")).toBeNull();
    });
});

describe("PomodoroWidget.parsePomo + fmt", () => {
    it("aktif durumu ayrıştırır", () => {
        expect(parsePomo("WORK|1320|3")).toEqual({phase: "WORK", remaining: 1320, session: 3});
        expect(parsePomo("BREAK|240|3")).toEqual({phase: "BREAK", remaining: 240, session: 3});
    });
    it("INACTIVE → null", () => {
        expect(parsePomo("INACTIVE")).toBeNull();
        expect(parsePomo("")).toBeNull();
    });
    it("fmt saniyeyi M:SS biçimler", () => {
        expect(fmt(1320)).toBe("22:00");
        expect(fmt(65)).toBe("1:05");
        expect(fmt(9)).toBe("0:09");
    });
});
