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
        try { fs.unlinkSync(p); } catch { /* yok */ }
    }
}

beforeEach(() => {
    fs.mkdirSync(BASE, {recursive: true});
    clearFiles();
});
afterEach(clearFiles);

// ─── Routing kuralları ───────────────────────────────────────────────────────
describe("model routing", () => {
    it("kural ekler", () => {
        const msg = setModelRoutingRule("code", "groq:qwen3-32b", "kod için");
        expect(msg).toContain("code");
        expect(msg).toContain("groq:qwen3-32b");
    });

    it("boş görev türü / model reddedilir", () => {
        expect(setModelRoutingRule("", "model", "")).toContain("HATA");
        expect(setModelRoutingRule("task", "", "")).toContain("HATA");
    });

    it("aynı görev türü üzerine yazar", () => {
        setModelRoutingRule("code", "model-a", "");
        setModelRoutingRule("code", "model-b", "");
        const rules = JSON.parse(fs.readFileSync(ROUTING, "utf-8"));
        expect(Object.keys(rules).length).toBe(1);
        expect(rules.code.model).toBe("model-b");
    });

    it("kural yokken örnek kullanım gösterir", () => {
        expect(getModelRoutingRules()).toContain("yok");
    });

    it("kuralları listeler", () => {
        setModelRoutingRule("vision", "gpt-4o", "görüntü");
        expect(getModelRoutingRules()).toContain("vision → gpt-4o");
    });
});

// ─── Pipeline kayıt/liste ────────────────────────────────────────────────────
describe("pipeline kayıt", () => {
    it("geçerli adımlarla pipeline kaydeder", () => {
        const steps = JSON.stringify([{prompt: "Özetle: {{input}}"}, {prompt: "Eleştir: {{input}}"}]);
        const msg = savePipeline("analiz", steps, "iki adım");
        expect(msg).toContain("2 adım");
    });

    it("boş ad reddedilir", () => {
        expect(savePipeline("", "[]", "")).toContain("HATA");
    });

    it("geçersiz JSON reddedilir", () => {
        expect(savePipeline("x", "{bozuk", "")).toContain("HATA");
    });

    it("array olmayan steps reddedilir", () => {
        expect(savePipeline("x", '{"prompt":"a"}', "")).toContain("array");
    });

    it("pipeline yokken örnek gösterir", () => {
        expect(listPipelines()).toContain("yok");
    });
});

// ─── Pipeline çalıştırma (LLM callback mock) ─────────────────────────────────
describe("pipelineRun", () => {
    it("LLM bağlı değilken hata", async () => {
        registerLLMCallback(null as never);
        savePipeline("p", JSON.stringify([{prompt: "x"}]), "");
        const out = await pipelineRun("p", "girdi");
        expect(out).toContain("hazır değil");
    });

    it("{{input}} her adımda önceki çıktıyla değişir (zincir)", async () => {
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
        // 1. adım girdiyle, 2. adım 1. adımın UPPER çıktısıyla beslenir
        expect(seen[0]).toBe("adım1: merhaba");
        expect(seen[1]).toBe("adım2: ADIM1: MERHABA");
        expect(out).toContain("tamamlandı");
    });

    it("olmayan pipeline hata döner", async () => {
        registerLLMCallback(async () => "x");
        const out = await pipelineRun("yok", "girdi");
        expect(out).toContain("HATA");
    });

    it("adım hatası zinciri durdurur", async () => {
        registerLLMCallback(async (prompt) => {
            if (prompt.includes("patla")) throw new Error("boom");
            return "ok";
        });
        savePipeline("p", JSON.stringify([{prompt: "patla {{input}}"}, {prompt: "ikinci"}]), "");
        const out = await pipelineRun("p", "x");
        expect(out).toContain("HATA");
        expect(out).not.toContain("Adım 2");
    });
});

// ─── modelCompare ────────────────────────────────────────────────────────────
describe("modelCompare", () => {
    it("2'den az model reddedilir", async () => {
        registerLLMCallback(async () => "x");
        const out = await modelCompare("soru", "groq:qwen3-32b");
        expect(out).toContain("HATA");
        expect(out).toContain("En az 2");
    });

    it("birden fazla modelin yanıtını birleştirir", async () => {
        registerLLMCallback(async (_p, model) => `cevap-${model}`);
        const out = await modelCompare("soru", "groq:a, groq:b");
        expect(out).toContain("cevap-groq:a");
        expect(out).toContain("cevap-groq:b");
    });

    it("bir model patlasa diğeri çalışır", async () => {
        registerLLMCallback(async (_p, model) => {
            if (model === "groq:bad") throw new Error("fail");
            return "iyi";
        });
        const out = await modelCompare("soru", "groq:bad, groq:good");
        expect(out).toContain("HATA: fail");
        expect(out).toContain("iyi");
    });
});
