// ============================================================================
// Phase 55 — Tool-Selection Eval Runner (scored)
//
// Measures "was the correct tool selected for this input?" NUMERICALLY. The
// existing convo harness was smoke-level (pass/fail, no score). This runner
// produces a tool-selection ACCURACY % on every run; warns CI below threshold
// (exit 1).
//
// Three case kinds (eval-cases.mjs):
//   offer    - expected tool MUST be in the getAllToolSchemas offer list
//   resolver - reference-resolver MUST deterministically produce exactly this tool+args
//   negative - resolver must NOT produce an ACTION for this input (pure chat)
//
// Run:        npm run test:eval     (tsc + this file)
// Threshold:  EVAL_THRESHOLD env (default 90). Falls below it → exit 1.
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
import {EVAL_CASES} from "./eval-cases.mjs";

const PROVIDER = process.env.HARNESS_PROVIDER || "groq";
const THRESHOLD = Number(process.env.EVAL_THRESHOLD || 90);

function offeredNames(message) {
  return new Set(tools.getAllToolSchemas(PROVIDER, message).map((t) => t.function.name));
}

/** Evaluate a single case → {ok, reason}. */
function evalCase(c) {
  if (c.kind === "offer") {
    const offered = offeredNames(c.user);
    return offered.has(c.expect)
      ? {ok: true}
      : {ok: false, reason: `"${c.expect}" was not offered (LLM could not select it)`};
  }

  if (c.kind === "resolver") {
    stm.stmClear();
    for (const s of c.seed ?? []) stm.stmRecord(s.tool, JSON.stringify(s.args ?? {}), s.result ?? "OK", s.success !== false);
    const r = resolver.resolveReference(c.user);
    if (!r) return {ok: false, reason: "resolver returned null (reference not recognized)"};
    if (r.kind !== "action") return {ok: false, reason: `resolver returned "${r.kind}", expected an action`};
    if (r.tool !== c.expect) return {ok: false, reason: `resolver produced "${r.tool}", expected "${c.expect}"`};
    if (c.args && JSON.stringify(r.args) !== JSON.stringify(c.args))
      return {ok: false, reason: `args ${JSON.stringify(r.args)}, expected ${JSON.stringify(c.args)}`};
    return {ok: true};
  }

  if (c.kind === "negative") {
    const r = resolver.resolveReference(c.user);
    // Pure chat: resolver must either return null or NOT produce an action.
    if (r && r.kind === "action")
      return {ok: false, reason: `resolver produced an action on pure chat input: ${r.tool}`};
    return {ok: true};
  }

  return {ok: false, reason: `unknown case kind: ${c.kind}`};
}

function main() {
  console.log(`TOOL-SELECTION EVAL  provider=${PROVIDER}  threshold=%${THRESHOLD}`);
  console.log("=".repeat(72));

  const byKind = {offer: [0, 0], resolver: [0, 0], negative: [0, 0]};
  const fails = [];

  for (const c of EVAL_CASES) {
    const {ok, reason} = evalCase(c);
    byKind[c.kind][1]++;
    if (ok) byKind[c.kind][0]++;
    else fails.push({user: c.user, kind: c.kind, expect: c.expect, reason});
  }

  const total = EVAL_CASES.length;
  const passed = total - fails.length;
  const acc = (passed / total) * 100;

  if (fails.length) {
    console.log("\nFAILED CASES:");
    for (const f of fails) {
      console.log(`  ✗ [${f.kind}] "${f.user}"  →  expected ${f.expect ?? "(none)"}`);
      console.log(`      ${f.reason}`);
    }
  }

  console.log("\n" + "=".repeat(72));
  for (const [k, [p, t]] of Object.entries(byKind)) {
    if (t > 0) console.log(`  ${k.padEnd(9)} ${p}/${t}  (%${((p / t) * 100).toFixed(0)})`);
  }
  console.log("-".repeat(72));
  console.log(`  TOTAL     ${passed}/${total}  →  tool-selection accuracy: %${acc.toFixed(1)}`);
  console.log("=".repeat(72));

  fs.writeFileSync(path.join(__dirname, "eval-report.json"),
    JSON.stringify({provider: PROVIDER, threshold: THRESHOLD, total, passed, accuracy: acc, byKind, fails}, null, 2));

  if (acc < THRESHOLD) {
    console.log(`\n⚠  BELOW ACCURACY THRESHOLD (%${acc.toFixed(1)} < %${THRESHOLD}) — possible regression.`);
    process.exit(1);
  }
  console.log(`\n✓  Accuracy threshold met (%${acc.toFixed(1)} ≥ %${THRESHOLD}).`);
  process.exit(0);
}

main();
