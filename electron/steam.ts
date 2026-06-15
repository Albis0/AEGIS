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

// steam:// protokol URL'ini aç (Windows shell üzerinden)
async function steamUrl(url: string): Promise<void> {
    await run(`cmd /c start "" "${url}"`, 5000);
}

// ── Web API yardımcıları ──────────────────────────────────────────────────────
const API = "https://api.steampowered.com";
const STORE = "https://store.steampowered.com";

function apiKey(): string {
    return (process.env.STEAM_API_KEY ?? "").trim();
}
function steamId(): string {
    return (process.env.STEAM_ID64 ?? "").trim();
}
function needKey(): string {
    return "HATA: Steam Web API key ayarlı değil. Ayarlar > API Keys'ten 'Steam API Key' gir (steamcommunity.com/dev/apikey).";
}
function needId(): string {
    return "HATA: SteamID64 ayarlı değil. Ayarlar > API Keys'ten 64-bit SteamID'ni gir (steamid.io ile öğrenebilirsin).";
}

async function apiGet<T = any>(api_path: string, params: Record<string, string | number> = {}): Promise<T | {error: string}> {
    const key = apiKey();
    if (!key) return {error: needKey()};
    const usp = new URLSearchParams({key, format: "json", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))});
    try {
        const res = await fetch(`${API}${api_path}?${usp.toString()}`);
        if (!res.ok) return {error: `Steam API ${res.status}: ${res.statusText}`};
        return (await res.json()) as T;
    } catch (e: any) {
        return {error: `Steam API isteği başarısız: ${e?.message ?? e}`};
    }
}

function isErr(x: any): x is {error: string} {
    return x && typeof x === "object" && typeof x.error === "string";
}

function fmtMinutes(min: number): string {
    if (!min || min < 1) return "0 saat";
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} dk`;
    if (m === 0) return `${h} saat`;
    return `${h} saat ${m} dk`;
}

function fmtBytes(bytes: number): string {
    if (bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function dirSizeSync(dir: string): number {
    let total = 0;
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch {
        return 0;
    }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        try {
            if (e.isDirectory()) total += dirSizeSync(full);
            else if (e.isFile()) total += fs.statSync(full).size;
        } catch {}
    }
    return total;
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

async function steamWebHelperRunning(): Promise<boolean> {
    const out = await run(`tasklist /FI "IMAGENAME eq steamwebhelper.exe" /NH 2>nul`);
    return out.toLowerCase().includes("steamwebhelper.exe");
}

async function ensureSteam(): Promise<{ok: boolean; exe: string; wasRunning: boolean}> {
    const exe = await findSteamExe();
    if (!exe) return {ok: false, exe: "", wasRunning: false};
    const wasRunning = await steamRunning();
    if (!wasRunning) {
        // Steam'i başlat, hem steam.exe hem steamwebhelper.exe çıkana kadar bekle (max 30sn)
        execCb(`"${exe}"`, {windowsHide: false}, () => {});
        for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            if ((await steamRunning()) && (await steamWebHelperRunning())) break;
        }
        // steamwebhelper hazır olsa bile UI login için birkaç sn daha bekle
        await new Promise((r) => setTimeout(r, 4000));
    }
    return {ok: true, exe, wasRunning};
}

// Steam steamapps klasörlerini bul
function steamAppsDirs(): string[] {
    const steamPaths: string[] = [
        "C:\\Program Files (x86)\\Steam\\steamapps",
        "C:\\Program Files\\Steam\\steamapps",
    ];
    for (const basePath of [...steamPaths]) {
        const vdf = path.join(basePath, "libraryfolders.vdf");
        if (fs.existsSync(vdf)) {
            try {
                const content = fs.readFileSync(vdf, "utf-8");
                const pathMatches = content.matchAll(/"path"\s+"([^"]+)"/g);
                for (const m of pathMatches) {
                    const extra = path.join(m[1].replace(/\\\\/g, "\\"), "steamapps");
                    if (!steamPaths.includes(extra) && fs.existsSync(extra)) steamPaths.push(extra);
                }
            } catch {}
            break;
        }
    }
    return steamPaths.filter((p) => fs.existsSync(p));
}

// Steam appmanifest'lerden yüklü oyun listesi (appid → name, klasör)
async function getInstalledGames(): Promise<{name: string; appid: string; installdir: string; appsDir: string}[]> {
    const games: {name: string; appid: string; installdir: string; appsDir: string}[] = [];
    for (const appsDir of steamAppsDirs()) {
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
                const dirMatch = content.match(/"installdir"\s+"([^"]+)"/);
                if (appidMatch && nameMatch) {
                    games.push({appid: appidMatch[1], name: nameMatch[1], installdir: dirMatch ? dirMatch[1] : "", appsDir});
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
    const words = q.split(/\s+/);
    const matched = words.filter((w) => n.includes(w)).length;
    return Math.round((matched / words.length) * 50);
}

// Yüklü oyunlar arasından isimle en iyi eşleşmeyi bul
async function resolveInstalledGame(nameOrId: string): Promise<{name: string; appid: string; installdir: string; appsDir: string} | null> {
    const games = await getInstalledGames();
    if (/^\d+$/.test(nameOrId.trim())) {
        const byId = games.find((g) => g.appid === nameOrId.trim());
        if (byId) return byId;
        return {name: `AppID ${nameOrId.trim()}`, appid: nameOrId.trim(), installdir: "", appsDir: ""};
    }
    const scored = games
        .map((g) => ({g, score: fuzzyMatch(nameOrId, g.name)}))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
    return scored.length ? scored[0].g : null;
}

// Web API üzerinden tüm oyunlar (appid → name) — kütüphane araması için
async function getOwnedGamesRaw(): Promise<{appid: number; name: string; playtime_forever: number; rtime_last_played?: number}[] | {error: string}> {
    if (!steamId()) return {error: needId()};
    const data = await apiGet<{response?: {games?: any[]}}>("/IPlayerService/GetOwnedGames/v1/", {
        steamid: steamId(),
        include_appinfo: 1,
        include_played_free_games: 1,
    });
    if (isErr(data)) return data;
    const games = data.response?.games;
    if (!games) return {error: "Oyun listesi alınamadı. Profil gizliyse 'Oyun detayları' herkese açık olmalı."};
    return games;
}

// ── Son işlem hafızası (repeat_last_steam_action için) ────────────────────────
let lastSteamAction: {fn: () => Promise<string>; label: string} | null = null;
function remember(label: string, fn: () => Promise<string>) {
    lastSteamAction = {fn, label};
}

// ════════════════════════════════════════════════════════════════════════════
// LOCAL / PROTOKOL — key gerekmez
// ════════════════════════════════════════════════════════════════════════════

export async function steamOpen(): Promise<string> {
    const {ok, exe} = await ensureSteam();
    if (!ok) return "HATA: Steam kurulu değil.";
    await ps(`$p = Get-Process -Name steam -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
if ($p) { Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id) }
else { Start-Process "${exe.replace(/\\/g, "\\\\")}" }`);
    return "Steam açıldı.";
}

export async function steamClose(): Promise<string> {
    if (!(await steamRunning())) return "Steam zaten kapalı.";
    await steamUrl("steam://exit");
    return "Steam kapatılıyor.";
}

export async function steamRestart(): Promise<string> {
    const wasRunning = await steamRunning();
    if (wasRunning) {
        await steamUrl("steam://exit");
        // tamamen kapanmasını bekle (max 15sn)
        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            if (!(await steamRunning())) break;
        }
    }
    const {ok} = await ensureSteam();
    return ok ? "Steam yeniden başlatıldı." : "HATA: Steam yeniden başlatılamadı.";
}

export async function steamLaunchGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    const {ok} = await ensureSteam();
    if (!ok) return "HATA: Steam kurulu değil veya bulunamadı.";

    if (/^\d+$/.test(nameOrId.trim())) {
        const id = nameOrId.trim();
        await steamUrl(`steam://rungameid/${id}`);
        remember(`AppID ${id} başlat`, () => steamLaunchGame(id));
        return `AppID ${id} başlatıldı.`;
    }
    const g = await resolveInstalledGame(nameOrId);
    if (!g) return `"${nameOrId}" adında yüklü oyun bulunamadı. "steam oyun listesi" ile bak.`;
    await steamUrl(`steam://rungameid/${g.appid}`);
    remember(`"${g.name}" başlat`, () => steamLaunchGame(g.appid));
    return `"${g.name}" başlatılıyor (AppID: ${g.appid}).`;
}

export async function steamCloseGame(nameOrId?: string): Promise<string> {
    // Çalışan oyun sürecini bul ve kapat
    const out = await ps(
        "Get-Process | Where-Object { $_.Path -like '*steamapps*common*' } | Select-Object -ExpandProperty Id"
    );
    const ids = out.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^\d+$/.test(s));
    if (ids.length === 0) return "Şu an çalışan Steam oyunu yok.";
    for (const id of ids) await run(`taskkill /PID ${id} /F`, 5000);
    return `Çalışan oyun kapatıldı (${ids.length} süreç).`;
}

export async function steamRestartGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    await steamCloseGame(nameOrId);
    await new Promise((r) => setTimeout(r, 2000));
    return steamLaunchGame(nameOrId);
}

export async function steamListGames(): Promise<string> {
    const games = await getInstalledGames();
    if (games.length === 0) return "Yüklü oyun bulunamadı. Steam kurulu mu?";
    const sorted = games.sort((a, b) => a.name.localeCompare(b.name));
    const lines = sorted.map((g) => `• ${g.name} (${g.appid})`);
    return `Yüklü Steam oyunları (${games.length}):\n${lines.join("\n")}`;
}

export async function steamListRunningGames(): Promise<string> {
    const out = await ps(
        "Get-Process | Where-Object { $_.Path -like '*steamapps*common*' } | Select-Object -ExpandProperty Name -Unique"
    );
    const names = out.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && s !== "(tamam)");
    if (names.length === 0) return "Şu an çalışan Steam oyunu yok.";
    return `Çalışan oyun(lar): ${names.join(", ")}`;
}

export async function steamGameRunning(): Promise<string> {
    return steamListRunningGames();
}

export async function steamIsGameRunning(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı gerekli.";
    const out = await ps(
        "Get-Process | Where-Object { $_.Path -like '*steamapps*common*' } | Select-Object -ExpandProperty Name -Unique"
    );
    const names = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const q = nameOrId.toLowerCase().replace(/\s+/g, "");
    const hit = names.find((n) => n.toLowerCase().replace(/\s+/g, "").includes(q) || q.includes(n.toLowerCase().replace(/\s+/g, "")));
    return hit ? `Evet, "${hit}" şu an çalışıyor.` : `Hayır, "${nameOrId}" şu an çalışmıyor.`;
}

export async function steamInstallGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    let appid = nameOrId.trim();
    if (!/^\d+$/.test(appid)) {
        // İsim verilmişse Web API'den appid bul (kütüphanedeki tüm oyunlar)
        const owned = await getOwnedGamesRaw();
        if (!isErr(owned)) {
            const scored = owned.map((g) => ({g, s: fuzzyMatch(nameOrId, g.name)})).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
            if (scored.length) appid = String(scored[0].g.appid);
        }
        if (!/^\d+$/.test(appid)) return `"${nameOrId}" için AppID bulunamadı. AppID ile dene veya Steam API key ayarla.`;
    }
    await steamUrl(`steam://install/${appid}`);
    remember(`AppID ${appid} kur`, () => steamInstallGame(appid));
    return `AppID ${appid} kurulum penceresi açıldı. Steam'de 'Yükle'yi onayla.`;
}

export async function steamUninstallGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    const g = await resolveInstalledGame(nameOrId);
    const appid = g ? g.appid : nameOrId.trim();
    if (!/^\d+$/.test(appid)) return `"${nameOrId}" yüklü oyunlarda bulunamadı.`;
    await steamUrl(`steam://uninstall/${appid}`);
    return `${g ? `"${g.name}"` : `AppID ${appid}`} kaldırma penceresi açıldı.`;
}

export async function steamVerifyGameFiles(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    const g = await resolveInstalledGame(nameOrId);
    if (!g || !/^\d+$/.test(g.appid)) return `"${nameOrId}" yüklü oyunlarda bulunamadı.`;
    await steamUrl(`steam://validate/${g.appid}`);
    return `"${g.name}" dosya bütünlüğü doğrulaması başlatıldı.`;
}

export async function steamUpdateGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    const g = await resolveInstalledGame(nameOrId);
    if (!g || !/^\d+$/.test(g.appid)) return `"${nameOrId}" yüklü oyunlarda bulunamadı.`;
    // Steam install URL'i mevcut oyunda güncelleme/onarım tetikler
    await steamUrl(`steam://install/${g.appid}`);
    return `"${g.name}" güncelleme kontrolü başlatıldı (varsa indirme başlar).`;
}

export async function steamOpenDownloads(): Promise<string> {
    const {ok} = await ensureSteam();
    if (!ok) return "HATA: Steam kurulu değil.";
    await steamUrl("steam://open/downloads");
    return "Steam indirme yöneticisi açıldı.";
}

export async function steamDownloadStatus(): Promise<string> {
    // İndirme süreci diskte downloading klasörüyle anlaşılır
    const dirs = steamAppsDirs();
    const downloading: string[] = [];
    for (const d of dirs) {
        const dl = path.join(d, "downloading");
        if (fs.existsSync(dl)) {
            try {
                const sub = fs.readdirSync(dl).filter((x) => /^\d+$/.test(x));
                downloading.push(...sub);
            } catch {}
        }
    }
    await steamUrl("steam://open/downloads");
    if (downloading.length === 0) return "Aktif indirme görünmüyor. İndirme yöneticisini açtım, kontrol et.";
    // appid → isim eşle
    const games = await getInstalledGames();
    const names = downloading.map((id) => {
        const g = games.find((x) => x.appid === id);
        return g ? `${g.name} (${id})` : `AppID ${id}`;
    });
    return `İndiriliyor/güncelleniyor: ${names.join(", ")}. Detay için indirme yöneticisini açtım.`;
}

export async function steamPauseResumeCancel(action: "pause" | "resume" | "cancel"): Promise<string> {
    // Steam dışarıdan tekil indirme duraklatma API'si vermez; indirme yöneticisini
    // açıp kullanıcıyı doğru yere getirmek tek güvenilir yol.
    await steamOpenDownloads();
    const tr = action === "pause" ? "duraklat" : action === "resume" ? "devam ettir" : "iptal et";
    return `İndirme yöneticisini açtım. İndirmeyi ${tr} (Steam dışarıdan tekil indirme kontrolüne izin vermiyor, buradan tek tıkla yapabilirsin).`;
}

export async function steamOpenStorePage(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    if (/^\d+$/.test(nameOrId.trim())) {
        await steamUrl(`steam://store/${nameOrId.trim()}`);
        return `Mağaza sayfası açıldı (AppID ${nameOrId.trim()}).`;
    }
    // İsimle ara → ilk sonucun appid'i
    const found = await steamStoreSearchRaw(nameOrId);
    if (isErr(found) || found.length === 0) return `"${nameOrId}" için mağaza sayfası bulunamadı.`;
    await steamUrl(`steam://store/${found[0].id}`);
    return `"${found[0].name}" mağaza sayfası açıldı.`;
}

export async function steamOpenWorkshop(nameOrId?: string): Promise<string> {
    if (nameOrId && /^\d+$/.test(nameOrId.trim())) {
        await steamUrl(`steam://url/SteamWorkshopPage/${nameOrId.trim()}`);
        return `Workshop sayfası açıldı (AppID ${nameOrId.trim()}).`;
    }
    if (nameOrId) {
        const g = await resolveInstalledGame(nameOrId);
        if (g) {
            await steamUrl(`steam://url/SteamWorkshopPage/${g.appid}`);
            return `"${g.name}" Workshop sayfası açıldı.`;
        }
    }
    await steamUrl("steam://url/SteamWorkshop");
    return "Steam Workshop açıldı.";
}

export async function steamWorkshopSubscribe(workshopId: string, subscribe: boolean): Promise<string> {
    if (!/^\d+$/.test((workshopId ?? "").trim())) return "HATA: Workshop öğe ID'si (sayı) gerekli.";
    const id = workshopId.trim();
    // steam://openurl ile öğe sayfasını aç; Steam istemcisi abone ol butonunu gösterir.
    // Doğrudan abonelik için community URL en güveniliri.
    await steamUrl(`steam://openurl/https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`);
    return subscribe
        ? `Workshop öğesi ${id} açıldı — 'Abone Ol'a tıkla (Steam dışarıdan sessiz abonelik vermiyor).`
        : `Workshop öğesi ${id} açıldı — 'Aboneliği Kaldır'a tıkla.`;
}

export async function steamListWorkshopSubs(nameOrId?: string): Promise<string> {
    // Yerel olarak abone içerik workshop/content/<appid> altında durur
    let targetAppid: string | null = null;
    if (nameOrId) {
        const g = await resolveInstalledGame(nameOrId);
        if (g) targetAppid = g.appid;
        else if (/^\d+$/.test(nameOrId.trim())) targetAppid = nameOrId.trim();
    }
    const dirs = steamAppsDirs();
    const found: string[] = [];
    for (const d of dirs) {
        const wsContent = path.join(d, "workshop", "content");
        if (!fs.existsSync(wsContent)) continue;
        try {
            const apps = fs.readdirSync(wsContent).filter((x) => /^\d+$/.test(x));
            for (const app of apps) {
                if (targetAppid && app !== targetAppid) continue;
                const items = fs.readdirSync(path.join(wsContent, app)).filter((x) => /^\d+$/.test(x));
                found.push(`AppID ${app}: ${items.length} abone öğe`);
            }
        } catch {}
    }
    if (found.length === 0) return targetAppid ? `Bu oyun için yerel workshop aboneliği bulunamadı.` : "Yerel workshop aboneliği bulunamadı.";
    return `Workshop abonelikleri (yerel indirilmiş):\n${found.map((f) => "• " + f).join("\n")}`;
}

export async function steamOpenScreenshots(): Promise<string> {
    const {ok} = await ensureSteam();
    if (!ok) return "HATA: Steam kurulu değil.";
    await steamUrl("steam://open/screenshots");
    return "Steam ekran görüntüleri yöneticisi açıldı.";
}

export async function steamShowStorageUsage(): Promise<string> {
    const games = await getInstalledGames();
    if (games.length === 0) return "Yüklü oyun bulunamadı.";
    const sizes: {name: string; bytes: number}[] = [];
    for (const g of games) {
        if (!g.installdir) continue;
        const full = path.join(g.appsDir, "common", g.installdir);
        try {
            sizes.push({name: g.name, bytes: dirSizeSync(full)});
        } catch {}
    }
    sizes.sort((a, b) => b.bytes - a.bytes);
    const total = sizes.reduce((s, x) => s + x.bytes, 0);
    const top = sizes.slice(0, 15).map((x) => `• ${x.name}: ${fmtBytes(x.bytes)}`);
    return `Steam oyun disk kullanımı (toplam ${fmtBytes(total)}):\n${top.join("\n")}${sizes.length > 15 ? `\n… +${sizes.length - 15} oyun daha` : ""}`;
}

export async function steamLocateInstallation(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    const g = await resolveInstalledGame(nameOrId);
    if (!g || !g.installdir) return `"${nameOrId}" yüklü oyunlarda bulunamadı.`;
    const full = path.join(g.appsDir, "common", g.installdir);
    return fs.existsSync(full) ? `"${g.name}" kurulum klasörü:\n${full}` : `"${g.name}" kayıtlı ama klasör bulunamadı: ${full}`;
}

export async function steamOpenGameFolder(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    const g = await resolveInstalledGame(nameOrId);
    if (!g || !g.installdir) return `"${nameOrId}" yüklü oyunlarda bulunamadı.`;
    const full = path.join(g.appsDir, "common", g.installdir);
    if (!fs.existsSync(full)) return `Klasör bulunamadı: ${full}`;
    await run(`explorer "${full}"`, 5000);
    return `"${g.name}" klasörü açıldı.`;
}

export async function steamBackupGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    const g = await resolveInstalledGame(nameOrId);
    if (!g || !/^\d+$/.test(g.appid)) return `"${nameOrId}" yüklü oyunlarda bulunamadı.`;
    await steamUrl(`steam://backup/${g.appid}`);
    return `"${g.name}" için Steam yedekleme sihirbazı açıldı.`;
}

export async function steamRestoreBackup(): Promise<string> {
    const {ok, exe} = await ensureSteam();
    if (!ok) return "HATA: Steam kurulu değil.";
    // Steam'in geri yükleme arayüzü -install yedek seçimiyle açılır; en güvenilir yol UI
    await run(`"${exe}" steam://open/games`, 5000);
    return "Steam açıldı. Yedek geri yükleme için: Steam menüsü > Yedekle ve Geri Yükle > Önceki yedeği geri yükle.";
}

// ── Arkadaş / mesaj (steam:// protokolü) ──────────────────────────────────────
export async function steamOpenChat(friendId: string): Promise<string> {
    if (!/^\d+$/.test((friendId ?? "").trim())) return "HATA: Arkadaşın SteamID64'ü (sayı) gerekli. 'arkadaş listesi' ile ID'leri gör.";
    await steamUrl(`steam://friends/message/${friendId.trim()}`);
    return `Sohbet penceresi açıldı (${friendId.trim()}).`;
}

export async function steamSendMessage(friendId: string, _message: string): Promise<string> {
    // Steam dışarıdan mesaj göndermeyi (otomatik yazıp enter) desteklemez.
    // Sohbeti açıp kullanıcıyı yazmaya hazır hale getirmek tek güvenilir yol.
    if (!/^\d+$/.test((friendId ?? "").trim())) return "HATA: Arkadaşın SteamID64'ü gerekli.";
    await steamUrl(`steam://friends/message/${friendId.trim()}`);
    return `Sohbet penceresi açıldı (${friendId.trim()}). Mesajı kutuya yazıp gönder (Steam dışarıdan otomatik mesaj göndermeye izin vermiyor).`;
}

export async function steamRepeatLastAction(): Promise<string> {
    if (!lastSteamAction) return "Tekrarlanacak bir Steam işlemi yok.";
    return lastSteamAction.fn();
}

// ── Wishlist (steam:// + community) ───────────────────────────────────────────
export async function steamWishlistOpen(): Promise<string> {
    if (!steamId()) {
        await steamUrl("steam://openurl/https://store.steampowered.com/wishlist/");
        return "İstek listesi açıldı.";
    }
    await steamUrl(`steam://openurl/https://store.steampowered.com/wishlist/profiles/${steamId()}/`);
    return "İstek listen açıldı.";
}

export async function steamWishlistAdd(nameOrId: string, add: boolean): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    let appid = nameOrId.trim();
    if (!/^\d+$/.test(appid)) {
        const found = await steamStoreSearchRaw(nameOrId);
        if (!isErr(found) && found.length) appid = String(found[0].id);
    }
    if (!/^\d+$/.test(appid)) return `"${nameOrId}" mağazada bulunamadı.`;
    // Mağaza sayfasını aç; oradan tek tıkla wishlist'e ekle/çıkar (Steam anonim wishlist yazma API'si yok)
    await steamUrl(`steam://openurl/${STORE}/app/${appid}/`);
    return add
        ? `AppID ${appid} mağaza sayfası açıldı — '+ İstek Listesine Ekle'ye tıkla.`
        : `AppID ${appid} mağaza sayfası açıldı — istek listesinden çıkarmak için sayfadan kaldır.`;
}

export async function steamWishlistList(): Promise<string> {
    if (!apiKey()) return needKey();
    if (!steamId()) return needId();
    // Resmî public endpoint: IWishlistService (key ile) — değilse store JSON fallback
    try {
        const res = await fetch(`${STORE}/wishlist/profiles/${steamId()}/wishlistdata/?p=0`);
        if (res.ok) {
            const data = (await res.json()) as Record<string, any>;
            const entries = Object.entries(data);
            if (entries.length === 0) return "İstek listen boş.";
            const lines = entries.slice(0, 30).map(([id, v]) => `• ${v?.name ?? "?"} (${id})`);
            await steamWishlistOpen();
            return `İstek listen (${entries.length}):\n${lines.join("\n")}${entries.length > 30 ? `\n… +${entries.length - 30} daha` : ""}`;
        }
    } catch {}
    await steamWishlistOpen();
    return "İstek listesi sayfanı açtım (profil gizliyse liste API'den okunamıyor).";
}

// ════════════════════════════════════════════════════════════════════════════
// WEB API — key + SteamID gerekir
// ════════════════════════════════════════════════════════════════════════════

export async function steamGetOwnedGames(): Promise<string> {
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    if (games.length === 0) return "Hiç oyun bulunamadı (profil gizli olabilir).";
    const sorted = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever);
    const lines = sorted.slice(0, 30).map((g) => `• ${g.name} — ${fmtMinutes(g.playtime_forever)}`);
    return `Sahip olduğun oyunlar (${games.length}):\n${lines.join("\n")}${games.length > 30 ? `\n… +${games.length - 30} daha` : ""}`;
}

export async function steamSearchOwnedGames(query: string): Promise<string> {
    if (!query) return "HATA: Arama terimi gerekli.";
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    const scored = games.map((g) => ({g, s: fuzzyMatch(query, g.name)})).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    if (scored.length === 0) return `Kütüphanende "${query}" ile eşleşen oyun yok.`;
    const lines = scored.slice(0, 10).map((x) => `• ${x.g.name} (${x.g.appid}) — ${fmtMinutes(x.g.playtime_forever)}`);
    return `"${query}" araması:\n${lines.join("\n")}`;
}

export async function steamGetRecentGames(): Promise<string> {
    if (!steamId()) return needId();
    const data = await apiGet<{response?: {games?: any[]}}>("/IPlayerService/GetRecentlyPlayedGames/v1/", {steamid: steamId()});
    if (isErr(data)) return data.error;
    const games = data.response?.games ?? [];
    if (games.length === 0) return "Son 2 haftada oynanan oyun yok.";
    const lines = games.map((g: any) => `• ${g.name} — son 2 hafta: ${fmtMinutes(g.playtime_2weeks ?? 0)}, toplam: ${fmtMinutes(g.playtime_forever)}`);
    return `Son oynanan oyunlar:\n${lines.join("\n")}`;
}

export async function steamGetMostPlayed(): Promise<string> {
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    const sorted = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 10);
    if (sorted.length === 0) return "Oynama verisi yok.";
    const lines = sorted.map((g, i) => `${i + 1}. ${g.name} — ${fmtMinutes(g.playtime_forever)}`);
    return `En çok oynanan oyunlar:\n${lines.join("\n")}`;
}

export async function steamGetGamePlaytime(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı gerekli.";
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    let g;
    if (/^\d+$/.test(nameOrId.trim())) g = games.find((x) => String(x.appid) === nameOrId.trim());
    else {
        const scored = games.map((x) => ({x, s: fuzzyMatch(nameOrId, x.name)})).filter((y) => y.s > 0).sort((a, b) => b.s - a.s);
        g = scored.length ? scored[0].x : undefined;
    }
    if (!g) return `"${nameOrId}" kütüphanende bulunamadı.`;
    return `"${g.name}" toplam oynama süresi: ${fmtMinutes(g.playtime_forever)}.`;
}

export async function steamGetTotalPlaytime(): Promise<string> {
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    const total = games.reduce((s, g) => s + (g.playtime_forever ?? 0), 0);
    return `Toplam Steam oynama süren: ${fmtMinutes(total)} (${games.length} oyun arasında).`;
}

export async function steamSuggestGame(): Promise<string> {
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    if (games.length === 0) return "Kütüphanende oyun yok.";
    // Sahip olunan ama az oynanan (≤60dk) oyunlardan rastgele öner
    const unplayed = games.filter((g) => (g.playtime_forever ?? 0) <= 60);
    const pool = unplayed.length >= 3 ? unplayed : games;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const reason = (pick.playtime_forever ?? 0) <= 60 ? "neredeyse hiç oynamamışsın" : `${fmtMinutes(pick.playtime_forever)} oynamışsın`;
    return `Öneri: "${pick.name}" (${reason}). Açmak için: "${pick.name} başlat".`;
}

export async function steamGetGameAchievements(nameOrId: string): Promise<string> {
    if (!steamId()) return needId();
    const appid = await resolveAppidForApi(nameOrId);
    if (!appid) return `"${nameOrId}" için AppID bulunamadı.`;
    const data = await apiGet<{playerstats?: any}>("/ISteamUserStats/GetPlayerAchievements/v1/", {steamid: steamId(), appid, l: "turkish"});
    if (isErr(data)) return data.error;
    const ps2 = data.playerstats;
    if (!ps2 || ps2.success === false) return `"${nameOrId}" için başarım verisi yok (oyun başarım desteklemiyor olabilir).`;
    const achs = ps2.achievements ?? [];
    const unlocked = achs.filter((a: any) => a.achieved === 1);
    const lines = unlocked.slice(0, 15).map((a: any) => `✓ ${a.name ?? a.apiname}`);
    return `"${ps2.gameName ?? nameOrId}" başarımları: ${unlocked.length}/${achs.length} açık.\n${lines.join("\n")}${unlocked.length > 15 ? `\n…` : ""}`;
}

export async function steamGetAchievementProgress(nameOrId: string): Promise<string> {
    if (!steamId()) return needId();
    const appid = await resolveAppidForApi(nameOrId);
    if (!appid) return `"${nameOrId}" için AppID bulunamadı.`;
    const data = await apiGet<{playerstats?: any}>("/ISteamUserStats/GetPlayerAchievements/v1/", {steamid: steamId(), appid});
    if (isErr(data)) return data.error;
    const achs = data.playerstats?.achievements ?? [];
    if (achs.length === 0) return `"${nameOrId}" başarım verisi yok.`;
    const unlocked = achs.filter((a: any) => a.achieved === 1).length;
    const pct = Math.round((unlocked / achs.length) * 100);
    return `"${nameOrId}" başarım ilerlemesi: ${unlocked}/${achs.length} (%${pct}).`;
}

export async function steamGetPlayerStats(nameOrId: string): Promise<string> {
    if (!steamId()) return needId();
    const appid = await resolveAppidForApi(nameOrId);
    if (!appid) return `"${nameOrId}" için AppID bulunamadı.`;
    const data = await apiGet<{playerstats?: any}>("/ISteamUserStats/GetUserStatsForGame/v2/", {steamid: steamId(), appid});
    if (isErr(data)) return data.error;
    const stats = data.playerstats?.stats ?? [];
    if (stats.length === 0) return `"${nameOrId}" için istatistik bulunamadı.`;
    const lines = stats.slice(0, 20).map((s: any) => `• ${s.name}: ${s.value}`);
    return `"${data.playerstats?.gameName ?? nameOrId}" istatistikleri:\n${lines.join("\n")}`;
}

export async function steamGetProfileSummary(): Promise<string> {
    if (!steamId()) return needId();
    const data = await apiGet<{response?: {players?: any[]}}>("/ISteamUser/GetPlayerSummaries/v2/", {steamids: steamId()});
    if (isErr(data)) return data.error;
    const p = data.response?.players?.[0];
    if (!p) return "Profil bulunamadı.";
    const states = ["Çevrimdışı", "Çevrimiçi", "Meşgul", "Uzakta", "Uyuyor", "Takasa hazır", "Oynamaya hazır"];
    const parts = [`Profil: ${p.personaname}`];
    if (p.personastate !== undefined) parts.push(`Durum: ${states[p.personastate] ?? "?"}`);
    if (p.gameextrainfo) parts.push(`Şu an oynuyor: ${p.gameextrainfo}`);
    if (p.loccountrycode) parts.push(`Ülke: ${p.loccountrycode}`);
    return parts.join("\n");
}

export async function steamGetLevel(): Promise<string> {
    if (!steamId()) return needId();
    const data = await apiGet<{response?: {player_level?: number}}>("/IPlayerService/GetSteamLevel/v1/", {steamid: steamId()});
    if (isErr(data)) return data.error;
    const lvl = data.response?.player_level;
    return lvl !== undefined ? `Steam seviyen: ${lvl}.` : "Seviye bilgisi alınamadı.";
}

// Arkadaşların özetini (isim+durum) toplu çek
async function friendSummaries(steamids: string[]): Promise<any[]> {
    if (steamids.length === 0) return [];
    const out: any[] = [];
    for (let i = 0; i < steamids.length; i += 100) {
        const batch = steamids.slice(i, i + 100);
        const data = await apiGet<{response?: {players?: any[]}}>("/ISteamUser/GetPlayerSummaries/v2/", {steamids: batch.join(",")});
        if (!isErr(data)) out.push(...(data.response?.players ?? []));
    }
    return out;
}

export async function steamGetFriendList(): Promise<string> {
    if (!steamId()) return needId();
    const data = await apiGet<{friendslist?: {friends?: any[]}}>("/ISteamUser/GetFriendList/v1/", {steamid: steamId(), relationship: "friend"});
    if (isErr(data)) return data.error;
    const friends = data.friendslist?.friends ?? [];
    if (friends.length === 0) return "Arkadaş listen boş veya gizli.";
    const sums = await friendSummaries(friends.map((f: any) => f.steamid));
    const lines = sums.slice(0, 40).map((p) => `• ${p.personaname} (${p.steamid})`);
    return `Arkadaşların (${friends.length}):\n${lines.join("\n")}${friends.length > 40 ? `\n… +${friends.length - 40} daha` : ""}`;
}

export async function steamGetOnlineFriends(): Promise<string> {
    if (!steamId()) return needId();
    const data = await apiGet<{friendslist?: {friends?: any[]}}>("/ISteamUser/GetFriendList/v1/", {steamid: steamId(), relationship: "friend"});
    if (isErr(data)) return data.error;
    const friends = data.friendslist?.friends ?? [];
    const sums = await friendSummaries(friends.map((f: any) => f.steamid));
    const online = sums.filter((p) => p.personastate && p.personastate !== 0);
    if (online.length === 0) return "Şu an çevrimiçi arkadaşın yok.";
    const lines = online.map((p) => `• ${p.personaname}${p.gameextrainfo ? ` — ${p.gameextrainfo} oynuyor` : ""}`);
    return `Çevrimiçi arkadaşlar (${online.length}):\n${lines.join("\n")}`;
}

export async function steamGetFriendCurrentGame(friendNameOrId: string): Promise<string> {
    if (!friendNameOrId) return "HATA: Arkadaş adı veya SteamID gerekli.";
    if (!steamId()) return needId();
    const data = await apiGet<{friendslist?: {friends?: any[]}}>("/ISteamUser/GetFriendList/v1/", {steamid: steamId(), relationship: "friend"});
    if (isErr(data)) return data.error;
    const friends = data.friendslist?.friends ?? [];
    const sums = await friendSummaries(friends.map((f: any) => f.steamid));
    let p;
    if (/^\d+$/.test(friendNameOrId.trim())) p = sums.find((x) => x.steamid === friendNameOrId.trim());
    else p = sums.find((x) => (x.personaname ?? "").toLowerCase().includes(friendNameOrId.toLowerCase()));
    if (!p) return `"${friendNameOrId}" arkadaşların arasında bulunamadı.`;
    return p.gameextrainfo ? `${p.personaname} şu an "${p.gameextrainfo}" oynuyor.` : `${p.personaname} şu an oyun oynamıyor.`;
}

export async function steamWhoIsPlaying(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı gerekli.";
    if (!steamId()) return needId();
    const data = await apiGet<{friendslist?: {friends?: any[]}}>("/ISteamUser/GetFriendList/v1/", {steamid: steamId(), relationship: "friend"});
    if (isErr(data)) return data.error;
    const friends = data.friendslist?.friends ?? [];
    const sums = await friendSummaries(friends.map((f: any) => f.steamid));
    const q = nameOrId.toLowerCase();
    const playing = sums.filter((p) => (p.gameextrainfo ?? "").toLowerCase().includes(q));
    if (playing.length === 0) return `Şu an "${nameOrId}" oynayan arkadaşın yok.`;
    return `"${nameOrId}" oynayanlar: ${playing.map((p) => p.personaname).join(", ")}.`;
}

export async function steamGetLastPlayed(): Promise<string> {
    if (!steamId()) return needId();
    const data = await apiGet<{response?: {games?: any[]}}>("/IPlayerService/GetRecentlyPlayedGames/v1/", {steamid: steamId(), count: 1});
    if (isErr(data)) return data.error;
    const g = data.response?.games?.[0];
    if (!g) return "Son oynanan oyun bilgisi yok.";
    return `En son oynadığın oyun: "${g.name}" (son 2 hafta: ${fmtMinutes(g.playtime_2weeks ?? 0)}).`;
}

// resolveAppidForApi: isim → appid (önce yüklü, sonra owned, sonra store)
async function resolveAppidForApi(nameOrId: string): Promise<string | null> {
    if (/^\d+$/.test((nameOrId ?? "").trim())) return nameOrId.trim();
    const inst = await resolveInstalledGame(nameOrId);
    if (inst && /^\d+$/.test(inst.appid)) return inst.appid;
    const owned = await getOwnedGamesRaw();
    if (!isErr(owned)) {
        const scored = owned.map((g) => ({g, s: fuzzyMatch(nameOrId, g.name)})).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
        if (scored.length) return String(scored[0].g.appid);
    }
    const store = await steamStoreSearchRaw(nameOrId);
    if (!isErr(store) && store.length) return String(store[0].id);
    return null;
}

// ════════════════════════════════════════════════════════════════════════════
// STOREFRONT — key gerekmez
// ════════════════════════════════════════════════════════════════════════════

async function steamStoreSearchRaw(query: string): Promise<{id: number; name: string}[] | {error: string}> {
    try {
        const res = await fetch(`${STORE}/api/storesearch/?term=${encodeURIComponent(query)}&l=turkish&cc=TR`);
        if (!res.ok) return {error: `Mağaza arama ${res.status}`};
        const data = (await res.json()) as {items?: any[]};
        return (data.items ?? []).map((i) => ({id: i.id, name: i.name}));
    } catch (e: any) {
        return {error: `Mağaza arama başarısız: ${e?.message ?? e}`};
    }
}

export async function steamSearchStore(query: string): Promise<string> {
    if (!query) return "HATA: Arama terimi gerekli.";
    const items = await steamStoreSearchRaw(query);
    if (isErr(items)) return items.error;
    if (items.length === 0) return `Mağazada "${query}" için sonuç yok.`;
    const lines = items.slice(0, 10).map((i) => `• ${i.name} (${i.id})`);
    return `Mağaza araması "${query}":\n${lines.join("\n")}`;
}

async function appDetails(appid: string): Promise<any | {error: string}> {
    try {
        const res = await fetch(`${STORE}/api/appdetails?appids=${appid}&l=turkish&cc=TR`);
        if (!res.ok) return {error: `appdetails ${res.status}`};
        const data = (await res.json()) as Record<string, any>;
        const entry = data[appid];
        if (!entry?.success) return {error: "Oyun detayı bulunamadı."};
        return entry.data;
    } catch (e: any) {
        return {error: `appdetails başarısız: ${e?.message ?? e}`};
    }
}

export async function steamGetGameDetails(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    let appid = nameOrId.trim();
    if (!/^\d+$/.test(appid)) {
        const found = await steamStoreSearchRaw(nameOrId);
        if (isErr(found) || found.length === 0) return `"${nameOrId}" mağazada bulunamadı.`;
        appid = String(found[0].id);
    }
    const d = await appDetails(appid);
    if (isErr(d)) return d.error;
    const parts = [`${d.name} (${appid})`];
    if (d.short_description) parts.push(d.short_description);
    if (d.developers?.length) parts.push(`Geliştirici: ${d.developers.join(", ")}`);
    if (d.release_date?.date) parts.push(`Çıkış: ${d.release_date.date}`);
    if (d.genres?.length) parts.push(`Tür: ${d.genres.map((g: any) => g.description).join(", ")}`);
    if (d.metacritic?.score) parts.push(`Metacritic: ${d.metacritic.score}`);
    if (d.price_overview) parts.push(`Fiyat: ${d.price_overview.final_formatted}${d.price_overview.discount_percent ? ` (%${d.price_overview.discount_percent} indirim)` : ""}`);
    else if (d.is_free) parts.push("Fiyat: Ücretsiz");
    return parts.join("\n");
}

export async function steamGetGamePrice(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    let appid = nameOrId.trim();
    let name = nameOrId;
    if (!/^\d+$/.test(appid)) {
        const found = await steamStoreSearchRaw(nameOrId);
        if (isErr(found) || found.length === 0) return `"${nameOrId}" mağazada bulunamadı.`;
        appid = String(found[0].id);
        name = found[0].name;
    }
    const d = await appDetails(appid);
    if (isErr(d)) return d.error;
    if (d.is_free) return `"${d.name}" ücretsiz.`;
    const p = d.price_overview;
    if (!p) return `"${d.name ?? name}" için fiyat bilgisi yok (yakında çıkacak olabilir).`;
    return p.discount_percent
        ? `"${d.name}": ${p.final_formatted} (normal ${p.initial_formatted}, %${p.discount_percent} indirim).`
        : `"${d.name}": ${p.final_formatted}.`;
}

export async function steamGetDiscountedGames(): Promise<string> {
    // Storefront featuredcategories → specials
    try {
        const res = await fetch(`${STORE}/api/featuredcategories?l=turkish&cc=TR`);
        if (!res.ok) return `İndirim listesi alınamadı (${res.status}).`;
        const data = (await res.json()) as any;
        const items = data?.specials?.items ?? [];
        if (items.length === 0) return "Şu an öne çıkan indirim bulunamadı.";
        const lines = items.slice(0, 15).map((i: any) => {
            const final = (i.final_price ?? 0) / 100;
            const cur = i.currency ?? "TRY";
            return `• ${i.name} — %${i.discount_percent} indirim → ${final.toFixed(2)} ${cur}`;
        });
        return `Öne çıkan indirimler:\n${lines.join("\n")}`;
    } catch (e: any) {
        return `İndirim listesi başarısız: ${e?.message ?? e}`;
    }
}

export async function steamGetGameNews(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Oyun adı veya AppID gerekli.";
    let appid = nameOrId.trim();
    if (!/^\d+$/.test(appid)) {
        const r = await resolveAppidForApi(nameOrId);
        if (!r) return `"${nameOrId}" bulunamadı.`;
        appid = r;
    }
    try {
        const res = await fetch(`${API}/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=5&maxlength=200&format=json`);
        if (!res.ok) return `Haber alınamadı (${res.status}).`;
        const data = (await res.json()) as any;
        const items = data?.appnews?.newsitems ?? [];
        if (items.length === 0) return "Bu oyun için haber bulunamadı.";
        const lines = items.map((n: any) => `• ${n.title}\n  ${(n.contents ?? "").replace(/\s+/g, " ").trim().slice(0, 140)}…`);
        return `Haberler (AppID ${appid}):\n${lines.join("\n\n")}`;
    } catch (e: any) {
        return `Haber başarısız: ${e?.message ?? e}`;
    }
}

// ── Screenshot (Steam'in kendi ekran görüntüsü) ───────────────────────────────
export async function steamTakeScreenshot(): Promise<string> {
    // Steam'in F12 ekran görüntüsü kısayolu yalnızca oyun içi global hook ile çalışır;
    // dışarıdan tetiklenemez. Çalışan oyun varsa F12 simüle etmeyi dener, yoksa açıklar.
    const running = await steamListRunningGames();
    if (running.startsWith("Şu an çalışan")) {
        return "Steam ekran görüntüsü almak için bir oyun çalışıyor olmalı (Steam F12'yi yalnızca oyun içinde yakalar). Genel ekran görüntüsü için 'ekran görüntüsü al' tool'unu kullan.";
    }
    await ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{F12}")`);
    return "Steam overlay'ine F12 gönderildi. Görüntüyü 'steam ekran görüntülerini aç' ile görebilirsin.";
}
