/**
 * Faz CC-5 — File-based persistent memory (Claude-Code memory parity).
 *
 * memory-plus/adaptive-memory store facts in a JSON DB. This adds the parallel,
 * human-readable layer Claude Code uses: one markdown file per memory under
 * ~/.aegis/memory/, each with frontmatter (name/description/type), plus a
 * MEMORY.md index loaded into the system prompt every session.
 *
 * Types mirror Claude Code: user | feedback | project | reference.
 * Files live under userData (~/.aegis) — never inside the asar (read-only when
 * packaged; see the Kokoro note). Pure fs + string work, no Electron import, so
 * it's unit-testable without a running app.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type MemoryType = "user" | "feedback" | "project" | "reference";
const VALID_TYPES: ReadonlySet<string> = new Set(["user", "feedback", "project", "reference"]);

const MEM_DIR = path.join(os.homedir(), ".aegis", "memory");
const INDEX_PATH = path.join(MEM_DIR, "MEMORY.md");

export interface MemoryFile {
    name: string;        // kebab-case slug (also the filename without .md)
    description: string; // one-line summary (used in the index + recall)
    type: MemoryType;
    body: string;        // the fact itself
}

// ── Slug + parsing helpers ───────────────────────────────────────────────────

export function slugify(s: string): string {
    return s.toLowerCase()
        .normalize("NFKD").replace(/[̀-ͯ]/g, "") // strip accents
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "note";
}

function ensureDir(): void {
    fs.mkdirSync(MEM_DIR, {recursive: true});
}

// Very small frontmatter parser (we control the format, no YAML lib needed).
export function parseMemoryFile(raw: string): MemoryFile | null {
    const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!m) return null;
    const [, front, body] = m;
    const fields: Record<string, string> = {};
    for (const line of front.split(/\r?\n/)) {
        const kv = line.match(/^(\w+):\s*(.*)$/);
        if (kv) fields[kv[1]] = kv[2].trim();
    }
    const type = VALID_TYPES.has(fields.type) ? (fields.type as MemoryType) : "project";
    if (!fields.name) return null;
    return {
        name: fields.name,
        description: fields.description ?? "",
        type,
        body: body.trim(),
    };
}

function serialize(mem: MemoryFile): string {
    return `---\nname: ${mem.name}\ndescription: ${mem.description}\ntype: ${mem.type}\n---\n\n${mem.body}\n`;
}

// ── Index (MEMORY.md) ─────────────────────────────────────────────────────────

export function listMemoryFiles(): MemoryFile[] {
    try {
        const files = fs.readdirSync(MEM_DIR).filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
        const out: MemoryFile[] = [];
        for (const f of files) {
            try {
                const parsed = parseMemoryFile(fs.readFileSync(path.join(MEM_DIR, f), "utf-8"));
                if (parsed) out.push(parsed);
            } catch { /* skip unreadable */ }
        }
        return out.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
        return []; // dir doesn't exist yet
    }
}

function rewriteIndex(): void {
    const mems = listMemoryFiles();
    const lines = mems.map((m) => `- [${m.name}](${m.name}.md) — ${m.description || m.body.split("\n")[0].slice(0, 80)}`);
    const content = `# Memory Index\n\n${lines.join("\n")}\n`;
    ensureDir();
    fs.writeFileSync(INDEX_PATH, content, "utf-8");
}

/** The index string appended to the system prompt each session. Empty if no memories. */
export function getMemoryIndexForContext(): string {
    const mems = listMemoryFiles();
    if (mems.length === 0) return "";
    const lines = mems.map((m) => `- (${m.type}) ${m.name}: ${m.description || m.body.split("\n")[0].slice(0, 100)}`);
    return `\n\nFILE MEMORY (persistent notes; ask to recall full detail by name):\n${lines.join("\n")}`;
}

// ── Write / delete (dedupe by slug like Claude Code) ─────────────────────────

export interface RememberInput {
    fact: string;
    type?: string;
    title?: string;       // optional explicit slug source
    description?: string;  // optional one-line summary
}

export function rememberFile(input: RememberInput): string {
    const fact = (input.fact ?? "").trim();
    if (!fact) return "ERROR: nothing to remember (empty fact).";
    const type: MemoryType = VALID_TYPES.has(input.type ?? "") ? (input.type as MemoryType) : "project";
    const name = slugify(input.title || input.description || fact.split("\n")[0]);
    const description = (input.description || fact.split("\n")[0]).slice(0, 120);
    ensureDir();
    const file = path.join(MEM_DIR, `${name}.md`);
    const existed = fs.existsSync(file);
    fs.writeFileSync(file, serialize({name, description, type, body: fact}), "utf-8");
    rewriteIndex();
    return `${existed ? "Updated" : "Saved"} memory "${name}" (${type}). It will be recalled in future sessions.`;
}

export function forgetFile(idOrName: string): string {
    const key = (idOrName ?? "").trim();
    if (!key) return "ERROR: which memory? Give its name.";
    const slug = slugify(key);
    const direct = path.join(MEM_DIR, `${slug}.md`);
    let target: string | null = null;
    if (fs.existsSync(direct)) target = direct;
    else {
        // fall back to a substring match on name/description/body
        const hit = listMemoryFiles().find((m) =>
            m.name.includes(slug) || m.description.toLowerCase().includes(key.toLowerCase()) || m.body.toLowerCase().includes(key.toLowerCase()));
        if (hit) target = path.join(MEM_DIR, `${hit.name}.md`);
    }
    if (!target || !fs.existsSync(target)) return `No memory found matching "${idOrName}".`;
    fs.unlinkSync(target);
    rewriteIndex();
    return `Forgot memory "${path.basename(target, ".md")}".`;
}

export function listMemoriesText(): string {
    const mems = listMemoryFiles();
    if (mems.length === 0) return "No file memories yet.";
    return mems.map((m) => `• [${m.type}] ${m.name}: ${m.description}`).join("\n");
}

/** Full detail of one memory by name (for "recall X"). */
export function recallMemory(name: string): string {
    const slug = slugify(name ?? "");
    const file = path.join(MEM_DIR, `${slug}.md`);
    try {
        const parsed = parseMemoryFile(fs.readFileSync(file, "utf-8"));
        if (parsed) return `[${parsed.type}] ${parsed.name}\n${parsed.body}`;
    } catch { /* fall through */ }
    const hit = listMemoryFiles().find((m) => m.name.includes(slug) || m.description.toLowerCase().includes((name ?? "").toLowerCase()));
    return hit ? `[${hit.type}] ${hit.name}\n${hit.body}` : `No memory named "${name}".`;
}

// Test hook.
export const _paths = {MEM_DIR, INDEX_PATH};
