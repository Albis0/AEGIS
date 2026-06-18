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
    const timeLines = todayLogs.map((e) => `  ${e.task}: ${e.durationMin ?? 0}dk`).join("\n");

    // Active goals
    const activeGoals = goals.filter((g) => g.status === "active");
    const goalLines = activeGoals.slice(0, 5).map((g) => `  ${g.title}: %${g.progress}${g.deadline ? ` (son:${new Date(g.deadline).toLocaleDateString("tr-TR")})` : ""}`).join("\n");

    const date = new Date().toLocaleDateString("tr-TR");
    const reportText = [
        `AEGIS Günlük Rapor — ${date}`,
        "═══════════════════════════════════════",
        "",
        `EN SIK KULLANILAN ARAÇLAR (tüm zamanlar)`,
        topTools || "  (henüz kayıt yok)",
        "",
        `ZAMAN TAKİBİ — Bugün (${totalMinutes} dakika toplam)`,
        timeLines || "  (bugün takip yok)",
        "",
        `AKTİF HEDEFLER (${activeGoals.length} hedef)`,
        goalLines || "  (aktif hedef yok)",
        "",
        `[RAPOR_OZET|tarih:${date}|detay:Yukarıdaki verilerden anlamlı bir günlük özet yaz, öneriler ekle]`,
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
        .map(([t, m]) => `  ${t}: ${m}dk`)
        .join("\n");

    const weekStart = start.toLocaleDateString("tr-TR");
    const weekEnd = new Date().toLocaleDateString("tr-TR");
    const reportText = [
        `AEGIS Haftalık Rapor — ${weekStart} – ${weekEnd}`,
        "═══════════════════════════════════════",
        "",
        `TOPLAM ZAMAN TAKİBİ: ${Math.round(totalMin / 60)} saat ${totalMin % 60} dakika`,
        "",
        `GÖREV DAĞILIMI`,
        taskLines || "  (takip yok)",
        "",
        `EN SIK KULLANILAN ARAÇLAR`,
        topTools || "  (kayıt yok)",
        "",
        `TAMAMLANAN HEDEFLER: ${completedGoals}`,
        "",
        `[HAFTALIK_OZET|donem:${weekStart}–${weekEnd}|toplamSaat:${Math.round(totalMin / 60)}|araçSayısı:${Object.keys(habits).length}|detay:Bu haftanın verilerinden anlamlı bir özet yaz, gelecek hafta için öneriler ekle]`,
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
        "VERİMLİLİK ANALİZİ",
        "═══════════════════════════════════════",
        `Toplam araç kullanımı: ${totalToolUses}x`,
        `Toplam takip edilen süre: ${Math.round(totalTrackedMin / 60)}sa ${totalTrackedMin % 60}dk`,
        `Aktif hedef: ${activeGoals.length} | Tamamlanan: ${completedGoals.length}`,
        `Ortalama hedef ilerleme: %${avgProgress}`,
        peakHour ? `En verimli saat dilimi: ${peakHour[0]}:00 (${peakHour[1]} dakika)` : "",
        "",
        `[VERİMLİLİK_KOCU|toplamArac:${totalToolUses}|toplamSure:${totalTrackedMin}|aktifHedef:${activeGoals.length}|ortalamIlerleme:${avgProgress}|detay:Bu verilerden kişisel verimlilik önerileri üret, güçlü yönler ve gelişim alanları belirt]`,
    ].filter(Boolean).join("\n");
}
