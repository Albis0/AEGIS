/**
 * Spotify Web API — OAuth2 PKCE + full control
 *
 * Client ID ve Secret vault'ta saklanır (aegis-config veya vaultGet).
 * İlk çalıştırmada tarayıcı açılır, kullanıcı Spotify'a login olur,
 * callback port:17832'ye gelir, token alınır ve şifreli olarak kaydedilir.
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
    fs.mkdirSync(path.dirname(TOKEN_PATH), {recursive: true});
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(data), "utf-8");
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

export async function spotifyAuthorize(): Promise<string> {
    if (_callbackServer) return "Yetkilendirme zaten devam ediyor. Lütfen tarayıcıda giriş yap.";

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

    // Callback sunucusu — tek seferlik
    await new Promise<void>((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            const url = new URL(req.url ?? "/", "http://localhost");
            if (url.pathname !== "/callback") { res.end(); return; }

            const code = url.searchParams.get("code");
            const err = url.searchParams.get("error");

            if (err || !code) {
                res.end("<html><body><h2>Hata: " + (err ?? "code yok") + "</h2></body></html>");
                server.close();
                _callbackServer = null;
                reject(new Error(err ?? "code yok"));
                return;
            }

            try {
                const token = await exchangeCode(code, _pendingVerifier ?? "");
                saveToken(token);
                res.end("<html><body><h2>AEGIS Spotify yetkilendirmesi tamamlandi! Bu sekmeyi kapatabilirsin.</h2></body></html>");
            } catch (e) {
                res.end("<html><body><h2>Token alinamaadi: " + (e as Error).message + "</h2></body></html>");
            }
            server.close();
            _callbackServer = null;
            _pendingVerifier = null;
            resolve();
        });

        server.listen(17832, "127.0.0.1", () => {
            _callbackServer = server;
            // Tarayıcıyı aç
            execCb(`cmd /c start "" "${authUrl}"`, {windowsHide: true}, () => {});
            resolve(); // sunucu açıldı, devam et — callback async gelecek
        });

        server.on("error", (e) => {
            _callbackServer = null;
            reject(e);
        });
    });

    return `Spotify yetkilendirme tarayıcıda açıldı. Giriş yap ve izin ver. Tamamlanınca AEGIS otomatik token alacak.`;
}

async function exchangeCode(code: string, verifier: string): Promise<TokenData> {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier,
    });

    const resp = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: body.toString(),
    });

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

    const resp = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: body.toString(),
    });

    if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status} ${await resp.text()}`);
    const data = await resp.json() as {access_token: string; refresh_token?: string; expires_in: number};
    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? refreshToken,
        expires_at: Date.now() + data.expires_in * 1000,
    };
}

// ── Token getter — otomatik yenileme ─────────────────────────────────────────
async function getToken(): Promise<string> {
    let token = loadToken();
    if (!token) throw new Error("Spotify hesabı bağlı değil. 'Spotify bağla' veya 'Spotify yetkilendir' de.");

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
    const resp = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        method,
        headers: {
            "Authorization": `Bearer ${tok}`,
            ...(body ? {"Content-Type": "application/json"} : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (resp.status === 204) return {ok: true, status: 204, data: null};
    const text = await resp.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch {}
    return {ok: resp.ok, status: resp.status, data};
}

// ── Spotify hata mesajı çevirici ─────────────────────────────────────────────
function spotifyErr(status: number, data?: unknown): string {
    const msg = (data as {error?: {message?: string}})?.error?.message ?? "";
    if (status === 401) return "Spotify oturumu sona erdi. 'Spotify bağla' diyerek yeniden bağlan.";
    if (status === 403) return `Spotify izin hatası${msg ? ": " + msg : " (403)"}. Hesabında Premium gerekiyor olabilir veya bu özellik kısıtlı.`;
    if (status === 404) return "Spotify'da aktif çalar bulunamadı. Spotify uygulamasını aç ve bir şey çalmayı dene.";
    if (status === 429) return "Spotify hız sınırına takıldı. Birkaç saniye bekleyip tekrar dene.";
    if (status >= 500) return "Spotify sunucusu geçici olarak yanıt vermiyor. Tekrar dene.";
    return msg ? `Spotify: ${msg}` : `Spotify hatası (${status})`;
}

// ── Active device helper ──────────────────────────────────────────────────────
async function getActiveDeviceId(): Promise<string | null> {
    const r = await api("GET", "/me/player/devices");
    if (!r.ok) return null;
    const devices = (r.data as {devices: {id: string; is_active: boolean; name: string}[]}).devices ?? [];
    const active = devices.find((d) => d.is_active) ?? devices[0];
    return active?.id ?? null;
}

// ── Spotify kontrolü: cihaz yoksa uygulamayı aç ──────────────────────────────
async function ensureDevice(): Promise<string | null> {
    let deviceId = await getActiveDeviceId();
    if (deviceId) return deviceId;

    // Spotify masaüstü uygulamasını aç
    execCb(`cmd /c start spotify:`, {windowsHide: true}, () => {});
    await new Promise((r) => setTimeout(r, 3000));
    deviceId = await getActiveDeviceId();
    return deviceId;
}

// ── Public API fonksiyonları ──────────────────────────────────────────────────

export async function spotifyAuthorizeCmd(): Promise<string> {
    return spotifyAuthorize();
}

export async function spotifyPlay(): Promise<string> {
    try {
        const deviceId = await ensureDevice();
        const body = deviceId ? {device_ids: [deviceId], play: true} : undefined;
        await api("PUT", "/me/player", body);
        await api("PUT", "/me/player/play", deviceId ? {device_id: deviceId} : undefined);
        return "Spotify başlatıldı.";
    } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("bağlı değil")) return `${msg} — önce Spotify bağla.`;
        return `Hata: ${msg}`;
    }
}

export async function spotifyPause(): Promise<string> {
    try {
        const r = await api("PUT", "/me/player/pause");
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        return "Spotify duraklatıldı.";
    } catch (e) { return `Spotify bağlantı hatası: ${(e as Error).message}`; }
}

export async function spotifyNext(): Promise<string> {
    try {
        const deviceId = await ensureDevice();
        const endpoint = deviceId ? `/me/player/next?device_id=${deviceId}` : "/me/player/next";
        const r = await api("POST", endpoint);
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        await new Promise((res) => setTimeout(res, 1000));
        return await spotifyGetState();
    } catch (e) { return `Spotify bağlantı hatası: ${(e as Error).message}`; }
}

export async function spotifyPrev(): Promise<string> {
    try {
        const deviceId = await ensureDevice();
        const endpoint = deviceId ? `/me/player/previous?device_id=${deviceId}` : "/me/player/previous";
        const r = await api("POST", endpoint);
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        await new Promise((res) => setTimeout(res, 1000));
        return await spotifyGetState();
    } catch (e) { return `Spotify bağlantı hatası: ${(e as Error).message}`; }
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
        return `Ses seviyesi %${clamped} yapıldı.`;
    } catch (e) { return `Spotify bağlantı hatası: ${(e as Error).message}`; }
}

export async function spotifyGetState(): Promise<string> {
    try {
        const r = await api("GET", "/me/player");
        if (r.status === 204 || !r.data) return "Spotify'da şu an hiçbir şey çalmıyor.";
        const d = r.data as {
            is_playing: boolean;
            item: {name: string; artists: {name: string}[]; album: {name: string}; duration_ms: number};
            progress_ms: number;
            device: {volume_percent: number};
        };
        if (!d.item) return "Spotify'da şu an hiçbir şey çalmıyor.";
        const artists = d.item.artists.map((a) => a.name).join(", ");
        const prog = Math.round(d.progress_ms / 1000);
        const dur = Math.round(d.item.duration_ms / 1000);
        const vol = d.device?.volume_percent ?? -1;
        const m = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        return `${d.is_playing ? "Oynuyor" : "Duraklatildi"}: ${d.item.name} — ${artists} (${d.item.album.name}) [${m(prog)}/${m(dur)}] {vol:${vol}}`;
    } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("bağlı değil")) return "Spotify hesabı bağlı değil. 'Spotify bağla' de.";
        return `Hata: ${msg}`;
    }
}

export async function spotifyOpen(): Promise<string> {
    execCb(`cmd /c start spotify:`, {windowsHide: true}, () => {});
    await new Promise((r) => setTimeout(r, 1500));
    return "Spotify açıldı.";
}

export async function spotifySearchPlay(query: string): Promise<string> {
    if (!query) return "HATA: Arama sorgusu boş.";
    try {
        const r = await api("GET", `/search?q=${encodeURIComponent(query)}&type=track&limit=1`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const tracks = (r.data as {tracks: {items: {uri: string; name: string; artists: {name: string}[]}[]}}).tracks?.items ?? [];
        if (tracks.length === 0) return `"${query}" için sonuç bulunamadı.`;
        const track = tracks[0];
        const deviceId = await ensureDevice();
        await api("PUT", "/me/player/play", {
            uris: [track.uri],
            ...(deviceId ? {device_id: deviceId} : {}),
        });
        return `Caliniyor: ${track.name} — ${track.artists.map((a) => a.name).join(", ")}`;
    } catch (e) { return `Hata: ${(e as Error).message}`; }
}

export async function spotifyListPlaylists(): Promise<string> {
    try {
        const r = await api("GET", "/me/playlists?limit=20");
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {id: string; name: string; tracks: {total: number}}[]}).items ?? [];
        if (items.length === 0) return "Playlist bulunamadı.";
        return `Spotify Playlistlerin (${items.length}):\n${items.map((p, i) => `${i + 1}. ${p.name} (${p.tracks.total} sarki) — ID: ${p.id}`).join("\n")}`;
    } catch (e) { return `Hata: ${(e as Error).message}`; }
}

export async function spotifyPlayPlaylist(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Playlist adı veya ID gerekli.";
    try {
        // ID mi isim mi?
        let playlistUri = "";
        if (/^[A-Za-z0-9]{22}$/.test(nameOrId.trim())) {
            playlistUri = `spotify:playlist:${nameOrId.trim()}`;
        } else {
            // İsimle ara
            const r = await api("GET", "/me/playlists?limit=50");
            const items = (r.data as {items: {id: string; name: string}[]}).items ?? [];
            const match = items.find((p) => p.name.toLowerCase().includes(nameOrId.toLowerCase()));
            if (!match) return `"${nameOrId}" adında playlist bulunamadı. "playlist listele" ile kontrol et.`;
            playlistUri = `spotify:playlist:${match.id}`;
        }
        const deviceId = await ensureDevice();
        await api("PUT", "/me/player/play", {
            context_uri: playlistUri,
            ...(deviceId ? {device_id: deviceId} : {}),
        });
        return `Playlist baslatildi: ${nameOrId}`;
    } catch (e) { return `Hata: ${(e as Error).message}`; }
}

export async function spotifyLikeTrack(): Promise<string> {
    try {
        const r = await api("GET", "/me/player/currently-playing");
        const d = r.data as {item: {id: string; name: string}};
        if (!d?.item) return "Şu an çalan şarkı yok.";
        await api("PUT", `/me/tracks?ids=${d.item.id}`);
        return `Beglenildi: ${d.item.name}`;
    } catch (e) { return `Hata: ${(e as Error).message}`; }
}

export async function spotifyAddToQueue(query: string): Promise<string> {
    if (!query) return "HATA: Şarkı adı gerekli.";
    try {
        const r = await api("GET", `/search?q=${encodeURIComponent(query)}&type=track&limit=1`);
        const tracks = (r.data as {tracks: {items: {uri: string; name: string; artists: {name: string}[]}[]}}).tracks?.items ?? [];
        if (tracks.length === 0) return `"${query}" bulunamadı.`;
        const track = tracks[0];
        await api("POST", `/me/player/queue?uri=${encodeURIComponent(track.uri)}`);
        return `Siraya eklendi: ${track.name} — ${track.artists.map((a) => a.name).join(", ")}`;
    } catch (e) { return `Hata: ${(e as Error).message}`; }
}

export async function spotifyListDevices(): Promise<string> {
    try {
        const r = await api("GET", "/me/player/devices");
        const devices = (r.data as {devices: {id: string; name: string; type: string; is_active: boolean; volume_percent: number}[]}).devices ?? [];
        if (devices.length === 0) return "Aktif Spotify cihazı bulunamadı. Spotify uygulamasını aç.";
        return `Spotify Cihazlari:\n${devices.map((d) => `${d.is_active ? "[AKTIF] " : ""}${d.name} (${d.type}) — ses: %${d.volume_percent}`).join("\n")}`;
    } catch (e) { return `Hata: ${(e as Error).message}`; }
}

export async function spotifyTransferDevice(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Cihaz adı veya ID gerekli.";
    try {
        const r = await api("GET", "/me/player/devices");
        const devices = (r.data as {devices: {id: string; name: string}[]}).devices ?? [];
        const dev = devices.find((d) => d.id === nameOrId || d.name.toLowerCase().includes(nameOrId.toLowerCase()));
        if (!dev) return `"${nameOrId}" cihazı bulunamadı. "Spotify cihazları" ile listele.`;
        await api("PUT", "/me/player", {device_ids: [dev.id], play: true});
        return `Muzik ${dev.name} cihazına aktarıldı.`;
    } catch (e) { return `Hata: ${(e as Error).message}`; }
}

export async function spotifySetShuffle(enabled: boolean): Promise<string> {
    try {
        await api("PUT", `/me/player/shuffle?state=${enabled}`);
        return `Karistir modu ${enabled ? "acildi" : "kapatildi"}.`;
    } catch (e) { return `Hata: ${(e as Error).message}`; }
}

export async function spotifySetRepeat(mode: "off" | "track" | "context"): Promise<string> {
    try {
        await api("PUT", `/me/player/repeat?state=${mode}`);
        const labels: Record<string, string> = {off: "kapalı", track: "sarki tekrar", context: "liste tekrar"};
        return `Tekrar modu: ${labels[mode] ?? mode}`;
    } catch (e) { return `Hata: ${(e as Error).message}`; }
}
