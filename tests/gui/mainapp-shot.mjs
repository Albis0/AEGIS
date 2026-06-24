// First-launch main app screenshot — to verify the "comes up red" complaint.
import {chromium} from "playwright-core";
import {fileURLToPath} from "url";
import {dirname, join} from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "..", "artifacts");

const stub = () => {
    window.jarvis = new Proxy({}, {
        get: (_t, p) => {
            if (p === "on") return () => () => {};
            if (p === "settingsGet") return async () => ({
                language: "tr", accentColor: "34,211,238", ttsRate: 1, uiFamily: "cyber",
                skin: "hologram", layout: "normal", font: "jetbrains", customCss: "",
                reactorStyle: "rings",
                telemetryWidgets: ["cpu","ram","disk"],
            });
            if (p === "weather") return async () => null;
            return async () => undefined;
        },
    });
};

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});
await page.addInitScript(stub);
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));
await page.goto("http://127.0.0.1:4399/");
await page.waitForTimeout(1500);
await page.screenshot({path: join(OUT, "mainapp-firstrun.png")});
console.log("errors:", JSON.stringify(errs, null, 2));
await browser.close();
