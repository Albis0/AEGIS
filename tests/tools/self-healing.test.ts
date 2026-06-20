import {describe, it, expect} from "vitest";
import {diagnose, type HealEntry} from "../../electron/self-healing";

// ─────────────────────────────────────────────────────────────────────────────
// Faz 59 — Self-Healing. Loop-guard aynı ÇAĞRIYI keser; bu modül aynı tool
// AİLESİNİN farklı argümanlarla da olsa hep AYNI hatayı vermesini (kök sebep aynı)
// tanır ve net teşhis sunar. Yanlış eşik = ya gürültü ya kaçırma; kilitliyoruz.
// ─────────────────────────────────────────────────────────────────────────────

function fail(tool: string, result: string): HealEntry { return {tool, success: false, result}; }
function ok(tool: string): HealEntry { return {tool, success: true, result: "tamam"}; }

describe("diagnose — tekrarlayan hata örüntüsü", () => {
    it("aynı domain 3 kez aynı hata sınıfı → teşhis", () => {
        const recent = [
            fail("spotify_play", "Spotify Premium gerekiyor"),
            fail("spotify_next", "401 Unauthorized"),
            fail("spotify_volume", "Premium gerek"),
        ];
        const d = diagnose(recent);
        expect(d.detected).toBe(true);
        expect(d.family).toBe("spotify");
        expect(d.kind).toBe("permission");
        expect(d.count).toBe(3);
        expect(d.advice).toMatch(/yetki|erişim|Premium/i);
    });

    it("eşiğin altında (2 hata) → teşhis yok", () => {
        const recent = [
            fail("spotify_play", "401 Unauthorized"),
            fail("spotify_next", "Premium gerek"),
        ];
        expect(diagnose(recent).detected).toBe(false);
    });

    it("farklı hata sınıfları → örüntü sayılmaz (sınıf bazında ayrı sayılır)", () => {
        const recent = [
            fail("spotify_play", "401 Unauthorized"),       // permission
            fail("spotify_next", "bulunamadı"),             // not_found
            fail("spotify_volume", "zaman aşımı"),          // transient
        ];
        expect(diagnose(recent).detected).toBe(false);     // her sınıf 1 kez
    });

    it("başarılı çağrılar örüntüyü kirletmez", () => {
        const recent = [
            fail("git_status", "geçersiz argüman"),
            ok("git_log"),
            fail("git_diff", "geçersiz format"),
            ok("git_commit"),
            fail("git_branch", "geçersiz parametre"),
        ];
        const d = diagnose(recent);
        expect(d.detected).toBe(true);
        expect(d.family).toBe("git");
        expect(d.kind).toBe("invalid_args");
    });

    it("farklı domainler birbirini etkilemez", () => {
        const recent = [
            fail("spotify_play", "401"),
            fail("steam_launch", "bulunamadı"),
            fail("spotify_next", "izin yok"),
        ];
        expect(diagnose(recent).detected).toBe(false); // her domain < eşik
    });

    it("eşik düşürülürse daha erken yakalar (parametrik)", () => {
        const recent = [fail("ssh_run", "zaman aşımı"), fail("ssh_add_host", "timeout")];
        expect(diagnose(recent, 2).detected).toBe(true);
        expect(diagnose(recent, 3).detected).toBe(false);
    });

    it("boş/hatasız geçmiş → teşhis yok", () => {
        expect(diagnose([]).detected).toBe(false);
        expect(diagnose([ok("x"), ok("y")]).detected).toBe(false);
    });

    it("tekil tool (alt çizgisiz) ailesi kendisidir", () => {
        const recent = [fail("screenshot", "zaman aşımı"), fail("screenshot", "timeout"), fail("screenshot", "meşgul")];
        const d = diagnose(recent);
        expect(d.detected).toBe(true);
        expect(d.family).toBe("screenshot");
    });
});
