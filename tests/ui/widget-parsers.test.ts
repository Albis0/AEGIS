import {describe, it, expect} from "vitest";
import {parseRunning, prettyName} from "../../src/components/SteamWidget";
import {parseFacts} from "../../src/components/MemoryModal";

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
