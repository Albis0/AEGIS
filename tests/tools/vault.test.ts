import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {initVault, vaultStore, vaultGet, vaultList, vaultDelete} from "../../electron/vault";

// ─────────────────────────────────────────────────────────────────────────────
// Vault — encrypted storage of secrets like API keys/passwords (the SMTP
// password bug fix relies on this). Tested against the real
// ~/.aegis/vault.enc.json file; a deterministic fake is injected in place of
// safeStorage (base64 round-trip).
// ─────────────────────────────────────────────────────────────────────────────

const VAULT_PATH = path.join(os.homedir(), ".aegis", "vault.enc.json");

// Deterministic fake safeStorage — base64 round-trip instead of real DPAPI.
const fakeSafeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from("enc:" + s, "utf-8"),
    decryptString: (b: Buffer) => b.toString("utf-8").replace(/^enc:/, ""),
};

function cleanup() {
    try { fs.rmSync(VAULT_PATH, {force: true}); } catch { /* none */ }
}

beforeEach(() => { cleanup(); initVault(fakeSafeStorage); });
afterEach(cleanup);

describe("vaultStore / vaultGet round-trip", () => {
    it("a stored value can be read back", () => {
        const msg = vaultStore("email_default_pass", "s3cret");
        expect(msg).toContain("saved");
        expect(vaultGet("email_default_pass")).toBe("s3cret");
    });

    it("the value is not stored as PLAIN TEXT in the file (encrypted)", () => {
        vaultStore("k", "PAROLA123");
        const raw = fs.readFileSync(VAULT_PATH, "utf-8");
        expect(raw).not.toContain("PAROLA123"); // must be hex/encrypted
    });

    it("a nonexistent key returns null", () => {
        expect(vaultGet("yok")).toBeNull();
    });
});

describe("vaultList", () => {
    it("gives a meaningful message for an empty vault", () => {
        expect(vaultList().toLowerCase()).toContain("no keys stored");
    });

    it("lists stored keys", () => {
        vaultStore("a", "1");
        vaultStore("b", "2");
        const list = vaultList();
        expect(list).toContain("a");
        expect(list).toContain("b");
    });
});

describe("vaultDelete", () => {
    it("deletes a stored key", () => {
        vaultStore("temp", "x");
        expect(vaultDelete("temp")).toContain("deleted");
        expect(vaultGet("temp")).toBeNull();
    });

    it("not-found message for a nonexistent key", () => {
        expect(vaultDelete("yok")).toContain("not found");
    });
});

describe("when safeStorage is unavailable", () => {
    it("vaultStore returns a safe error (does not throw)", () => {
        initVault({
            isEncryptionAvailable: () => false,
            encryptString: () => Buffer.from(""),
            decryptString: () => "",
        });
        const msg = vaultStore("k", "v");
        expect(msg).toContain("ERROR");
        // switch back to the real fake
        initVault(fakeSafeStorage);
    });
});
