import {describe, it, expect} from "vitest";
import {parseRunning, prettyName} from "../../src/components/SteamWidget";
import {parseFacts} from "../../src/components/MemoryModal";
import {parseHome} from "../../src/components/SmartHomeWidget";
import {parsePomo, fmt} from "../../src/components/PomodoroWidget";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 63 — Parse logic for the domain UI widgets/modals. Widgets parse the
// existing tool output (text) and present it visually; if parsing breaks, the
// UI renders empty/incorrect. We lock down the pure parse functions here
// (no render — fast, no jsdom needed).
// ─────────────────────────────────────────────────────────────────────────────

describe("SteamWidget.parseRunning", () => {
    it("parses running games", () => {
        expect(parseRunning("Running game(s): hl2.exe, dota2")).toEqual(["hl2.exe", "dota2"]);
    });
    it("returns empty when no game is running", () => {
        expect(parseRunning("No Steam game is currently running.")).toEqual([]);
    });
    it("returns empty on ERROR/connection issue", () => {
        expect(parseRunning("ERROR: Steam is not installed.")).toEqual([]);
    });
    it("single game", () => {
        expect(parseRunning("Running game(s): cs2.exe")).toEqual(["cs2.exe"]);
    });
});

describe("SteamWidget.prettyName", () => {
    it("strips extension/underscores and capitalizes", () => {
        expect(prettyName("hl2.exe")).toBe("Hl2");
        expect(prettyName("dead_by_daylight")).toBe("Dead By Daylight");
        expect(prettyName("cs2")).toBe("Cs2");
    });
});

describe("MemoryModal.parseFacts", () => {
    it("parses id + content + tags", () => {
        const raw = "• [abc] User's name is Ahmet. (profile, name)\n• [def] Uses Python.";
        const facts = parseFacts(raw);
        expect(facts).toHaveLength(2);
        expect(facts[0]).toEqual({id: "abc", content: "User's name is Ahmet.", tags: ["profile", "name"]});
        expect(facts[1]).toEqual({id: "def", content: "Uses Python.", tags: []});
    });
    it("returns empty when there are no facts", () => {
        expect(parseFacts("No saved facts. You can add one with 'remember this: …'.")).toEqual([]);
    });
    it("skips malformed lines", () => {
        expect(parseFacts("random text\n• [x] valid")).toEqual([{id: "x", content: "valid", tags: []}]);
    });
});

describe("SmartHomeWidget.parseHome", () => {
    it("counts devices + lights on", () => {
        const raw = "Smart home devices (5):\n📍 Living Room:\n  • Lamp: on (70%)\n  • Outlet: off\n📍 Bedroom:\n  • Ceiling: on";
        expect(parseHome(raw)).toEqual({deviceCount: 5, lightsOn: 2});
    });
    it("returns null when HA is not configured", () => {
        expect(parseHome("ERROR: Home Assistant is not configured.")).toBeNull();
        expect(parseHome("Failed to fetch smart home devices: timeout")).toBeNull();
    });
    it("returns null when there are no devices (count doesn't match)", () => {
        expect(parseHome("Connected to Home Assistant but no controllable device was found.")).toBeNull();
    });
});

describe("PomodoroWidget.parsePomo + fmt", () => {
    it("parses active state", () => {
        expect(parsePomo("WORK|1320|3")).toEqual({phase: "WORK", remaining: 1320, session: 3});
        expect(parsePomo("BREAK|240|3")).toEqual({phase: "BREAK", remaining: 240, session: 3});
    });
    it("INACTIVE → null", () => {
        expect(parsePomo("INACTIVE")).toBeNull();
        expect(parsePomo("")).toBeNull();
    });
    it("fmt formats seconds as M:SS", () => {
        expect(fmt(1320)).toBe("22:00");
        expect(fmt(65)).toBe("1:05");
        expect(fmt(9)).toBe("0:09");
    });
});
