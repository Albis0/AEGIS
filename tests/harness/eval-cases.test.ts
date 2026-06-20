import {describe, it, expect} from "vitest";
import {EVAL_CASES} from "./eval-cases.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Faz 55 — Eval vaka setinin bütünlüğü. Asıl skorlama tests/harness/
// tool-selection-eval.mjs'te (dist-electron'a karşı, npm run test:eval). Burada
// vaka setinin SAĞLIĞINI kilitliyoruz: yeterli sayı, geçerli alanlar, benzersizlik.
// (Bozuk bir vaka eval'i sessizce zayıflatır → regresyon görünmez kalır.)
// ─────────────────────────────────────────────────────────────────────────────

describe("eval vaka seti bütünlüğü", () => {
    it("ROADMAP kriteri: ≥40 etiketli senaryo", () => {
        expect(EVAL_CASES.length).toBeGreaterThanOrEqual(40);
    });

    it("her vaka geçerli bir kind taşır", () => {
        for (const c of EVAL_CASES) {
            expect(["offer", "resolver", "negative"]).toContain(c.kind);
        }
    });

    it("offer/resolver vakaları expect tool taşır; negative null", () => {
        for (const c of EVAL_CASES) {
            if (c.kind === "negative") expect(c.expect).toBeNull();
            else expect(typeof c.expect).toBe("string");
        }
    });

    it("resolver vakaları seed taşır (STM'i hazırlamak için)", () => {
        for (const c of EVAL_CASES.filter((x) => x.kind === "resolver")) {
            expect(Array.isArray(c.seed)).toBe(true);
            expect(c.seed.length).toBeGreaterThan(0);
        }
    });

    it("kullanıcı mesajları benzersiz (kopya vaka skoru şişirmez)", () => {
        const users = EVAL_CASES.map((c) => c.user);
        expect(new Set(users).size).toBe(users.length);
    });

    it("ROADMAP kriteri: resolver senaryoları dahil", () => {
        expect(EVAL_CASES.some((c) => c.kind === "resolver")).toBe(true);
    });

    it("negatif (saf sohbet) vakaları dahil — yanlış-pozitif tool seçimini yakalar", () => {
        expect(EVAL_CASES.some((c) => c.kind === "negative")).toBe(true);
    });
});
