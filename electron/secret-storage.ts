// Shared safeStorage (Windows DPAPI) wrapper for encrypting API keys at rest in
// ~/.aegis/*.json. Both config.ts and settings.ts store secrets and need the same
// encrypt/decrypt behavior — kept in one place so they can't drift.
//
// Injected from main.ts once safeStorage is available; until then, values are
// read/written as plaintext (legacy files, or environments where DPAPI isn't ready
// yet) so the app never fails to start over this.

let _safeStorage: {isEncryptionAvailable(): boolean; encryptString(s: string): Buffer; decryptString(b: Buffer): string} | null = null;

export function initSecretStorage(safeStorage: typeof _safeStorage): void {
    _safeStorage = safeStorage;
}

const ENC_PREFIX = "AEGISENC1:"; // marks a value as base64(safeStorage.encryptString(...))

export function encryptValue(v: string): string {
    if (!v || !_safeStorage?.isEncryptionAvailable()) return v;
    return ENC_PREFIX + _safeStorage.encryptString(v).toString("base64");
}

export function decryptValue(v: string | undefined): string | undefined {
    if (!v || !v.startsWith(ENC_PREFIX)) return v; // plaintext (legacy file or no safeStorage)
    if (!_safeStorage?.isEncryptionAvailable()) return undefined; // can't decrypt without OS support
    try {
        return _safeStorage.decryptString(Buffer.from(v.slice(ENC_PREFIX.length), "base64"));
    } catch {
        return undefined;
    }
}
