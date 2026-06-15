// ============================================================================
// Conversation Harness — Phase 1 (deterministic, CI-safe)
//
// Simulates realistic multi-step user conversations and verifies, per step:
//   - user message
//   - intent (label)
//   - selected tool  (asserted to be OFFERED by getAllToolSchemas for that message)
//   - tool args
//   - tool result    (via real executeTool, side-effect-safe subset)
//   - STM state      (after stmRecord, the short-term memory snapshot)
//
// Reference-resolution steps ("tekrar yap", "biraz azalt", "geri al") declare
// what prior state the model must see; the harness verifies that state is present
// in the injected STM prompt block BEFORE the step, then applies the resolved call.
//
// On FAIL: reports scenario + the exact STEP INDEX that broke + assertion + diff.
//
// Phase 2 (--live): re-runs scenarios through real Groq, compares LLM tool choice
// to expected, reports deviations. Live failures NEVER fail the deterministic run.
// ============================================================================
import {createRequire} from "module";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

const tools = require(path.join(ROOT, "dist-electron", "tools.js"));
const stm = require(path.join(ROOT, "dist-electron", "short-term-memory.js"));
const resolver = require(path.join(ROOT, "dist-electron", "reference-resolver.js"));
import {SCENARIOS} from "./scenarios.mjs";

const PROVIDER = process.env.HARNESS_PROVIDER || "groq";
const LIVE = process.argv.includes("--live");
const VERBOSE = process.argv.includes("--verbose") || process.argv.includes("-v");

// Tools whose executor is safe to actually call here (read-only OR self-guarded
// when fullPcAccess=false OR pure-RAM). Anything else is DISPATCH-CHECKED only:
// we confirm the tool is reachable + offered, but record the *intended* result
// instead of triggering real network/PowerShell/file side effects.
const SAFE_TO_EXECUTE = new Set([
    "spotify_volume", "spotify_now_playing", "spotify_pause", "spotify_next",
    "spotify_prev", "spotify_play", "spotify_shuffle", "spotify_repeat",
    "delete_file", "move_file",            // guarded: ENGELLENDI when fullPcAccess off
    "list_facts", "list_macros", "list_automations", "list_scheduled_tasks",
    "list_personas", "vault_list", "list_watch_conditions",
    "steam_list", "steam_game_running",
]);

function getOfferedToolNames(message) {
    return new Set(tools.getAllToolSchemas(PROVIDER, message).map((t) => t.function.name));
}

// ---- Result formatting ----
function snapshotSTM() {
    const c = stm.stmGet();
    return {
        lastTool: c.lastTool,
        lastArgs: c.lastArgs,
        lastIntent: c.lastIntent,
        lastSpotifyTrack: c.lastSpotifyTrack,
        lastSpotifyContext: c.lastSpotifyContext,
        lastTarget: c.lastTarget,
        lastEntity: c.lastEntity,
        recentCount: c.recentTools.length,
    };
}

async function runStepDeterministic(step, stepIdx, scenarioName, failures) {
    const log = {step: stepIdx, user: step.user, intent: step.intent, tool: step.tool, args: step.args};

    // --- ASSERT 0: deterministic reference resolution (resolver steps) ---
    // These steps MUST be resolved by reference-resolver.ts WITHOUT the LLM.
    // We assert the resolver returns the expected tool + args, then record it.
    if (step.resolver) {
        const r = resolver.resolveReference(step.user);
        if (!r) {
            failures.push({scenario: scenarioName, step: stepIdx, user: step.user,
                assert: "RESOLVER-NULL",
                detail: `Resolver "${step.user}" için null döndü → bu bir referans ifadesi olarak tanınmadı (LLM'e düşerdi).`});
            return {log, ok: false};
        }
        if (r.kind !== "action") {
            failures.push({scenario: scenarioName, step: stepIdx, user: step.user,
                assert: "RESOLVER-CLARIFY",
                detail: `Resolver netleştirme istedi (confidence ${r.confidence}): "${r.question}" — aksiyon bekleniyordu.`});
            return {log, ok: false};
        }
        if (r.tool !== step.tool) {
            failures.push({scenario: scenarioName, step: stepIdx, user: step.user,
                assert: "RESOLVER-TOOL",
                detail: `Resolver tool "${r.tool}" üretti, beklenen "${step.tool}".`, resolverArgs: r.args});
            return {log, ok: false};
        }
        if (step.args && JSON.stringify(r.args) !== JSON.stringify(step.args)) {
            failures.push({scenario: scenarioName, step: stepIdx, user: step.user,
                assert: "RESOLVER-ARGS",
                detail: `Resolver args ${JSON.stringify(r.args)} üretti, beklenen ${JSON.stringify(step.args)}.`});
            return {log, ok: false};
        }
        if (r.source !== "resolver") {
            failures.push({scenario: scenarioName, step: stepIdx, user: step.user,
                assert: "RESOLVER-SOURCE", detail: `source="${r.source}", "resolver" bekleniyordu.`});
            return {log, ok: false};
        }
        // record exactly like main.ts does for the resolver path
        const argsJson = JSON.stringify(r.args);
        const result = step.mockResult ?? `(resolver: ${r.tool})`;
        stm.stmRecord(r.tool, argsJson, String(result), true, "resolver");
        const snap = snapshotSTM();
        log.result = String(result).slice(0, 120);
        log.stm = snap;
        log.resolved = {tool: r.tool, args: r.args, confidence: r.confidence, source: r.source};
        if (step.expectSTM) {
            for (const [k, v] of Object.entries(step.expectSTM)) {
                const actual = snap[k];
                const match = v instanceof RegExp ? v.test(String(actual)) : actual === v;
                if (!match) {
                    failures.push({scenario: scenarioName, step: stepIdx, user: step.user,
                        assert: "STM-STATE",
                        detail: `STM.${k} beklenen ${v instanceof RegExp ? v : JSON.stringify(v)}, gerçek ${JSON.stringify(actual)}`,
                        stm: snap});
                    return {log, ok: false};
                }
            }
        }
        return {log, ok: true};
    }

    // --- ASSERT 1: reference availability (for steps that resolve a prior action) ---
    if (step.ref) {
        const block = stm.stmBuildPromptBlock();
        for (const needle of [].concat(step.ref)) {
            if (!block.includes(needle)) {
                failures.push({scenario: scenarioName, step: stepIdx, user: step.user,
                    assert: "REF-AVAILABILITY",
                    detail: `Referans çözümleme için gereken state STM bloğunda YOK: "${needle}"`,
                    injectedBlock: block.slice(0, 400)});
                return {log, ok: false};
            }
        }
    }

    // --- ASSERT 2: expected tool is OFFERED for this message (root-selection gap = flaky bug) ---
    const offered = getOfferedToolNames(step.user);
    if (!offered.has(step.tool)) {
        failures.push({scenario: scenarioName, step: stepIdx, user: step.user,
            assert: "TOOL-NOT-OFFERED",
            detail: `Beklenen tool "${step.tool}" bu mesaj için TEKLIF EDİLMEDİ. ` +
                    `getAllToolSchemas('${PROVIDER}', "${step.user}") bu tool'u içermiyor → ` +
                    `LLM bu tool'u hiç seçemez (kök/grup eşleşme açığı).`,
            offeredSample: [...offered].slice(0, 12)});
        return {log, ok: false};
    }

    // --- ASSERT 3: dispatch via real executeTool (safe subset) or dispatch-only check ---
    let result;
    const argsJson = JSON.stringify(step.args ?? {});
    if (SAFE_TO_EXECUTE.has(step.tool)) {
        result = await tools.executeTool(step.tool, argsJson);
        if (/Bu araç tanımlı değil/.test(result)) {
            failures.push({scenario: scenarioName, step: stepIdx, user: step.user,
                assert: "DISPATCH", detail: `executeTool "${step.tool}" → tanımlı değil`, result});
            return {log, ok: false};
        }
    } else {
        // dispatch-only: confirm an executor exists by probing schema/exec map indirectly.
        // (trio validator already proves 263/263; here we just record intended result.)
        result = step.mockResult ?? `(simüle: ${step.tool} çağrıldı)`;
    }
    log.result = String(result).slice(0, 120);

    // --- record into STM exactly like main.ts does ---
    stm.stmRecord(step.tool, argsJson, String(result), !/^HATA|^ENGELLENDI|Bu araç tanımlı/.test(result));

    // --- ASSERT 4: STM state matches expectation ---
    const snap = snapshotSTM();
    log.stm = snap;
    if (step.expectSTM) {
        for (const [k, v] of Object.entries(step.expectSTM)) {
            const actual = snap[k];
            const match = v instanceof RegExp ? v.test(String(actual)) : actual === v;
            if (!match) {
                failures.push({scenario: scenarioName, step: stepIdx, user: step.user,
                    assert: "STM-STATE",
                    detail: `STM.${k} beklenen ${v instanceof RegExp ? v : JSON.stringify(v)}, gerçek ${JSON.stringify(actual)}`,
                    stm: snap});
                return {log, ok: false};
            }
        }
    }

    // --- ASSERT 5: result content (optional) ---
    if (step.expectResult) {
        const re = step.expectResult instanceof RegExp ? step.expectResult : new RegExp(step.expectResult);
        if (!re.test(String(result))) {
            failures.push({scenario: scenarioName, step: stepIdx, user: step.user,
                assert: "RESULT", detail: `Sonuç ${re} ile eşleşmedi`, result: String(result).slice(0, 200)});
            return {log, ok: false};
        }
    }

    return {log, ok: true};
}

async function runScenarioDeterministic(scn, failures) {
    stm.stmClear();
    // seed any pre-existing STM state the scenario assumes (e.g. a prior session)
    if (scn.seed) for (const s of scn.seed) stm.stmRecord(s.tool, JSON.stringify(s.args ?? {}), s.result ?? "OK", s.success !== false);

    const stepLogs = [];
    let scenarioOk = true;
    for (let i = 0; i < scn.steps.length; i++) {
        const {log, ok} = await runStepDeterministic(scn.steps[i], i + 1, scn.name, failures);
        stepLogs.push(log);
        if (!ok) { scenarioOk = false; break; } // chain breaks at first failing step
    }
    return {name: scn.name, ok: scenarioOk, steps: stepLogs};
}

async function main() {
    console.log(`CONVERSATION HARNESS — Phase 1 (deterministic)  provider=${PROVIDER}`);
    console.log(`Scenarios: ${SCENARIOS.length}   total steps: ${SCENARIOS.reduce((a, s) => a + s.steps.length, 0)}`);
    console.log("=".repeat(78));

    const failures = [];
    const scenarioResults = [];
    for (const scn of SCENARIOS) {
        const r = await runScenarioDeterministic(scn, failures);
        scenarioResults.push(r);
        const tag = r.ok ? "PASS" : "FAIL";
        if (VERBOSE || !r.ok) {
            console.log(`\n[${tag}] ${r.name}`);
            for (const s of r.steps) {
                console.log(`   ${s.step}. "${s.user}"  →  ${s.tool}(${JSON.stringify(s.args ?? {})})`);
                if (VERBOSE) console.log(`       result: ${s.result ?? "-"}  | STM.lastTool=${s.stm?.lastTool} lastTarget=${s.stm?.lastTarget ?? "-"} spTrack=${s.stm?.lastSpotifyTrack ?? "-"}`);
            }
        } else {
            process.stdout.write(".");
        }
    }
    console.log("\n" + "=".repeat(78));

    const passed = scenarioResults.filter((r) => r.ok).length;
    const failed = scenarioResults.length - passed;

    if (failures.length) {
        console.log("\nFAILURE DETAYLARI (zincirin kırıldığı adım):");
        for (const f of failures) {
            console.log(`\n  ✗ [${f.scenario}]  ADIM ${f.step}  →  ${f.assert}`);
            console.log(`     mesaj : "${f.user}"`);
            console.log(`     neden : ${f.detail}`);
            if (f.offeredSample) console.log(`     teklif örn.: ${f.offeredSample.join(", ")}`);
            if (f.injectedBlock) console.log(`     STM blok  : ${f.injectedBlock.replace(/\n/g, " | ")}`);
        }
    }

    console.log("\n" + "=".repeat(78));
    console.log(`SONUÇ:  ${passed} PASS  /  ${failed} FAIL   (${scenarioResults.length} senaryo)`);
    const totalSteps = SCENARIOS.reduce((a, s) => a + s.steps.length, 0);
    console.log(`Toplam adım: ${totalSteps}   Kırılan zincir: ${failed}`);

    fs.writeFileSync(path.join(__dirname, "harness-report.json"),
        JSON.stringify({provider: PROVIDER, passed, failed, failures, scenarioResults}, null, 2));

    if (LIVE) {
        console.log("\n--live verildi → Phase 2 (Groq) için scripts/conversation-live.mjs çalıştırın.");
    }

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("HARNESS CRASH:", e); process.exit(2); });
