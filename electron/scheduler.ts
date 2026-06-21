import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface ScheduledTask {
    id: string;
    name: string;
    schedule: string;   // "every 30 minutes" | "every 2 hours" | "daily at 09:00"
    command: string;    // natural-language instruction sent to AEGIS
    createdAt: string;
    lastRun?: string;
    nextRun: string;
    enabled: boolean;
}

const TASKS_PATH = path.join(os.homedir(), ".aegis", "scheduled-tasks.json");

function ensureDir(): void {
    fs.mkdirSync(path.dirname(TASKS_PATH), {recursive: true});
}

export function loadTasks(): ScheduledTask[] {
    try {
        const raw = fs.readFileSync(TASKS_PATH, "utf-8");
        return JSON.parse(raw) as ScheduledTask[];
    } catch {
        return [];
    }
}

function saveTasks(tasks: ScheduledTask[]): void {
    ensureDir();
    fs.writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2), "utf-8");
}

interface ParsedSchedule {
    intervalMs: number;
    dailyTime?: {h: number; m: number};
}

function parseSchedule(schedule: string): ParsedSchedule | null {
    const s = schedule.toLowerCase().trim();

    const minsMatch = s.match(/^every\s+(\d+)\s+minute/);
    if (minsMatch) return {intervalMs: parseInt(minsMatch[1]) * 60_000};

    const hoursMatch = s.match(/^every\s+(\d+)\s+hour/);
    if (hoursMatch) return {intervalMs: parseInt(hoursMatch[1]) * 3_600_000};

    const secsMatch = s.match(/^every\s+(\d+)\s+second/);
    if (secsMatch) return {intervalMs: parseInt(secsMatch[1]) * 1_000};

    if (s === "every hour" || s === "hourly") return {intervalMs: 3_600_000};
    if (s === "every day"  || s === "daily")  return {intervalMs: 86_400_000};

    const dailyMatch = s.match(/(?:daily|every\s+day)\s+at\s+(\d{1,2}):(\d{2})/);
    if (dailyMatch) {
        return {
            intervalMs: 86_400_000,
            dailyTime: {h: parseInt(dailyMatch[1]), m: parseInt(dailyMatch[2])},
        };
    }

    const cronMatch = s.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    if (cronMatch) return {intervalMs: parseInt(cronMatch[1]) * 60_000};

    return null;
}

function computeNextRun(schedule: string): Date | null {
    const parsed = parseSchedule(schedule);
    if (!parsed) return null;

    if (parsed.dailyTime) {
        const next = new Date();
        next.setHours(parsed.dailyTime.h, parsed.dailyTime.m, 0, 0);
        if (next <= new Date()) next.setDate(next.getDate() + 1);
        return next;
    }

    return new Date(Date.now() + parsed.intervalMs);
}

type TaskCallback = (task: ScheduledTask) => void;
let onTrigger: TaskCallback | null = null;

export function registerSchedulerCallback(cb: TaskCallback): void {
    onTrigger = cb;
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startScheduler(): void {
    if (schedulerTimer) return;
    schedulerTimer = setInterval(() => {
        const tasks = loadTasks();
        let changed = false;
        const now = new Date();
        for (const task of tasks) {
            if (!task.enabled) continue;
            if (new Date(task.nextRun) <= now) {
                task.lastRun = now.toISOString();
                const parsed = parseSchedule(task.schedule);
                const next = parsed?.dailyTime
                    ? computeNextRun(task.schedule)!
                    : new Date(Date.now() + (parsed?.intervalMs ?? 60_000));
                task.nextRun = next.toISOString();
                changed = true;
                onTrigger?.(task);
            }
        }
        if (changed) saveTasks(tasks);
    }, 15_000); // check every 15 seconds
}

export function stopScheduler(): void {
    if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
}

// ---- Tool implementations called from tools.ts ----

export function toolScheduleTask(name: string, schedule: string, command: string): string {
    if (!parseSchedule(schedule)) {
        return `ERROR: Invalid schedule. Examples: "every 30 minutes", "every 2 hours", "daily at 09:00", "hourly"`;
    }
    const nextRun = computeNextRun(schedule);
    if (!nextRun) return "ERROR: Could not compute the next run time.";

    const task: ScheduledTask = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        schedule,
        command,
        createdAt: new Date().toISOString(),
        nextRun: nextRun.toISOString(),
        enabled: true,
    };

    const tasks = loadTasks();
    tasks.push(task);
    saveTasks(tasks);

    return `Task "${name}" created. Schedule: ${schedule}. First run: ${nextRun.toLocaleString("tr-TR")}`;
}

export function toolListScheduledTasks(): string {
    const tasks = loadTasks();
    if (tasks.length === 0) return "No scheduled tasks.";
    return tasks.map((t) => {
        const next = new Date(t.nextRun).toLocaleString("tr-TR");
        const last = t.lastRun ? new Date(t.lastRun).toLocaleString("tr-TR") : "not run yet";
        return `[${t.enabled ? "✓" : "✗"}] ${t.name} (ID: ${t.id})\n  Schedule: ${t.schedule}\n  Next: ${next}  |  Last: ${last}\n  Command: ${t.command}`;
    }).join("\n\n");
}

export function toolCancelScheduledTask(idOrName: string): string {
    const tasks = loadTasks();
    const idx = tasks.findIndex(
        (t) => t.id === idOrName || t.name.toLowerCase().includes(idOrName.toLowerCase()),
    );
    if (idx === -1) return `No task found with the name/ID "${idOrName}".`;
    const removed = tasks.splice(idx, 1)[0];
    saveTasks(tasks);
    return `Task "${removed.name}" cancelled.`;
}

export function toolToggleScheduledTask(idOrName: string): string {
    const tasks = loadTasks();
    const task = tasks.find(
        (t) => t.id === idOrName || t.name.toLowerCase().includes(idOrName.toLowerCase()),
    );
    if (!task) return `No task found with the name/ID "${idOrName}".`;
    task.enabled = !task.enabled;
    saveTasks(tasks);
    return `Task "${task.name}" ${task.enabled ? "enabled" : "disabled"}.`;
}
