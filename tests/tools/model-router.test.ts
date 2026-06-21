import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE = path.join(os.homedir(), ".aegis");
const ROUTING = path.join(BASE, "model-routing.json");
const PIPELINES = path.join(BASE, "pipelines.json");

import {
    registerLLMCallback,
    setModelRoutingRule, getModelRoutingRules,
    savePipeline, listPipelines, pipelineRun, modelCompare,
} from "../../electron/model-router";

function clearFiles(): void {
    for (const p of [ROUTING, PIPELINES]) {
        try { fs.unlinkSync(p); } catch { /* none */ }
    }
}

beforeEach(() => {
    fs.mkdirSync(BASE, {recursive: true});
    clearFiles();
});
afterEach(clearFiles);

// ─── Routing rules ───────────────────────────────────────────────────────
describe("model routing", () => {
    it("adds a rule", () => {
        const msg = setModelRoutingRule("code", "groq:qwen3-32b", "for code");
        expect(msg).toContain("code");
        expect(msg).toContain("groq:qwen3-32b");
    });

    it("rejects empty task type / model", () => {
        expect(setModelRoutingRule("", "model", "")).toContain("ERROR");
        expect(setModelRoutingRule("task", "", "")).toContain("ERROR");
    });

    it("overwrites the same task type", () => {
        setModelRoutingRule("code", "model-a", "");
        setModelRoutingRule("code", "model-b", "");
        const rules = JSON.parse(fs.readFileSync(ROUTING, "utf-8"));
        expect(Object.keys(rules).length).toBe(1);
        expect(rules.code.model).toBe("model-b");
    });

    it("shows example usage when no rules exist", () => {
        expect(getModelRoutingRules()).toContain("No model routing rules");
    });

    it("lists rules", () => {
        setModelRoutingRule("vision", "gpt-4o", "image");
        expect(getModelRoutingRules()).toContain("vision → gpt-4o");
    });
});

// ─── Pipeline save/list ────────────────────────────────────────────────────
describe("pipeline save", () => {
    it("saves a pipeline with valid steps", () => {
        const steps = JSON.stringify([{prompt: "Summarize: {{input}}"}, {prompt: "Critique: {{input}}"}]);
        const msg = savePipeline("analiz", steps, "two steps");
        expect(msg).toContain("2 steps");
    });

    it("rejects empty name", () => {
        expect(savePipeline("", "[]", "")).toContain("ERROR");
    });

    it("rejects invalid JSON", () => {
        expect(savePipeline("x", "{bozuk", "")).toContain("ERROR");
    });

    it("rejects non-array steps", () => {
        expect(savePipeline("x", '{"prompt":"a"}', "")).toContain("array");
    });

    it("shows example when no pipelines exist", () => {
        expect(listPipelines()).toContain("No pipelines");
    });
});

// ─── Pipeline run (LLM callback mock) ─────────────────────────────────
describe("pipelineRun", () => {
    it("errors when LLM is not connected", async () => {
        registerLLMCallback(null as never);
        savePipeline("p", JSON.stringify([{prompt: "x"}]), "");
        const out = await pipelineRun("p", "girdi");
        expect(out).toContain("not ready");
    });

    it("{{input}} changes with the previous output at each step (chain)", async () => {
        const seen: string[] = [];
        registerLLMCallback(async (prompt) => {
            seen.push(prompt);
            return prompt.toUpperCase();
        });
        savePipeline("zincir", JSON.stringify([
            {prompt: "adım1: {{input}}"},
            {prompt: "adım2: {{input}}"},
        ]), "");
        const out = await pipelineRun("zincir", "merhaba");
        // step 1 is fed the input, step 2 is fed step 1's UPPER output
        expect(seen[0]).toBe("adım1: merhaba");
        expect(seen[1]).toBe("adım2: ADIM1: MERHABA");
        expect(out).toContain("Pipeline complete");
    });

    it("returns an error for a nonexistent pipeline", async () => {
        registerLLMCallback(async () => "x");
        const out = await pipelineRun("yok", "girdi");
        expect(out).toContain("ERROR");
    });

    it("a step error stops the chain", async () => {
        registerLLMCallback(async (prompt) => {
            if (prompt.includes("patla")) throw new Error("boom");
            return "ok";
        });
        savePipeline("p", JSON.stringify([{prompt: "patla {{input}}"}, {prompt: "ikinci"}]), "");
        const out = await pipelineRun("p", "x");
        expect(out).toContain("ERROR");
        expect(out).not.toContain("Adım 2");
    });
});

// ─── modelCompare ────────────────────────────────────────────────────────────
describe("modelCompare", () => {
    it("rejects fewer than 2 models", async () => {
        registerLLMCallback(async () => "x");
        const out = await modelCompare("soru", "groq:qwen3-32b");
        expect(out).toContain("ERROR");
        expect(out).toContain("at least 2");
    });

    it("combines responses from multiple models", async () => {
        registerLLMCallback(async (_p, model) => `cevap-${model}`);
        const out = await modelCompare("soru", "groq:a, groq:b");
        expect(out).toContain("cevap-groq:a");
        expect(out).toContain("cevap-groq:b");
    });

    it("if one model fails, the other still works", async () => {
        registerLLMCallback(async (_p, model) => {
            if (model === "groq:bad") throw new Error("fail");
            return "iyi";
        });
        const out = await modelCompare("soru", "groq:bad, groq:good");
        expect(out).toContain("ERROR: fail");
        expect(out).toContain("iyi");
    });
});
