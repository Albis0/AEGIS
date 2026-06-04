import {bench, describe, beforeAll, afterAll} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const TEST_HOME = path.join(os.tmpdir(), `aegis-bench-knowledge-${Date.now()}`);
process.env.HOME = TEST_HOME;
process.env.USERPROFILE = TEST_HOME;

import {indexFile, searchKnowledge} from "../../electron/knowledge";

const BENCH_FILE = path.join(TEST_HOME, "bench-sample.txt");

beforeAll(() => {
    fs.mkdirSync(path.join(TEST_HOME, ".aegis", "index"), {recursive: true});
    // 50 KB metin — ~60 chunk (800-char / 100 overlap)
    const lines: string[] = [];
    for (let i = 0; i < 500; i++) {
        lines.push(`Satır ${i}: AEGIS asistan test verisi, Python JavaScript TypeScript Go Rust kelime ${i % 7 === 0 ? "özel" : "normal"}.`);
    }
    fs.writeFileSync(BENCH_FILE, lines.join("\n"), "utf-8");
    indexFile(BENCH_FILE);
});

afterAll(() => {
    fs.rmSync(TEST_HOME, {recursive: true, force: true});
});

describe("knowledge_search benchmark", () => {
    bench("searchKnowledge — 50KB indeks", () => {
        searchKnowledge("Python TypeScript asistan");
    }, {time: 1000});
});
