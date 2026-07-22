import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {makeFsExecutors} from "../../electron/tools/exec-fs";

// ─────────────────────────────────────────────────────────────────────────────
// Faz CC-1 — code-aware file tools. glob finds by name, grep searches contents,
// edit does exact-string replacement with Claude-Code uniqueness semantics. A
// wrong uniqueness check silently edits the wrong occurrence; a leaky path guard
// lets an untrusted prompt read outside the sandbox. We lock both.
// ─────────────────────────────────────────────────────────────────────────────

// Full PC Access ON for most tests so the temp dir (outside home) is reachable.
const fsx = makeFsExecutors(() => true);
const fsxSandboxed = makeFsExecutors(() => false);

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-fs-"));
    fs.mkdirSync(path.join(root, "src"), {recursive: true});
    fs.mkdirSync(path.join(root, "node_modules", "pkg"), {recursive: true});
    fs.writeFileSync(path.join(root, "src", "a.ts"), "export function runAgentLoop() {}\nconst x = 1;\n");
    fs.writeFileSync(path.join(root, "src", "b.tsx"), "const y = 2;\nrunAgentLoop();\n");
    fs.writeFileSync(path.join(root, "readme.md"), "# hello\nrunAgentLoop mentioned here too\n");
    fs.writeFileSync(path.join(root, "node_modules", "pkg", "index.ts"), "runAgentLoop() // should be ignored\n");
});

afterEach(() => {
    try { fs.rmSync(root, {recursive: true, force: true}); } catch { /* ignore */ }
});

describe("glob_files", () => {
    it("matches **/*.ts and excludes node_modules", async () => {
        const out = await fsx.glob_files({pattern: "**/*.ts", cwd: root});
        expect(out).toContain(path.join(root, "src", "a.ts"));
        expect(out).not.toContain("node_modules");
    });

    it("supports brace expansion {ts,tsx}", async () => {
        const out = await fsx.glob_files({pattern: "src/**/*.{ts,tsx}", cwd: root});
        expect(out).toContain("a.ts");
        expect(out).toContain("b.tsx");
    });

    it("reports no matches cleanly", async () => {
        const out = await fsx.glob_files({pattern: "**/*.py", cwd: root});
        expect(out).toMatch(/No files match/i);
    });

    it("requires a pattern", async () => {
        const out = await fsx.glob_files({pattern: "", cwd: root});
        expect(out).toMatch(/ERROR/);
    });
});

describe("grep_content", () => {
    it("finds runAgentLoop across files, skipping node_modules", async () => {
        const out = await fsx.grep_content({pattern: "runAgentLoop", path: root});
        expect(out).toContain("a.ts");
        expect(out).toContain("readme.md");
        expect(out).not.toContain(path.join("node_modules", "pkg"));
    });

    it("honors the glob filter", async () => {
        const out = await fsx.grep_content({pattern: "runAgentLoop", glob: "**/*.md", path: root});
        expect(out).toContain("readme.md");
        expect(out).not.toContain("a.ts");
    });

    it("reports invalid regex", async () => {
        const out = await fsx.grep_content({pattern: "(", path: root});
        expect(out).toMatch(/invalid regex/i);
    });

    it("returns line numbers", async () => {
        const out = await fsx.grep_content({pattern: "const x", path: path.join(root, "src", "a.ts")});
        expect(out).toMatch(/a\.ts:2:/);
    });
});

describe("edit_file", () => {
    it("replaces a unique string", async () => {
        const f = path.join(root, "src", "a.ts");
        const out = await fsx.edit_file({path: f, old_string: "const x = 1;", new_string: "const x = 42;"});
        expect(out).toMatch(/replaced 1/i);
        expect(fs.readFileSync(f, "utf-8")).toContain("const x = 42;");
    });

    it("errors when old_string is not unique and replace_all is false", async () => {
        const f = path.join(root, "dup.txt");
        fs.writeFileSync(f, "foo\nfoo\n");
        const out = await fsx.edit_file({path: f, old_string: "foo", new_string: "bar"});
        expect(out).toMatch(/not unique/i);
        expect(fs.readFileSync(f, "utf-8")).toBe("foo\nfoo\n"); // untouched
    });

    it("replace_all rewrites every occurrence", async () => {
        const f = path.join(root, "dup.txt");
        fs.writeFileSync(f, "foo\nfoo\n");
        const out = await fsx.edit_file({path: f, old_string: "foo", new_string: "bar", replace_all: "true"});
        expect(out).toMatch(/replaced 2/i);
        expect(fs.readFileSync(f, "utf-8")).toBe("bar\nbar\n");
    });

    it("errors when old_string is absent", async () => {
        const f = path.join(root, "src", "a.ts");
        const out = await fsx.edit_file({path: f, old_string: "not-present-anywhere", new_string: "x"});
        expect(out).toMatch(/not found/i);
    });

    it("rejects identical old/new", async () => {
        const f = path.join(root, "src", "a.ts");
        const out = await fsx.edit_file({path: f, old_string: "const x = 1;", new_string: "const x = 1;"});
        expect(out).toMatch(/identical/i);
    });
});

describe("path sandbox (Full PC Access off)", () => {
    it("blocks glob outside the home directory", async () => {
        // root is a temp dir, which is outside the home dir on CI/dev machines.
        const out = await fsxSandboxed.glob_files({pattern: "**/*.ts", cwd: root});
        // If the temp dir happens to be under home (unusual), the guard passes — accept either
        // a BLOCKED message or a normal result, but never a crash.
        expect(typeof out).toBe("string");
        if (!path.resolve(root).startsWith(path.resolve(os.homedir()))) {
            expect(out).toMatch(/BLOCKED/);
        }
    });
});
