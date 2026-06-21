import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const REPORTS_DIR = path.join(os.homedir(), ".aegis", "reports");
const HABITS_PATH = path.join(os.homedir(), ".aegis", "habits.json");
const TIME_LOG_PATH = path.join(os.homedir(), ".aegis", "time-log.json");
const GOALS_PATH = path.join(os.homedir(), ".aegis", "goals.json");

function load<T>(p: string, def: T): T {
    try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return def; }
}
function ensureDir(): void {
    fs.mkdirSync(REPORTS_DIR, {recursive: true});
}

interface TimeEntry {
    task: string;
    start: string;
    end?: string;
    durationMin?: number;
}
interface Goal {
    id: string;
    title: string;
    status: "active" | "completed";
    progress: number;
    deadline?: string;
}
interface Habit {
    [toolName: string]: number;
}

function getDateRange(type: "today" | "week" | "month"): {start: Date; end: Date} {
    const end = new Date();
    const start = new Date();
    if (type === "today") {
        start.setHours(0, 0, 0, 0);
    } else if (type === "week") {
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
    } else {
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
    }
    return {start, end};
}

export function dailyReport(): string {
    ensureDir();
    const {start, end} = getDateRange("today");
    const habits: Habit = load(HABITS_PATH, {});
    const timeLogs: TimeEntry[] = load(TIME_LOG_PATH, []);
    const goals: Goal[] = load(GOALS_PATH, []);

    // Top tools today
    const topTools = Object.entries(habits)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5)
        .map(([k, v]) => `  ${k}: ${v}x`)
        .join("\n");

    // Time tracked today
    const todayLogs = timeLogs.filter((e) => new Date(e.start) >= start && new Date(e.start) <= end);
    const totalMinutes = todayLogs.reduce((sum, e) => sum + (e.durationMin ?? 0), 0);
    const timeLines = todayLogs.map((e) => `  ${e.task}: ${e.durationMin ?? 0}min`).join("\n");

    // Active goals
    const activeGoals = goals.filter((g) => g.status === "active");
    const goalLines = activeGoals.slice(0, 5).map((g) => `  ${g.title}: ${g.progress}%${g.deadline ? ` (due:${new Date(g.deadline).toLocaleDateString("tr-TR")})` : ""}`).join("\n");

    const date = new Date().toLocaleDateString("tr-TR");
    const reportText = [
        `AEGIS Daily Report — ${date}`,
        "═══════════════════════════════════════",
        "",
        `MOST USED TOOLS (all time)`,
        topTools || "  (no records yet)",
        "",
        `TIME TRACKING — Today (${totalMinutes} minutes total)`,
        timeLines || "  (no tracking today)",
        "",
        `ACTIVE GOALS (${activeGoals.length} goals)`,
        goalLines || "  (no active goals)",
        "",
        `[REPORT_SUMMARY|date:${date}|detail:Write a meaningful daily summary from the data above and add suggestions]`,
    ].join("\n");

    const reportPath = path.join(REPORTS_DIR, `daily_${date.replace(/\./g, "-")}.md`);
    fs.writeFileSync(reportPath, reportText);
    return reportText;
}

export function weeklyReport(): string {
    ensureDir();
    const {start} = getDateRange("week");
    const habits: Habit = load(HABITS_PATH, {});
    const timeLogs: TimeEntry[] = load(TIME_LOG_PATH, []);
    const goals: Goal[] = load(GOALS_PATH, []);

    const weekLogs = timeLogs.filter((e) => new Date(e.start) >= start);
    const totalMin = weekLogs.reduce((s, e) => s + (e.durationMin ?? 0), 0);

    const completedGoals = goals.filter((g) => {
        if (g.status !== "completed") return false;
        // no updatedAt in schema, approximate
        return true;
    }).length;

    const topTools = Object.entries(habits)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 8)
        .map(([k, v]) => `  ${k}: ${v}x`)
        .join("\n");

    const taskBreakdown = weekLogs.reduce((acc, e) => {
        acc[e.task] = (acc[e.task] ?? 0) + (e.durationMin ?? 0);
        return acc;
    }, {} as Record<string, number>);
    const taskLines = Object.entries(taskBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([t, m]) => `  ${t}: ${m}min`)
        .join("\n");

    const weekStart = start.toLocaleDateString("tr-TR");
    const weekEnd = new Date().toLocaleDateString("tr-TR");
    const reportText = [
        `AEGIS Weekly Report — ${weekStart} – ${weekEnd}`,
        "═══════════════════════════════════════",
        "",
        `TOTAL TIME TRACKED: ${Math.round(totalMin / 60)} hours ${totalMin % 60} minutes`,
        "",
        `TASK BREAKDOWN`,
        taskLines || "  (no tracking)",
        "",
        `MOST USED TOOLS`,
        topTools || "  (no records)",
        "",
        `COMPLETED GOALS: ${completedGoals}`,
        "",
        `[WEEKLY_SUMMARY|period:${weekStart}–${weekEnd}|totalHours:${Math.round(totalMin / 60)}|toolCount:${Object.keys(habits).length}|detail:Write a meaningful summary from this week's data and add suggestions for next week]`,
    ].join("\n");

    const reportPath = path.join(REPORTS_DIR, `weekly_${weekStart.replace(/\./g, "-")}.md`);
    fs.writeFileSync(reportPath, reportText);
    return reportText;
}

export function productivityInsights(): string {
    const habits: Habit = load(HABITS_PATH, {});
    const timeLogs: TimeEntry[] = load(TIME_LOG_PATH, []);
    const goals: Goal[] = load(GOALS_PATH, []);

    const totalToolUses = Object.values(habits).reduce((s, v) => s + (v as number), 0);
    const totalTrackedMin = timeLogs.reduce((s, e) => s + (e.durationMin ?? 0), 0);
    const activeGoals = goals.filter((g) => g.status === "active");
    const completedGoals = goals.filter((g) => g.status === "completed");
    const avgProgress = activeGoals.length > 0
        ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length)
        : 0;

    // Find most active hour from time logs
    const hourBuckets: Record<number, number> = {};
    for (const e of timeLogs) {
        if (e.start) {
            const h = new Date(e.start).getHours();
            hourBuckets[h] = (hourBuckets[h] ?? 0) + (e.durationMin ?? 0);
        }
    }
    const peakHour = Object.entries(hourBuckets).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    return [
        "PRODUCTIVITY ANALYSIS",
        "═══════════════════════════════════════",
        `Total tool usage: ${totalToolUses}x`,
        `Total time tracked: ${Math.round(totalTrackedMin / 60)}h ${totalTrackedMin % 60}min`,
        `Active goals: ${activeGoals.length} | Completed: ${completedGoals.length}`,
        `Average goal progress: ${avgProgress}%`,
        peakHour ? `Most productive hour: ${peakHour[0]}:00 (${peakHour[1]} minutes)` : "",
        "",
        `[PRODUCTIVITY_COACH|totalTools:${totalToolUses}|totalTime:${totalTrackedMin}|activeGoals:${activeGoals.length}|averageProgress:${avgProgress}|detail:Generate personal productivity suggestions from this data, identify strengths and areas for improvement]`,
    ].filter(Boolean).join("\n");
}
