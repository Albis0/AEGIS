import {describe, it, expect, beforeEach} from "vitest";
import {
    LoopGuard, MAX_IDENTICAL, POLL_BUDGET,
} from "../../electron/loop-guard";

// ─────────────────────────────────────────────────────────────────────────────
// Faz 53 — Loop Guard. Degenerate tool-call döngüsü = token/para yakma + "takıldı"
// hissi. Bu modül üç örüntüyü erken yakalamalı: aynı çağrı tekrarı, A-B-A-B
// ping-pong, polling tükenmesi. Davranışı kilitliyoruz; gevşek/sıkı sınırların
// yanlış tarafa kayması bu testlerle yakalanır.
// ─────────────────────────────────────────────────────────────────────────────

let g: LoopGuard;
beforeEach(() => { g = new LoopGuard(); });

describe("aynı (tool,args) tekrarı", () => {
    it(`${MAX_IDENTICAL}. çağrıda engellenir, öncekiler geçer`, () => {
        const args = {file: "a.txt"};
        expect(g.check("delete_file", args).ok).toBe(true);  // 1
        expect(g.check("delete_file", args).ok).toBe(true);  // 2
        const v = g.check("delete_file", args);              // 3 → blok
        expect(v.ok).toBe(false);
        expect(v.pattern).toBe("identical");
        expect(v.reason).toMatch(/delete_file/);
    });

    it("farklı args aynı tool engellenmez (her biri ayrı imza)", () => {
        expect(g.check("write_file", {path: "a"}).ok).toBe(true);
        expect(g.check("write_file", {path: "b"}).ok).toBe(true);
        expect(g.check("write_file", {path: "c"}).ok).toBe(true);
    });

    it("args anahtar sırası imzayı değiştirmez", () => {
        g.check("run_command", {a: 1, b: 2});
        g.check("run_command", {b: 2, a: 1});
        // İki çağrı aynı imza sayılmalı → sayaç 2
        expect(g.countOf("run_command", {a: 1, b: 2})).toBe(2);
    });

    it("parse edilemeyen ham args yine de stabil hash verir", () => {
        g.check("x", "ham-string");
        g.check("x", "ham-string");
        const v = g.check("x", "ham-string");
        expect(v.ok).toBe(false);
    });
});

describe("A-B-A-B ping-pong", () => {
    it("salınım 2. turda yakalanır", () => {
        // farklı args ki identical tetiklenmesin; örüntü tool ADI üzerinden
        expect(g.check("open_app", {n: 1}).ok).toBe(true);   // A
        expect(g.check("close_app", {n: 1}).ok).toBe(true);  // B
        expect(g.check("open_app", {n: 2}).ok).toBe(true);   // A
        const v = g.check("close_app", {n: 2});              // B → A-B-A-B
        expect(v.ok).toBe(false);
        expect(v.pattern).toBe("ping_pong");
    });

    it("aralarında üçüncü tool olunca ping-pong sayılmaz", () => {
        g.check("open_app", {n: 1});
        g.check("close_app", {n: 1});
        g.check("set_volume", {v: 1});
        g.check("open_app", {n: 2});
        const v = g.check("close_app", {n: 2});
        expect(v.ok).toBe(true);
    });
});

describe("polling bütçesi", () => {
    it("durum tool'u identical'a takılmaz, gevşek bütçeyle çalışır", () => {
        // 'status' içeren tool poll sayılır → MAX_IDENTICAL'ı (3) aşsa da geçer
        for (let i = 0; i < POLL_BUDGET; i++) {
            expect(g.check("download_status", {id: "x"}).ok).toBe(true);
        }
    });

    it(`poll bütçesi (${POLL_BUDGET}) aşılınca engellenir`, () => {
        for (let i = 0; i < POLL_BUDGET; i++) g.check("get_telemetry", {});
        const v = g.check("get_telemetry", {});
        expect(v.ok).toBe(false);
        expect(v.pattern).toBe("poll_budget");
    });

    it("list_/get_/check/durum/ilerleme isimleri poll sayılır", () => {
        for (const name of ["list_files", "get_status", "check_health", "durum_sorgu", "indirme_ilerleme"]) {
            const gg = new LoopGuard();
            // identical eşiğini aşacak kadar (4) tekrar → poll olduğu için geçmeli
            for (let i = 0; i < MAX_IDENTICAL + 1; i++) {
                expect(gg.check(name, {}).ok, name).toBe(true);
            }
        }
    });
});

describe("izolasyon", () => {
    it("ayrı LoopGuard örnekleri sayaç paylaşmaz", () => {
        const a = new LoopGuard();
        const b = new LoopGuard();
        a.check("t", {}); a.check("t", {});
        expect(a.countOf("t", {})).toBe(2);
        expect(b.countOf("t", {})).toBe(0);
    });
});
