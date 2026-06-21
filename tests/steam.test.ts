// Steam tool stabilite testi (deterministik, offline-safe).
// Grup B (Web API): key/SteamID YOKKEN doğru, anlaşılır hata döner — sessizce patlamaz.
// Grup C (storefront): boş girdi reddi. Canlı API testi ayrı (steam-live-smoke.cjs).
import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as steam from "../electron/steam";

const KEY = process.env.STEAM_API_KEY;
const ID = process.env.STEAM_ID64;

describe("Steam Group B (Web API) — honest error when no credentials", () => {
    beforeEach(() => {
        delete process.env.STEAM_API_KEY;
        delete process.env.STEAM_ID64;
    });
    afterEach(() => {
        if (KEY) process.env.STEAM_API_KEY = KEY;
        if (ID) process.env.STEAM_ID64 = ID;
    });

    it("steam_owned_games: says 'is not set' when no API key", async () => {
        const r = await steam.steamGetOwnedGames();
        expect(r).toMatch(/API key.*is not set|SteamID64.*is not set/i);
    });

    it("steam_friend_list: clear error when no API key", async () => {
        const r = await steam.steamGetFriendList();
        expect(r).toMatch(/API key.*is not set|SteamID64.*is not set/i);
    });

    it("steam_level: clear error when no API key", async () => {
        const r = await steam.steamGetLevel();
        expect(r).toMatch(/is not set/i);
    });

    it("steam_profile_summary: clear error when no API key", async () => {
        const r = await steam.steamGetProfileSummary();
        expect(r).toMatch(/is not set/i);
    });

    it("steam_total_playtime: clear error when no API key (not a silent crash)", async () => {
        const r = await steam.steamGetTotalPlaytime();
        expect(typeof r).toBe("string");
        expect(r).toMatch(/is not set/i);
    });

    it("steam_owned_games: when ONLY SteamID is set, still says API key is required", async () => {
        process.env.STEAM_ID64 = "76561197960287930";
        const r = await steam.steamGetOwnedGames();
        expect(r).toMatch(/API key.*is not set/i);
    });
});

describe("Steam — rejects empty/missing input (every group)", () => {
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
        it(`${name}: empty input → returns ERROR, doesn't throw`, async () => {
            const r = await fn();
            expect(typeof r).toBe("string");
            expect(r).toMatch(/ERROR|required/i);
        });
    }
});

describe("Steam — functions return strings (never throw)", () => {
    // local/protocol work: should return a string even without network/Steam, never throw
    const safeCases: [string, () => Promise<string>][] = [
        ["steam_list", () => steam.steamListGames()],
        ["steam_list_running_games", () => steam.steamListRunningGames()],
        ["steam_game_running", () => steam.steamGameRunning()],
        ["steam_show_storage_usage", () => steam.steamShowStorageUsage()],
        ["steam_locate_installation(missing)", () => steam.steamLocateInstallation("zzz-yok-oyun-zzz")],
        ["steam_repeat_last_action(empty)", () => steam.steamRepeatLastAction()],
    ];
    for (const [name, fn] of safeCases) {
        it(`${name}: doesn't throw, returns a string`, async () => {
            await expect(fn()).resolves.toBeTypeOf("string");
        });
    }
});
