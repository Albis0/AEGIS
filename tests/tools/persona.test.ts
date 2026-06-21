import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE = path.join(os.homedir(), ".aegis");
const PERSONAS = path.join(BASE, "personas.json");
const ROLEPLAY = path.join(BASE, "roleplay-state.json");

import {
    setActivePersona, getActivePersona, listPersonas, addPersona,
    getPersonaSystemPrompt, startRoleplay, stopRoleplay, getRoleplayPrompt,
} from "../../electron/persona";

function clearFiles(): void {
    for (const p of [PERSONAS, ROLEPLAY]) {
        try { fs.unlinkSync(p); } catch { /* none */ }
    }
}

beforeEach(() => {
    fs.mkdirSync(BASE, {recursive: true});
    clearFiles();
});
afterEach(clearFiles);

// ─── Built-in personas ───────────────────────────────────────────────────────
describe("built-in personas", () => {
    it("5 built-ins exist even without a file", () => {
        const out = listPersonas();
        for (const name of ["default", "formal", "friendly", "coach", "teacher"]) {
            expect(out).toContain(name);
        }
    });

    it("default active persona is default", () => {
        expect(getActivePersona()).toContain("default");
    });
});

describe("setActivePersona", () => {
    it("activates a built-in persona", () => {
        const msg = setActivePersona("coach");
        expect(msg).toContain("coach");
        expect(getActivePersona()).toContain("coach");
    });

    it("rejects a nonexistent persona + lists available ones", () => {
        const msg = setActivePersona("yok-xyz");
        expect(msg).toContain("not found");
        expect(msg).toContain("default");
    });
});

describe("addPersona", () => {
    it("adds a custom persona and it can be activated", () => {
        addPersona("korsan", "Korsan gibi konuşur", "Arr! Korsan dilinde yanıt ver.");
        expect(listPersonas()).toContain("korsan");
        setActivePersona("korsan");
        expect(getActivePersona()).toContain("Korsan dilinde");
    });

    it("rejects an empty name", () => {
        expect(addPersona("  ", "x", "y")).toContain("ERROR");
    });

    it("built-ins are not written to disk (custom only)", () => {
        addPersona("ozel", "açıklama", "yönerge");
        const raw = JSON.parse(fs.readFileSync(PERSONAS, "utf-8"));
        expect(Object.keys(raw.personas)).toEqual(["ozel"]);
        expect(raw.personas.default).toBeUndefined();
    });
});

// ─── System prompt ───────────────────────────────────────────────────────────
describe("getPersonaSystemPrompt", () => {
    it("empty string for the default persona (default behavior)", () => {
        expect(getPersonaSystemPrompt()).toBe("");
    });

    it("active persona prompt is returned in [PERSONA: X] format", () => {
        setActivePersona("formal");
        const p = getPersonaSystemPrompt();
        expect(p).toContain("[PERSONA: FORMAL]");
        expect(p).toContain("corporate");
    });

    it("roleplay overrides the persona when active", () => {
        setActivePersona("formal");
        startRoleplay("Sherlock Holmes", "Bir cinayet vakası");
        const p = getPersonaSystemPrompt();
        expect(p).toContain("ROLEPLAY MODE");
        expect(p).toContain("Sherlock Holmes");
        expect(p).not.toContain("PERSONA");
    });
});

// ─── Roleplay ────────────────────────────────────────────────────────────────
describe("roleplay", () => {
    it("start + state reflects it", () => {
        const msg = startRoleplay("Gandalf", "Orta Dünya");
        expect(msg).toContain("Gandalf");
        expect(getRoleplayPrompt()).toContain("Gandalf");
    });

    it("rejects an empty character", () => {
        expect(startRoleplay("  ", "senaryo")).toContain("ERROR");
    });

    it("returns to normal mode when stopped", () => {
        startRoleplay("Karakter", "");
        const msg = stopRoleplay();
        expect(msg).toContain("Back to normal");
        expect(getRoleplayPrompt()).toBe("");
    });

    it("stop message when no roleplay is active", () => {
        expect(stopRoleplay()).toContain("No active roleplay mode");
    });
});
