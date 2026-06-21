import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const STATE_PATH = path.join(os.homedir(), ".aegis", "translation-state.json");

interface TranslationState {
    active: boolean;
    sourceLang: string;
    targetLang: string;
    overlayEnabled: boolean;
}

function loadState(): TranslationState {
    try {
        return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
    } catch {
        return {active: false, sourceLang: "tr", targetLang: "en", overlayEnabled: false};
    }
}

function saveState(s: TranslationState): void {
    fs.mkdirSync(path.dirname(STATE_PATH), {recursive: true});
    fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

export function translationStart(sourceLang: string, targetLang: string): string {
    const state = loadState();
    state.active = true;
    state.sourceLang = sourceLang || "tr";
    state.targetLang = targetLang || "en";
    saveState(state);
    return `Translation mode started: ${state.sourceLang} → ${state.targetLang}. When you speak into the microphone I will translate the text and write it to the feed.`;
}

export function translationStop(): string {
    const state = loadState();
    state.active = false;
    saveState(state);
    return "Translation mode stopped.";
}

export function getTranslationState(): TranslationState {
    return loadState();
}

export function translateText(text: string, targetLang: string, tone: string): string {
    // The LLM that invokes the executor handles this — this only holds the structure
    const toneDesc = tone === "casual" ? "casual" : tone === "technical" ? "technical" : "formal";
    return `[TRANSLATION_NEEDED|target:${targetLang}|tone:${toneDesc}|text:${text}]`;
}

export async function translateFile(filePath: string, targetLang: string): Promise<string> {
    if (!fs.existsSync(filePath)) return `ERROR: File not found: ${filePath}`;
    const ext = path.extname(filePath);
    if (![".txt", ".md"].includes(ext)) return "ERROR: Only .txt and .md files are supported.";
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.length > 50000) return "ERROR: File too large (max 50KB). Split it into parts.";
    const outPath = filePath.replace(ext, `_${targetLang}${ext}`);
    // Return the file info — the LLM will do the actual translation and write it
    return `[TRANSLATION_FILE|target:${targetLang}|source:${filePath}|output:${outPath}|content:${content}]`;
}

export function subtitleToggle(enable: boolean): string {
    const state = loadState();
    state.overlayEnabled = enable;
    saveState(state);
    return enable ? "Subtitle overlay mode active (an Electron always-on-top window will open)." : "Subtitle overlay turned off.";
}
