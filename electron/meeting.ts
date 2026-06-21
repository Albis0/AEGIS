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
        return `A meeting is already active (started: ${existing.startedAt}). End it first with 'meeting_stop'.`;
    }
    const id = `meeting_${Date.now()}`;
    const active: MeetingActive = {
        id,
        startedAt: new Date().toISOString(),
        transcript: [],
    };
    saveActive(active);
    return `Meeting recording started (ID: ${id}). Spoken conversation will be transcribed automatically. Use 'meeting_stop' to finish.`;
}

export function meetingStop(): string {
    const active = loadActive();
    if (!active) return "No active meeting.";
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
    return `Meeting saved (${duration} minutes). ID: ${active.id}. Use 'meeting_summarize ${active.id}' for a summary.`;
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
    if (files.length === 0) return "No saved meetings.";
    return files.slice(0, 10).map((f) => {
        try {
            const m: Meeting = JSON.parse(fs.readFileSync(path.join(MEETINGS_DIR, f), "utf-8"));
            const dur = Math.round((new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 60000);
            const lines = m.transcript.length;
            const hasSummary = !!m.summary;
            return `${m.id} — ${new Date(m.startedAt).toLocaleString("tr-TR")} (${dur}min, ${lines} transcript lines)${hasSummary ? " [summarized]" : ""}`;
        } catch { return f; }
    }).join("\n");
}

export function meetingSummarize(id: string): string {
    ensureDir();
    const targetId = id || loadActive()?.id;
    if (!targetId) return "Meeting ID is required.";
    const filePath = path.join(MEETINGS_DIR, `${targetId}.json`);
    if (!fs.existsSync(filePath)) return `ERROR: Meeting not found: ${targetId}`;
    const m: Meeting = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (m.transcript.length === 0) return "The meeting transcript is empty; there is nothing to summarize.";
    const transcriptText = m.transcript.join("\n");
    // Return a structured prompt for the LLM to summarize
    return `[MEETING_SUMMARY|id:${targetId}|duration:${Math.round((new Date(m.endedAt ?? new Date()).getTime() - new Date(m.startedAt).getTime()) / 60000)}min|transcript:\n${transcriptText.slice(0, 8000)}]`;
}

export function meetingExport(id: string): string {
    ensureDir();
    if (!id) return "Meeting ID is required.";
    const filePath = path.join(MEETINGS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return `ERROR: Meeting not found: ${id}`;
    const m: Meeting = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const mdPath = filePath.replace(".json", ".md");
    const lines = [
        `# Meeting: ${m.id}`,
        `**Start:** ${new Date(m.startedAt).toLocaleString("tr-TR")}`,
        m.endedAt ? `**End:** ${new Date(m.endedAt).toLocaleString("tr-TR")}` : "",
        "",
        m.summary ? `## Summary\n${m.summary}` : "",
        m.actionItems?.length ? `## Action Items\n${m.actionItems.map((a) => `- ${a}`).join("\n")}` : "",
        "## Transcript",
        ...m.transcript,
    ].filter((l) => l !== undefined).join("\n");
    fs.writeFileSync(mdPath, lines);
    return `Meeting exported: ${mdPath}`;
}

export function meetingActionItems(id: string): string {
    ensureDir();
    if (!id) return "Meeting ID is required.";
    const filePath = path.join(MEETINGS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return `ERROR: Meeting not found: ${id}`;
    const m: Meeting = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (m.actionItems?.length) return `Action Items (${id}):\n${m.actionItems.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
    const transcriptText = m.transcript.join("\n");
    return `[ACTION_ITEMS|id:${id}|transcript:\n${transcriptText.slice(0, 6000)}]`;
}
