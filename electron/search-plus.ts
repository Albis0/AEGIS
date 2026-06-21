import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {exec as execCb} from "child_process";

const LAUNCH_HIST_PATH = path.join(os.homedir(), ".aegis", "app-launch-history.json");

function runPs(script: string, timeoutMs = 15000): Promise<string> {
    return new Promise((res) => {
        const child = execCb(
            "powershell -NoProfile -NonInteractive -Command -",
            {timeout: timeoutMs, windowsHide: true, maxBuffer: 2 * 1024 * 1024},
            (err, stdout) => res(err ? "" : (stdout ?? "").trim())
        );
        child.stdin?.end(script);
    });
}
function load<T>(p: string, def: T): T {
    try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return def; }
}
function save(p: string, data: unknown): void {
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// Fuzzy match — returns 0-100 score
function fuzzyScore(query: string, target: string): number {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    if (t.includes(q)) return 100 - (t.length - q.length);
    let score = 0;
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
        if (t[i] === q[qi]) { score += 10; qi++; }
    }
    return qi === q.length ? score : 0;
}

export async function fileSearch(query: string, dir?: string): Promise<string> {
    if (!query) return "ERROR: Search term required.";
    const searchDir = dir || os.homedir();
    // Pass paths as PS variables — no injection
    const esResult = await runPs(
        `$q = '${query.replace(/'/g, "''")}'\n` +
        `& 'C:\\Program Files\\Everything\\es.exe' $q -n 20 2>$null`,
        5000
    );
    if (esResult && esResult.length > 5 && !esResult.includes("ERROR")) {
        return `Search results (Everything):\n${esResult}`;
    }
    const result = await runPs(
        `$p = '${searchDir.replace(/'/g, "''")}'\n` +
        `$q = '*${query.replace(/'/g, "''")}*'\n` +
        `Get-ChildItem -Path $p -Recurse -ErrorAction SilentlyContinue -Filter $q | Select-Object -First 20 -ExpandProperty FullName`,
        20000
    );
    if (!result) return `No files found for "${query}".`;
    return `File search results:\n${result}`;
}

export async function contentSearch(query: string, dir: string, extension?: string): Promise<string> {
    if (!query || !dir) return "ERROR: Search term and folder required.";
    if (!fs.existsSync(dir)) return `ERROR: Folder not found: ${dir}`;
    const extFilter = extension ? `-Include '*.${extension.replace(/'/g, "").replace(".", "")}'` : "-Include '*.txt','*.md','*.ts','*.js','*.py','*.json','*.cs','*.cpp','*.java','*.go'";
    const result = await runPs(
        `$p = '${dir.replace(/'/g, "''")}'\n` +
        `$q = '${query.replace(/'/g, "''")}'\n` +
        `Get-ChildItem -Path $p -Recurse -ErrorAction SilentlyContinue ${extFilter} | Select-String -Pattern $q -ErrorAction SilentlyContinue | Select-Object -First 30 | ForEach-Object {"$($_.Filename):$($_.LineNumber): $($_.Line.Trim())"}`,
        30000
    );
    if (!result) return `Content search for "${query}": no results found.`;
    return `Content search (${dir}):\n${result}`;
}

export async function appSearch(query: string, launch: boolean): Promise<string> {
    if (!query) return "ERROR: Application name required.";
    // Scan start menu shortcuts
    const startMenuPaths = [
        path.join(os.homedir(), "AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs"),
        "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
    ];
    const shortcuts: {name: string; path: string}[] = [];
    for (const startPath of startMenuPaths) {
        if (!fs.existsSync(startPath)) continue;
        function scanDir(d: string): void {
            try {
                for (const entry of fs.readdirSync(d)) {
                    const full = path.join(d, entry);
                    if (fs.statSync(full).isDirectory()) scanDir(full);
                    else if (entry.endsWith(".lnk") || entry.endsWith(".exe")) {
                        shortcuts.push({name: path.basename(entry, path.extname(entry)), path: full});
                    }
                }
            } catch {}
        }
        scanDir(startPath);
    }

    // Also scan PATH executables
    const pathExes = await runPs("$env:PATH -split ';' | ForEach-Object { if (Test-Path $_) { Get-ChildItem $_ -Filter '*.exe' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name } } | Sort-Object -Unique | Select-Object -First 100");
    for (const exe of (pathExes || "").split("\n").filter(Boolean)) {
        shortcuts.push({name: path.basename(exe, ".exe"), path: exe});
    }

    const launchHist: Record<string, number> = load(LAUNCH_HIST_PATH, {});
    const scored = shortcuts
        .map((s) => ({...s, score: fuzzyScore(query, s.name) + (launchHist[s.name] ?? 0) * 2}))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    if (scored.length === 0) return `No application found for "${query}".`;

    if (launch) {
        const best = scored[0];
        launchHist[best.name] = (launchHist[best.name] ?? 0) + 1;
        save(LAUNCH_HIST_PATH, launchHist);
        return `[START_PROCESS|${best.path}]`;
    }
    return scored.map((s, i) => `${i + 1}. ${s.name} — ${s.path}`).join("\n");
}
