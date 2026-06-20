import {describe, it, expect} from "vitest";
import {frameSignature, signatureDiff, verifyChange, actWithVerification} from "../../electron/action-verifier";

// ─────────────────────────────────────────────────────────────────────────────
// Faz 60 — Computer Use doğrulama döngüsü. Kör koordinat tıklaması hedefi
// ıskalarsa sessizce yanlış yere tıklar. Bu modül eylem öncesi/sonrası kareyi
// karşılaştırıp "etki oldu mu?"yu söyler. Yanlış eşik = ya ıskayı kaçırır ya
// gürültüyü değişim sanar; kilitliyoruz.
// ─────────────────────────────────────────────────────────────────────────────

describe("frameSignature & signatureDiff", () => {
    it("aynı görüntü → fark 0", () => {
        const img = "AAAABBBBCCCCDDDDEEEEFFFF".repeat(20);
        expect(signatureDiff(frameSignature(img), frameSignature(img))).toBe(0);
    });

    it("tamamen farklı görüntü → yüksek fark", () => {
        const a = "A".repeat(400);
        const b = "Z".repeat(400);
        expect(signatureDiff(frameSignature(a), frameSignature(b))).toBeGreaterThan(0.5);
    });

    it("kısmi değişim → kısmi fark (tüm parçalar değil)", () => {
        const a = "A".repeat(400);
        const b = "A".repeat(380) + "Z".repeat(20); // sadece son bölge değişti
        const d = signatureDiff(frameSignature(a), frameSignature(b));
        expect(d).toBeGreaterThan(0);
        expect(d).toBeLessThan(0.5);
    });

    it("boş görüntü çökmeden imza üretir", () => {
        expect(frameSignature("")).toHaveLength(16);
    });
});

describe("verifyChange", () => {
    it("ekran değişti → changed:true", () => {
        const before = "X".repeat(400);
        const after = "Y".repeat(400);
        const r = verifyChange(before, after);
        expect(r.changed).toBe(true);
        expect(r.note).toMatch(/etki etti|değişti/);
    });

    it("ekran değişmedi → changed:false + ıska uyarısı", () => {
        const same = "ABCD".repeat(100);
        const r = verifyChange(same, same);
        expect(r.changed).toBe(false);
        expect(r.note).toMatch(/ıskalamış|yeniden dene|doğrula/i);
    });

    it("screenshot alınamadıysa (boş) güvenli rapor", () => {
        const r = verifyChange("", "abc");
        expect(r.changed).toBe(false);
        expect(r.note).toMatch(/yapılamadı/);
    });
});

describe("actWithVerification — akış", () => {
    it("kare-al → eylem → kare-al → karşılaştır sırasıyla çalışır", async () => {
        const frames = ["AAAA".repeat(100), "ZZZZ".repeat(100)]; // before, after
        let i = 0;
        const snapshot = async () => frames[Math.min(i++, frames.length - 1)];
        const doAction = async () => "tıklandı";
        const {actionResult, verify} = await actWithVerification(snapshot, doAction);
        expect(actionResult).toBe("tıklandı");
        expect(verify.changed).toBe(true);
    });

    it("eylem ekranı değiştirmediyse ıska bildirir", async () => {
        const frame = "SAME".repeat(100);
        const {verify} = await actWithVerification(async () => frame, async () => "tıklandı");
        expect(verify.changed).toBe(false);
    });

    it("snapshot hata atarsa akış çökmez (boş kare → doğrulanamadı)", async () => {
        const snapshot = async () => { throw new Error("ekran yok"); };
        const {actionResult, verify} = await actWithVerification(snapshot, async () => "ok");
        expect(actionResult).toBe("ok");
        expect(verify.note).toMatch(/yapılamadı/);
    });
});
