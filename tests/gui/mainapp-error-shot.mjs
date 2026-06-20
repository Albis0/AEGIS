// state="error" görünümü — HUD ne kadar kırmızıya dönüyor?
import {chromium} from "playwright-core";
import {fileURLToPath} from "url";
import {dirname, join} from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "..", "artifacts");

let errHandler;
const stub = () => {
    window.__fire = {};
    window.jarvis = new Proxy({}, {
        get: (_t, p) => {
            if (p === "on") return (ev, cb) => { window.__fire[ev] = cb; return () => {}; };
            if (p === "settingsGet") return async () => ({
                language: "tr", accentColor: "34,211,238", ttsRate: 1, uiFamily: "cyber",
                skin: "hologram", layout: "normal", font: "jetbrains", customCss: "", reactorStyle: "rings",
                telemetryWidgets: ["cpu","ram","disk"],
            });
            if (p === "weather") return async () => null;
            if (p === "sendChat") return (_hist, reqId) => {
                setTimeout(() => window.__fire["chat-error"]?.({reqId, message: "API key geçersiz"}), 50);
            };
            return async () => undefined;
        },
    });
};

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});
await page.addInitScript(stub);
await page.goto("http://127.0.0.1:4399/");
await page.waitForTimeout(1200);
// input'a yaz ve gönder → reqId iç ref, ama biz chat-error'u reqId eşleşmeden tetikliyoruz.
// Bunun yerine doğrudan input+enter ile gerçek akışı kullan:
await page.fill("input", "merhaba");
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
await page.screenshot({path: join(OUT, "mainapp-error.png")});
await browser.close();
console.log("done");
