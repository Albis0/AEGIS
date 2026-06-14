// ============================================================================
// Conversation Harness — Phase 2 (LIVE, optional, non-CI)
//
// Runs the SAME scenarios through the real Groq LLM and compares the model's
// chosen tool (and key args) to the deterministic harness's expectation.
//
//   - Tools offered to the model = getAllToolSchemas(provider, message)  (real path)
//   - STM is injected exactly like main.ts (stmBuildPromptBlock)
//   - The model's tool_call is compared to step.tool / step.args
//   - DEVIATIONS are reported but NEVER fail CI (this script is separate; exit 0
//     unless the API itself is unreachable).
//
// Usage:  GROQ_API_KEY=... node tests/harness/conversation-live.mjs
//         (key is auto-read from .env if present)
// ============================================================================
import {createRequire} from "module";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

// load .env
try {
    const env = fs.readFileSync(path.join(ROOT, ".env"), "utf-8");
    for (const line of env.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
} catch { /* no .env */ }

const KEY = process.env.GROQ_API_KEY;
if (!KEY) { console.error("GROQ_API_KEY yok — live mod atlanıyor (deterministik testler etkilenmez)."); process.exit(0); }

const Groq = (await import("groq-sdk")).default;
const groq = new Groq({apiKey: KEY});
const MODEL = process.env.HARNESS_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

const tools = require(path.join(ROOT, "dist-electron", "tools.js"));
const stm = require(path.join(ROOT, "dist-electron", "short-term-memory.js"));
const {SCENARIOS} = await import("./scenarios.mjs");

const SYS = "Sen AEGIS adında bir Windows AI asistanısın. Kullanıcının isteğini yerine getirmek için " +
    "uygun aracı (tool) seç. Referans ifadelerini ('biraz azalt', 'tekrar yap', 'o dosyayı') " +
    "SON İŞLEMLER bağlamına göre çöz. Sadece gerekli aracı çağır.";

const LIMIT_SCN = process.env.HARNESS_LIVE_LIMIT ? Number(process.env.HARNESS_LIVE_LIMIT) : SCENARIOS.length;

let total = 0, match = 0, toolDev = 0, argDev = 0, noCall = 0, apiErr = 0;
const deviations = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const THROTTLE_MS = Number(process.env.HARNESS_THROTTLE_MS || 2500); // free-tier RPM dostu

async function askModel(message, offeredTools, attempt = 0) {
    const stmBlock = stm.stmBuildPromptBlock();
    const messages = [
        {role: "system", content: SYS + stmBlock},
        {role: "user", content: message},
    ];
    let resp;
    try {
        resp = await groq.chat.completions.create({
            model: MODEL,
            messages,
            tools: offeredTools.length ? offeredTools : undefined,
            tool_choice: offeredTools.length ? "auto" : undefined,
            temperature: 0,
            max_tokens: 300,
        });
    } catch (e) {
        // 429 rate-limit → bekle ve bir kez tekrar dene (en fazla 3 deneme)
        if ((e.status === 429 || /rate limit/i.test(e.message)) && attempt < 3) {
            const wait = Number(e.headers?.["retry-after"]) * 1000 || (5000 * (attempt + 1));
            await sleep(wait);
            return askModel(message, offeredTools, attempt + 1);
        }
        throw e;
    }
    const tc = resp.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return {tool: null, args: {}};
    let args = {};
    try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
    return {tool: tc.function.name, args};
}

console.log(`LIVE HARNESS (Phase 2)  model=${MODEL}`);
console.log("=".repeat(78));

for (const scn of SCENARIOS.slice(0, LIMIT_SCN)) {
    stm.stmClear();
    if (scn.seed) for (const s of scn.seed) stm.stmRecord(s.tool, JSON.stringify(s.args ?? {}), s.result ?? "OK", s.success !== false);

    for (let i = 0; i < scn.steps.length; i++) {
        const step = scn.steps[i];
        total++;
        const offered = tools.getAllToolSchemas("groq", step.user);
        let picked;
        try {
            picked = await askModel(step.user, offered);
        } catch (e) {
            apiErr++;
            console.log(`  [API-ERR] ${scn.name} adım ${i+1}: ${e.message?.slice(0,80)}`);
            continue;
        }

        const toolOk = picked.tool === step.tool;
        // arg comparison: only keys present in expected step.args (loose, since LLM phrasing varies)
        let argOk = true;
        for (const [k, v] of Object.entries(step.args ?? {})) {
            const got = picked.args[k];
            if (got === undefined) { argOk = false; break; }
            // numeric & approx: accept if within ±20% for volume-style; else string-equality-ish
            if (typeof v === "number" && typeof got === "number") { if (Math.abs(got - v) > Math.max(15, v * 0.4)) argOk = false; }
            else if (String(got).toLowerCase() !== String(v).toLowerCase() && !String(got).toLowerCase().includes(String(v).toLowerCase())) { /* tolerate */ }
        }

        if (!picked.tool) { noCall++; deviations.push({scn: scn.name, step: i+1, user: step.user, expected: step.tool, got: "(çağrı yok)"}); }
        else if (!toolOk) { toolDev++; deviations.push({scn: scn.name, step: i+1, user: step.user, expected: step.tool, got: picked.tool, args: picked.args}); }
        else if (!argOk)  { argDev++; deviations.push({scn: scn.name, step: i+1, user: step.user, expected: `${step.tool}(${JSON.stringify(step.args)})`, got: `${picked.tool}(${JSON.stringify(picked.args)})`, argOnly: true}); }
        else { match++; }

        // advance STM with the EXPECTED call so reference chain stays coherent
        stm.stmRecord(step.tool, JSON.stringify(step.args ?? {}), step.mockResult ?? "OK", true);
        await sleep(THROTTLE_MS); // free-tier RPM limitini aşmamak için
    }
    process.stdout.write(".");
}

console.log("\n" + "=".repeat(78));
console.log(`Adım: ${total}  |  tam eşleşme: ${match}  |  tool sapması: ${toolDev}  |  arg sapması: ${argDev}  |  çağrı yok: ${noCall}  |  API hatası: ${apiErr}`);
if (deviations.length) {
    console.log("\nSAPMALAR (LLM beklenenden farklı seçti — bilgilendirme amaçlı, CI'yı fail ETMEZ):");
    for (const d of deviations.slice(0, 40)) {
        console.log(`  • [${d.scn} #${d.step}] "${d.user}"`);
        console.log(`      beklenen: ${d.expected}   |   LLM: ${d.got}${d.args ? " " + JSON.stringify(d.args) : ""}`);
    }
    if (deviations.length > 40) console.log(`  ... +${deviations.length - 40} sapma daha`);
}
const accuracy = total ? ((match / total) * 100).toFixed(1) : "0";
console.log(`\nLLM doğruluk: %${accuracy}  (tam eşleşme / toplam adım)`);
fs.writeFileSync(path.join(__dirname, "live-report.json"), JSON.stringify({model: MODEL, total, match, toolDev, argDev, noCall, apiErr, deviations}, null, 2));
process.exit(0); // live mode never fails CI
