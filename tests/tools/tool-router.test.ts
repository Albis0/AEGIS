import {describe, it, expect, vi} from "vitest";
import {buildGroupIndex, rankGroups, llmRouteGroups, type RouterCallModel} from "../../electron/tool-router";
import {tokenize, type Bm25Doc} from "../../electron/bm25";

// Three group "documents" like the real router builds (roots + tool names + descs).
const docs: Bm25Doc[] = [
    {id: "0", tokens: tokenize("spotify music song play pause volume playlist track artist")},
    {id: "1", tokens: tokenize("steam game launch library achievement store wishlist")},
    {id: "2", tokens: tokenize("brightness cpu memory disk process powershell telemetry")},
];
const index = buildGroupIndex(docs);

describe("rankGroups", () => {
    it("recovers the right group for a clear query", () => {
        const r = rankGroups(index, tokenize("play a song and set the volume"), {minScore: 0.5});
        expect(r.ids[0]).toBe("0"); // spotify
        expect(r.ambiguous).toBe(false);
    });

    it("returns empty + ambiguous when nothing is relevant", () => {
        const r = rankGroups(index, tokenize("what is the capital of France"));
        expect(r.ids).toEqual([]);
        expect(r.ambiguous).toBe(true);
        expect(r.topScore).toBe(0);
    });

    it("caps candidates at maxGroups", () => {
        const r = rankGroups(index, tokenize("game music brightness"), {minScore: 0.1, maxGroups: 2});
        expect(r.ids.length).toBeLessThanOrEqual(2);
    });

    it("flags ambiguity when the top two are near-tied", () => {
        // 'launch' → steam; 'process' → system; both single distinctive hits.
        const r = rankGroups(index, tokenize("launch process"), {minScore: 0.1, closeRatio: 0.8});
        expect(r.ambiguous).toBe(true);
    });
});

describe("llmRouteGroups", () => {
    const groups = [
        {id: "0", summary: "spotify: music playback"},
        {id: "1", summary: "steam: games"},
    ];

    it("returns the ids the model picks (filtered to valid ones)", async () => {
        const callModel: RouterCallModel = vi.fn(async () => ({choices: [{message: {content: "0, 99"}}]})) as unknown as RouterCallModel;
        const r = await llmRouteGroups("play something", groups, callModel);
        expect(r).toEqual(["0"]); // 99 is not a valid group id → dropped
    });

    it("returns [] on NONE", async () => {
        const callModel: RouterCallModel = vi.fn(async () => ({choices: [{message: {content: "NONE"}}]})) as unknown as RouterCallModel;
        expect(await llmRouteGroups("hello there", groups, callModel)).toEqual([]);
    });

    it("returns [] if the model call throws (best-effort fallback)", async () => {
        const callModel: RouterCallModel = vi.fn(async () => { throw new Error("boom"); }) as unknown as RouterCallModel;
        expect(await llmRouteGroups("play", groups, callModel)).toEqual([]);
    });

    it("returns [] for no groups without calling the model", async () => {
        const callModel = vi.fn() as unknown as RouterCallModel;
        expect(await llmRouteGroups("x", [], callModel)).toEqual([]);
        expect(callModel).not.toHaveBeenCalled();
    });
});
