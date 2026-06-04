import {exec as execCb} from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function run(cmd: string, timeoutMs = 15000): Promise<string> {
    return new Promise((resolve) => {
        execCb(cmd, {timeout: timeoutMs, windowsHide: true}, (err, stdout, stderr) => {
            const out = (stdout ?? "").trim();
            if (err && !out) resolve(`HATA: ${err.message}${stderr ? "\n" + stderr.trim() : ""}`);
            else resolve(out || "(tamam)");
        });
    });
}

function ps(script: string): Promise<string> {
    return new Promise((resolve) => {
        execCb(`powershell -NoProfile -NonInteractive -Command -`, {timeout: 15000, windowsHide: true}, (err, stdout, stderr) => {
            const out = (stdout ?? "").trim();
            if (err && !out) resolve(`HATA: ${err.message}${stderr ? "\n" + stderr.trim() : ""}`);
            else resolve(out || "(tamam)");
        }).stdin?.end(script);
    });
}

// Steam kurulum yolunu bul
async function findSteamExe(): Promise<string | null> {
    const candidates = [
        "C:\\Program Files (x86)\\Steam\\steam.exe",
        "C:\\Program Files\\Steam\\steam.exe",
        path.join(os.homedir(), "AppData\\Local\\Steam\\steam.exe"),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    // Registry'den dene
    const regOut = await run(
        `reg query "HKCU\\Software\\Valve\\Steam" /v SteamExe 2>nul`
    );
    const match = regOut.match(/SteamExe\s+REG_SZ\s+(.+)/i);
    if (match) {
        const p = match[1].trim().replace(/\//g, "\\");
        if (fs.existsSync(p)) return p;
    }
    return null;
}

async function steamRunning(): Promise<boolean> {
    const out = await run(`tasklist /FI "IMAGENAME eq steam.exe" /NH 2>nul`);
    return out.toLowerCase().includes("steam.exe");
}

async function ensureSteam(): Promise<{ok: boolean; exe: string}> {
    const exe = await findSteamExe();
    if (!exe) return {ok: false, exe: ""};
    if (!(await steamRunning())) {
        // Steam'i başlat ve tam açılmasını bekle (max 15sn)
        execCb(`"${exe}"`, {windowsHide: false}, () => {});
        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            if (await steamRunning()) break;
        }
    }
    return {ok: true, exe};
}

// Steam libraryfolders.vdf'den oyun listesi çıkar
async function getInstalledGames(): Promise<{name: string; appid: string}[]> {
    const games: {name: string; appid: string}[] = [];

    // steamapps klasörlerini bul
    const steamPaths: string[] = [
        "C:\\Program Files (x86)\\Steam\\steamapps",
        "C:\\Program Files\\Steam\\steamapps",
    ];

    // libraryfolders.vdf'den ek yollar
    for (const basePath of steamPaths) {
        const vdf = path.join(basePath, "libraryfolders.vdf");
        if (fs.existsSync(vdf)) {
            const content = fs.readFileSync(vdf, "utf-8");
            const pathMatches = content.matchAll(/"path"\s+"([^"]+)"/g);
            for (const m of pathMatches) {
                const extra = path.join(m[1].replace(/\\\\/g, "\\"), "steamapps");
                if (!steamPaths.includes(extra) && fs.existsSync(extra)) {
                    steamPaths.push(extra);
                }
            }
            break;
        }
    }

    for (const appsDir of steamPaths) {
        if (!fs.existsSync(appsDir)) continue;
        let files: string[];
        try {
            files = fs.readdirSync(appsDir);
        } catch {
            continue;
        }
        for (const file of files) {
            if (!file.startsWith("appmanifest_") || !file.endsWith(".acf")) continue;
            try {
                const content = fs.readFileSync(path.join(appsDir, file), "utf-8");
                const appidMatch = content.match(/"appid"\s+"(\d+)"/);
                const nameMatch = content.match(/"name"\s+"([^"]+)"/);
                if (appidMatch && nameMatch) {
                    games.push({appid: appidMatch[1], name: nameMatch[1]});
                }
            } catch {}
        }
    }

    return games;
}

function fuzzyMatch(query: string, name: string): number {
    const q = query.toLowerCase();
    const n = name.toLowerCase();
    if (n === q) return 100;
    if (n.startsWith(q)) return 90;
    if (n.includes(q)) return 70;
    // Her kelime eşleşmesi
    const words = q.split(/\s+/);
    const matched = words.filter((w) => n.includes(w)).length;
    return Math.round((matched / words.length) * 50);
}

export async function steamLaunchGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";

    const {ok} = await ensureSteam();
    if (!ok) return "HATA: Steam kurulu değil veya bulunamadı.";

    // Sayısal ise direkt AppID olarak kullan
    if (/^\d+$/.test(nameOrId.trim())) {
        await run(`start steam://rungameid/${nameOrId.trim()}`, 5000);
        return `AppID ${nameOrId} başlatıldı.`;
    }

    // Oyun adıyla ara
    const games = await getInstalledGames();
    if (games.length === 0) return "HATA: Yüklü oyun listesi alınamadı.";

    const scored = games
        .map((g) => ({...g, score: fuzzyMatch(nameOrId, g.name)}))
        .filter((g) => g.score > 0)
        .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
        return `"${nameOrId}" adında oyun bulunamadı. "steam oyun listesi" ile yüklü oyunlara bak.`;
    }

    const best = scored[0];
    await run(`start steam://rungameid/${best.appid}`, 5000);
    return `"${best.name}" başlatılıyor (AppID: ${best.appid}).`;
}

export async function steamListGames(): Promise<string> {
    const games = await getInstalledGames();
    if (games.length === 0) return "Yüklü oyun bulunamadı. Steam kurulu mu?";
    const sorted = games.sort((a, b) => a.name.localeCompare(b.name));
    const lines = sorted.map((g) => `• ${g.name} (${g.appid})`);
    return `Yüklü Steam oyunları (${games.length}):\n${lines.join("\n")}`;
}

export async function steamOpen(): Promise<string> {
    const {ok, exe} = await ensureSteam();
    if (!ok) return "HATA: Steam kurulu değil.";
    // Pencereyi öne getir
    await ps(`$p = Get-Process -Name steam -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
if ($p) { Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id) }
else { Start-Process "${exe.replace(/\\/g, "\\\\")}" }`);
    return "Steam açıldı.";
}

export async function steamClose(): Promise<string> {
    if (!(await steamRunning())) return "Steam zaten kapalı.";
    await run(`start steam://exit`, 5000);
    return "Steam kapatılıyor.";
}

export async function steamGameRunning(): Promise<string> {
    const out = await ps(
        "Get-Process | Where-Object { $_.Name -ne 'steam' -and $_.Name -ne 'steamwebhelper' -and $_.Path -like '*steamapps*' } | Select-Object -ExpandProperty Name -First 1"
    );
    if (!out || out === "(tamam)") return "Şu an çalışan Steam oyunu yok.";
    return `Şu an çalışan oyun: ${out}`;
}
