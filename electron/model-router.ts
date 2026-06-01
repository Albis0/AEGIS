import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const DATA_DIR = path.join(os.homedir(), ".aegis");
const ROUTING_FILE = path.join(DATA_DIR, "model-routing.json");
const PIPELINES_FILE = path.join(DATA_DIR, "pipelines.json");

interface RoutingRule {
    taskType: string;
    model: string;
    description: string;
    updatedAt: number;
}

interface Pipeline {
    name: string;
    description: string;
    steps: PipelineStep[];
    createdAt: number;
}

interface PipelineStep {
    prompt: string;
    model?: string;
}

// Tek-atışlık LLM çağrısı — main.ts enjekte eder (model-router'ın Groq erişimi yok).
// model: "provider:modelId" veya sadece "modelId" (varsayılan provider).
type LLMCallback = (prompt: string, model?: string) => Promise<string>;
let _llmCallback: LLMCallback | null = null;
export function registerLLMCallback(cb: LLMCallback): void { _llmCallback = cb; }

function loadRouting(): Record<string, RoutingRule> {
    try { return JSON.parse(fs.readFileSync(ROUTING_FILE, "utf-8")); } catch { return {}; }
}

function saveRouting(rules: Record<string, RoutingRule>): void {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    fs.writeFileSync(ROUTING_FILE, JSON.stringify(rules, null, 2));
}

function loadPipelines(): Record<string, Pipeline> {
    try { return JSON.parse(fs.readFileSync(PIPELINES_FILE, "utf-8")); } catch { return {}; }
}

function savePipelinesFile(pipelines: Record<string, Pipeline>): void {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    fs.writeFileSync(PIPELINES_FILE, JSON.stringify(pipelines, null, 2));
}

export function setModelRoutingRule(taskType: string, model: string, description: string): string {
    if (!taskType.trim()) return "HATA: Görev türü gerekli.";
    if (!model.trim()) return "HATA: Model gerekli.";
    const rules = loadRouting();
    rules[taskType] = {taskType, model, description, updatedAt: Date.now()};
    saveRouting(rules);
    return `Yönlendirme kuralı eklendi: "${taskType}" → ${model}${description ? " (" + description + ")" : ""}`;
}

export function getModelRoutingRules(): string {
    const rules = loadRouting();
    const entries = Object.values(rules);
    if (entries.length === 0) {
        return "Model yönlendirme kuralı yok.\n\nÖrnek kullanım: model_route_set(task_type='code', model='groq:qwen3-32b', description='Kod görevleri için')";
    }
    const lines = entries.map((r) => `• ${r.taskType} → ${r.model}${r.description ? " (" + r.description + ")" : ""}`);
    return `Model Yönlendirme Kuralları (${lines.length}):\n${lines.join("\n")}`;
}

export function savePipeline(name: string, stepsJson: string, description: string): string {
    if (!name.trim()) return "HATA: Pipeline adı gerekli.";
    let steps: PipelineStep[];
    try {
        steps = JSON.parse(stepsJson);
        if (!Array.isArray(steps)) return "HATA: steps bir JSON array olmalı.";
    } catch (e) {
        return `HATA: steps JSON ayrıştırılamadı: ${(e as Error).message}`;
    }
    const pipelines = loadPipelines();
    pipelines[name] = {name, description, steps, createdAt: Date.now()};
    savePipelinesFile(pipelines);
    return `Pipeline kaydedildi: "${name}" (${steps.length} adım)${description ? " — " + description : ""}`;
}

export function listPipelines(): string {
    const pipelines = loadPipelines();
    const entries = Object.values(pipelines);
    if (entries.length === 0) return "Pipeline yok.\n\nÖrnek: pipeline_save(name='analiz', steps='[{\"prompt\":\"Özetle: {{input}}\",\"model\":\"groq:qwen3-32b\"},{\"prompt\":\"Sonuçları eleştir: {{input}}\"}]')";
    const lines = entries.map((p) => `• ${p.name} (${p.steps.length} adım)${p.description ? " — " + p.description : ""}`);
    return `Pipeline'lar (${lines.length}):\n${lines.join("\n")}`;
}

export async function pipelineRun(pipelineName: string, input: string): Promise<string> {
    const pipelines = loadPipelines();
    const pipeline = pipelines[pipelineName];
    if (!pipeline) {
        const names = Object.keys(pipelines);
        return names.length === 0
            ? "HATA: Pipeline yok. Önce pipeline_save ile pipeline oluştur."
            : `HATA: "${pipelineName}" bulunamadı. Mevcut: ${names.join(", ")}`;
    }

    if (!_llmCallback) return "HATA: LLM bağlantısı hazır değil. Uygulamayı yeniden başlat.";

    let current = input;
    const results: string[] = [`Pipeline: ${pipelineName} (${pipeline.steps.length} adım)\nGirdi: ${input.slice(0, 100)}\n`];

    for (let i = 0; i < pipeline.steps.length; i++) {
        const step = pipeline.steps[i];
        const prompt = step.prompt.replace(/\{\{input\}\}/g, current);
        try {
            const out = await _llmCallback(prompt, step.model);
            current = out.trim();
            results.push(`── Adım ${i + 1}${step.model ? ` (${step.model})` : ""} ──\n${current}`);
        } catch (e) {
            results.push(`── Adım ${i + 1} HATA ──\n${(e as Error).message}`);
            return results.join("\n\n");
        }
    }

    results.push(`\n✓ Pipeline tamamlandı (${pipeline.steps.length} adım).`);
    return results.join("\n\n");
}

export async function modelCompare(prompt: string, models: string): Promise<string> {
    const modelList = models.split(",").map((m) => m.trim()).filter(Boolean);
    if (modelList.length < 2) return "HATA: En az 2 model belirtin, virgülle ayırarak (örn: groq:qwen3-32b,groq:llama-3.3-70b)";
    if (!_llmCallback) return "HATA: LLM bağlantısı hazır değil. Uygulamayı yeniden başlat.";

    const header = `Model Karşılaştırması\nPrompt: "${prompt.slice(0, 100)}"\nModeller: ${modelList.join(", ")}\n${"═".repeat(50)}`;

    const answers = await Promise.all(modelList.map(async (m) => {
        try {
            const out = await _llmCallback!(prompt, m);
            return `[${m}]\n${out.trim()}`;
        } catch (e) {
            return `[${m}]\nHATA: ${(e as Error).message}`;
        }
    }));

    return header + "\n\n" + answers.join("\n\n─────────────────────\n\n");
}
