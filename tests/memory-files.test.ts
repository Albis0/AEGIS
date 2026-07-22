import {describe, it, expect, afterEach} from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
    slugify, parseMemoryFile, rememberFile, forgetFile, listMemoryFiles,
    recallMemory, getMemoryIndexForContext, _paths,
} from "../electron/memory-files";

// ─────────────────────────────────────────────────────────────────────────────
// Faz CC-5 — file-based persistent memory (Claude-Code parity). One markdown
// file per memory with frontmatter, plus a MEMORY.md index loaded into the
// system prompt. Load-bearing: dedupe-by-slug (update, not duplicate), the
// index string, and round-trip parse. Tests write under ~/.aegis/memory with a
// unique prefix and clean only their own files.
// ─────────────────────────────────────────────────────────────────────────────

const PREFIX = "cc5test-";
function cleanup() {
    try {
        for (const f of fs.readdirSync(_paths.MEM_DIR)) {
            if (f.startsWith(PREFIX)) fs.rmSync(path.join(_paths.MEM_DIR, f), {force: true});
        }
    } catch { /* dir may not exist */ }
}
afterEach(cleanup);

describe("slugify", () => {
    it("kebab-cases and strips punctuation", () => {
        expect(slugify("My Brother's Name!")).toBe("my-brother-s-name");
        expect(slugify("  spaces   here ")).toBe("spaces-here");
    });
    it("falls back to 'note' for empty input", () => {
        expect(slugify("!!!")).toBe("note");
    });
});

describe("parseMemoryFile", () => {
    it("parses frontmatter + body", () => {
        const raw = "---\nname: foo\ndescription: a thing\ntype: project\n---\n\nThe body here.\n";
        const m = parseMemoryFile(raw);
        expect(m).not.toBeNull();
        expect(m!.name).toBe("foo");
        expect(m!.type).toBe("project");
        expect(m!.body).toBe("The body here.");
    });
    it("defaults an unknown type to project", () => {
        const m = parseMemoryFile("---\nname: x\ntype: banana\n---\nbody");
        expect(m!.type).toBe("project");
    });
    it("returns null without a name", () => {
        expect(parseMemoryFile("---\ntype: user\n---\nbody")).toBeNull();
    });
});

describe("rememberFile / recall / forget round-trip", () => {
    it("writes a file and recalls it", () => {
        const out = rememberFile({fact: "The deploy key is in 1Password.", type: "reference", title: `${PREFIX}deploy-key`});
        expect(out).toMatch(/Saved/);
        const recalled = recallMemory(`${PREFIX}deploy-key`);
        expect(recalled).toContain("1Password");
        expect(recalled).toContain("reference");
    });

    it("updates in place instead of duplicating (dedupe by slug)", () => {
        rememberFile({fact: "v1", title: `${PREFIX}dup`});
        const before = listMemoryFiles().filter((m) => m.name === `${PREFIX}dup`).length;
        const out = rememberFile({fact: "v2 updated", title: `${PREFIX}dup`});
        const after = listMemoryFiles().filter((m) => m.name === `${PREFIX}dup`).length;
        expect(out).toMatch(/Updated/);
        expect(before).toBe(1);
        expect(after).toBe(1);
        expect(recallMemory(`${PREFIX}dup`)).toContain("v2 updated");
    });

    it("forgets a memory by name", () => {
        rememberFile({fact: "temporary", title: `${PREFIX}temp`});
        expect(recallMemory(`${PREFIX}temp`)).toContain("temporary");
        const out = forgetFile(`${PREFIX}temp`);
        expect(out).toMatch(/Forgot/);
        expect(recallMemory(`${PREFIX}temp`)).toMatch(/No memory/);
    });

    it("rejects an empty fact", () => {
        expect(rememberFile({fact: "   "})).toMatch(/ERROR/);
    });
});

describe("getMemoryIndexForContext", () => {
    it("includes saved memories with type + summary", () => {
        rememberFile({fact: "User prefers dark mode.", type: "user", title: `${PREFIX}pref`, description: "prefers dark mode"});
        const idx = getMemoryIndexForContext();
        expect(idx).toContain("FILE MEMORY");
        expect(idx).toContain(`${PREFIX}pref`);
        expect(idx).toContain("(user)");
    });
});
