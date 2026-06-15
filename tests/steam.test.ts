// Steam tool stabilite testi (deterministik, offline-safe).
// Grup B (Web API): key/SteamID YOKKEN doğru, anlaşılır hata döner — sessizce patlamaz.
// Grup C (storefront): boş girdi reddi. Canlı API testi ayrı (steam-live-smoke.cjs).
import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as steam from "../electron/steam";

const KEY = process.env.STEAM_API_KEY;
const ID = process.env.STEAM_ID64;

describe("Steam Grup B (Web API) — kimlik yokken dürüst hata", () => {
    beforeEach(() => {
        delete process.env.STEAM_API_KEY;
        delete process.env.STEAM_ID64;
    });
    afterEach(() => {
        if (KEY) process.env.STEAM_API_KEY = KEY;
        if (ID) process.env.STEAM_ID64 = ID;
    });

    it("steam_owned_games: API key yoksa 'Steam API key ayarlı değil' der", async () => {
        const r = await steam.steamGetOwnedGames();
        expect(r).toMatch(/API key.*ayarlı değil|SteamID64.*ayarlı değil/i);
    });

    it("steam_friend_list: API key yoksa net hata", async () => {
        const r = await steam.steamGetFriendList();
        expect(r).toMatch(/API key.*ayarlı değil|SteamID64.*ayarlı değil/i);
    });

    it("steam_level: API key yoksa net hata", async () => {
        const r = await steam.steamGetLevel();
        expect(r).toMatch(/ayarlı değil/i);
    });

    it("steam_profile_summary: API key yoksa net hata", async () => {
        const r = await steam.steamGetProfileSummary();
        expect(r).toMatch(/ayarlı değil/i);
    });

    it("steam_total_playtime: API key yoksa net hata (silent crash değil)", async () => {
        const r = await steam.steamGetTotalPlaytime();
        expect(typeof r).toBe("string");
        expect(r).toMatch(/ayarlı değil/i);
    });

    it("steam_owned_games: SADECE SteamID varsa, API key hâlâ gerekli der", async () => {
        process.env.STEAM_ID64 = "76561197960287930";
        const r = await steam.steamGetOwnedGames();
        expect(r).toMatch(/API key.*ayarlı değil/i);
    });
});

describe("Steam — boş/eksik girdi reddi (her grup)", () => {
    const emptyArgCases: [string, () => Promise<string>][] = [
        ["steam_launch", () => steam.steamLaunchGame("")],
        ["steam_search_store", () => steam.steamSearchStore("")],
        ["steam_game_details", () => steam.steamGetGameDetails("")],
        ["steam_game_price", () => steam.steamGetGamePrice("")],
        ["steam_game_playtime", () => steam.steamGetGamePlaytime("")],
        ["steam_search_owned_games", () => steam.steamSearchOwnedGames("")],
        ["steam_is_game_running", () => steam.steamIsGameRunning("")],
        ["steam_friend_current_game", () => steam.steamGetFriendCurrentGame("")],
        ["steam_who_is_playing", () => steam.steamWhoIsPlaying("")],
    ];
    for (const [name, fn] of emptyArgCases) {
        it(`${name}: boş girdi → HATA döner, patlamaz`, async () => {
            const r = await fn();
            expect(typeof r).toBe("string");
            expect(r).toMatch(/HATA|gerekli/i);
        });
    }
});

describe("Steam — fonksiyonlar string döndürür (asla throw etmez)", () => {
    // local/protokol işleri: ağ/Steam olmasa bile string ile dönmeli, exception fırlatmamalı
    const safeCases: [string, () => Promise<string>][] = [
        ["steam_list", () => steam.steamListGames()],
        ["steam_list_running_games", () => steam.steamListRunningGames()],
        ["steam_game_running", () => steam.steamGameRunning()],
        ["steam_show_storage_usage", () => steam.steamShowStorageUsage()],
        ["steam_locate_installation(yok)", () => steam.steamLocateInstallation("zzz-yok-oyun-zzz")],
        ["steam_repeat_last_action(boş)", () => steam.steamRepeatLastAction()],
    ];
    for (const [name, fn] of safeCases) {
        it(`${name}: throw etmez, string döner`, async () => {
            await expect(fn()).resolves.toBeTypeOf("string");
        });
    }
});
