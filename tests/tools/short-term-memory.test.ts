import {describe, it, expect, beforeEach} from "vitest";
import {
    stmRecord, stmClear, stmGet, stmBuildPromptBlock,
    stmLastByToolPrefix, stmLastWhere,
} from "../../electron/short-term-memory";

// ─────────────────────────────────────────────────────────────────────────────
// Kısa süreli bellek (STM) — referans çözümlemenin ("onu kapat", "tekrar çal",
// "son oynadığım") temeli. Her tool çalışınca güncellenir; bu bağlam yanlışsa
// referanslar yanlış hedefe gider. Davranışı kilitliyoruz.
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => stmClear());

describe("stmRecord temel", () => {
    it("son tool/args/result yakalanır", () => {
        stmRecord("run_command", '{"command":"notepad"}', "açıldı", true);
        const ctx = stmGet();
        expect(ctx.lastTool).toBe("run_command");
        expect(ctx.lastArgs.command).toBe("notepad");
        expect(ctx.lastResult).toContain("açıldı");
    });

    it("bozuk JSON args boş obje olarak ele alınır (throw etmez)", () => {
        stmRecord("x", "{bozuk", "r", true);
        expect(stmGet().lastArgs).toEqual({});
    });

    it("recentTools MAX_ENTRIES (20) ile sınırlı", () => {
        for (let i = 0; i < 30; i++) stmRecord("t", `{"i":${i}}`, "ok", true);
        expect(stmGet().recentTools.length).toBe(20);
        // en eski düşmüş olmalı (i=10 ilk eleman)
        expect(stmGet().recentTools[0].args.i).toBe(10);
    });
});

describe("entity çıkarımı (lastEntity)", () => {
    it("steam_ tool'undan oyun adı", () => {
        stmRecord("steam_launch", '{"game":"Dota 2"}', "başlatıldı", true);
        expect(stmGet().lastEntity).toBe("Dota 2");
    });

    it("spotify_ tool'undan uri/query", () => {
        stmRecord("spotify_play", '{"uri":"spotify:track:abc"}', "çalıyor", true);
        expect(stmGet().lastEntity).toBe("spotify:track:abc");
    });

    it("read_file'dan dosya yolu", () => {
        stmRecord("read_file", '{"path":"~/notes.txt"}', "içerik", true);
        expect(stmGet().lastEntity).toBe("~/notes.txt");
    });

    it("run_command Start-Process'ten uygulama adı", () => {
        stmRecord("run_command", '{"command":"Start-Process chrome"}', "ok", true);
        expect(stmGet().lastEntity).toBe("chrome");
    });
});

describe("domain hedefleri", () => {
    it("spotify uri → lastSpotifyTrack", () => {
        stmRecord("spotify_play", '{"uri":"spotify:track:xyz"}', "ok", true);
        expect(stmGet().lastSpotifyTrack).toBe("spotify:track:xyz");
    });

    it("spotify context_uri → lastSpotifyContext", () => {
        stmRecord("spotify_play", '{"context_uri":"spotify:playlist:p1"}', "ok", true);
        expect(stmGet().lastSpotifyContext).toBe("spotify:playlist:p1");
    });

    it("now_playing sonucundaki track URI yakalanır", () => {
        stmRecord("spotify_now_playing", "{}", "Çalıyor: spotify:track:fromResult", true);
        expect(stmGet().lastSpotifyTrack).toBe("spotify:track:fromResult");
    });
});

describe("stmClear", () => {
    it("her şeyi sıfırlar", () => {
        stmRecord("t", "{}", "r", true);
        stmClear();
        const ctx = stmGet();
        expect(ctx.lastTool).toBeNull();
        expect(ctx.recentTools).toEqual([]);
    });
});

describe("stmBuildPromptBlock", () => {
    it("boş bellekte boş string (ilk turda prompt temiz)", () => {
        expect(stmBuildPromptBlock()).toBe("");
    });

    it("produces a RECENT ACTIONS block when there is a record", () => {
        stmRecord("spotify_play", '{"uri":"spotify:track:abc"}', "playing", true);
        const block = stmBuildPromptBlock();
        expect(block).toContain("RECENT ACTIONS");
        expect(block).toContain("spotify_play");
        expect(block).toContain("lastSpotifyTrack");
    });
});

describe("stmLastByToolPrefix / stmLastWhere", () => {
    it("prefix'e göre en son eşleşen tool", () => {
        stmRecord("run_command", "{}", "ok", true);
        stmRecord("spotify_play", '{"uri":"u1"}', "ok", true);
        stmRecord("spotify_pause", "{}", "ok", true);
        const last = stmLastByToolPrefix("spotify_");
        expect(last?.tool).toBe("spotify_pause");
    });

    it("prefix eşleşmesi yoksa null", () => {
        stmRecord("run_command", "{}", "ok", true);
        expect(stmLastByToolPrefix("steam_")).toBeNull();
    });

    it("stmLastWhere predikatına göre en son eşleşen", () => {
        stmRecord("steam_launch", '{"game":"A"}', "ok", true);
        stmRecord("steam_close", '{"game":"B"}', "ok", false);
        const lastOk = stmLastWhere((e) => e.success);
        expect(lastOk?.args.game).toBe("A");
    });
});
