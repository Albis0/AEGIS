// One-off visual check: screenshots of the onboarding screens.
// window.jarvis is stubbed (no preload). vite preview :4399 must be running.
import {chromium} from "playwright-core";
import {fileURLToPath} from "url";
import {dirname, join} from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "..", "artifacts");
import {mkdirSync} from "fs";
mkdirSync(OUT, {recursive: true});

const stub = () => {
    const noop = async () => {};
    window.jarvis = new Proxy({}, {
        get: (_t, p) => {
            if (p === "on") return () => () => {};
            if (p === "settingsGet") return async () => ({language: "tr", accentColor: "34,211,238"});
            if (p === "authSignUp" || p === "authSignIn") return async () => ({ok: false, error: "demo"});
            return async () => undefined;
        },
    });
};

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 480, height: 720}, deviceScaleFactor: 2});
await page.addInitScript(stub);

async function shot(name) {
    await page.waitForTimeout(650);
    await page.screenshot({path: join(OUT, `onb-${name}.png`)});
    console.log("shot:", name);
}

await page.goto("http://127.0.0.1:4399/?setup=1");
await shot("1-lang");

// select language → mode
await page.getByText("Türkçe").click();
await shot("2-mode");

// advanced setup → setup
await page.getByText("Gelişmiş Kurulum").click();
await shot("3-setup");
// expand advanced accordion
await page.getByText("Gelişmiş (opsiyonel)").click();
await shot("4-setup-expanded");

await browser.close();
console.log("done");
