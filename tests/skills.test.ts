import {describe, it, expect} from "vitest";
import {pickSkill, type Skill} from "../electron/skills";

// ─────────────────────────────────────────────────────────────────────────────
// Faz CC-4 — skill / prompt packages. The load-bearing logic is skill SELECTION:
// an explicit /name must win, the skill name as a word matches, and a strong
// description-keyword overlap matches — but unrelated chatter must NOT trigger a
// skill (false activation changes behavior silently). pickSkill takes an injected
// skill list so we don't touch the filesystem.
// ─────────────────────────────────────────────────────────────────────────────

const SKILLS: Skill[] = [
    {name: "commit-yaz", description: "Write a clean conventional commit message and commit", instructions: "..."},
    {name: "test-yaz", description: "Write focused unit tests for the code", instructions: "..."},
    {name: "refactor", description: "Refactor code for clarity without changing behavior", instructions: "..."},
];

describe("pickSkill", () => {
    it("explicit /name wins", () => {
        expect(pickSkill("/commit-yaz please", SKILLS)?.name).toBe("commit-yaz");
        expect(pickSkill("hey /refactor this file", SKILLS)?.name).toBe("refactor");
    });

    it("skill name as a word matches", () => {
        expect(pickSkill("can you refactor this?", SKILLS)?.name).toBe("refactor");
    });

    it("description keyword overlap matches", () => {
        // "write", "unit", "tests", "code" overlap the test-yaz description.
        expect(pickSkill("write some unit tests for this code", SKILLS)?.name).toBe("test-yaz");
    });

    it("unrelated chatter does NOT activate a skill", () => {
        expect(pickSkill("what's the weather like today?", SKILLS)).toBeNull();
        expect(pickSkill("teşekkürler", SKILLS)).toBeNull();
    });

    it("unknown slash command falls through to no match", () => {
        expect(pickSkill("/nonexistent-skill", SKILLS)).toBeNull();
    });

    it("empty skill list → null", () => {
        expect(pickSkill("/commit-yaz", [])).toBeNull();
    });
});
