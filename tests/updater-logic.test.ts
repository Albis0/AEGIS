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

describe("performDownload — indirmeden ÖNCE check yapar (bug kökü)", () => {
    it("KRİTİK: download'dan ÖNCE checkForUpdates çağrılır", async () => {
        const u = makeUpdater({latest: "1.5.1"});
        await performDownload(u, "1.5.0", () => {});
        expect(u.calls).toEqual(["check", "download"]); // sıra: önce check, sonra download
    });

    it("yeni sürüm varsa indirir, ok:true döner", async () => {
        const u = makeUpdater({latest: "1.5.1"});
        const r = await performDownload(u, "1.5.0", () => {});
        expect(r.ok).toBe(true);
    });

    it("güncel sürümdeyse İNDİRMEZ, net hata verir (download çağrılmaz)", async () => {
        const u = makeUpdater({latest: "1.5.0"});
        let errMsg = "";
        const r = await performDownload(u, "1.5.0", (m) => (errMsg = m));
        expect(r.ok).toBe(false);
        expect(u.calls).toEqual(["check"]);            // download HİÇ çağrılmadı
        expect(errMsg).toMatch(/Güncel sürümdesin|bulunamadı/i);
    });

    it("updateInfo null gelirse İNDİRMEZ, hata verir", async () => {
        const u = makeUpdater({latest: null});
        const r = await performDownload(u, "1.5.0", () => {});
        expect(r.ok).toBe(false);
        expect(u.calls).toEqual(["check"]);
    });

    it("check throw ederse hata renderer'a iletilir (sessiz takılma yok)", async () => {
        const u = makeUpdater({checkThrows: "net::ERR_CONNECTION_RESET", latest: "1.5.1"});
        let errMsg = "";
        const r = await performDownload(u, "1.5.0", (m) => (errMsg = m));
        expect(r.ok).toBe(false);
        expect(errMsg).toBe("net::ERR_CONNECTION_RESET");
    });

    it("download throw ederse ('Please check…') yakalanır ve iletilir", async () => {
        const u = makeUpdater({latest: "1.5.1", downloadThrows: true});
        let errMsg = "";
        const r = await performDownload(u, "1.5.0", (m) => (errMsg = m));
        expect(r.ok).toBe(false);
        expect(errMsg).toMatch(/Please check update first/);
    });
});

describe("performCheck — gerçek updater'ı kullanır (state'i besler)", () => {
    it("yeni sürüm varsa hasUpdate:true + latest döner", async () => {
        const u = makeUpdater({latest: "1.5.1"});
        const r = await performCheck(u, "1.5.0");
        expect(r).toMatchObject({current: "1.5.0", latest: "1.5.1", hasUpdate: true});
        expect(u.calls).toContain("check");
    });

    it("aynı sürümse hasUpdate:false", async () => {
        const u = makeUpdater({latest: "1.5.0"});
        const r = await performCheck(u, "1.5.0");
        expect(r.hasUpdate).toBe(false);
    });

    it("updateInfo null → hasUpdate:false, latest=current", async () => {
        const u = makeUpdater({latest: null});
        const r = await performCheck(u, "1.5.0");
        expect(r).toMatchObject({hasUpdate: false, latest: "1.5.0"});
    });

    it("check throw ederse error alanı dolar, patlamaz", async () => {
        const u = makeUpdater({checkThrows: "GitHub 403", latest: "1.5.1"});
        const r = await performCheck(u, "1.5.0");
        expect(r.error).toBe("GitHub 403");
    });
});
