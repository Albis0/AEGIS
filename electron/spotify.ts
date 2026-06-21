/**
 * Spotify Web API — OAuth2 PKCE + full control
 *
 * Client ID and Secret are stored in the vault (aegis-config or vaultGet).
 * On first run a browser opens, the user logs in to Spotify, the callback
 * arrives on port:17832, the token is obtained and saved encrypted.
 *
 * Scopes: streaming, user-read-playback-state, user-modify-playback-state,
 *         user-read-currently-playing, playlist-read-private,
 *         playlist-read-collaborative, user-library-modify,
 *         user-library-read, user-read-private
 */

import {exec as execCb} from "child_process";
import * as http from "http";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {fetchWithTimeout, isTimeoutError} from "./fetch-utils";

// ── Credentials (set from main.ts after vault init) ──────────────────────────
const CLIENT_ID = "3650da8ef6774cc99e857cfdc1d9999a";
const REDIRECT_URI = "http://127.0.0.1:17832/callback";
const SCOPES = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "streaming",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-library-modify",
    "user-library-read",
    "user-read-private",
].join(" ");

const TOKEN_PATH = path.join(os.homedir(), ".aegis", "spotify-token.json");

interface TokenData {
    access_token: string;
    refresh_token: string;
    expires_at: number;
}

// ── Token storage ─────────────────────────────────────────────────────────────
function loadToken(): TokenData | null {
    try { return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8")); }
    catch { return null; }
}

function saveToken(data: TokenData): void {
    try {
        fs.mkdirSync(path.dirname(TOKEN_PATH), {recursive: true});
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(data), "utf-8");
    } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        const msg = code === "EACCES"
            ? "Could not save Spotify token: file permission error."
            : code === "ENOSPC"
            ? "Could not save Spotify token: disk full."
            : `Could not save Spotify token: ${(e as Error).message}`;
        console.error("[spotify]", msg);
    }
}

// ── PKCE helpers ─────────────────────────────────────────────────────────────
function generateVerifier(): string {
    return crypto.randomBytes(48).toString("base64url");
}

function generateChallenge(verifier: string): string {
    return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// ── OAuth2 PKCE flow ──────────────────────────────────────────────────────────
let _pendingVerifier: string | null = null;
let _callbackServer: http.Server | null = null;

// The callback page shown in the browser — in the AEGIS brand style (dark background,
// gradient logo, Inter). Instead of bare Times New Roman HTML.
function callbackPage(opts: {ok: boolean; title: string; sub: string}): string {
    const {ok, title, sub} = opts;
    const accent = ok ? "52, 211, 153" : "248, 113, 113"; // emerald | red-400
    const icon = ok
        ? '<path d="M20 6 9 17l-5-5" stroke="rgb(' + accent + ')" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<circle cx="12" cy="12" r="9" stroke="rgb(' + accent + ')" stroke-width="2.2"/><path d="M12 7v6m0 4h.01" stroke="rgb(' + accent + ')" stroke-width="2.2" stroke-linecap="round"/>';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AEGIS · Spotify</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%}
  body{font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;
    background:#0a0e17;color:#f8fafc;display:grid;place-items:center;overflow:hidden}
  .bg{position:fixed;inset:0;pointer-events:none;
    background:radial-gradient(120% 90% at 15% 0%,rgba(129,140,248,.16),transparent 55%),
      radial-gradient(120% 90% at 100% 100%,rgba(56,189,248,.14),transparent 55%)}
  .card{position:relative;text-align:center;padding:48px 40px;max-width:420px;
    animation:rise .5s ease-out}
  @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .brand{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:36px}
  .brand span{font-weight:700;letter-spacing:.3em;font-size:13px}
  .badge{width:72px;height:72px;border-radius:20px;display:grid;place-items:center;margin:0 auto 24px;
    background:rgba(${accent},.12);border:1px solid rgba(${accent},.4)}
  h1{font-size:22px;font-weight:600;letter-spacing:-.01em;margin-bottom:10px}
  p{font-size:14px;line-height:1.6;color:#94a3b8}
  .hint{margin-top:28px;font-size:12.5px;color:#64748b}
</style></head>
<body>
  <div class="bg"></div>
  <div class="card">
    <div class="brand">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient></defs>
        <path d="M12 2 4 5.5v6c0 5 3.4 8.5 8 10.5 4.6-2 8-5.5 8-10.5v-6L12 2Z" fill="url(#g)" fill-opacity=".18" stroke="url(#g)" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M12 7v5l3 2" stroke="url(#g)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>AEGIS</span>
    </div>
    <div class="badge"><svg width="34" height="34" viewBox="0 0 24 24" fill="none">${icon}</svg></div>
    <h1>${title}</h1>
    <p>${sub}</p>
    <div class="hint">You can close this tab and return to AEGIS.</div>
  </div>
</body></html>`;
}

function sendPage(res: http.ServerResponse, opts: {ok: boolean; title: string; sub: string}): void {
    res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    res.end(callbackPage(opts));
}

export async function spotifyAuthorize(): Promise<string> {
    if (_callbackServer) return "Authorization is already in progress. Please log in in the browser.";

    const verifier = generateVerifier();
    const challenge = generateChallenge(verifier);
    _pendingVerifier = verifier;
    const state = crypto.randomBytes(8).toString("hex");

    const params = new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        state,
        code_challenge_method: "S256",
        code_challenge: challenge,
    });
    const authUrl = `https://accounts.spotify.com/authorize?${params}`;

    // Callback server — one-shot
    await new Promise<void>((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            const url = new URL(req.url ?? "/", "http://localhost");
            if (url.pathname !== "/callback") { res.end(); return; }

            const code = url.searchParams.get("code");
            const err = url.searchParams.get("error");

            if (err || !code) {
                sendPage(res, {ok: false, title: "Authorization canceled", sub: err ?? "Could not get the authorization code. You can try again."});
                server.close();
                _callbackServer = null;
                reject(new Error(err ?? "no code"));
                return;
            }

            try {
                const token = await exchangeCode(code, _pendingVerifier ?? "");
                saveToken(token);
                sendPage(res, {ok: true, title: "Spotify connected", sub: "AEGIS can now control your music."});
            } catch (e) {
                sendPage(res, {ok: false, title: "Connection failed", sub: (e as Error).message});
            }
            server.close();
            _callbackServer = null;
            _pendingVerifier = null;
            resolve();
        });

        server.listen(17832, "127.0.0.1", () => {
            _callbackServer = server;
            // Open the browser
            execCb(`cmd /c start "" "${authUrl}"`, {windowsHide: true}, () => {});
            resolve(); // server is up, continue — the callback will arrive async
        });

        server.on("error", (e) => {
            _callbackServer = null;
            reject(e);
        });
    });

    return `Spotify authorization opened in the browser. Log in and grant access. Once done, AEGIS will get the token automatically.`;
}

async function exchangeCode(code: string, verifier: string): Promise<TokenData> {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier,
    });

    const resp = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: body.toString(),
    }, 10_000);

    if (!resp.ok) throw new Error(`Token exchange failed: ${resp.status} ${await resp.text()}`);
    const data = await resp.json() as {access_token: string; refresh_token: string; expires_in: number};
    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
    };
}

async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
    });

    const resp = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: body.toString(),
    }, 10_000);

    if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status} ${await resp.text()}`);
    const data = await resp.json() as {access_token: string; refresh_token?: string; expires_in: number};
    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? refreshToken,
        expires_at: Date.now() + data.expires_in * 1000,
    };
}

// ── Token getter — automatic refresh ─────────────────────────────────────────
async function getToken(): Promise<string> {
    let token = loadToken();
    if (!token) throw new Error("No Spotify account is connected. Say 'connect Spotify' or 'authorize Spotify'.");

    if (Date.now() > token.expires_at - 30_000) {
        token = await refreshAccessToken(token.refresh_token);
        saveToken(token);
    }
    return token.access_token;
}

// ── Spotify Web API fetch wrapper ─────────────────────────────────────────────
async function api(
    method: string,
    endpoint: string,
    body?: unknown
): Promise<{ok: boolean; status: number; data: unknown}> {
    const tok = await getToken();
    const resp = await fetchWithTimeout(`https://api.spotify.com/v1${endpoint}`, {
        method,
        headers: {
            "Authorization": `Bearer ${tok}`,
            ...(body ? {"Content-Type": "application/json"} : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    }, 10_000);

    if (resp.status === 204) return {ok: true, status: 204, data: null};
    const text = await resp.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch {}
    return {ok: resp.ok, status: resp.status, data};
}

// ── Spotify connection error translator ──────────────────────────────────────
function spotifyConnErr(e: unknown): string {
    if (isTimeoutError(e)) return "Timed out connecting to Spotify. Check your internet connection.";
    const msg = (e as Error).message ?? String(e);
    if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(msg)) return "Cannot reach the Spotify server. Check your internet connection.";
    if (msg.includes("not connected") || msg.includes("not authorized")) return "Spotify is not connected to AEGIS. Say 'connect Spotify' to authorize.";
    if (msg.includes("No active device")) return "No active Spotify device. Open the Spotify app and play something.";
    return `Spotify error: ${msg}`;
}

// ── Spotify HTTP error message translator ─────────────────────────────────────
function spotifyErr(status: number, data?: unknown): string {
    const msg = (data as {error?: {message?: string}})?.error?.message ?? "";
    const low = msg.toLowerCase();
    if (status === 401) return "Your Spotify session has expired. Say 'connect Spotify' to re-authorize.";
    if (status === 403) {
        if (/premium/i.test(low)) return "This feature requires Spotify Premium.";
        if (/not.*register|developer/i.test(low)) return "This Spotify account is not registered with the app. It needs to be added from the developer dashboard.";
        return `Spotify: Access denied (403)${msg ? " — " + msg : ""}`;
    }
    if (status === 404) return "No active Spotify player found. Open Spotify and start playing music.";
    if (status === 429) return "Spotify received too many requests. Wait a few seconds and try again.";
    if (status >= 500) return "The Spotify server returned a temporary error. Wait a bit and try again.";
    return msg ? `Spotify: ${msg}` : `Spotify error (${status})`;
}

// ── Active device helper ──────────────────────────────────────────────────────
async function getActiveDeviceId(): Promise<string | null> {
    const r = await api("GET", "/me/player/devices");
    if (!r.ok) return null;
    const devices = (r.data as {devices: {id: string; is_active: boolean; name: string}[]}).devices ?? [];
    const active = devices.find((d) => d.is_active) ?? devices[0];
    return active?.id ?? null;
}

// ── Spotify control: if there is no device, open the app ─────────────────────
async function ensureDevice(): Promise<string | null> {
    let deviceId = await getActiveDeviceId();
    if (deviceId) return deviceId;

    // Open the Spotify desktop app
    execCb(`cmd /c start spotify:`, {windowsHide: true}, () => {});
    await new Promise((r) => setTimeout(r, 3000));
    deviceId = await getActiveDeviceId();
    return deviceId;
}

// ── Public API functions ──────────────────────────────────────────────────────

export async function spotifyAuthorizeCmd(): Promise<string> {
    return spotifyAuthorize();
}

export async function spotifyPlay(): Promise<string> {
    try {
        const deviceId = await ensureDevice();
        const body = deviceId ? {device_ids: [deviceId], play: true} : undefined;
        await api("PUT", "/me/player", body);
        await api("PUT", "/me/player/play", deviceId ? {device_id: deviceId} : undefined);
        return "Spotify started.";
    } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("not connected")) return `${msg} — connect Spotify first.`;
        return `Error: ${msg}`;
    }
}

export async function spotifyPause(): Promise<string> {
    try {
        const r = await api("PUT", "/me/player/pause");
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        return "Spotify paused.";
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyNext(): Promise<string> {
    try {
        const deviceId = await ensureDevice();
        const endpoint = deviceId ? `/me/player/next?device_id=${deviceId}` : "/me/player/next";
        const r = await api("POST", endpoint);
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        await new Promise((res) => setTimeout(res, 1000));
        return await spotifyGetState();
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyPrev(): Promise<string> {
    try {
        const deviceId = await ensureDevice();
        const endpoint = deviceId ? `/me/player/previous?device_id=${deviceId}` : "/me/player/previous";
        const r = await api("POST", endpoint);
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        await new Promise((res) => setTimeout(res, 1000));
        return await spotifyGetState();
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifySetVolume(level: number): Promise<string> {
    try {
        const clamped = Math.max(0, Math.min(100, Math.round(level)));
        const deviceId = await ensureDevice();
        const endpoint = deviceId
            ? `/me/player/volume?volume_percent=${clamped}&device_id=${deviceId}`
            : `/me/player/volume?volume_percent=${clamped}`;
        const r = await api("PUT", endpoint);
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        return `Volume set to ${clamped}%.`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetState(): Promise<string> {
    try {
        const r = await api("GET", "/me/player");
        if (r.status === 204 || !r.data) return "Nothing is playing on Spotify right now.";
        const d = r.data as {
            is_playing: boolean;
            item: {name: string; artists: {name: string}[]; album: {name: string}; duration_ms: number};
            progress_ms: number;
            device: {volume_percent: number};
        };
        if (!d.item) return "Nothing is playing on Spotify right now.";
        const artists = d.item.artists.map((a) => a.name).join(", ");
        const prog = Math.round(d.progress_ms / 1000);
        const dur = Math.round(d.item.duration_ms / 1000);
        const vol = d.device?.volume_percent ?? -1;
        const m = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        return `${d.is_playing ? "Playing" : "Paused"}: ${d.item.name} — ${artists} (${d.item.album.name}) [${m(prog)}/${m(dur)}] {vol:${vol}}`;
    } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("not connected")) return "No Spotify account is connected. Say 'connect Spotify'.";
        return `Error: ${msg}`;
    }
}

export async function spotifyOpen(): Promise<string> {
    execCb(`cmd /c start spotify:`, {windowsHide: true}, () => {});
    await new Promise((r) => setTimeout(r, 1500));
    return "Spotify opened.";
}

export async function spotifySearchPlay(query: string): Promise<string> {
    if (!query) return "ERROR: Search query is empty.";
    try {
        const r = await api("GET", `/search?q=${encodeURIComponent(query)}&type=track&limit=5`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const tracks = (r.data as {tracks: {items: {uri: string; name: string; artists: {name: string}[]}[]}}).tracks?.items ?? [];
        if (tracks.length === 0) return `No results found for "${query}".`;

        // Compare the query words against track name + artist, pick the best match
        const qLower = query.toLowerCase();
        const qWords = qLower.split(/\s+/).filter(Boolean);
        const scored = tracks.map((t) => {
            const combined = `${t.name} ${t.artists.map((a) => a.name).join(" ")}`.toLowerCase();
            const hits = qWords.filter((w) => combined.includes(w)).length;
            return {t, score: hits};
        });
        scored.sort((a, b) => b.score - a.score);
        const track = scored[0].t;

        const deviceId = await ensureDevice();
        const pr = await api("PUT", "/me/player/play", {
            uris: [track.uri],
            ...(deviceId ? {device_id: deviceId} : {}),
        });
        if (!pr.ok && pr.status !== 204) return spotifyErr(pr.status, pr.data);
        return `Playing: ${track.name} — ${track.artists.map((a) => a.name).join(", ")}`;
    } catch (e) { return `Error: ${(e as Error).message}`; }
}

export async function spotifyListPlaylists(): Promise<string> {
    try {
        const r = await api("GET", "/me/playlists?limit=20");
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {id: string; name: string; tracks: {total: number}}[]}).items ?? [];
        if (items.length === 0) return "No playlists found.";
        return `Your Spotify Playlists (${items.length}):\n${items.map((p, i) => `${i + 1}. ${p.name} (${p.tracks.total} tracks) — ID: ${p.id}`).join("\n")}`;
    } catch (e) { return `Error: ${(e as Error).message}`; }
}

// "Liked Songs" is NOT a NORMAL PLAYLIST IN SPOTIFY — it doesn't appear in /me/playlists
// and can't be played via context_uri. So it is handled separately (saved-tracks → uris).
const LIKED_ALIASES = ["begenilen", "liked", "liked songs", "favori", "favoriler", "begendiklerim", "kaydedilen", "saved"];
function isLikedSongs(name: string): boolean {
    const n = name.toLowerCase()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
        .replace(/sarki(lar)?|songs?/g, "").trim();
    if (n.length < 3) return false; // avoid a false-positive after an empty/very short "songs"
    return LIKED_ALIASES.some((a) => a.includes(n) || n.includes(a.split(" ")[0]));
}

async function playLikedSongs(): Promise<string> {
    // Fetch the liked songs (max 50) and play them via uris — no context_uri.
    const r = await api("GET", "/me/tracks?limit=50");
    if (!r.ok) return spotifyErr(r.status, r.data);
    const items = (r.data as {items: {track: {uri: string}}[]}).items ?? [];
    const uris = items.map((it) => it.track?.uri).filter(Boolean);
    if (uris.length === 0) return "You have no liked songs.";
    const deviceId = await ensureDevice();
    if (!deviceId) return "No active Spotify device. Open the Spotify app, then try again.";
    const pr = await api("PUT", "/me/player/play", {uris, device_id: deviceId});
    if (!pr.ok && pr.status !== 204) return spotifyErr(pr.status, pr.data);
    return `Playing Liked Songs (${uris.length} tracks).`;
}

export async function spotifyPlayPlaylist(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Playlist name or ID is required.";
    try {
        // If an ID was given, play it directly.
        if (/^[A-Za-z0-9]{22}$/.test(nameOrId.trim())) {
            const deviceId = await ensureDevice();
            if (!deviceId) return "No active Spotify device. Open the Spotify app, then try again.";
            const pr = await api("PUT", "/me/player/play", {context_uri: `spotify:playlist:${nameOrId.trim()}`, device_id: deviceId});
            if (!pr.ok && pr.status !== 204) return spotifyErr(pr.status, pr.data);
            return `Playlist started.`;
        }

        // By name, search the REAL playlists FIRST (the user may have an ACTUAL playlist
        // named "Liked Songs" — prefer that).
        const r = await api("GET", "/me/playlists?limit=50");
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {id: string; name: string}[]}).items ?? [];
        const q = nameOrId.toLowerCase();
        const match = items.find((p) => p.name.toLowerCase() === q)
            ?? items.find((p) => p.name.toLowerCase().includes(q));

        if (match) {
            const deviceId = await ensureDevice();
            if (!deviceId) return "No active Spotify device. Open the Spotify app, then try again.";
            const pr2 = await api("PUT", "/me/player/play", {context_uri: `spotify:playlist:${match.id}`, device_id: deviceId});
            if (!pr2.ok && pr2.status !== 204) return spotifyErr(pr2.status, pr2.data);
            return `Playlist started: ${match.name}`;
        }

        // No real playlist found — if it's "Liked Songs", play that special collection.
        if (isLikedSongs(nameOrId)) return await playLikedSongs();

        // Nothing matched — list the available ones so the user can choose.
        const names = items.slice(0, 8).map((p) => `• ${p.name}`).join("\n");
        return `No playlist named "${nameOrId}" found.` +
            (names ? `\n\nYour available playlists:\n${names}` : " It looks like you don't have any playlists.") +
            `\n\nNote: to play Spotify "Liked Songs", you can say "play my liked songs".`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyLikeTrack(): Promise<string> {
    try {
        const r = await api("GET", "/me/player/currently-playing");
        const d = r.data as {item: {id: string; name: string}};
        if (!d?.item) return "No track is currently playing.";
        await api("PUT", `/me/tracks?ids=${d.item.id}`);
        return `Liked: ${d.item.name}`;
    } catch (e) { return `Error: ${(e as Error).message}`; }
}

export async function spotifyAddToQueue(query: string): Promise<string> {
    if (!query) return "ERROR: Track name is required.";
    try {
        const r = await api("GET", `/search?q=${encodeURIComponent(query)}&type=track&limit=1`);
        const tracks = (r.data as {tracks: {items: {uri: string; name: string; artists: {name: string}[]}[]}}).tracks?.items ?? [];
        if (tracks.length === 0) return `"${query}" not found.`;
        const track = tracks[0];
        await api("POST", `/me/player/queue?uri=${encodeURIComponent(track.uri)}`);
        return `Added to queue: ${track.name} — ${track.artists.map((a) => a.name).join(", ")}`;
    } catch (e) { return `Error: ${(e as Error).message}`; }
}

export async function spotifyListDevices(): Promise<string> {
    try {
        const r = await api("GET", "/me/player/devices");
        const devices = (r.data as {devices: {id: string; name: string; type: string; is_active: boolean; volume_percent: number}[]}).devices ?? [];
        if (devices.length === 0) return "No active Spotify device found. Open the Spotify app.";
        return `Spotify Devices:\n${devices.map((d) => `${d.is_active ? "[ACTIVE] " : ""}${d.name} (${d.type}) — volume: ${d.volume_percent}%`).join("\n")}`;
    } catch (e) { return `Error: ${(e as Error).message}`; }
}

export async function spotifyTransferDevice(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Device name or ID is required.";
    try {
        const r = await api("GET", "/me/player/devices");
        const devices = (r.data as {devices: {id: string; name: string}[]}).devices ?? [];
        const dev = devices.find((d) => d.id === nameOrId || d.name.toLowerCase().includes(nameOrId.toLowerCase()));
        if (!dev) return `Device "${nameOrId}" not found. List them with "Spotify devices".`;
        await api("PUT", "/me/player", {device_ids: [dev.id], play: true});
        return `Music transferred to ${dev.name}.`;
    } catch (e) { return `Error: ${(e as Error).message}`; }
}

export async function spotifySetShuffle(enabled: boolean): Promise<string> {
    try {
        await api("PUT", `/me/player/shuffle?state=${enabled}`);
        return `Shuffle mode ${enabled ? "turned on" : "turned off"}.`;
    } catch (e) { return `Error: ${(e as Error).message}`; }
}

export async function spotifySetRepeat(mode: "off" | "track" | "context"): Promise<string> {
    try {
        await api("PUT", `/me/player/repeat?state=${mode}`);
        const labels: Record<string, string> = {off: "off", track: "repeat track", context: "repeat list"};
        return `Repeat mode: ${labels[mode] ?? mode}`;
    } catch (e) { return `Error: ${(e as Error).message}`; }
}

// ── Player extras ─────────────────────────────────────────────────────────────

export async function spotifySeek(position_ms: number): Promise<string> {
    try {
        const ms = Math.max(0, Math.round(position_ms));
        const r = await api("PUT", `/me/player/seek?position_ms=${ms}`);
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        return `Seeked to ${m}:${String(s).padStart(2, "0")}.`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetRecentlyPlayed(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/player/recently-played?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {track: {name: string; artists: {name: string}[]}; played_at: string}[]}).items ?? [];
        if (items.length === 0) return "No recently played tracks found.";
        return `Recently Played (${items.length}):\n${items.map((it, i) =>
            `${i + 1}. ${it.track.name} — ${it.track.artists.map((a) => a.name).join(", ")} [${new Date(it.played_at).toLocaleTimeString("en")}]`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetQueue(): Promise<string> {
    try {
        const r = await api("GET", "/me/player/queue");
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {currently_playing: {name: string; artists: {name: string}[]} | null; queue: {name: string; artists: {name: string}[]}[]};
        const lines: string[] = [];
        if (d.currently_playing) {
            lines.push(`Now: ${d.currently_playing.name} — ${d.currently_playing.artists.map((a) => a.name).join(", ")}`);
        }
        const q = d.queue?.slice(0, 10) ?? [];
        if (q.length === 0) return lines.join("\n") + "\nNo tracks in the queue.";
        lines.push(`Next ${q.length} tracks:`);
        q.forEach((t, i) => lines.push(`  ${i + 1}. ${t.name} — ${t.artists.map((a) => a.name).join(", ")}`));
        return lines.join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

// ── Albums ────────────────────────────────────────────────────────────────────

export async function spotifyGetAlbum(id: string): Promise<string> {
    if (!id) return "ERROR: Album ID is required.";
    try {
        const r = await api("GET", `/albums/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; artists: {name: string}[]; release_date: string; total_tracks: number; label?: string};
        return `${d.name} — ${d.artists.map((a) => a.name).join(", ")} | Released: ${d.release_date} | ${d.total_tracks} tracks${d.label ? ` | Label: ${d.label}` : ""}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetAlbumTracks(id: string): Promise<string> {
    if (!id) return "ERROR: Album ID is required.";
    try {
        const r = await api("GET", `/albums/${encodeURIComponent(id)}/tracks?limit=50`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {track_number: number; name: string; duration_ms: number; uri: string}[]}).items ?? [];
        return items.map((t) => {
            const dur = Math.round(t.duration_ms / 1000);
            return `${t.track_number}. ${t.name} [${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")}] — ${t.uri}`;
        }).join("\n") || "No tracks found.";
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetSavedAlbums(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/albums?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {album: {id: string; name: string; artists: {name: string}[]; release_date: string; total_tracks: number}}[]}).items ?? [];
        if (items.length === 0) return "No saved albums.";
        return `Saved Albums (${items.length}):\n${items.map((it, i) =>
            `${i+1}. ${it.album.name} — ${it.album.artists.map((a) => a.name).join(", ")} (${it.album.release_date.slice(0,4)}, ${it.album.total_tracks} tracks)`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifySaveAlbum(id: string): Promise<string> {
    if (!id) return "ERROR: Album ID is required.";
    try {
        const r = await api("PUT", `/me/albums?ids=${encodeURIComponent(id)}`);
        if (!r.ok && r.status !== 200 && r.status !== 204) return spotifyErr(r.status, r.data);
        return "Album added to your library.";
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyRemoveSavedAlbum(id: string): Promise<string> {
    if (!id) return "ERROR: Album ID is required.";
    try {
        const r = await api("DELETE", `/me/albums?ids=${encodeURIComponent(id)}`);
        if (!r.ok && r.status !== 200 && r.status !== 204) return spotifyErr(r.status, r.data);
        return "Album removed from your library.";
    } catch (e) { return spotifyConnErr(e); }
}

// ── Artists ───────────────────────────────────────────────────────────────────

const SPOTIFY_ID_RE = /^[A-Za-z0-9]{22}$/;

async function resolveArtistId(nameOrId: string): Promise<{id: string; resolvedName?: string} | {error: string}> {
    if (SPOTIFY_ID_RE.test(nameOrId.trim())) return {id: nameOrId.trim()};
    const r = await api("GET", `/search?q=${encodeURIComponent(nameOrId)}&type=artist&limit=5`);
    if (!r.ok) return {error: spotifyErr(r.status, r.data)};
    const items = (r.data as {artists: {items: {id: string; name: string}[]}}).artists?.items ?? [];
    if (items.length === 0) return {error: `No artist named "${nameOrId}" found.`};
    return {id: items[0].id, resolvedName: items[0].name};
}

export async function spotifyGetArtist(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Artist name or ID is required.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("GET", `/artists/${resolved.id}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = (r.data ?? {}) as {name?: string; genres?: string[]; followers?: {total?: number}; popularity?: number};
        if (!d.name) return spotifyErr(r.status, r.data);
        // For some token/app types Spotify doesn't return followers/genres/popularity —
        // only show fields that actually came back, don't fabricate a 0.
        const parts = [d.name];
        if (d.followers?.total != null) parts.push(`Followers: ${d.followers.total.toLocaleString("en")}`);
        if (d.popularity != null) parts.push(`Popularity: ${d.popularity}/100`);
        if (d.genres?.length) parts.push(`Genres: ${d.genres.slice(0, 4).join(", ")}`);
        return parts.join(" | ");
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetArtistTopTracks(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Artist name or ID is required.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("GET", `/artists/${resolved.id}/top-tracks`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const tracks = (r.data as {tracks: {name: string; popularity: number; uri: string; album: {name: string}}[]}).tracks ?? [];
        const header = resolved.resolvedName ? `${resolved.resolvedName} — Top Tracks:\n` : "";
        return header + (tracks.slice(0,10).map((t, i) =>
            `${i+1}. ${t.name} (${t.album.name}) — popularity: ${t.popularity} — ${t.uri}`
        ).join("\n") || "No tracks found.");
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetArtistAlbums(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Artist name or ID is required.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("GET", `/artists/${resolved.id}/albums?limit=20&include_groups=album,single`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {id: string; name: string; release_date: string; total_tracks: number; album_type: string}[]}).items ?? [];
        const header = resolved.resolvedName ? `${resolved.resolvedName} — Albums:\n` : "";
        return header + (items.map((a, i) =>
            `${i+1}. ${a.name} (${a.album_type}, ${a.release_date.slice(0,4)}, ${a.total_tracks} tracks) — ${a.id}`
        ).join("\n") || "No albums found.");
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetRelatedArtists(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Artist name or ID is required.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("GET", `/artists/${resolved.id}/related-artists`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const artists = (r.data as {artists: {id: string; name: string; popularity: number; genres: string[]}[]}).artists ?? [];
        return artists.slice(0,10).map((a, i) =>
            `${i+1}. ${a.name} (pop: ${a.popularity}) — ${a.genres.slice(0,2).join(", ")}`
        ).join("\n") || "No related artists found.";
    } catch (e) { return spotifyConnErr(e); }
}

// ── Tracks ────────────────────────────────────────────────────────────────────

export async function spotifyGetTrack(id: string): Promise<string> {
    if (!id) return "ERROR: Track ID is required.";
    try {
        const r = await api("GET", `/tracks/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; artists: {name: string}[]; album: {name: string; release_date: string}; duration_ms: number; popularity: number; explicit: boolean; uri: string};
        const dur = Math.round(d.duration_ms / 1000);
        return `${d.name} — ${d.artists.map((a) => a.name).join(", ")} | Album: ${d.album.name} (${d.album.release_date.slice(0,4)}) | Duration: ${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")} | Pop: ${d.popularity} | URI: ${d.uri}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetAudioFeatures(id: string): Promise<string> {
    if (!id) return "ERROR: Track ID is required.";
    try {
        const r = await api("GET", `/audio-features/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {tempo: number; energy: number; valence: number; danceability: number; acousticness: number; speechiness: number; key: number; mode: number; time_signature: number};
        const keys = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
        return `Tempo: ${Math.round(d.tempo)} BPM | Energy: ${Math.round(d.energy*100)}% | Valence: ${Math.round(d.valence*100)}% | Danceability: ${Math.round(d.danceability*100)}% | Acousticness: ${Math.round(d.acousticness*100)}% | Key: ${keys[d.key] ?? "?"} ${d.mode ? "Major" : "Minor"} | Time: ${d.time_signature}/4`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetRecommendations(opts: {
    seed_artists?: string;
    seed_tracks?: string;
    seed_genres?: string;
    limit?: number;
}): Promise<string> {
    const params = new URLSearchParams();
    if (opts.seed_artists) params.set("seed_artists", opts.seed_artists);
    if (opts.seed_tracks)  params.set("seed_tracks",  opts.seed_tracks);
    if (opts.seed_genres)  params.set("seed_genres",  opts.seed_genres);
    params.set("limit", String(Math.min(20, opts.limit ?? 10)));
    try {
        const r = await api("GET", `/recommendations?${params}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const tracks = (r.data as {tracks: {name: string; artists: {name: string}[]; uri: string}[]}).tracks ?? [];
        return `${tracks.length} recommended tracks:\n${tracks.map((t, i) =>
            `${i+1}. ${t.name} — ${t.artists.map((a) => a.name).join(", ")} — ${t.uri}`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

// ── Playlists (extended) ──────────────────────────────────────────────────────

export async function spotifyGetPlaylist(id: string): Promise<string> {
    if (!id) return "ERROR: Playlist ID is required.";
    try {
        const r = await api("GET", `/playlists/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; description: string; owner: {display_name: string}; tracks: {total: number}; public: boolean; uri: string};
        return `${d.name} | Owner: ${d.owner.display_name} | ${d.tracks.total} tracks | ${d.public ? "Public" : "Private"} | URI: ${d.uri}${d.description ? "\nDescription: " + d.description : ""}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetPlaylistItems(id: string, limit = 20): Promise<string> {
    if (!id) return "ERROR: Playlist ID is required.";
    try {
        const r = await api("GET", `/playlists/${encodeURIComponent(id)}/tracks?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {track: {name: string; artists: {name: string}[]; duration_ms: number; uri: string} | null}[]}).items ?? [];
        return items.filter((it) => it.track).map((it, i) => {
            const t = it.track!;
            const dur = Math.round(t.duration_ms / 1000);
            return `${i+1}. ${t.name} — ${t.artists.map((a) => a.name).join(", ")} [${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")}]`;
        }).join("\n") || "No tracks found.";
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyCreatePlaylist(name: string, isPublic = false, description = ""): Promise<string> {
    if (!name) return "ERROR: Playlist name is required.";
    try {
        // Need the user ID
        const me = await api("GET", "/me");
        if (!me.ok) return spotifyErr(me.status, me.data);
        const userId = (me.data as {id: string}).id;
        const r = await api("POST", `/users/${userId}/playlists`, {name, public: isPublic, description});
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {id: string; uri: string; name: string};
        return `Playlist created: ${d.name} | ID: ${d.id} | URI: ${d.uri}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyPlaylistAdd(playlistId: string, uris: string[]): Promise<string> {
    if (!playlistId || uris.length === 0) return "ERROR: Playlist ID and at least one URI are required.";
    try {
        const r = await api("POST", `/playlists/${encodeURIComponent(playlistId)}/tracks`, {uris});
        if (!r.ok) return spotifyErr(r.status, r.data);
        return `${uris.length} track(s) added to the playlist.`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyPlaylistRemove(playlistId: string, uris: string[]): Promise<string> {
    if (!playlistId || uris.length === 0) return "ERROR: Playlist ID and at least one URI are required.";
    try {
        const r = await api("DELETE", `/playlists/${encodeURIComponent(playlistId)}/tracks`, {tracks: uris.map((uri) => ({uri}))});
        if (!r.ok) return spotifyErr(r.status, r.data);
        return `${uris.length} track(s) removed from the playlist.`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetFeaturedPlaylists(): Promise<string> {
    try {
        const r = await api("GET", "/browse/featured-playlists?limit=10");
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {message?: string; playlists: {items: {id: string; name: string; description: string; tracks: {total: number}}[]}};
        const items = d.playlists?.items ?? [];
        const header = d.message ? `${d.message}\n` : "";
        return header + items.map((p, i) => `${i+1}. ${p.name} (${p.tracks.total} tracks) — ${p.description || ""}`).join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

// ── Library ───────────────────────────────────────────────────────────────────

export async function spotifyGetSavedTracks(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/tracks?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {added_at: string; track: {name: string; artists: {name: string}[]; uri: string}}[]}).items ?? [];
        if (items.length === 0) return "No liked tracks.";
        return `Liked Songs (${items.length}):\n${items.map((it, i) =>
            `${i+1}. ${it.track.name} — ${it.track.artists.map((a) => a.name).join(", ")}`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyCheckSavedTracks(ids: string[]): Promise<string> {
    if (ids.length === 0) return "ERROR: At least one track ID is required.";
    try {
        const r = await api("GET", `/me/tracks/contains?ids=${ids.slice(0,50).join(",")}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const results = r.data as boolean[];
        return ids.map((id, i) => `${id}: ${results[i] ? "liked" : "not liked"}`).join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetSavedShows(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/shows?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {show: {id: string; name: string; publisher: string; total_episodes: number}}[]}).items ?? [];
        if (items.length === 0) return "No saved podcasts.";
        return `Saved Podcasts (${items.length}):\n${items.map((it, i) =>
            `${i+1}. ${it.show.name} — ${it.show.publisher} (${it.show.total_episodes} episodes) — ID: ${it.show.id}`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetSavedEpisodes(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/episodes?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {episode: {name: string; show: {name: string}; duration_ms: number; uri: string}}[]}).items ?? [];
        if (items.length === 0) return "No saved episodes.";
        return items.map((it, i) => {
            const dur = Math.round(it.episode.duration_ms / 1000 / 60);
            return `${i+1}. ${it.episode.name} (${it.episode.show.name}) [${dur} min]`;
        }).join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetSavedAudiobooks(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/audiobooks?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {id: string; name: string; authors: {name: string}[]; total_chapters: number}[]}).items ?? [];
        if (items.length === 0) return "No saved audiobooks.";
        return items.map((b, i) =>
            `${i+1}. ${b.name} — ${b.authors.map((a) => a.name).join(", ")} (${b.total_chapters} chapters)`
        ).join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function spotifyGetCurrentUser(): Promise<string> {
    try {
        const r = await api("GET", "/me");
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {display_name: string; email?: string; country: string; product: string; followers: {total: number}; id: string};
        return `${d.display_name} | ID: ${d.id}${d.email ? ` | Email: ${d.email}` : ""} | Country: ${d.country} | Plan: ${d.product} | Followers: ${d.followers.total}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetTopItems(type: "artists" | "tracks", timeRange: "short_term" | "medium_term" | "long_term" = "medium_term", limit = 10): Promise<string> {
    try {
        const r = await api("GET", `/me/top/${type}?time_range=${timeRange}&limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {name: string; artists?: {name: string}[]; genres?: string[]; popularity: number}[]}).items ?? [];
        const rangeLabel: Record<string, string> = {short_term: "Last 4 Weeks", medium_term: "Last 6 Months", long_term: "All Time"};
        const header = `Top ${type === "artists" ? "Artists" : "Tracks"} (${rangeLabel[timeRange]}):\n`;
        return header + items.map((it, i) => {
            if (type === "artists") return `${i+1}. ${it.name} — ${it.genres?.slice(0,2).join(", ") ?? ""}`;
            return `${i+1}. ${it.name} — ${it.artists?.map((a) => a.name).join(", ") ?? ""}`;
        }).join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

// ── Follow ────────────────────────────────────────────────────────────────────

export async function spotifyFollowArtist(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Artist name or ID is required.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("PUT", `/me/following?type=artist&ids=${resolved.id}`);
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        return `Now following ${resolved.resolvedName ?? nameOrId}.`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyUnfollowArtist(nameOrId: string): Promise<string> {
    if (!nameOrId) return "ERROR: Artist name or ID is required.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("DELETE", `/me/following?type=artist&ids=${resolved.id}`);
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        return `Unfollowed ${resolved.resolvedName ?? nameOrId}.`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetFollowedArtists(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/following?type=artist&limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const artists = (r.data as {artists: {items: {id: string; name: string; popularity: number; genres: string[]}[]}}).artists?.items ?? [];
        if (artists.length === 0) return "No followed artists.";
        return `Followed Artists (${artists.length}):\n${artists.map((a, i) =>
            `${i+1}. ${a.name} — pop: ${a.popularity} | ${a.genres.slice(0,2).join(", ")}`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

// ── Browse ────────────────────────────────────────────────────────────────────

export async function spotifyGetNewReleases(limit = 10): Promise<string> {
    try {
        const r = await api("GET", `/browse/new-releases?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {albums: {items: {id: string; name: string; artists: {name: string}[]; release_date: string; album_type: string}[]}}).albums?.items ?? [];
        return `New Releases (${items.length}):\n${items.map((a, i) =>
            `${i+1}. ${a.name} — ${a.artists.map((x) => x.name).join(", ")} (${a.album_type}, ${a.release_date}) — ID: ${a.id}`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetCategories(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/browse/categories?limit=${Math.min(50, limit)}&locale=en_US`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {categories: {items: {id: string; name: string}[]}}).categories?.items ?? [];
        return `Spotify Categories (${items.length}):\n${items.map((c, i) => `${i+1}. ${c.name} — ID: ${c.id}`).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

// ── Shows / Episodes / Audiobooks ─────────────────────────────────────────────

export async function spotifyGetShow(id: string): Promise<string> {
    if (!id) return "ERROR: Podcast ID is required.";
    try {
        const r = await api("GET", `/shows/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; publisher: string; description: string; total_episodes: number; explicit: boolean; languages: string[]};
        return `${d.name} | Publisher: ${d.publisher} | ${d.total_episodes} episodes | Language: ${d.languages.join(", ")}${d.description ? "\n" + d.description.slice(0,200) : ""}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetShowEpisodes(id: string, limit = 10): Promise<string> {
    if (!id) return "ERROR: Podcast ID is required.";
    try {
        const r = await api("GET", `/shows/${encodeURIComponent(id)}/episodes?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {name: string; description: string; duration_ms: number; release_date: string; uri: string}[]}).items ?? [];
        return items.map((ep, i) => {
            const dur = Math.round(ep.duration_ms / 1000 / 60);
            return `${i+1}. ${ep.name} [${dur} min, ${ep.release_date}]\n   ${ep.description.slice(0,100)}…\n   URI: ${ep.uri}`;
        }).join("\n\n") || "No episodes found.";
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetEpisode(id: string): Promise<string> {
    if (!id) return "ERROR: Episode ID is required.";
    try {
        const r = await api("GET", `/episodes/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; description: string; show: {name: string}; duration_ms: number; release_date: string; uri: string};
        const dur = Math.round(d.duration_ms / 1000 / 60);
        return `${d.name} | Podcast: ${d.show.name} | Duration: ${dur} min | Released: ${d.release_date}\n${d.description.slice(0,300)}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetAudiobook(id: string): Promise<string> {
    if (!id) return "ERROR: Audiobook ID is required.";
    try {
        const r = await api("GET", `/audiobooks/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; authors: {name: string}[]; narrators: {name: string}[]; description: string; total_chapters: number; languages: string[]};
        return `${d.name} | Author: ${d.authors.map((a) => a.name).join(", ")} | Narrator: ${d.narrators.map((n) => n.name).join(", ")} | ${d.total_chapters} chapters | Language: ${d.languages.join(", ")}\n${d.description.slice(0,200)}`;
    } catch (e) { return spotifyConnErr(e); }
}

// Export the callback-page generator for tests/visual verification (pure function).
export const __callbackPageForTest = callbackPage;
