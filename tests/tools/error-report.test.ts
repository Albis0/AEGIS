import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
    submitReport,
    flushReportQueue,
    pendingReportCount,
    reportAiError,
    _setReportDepsForTests,
    AI_REPORT_DAILY_CAP,
    REPORT_QUEUE_MAX,
    SCREENSHOT_MAX_CHARS,
} from "../../electron/error-report";

const QUEUE_PATH = path.join(os.homedir(), ".aegis", "report-queue.json");
const AI_STATE_PATH = path.join(os.homedir(), ".aegis", "report-ai-state.json");

let inserted: Record<string, unknown>[] = [];
let insertFails = false;
let userId: string | null = "user-1";

function cleanup() {
    for (const p of [QUEUE_PATH, AI_STATE_PATH]) {
        try { fs.unlinkSync(p); } catch { /* absent */ }
    }
}

beforeEach(() => {
    cleanup();
    inserted = [];
    insertFails = false;
    userId = "user-1";
    _setReportDepsForTests({
        insert: async (row) => {
            if (insertFails) return {error: {message: "network down"}};
            inserted.push(row);
            return {error: null};
        },
        getUserId: async () => userId,
    });
});

afterEach(cleanup);

describe("submitReport", () => {
    it("signed in + online: inserts with user_id and pinned fields", async () => {
        const r = await submitReport({source: "user", title: "  crash on start  ", description: "boom"});
        expect(r).toEqual({ok: true, queued: false});
        expect(inserted).toHaveLength(1);
        expect(inserted[0]).toMatchObject({user_id: "user-1", source: "user", title: "crash on start", description: "boom"});
        expect(pendingReportCount()).toBe(0);
    });

    it("signed out: queues locally instead of dropping the report", async () => {
        userId = null;
        const r = await submitReport({source: "user", title: "t", description: "d"});
        expect(r.ok).toBe(false);
        expect(r.queued).toBe(true);
        expect(pendingReportCount()).toBe(1);
        expect(inserted).toHaveLength(0);
    });

    it("insert failure: queues and reports the error", async () => {
        insertFails = true;
        const r = await submitReport({source: "user", title: "t"});
        expect(r.queued).toBe(true);
        expect(r.error).toBe("network down");
        expect(pendingReportCount()).toBe(1);
    });

    it("screenshot data URL lands in context; junk/oversized screenshots are dropped, not fatal", async () => {
        await submitReport({source: "user", title: "with shot", screenshot: "data:image/jpeg;base64,abc123"});
        expect((inserted[0].context as Record<string, unknown>).screenshot).toBe("data:image/jpeg;base64,abc123");

        await submitReport({source: "user", title: "junk shot", screenshot: "javascript:alert(1)"});
        expect((inserted[1].context as Record<string, unknown>).screenshot).toBeUndefined();

        await submitReport({source: "user", title: "huge shot", screenshot: "data:image/png;base64," + "x".repeat(SCREENSHOT_MAX_CHARS)});
        expect((inserted[2].context as Record<string, unknown>).screenshot).toBeUndefined();
        expect(inserted).toHaveLength(3); // all three reports still sent
    });

    it("queue is capped at REPORT_QUEUE_MAX (oldest dropped)", async () => {
        userId = null;
        for (let i = 0; i < REPORT_QUEUE_MAX + 5; i++) {
            await submitReport({source: "user", title: `r${i}`});
        }
        expect(pendingReportCount()).toBe(REPORT_QUEUE_MAX);
    });
});

describe("flushReportQueue", () => {
    it("sends queued reports once signed in, preserving original timestamp in context", async () => {
        userId = null;
        await submitReport({source: "user", title: "offline report"});
        expect(pendingReportCount()).toBe(1);

        userId = "user-1";
        const sent = await flushReportQueue();
        expect(sent).toBe(1);
        expect(pendingReportCount()).toBe(0);
        expect(inserted[0]).toMatchObject({title: "offline report"});
        expect((inserted[0].context as Record<string, unknown>).queuedAt).toBeTruthy();
    });

    it("stops at first failure and keeps the remainder queued", async () => {
        userId = null;
        await submitReport({source: "user", title: "a"});
        await submitReport({source: "user", title: "b"});
        userId = "user-1";
        insertFails = true;
        expect(await flushReportQueue()).toBe(0);
        expect(pendingReportCount()).toBe(2);
    });
});

describe("reportAiError", () => {
    it("dedupes the same error within a day", async () => {
        expect(await reportAiError("uncaughtException: x", "stack")).toBe(true);
        expect(await reportAiError("uncaughtException: x", "stack")).toBe(false);
        expect(inserted).toHaveLength(1);
        expect(inserted[0]).toMatchObject({source: "ai"});
    });

    it(`caps at ${AI_REPORT_DAILY_CAP} distinct auto-reports per day`, async () => {
        for (let i = 0; i < AI_REPORT_DAILY_CAP; i++) {
            expect(await reportAiError(`err ${i}`, "detail")).toBe(true);
        }
        expect(await reportAiError("one too many", "detail")).toBe(false);
        expect(inserted).toHaveLength(AI_REPORT_DAILY_CAP);
    });
});
