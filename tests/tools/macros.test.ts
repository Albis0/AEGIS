import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const MACROS_PATH = path.join(os.homedir(), ".aegis", "macros.json");

import {
    startMacroRecording, addMacroStep, stopMacroRecording, isRecording,
    listMacros, deleteMacro, getMacroSteps,
} from "../../electron/macros";

function clearMacros(): void {
    try { fs.writeFileSync(MACROS_PATH, "[]", "utf-8"); } catch { /* none */ }
}

// recording state is module-level; reset before each test. stopMacroRecording()
// leaves `recording` set when there are no steps yet, so loop until it's clear.
function resetRecording(): void {
    let guard = 0;
    while (isRecording() && guard++ < 5) {
        addMacroStep("__reset__");
        stopMacroRecording();
    }
}

beforeEach(() => {
    fs.mkdirSync(path.dirname(MACROS_PATH), {recursive: true});
    resetRecording();
    clearMacros();
});
afterEach(() => {
    resetRecording();
    clearMacros();
});

// ─── Start recording ───────────────────────────────────────────────────────
describe("startMacroRecording", () => {
    it("starts a recording", () => {
        const msg = startMacroRecording("Oyun Modu");
        expect(isRecording()).toBe(true);
        expect(msg).toContain("Oyun Modu");
    });

    it("rejects a second concurrent recording", () => {
        startMacroRecording("A");
        const msg = startMacroRecording("B");
        expect(msg).toContain("already being recorded");
        expect(msg).toContain("A");
    });
});

// ─── Stop recording ────────────────────────────────────────────────────────
describe("stopMacroRecording", () => {
    it("a macro with no steps is not saved", () => {
        startMacroRecording("Boş Makro");
        const msg = stopMacroRecording();
        expect(msg).toContain("No steps were added");
        const macros = JSON.parse(fs.readFileSync(MACROS_PATH, "utf-8"));
        expect(macros.length).toBe(0);
    });

    it("a macro with steps is saved", () => {
        startMacroRecording("İş Modu");
        addMacroStep("VS Code aç");
        addMacroStep("Müziği aç");
        const msg = stopMacroRecording();
        expect(msg).toContain("2 steps");
        expect(isRecording()).toBe(false);
    });

    it("stopping with no active recording returns an error", () => {
        const msg = stopMacroRecording();
        expect(msg).toContain("No active macro recording");
    });
});

// ─── Adding steps ──────────────────────────────────────────────────────────
describe("addMacroStep", () => {
    it("steps are added in order", () => {
        startMacroRecording("Sıra Testi");
        addMacroStep("Adım 1");
        addMacroStep("Adım 2");
        addMacroStep("Adım 3");
        stopMacroRecording();
        const steps = getMacroSteps("Sıra Testi");
        expect(steps).toEqual(["Adım 1", "Adım 2", "Adım 3"]);
    });

    it("addMacroStep is silently skipped when not recording", () => {
        // recording=null; should not throw
        expect(() => addMacroStep("fantasma")).not.toThrow();
    });
});

// ─── Overwriting by same name ──────────────────────────────────────────────
describe("overwrite existing macro", () => {
    it("a macro with the same name is updated", () => {
        startMacroRecording("Oyun");
        addMacroStep("Steam aç");
        stopMacroRecording();

        startMacroRecording("Oyun");
        addMacroStep("Steam aç");
        addMacroStep("Sesi 50 yap");
        stopMacroRecording();

        const steps = getMacroSteps("Oyun");
        expect(steps?.length).toBe(2);
        const macros = JSON.parse(fs.readFileSync(MACROS_PATH, "utf-8"));
        expect(macros.length).toBe(1); // not added again
    });
});

// ─── Listing ────────────────────────────────────────────────────────────────
describe("listMacros", () => {
    it("returns a message when there are no macros", () => {
        expect(listMacros()).toContain("No saved macros");
    });

    it("lists macros", () => {
        startMacroRecording("Çalışma");
        addMacroStep("VS Code aç");
        stopMacroRecording();
        expect(listMacros()).toContain("Çalışma");
    });
});

// ─── Deleting ───────────────────────────────────────────────────────────────
describe("deleteMacro", () => {
    it("deletes by name", () => {
        startMacroRecording("Silinecek");
        addMacroStep("adım");
        stopMacroRecording();
        const msg = deleteMacro("Silinecek");
        expect(msg).toContain("was deleted");
        expect(listMacros()).toContain("No saved macros");
    });

    it("deletes by ID", () => {
        startMacroRecording("ID Testi");
        addMacroStep("adım");
        stopMacroRecording();
        const macros = JSON.parse(fs.readFileSync(MACROS_PATH, "utf-8"));
        const id = macros[0].id;
        expect(deleteMacro(id)).toContain("was deleted");
    });

    it("returns an error for a nonexistent macro", () => {
        expect(deleteMacro("yok-abc")).toContain("No macro found");
    });
});

// ─── getMacroSteps ─────────────────────────────────────────────────────────
describe("getMacroSteps", () => {
    it("returns the correct steps", () => {
        startMacroRecording("Müzik");
        addMacroStep("Spotify aç");
        addMacroStep("Sesi 70 yap");
        stopMacroRecording();
        const steps = getMacroSteps("Müzik");
        expect(steps).toHaveLength(2);
        expect(steps?.[0]).toBe("Spotify aç");
    });

    it("returns null for a nonexistent macro", () => {
        expect(getMacroSteps("yok")).toBeNull();
    });

    it("finds by substring", () => {
        startMacroRecording("Uzun Makro Adı");
        addMacroStep("test");
        stopMacroRecording();
        expect(getMacroSteps("Uzun")).not.toBeNull();
    });
});
