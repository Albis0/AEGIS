import {describe, it, expect} from "vitest";
import {getSystemPrompt, buildToolRules, buildReferenceRules, type PromptLang} from "../../electron/prompts";

const LANGS: PromptLang[] = ["tr", "en", "de", "fr", "es"];

// ─────────────────────────────────────────────────────────────────────────────
// Audit C4 regression shield. Before this, TOOL RULES / REFERENCE RESOLUTION
// were hand-written per language and DE/FR/ES had silently lost both sections.
// Rules are now generated from one routing table with English fallback — these
// tests make a missing section in ANY language a test failure, not a mystery.
// ─────────────────────────────────────────────────────────────────────────────

describe("tool routing rules exist in every language", () => {
    it("steam_launch and spotify routing present in all 5 languages", () => {
        for (const lang of LANGS) {
            const p = getSystemPrompt(lang);
            expect(p, `${lang}: steam_launch`).toContain("steam_launch");
            expect(p, `${lang}: spotify`).toMatch(/spotify_(\*|open|play)/);
            expect(p, `${lang}: run_command guidance`).toContain("run_command");
        }
    });

    it("reference resolution present in all 5 languages", () => {
        for (const lang of LANGS) {
            const p = getSystemPrompt(lang);
            expect(p, lang).toContain("lastTool");
            expect(p, lang).toContain("SON İŞLEMLER"); // STM block header is shared
        }
    });

    it("security section present in all 5 languages", () => {
        for (const lang of LANGS) {
            const p = getSystemPrompt(lang);
            expect(p, lang).toContain("Format-Volume");
            expect(p, lang).toContain("Restart-Computer");
        }
    });
});

describe("language fallback", () => {
    it("languages without their own routing lines fall back to English, never empty", () => {
        for (const lang of LANGS) {
            const rules = buildToolRules(lang);
            expect(rules.split("\n").length, lang).toBeGreaterThan(3);
            const refs = buildReferenceRules(lang);
            expect(refs.split("\n").length, lang).toBeGreaterThan(3);
        }
    });

    it("unknown language falls back to Turkish", () => {
        expect(getSystemPrompt("xx")).toContain("Sen AEGIS");
    });
});

describe("composition", () => {
    it("full-PC-access note only appears when enabled", () => {
        expect(getSystemPrompt("en", false)).not.toContain("FULL PC ACCESS ACTIVE");
        expect(getSystemPrompt("en", true)).toContain("FULL PC ACCESS ACTIVE");
    });

    it("includes current date/time note", () => {
        expect(getSystemPrompt("en")).toMatch(/Current date and time \(local\): \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });
});
