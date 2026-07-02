// Audit B1 — single source of truth for the app version.
//
// package.json is canonical (electron-updater keys off git tags that must match
// it). Docs claiming a different "vX.Y.Z" as the current version is how users
// end up confused about what they're running — this script fails CI when any
// tracked doc hardcodes a v-prefixed version that disagrees with package.json.
//
// Convention: historical mentions in docs must be written WITHOUT the "v"
// prefix (e.g. "sürüm 1.7.1, tarihsel not") so they don't trip this check.
//
// Usage: node scripts/check-version.mjs

import {readFileSync, existsSync} from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const canonical = pkg.version;

// docs/ is gitignored (checked only when present locally); the rest run in CI.
const FILES = ["README.md", "ROADMAP.md", "SECURITY.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "ARCHITECTURE.md", "docs/TECH_STACK.md", "docs/ARCHITECTURE.md"];

const VERSION_RE = /\bv(\d+\.\d+\.\d+)\b/g;

let failures = 0;
for (const file of FILES) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf-8").split("\n");
    lines.forEach((line, i) => {
        if (/https?:\/\//.test(line)) return; // URLs (release links, badges) are not claims
        for (const m of line.matchAll(VERSION_RE)) {
            if (m[1] !== canonical) {
                console.error(`${file}:${i + 1}: claims v${m[1]} but package.json says ${canonical}`);
                console.error(`    ${line.trim().slice(0, 120)}`);
                failures++;
            }
        }
    });
}

if (failures > 0) {
    console.error(`\nVersion drift: ${failures} stale claim(s). Either update them to v${canonical} or drop the "v" prefix for historical mentions.`);
    process.exit(1);
}
console.log(`Version check OK — package.json ${canonical} is the single source of truth.`);
