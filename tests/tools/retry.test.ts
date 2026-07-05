import {describe, it, expect} from "vitest";
import {isWakingError, withWakeRetry} from "../../electron/retry";

describe("isWakingError", () => {
    it("matches DNS/network/CF symptoms", () => {
        expect(isWakingError("fetch failed")).toBe(true);
        expect(isWakingError("getaddrinfo ENOTFOUND xyz.supabase.co")).toBe(true);
        expect(isWakingError("Failed to fetch")).toBe(true);
        expect(isWakingError("", 521)).toBe(true);
        expect(isWakingError("", 503)).toBe(true);
    });

    it("does NOT match real auth/quota errors", () => {
        expect(isWakingError("Invalid login credentials")).toBe(false);
        expect(isWakingError("Your daily trial limit is used up")).toBe(false);
        expect(isWakingError("", 429)).toBe(false);
        expect(isWakingError("", 401)).toBe(false);
    });
});

describe("withWakeRetry", () => {
    it("retries waking errors and succeeds", async () => {
        let calls = 0;
        const result = await withWakeRetry(async () => {
            calls++;
            if (calls < 3) throw new Error("fetch failed");
            return "ok";
        }, {attempts: 4, delayMs: 1});
        expect(result).toBe("ok");
        expect(calls).toBe(3);
    });

    it("gives up after the attempt budget", async () => {
        let calls = 0;
        await expect(withWakeRetry(async () => {
            calls++;
            throw new Error("ECONNREFUSED");
        }, {attempts: 3, delayMs: 1})).rejects.toThrow("ECONNREFUSED");
        expect(calls).toBe(3);
    });

    it("non-waking errors rethrow immediately (no retry)", async () => {
        let calls = 0;
        await expect(withWakeRetry(async () => {
            calls++;
            throw new Error("Invalid login credentials");
        }, {attempts: 4, delayMs: 1})).rejects.toThrow("Invalid login");
        expect(calls).toBe(1);
    });

    it("retries on waking-class HTTP status carried on the error", async () => {
        let calls = 0;
        const r = await withWakeRetry(async () => {
            calls++;
            if (calls === 1) {
                const e = new Error("trial service waking (521)") as Error & {status?: number};
                e.status = 521;
                throw e;
            }
            return 42;
        }, {attempts: 2, delayMs: 1});
        expect(r).toBe(42);
        expect(calls).toBe(2);
    });
});
