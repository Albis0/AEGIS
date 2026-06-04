import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const MEETINGS_DIR = path.join(os.homedir(), ".aegis", "meetings");
const ACTIVE_PATH = path.join(os.homedir(), ".aegis", "meeting-active.json");

interface MeetingActive {
    id: string;
    startedAt: string;
    transcript: string[];
}

interface Meeting {
    id: string;
    startedAt: string;
    endedAt: string;
    transcript: string[];
    summary?: string;
    actionItems?: string[];
}

function ensureDir(): void {
    fs.mkdirSync(MEETINGS_DIR, {recursive: true});
}

function loadActive(): MeetingActive | null {
    try { return JSON.parse(fs.readFileSync(ACTIVE_PATH, "utf-8")); } catch { return null; }
}
function saveActive(m: MeetingActive | null): void {
    if (m === null) { try { fs.unlinkSync(ACTIVE_PATH); } catch {} return; }
    fs.writeFileSync(ACTIVE_PATH, JSON.stringify(m, null, 2));
}

export function meetingStart(): string {
    ensureDir();
    const existing = loadActive();
    if (existing) {
        return `Zaten aktif bir toplantı var (başlangıç: ${existing.startedAt}). Önce 'meeting_stop' ile sonlandır.`;
    }
    const id = `meeting_${Date.now()}`;
    const active: MeetingActive = {
        id,
        startedAt: new Date().toISOString(),
        transcript: [],
    };
    saveActive(active);
    return `Toplantı kaydı başladı (ID: ${id}). Sesli konuşmalar otomatik transkript edilecek. Bitirmek için 'meeting_stop' kullan.`;
}

export function meetingStop(): string {
    const active = loadActive();
    if (!active) return "Aktif toplantı yok.";
    ensureDir();
    const meeting: Meeting = {
        id: active.id,
        startedAt: active.startedAt,
        endedAt: new Date().toISOString(),
        transcript: active.transcript,
    };
    const filePath = path.join(MEETINGS_DIR, `${active.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(meeting, null, 2));
    saveActive(null);
    const duration = Math.round((Date.now() - new Date(active.startedAt).getTime()) / 60000);
    return `Toplantı kaydedildi (${duration} dakika). ID: ${active.id}. Özet için 'meeting_summarize ${active.id}' kullan.`;
}

export function meetingAddTranscript(text: string): void {
    const active = loadActive();
    if (!active) return;
    active.transcript.push(`[${new Date().toLocaleTimeString("tr-TR")}] ${text}`);
    saveActive(active);
}

export function meetingList(): string {
    ensureDir();
    const files = fs.readdirSync(MEETINGS_DIR).filter((f) => f.endsWith(".json")).sort().reverse();
    if (files.length === 0) return "Kayıtlı toplantı yok.";
    return files.slice(0, 10).map((f) => {
        try {
            const m: Meeting = JSON.parse(fs.readFileSync(path.join(MEETINGS_DIR, f), "utf-8"));
            const dur = Math.round((new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 60000);
            const lines = m.transcript.length;
            const hasSummary = !!m.summary;
            return `${m.id} — ${new Date(m.startedAt).toLocaleString("tr-TR")} (${dur}dk, ${lines} satır transkript)${hasSummary ? " [özetlendi]" : ""}`;
        } catch { return f; }
    }).join("\n");
}

export function meetingSummarize(id: string): string {
    ensureDir();
    const targetId = id || loadActive()?.id;
    if (!targetId) return "Toplantı ID gerekli.";
    const filePath = path.join(MEETINGS_DIR, `${targetId}.json`);
    if (!fs.existsSync(filePath)) return `HATA: Toplantı bulunamadı: ${targetId}`;
    const m: Meeting = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (m.transcript.length === 0) return "Toplantı transkripi boş, özetlenecek içerik yok.";
    const transcriptText = m.transcript.join("\n");
    // LLM'e özetletmek için yapılandırılmış prompt döndür
    return `[TOPLANTI_OZET|id:${targetId}|sure:${Math.round((new Date(m.endedAt ?? new Date()).getTime() - new Date(m.startedAt).getTime()) / 60000)}dk|transkript:\n${transcriptText.slice(0, 8000)}]`;
}

export function meetingExport(id: string): string {
    ensureDir();
    if (!id) return "Toplantı ID gerekli.";
    const filePath = path.join(MEETINGS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return `HATA: Toplantı bulunamadı: ${id}`;
    const m: Meeting = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const mdPath = filePath.replace(".json", ".md");
    const lines = [
        `# Toplantı: ${m.id}`,
        `**Başlangıç:** ${new Date(m.startedAt).toLocaleString("tr-TR")}`,
        m.endedAt ? `**Bitiş:** ${new Date(m.endedAt).toLocaleString("tr-TR")}` : "",
        "",
        m.summary ? `## Özet\n${m.summary}` : "",
        m.actionItems?.length ? `## Eylem Maddeleri\n${m.actionItems.map((a) => `- ${a}`).join("\n")}` : "",
        "## Transkript",
        ...m.transcript,
    ].filter((l) => l !== undefined).join("\n");
    fs.writeFileSync(mdPath, lines);
    return `Toplantı dışa aktarıldı: ${mdPath}`;
}

export function meetingActionItems(id: string): string {
    ensureDir();
    if (!id) return "Toplantı ID gerekli.";
    const filePath = path.join(MEETINGS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return `HATA: Toplantı bulunamadı: ${id}`;
    const m: Meeting = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (m.actionItems?.length) return `Eylem Maddeleri (${id}):\n${m.actionItems.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
    const transcriptText = m.transcript.join("\n");
    return `[EYLEM_MADDELERI|id:${id}|transkript:\n${transcriptText.slice(0, 6000)}]`;
}
