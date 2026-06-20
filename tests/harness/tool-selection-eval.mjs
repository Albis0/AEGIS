// ============================================================================
// Faz 55 — Tool-Seçim Eval Runner (skorlu)
//
// "Bu girdi için doğru tool seçildi mi?" sorusunu SAYIYLA ölçer. Mevcut convo
// harness smoke düzeyindeydi (geçti/kaldı, skor yok). Bu runner her çalıştırmada
// tool-seçim DOĞRULUK %'si üretir; eşik altında CI'ı uyarır (exit 1).
//
// Üç vaka türü (eval-cases.mjs):
//   offer    - beklenen tool, getAllToolSchemas teklif listesinde OLMALI
//   resolver - reference-resolver TAM bu tool+args'ı deterministik üretmeli
//   negative - bu girdi için resolver bir AKSİYON üretmemeli (saf sohbet)
//
// Çalıştır:  npm run test:eval     (tsc + bu dosya)
// Eşik:      EVAL_THRESHOLD env (varsayılan 90). Altına düşerse exit 1.
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

/** Tek vakayı değerlendir → {ok, reason}. */
function evalCase(c) {
  if (c.kind === "offer") {
    const offered = offeredNames(c.user);
    return offered.has(c.expect)
      ? {ok: true}
      : {ok: false, reason: `"${c.expect}" teklif edilmedi (LLM seçemezdi)`};
  }

  if (c.kind === "resolver") {
    stm.stmClear();
    for (const s of c.seed ?? []) stm.stmRecord(s.tool, JSON.stringify(s.args ?? {}), s.result ?? "OK", s.success !== false);
    const r = resolver.resolveReference(c.user);
    if (!r) return {ok: false, reason: "resolver null döndü (referans tanınmadı)"};
    if (r.kind !== "action") return {ok: false, reason: `resolver "${r.kind}" döndü, aksiyon bekleniyordu`};
    if (r.tool !== c.expect) return {ok: false, reason: `resolver "${r.tool}" üretti, beklenen "${c.expect}"`};
    if (c.args && JSON.stringify(r.args) !== JSON.stringify(c.args))
      return {ok: false, reason: `args ${JSON.stringify(r.args)}, beklenen ${JSON.stringify(c.args)}`};
    return {ok: true};
  }

  if (c.kind === "negative") {
    const r = resolver.resolveReference(c.user);
    // Saf sohbet: resolver ya null dönmeli ya da aksiyon ÜRETMEMELİ.
    if (r && r.kind === "action")
      return {ok: false, reason: `saf sohbette resolver aksiyon üretti: ${r.tool}`};
    return {ok: true};
  }

  return {ok: false, reason: `bilinmeyen vaka türü: ${c.kind}`};
}

function main() {
  console.log(`TOOL-SEÇİM EVAL  provider=${PROVIDER}  eşik=%${THRESHOLD}`);
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
    console.log("\nBAŞARISIZ VAKALAR:");
    for (const f of fails) {
      console.log(`  ✗ [${f.kind}] "${f.user}"  →  beklenen ${f.expect ?? "(yok)"}`);
      console.log(`      ${f.reason}`);
    }
  }

  console.log("\n" + "=".repeat(72));
  for (const [k, [p, t]] of Object.entries(byKind)) {
    if (t > 0) console.log(`  ${k.padEnd(9)} ${p}/${t}  (%${((p / t) * 100).toFixed(0)})`);
  }
  console.log("-".repeat(72));
  console.log(`  TOPLAM    ${passed}/${total}  →  tool-seçim doğruluk: %${acc.toFixed(1)}`);
  console.log("=".repeat(72));

  fs.writeFileSync(path.join(__dirname, "eval-report.json"),
    JSON.stringify({provider: PROVIDER, threshold: THRESHOLD, total, passed, accuracy: acc, byKind, fails}, null, 2));

  if (acc < THRESHOLD) {
    console.log(`\n⚠  DOĞRULUK EŞİĞİN ALTINDA (%${acc.toFixed(1)} < %${THRESHOLD}) — regresyon olabilir.`);
    process.exit(1);
  }
  console.log(`\n✓  Doğruluk eşiği karşılandı (%${acc.toFixed(1)} ≥ %${THRESHOLD}).`);
  process.exit(0);
}

main();
