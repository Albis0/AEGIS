import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {loadToken, generateToken, tokenMatches} from "../../electron/api-server";
import {initSecretStorage} from "../../electron/secret-storage";

const TOKEN_PATH = path.join(os.homedir(), ".aegis", "api-token.txt");

// ─────────────────────────────────────────────────────────────────────────────
// Audit A4 regression shield: token encrypted at rest, constant-time compare,
// and no CORS headers anywhere in the server (it is not a browser API).
// ─────────────────────────────────────────────────────────────────────────────

// Reversible mock safeStorage (XOR would do; base64+marker is simpler to assert on)
const mockSafeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from("MOCK" + s, "utf-8"),
    decryptString: (b: Buffer) => {
        const s = b.toString("utf-8");
        if (!s.startsWith("MOCK")) throw new Error("bad ciphertext");
        return s.slice(4);
    },
};

let savedFile: string | null = null;

beforeEach(() => {
    // preserve the user's real token file across the test run
    try { savedFile = fs.readFileSync(TOKEN_PATH, "utf-8"); } catch { savedFile = null; }
    try { fs.unlinkSync(TOKEN_PATH); } catch { /* none */ }
    initSecretStorage(mockSafeStorage);
});

afterEach(() => {
    initSecretStorage(null);
    if (savedFile !== null) fs.writeFileSync(TOKEN_PATH, savedFile, "utf-8");
    else { try { fs.unlinkSync(TOKEN_PATH); } catch { /* none */ } }
});

describe("token storage (audit A4)", () => {
    it("generateToken persists encrypted, not plaintext", () => {
        const token = generateToken();
        const onDisk = fs.readFileSync(TOKEN_PATH, "utf-8");
        expect(onDisk).not.toContain(token);
        expect(onDisk.startsWith("AEGISENC1:")).toBe(true);
        expect(loadToken()).toBe(token);
    });

    it("legacy plaintext token is served and upgraded to encrypted in place", () => {
        fs.mkdirSync(path.dirname(TOKEN_PATH), {recursive: true});
        fs.writeFileSync(TOKEN_PATH, "legacy-plaintext-token-123", "utf-8");
        expect(loadToken()).toBe("legacy-plaintext-token-123");
        const onDisk = fs.readFileSync(TOKEN_PATH, "utf-8");
        expect(onDisk.startsWith("AEGISENC1:")).toBe(true);
        expect(loadToken()).toBe("legacy-plaintext-token-123");
    });

    it("undecryptable token rotates instead of serving garbage", () => {
        fs.mkdirSync(path.dirname(TOKEN_PATH), {recursive: true});
        fs.writeFileSync(TOKEN_PATH, "AEGISENC1:" + Buffer.from("NOPE").toString("base64"), "utf-8");
        const t = loadToken();
        expect(t).toMatch(/^[0-9a-f]{48}$/); // fresh random token
    });
});

describe("tokenMatches", () => {
    it("matches equal tokens, rejects different/empty/length-mismatched", () => {
        expect(tokenMatches("abc123", "abc123")).toBe(true);
        expect(tokenMatches("abc124", "abc123")).toBe(false);
        expect(tokenMatches("abc", "abc123")).toBe(false);
        expect(tokenMatches("", "abc123")).toBe(false);
        expect(tokenMatches("abc123", "")).toBe(false);
    });
});

describe("no CORS headers (audit A4)", () => {
    it("api-server.ts sends no Access-Control-Allow-Origin", () => {
        const src = fs.readFileSync(path.join(__dirname, "..", "..", "electron", "api-server.ts"), "utf-8");
        // The only occurrences must be in comments explaining why it's absent.
        const codeLines = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
        expect(codeLines.join("\n")).not.toContain("Access-Control-Allow-Origin");
    });
});
