import {describe, it, expect, beforeAll, afterAll} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const TEST_HOME = path.join(os.tmpdir(), `aegis-test-settings-${Date.now()}`);
process.env.HOME = TEST_HOME;
process.env.USERPROFILE = TEST_HOME;

import {loadSettings, saveSettings} from "../../electron/settings";

beforeAll(() => {
    fs.mkdirSync(path.join(TEST_HOME, ".aegis"), {recursive: true});
});

afterAll(() => {
    fs.rmSync(TEST_HOME, {recursive: true, force: true});
});

describe("settings persist", () => {
    it("loads defaults when no file exists", () => {
        const s = loadSettings();
        expect(s.language).toBeDefined();
        expect(s.model).toBeDefined();
        expect(typeof s.ttsRate).toBe("number");
    });

    it("saves and reloads settings correctly", () => {
        const s = loadSettings();
        s.language = "en";
        s.ttsRate = 1.5;
        saveSettings(s);

        const reloaded = loadSettings();
        expect(reloaded.language).toBe("en");
        expect(reloaded.ttsRate).toBe(1.5);
    });

    it("merges partial settings without losing defaults", () => {
        const s = loadSettings();
        const original = s.model;
        s.accentColor = "#ff0000";
        saveSettings(s);

        const reloaded = loadSettings();
        // hex → rgb normalize edilmeli
        expect(reloaded.accentColor).toBe("255,0,0");
        expect(reloaded.model).toBe(original);
    });
});
