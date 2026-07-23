import {describe, it, expect} from "vitest";
import {Bm25, tokenize, type Bm25Doc} from "../../electron/bm25";

describe("tokenize", () => {
    it("lowercases, strips punctuation, keeps Turkish letters, drops 1-2 char noise", () => {
        expect(tokenize("Şarkıyı AÇ, sesi!")).toEqual(["şarkıyı", "aç", "sesi"].filter((w) => w.length > 2));
        // "aç" is 2 chars → dropped; "sesi" kept.
        expect(tokenize("Şarkıyı AÇ, sesi!")).toContain("şarkıyı");
        expect(tokenize("Şarkıyı AÇ, sesi!")).toContain("sesi");
        expect(tokenize("Şarkıyı AÇ, sesi!")).not.toContain("aç");
    });
});

describe("Bm25", () => {
    const docs: Bm25Doc[] = [
        {id: "spotify", tokens: tokenize("play music song volume spotify pause next track playlist")},
        {id: "steam", tokens: tokenize("steam game launch library achievement friend store")},
        {id: "system", tokens: tokenize("volume brightness cpu memory disk process powershell")},
    ];
    const index = new Bm25(docs);

    it("ranks the most relevant doc first", () => {
        const r = index.search("play a song on spotify");
        expect(r[0].id).toBe("spotify");
    });

    it("distinctive rare terms win over common ones", () => {
        // 'volume' appears in both spotify and system; 'brightness' only in system.
        const r = index.search("set the brightness");
        expect(r[0].id).toBe("system");
    });

    it("returns nothing for a query with no overlap", () => {
        expect(index.search("weather forecast tomorrow")).toEqual([]);
    });

    it("respects topK", () => {
        expect(index.search("volume", 1).length).toBeLessThanOrEqual(1);
    });

    it("accepts pre-tokenized queries", () => {
        const r = index.search(tokenize("launch a steam game"));
        expect(r[0].id).toBe("steam");
    });
});
