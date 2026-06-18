import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {initVault, vaultStore, vaultGet, vaultList, vaultDelete} from "../../electron/vault";

// ─────────────────────────────────────────────────────────────────────────────
// Vault — API key/şifre gibi sırların şifreli saklanması (SMTP şifresi bug fix'i
// bunu kullanıyor). Gerçek ~/.aegis/vault.enc.json dosyasıyla test edilir;
// safeStorage yerine deterministik bir sahte enjekte edilir (base64 round-trip).
// ─────────────────────────────────────────────────────────────────────────────

const VAULT_PATH = path.join(os.homedir(), ".aegis", "vault.enc.json");

// Deterministik sahte safeStorage — gerçek DPAPI yerine base64 ile round-trip.
const fakeSafeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from("enc:" + s, "utf-8"),
    decryptString: (b: Buffer) => b.toString("utf-8").replace(/^enc:/, ""),
};

function cleanup() {
    try { fs.rmSync(VAULT_PATH, {force: true}); } catch { /* yok */ }
}

beforeEach(() => { cleanup(); initVault(fakeSafeStorage); });
afterEach(cleanup);

describe("vaultStore / vaultGet round-trip", () => {
    it("kaydedilen değer geri okunur", () => {
        const msg = vaultStore("email_default_pass", "s3cret");
        expect(msg).toContain("kaydedildi");
        expect(vaultGet("email_default_pass")).toBe("s3cret");
    });

    it("değer dosyada DÜZ METİN olarak durmaz (şifreli)", () => {
        vaultStore("k", "PAROLA123");
        const raw = fs.readFileSync(VAULT_PATH, "utf-8");
        expect(raw).not.toContain("PAROLA123"); // hex/şifreli olmalı
    });

    it("var olmayan anahtar null döner", () => {
        expect(vaultGet("yok")).toBeNull();
    });
});

describe("vaultList", () => {
    it("boş vault anlamlı mesaj verir", () => {
        expect(vaultList().toLowerCase()).toContain("yok");
    });

    it("kayıtlı anahtarları listeler", () => {
        vaultStore("a", "1");
        vaultStore("b", "2");
        const list = vaultList();
        expect(list).toContain("a");
        expect(list).toContain("b");
    });
});

describe("vaultDelete", () => {
    it("kayıtlı anahtarı siler", () => {
        vaultStore("temp", "x");
        expect(vaultDelete("temp")).toContain("silindi");
        expect(vaultGet("temp")).toBeNull();
    });

    it("olmayan anahtarda bulunamadı mesajı", () => {
        expect(vaultDelete("yok")).toContain("bulunamadı");
    });
});

describe("safeStorage kullanılamazsa", () => {
    it("vaultStore güvenli hata döner (throw etmez)", () => {
        initVault({
            isEncryptionAvailable: () => false,
            encryptString: () => Buffer.from(""),
            decryptString: () => "",
        });
        const msg = vaultStore("k", "v");
        expect(msg).toContain("HATA");
        // tekrar gerçek sahteye dön
        initVault(fakeSafeStorage);
    });
});
