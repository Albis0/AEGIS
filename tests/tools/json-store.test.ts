import {describe, it, expect, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {writeJsonAtomic} from "../../electron/json-store";

const DIR = path.join(os.tmpdir(), `aegis-json-store-test-${process.pid}`);
const FILE = path.join(DIR, "nested", "store.json");

afterEach(() => {
    try { fs.rmSync(DIR, {recursive: true, force: true}); } catch { /* none */ }
});

// Audit D1 — torn fs.writeFileSync writes were the source of the corrupted-file
// reports; writeJsonAtomic goes through tmp+rename so readers never see a partial file.
describe("writeJsonAtomic", () => {
    it("creates parent directories and round-trips data", () => {
        writeJsonAtomic(FILE, {a: 1, list: [1, 2, 3]});
        expect(JSON.parse(fs.readFileSync(FILE, "utf-8"))).toEqual({a: 1, list: [1, 2, 3]});
    });

    it("replaces existing content completely (no partial merge)", () => {
        writeJsonAtomic(FILE, {a: "x".repeat(10_000)});
        writeJsonAtomic(FILE, {b: 2});
        expect(JSON.parse(fs.readFileSync(FILE, "utf-8"))).toEqual({b: 2});
    });

    it("leaves no .tmp files behind", () => {
        writeJsonAtomic(FILE, [1, 2, 3]);
        const leftovers = fs.readdirSync(path.dirname(FILE)).filter((f) => f.endsWith(".tmp"));
        expect(leftovers).toEqual([]);
    });

    it("compact mode writes without pretty indentation", () => {
        writeJsonAtomic(FILE, {a: 1}, false);
        expect(fs.readFileSync(FILE, "utf-8")).toBe('{"a":1}');
    });
});
