// Group C (storefront, no key required) LIVE smoke test — hits the real Steam API.
// SKIPs if there's no network (won't break CI). Goal: does the JSON shape we parse match reality?
const steam = require("../dist-electron/steam.js");

const tests = [
    ["steam_search_store('portal')", () => steam.steamSearchStore("portal")],
    ["steam_game_details('400')", () => steam.steamGetGameDetails("400")],            // Portal
    ["steam_game_price('Counter-Strike 2')", () => steam.steamGetGamePrice("Counter-Strike 2")],
    ["steam_discounted_games()", () => steam.steamGetDiscountedGames()],
    ["steam_game_news('730')", () => steam.steamGetGameNews("730")],                   // CS2
];

(async () => {
    // check if network is available
    let online = false;
    try {
        const r = await Promise.race([fetch("https://store.steampowered.com/api/storesearch/?term=a&cc=TR&l=turkish"), new Promise((_, x) => setTimeout(() => x(0), 8000))]);
        online = r.ok;
    } catch { online = false; }
    if (!online) {
        console.log("SKIP — Steam storefront unreachable (no network). Group C live test skipped.");
        process.exit(0);
    }

    let pass = 0, fail = 0;
    for (const [name, fn] of tests) {
        try {
            const res = await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r(new Error("timeout 20s")), 20000))]);
            const ok = typeof res === "string" && res.length > 0 && !res.startsWith("HATA") && !res.includes("başarısız") && !res.includes("alınamadı") && !res.includes("bulunamadı");
            console.log(`${ok ? "PASS" : "FAIL"} — ${name}`);
            console.log("   → " + String(res).split("\n").slice(0, 2).join(" | ").slice(0, 170));
            ok ? pass++ : fail++;
        } catch (e) {
            console.log(`FAIL — ${name}: ${e.message}`);
            fail++;
        }
    }
    console.log(`\n=== STOREFRONT (Group C) LIVE: ${pass} PASS / ${fail} FAIL ===`);
    process.exit(fail > 0 ? 1 : 0);
})();
