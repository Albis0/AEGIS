/**
 * Faz CC-4 — Skill / prompt packages (Claude-Code "skills" parity).
 *
 * A skill is a packaged instruction set for a kind of task. Each skill is a
 * folder under ~/.aegis/skills/<name>/ containing a SKILL.md with frontmatter:
 *
 *   ---
 *   name: commit-yaz
 *   description: Write a clean conventional-commit message and commit
 *   ---
 *   <instructions injected into the system prompt when this skill is active>
 *
 * A skill activates when the user types `/name` OR the message clearly matches
 * the skill's description keywords. The active skill's instructions are appended
 * to the system prompt for that turn (like Claude Code loading a skill).
 *
 * Distinct from plugins.ts (which provide TOOLS): skills provide INSTRUCTIONS.
 * Files live under userData (~/.aegis), never the read-only asar.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const SKILLS_DIR = path.join(os.homedir(), ".aegis", "skills");

export interface Skill {
    name: string;          // slug (folder name / frontmatter name)
    description: string;
    instructions: string;  // body of SKILL.md
    allowedTools?: string[]; // optional tool restriction (informational for now)
}

function parseSkillMd(raw: string, fallbackName: string): Skill | null {
    const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    let front = "";
    let body = raw;
    if (m) { front = m[1]; body = m[2]; }
    const fields: Record<string, string> = {};
    for (const line of front.split(/\r?\n/)) {
        const kv = line.match(/^(\w+):\s*(.*)$/);
        if (kv) fields[kv[1]] = kv[2].trim();
    }
    const instructions = body.trim();
    if (!instructions) return null;
    const allowed = fields.allowedTools || fields.allowed_tools;
    return {
        name: (fields.name || fallbackName).trim(),
        description: (fields.description || "").trim(),
        instructions,
        allowedTools: allowed ? allowed.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    };
}

/** Load every skill under ~/.aegis/skills/<name>/SKILL.md. */
export function loadSkills(): Skill[] {
    let dirs: fs.Dirent[];
    try { dirs = fs.readdirSync(SKILLS_DIR, {withFileTypes: true}); }
    catch { return []; }
    const out: Skill[] = [];
    for (const d of dirs) {
        if (!d.isDirectory()) continue;
        const file = path.join(SKILLS_DIR, d.name, "SKILL.md");
        try {
            const parsed = parseSkillMd(fs.readFileSync(file, "utf-8"), d.name);
            if (parsed) out.push(parsed);
        } catch { /* no SKILL.md → skip */ }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

function normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9\s/-]/g, " ");
}

/**
 * Pick the active skill for a user message. Explicit `/name` wins; otherwise a
 * description-keyword overlap (≥2 shared meaningful words, or the skill name
 * appearing as a word). Returns null when nothing matches.
 */
export function pickSkill(userMessage: string, skills: Skill[] = loadSkills()): Skill | null {
    if (skills.length === 0) return null;
    const msg = normalize(userMessage);
    const words = new Set(msg.split(/\s+/).filter((w) => w.length > 2));

    // 1) Explicit slash command: /commit-yaz
    const slash = msg.match(/(?:^|\s)\/([a-z0-9-]+)/);
    if (slash) {
        const wanted = slash[1];
        const hit = skills.find((s) => s.name.toLowerCase() === wanted);
        if (hit) return hit;
    }

    // 2) Skill name appears as a whole word.
    for (const s of skills) {
        const nm = s.name.toLowerCase().replace(/-/g, " ");
        if (nm && msg.includes(nm)) return s;
    }

    // 3) Description keyword overlap.
    let best: {skill: Skill; score: number} | null = null;
    for (const s of skills) {
        if (!s.description) continue;
        const descWords = normalize(s.description).split(/\s+/).filter((w) => w.length > 3);
        let score = 0;
        for (const w of descWords) if (words.has(w)) score++;
        if (score >= 2 && (!best || score > best.score)) best = {skill: s, score};
    }
    return best?.skill ?? null;
}

/** The system-prompt block for an active skill (empty string when none). */
export function getActiveSkillBlock(userMessage: string): string {
    const skill = pickSkill(userMessage);
    if (!skill) return "";
    const toolNote = skill.allowedTools?.length
        ? `\n(Prefer these tools for this skill: ${skill.allowedTools.join(", ")}.)`
        : "";
    return `\n\nACTIVE SKILL — "${skill.name}": ${skill.description}\nFollow these instructions for this task:\n${skill.instructions}${toolNote}`;
}

/** Human-readable list for the list_skills tool / Settings. */
export function listSkillsText(): string {
    const skills = loadSkills();
    if (skills.length === 0) return `No skills installed. Add one at ~/.aegis/skills/<name>/SKILL.md.`;
    return skills.map((s) => `• /${s.name} — ${s.description || "(no description)"}`).join("\n");
}

/** Structured list for the renderer (SettingsPanel). */
export function listSkills(): {name: string; description: string}[] {
    return loadSkills().map((s) => ({name: s.name, description: s.description}));
}

// ── First-run example skills (written once so users have something to look at) ──
const EXAMPLE_SKILLS: Record<string, string> = {
    "commit-yaz": `---
name: commit-yaz
description: Write a clean conventional-commit message and commit staged changes
---
When asked to commit:
1. Run git_status and git_diff (staged) to see what changed.
2. Write a Conventional Commits message: type(scope): summary — imperative, ≤72 chars.
3. Body: what and why, not how. No emoji.
4. Commit with git_commit. Do not push unless asked.`,
    "test-yaz": `---
name: test-yaz
description: Write focused unit tests for the code in question
---
When asked to write tests:
1. Read the target code first; identify the load-bearing branches and edge cases.
2. Cover the happy path plus at least one failure/edge case per function.
3. Keep tests deterministic and independent; clean up any files they create.
4. Run the test command and report pass/fail honestly.`,
    "refactor": `---
name: refactor
description: Refactor code for clarity without changing behavior
---
When asked to refactor:
1. Understand current behavior before changing anything.
2. Make small, behavior-preserving edits; keep names and idioms consistent with the file.
3. Do NOT add features or fix unrelated bugs in the same pass.
4. Ensure tests still pass afterward.`,
};

export function seedExampleSkills(): void {
    try {
        for (const [name, content] of Object.entries(EXAMPLE_SKILLS)) {
            const dir = path.join(SKILLS_DIR, name);
            const file = path.join(dir, "SKILL.md");
            if (!fs.existsSync(file)) {
                fs.mkdirSync(dir, {recursive: true});
                fs.writeFileSync(file, content, "utf-8");
            }
        }
    } catch (e) {
        console.error("[skills] seed failed:", (e as Error).message);
    }
}

export const _paths = {SKILLS_DIR};
