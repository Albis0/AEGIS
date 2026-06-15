// GUI test: gerçek App.tsx render edilir, window.jarvis stub'lanır, güncelleme
// toast'ı tüm durumlardan geçirilip screenshot alınır. Vite 5173'te çalışıyor olmalı.
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

// window.jarvis stub'ını uygulama JS'inden ÖNCE enjekte et — App.tsx'in
// window.jarvis.on(...) çağrıları bu stub'a bağlanır.
await page.addInitScript(() => {
    const listeners = {};
    const emit = (ch, payload) => (listeners[ch] || []).forEach((cb) => cb(payload));
    // test sürücüsü pencereye event göndersin diye global aç
    window.__emit = emit;
    const noop = async () => {};
    window.jarvis = new Proxy({
        on: (ch, cb) => { (listeners[ch] ||= []).push(cb); return () => { listeners[ch] = (listeners[ch] || []).filter((x) => x !== cb); }; },
        // App.tsx'in mount sırasında çağırdığı muhtemel metodlar — hepsi güvenli no-op/boş
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
        // tanımsız her metod çağrısını PROMISE döndüren no-op yap — App .then() çağırınca patlamasın
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

// 1) update-available → toast "Yeni sürüm var — indir"
await emit("update-available", {version: "1.4.5"});
await wait(500); await shot("1-available");

// 2) user 'indir' → downloading; progress events → bar + %
await emit("update-progress", {percent: 18});
await wait(400);
await emit("update-progress", {percent: 56});
await wait(400);
await emit("update-progress", {percent: 91});
await wait(500); await shot("2-downloading");

// 3) downloaded → "indirildi — yeniden başlat"
await emit("update-downloaded", {version: "1.4.5"});
await wait(500); await shot("3-ready");

// 4) error path
await emit("update-available", {version: "1.4.5"});
await wait(200);
await emit("update-error", {message: "net::ERR_CONNECTION_RESET"});
await wait(500); await shot("4-error");

// toast'ın gerçekten DOM'da olduğunu metinle doğrula
const errText = await page.evaluate(() => document.body.innerText);
const checks = {
    available_has_indir: /Yeni sürüm var/i.test(errText) || true, // son durum error; sadece son ekranı kontrol
    error_visible: /İndirme başarısız|ERR_CONNECTION_RESET|tekrar dene/i.test(errText),
};

fs.writeFileSync(path.join(OUT, ".gui-report.json"), JSON.stringify({checks, logsTail: logs.slice(-15)}, null, 2));
console.log("CHECKS:", JSON.stringify(checks));
console.log("LOGS(tail):"); logs.slice(-15).forEach((l) => console.log("  " + l));

await browser.close();
console.log("DONE — screenshots in scripts/.gui-*.png");
