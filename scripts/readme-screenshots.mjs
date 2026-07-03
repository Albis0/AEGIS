// Captures README screenshots: renders the real App.tsx against a stubbed
// window.jarvis (same pattern as gui-test-update.mjs) and shoots a few skins.
// Vite must be running on 5173 (bun run dev:vite).
//
// Usage: node scripts/readme-screenshots.mjs → assets/screenshots/*.png
//
// Capture quirks (found the hard way):
//  - animations: "disabled" is REQUIRED — with the infinite reactor CSS
//    animations running, Chromium's full-page capture composites black.
//  - an ELEMENT screenshot taken first forces the compositor to rasterize the
//    layer tree; without it the full capture can still come out black.

import {chromium} from "playwright";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "assets", "screenshots");
fs.mkdirSync(OUT, {recursive: true});
const URL = "http://127.0.0.1:5173";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SHOTS = [
    {name: "hologram", settings: {skin: "hologram", uiFamily: "cyber", accentColor: "34,211,238", language: "en"}},
    {name: "dashboard", settings: {skin: "dashboard", uiFamily: "cyber", accentColor: "192,132,252", language: "en"}},
    {name: "terminal", settings: {skin: "terminal", uiFamily: "cyber", accentColor: "74,222,128", language: "en"}},
];

const browser = await chromium.launch({headless: true});

for (const {name, settings} of SHOTS) {
    const page = await browser.newPage({viewport: {width: 1440, height: 860}});
    await page.addInitScript((cfg) => {
        const listeners = {};
        window.jarvis = new Proxy({
            on: (ch, cb) => { (listeners[ch] ||= []).push(cb); return () => {}; },
            settingsGet: async () => ({ttsRate: 1, font: "jetbrains", layout: "normal", customCss: "", ...cfg}),
            getAppVersion: async () => "0.7.2",
            sendChat: () => {},
        }, {
            get(t, p) { return p in t ? t[p] : (..._a) => Promise.resolve(undefined); },
        });
    }, settings);
    await page.goto(URL, {waitUntil: "domcontentloaded"});
    await wait(3000);
    const el = await page.$(".drag");
    if (el) await el.screenshot(); // rasterization kick, result discarded
    await page.screenshot({path: path.join(OUT, `${name}.png`), animations: "disabled"});
    console.log(`shot: assets/screenshots/${name}.png`);
    await page.close();
}

await browser.close();
console.log("done");
