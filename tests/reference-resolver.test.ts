import {describe, it, expect, beforeEach} from "vitest";
import {resolveReference, CONFIDENCE_THRESHOLD, ResolvedAction, NeedsClarification} from "../electron/reference-resolver";
import {stmClear, stmRecord, stmGet} from "../electron/short-term-memory";

// helper: record an action exactly like main.ts does
function rec(tool: string, args: object, result = "OK", source: "llm" | "resolver" = "llm") {
    stmRecord(tool, JSON.stringify(args), result, true, source);
}
function asAction(r: ReturnType<typeof resolveReference>): ResolvedAction {
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("action");
    return r as ResolvedAction;
}
function asClarify(r: ReturnType<typeof resolveReference>): NeedsClarification {
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("clarify");
    return r as NeedsClarification;
}

beforeEach(() => stmClear());

describe("resolveReference — non-reference messages pass through", () => {
    it("returns null for a normal open command", () => {
        rec("steam_launch", {game: "Dead by Daylight"});
        expect(resolveReference("Spotify aç")).toBeNull();
        expect(resolveReference("DBD aç")).toBeNull();
        expect(resolveReference("sesi 50 yap")).toBeNull();
        expect(resolveReference("hava nasıl")).toBeNull();
        expect(resolveReference("yeni bir dosya oluştur")).toBeNull();
    });
});

describe("STM upgrade — entity + source are recorded", () => {
    it("captures game entity and source", () => {
        rec("steam_launch", {game: "Cyberpunk 2077"}, "Başlatıldı", "llm");
        const last = stmGet().recentTools.at(-1)!;
        expect(last.entity).toBe("Cyberpunk 2077");
        expect(last.source).toBe("llm");
        expect(stmGet().lastEntity).toBe("Cyberpunk 2077");
    });
    it("captures spotify query entity", () => {
        rec("spotify_search", {query: "Tarkan Kuzu Kuzu"}, "Çalınıyor");
        expect(stmGet().recentTools.at(-1)!.entity).toBe("Tarkan Kuzu Kuzu");
    });
});

describe("repeat — tekrar yap / aynısını yap / az önce yaptığını yap", () => {
    it("replays the last action with same args", () => {
        rec("spotify_volume", {level: "35"});
        for (const phrase of ["tekrar yap", "aynısını yap", "az önce yaptığını yap", "bunu tekrar et"]) {
            const a = asAction(resolveReference(phrase));
            expect(a.tool).toBe("spotify_volume");
            expect(a.args).toEqual({level: "35"});
            expect(a.source).toBe("resolver");
            expect(a.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
        }
    });
});

describe("delta — context-aware, biraz = ±5", () => {
    it("'biraz azalt' subtracts 5 from current volume", () => {
        rec("spotify_volume", {level: "50"});
        const a = asAction(resolveReference("biraz azalt"));
        expect(a.tool).toBe("spotify_volume");
        expect(a.args).toEqual({level: "45"});
    });
    it("'sesi biraz artır' adds 5", () => {
        rec("spotify_volume", {level: "50"});
        const a = asAction(resolveReference("sesi biraz artır"));
        expect(a.args).toEqual({level: "55"});
    });
    it("'biraz daha artır' adds 10 (one notch more than biraz)", () => {
        rec("set_brightness", {level: "80"});
        const a = asAction(resolveReference("biraz daha artır"));
        expect(a.tool).toBe("set_brightness");
        expect(a.args).toEqual({level: "90"});
    });
    it("clamps at 100 / 0", () => {
        rec("spotify_volume", {level: "98"});
        expect(asAction(resolveReference("biraz artır")).args).toEqual({level: "100"});
        stmClear();
        rec("spotify_volume", {level: "3"});
        expect(asAction(resolveReference("biraz azalt")).args).toEqual({level: "0"});
    });
    it("clarifies when no level action exists", () => {
        rec("steam_launch", {game: "DBD"});
        const c = asClarify(resolveReference("biraz azalt"));
        expect(c.confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
    });
});

describe("onu kapat — closeThat", () => {
    it("maps a steam launch to steam_close", () => {
        rec("steam_launch", {game: "Dead by Daylight"});
        const a = asAction(resolveReference("onu kapat"));
        expect(a.tool).toBe("steam_close");
        expect(a.source).toBe("resolver");
    });
    it("maps a spotify action to spotify_pause", () => {
        rec("spotify_play", {});
        const a = asAction(resolveReference("bunu kapat"));
        expect(a.tool).toBe("spotify_pause");
    });
});

describe("son oynadığım / son açtığım", () => {
    it("re-launches last played game", () => {
        rec("steam_launch", {game: "CS2"});
        rec("spotify_play", {}); // noise after
        const a = asAction(resolveReference("son oynadığım oyunu aç"));
        expect(a.tool).toBe("steam_launch");
        expect(a.args).toEqual({game: "CS2"});
    });
    it("re-opens last opened entity", () => {
        rec("steam_launch", {game: "Discord-game"});
        const a = asAction(resolveReference("son açtığımı aç"));
        expect(a.entity).toBe("Discord-game");
    });
});

describe("bir önceki — previous", () => {
    it("resolves to STM[-2]", () => {
        rec("spotify_volume", {level: "50"});
        rec("spotify_next", {});
        const a = asAction(resolveReference("bir öncekini yap"));
        expect(a.tool).toBe("spotify_volume");
    });
    it("clarifies when only one action exists", () => {
        rec("spotify_play", {});
        asClarify(resolveReference("bir öncekini yap"));
    });
});

describe("empty STM — recognized reference but nothing to point to", () => {
    it("asks for clarification (confidence < threshold)", () => {
        const c = asClarify(resolveReference("tekrar yap"));
        expect(c.confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
        expect(c.question).toMatch(/don't know|would you like/i);
    });
});
