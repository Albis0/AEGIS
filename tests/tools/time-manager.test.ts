import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE = path.join(os.homedir(), ".aegis");
const POMODORO = path.join(BASE, "pomodoro-state.json");
const TIMELOG = path.join(BASE, "time-log.json");

import {
    pomodoroStart, pomodoroStop,
    timeTrackStart, timeTrackStop, timeTrackReport,
} from "../../electron/time-manager";

function clearFiles(): void {
    for (const p of [POMODORO, TIMELOG]) {
        try { fs.unlinkSync(p); } catch { /* yok */ }
    }
}

beforeEach(() => {
    fs.mkdirSync(BASE, {recursive: true});
    clearFiles();
});
afterEach(() => {
    // aktif pomodoro varsa timer'ı temizle (test sızıntısını önle)
    try { pomodoroStop(); } catch { /* yok */ }
    clearFiles();
});

// ─── Pomodoro ────────────────────────────────────────────────────────────────
describe("pomodoroStart", () => {
    it("yeni pomodoro başlatır", () => {
        const msg = pomodoroStart(25, 5);
        expect(msg).toContain("Pomodoro başladı");
        const state = JSON.parse(fs.readFileSync(POMODORO, "utf-8"));
        expect(state.active).toBe(true);
        expect(state.phase).toBe("work");
        expect(state.session).toBe(1);
    });

    it("özel süreler kaydedilir", () => {
        pomodoroStart(50, 10);
        const state = JSON.parse(fs.readFileSync(POMODORO, "utf-8"));
        expect(state.workMinutes).toBe(50);
        expect(state.breakMinutes).toBe(10);
    });

    it("zaten çalışıyorsa ikinci start reddedilir", () => {
        pomodoroStart(25, 5);
        const msg = pomodoroStart(25, 5);
        expect(msg).toContain("zaten çalışıyor");
    });

    it("oturum sayacı durdurma sonrası artar", () => {
        pomodoroStart(25, 5);
        pomodoroStop();
        const msg = pomodoroStart(25, 5);
        expect(msg).toContain("#2");
    });
});

describe("pomodoroStop", () => {
    it("aktif pomodoro yokken mesaj", () => {
        expect(pomodoroStop()).toContain("Aktif pomodoro yok");
    });

    it("aktif pomodoro'yu durdurur", () => {
        pomodoroStart(25, 5);
        const msg = pomodoroStop();
        expect(msg).toContain("durduruldu");
        const state = JSON.parse(fs.readFileSync(POMODORO, "utf-8"));
        expect(state.active).toBe(false);
    });
});

// ─── Zaman Takibi ────────────────────────────────────────────────────────────
describe("timeTrackStart", () => {
    it("takip başlatır", () => {
        const msg = timeTrackStart("Kod yaz");
        expect(msg).toContain("Zaman takibi başladı");
        const log = JSON.parse(fs.readFileSync(TIMELOG, "utf-8"));
        expect(log.length).toBe(1);
        expect(log[0].stoppedAt).toBeUndefined();
    });

    it("boş görev adı reddedilir", () => {
        expect(timeTrackStart("  ")).toContain("HATA");
    });

    it("yeni takip başlayınca öncekini otomatik durdurur", () => {
        timeTrackStart("Görev A");
        const msg = timeTrackStart("Görev B");
        expect(msg).toContain("durduruldu");
        const log = JSON.parse(fs.readFileSync(TIMELOG, "utf-8"));
        expect(log[0].stoppedAt).toBeDefined();   // A durdu
        expect(log[1].stoppedAt).toBeUndefined();  // B aktif
    });
});

describe("timeTrackStop", () => {
    it("aktif takip yokken mesaj", () => {
        expect(timeTrackStop()).toContain("Aktif zaman takibi yok");
    });

    it("aktif takibi durdurur + süre raporlar", () => {
        timeTrackStart("İş");
        const msg = timeTrackStop();
        expect(msg).toContain("İş");
        expect(msg).toMatch(/dk.*sn/);
        const log = JSON.parse(fs.readFileSync(TIMELOG, "utf-8"));
        expect(log[0].durationMs).toBeGreaterThanOrEqual(0);
    });
});

describe("timeTrackReport", () => {
    it("kayıt yokken anlamlı mesaj", () => {
        expect(timeTrackReport("today")).toContain("Bugün kayıtlı zaman yok");
    });

    it("tamamlanmış görevleri toplar ve raporlar", () => {
        // Geçmiş tamamlanmış kayıt enjekte et
        const now = Date.now();
        const log = [
            {task: "Tasarım", startedAt: now - 3_600_000, stoppedAt: now - 3_000_000, durationMs: 600_000},
            {task: "Tasarım", startedAt: now - 2_000_000, stoppedAt: now - 1_700_000, durationMs: 300_000},
            {task: "Toplantı", startedAt: now - 1_000_000, stoppedAt: now - 700_000, durationMs: 300_000},
        ];
        fs.writeFileSync(TIMELOG, JSON.stringify(log), "utf-8");
        const out = timeTrackReport("today");
        expect(out).toContain("Tasarım");
        expect(out).toContain("Toplantı");
        // Tasarım: 900_000ms = 15dk, en üstte (azalan sıra)
        expect(out.indexOf("Tasarım")).toBeLessThan(out.indexOf("Toplantı"));
        expect(out).toContain("Toplam");
    });

    it("aktif (bitmemiş) kayıt rapora dahil edilmez", () => {
        timeTrackStart("Devam eden");
        const out = timeTrackReport("today");
        expect(out).toContain("Bugün kayıtlı zaman yok");
    });
});
