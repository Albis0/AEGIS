/**
 * Phase 13 — Knowledge Base & RAG
 *
 * No external dependencies. Strategy:
 *  - Split files into 800-char chunks → ~/.aegis/index/<sha>.json
 *  - Search: keyword extraction via LLM → word search across chunks (BM25-lite)
 *  - chat_with_file: load the file, pass the question to the LLM as context
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import {reportCorruptedFile} from "./corrupted-file-tracker";

const INDEX_DIR = path.join(os.homedir(), ".aegis", "index");
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

interface Chunk {
    id: string;
    source: string;  // file path
    page?: number;
    text: string;
    words: string[]; // lowercase word tokens for BM25-lite
}

interface IndexMeta {
    source: string;
    hash: string;
    chunkIds: string[];
    indexedAt: string;
}

const META_PATH = path.join(INDEX_DIR, "_meta.json");

function ensureDir(): void {
    fs.mkdirSync(INDEX_DIR, {recursive: true});
}

function loadMeta(): IndexMeta[] {
    let raw: string;
    try { raw = fs.readFileSync(META_PATH, "utf-8"); } catch { return []; }
    try { return JSON.parse(raw); } catch {
        reportCorruptedFile("knowledge index (index/_meta.json)");
        try { fs.copyFileSync(META_PATH, META_PATH + ".bak"); } catch { /* best-effort backup */ }
        return [];
    }
}

function saveMeta(meta: IndexMeta[]): void {
    ensureDir();
    fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), "utf-8");
}

function fileHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

function chunkText(text: string, source: string): Chunk[] {
    const chunks: Chunk[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        const slice = text.slice(start, end);
        const id = crypto.createHash("md5").update(source + start).digest("hex").slice(0, 12);
        chunks.push({id, source, text: slice, words: tokenize(slice)});
        start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks;
}

const INDEX_FILE_MAX_BYTES = 25 * 1024 * 1024; // 25MB — readFileSync loads it all into memory at once

function readTextFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if ([".txt", ".md", ".ts", ".js", ".py", ".json", ".csv", ".html", ".xml"].includes(ext)) {
        const size = fs.statSync(filePath).size;
        if (size > INDEX_FILE_MAX_BYTES) {
            throw new Error(`File too large to index (${(size / 1024 / 1024).toFixed(1)}MB, limit ${INDEX_FILE_MAX_BYTES / 1024 / 1024}MB).`);
        }
        return fs.readFileSync(filePath, "utf-8");
    }
    throw new Error(`Unsupported file type: ${ext}. Supported: .txt, .md, .ts, .js, .py, .json, .csv`);
}

function saveChunk(chunk: Chunk): void {
    ensureDir();
    fs.writeFileSync(path.join(INDEX_DIR, `${chunk.id}.json`), JSON.stringify(chunk), "utf-8");
}

function loadChunk(id: string): Chunk | null {
    try {
        return JSON.parse(fs.readFileSync(path.join(INDEX_DIR, `${id}.json`), "utf-8"));
    } catch { return null; }
}

function deleteChunks(ids: string[]): void {
    for (const id of ids) {
        try { fs.unlinkSync(path.join(INDEX_DIR, `${id}.json`)); } catch {}
    }
}

// ---- Public tool implementations ----

export function indexFile(filePath: string): string {
    const resolved = filePath.startsWith("~") ? path.join(os.homedir(), filePath.slice(1)) : filePath;
    if (!fs.existsSync(resolved)) return `ERROR: File not found: ${resolved}`;

    let content: string;
    try { content = readTextFile(resolved); } catch (e) { return `ERROR: ${(e as Error).message}`; }

    const hash = fileHash(content);
    const meta = loadMeta();
    const existing = meta.find((m) => m.source === resolved);
    if (existing?.hash === hash) return `"${path.basename(resolved)}" is already up to date, no need to reindex.`;
    if (existing) {
        deleteChunks(existing.chunkIds);
        meta.splice(meta.indexOf(existing), 1);
    }

    const chunks = chunkText(content, resolved);
    for (const chunk of chunks) saveChunk(chunk);
    meta.push({source: resolved, hash, chunkIds: chunks.map((c) => c.id), indexedAt: new Date().toISOString()});
    saveMeta(meta);
    return `"${path.basename(resolved)}" indexed: ${chunks.length} chunks, ${content.length} characters.`;
}

export function indexFolder(folderPath: string, extensions = [".txt", ".md", ".ts", ".js", ".py"]): string {
    const resolved = folderPath.startsWith("~") ? path.join(os.homedir(), folderPath.slice(1)) : folderPath;
    if (!fs.existsSync(resolved)) return `ERROR: Folder not found: ${resolved}`;

    let files: string[] = [];
    function walk(dir: string): void {
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
            if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
                walk(path.join(dir, entry.name));
            } else if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) {
                files.push(path.join(dir, entry.name));
            }
        }
    }
    walk(resolved);
    files = files.slice(0, 200); // safety limit

    const results = files.map((f) => indexFile(f));
    const indexed = results.filter((r) => !r.startsWith("ERROR") && !r.includes("no need to reindex")).length;
    return `${indexed} files indexed (${files.length} total). Folder: ${resolved}`;
}

export function searchKnowledge(query: string, topK = 5): string {
    const meta = loadMeta();
    if (meta.length === 0) return "Knowledge base is empty. First give an 'index this file' command.";

    const queryWords = new Set(tokenize(query));
    const allChunkIds = meta.flatMap((m) => m.chunkIds);

    const scored: {chunk: Chunk; score: number}[] = [];
    for (const id of allChunkIds) {
        const chunk = loadChunk(id);
        if (!chunk) continue;
        let score = 0;
        for (const w of queryWords) {
            score += chunk.words.filter((cw) => cw === w || cw.includes(w)).length;
        }
        if (score > 0) scored.push({chunk, score});
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK);
    if (top.length === 0) return `No match found in the knowledge base for "${query}".`;

    return top.map((r, i) => {
        const src = path.basename(r.chunk.source);
        const preview = r.chunk.text.slice(0, 300).replace(/\n+/g, " ");
        return `[${i + 1}] ${src} (score: ${r.score})\n${preview}…`;
    }).join("\n\n");
}

export function readFileForChat(filePath: string, maxChars = 12000): string {
    const resolved = filePath.startsWith("~") ? path.join(os.homedir(), filePath.slice(1)) : filePath;
    if (!fs.existsSync(resolved)) return `ERROR: File not found: ${resolved}`;
    try {
        const content = readTextFile(resolved);
        if (content.length <= maxChars) return content;
        return content.slice(0, maxChars) + `\n\n… [${content.length - maxChars} characters truncated]`;
    } catch (e) {
        return `ERROR: ${(e as Error).message}`;
    }
}

export function listIndexedFiles(): string {
    const meta = loadMeta();
    if (meta.length === 0) return "No indexed files.";
    return meta.map((m) => {
        const date = new Date(m.indexedAt).toLocaleDateString("tr-TR");
        return `• ${path.basename(m.source)} (${m.chunkIds.length} chunk, ${date})\n  ${m.source}`;
    }).join("\n");
}

export function removeFromIndex(filePath: string): string {
    const resolved = filePath.startsWith("~") ? path.join(os.homedir(), filePath.slice(1)) : filePath;
    const meta = loadMeta();
    const idx = meta.findIndex((m) => m.source === resolved || m.source.includes(filePath));
    if (idx === -1) return `"${filePath}" not found in the index.`;
    deleteChunks(meta[idx].chunkIds);
    meta.splice(idx, 1);
    saveMeta(meta);
    return `"${path.basename(resolved)}" removed from the index.`;
}

export function getTopChunksForQuery(query: string, topK = 6): string {
    const meta = loadMeta();
    if (meta.length === 0) return "";
    const queryWords = new Set(tokenize(query));
    const allIds = meta.flatMap((m) => m.chunkIds);
    const scored: {chunk: Chunk; score: number}[] = [];
    for (const id of allIds) {
        const chunk = loadChunk(id);
        if (!chunk) continue;
        let score = 0;
        for (const w of queryWords) {
            score += chunk.words.filter((cw) => cw === w || cw.includes(w)).length;
        }
        if (score > 0) scored.push({chunk, score});
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((r) => `[${path.basename(r.chunk.source)}]\n${r.chunk.text}`).join("\n\n---\n\n");
}
