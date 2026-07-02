/**
 * Atomic JSON persistence (audit D1).
 *
 * Every ~/.aegis store used plain fs.writeFileSync — a crash or power loss
 * mid-write leaves a truncated file, which is exactly why corrupted-file-tracker
 * exists. This writes to a temp file in the same directory and renames it over
 * the target: on NTFS (and POSIX) the rename replaces the file atomically, so
 * readers only ever see the old or the new content, never a torn write.
 *
 * SQLite (better-sqlite3) was considered for the append-heavy stores and
 * deliberately deferred: a native module adds an Electron-ABI rebuild step to
 * dev (launch-electron), bun installs, CI and the portable exe — a large
 * compatibility surface for data volumes that are still tiny. Revisit when a
 * store's size actually hurts (see docs/STEPS.md D1).
 */

import * as fs from "fs";
import * as path from "path";

/** Serialize + write atomically. Throws on failure (callers keep their own try/catch policy). */
export function writeJsonAtomic(filePath: string, data: unknown, pretty = true): void {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, json, "utf-8");
    try {
        fs.renameSync(tmp, filePath);
    } catch (e) {
        // Windows can refuse the rename if another handle has the target open
        // without share-delete; fall back to a direct write rather than losing data.
        try { fs.unlinkSync(tmp); } catch { /* best effort */ }
        fs.writeFileSync(filePath, json, "utf-8");
    }
}
