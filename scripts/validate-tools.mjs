// Static analyzer for the tool trio: schema (function name + params) ↔ executor.
// Parses the COMPILED dist-electron/tools.js (flat, regular) for ground-truth.
// Recompile (npx tsc -p tsconfig.electron.json) before running so source==compiled.
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(__dirname, "..", "dist-electron", "tools.js");
const src = fs.readFileSync(JS, "utf-8");

// ---------- Extract schemas: every `function: { name: "x", description, parameters }` ----------
const schemas = [];
const fnRe = /function:\s*\{/g;
let m;
while ((m = fnRe.exec(src))) {
    // matching brace for this function object
    let d = 0, j = m.index + m[0].length - 1, end = -1;
    for (; j < src.length; j++) {
        const c = src[j];
        if (c === "{") d++;
        else if (c === "}") { d--; if (d === 0) { end = j; break; } }
    }
    const body = src.slice(m.index, end + 1);
    const nameM = body.match(/name:\s*"([a-zA-Z0-9_]+)"/);
    if (!nameM) continue;
    const name = nameM[1];

    // properties keys (top level inside `properties: { ... }`)
    const props = [];
    const pIdx = body.indexOf("properties:");
    let hasParams = body.includes("parameters:");
    if (pIdx >= 0) {
        const braceStart = body.indexOf("{", pIdx);
        let pd = 0, pj = braceStart, pend = -1;
        for (; pj < body.length; pj++) {
            const c = body[pj];
            if (c === "{") pd++;
            else if (c === "}") { pd--; if (pd === 0) { pend = pj; break; } }
        }
        const propsBody = body.slice(braceStart + 1, pend);
        let depth = 0;
        const tokRe = /([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\{|\{|\}/g;
        let t;
        while ((t = tokRe.exec(propsBody))) {
            if (t[0] === "{") depth++;
            else if (t[0] === "}") depth--;
            else { if (depth === 0) props.push(t[1]); depth++; }
        }
    }
    let required = [];
    const reqM = body.match(/required:\s*\[([^\]]*)\]/);
    if (reqM) required = reqM[1].split(",").map(s => s.trim().replace(/["']/g, "")).filter(Boolean);

    schemas.push({name, props, required, hasParams});
}

// ---------- Extract executors: method names + destructured params in `const executors = {` ----------
// The executors object spans from `const executors = {` up to the start of the
// `executeTool` function (which immediately follows it). Brace-matching the object
// is unreliable because executor bodies contain template literals whose inner `}`
// (e.g. `${log.join("\n")}`) would close the object early. Bounding by the next
// top-level declaration is robust to that.
const execMarker = "const executors = {";
const execStart = src.indexOf(execMarker);
const execStopRe = /\nasync function executeTool\b|\nexport async function executeTool\b|\nfunction executeTool\b/;
const execStopMatch = execStopRe.exec(src.slice(execStart));
const execEnd = execStopMatch ? execStart + execStopMatch.index : src.length;
const execBlock = src.slice(execStart, execEnd);

const executors = [];
const execRe = /async\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g;
let em;
while ((em = execRe.exec(execBlock))) {
    const name = em[1];
    const sig = em[2].trim();
    let destructured = [], takesArgsObject = false;
    const dm = sig.match(/^\{([^}]*)\}/);
    if (dm) destructured = dm[1].split(",").map(s => s.trim().split(":")[0].trim().replace(/\s*=.*/, "")).filter(Boolean);
    else if (sig && /args/.test(sig)) takesArgsObject = true;
    executors.push({name, destructured, takesArgsObject, raw: sig});
}

const schemaNames = new Set(schemas.map(s => s.name));
const execNames = new Set(executors.map(e => e.name));
const execByName = Object.fromEntries(executors.map(e => [e.name, e]));

const fails = [], warns = [];

for (const s of schemas) if (!execNames.has(s.name)) fails.push(`[NO-EXECUTOR] schema "${s.name}" has no executor`);
for (const e of executors) if (!schemaNames.has(e.name)) fails.push(`[NO-SCHEMA] executor "${e.name}" has no schema`);

for (const s of schemas) {
    const e = execByName[s.name];
    if (!e || e.takesArgsObject) continue;
    for (const req of s.required)
        if (!e.destructured.includes(req))
            fails.push(`[PARAM-MISMATCH] "${s.name}": required "${req}" not destructured (gets [${e.destructured.join(", ")}])`);
}

const seenS = new Set();
for (const s of schemas) { if (seenS.has(s.name)) fails.push(`[DUP-SCHEMA] "${s.name}"`); seenS.add(s.name); }
const seenE = new Set();
for (const e of executors) { if (seenE.has(e.name)) fails.push(`[DUP-EXECUTOR] "${e.name}"`); seenE.add(e.name); }

// schema with required but no parameters object
for (const s of schemas) if (s.required.length && !s.hasParams) warns.push(`[NO-PARAMS-OBJ] "${s.name}" has required but no parameters`);

console.log(`SCHEMAS: ${schemas.length}   EXECUTORS: ${executors.length}`);
console.log("=".repeat(70));
console.log("\n--- FAILURES ---");
console.log(fails.length ? fails.map(f => "FAIL " + f).join("\n") : "(none)");
console.log("\n--- WARNINGS ---");
console.log(warns.length ? warns.map(w => "WARN " + w).join("\n") : "(none)");
console.log("\n" + "=".repeat(70));
console.log(`PASS (trio intact): ${schemas.filter(s => execNames.has(s.name) && !fails.some(f=>f.includes(`"${s.name}"`))).length}/${schemas.length} schemas`);
console.log(`FAILS: ${fails.length}   WARNS: ${warns.length}`);

fs.writeFileSync(path.join(__dirname, "tool-validation-report.json"),
    JSON.stringify({schemaCount: schemas.length, execCount: executors.length, fails, warns,
        schemaNames: [...schemaNames].sort(), execNames: [...execNames].sort(), schemas, executors}, null, 2));
