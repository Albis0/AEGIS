import {describe, it, expect, beforeEach} from "vitest";
import {
    stmRecord, stmClear, stmGet, stmBuildPromptBlock,
    stmLastByToolPrefix, stmLastWhere,
} from "../../electron/short-term-memory";

// ─────────────────────────────────────────────────────────────────────────────
// Short-term memory (STM) — the foundation of reference resolution ("turn it off",
// "play it again", "what I last played"). Updated whenever a tool runs; if this
// context is wrong, references go to the wrong target. Locking down the behavior.
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => stmClear());

describe("stmRecord basics", () => {
    it("captures the last tool/args/result", () => {
        stmRecord("run_command", '{"command":"notepad"}', "açıldı", true);
        const ctx = stmGet();
        expect(ctx.lastTool).toBe("run_command");
        expect(ctx.lastArgs.command).toBe("notepad");
        expect(ctx.lastResult).toContain("açıldı");
    });

    it("malformed JSON args are treated as an empty object (does not throw)", () => {
        stmRecord("x", "{bozuk", "r", true);
        expect(stmGet().lastArgs).toEqual({});
    });

    it("recentTools is capped at MAX_ENTRIES (20)", () => {
        for (let i = 0; i < 30; i++) stmRecord("t", `{"i":${i}}`, "ok", true);
        expect(stmGet().recentTools.length).toBe(20);
        // the oldest entries should have been dropped (i=10 is the first element)
        expect(stmGet().recentTools[0].args.i).toBe(10);
    });
});

describe("entity extraction (lastEntity)", () => {
    it("game name from a steam_ tool", () => {
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

    it("app name from run_command Start-Process", () => {
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

    it("captures the track URI from the now_playing result", () => {
        stmRecord("spotify_now_playing", "{}", "Çalıyor: spotify:track:fromResult", true);
        expect(stmGet().lastSpotifyTrack).toBe("spotify:track:fromResult");
    });
});

describe("stmClear", () => {
    it("resets everything", () => {
        stmRecord("t", "{}", "r", true);
        stmClear();
        const ctx = stmGet();
        expect(ctx.lastTool).toBeNull();
        expect(ctx.recentTools).toEqual([]);
    });
});

describe("stmBuildPromptBlock", () => {
    it("empty string for an empty memory (prompt is clean on the first turn)", () => {
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
    it("the most recent tool matching a prefix", () => {
        stmRecord("run_command", "{}", "ok", true);
        stmRecord("spotify_play", '{"uri":"u1"}', "ok", true);
        stmRecord("spotify_pause", "{}", "ok", true);
        const last = stmLastByToolPrefix("spotify_");
        expect(last?.tool).toBe("spotify_pause");
    });

    it("null when there is no prefix match", () => {
        stmRecord("run_command", "{}", "ok", true);
        expect(stmLastByToolPrefix("steam_")).toBeNull();
    });

    it("the most recent match per the stmLastWhere predicate", () => {
        stmRecord("steam_launch", '{"game":"A"}', "ok", true);
        stmRecord("steam_close", '{"game":"B"}', "ok", false);
        const lastOk = stmLastWhere((e) => e.success);
        expect(lastOk?.args.game).toBe("A");
    });
});
