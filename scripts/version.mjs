#!/usr/bin/env node
/**
 * Sets the version, in all three places that carry it.
 *
 * # Why a script
 *
 * The version is written in `Cargo.toml`, `ui/package.json` and
 * `crates/vavis-shell/tauri.conf.json`. Nothing makes them agree, and nothing
 * complains when they do not — a release just ships a binary whose reported
 * version is not the one in its own installer. Bumping by hand is three edits
 * and the third is the one that gets forgotten.
 *
 * # Use
 *
 *   node scripts/version.mjs 0.7.0     set it
 *   node scripts/version.mjs patch     0.6.3 -> 0.6.4
 *   node scripts/version.mjs minor     0.6.3 -> 0.7.0
 *   node scripts/version.mjs major     0.6.3 -> 1.0.0
 *   node scripts/version.mjs --check   verify the three agree, change nothing
 *
 * `bun` works in place of `node` everywhere above, and is what CI uses —
 * it is the only runtime the workflow installs. Nothing here is specific to
 * either one.
 *
 * `--check` is what CI runs. It is the half that keeps working after somebody
 * edits a file by hand anyway.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Each file, with a pattern matching only its own version line.
 *
 * Anchored deliberately: `ui/package.json` also has versions for every
 * dependency, and a loose match would rewrite the first one it found.
 */
const FILES = [
    {
        path: "Cargo.toml",
        // The workspace version, under [workspace.package].
        pattern: /^version = "(\d+\.\d+\.\d+)"$/m,
        replace: (v) => `version = "${v}"`,
    },
    {
        path: "ui/package.json",
        // Top level, so it is indented by exactly two spaces.
        pattern: /^  "version": "(\d+\.\d+\.\d+)",$/m,
        replace: (v) => `  "version": "${v}",`,
    },
    {
        path: "crates/vavis-shell/tauri.conf.json",
        pattern: /^  "version": "(\d+\.\d+\.\d+)",$/m,
        replace: (v) => `  "version": "${v}",`,
    },
];

function read(file) {
    const text = readFileSync(join(root, file.path), "utf8");
    const found = text.match(file.pattern);
    if (!found) {
        throw new Error(
            `no version line in ${file.path} — the pattern needs updating`,
        );
    }
    return { text, version: found[1] };
}

function bump(current, part) {
    const [major, minor, patch] = current.split(".").map(Number);
    if (part === "major") return `${major + 1}.0.0`;
    if (part === "minor") return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
}

const arg = process.argv[2];
if (!arg) {
    console.error("usage: version.mjs <x.y.z | major | minor | patch | --check>");
    process.exit(2);
}

const state = FILES.map((file) => ({ file, ...read(file) }));

if (arg === "--check") {
    const versions = new Set(state.map((s) => s.version));
    if (versions.size === 1) {
        console.log(`version ${[...versions][0]} — all three agree`);
        process.exit(0);
    }
    console.error("version mismatch:");
    for (const s of state) console.error(`  ${s.version}  ${s.file.path}`);
    process.exit(1);
}

const current = state[0].version;
const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg : bump(current, arg);

if (!/^\d+\.\d+\.\d+$/.test(next)) {
    console.error(`not a version or a bump: ${arg}`);
    process.exit(2);
}

for (const { file, text } of state) {
    writeFileSync(
        join(root, file.path),
        text.replace(file.pattern, file.replace(next)),
    );
}

console.log(`${current} -> ${next}`);
console.log("Cargo.lock updates on the next build; commit it with this.");
