/**
 * Faz 13 — Bilgi Tabanı & RAG
 *
 * Harici bağımlılık yok. Strateji:
 *  - Dosyaları 800-char chunk'lara böl → ~/.aegis/index/<sha>.json
 *  - Arama: LLM ile keyword extraction → chunk'larda kelime arama (BM25-lite)
 *  - chat_with_file: dosyayı yükle, soruyu LLM'e bağlam olarak ver
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

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
    try { return JSON.parse(fs.readFileSync(META_PATH, "utf-8")); } catch { return []; }
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

function readTextFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if ([".txt", ".md", ".ts", ".js", ".py", ".json", ".csv", ".html", ".xml"].includes(ext)) {
        return fs.readFileSync(filePath, "utf-8");
    }
    throw new Error(`Desteklenmeyen dosya tipi: ${ext}. Desteklenenler: .txt, .md, .ts, .js, .py, .json, .csv`);
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
    if (!fs.existsSync(resolved)) return `HATA: Dosya bulunamadı: ${resolved}`;

    let content: string;
    try { content = readTextFile(resolved); } catch (e) { return `HATA: ${(e as Error).message}`; }

    const hash = fileHash(content);
    const meta = loadMeta();
    const existing = meta.find((m) => m.source === resolved);
    if (existing?.hash === hash) return `"${path.basename(resolved)}" zaten güncel, yeniden indekslemeye gerek yok.`;
    if (existing) {
        deleteChunks(existing.chunkIds);
        meta.splice(meta.indexOf(existing), 1);
    }

    const chunks = chunkText(content, resolved);
    for (const chunk of chunks) saveChunk(chunk);
    meta.push({source: resolved, hash, chunkIds: chunks.map((c) => c.id), indexedAt: new Date().toISOString()});
    saveMeta(meta);
    return `"${path.basename(resolved)}" indekslendi: ${chunks.length} chunk, ${content.length} karakter.`;
}

export function indexFolder(folderPath: string, extensions = [".txt", ".md", ".ts", ".js", ".py"]): string {
    const resolved = folderPath.startsWith("~") ? path.join(os.homedir(), folderPath.slice(1)) : folderPath;
    if (!fs.existsSync(resolved)) return `HATA: Klasör bulunamadı: ${resolved}`;

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
    files = files.slice(0, 200); // güvenlik limiti

    const results = files.map((f) => indexFile(f));
    const indexed = results.filter((r) => !r.startsWith("HATA") && !r.includes("yeniden indekslemeye gerek yok")).length;
    return `${indexed} dosya indekslendi (${files.length} toplam). Klasör: ${resolved}`;
}

export function searchKnowledge(query: string, topK = 5): string {
    const meta = loadMeta();
    if (meta.length === 0) return "Bilgi tabanı boş. Önce 'şu dosyayı indeksle' komutu ver.";

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
    if (top.length === 0) return `"${query}" için bilgi tabanında eşleşme bulunamadı.`;

    return top.map((r, i) => {
        const src = path.basename(r.chunk.source);
        const preview = r.chunk.text.slice(0, 300).replace(/\n+/g, " ");
        return `[${i + 1}] ${src} (skor: ${r.score})\n${preview}…`;
    }).join("\n\n");
}

export function readFileForChat(filePath: string, maxChars = 12000): string {
    const resolved = filePath.startsWith("~") ? path.join(os.homedir(), filePath.slice(1)) : filePath;
    if (!fs.existsSync(resolved)) return `HATA: Dosya bulunamadı: ${resolved}`;
    try {
        const content = readTextFile(resolved);
        if (content.length <= maxChars) return content;
        return content.slice(0, maxChars) + `\n\n… [${content.length - maxChars} karakter kesildi]`;
    } catch (e) {
        return `HATA: ${(e as Error).message}`;
    }
}

export function listIndexedFiles(): string {
    const meta = loadMeta();
    if (meta.length === 0) return "İndekslenmiş dosya yok.";
    return meta.map((m) => {
        const date = new Date(m.indexedAt).toLocaleDateString("tr-TR");
        return `• ${path.basename(m.source)} (${m.chunkIds.length} chunk, ${date})\n  ${m.source}`;
    }).join("\n");
}

export function removeFromIndex(filePath: string): string {
    const resolved = filePath.startsWith("~") ? path.join(os.homedir(), filePath.slice(1)) : filePath;
    const meta = loadMeta();
    const idx = meta.findIndex((m) => m.source === resolved || m.source.includes(filePath));
    if (idx === -1) return `"${filePath}" indekste bulunamadı.`;
    deleteChunks(meta[idx].chunkIds);
    meta.splice(idx, 1);
    saveMeta(meta);
    return `"${path.basename(resolved)}" indeksten kaldırıldı.`;
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
