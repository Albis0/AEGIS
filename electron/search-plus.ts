import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {exec as execCb} from "child_process";

const LAUNCH_HIST_PATH = path.join(os.homedir(), ".aegis", "app-launch-history.json");

function runPs(cmd: string, timeoutMs = 15000): Promise<string> {
    return new Promise((res) => {
        execCb(`powershell -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`,
            {timeout: timeoutMs, windowsHide: true, maxBuffer: 2 * 1024 * 1024},
            (err, stdout) => res(err ? "" : (stdout ?? "").trim())
        );
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
    if (!query) return "HATA: Arama terimi gerekli.";
    const searchDir = dir || os.homedir();
    // Try Everything first (if installed), then PowerShell recursive
    const everythingCmd = `& 'C:\\Program Files\\Everything\\es.exe' "${query}" -n 20 2>$null`;
    const esResult = await runPs(everythingCmd, 5000);
    if (esResult && esResult.length > 5 && !esResult.includes("HATA")) {
        return `Arama sonuçları (Everything):\n${esResult}`;
    }
    // Fallback: PowerShell
    const ps = `Get-ChildItem -Path "${searchDir.replace(/\\/g, "\\\\")}" -Recurse -ErrorAction SilentlyContinue -Filter "*${query}*" | Select-Object -First 20 FullName | ForEach-Object {$_.FullName}`;
    const result = await runPs(ps, 20000);
    if (!result) return `"${query}" için dosya bulunamadı.`;
    return `Dosya arama sonuçları:\n${result}`;
}

export async function contentSearch(query: string, dir: string, extension?: string): Promise<string> {
    if (!query || !dir) return "HATA: Arama terimi ve klasör gerekli.";
    if (!fs.existsSync(dir)) return `HATA: Klasör bulunamadı: ${dir}`;
    const extFilter = extension ? `-Include "*.${extension.replace(".", "")}"` : "-Include '*.txt','*.md','*.ts','*.js','*.py','*.json','*.cs','*.cpp','*.java','*.go'";
    const ps = `Get-ChildItem -Path "${dir.replace(/\\/g, "\\\\")}" -Recurse -ErrorAction SilentlyContinue ${extFilter} | Select-String -Pattern "${query.replace(/"/g, "'")}" -ErrorAction SilentlyContinue | Select-Object -First 30 | ForEach-Object {"$($_.Filename):$($_.LineNumber): $($_.Line.Trim())"}`;
    const result = await runPs(ps, 30000);
    if (!result) return `"${query}" içerik araması: sonuç bulunamadı.`;
    return `İçerik arama (${dir}):\n${result}`;
}

export async function appSearch(query: string, launch: boolean): Promise<string> {
    if (!query) return "HATA: Uygulama adı gerekli.";
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

    if (scored.length === 0) return `"${query}" için uygulama bulunamadı.`;

    if (launch) {
        const best = scored[0];
        launchHist[best.name] = (launchHist[best.name] ?? 0) + 1;
        save(LAUNCH_HIST_PATH, launchHist);
        return `[START_PROCESS|${best.path}]`;
    }
    return scored.map((s, i) => `${i + 1}. ${s.name} — ${s.path}`).join("\n");
}
