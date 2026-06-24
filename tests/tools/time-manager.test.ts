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
        try { fs.unlinkSync(p); } catch { /* none */ }
    }
}

beforeEach(() => {
    fs.mkdirSync(BASE, {recursive: true});
    clearFiles();
});
afterEach(() => {
    // Clean up the timer if a pomodoro is active (avoid test leakage)
    try { pomodoroStop(); } catch { /* none */ }
    clearFiles();
});

// ─── Pomodoro ────────────────────────────────────────────────────────────────
describe("pomodoroStart", () => {
    it("starts a new pomodoro", () => {
        const msg = pomodoroStart(25, 5);
        expect(msg).toContain("Pomodoro started");
        const state = JSON.parse(fs.readFileSync(POMODORO, "utf-8"));
        expect(state.active).toBe(true);
        expect(state.phase).toBe("work");
        expect(state.session).toBe(1);
    });

    it("saves custom durations", () => {
        pomodoroStart(50, 10);
        const state = JSON.parse(fs.readFileSync(POMODORO, "utf-8"));
        expect(state.workMinutes).toBe(50);
        expect(state.breakMinutes).toBe(10);
    });

    it("rejects a second start while already running", () => {
        pomodoroStart(25, 5);
        const msg = pomodoroStart(25, 5);
        expect(msg).toContain("already running");
    });

    it("session counter increases after stopping", () => {
        pomodoroStart(25, 5);
        pomodoroStop();
        const msg = pomodoroStart(25, 5);
        expect(msg).toContain("#2");
    });
});

describe("pomodoroStop", () => {
    it("message when no pomodoro is active", () => {
        expect(pomodoroStop()).toContain("No active pomodoro");
    });

    it("stops the active pomodoro", () => {
        pomodoroStart(25, 5);
        const msg = pomodoroStop();
        expect(msg).toContain("stopped");
        const state = JSON.parse(fs.readFileSync(POMODORO, "utf-8"));
        expect(state.active).toBe(false);
    });
});

// ─── Time Tracking ───────────────────────────────────────────────────────────
describe("timeTrackStart", () => {
    it("starts tracking", () => {
        const msg = timeTrackStart("Kod yaz");
        expect(msg).toContain("Time tracking started");
        const log = JSON.parse(fs.readFileSync(TIMELOG, "utf-8"));
        expect(log.length).toBe(1);
        expect(log[0].stoppedAt).toBeUndefined();
    });

    it("rejects an empty task name", () => {
        expect(timeTrackStart("  ")).toContain("ERROR");
    });

    it("automatically stops the previous track when a new one starts", () => {
        timeTrackStart("Görev A");
        const msg = timeTrackStart("Görev B");
        expect(msg).toContain("stopped");
        const log = JSON.parse(fs.readFileSync(TIMELOG, "utf-8"));
        expect(log[0].stoppedAt).toBeDefined();   // A stopped
        expect(log[1].stoppedAt).toBeUndefined();  // B active
    });
});

describe("timeTrackStop", () => {
    it("message when no tracking is active", () => {
        expect(timeTrackStop()).toContain("No active time tracking");
    });

    it("stops the active track + reports the duration", () => {
        timeTrackStart("İş");
        const msg = timeTrackStop();
        expect(msg).toContain("İş");
        expect(msg).toMatch(/min.*sec/);
        const log = JSON.parse(fs.readFileSync(TIMELOG, "utf-8"));
        expect(log[0].durationMs).toBeGreaterThanOrEqual(0);
    });
});

describe("timeTrackReport", () => {
    it("meaningful message when no records exist", () => {
        expect(timeTrackReport("today")).toContain("No recorded time today");
    });

    it("aggregates and reports completed tasks", () => {
        // Inject a past completed record
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
        // Tasarım: 900_000ms = 15min, on top (descending order)
        expect(out.indexOf("Tasarım")).toBeLessThan(out.indexOf("Toplantı"));
        expect(out).toContain("Total");
    });

    it("an active (unfinished) record is not included in the report", () => {
        timeTrackStart("Devam eden");
        const out = timeTrackReport("today");
        expect(out).toContain("No recorded time today");
    });
});
