import {exec as execCb} from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function run(cmd: string, timeoutMs = 15000): Promise<string> {
    return new Promise((resolve) => {
        execCb(cmd, {timeout: timeoutMs, windowsHide: true}, (err, stdout, stderr) => {
            const out = (stdout ?? "").trim();
            if (err && !out) resolve(`ERROR: ${err.message}${stderr ? "\n" + stderr.trim() : ""}`);
            else resolve(out || "(ok)");
        });
    });
}

function ps(script: string): Promise<string> {
    return new Promise((resolve) => {
        execCb(`powershell -NoProfile -NonInteractive -Command -`, {timeout: 15000, windowsHide: true}, (err, stdout, stderr) => {
            const out = (stdout ?? "").trim();
            if (err && !out) resolve(`ERROR: ${err.message}${stderr ? "\n" + stderr.trim() : ""}`);
            else resolve(out || "(ok)");
        }).stdin?.end(script);
    });
}

// Open a steam:// protocol URL (via the Windows shell)
async function steamUrl(url: string): Promise<void> {
    await run(`cmd /c start "" "${url}"`, 5000);
}

// ── Web API helpers ───────────────────────────────────────────────────────────
const API = "https://api.steampowered.com";
const STORE = "https://store.steampowered.com";

function apiKey(): string {
    return (process.env.STEAM_API_KEY ?? "").trim();
}
function steamId(): string {
    return (process.env.STEAM_ID64 ?? "").trim();
}
function needKey(): string {
    return "ERROR: Steam Web API key is not set. Enter your 'Steam API Key' under Settings > API Keys (steamcommunity.com/dev/apikey).";
}
function needId(): string {
    return "ERROR: SteamID64 is not set. Enter your 64-bit SteamID under Settings > API Keys (you can find it via steamid.io).";
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
        return {error: `Steam API request failed: ${e?.message ?? e}`};
    }
}

function isErr(x: any): x is {error: string} {
    return x && typeof x === "object" && typeof x.error === "string";
}

function fmtMinutes(min: number): string {
    if (!min || min < 1) return "0 hours";
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
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

// Find the Steam installation path
async function findSteamExe(): Promise<string | null> {
    const candidates = [
        "C:\\Program Files (x86)\\Steam\\steam.exe",
        "C:\\Program Files\\Steam\\steam.exe",
        path.join(os.homedir(), "AppData\\Local\\Steam\\steam.exe"),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    // Try the registry
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
        // Launch Steam, wait until both steam.exe and steamwebhelper.exe appear (max 30s)
        execCb(`"${exe}"`, {windowsHide: false}, () => {});
        for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            if ((await steamRunning()) && (await steamWebHelperRunning())) break;
        }
        // Even once steamwebhelper is ready, wait a few more seconds for the UI login
        await new Promise((r) => setTimeout(r, 4000));
    }
    return {ok: true, exe, wasRunning};
}

// Find the Steam steamapps folders
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

// Installed game list from Steam appmanifests (appid → name, folder)
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

// Find the best name match among installed games
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

// All owned games via the Web API (appid → name) — for library search
async function getOwnedGamesRaw(): Promise<{appid: number; name: string; playtime_forever: number; rtime_last_played?: number}[] | {error: string}> {
    if (!steamId()) return {error: needId()};
    const data = await apiGet<{response?: {games?: any[]}}>("/IPlayerService/GetOwnedGames/v1/", {
        steamid: steamId(),
        include_appinfo: 1,
        include_played_free_games: 1,
    });
    if (isErr(data)) return data;
    const games = data.response?.games;
    if (!games) return {error: "Could not fetch the game list. If the profile is private, 'Game details' must be public."};
    return games;
}

// ── Last-action memory (for repeat_last_steam_action) ─────────────────────────
let lastSteamAction: {fn: () => Promise<string>; label: string} | null = null;
function remember(label: string, fn: () => Promise<string>) {
    lastSteamAction = {fn, label};
}

// ════════════════════════════════════════════════════════════════════════════
// LOCAL / PROTOCOL — no key required
// ════════════════════════════════════════════════════════════════════════════

export async function steamOpen(): Promise<string> {
    const {ok, exe} = await ensureSteam();
    if (!ok) return "ERROR: Steam is not installed.";
    await ps(`$p = Get-Process -Name steam -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
if ($p) { Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id) }
else { Start-Process "${exe.replace(/\\/g, "\\\\")}" }`);
    return "Steam opened.";
}

export async function steamClose(): Promise<string> {
    if (!(await steamRunning())) return "Steam is already closed.";
    await steamUrl("steam://exit");
    return "Closing Steam.";
}

export async function steamRestart(): Promise<string> {
    const wasRunning = await steamRunning();
    if (wasRunning) {
        await steamUrl("steam://exit");
        // wait for it to fully close (max 15s)
        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            if (!(await steamRunning())) break;
        }
    }
    const {ok} = await ensureSteam();
    return ok ? "Steam restarted." : "ERROR: Steam could not be restarted.";
}

export async function steamLaunchGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    const {ok} = await ensureSteam();
    if (!ok) return "ERROR: Steam is not installed or could not be found.";

    if (/^\d+$/.test(nameOrId.trim())) {
        const id = nameOrId.trim();
        await steamUrl(`steam://rungameid/${id}`);
        remember(`launch AppID ${id}`, () => steamLaunchGame(id));
        return `AppID ${id} launched.`;
    }
    const g = await resolveInstalledGame(nameOrId);
    if (!g) return `No installed game named "${nameOrId}" was found. Check with "steam game list".`;
    await steamUrl(`steam://rungameid/${g.appid}`);
    remember(`launch "${g.name}"`, () => steamLaunchGame(g.appid));
    return `Launching "${g.name}" (AppID: ${g.appid}).`;
}

export async function steamCloseGame(_nameOrId?: string): Promise<string> {
    // Find and close the running game process (param kept for signature compatibility)
    const out = await ps(
        "Get-Process | Where-Object { $_.Path -like '*steamapps*common*' } | Select-Object -ExpandProperty Id"
    );
    const ids = out.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^\d+$/.test(s));
    if (ids.length === 0) return "No Steam game is currently running.";
    for (const id of ids) await run(`taskkill /PID ${id} /F`, 5000);
    return `Running game closed (${ids.length} process(es)).`;
}

export async function steamRestartGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    await steamCloseGame(nameOrId);
    await new Promise((r) => setTimeout(r, 2000));
    return steamLaunchGame(nameOrId);
}

export async function steamListGames(): Promise<string> {
    const games = await getInstalledGames();
    if (games.length === 0) return "No installed games found. Is Steam installed?";
    const sorted = games.sort((a, b) => a.name.localeCompare(b.name));
    const lines = sorted.map((g) => `• ${g.name} (${g.appid})`);
    return `Installed Steam games (${games.length}):\n${lines.join("\n")}`;
}

export async function steamListRunningGames(): Promise<string> {
    const out = await ps(
        "Get-Process | Where-Object { $_.Path -like '*steamapps*common*' } | Select-Object -ExpandProperty Name -Unique"
    );
    const names = out.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && s !== "(ok)");
    if (names.length === 0) return "No Steam game is currently running.";
    return `Running game(s): ${names.join(", ")}`;
}

export async function steamGameRunning(): Promise<string> {
    return steamListRunningGames();
}

export async function steamIsGameRunning(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name is required.";
    const out = await ps(
        "Get-Process | Where-Object { $_.Path -like '*steamapps*common*' } | Select-Object -ExpandProperty Name -Unique"
    );
    const names = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const q = nameOrId.toLowerCase().replace(/\s+/g, "");
    const hit = names.find((n) => n.toLowerCase().replace(/\s+/g, "").includes(q) || q.includes(n.toLowerCase().replace(/\s+/g, "")));
    return hit ? `Yes, "${hit}" is currently running.` : `No, "${nameOrId}" is not currently running.`;
}

export async function steamInstallGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    let appid = nameOrId.trim();
    if (!/^\d+$/.test(appid)) {
        // If a name was given, find the appid via the Web API (all owned games)
        const owned = await getOwnedGamesRaw();
        if (!isErr(owned)) {
            const scored = owned.map((g) => ({g, s: fuzzyMatch(nameOrId, g.name)})).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
            if (scored.length) appid = String(scored[0].g.appid);
        }
        if (!/^\d+$/.test(appid)) return `Could not find an AppID for "${nameOrId}". Try with an AppID or set a Steam API key.`;
    }
    await steamUrl(`steam://install/${appid}`);
    remember(`install AppID ${appid}`, () => steamInstallGame(appid));
    return `Install window opened for AppID ${appid}. Confirm 'Install' in Steam.`;
}

export async function steamUninstallGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    const g = await resolveInstalledGame(nameOrId);
    const appid = g ? g.appid : nameOrId.trim();
    if (!/^\d+$/.test(appid)) return `"${nameOrId}" was not found among installed games.`;
    await steamUrl(`steam://uninstall/${appid}`);
    return `${g ? `"${g.name}"` : `AppID ${appid}`} uninstall window opened.`;
}

export async function steamVerifyGameFiles(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    const g = await resolveInstalledGame(nameOrId);
    if (!g || !/^\d+$/.test(g.appid)) return `"${nameOrId}" was not found among installed games.`;
    await steamUrl(`steam://validate/${g.appid}`);
    return `File integrity verification started for "${g.name}".`;
}

export async function steamUpdateGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    const g = await resolveInstalledGame(nameOrId);
    if (!g || !/^\d+$/.test(g.appid)) return `"${nameOrId}" was not found among installed games.`;
    // The Steam install URL triggers an update/repair on an already-installed game
    await steamUrl(`steam://install/${g.appid}`);
    return `Update check started for "${g.name}" (download starts if one is available).`;
}

export async function steamOpenDownloads(): Promise<string> {
    const {ok} = await ensureSteam();
    if (!ok) return "ERROR: Steam is not installed.";
    await steamUrl("steam://open/downloads");
    return "Steam download manager opened.";
}

export async function steamDownloadStatus(): Promise<string> {
    // Active downloads can be detected on disk via the downloading folder
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
    if (downloading.length === 0) return "No active download visible. I opened the download manager — please check.";
    // map appid → name
    const games = await getInstalledGames();
    const names = downloading.map((id) => {
        const g = games.find((x) => x.appid === id);
        return g ? `${g.name} (${id})` : `AppID ${id}`;
    });
    return `Downloading/updating: ${names.join(", ")}. I opened the download manager for details.`;
}

export async function steamPauseResumeCancel(action: "pause" | "resume" | "cancel"): Promise<string> {
    // Steam does not expose an external API to pause a single download; opening the
    // download manager and pointing the user to the right place is the only reliable way.
    await steamOpenDownloads();
    const label = action === "pause" ? "pause" : action === "resume" ? "resume" : "cancel";
    return `I opened the download manager. ${label} the download there (Steam doesn't allow external per-download control, but you can do it with one click here).`;
}

export async function steamOpenStorePage(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    if (/^\d+$/.test(nameOrId.trim())) {
        await steamUrl(`steam://store/${nameOrId.trim()}`);
        return `Store page opened (AppID ${nameOrId.trim()}).`;
    }
    // Search by name → appid of the first result
    const found = await steamStoreSearchRaw(nameOrId);
    if (isErr(found) || found.length === 0) return `No store page found for "${nameOrId}".`;
    await steamUrl(`steam://store/${found[0].id}`);
    return `Store page opened for "${found[0].name}".`;
}

export async function steamOpenWorkshop(nameOrId?: string): Promise<string> {
    if (nameOrId && /^\d+$/.test(nameOrId.trim())) {
        await steamUrl(`steam://url/SteamWorkshopPage/${nameOrId.trim()}`);
        return `Workshop page opened (AppID ${nameOrId.trim()}).`;
    }
    if (nameOrId) {
        const g = await resolveInstalledGame(nameOrId);
        if (g) {
            await steamUrl(`steam://url/SteamWorkshopPage/${g.appid}`);
            return `Workshop page opened for "${g.name}".`;
        }
    }
    await steamUrl("steam://url/SteamWorkshop");
    return "Steam Workshop opened.";
}

export async function steamWorkshopSubscribe(workshopId: string, subscribe: boolean): Promise<string> {
    if (!/^\d+$/.test((workshopId ?? "").trim())) return "ERROR: A Workshop item ID (number) is required.";
    const id = workshopId.trim();
    // Open the item page via steam://openurl; the Steam client shows the subscribe button.
    // The community URL is the most reliable for direct subscription.
    await steamUrl(`steam://openurl/https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`);
    return subscribe
        ? `Workshop item ${id} opened — click 'Subscribe' (Steam doesn't allow silent external subscription).`
        : `Workshop item ${id} opened — click 'Unsubscribe'.`;
}

export async function steamListWorkshopSubs(nameOrId?: string): Promise<string> {
    // Locally, subscribed content lives under workshop/content/<appid>
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
                found.push(`AppID ${app}: ${items.length} subscribed item(s)`);
            }
        } catch {}
    }
    if (found.length === 0) return targetAppid ? `No local workshop subscription found for this game.` : "No local workshop subscription found.";
    return `Workshop subscriptions (locally downloaded):\n${found.map((f) => "• " + f).join("\n")}`;
}

export async function steamOpenScreenshots(): Promise<string> {
    const {ok} = await ensureSteam();
    if (!ok) return "ERROR: Steam is not installed.";
    await steamUrl("steam://open/screenshots");
    return "Steam screenshot manager opened.";
}

export async function steamShowStorageUsage(): Promise<string> {
    const games = await getInstalledGames();
    if (games.length === 0) return "No installed games found.";
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
    return `Steam game disk usage (total ${fmtBytes(total)}):\n${top.join("\n")}${sizes.length > 15 ? `\n… +${sizes.length - 15} more games` : ""}`;
}

export async function steamLocateInstallation(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    const g = await resolveInstalledGame(nameOrId);
    if (!g || !g.installdir) return `"${nameOrId}" was not found among installed games.`;
    const full = path.join(g.appsDir, "common", g.installdir);
    return fs.existsSync(full) ? `"${g.name}" install folder:\n${full}` : `"${g.name}" is registered but the folder was not found: ${full}`;
}

export async function steamOpenGameFolder(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    const g = await resolveInstalledGame(nameOrId);
    if (!g || !g.installdir) return `"${nameOrId}" was not found among installed games.`;
    const full = path.join(g.appsDir, "common", g.installdir);
    if (!fs.existsSync(full)) return `Folder not found: ${full}`;
    await run(`explorer "${full}"`, 5000);
    return `Opened the "${g.name}" folder.`;
}

export async function steamBackupGame(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    const g = await resolveInstalledGame(nameOrId);
    if (!g || !/^\d+$/.test(g.appid)) return `"${nameOrId}" was not found among installed games.`;
    await steamUrl(`steam://backup/${g.appid}`);
    return `Steam backup wizard opened for "${g.name}".`;
}

export async function steamRestoreBackup(): Promise<string> {
    const {ok, exe} = await ensureSteam();
    if (!ok) return "ERROR: Steam is not installed.";
    // Steam's restore UI opens with the -install backup selection; the UI is the most reliable path
    await run(`"${exe}" steam://open/games`, 5000);
    return "Steam opened. To restore a backup: Steam menu > Backup and Restore > Restore a previous backup.";
}

// ── Friends / messaging (steam:// protocol) ───────────────────────────────────
export async function steamOpenChat(friendId: string): Promise<string> {
    if (!/^\d+$/.test((friendId ?? "").trim())) return "ERROR: Your friend's SteamID64 (number) is required. Use 'friend list' to see the IDs.";
    await steamUrl(`steam://friends/message/${friendId.trim()}`);
    return `Chat window opened (${friendId.trim()}).`;
}

export async function steamSendMessage(friendId: string, _message: string): Promise<string> {
    // Steam does not support sending messages externally (auto-typing + enter).
    // Opening the chat and getting the user ready to type is the only reliable way.
    if (!/^\d+$/.test((friendId ?? "").trim())) return "ERROR: Your friend's SteamID64 is required.";
    await steamUrl(`steam://friends/message/${friendId.trim()}`);
    return `Chat window opened (${friendId.trim()}). Type your message in the box and send it (Steam doesn't allow sending messages automatically from outside).`;
}

export async function steamRepeatLastAction(): Promise<string> {
    if (!lastSteamAction) return "There is no Steam action to repeat.";
    return lastSteamAction.fn();
}

// ── Wishlist (steam:// + community) ───────────────────────────────────────────
export async function steamWishlistOpen(): Promise<string> {
    if (!steamId()) {
        await steamUrl("steam://openurl/https://store.steampowered.com/wishlist/");
        return "Wishlist opened.";
    }
    await steamUrl(`steam://openurl/https://store.steampowered.com/wishlist/profiles/${steamId()}/`);
    return "Your wishlist opened.";
}

export async function steamWishlistAdd(nameOrId: string, add: boolean): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    let appid = nameOrId.trim();
    if (!/^\d+$/.test(appid)) {
        const found = await steamStoreSearchRaw(nameOrId);
        if (!isErr(found) && found.length) appid = String(found[0].id);
    }
    if (!/^\d+$/.test(appid)) return `"${nameOrId}" was not found in the store.`;
    // Open the store page; from there add/remove from wishlist with one click (Steam has no anonymous wishlist-write API)
    await steamUrl(`steam://openurl/${STORE}/app/${appid}/`);
    return add
        ? `Store page for AppID ${appid} opened — click '+ Add to your Wishlist'.`
        : `Store page for AppID ${appid} opened — remove it from the page to take it off your wishlist.`;
}

export async function steamWishlistList(): Promise<string> {
    if (!apiKey()) return needKey();
    if (!steamId()) return needId();
    // Official public endpoint: IWishlistService (with key) — otherwise store JSON fallback
    try {
        const res = await fetch(`${STORE}/wishlist/profiles/${steamId()}/wishlistdata/?p=0`);
        if (res.ok) {
            const data = (await res.json()) as Record<string, any>;
            const entries = Object.entries(data);
            if (entries.length === 0) return "Your wishlist is empty.";
            const lines = entries.slice(0, 30).map(([id, v]) => `• ${v?.name ?? "?"} (${id})`);
            await steamWishlistOpen();
            return `Your wishlist (${entries.length}):\n${lines.join("\n")}${entries.length > 30 ? `\n… +${entries.length - 30} more` : ""}`;
        }
    } catch {}
    await steamWishlistOpen();
    return "I opened your wishlist page (if the profile is private, the list can't be read from the API).";
}

// ════════════════════════════════════════════════════════════════════════════
// WEB API — requires key + SteamID
// ════════════════════════════════════════════════════════════════════════════

export async function steamGetOwnedGames(): Promise<string> {
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    if (games.length === 0) return "No games found (the profile may be private).";
    const sorted = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever);
    const lines = sorted.slice(0, 30).map((g) => `• ${g.name} — ${fmtMinutes(g.playtime_forever)}`);
    return `Games you own (${games.length}):\n${lines.join("\n")}${games.length > 30 ? `\n… +${games.length - 30} more` : ""}`;
}

export async function steamSearchOwnedGames(query: string): Promise<string> {
    if (!query) return "ERROR: A search term is required.";
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    const scored = games.map((g) => ({g, s: fuzzyMatch(query, g.name)})).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    if (scored.length === 0) return `No game in your library matches "${query}".`;
    const lines = scored.slice(0, 10).map((x) => `• ${x.g.name} (${x.g.appid}) — ${fmtMinutes(x.g.playtime_forever)}`);
    return `Search for "${query}":\n${lines.join("\n")}`;
}

export async function steamGetRecentGames(): Promise<string> {
    if (!steamId()) return needId();
    const data = await apiGet<{response?: {games?: any[]}}>("/IPlayerService/GetRecentlyPlayedGames/v1/", {steamid: steamId()});
    if (isErr(data)) return data.error;
    const games = data.response?.games ?? [];
    if (games.length === 0) return "No games played in the last 2 weeks.";
    const lines = games.map((g: any) => `• ${g.name} — last 2 weeks: ${fmtMinutes(g.playtime_2weeks ?? 0)}, total: ${fmtMinutes(g.playtime_forever)}`);
    return `Recently played games:\n${lines.join("\n")}`;
}

export async function steamGetMostPlayed(): Promise<string> {
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    const sorted = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 10);
    if (sorted.length === 0) return "No playtime data.";
    const lines = sorted.map((g, i) => `${i + 1}. ${g.name} — ${fmtMinutes(g.playtime_forever)}`);
    return `Most played games:\n${lines.join("\n")}`;
}

export async function steamGetGamePlaytime(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name is required.";
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    let g;
    if (/^\d+$/.test(nameOrId.trim())) g = games.find((x) => String(x.appid) === nameOrId.trim());
    else {
        const scored = games.map((x) => ({x, s: fuzzyMatch(nameOrId, x.name)})).filter((y) => y.s > 0).sort((a, b) => b.s - a.s);
        g = scored.length ? scored[0].x : undefined;
    }
    if (!g) return `"${nameOrId}" was not found in your library.`;
    return `"${g.name}" total playtime: ${fmtMinutes(g.playtime_forever)}.`;
}

export async function steamGetTotalPlaytime(): Promise<string> {
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    const total = games.reduce((s, g) => s + (g.playtime_forever ?? 0), 0);
    return `Your total Steam playtime: ${fmtMinutes(total)} (across ${games.length} games).`;
}

export async function steamSuggestGame(): Promise<string> {
    const games = await getOwnedGamesRaw();
    if (isErr(games)) return games.error;
    if (games.length === 0) return "There are no games in your library.";
    // Suggest randomly from owned but barely-played (≤60 min) games
    const unplayed = games.filter((g) => (g.playtime_forever ?? 0) <= 60);
    const pool = unplayed.length >= 3 ? unplayed : games;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const reason = (pick.playtime_forever ?? 0) <= 60 ? "you've barely played it" : `you've played ${fmtMinutes(pick.playtime_forever)}`;
    return `Suggestion: "${pick.name}" (${reason}). To launch it: "launch ${pick.name}".`;
}

export async function steamGetGameAchievements(nameOrId: string): Promise<string> {
    if (!steamId()) return needId();
    const appid = await resolveAppidForApi(nameOrId);
    if (!appid) return `Could not find an AppID for "${nameOrId}".`;
    const data = await apiGet<{playerstats?: any}>("/ISteamUserStats/GetPlayerAchievements/v1/", {steamid: steamId(), appid, l: "english"});
    if (isErr(data)) return data.error;
    const ps2 = data.playerstats;
    if (!ps2 || ps2.success === false) return `No achievement data for "${nameOrId}" (the game may not support achievements).`;
    const achs = ps2.achievements ?? [];
    const unlocked = achs.filter((a: any) => a.achieved === 1);
    const lines = unlocked.slice(0, 15).map((a: any) => `✓ ${a.name ?? a.apiname}`);
    return `"${ps2.gameName ?? nameOrId}" achievements: ${unlocked.length}/${achs.length} unlocked.\n${lines.join("\n")}${unlocked.length > 15 ? `\n…` : ""}`;
}

export async function steamGetAchievementProgress(nameOrId: string): Promise<string> {
    if (!steamId()) return needId();
    const appid = await resolveAppidForApi(nameOrId);
    if (!appid) return `Could not find an AppID for "${nameOrId}".`;
    const data = await apiGet<{playerstats?: any}>("/ISteamUserStats/GetPlayerAchievements/v1/", {steamid: steamId(), appid});
    if (isErr(data)) return data.error;
    const achs = data.playerstats?.achievements ?? [];
    if (achs.length === 0) return `No achievement data for "${nameOrId}".`;
    const unlocked = achs.filter((a: any) => a.achieved === 1).length;
    const pct = Math.round((unlocked / achs.length) * 100);
    return `"${nameOrId}" achievement progress: ${unlocked}/${achs.length} (${pct}%).`;
}

export async function steamGetPlayerStats(nameOrId: string): Promise<string> {
    if (!steamId()) return needId();
    const appid = await resolveAppidForApi(nameOrId);
    if (!appid) return `Could not find an AppID for "${nameOrId}".`;
    const data = await apiGet<{playerstats?: any}>("/ISteamUserStats/GetUserStatsForGame/v2/", {steamid: steamId(), appid});
    if (isErr(data)) return data.error;
    const stats = data.playerstats?.stats ?? [];
    if (stats.length === 0) return `No stats found for "${nameOrId}".`;
    const lines = stats.slice(0, 20).map((s: any) => `• ${s.name}: ${s.value}`);
    return `"${data.playerstats?.gameName ?? nameOrId}" stats:\n${lines.join("\n")}`;
}

export async function steamGetProfileSummary(): Promise<string> {
    if (!steamId()) return needId();
    const data = await apiGet<{response?: {players?: any[]}}>("/ISteamUser/GetPlayerSummaries/v2/", {steamids: steamId()});
    if (isErr(data)) return data.error;
    const p = data.response?.players?.[0];
    if (!p) return "Profile not found.";
    const states = ["Offline", "Online", "Busy", "Away", "Snooze", "Looking to trade", "Looking to play"];
    const parts = [`Profile: ${p.personaname}`];
    if (p.personastate !== undefined) parts.push(`Status: ${states[p.personastate] ?? "?"}`);
    if (p.gameextrainfo) parts.push(`Currently playing: ${p.gameextrainfo}`);
    if (p.loccountrycode) parts.push(`Country: ${p.loccountrycode}`);
    return parts.join("\n");
}

export async function steamGetLevel(): Promise<string> {
    if (!steamId()) return needId();
    const data = await apiGet<{response?: {player_level?: number}}>("/IPlayerService/GetSteamLevel/v1/", {steamid: steamId()});
    if (isErr(data)) return data.error;
    const lvl = data.response?.player_level;
    return lvl !== undefined ? `Your Steam level: ${lvl}.` : "Could not retrieve level info.";
}

// Fetch friend summaries (name + status) in batches
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
    if (friends.length === 0) return "Your friend list is empty or private.";
    const sums = await friendSummaries(friends.map((f: any) => f.steamid));
    const lines = sums.slice(0, 40).map((p) => `• ${p.personaname} (${p.steamid})`);
    return `Your friends (${friends.length}):\n${lines.join("\n")}${friends.length > 40 ? `\n… +${friends.length - 40} more` : ""}`;
}

export async function steamGetOnlineFriends(): Promise<string> {
    if (!steamId()) return needId();
    const data = await apiGet<{friendslist?: {friends?: any[]}}>("/ISteamUser/GetFriendList/v1/", {steamid: steamId(), relationship: "friend"});
    if (isErr(data)) return data.error;
    const friends = data.friendslist?.friends ?? [];
    const sums = await friendSummaries(friends.map((f: any) => f.steamid));
    const online = sums.filter((p) => p.personastate && p.personastate !== 0);
    if (online.length === 0) return "You have no friends online right now.";
    const lines = online.map((p) => `• ${p.personaname}${p.gameextrainfo ? ` — playing ${p.gameextrainfo}` : ""}`);
    return `Online friends (${online.length}):\n${lines.join("\n")}`;
}

export async function steamGetFriendCurrentGame(friendNameOrId: string): Promise<string> {
    if (!friendNameOrId) return "ERROR: Friend name or SteamID is required.";
    if (!steamId()) return needId();
    const data = await apiGet<{friendslist?: {friends?: any[]}}>("/ISteamUser/GetFriendList/v1/", {steamid: steamId(), relationship: "friend"});
    if (isErr(data)) return data.error;
    const friends = data.friendslist?.friends ?? [];
    const sums = await friendSummaries(friends.map((f: any) => f.steamid));
    let p;
    if (/^\d+$/.test(friendNameOrId.trim())) p = sums.find((x) => x.steamid === friendNameOrId.trim());
    else p = sums.find((x) => (x.personaname ?? "").toLowerCase().includes(friendNameOrId.toLowerCase()));
    if (!p) return `"${friendNameOrId}" was not found among your friends.`;
    return p.gameextrainfo ? `${p.personaname} is currently playing "${p.gameextrainfo}".` : `${p.personaname} is not playing a game right now.`;
}

export async function steamWhoIsPlaying(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name is required.";
    if (!steamId()) return needId();
    const data = await apiGet<{friendslist?: {friends?: any[]}}>("/ISteamUser/GetFriendList/v1/", {steamid: steamId(), relationship: "friend"});
    if (isErr(data)) return data.error;
    const friends = data.friendslist?.friends ?? [];
    const sums = await friendSummaries(friends.map((f: any) => f.steamid));
    const q = nameOrId.toLowerCase();
    const playing = sums.filter((p) => (p.gameextrainfo ?? "").toLowerCase().includes(q));
    if (playing.length === 0) return `None of your friends are playing "${nameOrId}" right now.`;
    return `Playing "${nameOrId}": ${playing.map((p) => p.personaname).join(", ")}.`;
}

export async function steamGetLastPlayed(): Promise<string> {
    if (!steamId()) return needId();
    const data = await apiGet<{response?: {games?: any[]}}>("/IPlayerService/GetRecentlyPlayedGames/v1/", {steamid: steamId(), count: 1});
    if (isErr(data)) return data.error;
    const g = data.response?.games?.[0];
    if (!g) return "No last-played game info.";
    return `The last game you played: "${g.name}" (last 2 weeks: ${fmtMinutes(g.playtime_2weeks ?? 0)}).`;
}

// resolveAppidForApi: name → appid (installed first, then owned, then store)
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
// STOREFRONT — no key required
// ════════════════════════════════════════════════════════════════════════════

async function steamStoreSearchRaw(query: string): Promise<{id: number; name: string}[] | {error: string}> {
    try {
        const res = await fetch(`${STORE}/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`);
        if (!res.ok) return {error: `Store search ${res.status}`};
        const data = (await res.json()) as {items?: any[]};
        return (data.items ?? []).map((i) => ({id: i.id, name: i.name}));
    } catch (e: any) {
        return {error: `Store search failed: ${e?.message ?? e}`};
    }
}

export async function steamSearchStore(query: string): Promise<string> {
    if (!query) return "ERROR: A search term is required.";
    const items = await steamStoreSearchRaw(query);
    if (isErr(items)) return items.error;
    if (items.length === 0) return `No store results for "${query}".`;
    const lines = items.slice(0, 10).map((i) => `• ${i.name} (${i.id})`);
    return `Store search "${query}":\n${lines.join("\n")}`;
}

async function appDetails(appid: string): Promise<any | {error: string}> {
    try {
        const res = await fetch(`${STORE}/api/appdetails?appids=${appid}&l=english&cc=US`);
        if (!res.ok) return {error: `appdetails ${res.status}`};
        const data = (await res.json()) as Record<string, any>;
        const entry = data[appid];
        if (!entry?.success) return {error: "Game details not found."};
        return entry.data;
    } catch (e: any) {
        return {error: `appdetails failed: ${e?.message ?? e}`};
    }
}

export async function steamGetGameDetails(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    let appid = nameOrId.trim();
    if (!/^\d+$/.test(appid)) {
        const found = await steamStoreSearchRaw(nameOrId);
        if (isErr(found) || found.length === 0) return `"${nameOrId}" was not found in the store.`;
        appid = String(found[0].id);
    }
    const d = await appDetails(appid);
    if (isErr(d)) return d.error;
    const parts = [`${d.name} (${appid})`];
    if (d.short_description) parts.push(d.short_description);
    if (d.developers?.length) parts.push(`Developer: ${d.developers.join(", ")}`);
    if (d.release_date?.date) parts.push(`Release: ${d.release_date.date}`);
    if (d.genres?.length) parts.push(`Genre: ${d.genres.map((g: any) => g.description).join(", ")}`);
    if (d.metacritic?.score) parts.push(`Metacritic: ${d.metacritic.score}`);
    if (d.price_overview) parts.push(`Price: ${d.price_overview.final_formatted}${d.price_overview.discount_percent ? ` (${d.price_overview.discount_percent}% off)` : ""}`);
    else if (d.is_free) parts.push("Price: Free");
    return parts.join("\n");
}

export async function steamGetGamePrice(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    let appid = nameOrId.trim();
    let name = nameOrId;
    if (!/^\d+$/.test(appid)) {
        const found = await steamStoreSearchRaw(nameOrId);
        if (isErr(found) || found.length === 0) return `"${nameOrId}" was not found in the store.`;
        appid = String(found[0].id);
        name = found[0].name;
    }
    const d = await appDetails(appid);
    if (isErr(d)) return d.error;
    if (d.is_free) return `"${d.name}" is free.`;
    const p = d.price_overview;
    if (!p) return `No price info for "${d.name ?? name}" (it may be coming soon).`;
    return p.discount_percent
        ? `"${d.name}": ${p.final_formatted} (regular ${p.initial_formatted}, ${p.discount_percent}% off).`
        : `"${d.name}": ${p.final_formatted}.`;
}

export async function steamGetDiscountedGames(): Promise<string> {
    // Storefront featuredcategories → specials
    try {
        const res = await fetch(`${STORE}/api/featuredcategories?l=english&cc=US`);
        if (!res.ok) return `Could not fetch the discount list (${res.status}).`;
        const data = (await res.json()) as any;
        const items = data?.specials?.items ?? [];
        if (items.length === 0) return "No featured discounts found right now.";
        const lines = items.slice(0, 15).map((i: any) => {
            const final = (i.final_price ?? 0) / 100;
            const cur = i.currency ?? "USD";
            return `• ${i.name} — ${i.discount_percent}% off → ${final.toFixed(2)} ${cur}`;
        });
        return `Featured discounts:\n${lines.join("\n")}`;
    } catch (e: any) {
        return `Discount list failed: ${e?.message ?? e}`;
    }
}

export async function steamGetGameNews(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Game name or AppID is required.";
    let appid = nameOrId.trim();
    if (!/^\d+$/.test(appid)) {
        const r = await resolveAppidForApi(nameOrId);
        if (!r) return `"${nameOrId}" was not found.`;
        appid = r;
    }
    try {
        const res = await fetch(`${API}/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=5&maxlength=200&format=json`);
        if (!res.ok) return `Could not fetch news (${res.status}).`;
        const data = (await res.json()) as any;
        const items = data?.appnews?.newsitems ?? [];
        if (items.length === 0) return "No news found for this game.";
        const lines = items.map((n: any) => `• ${n.title}\n  ${(n.contents ?? "").replace(/\s+/g, " ").trim().slice(0, 140)}…`);
        return `News (AppID ${appid}):\n${lines.join("\n\n")}`;
    } catch (e: any) {
        return `News failed: ${e?.message ?? e}`;
    }
}

// ── Screenshot (Steam's own screenshot) ───────────────────────────────────────
export async function steamTakeScreenshot(): Promise<string> {
    // Steam's F12 screenshot shortcut only works via the in-game global hook;
    // it can't be triggered externally. If a game is running it tries to simulate F12, otherwise it explains.
    const running = await steamListRunningGames();
    if (running.startsWith("No Steam game")) {
        return "To take a Steam screenshot a game must be running (Steam only captures F12 in-game). For a general screenshot, use the 'take screenshot' tool.";
    }
    await ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{F12}")`);
    return "Sent F12 to the Steam overlay. You can view the image with 'open steam screenshots'.";
}
