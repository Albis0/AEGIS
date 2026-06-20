import {describe, it, expect} from "vitest";
import {classifyError, verifyStep, buildPlanPrompt} from "../../electron/goal-executor";

// ─────────────────────────────────────────────────────────────────────────────
// Faz 56 — Goal Executor. Çok-adımlı görevde "kör tekrar yerine strateji değiştir":
// bir tool sonucu hata taksonomisine atanır, doğrulama adımı ilerleme/tıkanma/dur
// kararı verir. Yanlış sınıflandırma = ya sonsuz tekrar ya erken pes; kilitliyoruz.
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyError taksonomisi", () => {
    it("başarı sonucu → ok (hata değil)", () => {
        const v = classifyError("Spotify açıldı, çalmaya başladı.");
        expect(v.kind).toBe("ok");
        expect(v.isError).toBe(false);
    });

    it("engellenen eylem → blocked (tekrar etme)", () => {
        for (const r of [
            "ENGELLENDI (döngü koruması): aynı işlem tekrarı",
            "ENGELLENDI (kullanıcı onayı reddedildi): delete_file",
        ]) {
            const v = classifyError(r);
            expect(v.kind).toBe("blocked");
            expect(v.retriable).toBe(false);
        }
    });

    it("yetki/izin → permission (yeniden deneme anlamsız)", () => {
        for (const r of ["401 Unauthorized", "403 Forbidden", "Spotify Premium gerekiyor", "izin yok"]) {
            const v = classifyError(r);
            expect(v.kind).toBe("permission");
            expect(v.retriable).toBe(false);
        }
    });

    it("hedef yok → not_found (argümanı değiştir)", () => {
        for (const r of ["Dosya bulunamadı", "404 Not Found", "Bu araç tanımlı değil: x", "geçersiz oyun adı"]) {
            const v = classifyError(r);
            expect(v.kind).toBe("not_found");
            expect(v.retriable).toBe(false);
        }
    });

    it("geçici hata → transient (bir kez daha dene)", () => {
        for (const r of ["zaman aşımı", "ETIMEDOUT", "503 Service Unavailable", "429 rate limit", "sunucu meşgul"]) {
            const v = classifyError(r);
            expect(v.kind).toBe("transient");
            expect(v.retriable).toBe(true);
        }
    });

    it("argüman hatası → invalid_args (düzelt, aynısıyla tekrar etme)", () => {
        const v = classifyError("Araç argümanları geçersiz format içeriyor");
        expect(v.kind).toBe("invalid_args");
        expect(v.retriable).toBe(false);
    });

    it("toparlanamaz → fatal", () => {
        const v = classifyError("HATA: beklenmeyen exception oluştu");
        expect(v.kind).toBe("fatal");
        expect(v.retriable).toBe(false);
    });

    it("blocked, permission'dan önce gelir (öncelik sırası)", () => {
        // hem ENGELLENDI hem izin geçen bir metin → blocked kazanmalı
        expect(classifyError("ENGELLENDI: yetki yok").kind).toBe("blocked");
    });
});

describe("verifyStep kararları", () => {
    it("başarı → progress", () => {
        expect(verifyStep("işlem tamam").status).toBe("progress");
    });
    it("geçici hata → retry", () => {
        expect(verifyStep("zaman aşımı oldu").status).toBe("retry");
    });
    it("hedef yok → stuck (strateji değiştir)", () => {
        expect(verifyStep("dosya bulunamadı").status).toBe("stuck");
    });
    it("fatal/blocked → fail (dur)", () => {
        expect(verifyStep("HATA: çöktü").status).toBe("fail");
        expect(verifyStep("ENGELLENDI (döngü koruması): x").status).toBe("fail");
    });
});

describe("buildPlanPrompt", () => {
    it("hedefi ve adım limitini içerir + plan/doğrula direktifi taşır", () => {
        const p = buildPlanPrompt("masaüstünü temizle", 6);
        expect(p).toContain("masaüstünü temizle");
        expect(p).toContain("maks 6 adım");
        expect(p).toMatch(/planı yaz|adıma böl/);
        expect(p).toMatch(/KONTROL|doğrula|DUR/i);
    });
});
