import {describe, it, expect, beforeAll, afterAll} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const TEST_HOME = path.join(os.tmpdir(), `aegis-test-knowledge-${Date.now()}`);
process.env.HOME = TEST_HOME;
process.env.USERPROFILE = TEST_HOME;

import {indexFile, searchKnowledge, listIndexedFiles, removeFromIndex} from "../../electron/knowledge";

const SAMPLE_FILE = path.join(TEST_HOME, "sample.txt");

beforeAll(() => {
    fs.mkdirSync(path.join(TEST_HOME, ".aegis", "index"), {recursive: true});
    fs.writeFileSync(SAMPLE_FILE, [
        "AEGIS bir kişisel AI asistanıdır.",
        "Türkçe konuşur ve görevleri yerine getirir.",
        "Dosya okuma ve yazma yapabilir.",
        "Web araması desteklenir.",
        "Hava durumu bilgisi alınabilir.",
    ].join("\n"), "utf-8");
});

afterAll(() => {
    fs.rmSync(TEST_HOME, {recursive: true, force: true});
});

describe("knowledge index + search", () => {
    it("indexes a text file", () => {
        const result = indexFile(SAMPLE_FILE);
        expect(result).toContain("indexed");
        expect(result).toContain("chunk");
    });

    it("does not reindex unchanged file", () => {
        const result = indexFile(SAMPLE_FILE);
        expect(result).toContain("already up to date");
    });

    it("finds relevant chunks", () => {
        const result = searchKnowledge("AEGIS AI asistan");
        expect(result).toContain("AEGIS");
        expect(result).not.toContain("No match found");
    });

    it("returns not-found for unrelated query", () => {
        const result = searchKnowledge("xyz123abc456");
        expect(result).toContain("No match found");
    });

    it("lists indexed files", () => {
        const list = listIndexedFiles();
        expect(list).toContain("sample.txt");
    });

    it("removes a file from index", () => {
        const result = removeFromIndex(SAMPLE_FILE);
        expect(result).toContain("removed from the index");
        const list = listIndexedFiles();
        expect(list).not.toContain("sample.txt");
    });

    it("handles missing file gracefully", () => {
        const result = indexFile("/nonexistent/path/file.txt");
        expect(result).toContain("ERROR");
    });
});
