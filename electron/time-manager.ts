import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {Notification} from "electron";

const DATA_DIR = path.join(os.homedir(), ".aegis");
const POMODORO_STATE = path.join(DATA_DIR, "pomodoro-state.json");
const TIME_LOG = path.join(DATA_DIR, "time-log.json");

interface PomodoroState {
    active: boolean;
    workMinutes: number;
    breakMinutes: number;
    phase: "work" | "break";
    startedAt: number;
    session: number;
}

interface TimeEntry {
    task: string;
    startedAt: number;
    stoppedAt?: number;
    durationMs?: number;
}

function loadPomodoro(): PomodoroState {
    try {
        return JSON.parse(fs.readFileSync(POMODORO_STATE, "utf-8"));
    } catch {
        return {active: false, workMinutes: 25, breakMinutes: 5, phase: "work", startedAt: 0, session: 0};
    }
}

function savePomodoro(state: PomodoroState): void {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    fs.writeFileSync(POMODORO_STATE, JSON.stringify(state, null, 2));
}

function loadTimeLog(): TimeEntry[] {
    try {
        return JSON.parse(fs.readFileSync(TIME_LOG, "utf-8"));
    } catch {
        return [];
    }
}

function saveTimeLog(entries: TimeEntry[]): void {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    fs.writeFileSync(TIME_LOG, JSON.stringify(entries, null, 2));
}

let pomodoroTimer: NodeJS.Timeout | null = null;

export function pomodoroStart(workMinutes = 25, breakMinutes = 5): string {
    const state = loadPomodoro();
    if (state.active) {
        const elapsed = Math.floor((Date.now() - state.startedAt) / 60000);
        const total = state.phase === "work" ? state.workMinutes : state.breakMinutes;
        return `Pomodoro is already running. ${state.phase === "work" ? "Work" : "Break"} phase — ${elapsed}/${total} min elapsed. Use 'pomodoro_stop' to stop.`;
    }

    const newState: PomodoroState = {
        active: true, workMinutes, breakMinutes,
        phase: "work", startedAt: Date.now(), session: (state.session ?? 0) + 1,
    };
    savePomodoro(newState);

    // Schedule work phase end notification
    if (pomodoroTimer) clearTimeout(pomodoroTimer);
    pomodoroTimer = setTimeout(() => {
        const s = loadPomodoro();
        if (!s.active) return;
        if (Notification.isSupported()) {
            new Notification({title: "AEGIS · Pomodoro", body: `${workMinutes}-minute work session done! ${breakMinutes} min break.`}).show();
        }
        savePomodoro({...s, phase: "break", startedAt: Date.now()});
        // Schedule break end
        pomodoroTimer = setTimeout(() => {
            const s2 = loadPomodoro();
            if (s2.active && Notification.isSupported()) {
                new Notification({title: "AEGIS · Pomodoro", body: "Break over! Time to get back to work."}).show();
            }
            savePomodoro({...s2, active: false});
        }, breakMinutes * 60 * 1000);
    }, workMinutes * 60 * 1000);

    return `Pomodoro started: ${workMinutes} min work, ${breakMinutes} min break. Session #${newState.session}`;
}

export function pomodoroStop(): string {
    if (pomodoroTimer) { clearTimeout(pomodoroTimer); pomodoroTimer = null; }
    const state = loadPomodoro();
    if (!state.active) return "No active pomodoro.";
    const elapsed = Math.floor((Date.now() - state.startedAt) / 60000);
    savePomodoro({...state, active: false});
    return `Pomodoro stopped. ${elapsed} min had elapsed in the ${state.phase === "work" ? "work" : "break"} phase. Session #${state.session} not completed.`;
}

// Phase 63.4 — Machine-readable status for the widget. If active "PHASE|remainingSec|session",
// otherwise "INACTIVE". The countdown is done second-by-second on the UI side (this is a snapshot).
export function pomodoroStatus(): string {
    const state = loadPomodoro();
    if (!state.active) return "INACTIVE";
    const totalSec = (state.phase === "work" ? state.workMinutes : state.breakMinutes) * 60;
    const elapsedSec = Math.floor((Date.now() - state.startedAt) / 1000);
    const remaining = Math.max(0, totalSec - elapsedSec);
    return `${state.phase.toUpperCase()}|${remaining}|${state.session}`;
}

export function timeTrackStart(taskName: string): string {
    if (!taskName.trim()) return "ERROR: Task name required.";
    const log = loadTimeLog();
    // Stop any active tracking first
    const activeIdx = log.findIndex((e) => !e.stoppedAt);
    if (activeIdx !== -1) {
        const active = log[activeIdx];
        active.stoppedAt = Date.now();
        active.durationMs = active.stoppedAt - active.startedAt;
    }
    log.push({task: taskName, startedAt: Date.now()});
    saveTimeLog(log);
    return `Time tracking started: "${taskName}"${activeIdx !== -1 ? ` (previous task "${log[activeIdx].task}" stopped)` : ""}`;
}

export function timeTrackStop(): string {
    const log = loadTimeLog();
    const activeIdx = log.findIndex((e) => !e.stoppedAt);
    if (activeIdx === -1) return "No active time tracking.";
    const entry = log[activeIdx];
    entry.stoppedAt = Date.now();
    entry.durationMs = entry.stoppedAt - entry.startedAt;
    saveTimeLog(log);
    const mins = Math.floor(entry.durationMs / 60000);
    const secs = Math.floor((entry.durationMs % 60000) / 1000);
    return `Time tracking stopped: "${entry.task}" — ${mins} min ${secs} sec`;
}

export function timeTrackReport(period: string): string {
    const log = loadTimeLog();
    const now = Date.now();
    let since: number;
    if (period === "week") since = now - 7 * 24 * 3600 * 1000;
    else if (period === "month") since = now - 30 * 24 * 3600 * 1000;
    else since = new Date().setHours(0, 0, 0, 0);

    const entries = log.filter((e) => e.startedAt >= since && e.stoppedAt);
    if (entries.length === 0) return `No recorded time ${period === "week" ? "this week" : period === "month" ? "this month" : "today"}.`;

    const taskMap = new Map<string, number>();
    for (const e of entries) {
        taskMap.set(e.task, (taskMap.get(e.task) ?? 0) + (e.durationMs ?? 0));
    }
    const totalMs = [...taskMap.values()].reduce((s, v) => s + v, 0);
    const lines = [...taskMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([task, ms]) => `• ${task}: ${Math.floor(ms / 60000)} min`);
    const label = period === "week" ? "This Week" : period === "month" ? "This Month" : "Today";
    return `${label} Time Report:\n${lines.join("\n")}\nTotal: ${Math.floor(totalMs / 60000)} min`;
}
