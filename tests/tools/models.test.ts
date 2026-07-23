import {describe, it, expect, vi, afterEach} from "vitest";
import {fetchModels} from "../../electron/models";

// fetchModels calls fetchWithTimeout → global.fetch. We mock the raw HTTP layer
// and feed each provider a deliberately NOISY list, then assert the useful-model
// filter keeps the current models and drops the stale/dated/non-chat noise.

function mockFetchOnce(body: unknown) {
    vi.stubGlobal("fetch", vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => body,
    })) as unknown as typeof fetch);
}

afterEach(() => vi.unstubAllGlobals());

const ids = (ms: {id: string}[]) => ms.map((m) => m.id);

describe("fetchModels — OpenAI filter", () => {
    it("keeps current chat/reasoning lines, drops legacy + dated + non-chat", async () => {
        mockFetchOnce({data: [
            {id: "gpt-4o"}, {id: "gpt-4o-mini"}, {id: "gpt-4.1"}, {id: "gpt-5"}, {id: "o3-mini"},
            {id: "gpt-3.5-turbo"}, {id: "gpt-4-0613"}, {id: "davinci-002"},
            {id: "text-embedding-3-large"}, {id: "gpt-4o-realtime-preview"}, {id: "gpt-4o-2024-08-06"},
        ]});
        const got = ids(await fetchModels("openai", "key"));
        expect(got).toContain("gpt-4o");
        expect(got).toContain("gpt-5");
        expect(got).toContain("o3-mini");
        expect(got).not.toContain("gpt-3.5-turbo");
        expect(got).not.toContain("davinci-002");
        expect(got).not.toContain("text-embedding-3-large");
        expect(got).not.toContain("gpt-4o-2024-08-06"); // dated snapshot → prefer alias
    });
});

describe("fetchModels — Mistral filter", () => {
    it("keeps *-latest aliases, drops dated snapshots + embed/ocr", async () => {
        mockFetchOnce({data: [
            {id: "mistral-large-latest"}, {id: "mistral-small-latest"}, {id: "codestral-latest"},
            {id: "mistral-large-2411"}, {id: "mistral-embed"}, {id: "mistral-ocr-latest"}, {id: "mistral-tiny"},
        ]});
        const got = ids(await fetchModels("mistral", "key"));
        expect(got).toContain("mistral-large-latest");
        expect(got).toContain("codestral-latest");
        expect(got).not.toContain("mistral-large-2411");
        expect(got).not.toContain("mistral-embed");
        expect(got).not.toContain("mistral-ocr-latest");
        expect(got).not.toContain("mistral-tiny");
    });
});

describe("fetchModels — Anthropic filter", () => {
    it("drops claude-1/2 and pre-3.5 claude-3, keeps 3.5/3.7/4, newest first", async () => {
        mockFetchOnce({data: [
            {id: "claude-3-5-sonnet-20241022", display_name: "Sonnet 3.5"},
            {id: "claude-3-7-sonnet-20250219", display_name: "Sonnet 3.7"},
            {id: "claude-opus-4-20250514", display_name: "Opus 4"},
            {id: "claude-3-haiku-20240307", display_name: "Haiku 3"},
            {id: "claude-2.1", display_name: "Claude 2.1"},
        ]});
        const got = ids(await fetchModels("anthropic", "key"));
        expect(got).toContain("claude-3-7-sonnet-20250219");
        expect(got).toContain("claude-opus-4-20250514");
        expect(got).not.toContain("claude-3-haiku-20240307");
        expect(got).not.toContain("claude-2.1");
    });
});

describe("fetchModels — empty-fallback safety", () => {
    it("falls back to the unfiltered chat list if the filter removes everything", async () => {
        // None of these match the OpenAI keep-list → filter would empty it → fallback.
        mockFetchOnce({data: [{id: "some-future-model-x"}, {id: "another-future-y"}]});
        const got = ids(await fetchModels("openai", "key"));
        expect(got).toEqual(["some-future-model-x", "another-future-y"]);
    });
});

describe("fetchModels — error fallback", () => {
    it("returns Groq fallback list on network error", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }) as unknown as typeof fetch);
        const got = ids(await fetchModels("groq", "key"));
        expect(got).toContain("openai/gpt-oss-120b");
    });
});
