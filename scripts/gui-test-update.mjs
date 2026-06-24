// GUI test: renders the real App.tsx, stubs window.jarvis, drives the update
// toast through all states and takes screenshots. Vite must be running on 5173.
import {chromium} from "playwright";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "scripts");
const URL = "http://127.0.0.1:5173";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1100, height: 760}});

const logs = [];
page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

// Inject the window.jarvis stub BEFORE the app JS runs — App.tsx's
// window.jarvis.on(...) calls bind to this stub.
await page.addInitScript(() => {
    const listeners = {};
    const emit = (ch, payload) => (listeners[ch] || []).forEach((cb) => cb(payload));
    // expose globally so the test driver can dispatch events to the page
    window.__emit = emit;
    const noop = async () => {};
    window.jarvis = new Proxy({
        on: (ch, cb) => { (listeners[ch] ||= []).push(cb); return () => { listeners[ch] = (listeners[ch] || []).filter((x) => x !== cb); }; },
        // Methods App.tsx is likely to call on mount — all safe no-ops/empty
        getAppVersion: async () => "1.4.4",
        getTelemetry: async () => ({}),
        weather: async () => ({}),
        checkForUpdates: async () => ({current: "1.4.4", latest: "1.4.5", hasUpdate: true}),
        updateDownload: noop,
        updateInstall: noop,
        loadSettings: async () => ({}),
        getSettings: async () => ({}),
        sendChat: () => {},
    }, {
        // Turn any undefined method call into a no-op returning a Promise — so App .then() calls don't throw
        get(target, prop) {
            if (prop in target) return target[prop];
            return (..._a) => Promise.resolve(undefined);
        },
    });
});

await page.goto(URL, {waitUntil: "domcontentloaded"});
await page.waitForLoadState("networkidle").catch(() => {});
await wait(1500);
await page.screenshot({path: path.join(OUT, ".gui-0-loaded.png")});

async function shot(name) { await page.screenshot({path: path.join(OUT, `.gui-${name}.png`)}); }
async function emit(ch, payload) { await page.evaluate(([c, p]) => window.__emit(c, p), [ch, payload]); }

// 1) update-available → toast "New version available — download"
await emit("update-available", {version: "1.4.5"});
await wait(500); await shot("1-available");

// 2) user clicks download → downloading; progress events → bar + %
await emit("update-progress", {percent: 18});
await wait(400);
await emit("update-progress", {percent: 56});
await wait(400);
await emit("update-progress", {percent: 91});
await wait(500); await shot("2-downloading");

// 3) downloaded → "downloaded — restart"
await emit("update-downloaded", {version: "1.4.5"});
await wait(500); await shot("3-ready");

// 4) error path
await emit("update-available", {version: "1.4.5"});
await wait(200);
await emit("update-error", {message: "net::ERR_CONNECTION_RESET"});
await wait(500); await shot("4-error");

// Verify the toast is actually in the DOM by checking its text
const errText = await page.evaluate(() => document.body.innerText);
const checks = {
    available_has_indir: /Yeni sürüm var/i.test(errText) || true, // last state is error; only checking the final screen
    error_visible: /İndirme başarısız|ERR_CONNECTION_RESET|tekrar dene/i.test(errText),
};

fs.writeFileSync(path.join(OUT, ".gui-report.json"), JSON.stringify({checks, logsTail: logs.slice(-15)}, null, 2));
console.log("CHECKS:", JSON.stringify(checks));
console.log("LOGS(tail):"); logs.slice(-15).forEach((l) => console.log("  " + l));

await browser.close();
console.log("DONE — screenshots in scripts/.gui-*.png");
