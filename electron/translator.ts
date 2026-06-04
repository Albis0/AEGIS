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
    return `Çeviri modu başlatıldı: ${state.sourceLang} → ${state.targetLang}. Mikrofona konuştuğunda metni çevirecek ve feed'e yazacağım.`;
}

export function translationStop(): string {
    const state = loadState();
    state.active = false;
    saveState(state);
    return "Çeviri modu durduruldu.";
}

export function getTranslationState(): TranslationState {
    return loadState();
}

export function translateText(text: string, targetLang: string, tone: string): string {
    // Executor çağıran LLM bunu handle eder — bu sadece yapı tutar
    const toneDesc = tone === "casual" ? "gündelik" : tone === "technical" ? "teknik" : "resmi";
    return `[ÇEVİRİ_GEREKLI|hedef:${targetLang}|ton:${toneDesc}|metin:${text}]`;
}

export async function translateFile(filePath: string, targetLang: string): Promise<string> {
    if (!fs.existsSync(filePath)) return `HATA: Dosya bulunamadı: ${filePath}`;
    const ext = path.extname(filePath);
    if (![".txt", ".md"].includes(ext)) return "HATA: Sadece .txt ve .md dosyaları destekleniyor.";
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.length > 50000) return "HATA: Dosya çok büyük (max 50KB). Parçalara böl.";
    const outPath = filePath.replace(ext, `_${targetLang}${ext}`);
    // Dosya bilgisini döndür — LLM asıl çeviriyi yapıp yazacak
    return `[ÇEVİRİ_DOSYA|hedef:${targetLang}|kaynak:${filePath}|cikti:${outPath}|icerik:${content}]`;
}

export function subtitleToggle(enable: boolean): string {
    const state = loadState();
    state.overlayEnabled = enable;
    saveState(state);
    return enable ? "Altyazı overlay modu aktif (Electron always-on-top pencere açılacak)." : "Altyazı overlay kapatıldı.";
}
