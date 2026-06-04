import {describe, it, expect, beforeAll, afterAll} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const TEST_HOME = path.join(os.tmpdir(), `aegis-test-supabase-offline-${Date.now()}`);
process.env.HOME = TEST_HOME;
process.env.USERPROFILE = TEST_HOME;
// Supabase yok — db.ts hasDb() false döner, chat akışı devam etmeli
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_KEY;

import {startSession, saveMessage, saveNote, getUserProfile, setUserProfile, hasDb} from "../../electron/db";

beforeAll(() => {
    fs.mkdirSync(path.join(TEST_HOME, ".aegis"), {recursive: true});
});

afterAll(() => {
    fs.rmSync(TEST_HOME, {recursive: true, force: true});
});

describe("db offline (no Supabase)", () => {
    it("hasDb returns false when env vars missing", () => {
        expect(hasDb()).toBe(false);
    });

    it("startSession returns empty string silently", async () => {
        const id = await startSession();
        expect(id).toBe("");
    });

    it("saveMessage does not throw", async () => {
        await expect(saveMessage("user", "merhaba")).resolves.toBeUndefined();
    });

    it("saveNote does not throw", async () => {
        await expect(saveNote("test notu")).resolves.toBeUndefined();
    });

    it("getUserProfile returns empty object", async () => {
        const profile = await getUserProfile();
        expect(profile).toEqual({});
    });

    it("setUserProfile does not throw", async () => {
        await expect(setUserProfile("name", "test")).resolves.toBeUndefined();
    });
});
