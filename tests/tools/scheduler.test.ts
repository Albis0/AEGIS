import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// scheduler.ts'de TASKS_PATH = os.homedir()/.aegis/scheduled-tasks.json
// os.homedir() modül yüklenirken sabitlenir — override çalışmaz.
// Gerçek kullanıcı dizinini kullanıyor; test temizliği buraya göre yapılır.
const TASKS_PATH = path.join(os.homedir(), ".aegis", "scheduled-tasks.json");
const TASKS_DIR = path.dirname(TASKS_PATH);

import {toolScheduleTask, toolListScheduledTasks, toolCancelScheduledTask, loadTasks, startScheduler, stopScheduler} from "../../electron/scheduler";

function clearTasks(): void {
    try { fs.writeFileSync(TASKS_PATH, "[]", "utf-8"); } catch { /* ilk çalıştırmada yok */ }
}

beforeEach(() => {
    fs.mkdirSync(TASKS_DIR, {recursive: true});
    clearTasks();
});

afterEach(() => {
    stopScheduler();
    clearTasks();
});

describe("scheduler tool", () => {
    it("creates a task with valid schedule", () => {
        const result = toolScheduleTask("Test Görevi", "every 30 minutes", "hava durumu göster");
        expect(result).toContain("Test Görevi");
        expect(result).toContain("created");
        const tasks = loadTasks();
        expect(tasks.length).toBe(1);
        expect(tasks[0].name).toBe("Test Görevi");
        expect(tasks[0].enabled).toBe(true);
    });

    it("returns error for invalid schedule", () => {
        const result = toolScheduleTask("Kötü Görev", "geçersiz zamanlama", "bir şeyler yap");
        expect(result).toContain("ERROR");
        expect(loadTasks().length).toBe(0);
    });

    it("lists tasks", () => {
        toolScheduleTask("G1", "every 1 hour", "cmd1");
        toolScheduleTask("G2", "daily at 09:00", "cmd2");
        const list = toolListScheduledTasks();
        expect(list).toContain("G1");
        expect(list).toContain("G2");
    });

    it("cancels a task by name", () => {
        toolScheduleTask("Silinecek", "every 2 hours", "test");
        const result = toolCancelScheduledTask("Silinecek");
        expect(result).toContain("cancelled");
        expect(loadTasks().length).toBe(0);
    });

    it("returns not-found for unknown task", () => {
        const result = toolCancelScheduledTask("yoktur");
        expect(result).toContain("No task found");
    });

    it("startScheduler is idempotent (double-start safe)", () => {
        startScheduler();
        startScheduler(); // second call must not throw or add a second timer
        stopScheduler();
    });

    it("handles daily schedule", () => {
        const result = toolScheduleTask("Günlük", "daily at 08:30", "sabah özeti");
        expect(result).toContain("Günlük");
        const tasks = loadTasks();
        expect(tasks[0].nextRun).toBeTruthy();
    });
});
