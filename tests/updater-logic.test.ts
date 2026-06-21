// Updater akış testi — "Please check update first" bug'ının kökü kapandı mı?
// Bug: indirme, updater check'i çalışmadan tetikleniyordu. Fix: performDownload
// indirmeden ÖNCE checkForUpdates çağırır. Burada autoUpdater'ı stub'layıp kanıtlıyoruz.
import {describe, it, expect, vi} from "vitest";
import {performCheck, performDownload, type UpdaterLike} from "../electron/updater-logic";

function makeUpdater(over: Partial<UpdaterLike> & {latest?: string | null; downloadThrows?: boolean; checkThrows?: string}): UpdaterLike & {calls: string[]} {
    const calls: string[] = [];
    return {
        calls,
        checkForUpdates: vi.fn(async () => {
            calls.push("check");
            if (over.checkThrows) throw new Error(over.checkThrows);
            return over.latest === null ? null : {updateInfo: {version: over.latest ?? "9.9.9"}};
        }),
        downloadUpdate: vi.fn(async () => {
            calls.push("download");
            if (over.downloadThrows) throw new Error("Please check update first");
            return undefined;
        }),
    };
}

describe("performDownload — checks BEFORE downloading (bug root cause)", () => {
    it("CRITICAL: checkForUpdates is called BEFORE download", async () => {
        const u = makeUpdater({latest: "1.5.1"});
        await performDownload(u, "1.5.0", () => {});
        expect(u.calls).toEqual(["check", "download"]); // order: check first, then download
    });

    it("downloads when a new version exists, returns ok:true", async () => {
        const u = makeUpdater({latest: "1.5.1"});
        const r = await performDownload(u, "1.5.0", () => {});
        expect(r.ok).toBe(true);
    });

    it("does NOT download when already on latest version, gives a clear error (download not called)", async () => {
        const u = makeUpdater({latest: "1.5.0"});
        let errMsg = "";
        const r = await performDownload(u, "1.5.0", (m) => (errMsg = m));
        expect(r.ok).toBe(false);
        expect(u.calls).toEqual(["check"]);            // download was NEVER called
        expect(errMsg).toMatch(/latest version|not found/i);
    });

    it("does NOT download when updateInfo is null, returns an error", async () => {
        const u = makeUpdater({latest: null});
        const r = await performDownload(u, "1.5.0", () => {});
        expect(r.ok).toBe(false);
        expect(u.calls).toEqual(["check"]);
    });

    it("if check throws, the error is forwarded to the renderer (no silent hang)", async () => {
        const u = makeUpdater({checkThrows: "net::ERR_CONNECTION_RESET", latest: "1.5.1"});
        let errMsg = "";
        const r = await performDownload(u, "1.5.0", (m) => (errMsg = m));
        expect(r.ok).toBe(false);
        expect(errMsg).toBe("net::ERR_CONNECTION_RESET");
    });

    it("if download throws ('Please check…') it is caught and forwarded", async () => {
        const u = makeUpdater({latest: "1.5.1", downloadThrows: true});
        let errMsg = "";
        const r = await performDownload(u, "1.5.0", (m) => (errMsg = m));
        expect(r.ok).toBe(false);
        expect(errMsg).toMatch(/Please check update first/);
    });
});

describe("performCheck — uses the real updater (feeds state)", () => {
    it("returns hasUpdate:true + latest when a new version exists", async () => {
        const u = makeUpdater({latest: "1.5.1"});
        const r = await performCheck(u, "1.5.0");
        expect(r).toMatchObject({current: "1.5.0", latest: "1.5.1", hasUpdate: true});
        expect(u.calls).toContain("check");
    });

    it("hasUpdate:false when same version", async () => {
        const u = makeUpdater({latest: "1.5.0"});
        const r = await performCheck(u, "1.5.0");
        expect(r.hasUpdate).toBe(false);
    });

    it("updateInfo null → hasUpdate:false, latest=current", async () => {
        const u = makeUpdater({latest: null});
        const r = await performCheck(u, "1.5.0");
        expect(r).toMatchObject({hasUpdate: false, latest: "1.5.0"});
    });

    it("if check throws, the error field is populated, doesn't crash", async () => {
        const u = makeUpdater({checkThrows: "GitHub 403", latest: "1.5.1"});
        const r = await performCheck(u, "1.5.0");
        expect(r.error).toBe("GitHub 403");
    });
});
