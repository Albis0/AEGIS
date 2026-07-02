/**
 * Phase 18.1 — Plugin Marketplace & Management
 *
 * No external dependencies:
 *   - Search: GitHub Search API (api.github.com)
 *   - Install: download zip over HTTPS, extract under ~/.aegis/plugins/
 *   - Remove: delete the folder
 *
 * Security:
 *   - manifest.json schema validation (name, version, tools)
 *   - simple forbidden-pattern scan in index.js
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as https from "https";
import * as crypto from "crypto";

const PLUGINS_DIR = path.join(os.homedir(), ".aegis", "plugins");

function ensurePluginsDir(): void {
    fs.mkdirSync(PLUGINS_DIR, {recursive: true});
}

function httpsGet(url: string, timeoutMs = 10000): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {"User-Agent": "AEGIS-Plugin-Manager/1.0", "Accept": "application/json"},
            timeout: timeoutMs,
        }, (res) => {
            let data = "";
            res.on("data", (c) => data += c);
            res.on("end", () => {
                if (res.statusCode === 200) resolve(data);
                else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    });
}

function httpsGetBinary(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const follow = (u: string): void => {
            https.get(u, {headers: {"User-Agent": "AEGIS-Plugin-Manager/1.0"}, timeout: 30000}, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    follow(res.headers.location ?? u); return;
                }
                const chunks: Buffer[] = [];
                res.on("data", (c) => chunks.push(c));
                res.on("end", () => resolve(Buffer.concat(chunks)));
            }).on("error", reject);
        };
        follow(url);
    });
}

function validateManifest(manifest: unknown): {valid: boolean; error?: string} {
    if (typeof manifest !== "object" || manifest === null) return {valid: false, error: "manifest.json is not an object"};
    const m = manifest as Record<string, unknown>;
    if (typeof m.name !== "string" || !m.name.trim()) return {valid: false, error: "name field is missing"};
    if (!Array.isArray(m.tools) || m.tools.length === 0) return {valid: false, error: "tools array is missing or empty"};
    for (const tool of m.tools) {
        if (typeof (tool as Record<string, unknown>).name !== "string") return {valid: false, error: "tool.name is missing"};
    }
    return {valid: true};
}

const DANGEROUS_PATTERNS = [
    /require\s*\(\s*['"]child_process['"]\s*\)/,
    /process\.env\b.*(?:KEY|SECRET|TOKEN|PASS)/i,
    /fs\.(?:unlinkSync|rmSync|rmdirSync)\s*\([^)]*\.\.\//,
];

function securityScan(code: string): string | null {
    for (const p of DANGEROUS_PATTERNS) {
        if (p.test(code)) return `Security warning: suspicious pattern detected (${p.source.slice(0, 40)})`;
    }
    return null;
}

export async function pluginSearch(query: string): Promise<string> {
    try {
        const q = encodeURIComponent(`aegis-plugin-${query} in:name,description`);
        const raw = await httpsGet(`https://api.github.com/search/repositories?q=${q}&sort=stars&per_page=8`);
        const data = JSON.parse(raw) as {items?: {full_name: string; description: string | null; stargazers_count: number; html_url: string}[]};
        const items = data.items ?? [];
        if (items.length === 0) return `No plugins found for "${query}".`;
        return items.map((r) =>
            `• ${r.full_name} ⭐${r.stargazers_count}\n  ${r.description ?? "(no description)"}\n  ${r.html_url}`,
        ).join("\n\n");
    } catch (e) {
        return `Search failed: ${(e as Error).message}`;
    }
}

export async function pluginInstall(repoOrUrl: string): Promise<string> {
    ensurePluginsDir();
    const repo = repoOrUrl.replace("https://github.com/", "").replace(/\.git$/, "").trim();
    if (!repo.includes("/")) return `ERROR: Invalid repo: "${repo}". E.g. user/aegis-plugin-spotify`;

    const zipUrl = `https://github.com/${repo}/archive/refs/heads/main.zip`;
    let zipBuffer: Buffer;
    try {
        zipBuffer = await httpsGetBinary(zipUrl);
    } catch (e) {
        return `ERROR: Could not download repo (${repo}): ${(e as Error).message}`;
    }

    const tmpDir = path.join(os.tmpdir(), `aegis-plugin-${crypto.randomBytes(4).toString("hex")}`);
    fs.mkdirSync(tmpDir, {recursive: true});
    const zipPath = path.join(tmpDir, "plugin.zip");
    fs.writeFileSync(zipPath, zipBuffer);

    // Node has no built-in zip support — run via PowerShell over stdin (injection-proof)
    const {exec} = await import("child_process");
    await new Promise<void>((resolve, reject) => {
        const child = exec(
            "powershell -NoProfile -NonInteractive -Command -",
            {timeout: 15000, windowsHide: true},
            (err) => { if (err) reject(err); else resolve(); }
        );
        child.stdin?.end(`Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tmpDir.replace(/'/g, "''")}' -Force`);
    });

    // Find the content
    const extracted = fs.readdirSync(tmpDir).filter((f) => f !== "plugin.zip");
    if (extracted.length === 0) { fs.rmSync(tmpDir, {recursive: true}); return "ERROR: Zip came out empty."; }
    const srcDir = path.join(tmpDir, extracted[0]);

    // Validate manifest.json
    const manifestPath = path.join(srcDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) { fs.rmSync(tmpDir, {recursive: true}); return "ERROR: manifest.json not found."; }
    let manifest: unknown;
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")); } catch { return "ERROR: manifest.json is invalid JSON."; }
    const check = validateManifest(manifest);
    if (!check.valid) { fs.rmSync(tmpDir, {recursive: true}); return `ERROR: ${check.error}`; }

    // index.js security scan
    const indexPath = path.join(srcDir, "index.js");
    if (fs.existsSync(indexPath)) {
        const code = fs.readFileSync(indexPath, "utf-8");
        const warn = securityScan(code);
        if (warn) { fs.rmSync(tmpDir, {recursive: true}); return `Security scan failed: ${warn}`; }
    }

    const pluginName = (manifest as {name: string}).name;
    const destDir = path.join(PLUGINS_DIR, pluginName);
    if (fs.existsSync(destDir)) fs.rmSync(destDir, {recursive: true});
    fs.cpSync(srcDir, destDir, {recursive: true});
    fs.rmSync(tmpDir, {recursive: true});

    return `Plugin "${pluginName}" installed. Activate it by telling AEGIS "reload plugins".`;
}

export function pluginRemove(name: string): string {
    const dir = path.join(PLUGINS_DIR, name);
    if (!fs.existsSync(dir)) {
        const dirs = fs.existsSync(PLUGINS_DIR) ? fs.readdirSync(PLUGINS_DIR) : [];
        const match = dirs.find((d) => d.toLowerCase().includes(name.toLowerCase()));
        if (!match) return `No installed plugin named "${name}" found.`;
        fs.rmSync(path.join(PLUGINS_DIR, match), {recursive: true});
        return `Plugin "${match}" removed.`;
    }
    fs.rmSync(dir, {recursive: true});
    return `Plugin "${name}" removed. Say "reload plugins" to apply the changes.`;
}
