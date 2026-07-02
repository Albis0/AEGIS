// Audit D2 — guard the hand-enumerated electron-builder `files` list.
//
// package.json build.files pins ~50 node_modules paths (the Kokoro/onnxruntime/
// sharp tree) because kokoro-js is an optionalDependency and its subtree must be
// forced into the package. The failure mode: a version bump adds a NEW transitive
// dependency, nobody adds it to build.files, and the packaged app crashes at
// runtime with a bare "Cannot find module" — found only after shipping.
//
// This script walks the real node_modules dependency tree of every explicitly
// listed module and fails when a transitive dependency is neither (a) also in
// build.files nor (b) a regular production dependency (electron-builder always
// copies those automatically).
//
// Usage: node scripts/check-packaged-deps.mjs

import {readFileSync, existsSync} from "fs";
import * as path from "path";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

const listed = new Set(
    (pkg.build?.files ?? [])
        .filter((f) => typeof f === "string" && f.startsWith("node_modules/"))
        .map((f) => {
            const parts = f.replace(/^node_modules\//, "").split("/");
            return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
        }),
);

const autoCopied = new Set(Object.keys(pkg.dependencies ?? {}));

function depsOf(name) {
    const p = path.join("node_modules", name, "package.json");
    if (!existsSync(p)) return null;
    const j = JSON.parse(readFileSync(p, "utf-8"));
    // optionalDependencies included: if installed, the module may require() them.
    return [...Object.keys(j.dependencies ?? {}), ...Object.keys(j.optionalDependencies ?? {})];
}

const missing = new Map(); // dep -> required-by
const visited = new Set();
const queue = [...listed];

while (queue.length > 0) {
    const mod = queue.shift();
    if (visited.has(mod)) continue;
    visited.add(mod);
    const deps = depsOf(mod);
    if (deps === null) continue; // not installed (optional platform package) — nothing to package
    for (const dep of deps) {
        if (dep.startsWith("@types/")) continue; // type-only, never require()d at runtime
        if (listed.has(dep) || autoCopied.has(dep)) {
            if (!visited.has(dep)) queue.push(dep);
            continue;
        }
        if (!existsSync(path.join("node_modules", dep))) continue; // not installed → won't be required at runtime here
        if (!missing.has(dep)) missing.set(dep, mod);
    }
}

if (missing.size > 0) {
    console.error("Packaged-app dependency gap: these are required by modules in build.files");
    console.error("but are neither in build.files nor regular dependencies (so electron-builder");
    console.error("will NOT copy them and the packaged app will crash with Cannot find module):\n");
    for (const [dep, by] of missing) {
        console.error(`  - node_modules/${dep}/**/*   (required by ${by})`);
    }
    console.error(`\nAdd the ${missing.size} entr${missing.size === 1 ? "y" : "ies"} above to build.files in package.json.`);
    process.exit(1);
}

console.log(`Packaged-deps check OK — ${listed.size} listed modules, transitive tree fully covered.`);
