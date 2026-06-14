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
import {fetchWithTimeout, isTimeoutError, TIMEOUT_MSG} from "./fetch-utils";

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
            ? "Spotify token kaydedilemedi: dosya izni hatası."
            : code === "ENOSPC"
            ? "Spotify token kaydedilemedi: disk dolu."
            : `Spotify token kaydedilemedi: ${(e as Error).message}`;
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

// ── Spotify bağlantı hatası çevirici ─────────────────────────────────────────
function spotifyConnErr(e: unknown): string {
    if (isTimeoutError(e)) return "Spotify'a bağlanırken zaman aşımı. İnternet bağlantını kontrol et.";
    const msg = (e as Error).message ?? String(e);
    if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(msg)) return "Spotify sunucusuna ulaşılamıyor. İnternet bağlantını kontrol et.";
    if (msg.includes("bağlı değil") || msg.includes("not authorized")) return "Spotify AEGIS'e bağlı değil. 'spotify bağla' diyerek yetkilendir.";
    if (msg.includes("No active device")) return "Spotify'da aktif cihaz yok. Spotify uygulamasını aç ve bir şey çal.";
    return `Spotify hatası: ${msg}`;
}

// ── Spotify HTTP hata mesajı çevirici ─────────────────────────────────────────
function spotifyErr(status: number, data?: unknown): string {
    const msg = (data as {error?: {message?: string}})?.error?.message ?? "";
    const low = msg.toLowerCase();
    if (status === 401) return "Spotify oturumu sona erdi. 'Spotify bağla' diyerek yeniden yetkilendir.";
    if (status === 403) {
        if (/premium/i.test(low)) return "Bu özellik için Spotify Premium gerekiyor.";
        if (/not.*register|developer/i.test(low)) return "Bu Spotify hesabı uygulamaya kayıtlı değil. Geliştirici panelinden eklenmen gerekiyor.";
        return `Spotify: Erişim reddedildi (403)${msg ? " — " + msg : ""}`;
    }
    if (status === 404) return "Spotify'da aktif çalar bulunamadı. Spotify'ı aç ve müzik çalmayı başlat.";
    if (status === 429) return "Spotify çok fazla istek aldı. Birkaç saniye bekleyip tekrar dene.";
    if (status >= 500) return "Spotify sunucusu geçici hata verdi. Biraz bekleyip tekrar dene.";
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
        return `Ses seviyesi %${clamped} yapıldı.`;
    } catch (e) { return spotifyConnErr(e); }
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
        const r = await api("GET", `/search?q=${encodeURIComponent(query)}&type=track&limit=5`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const tracks = (r.data as {tracks: {items: {uri: string; name: string; artists: {name: string}[]}[]}}).tracks?.items ?? [];
        if (tracks.length === 0) return `"${query}" için sonuç bulunamadı.`;

        // Query kelimelerini track adı + sanatçıyla karşılaştır, en iyi eşleşmeyi seç
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

// "Beğenilen Şarkılar" / "Liked Songs" SPOTIFY'DA NORMAL PLAYLIST DEĞİL — /me/playlists'te
// görünmez ve context_uri ile çalınamaz. Bu yüzden ayrı ele alınır (saved-tracks → uris).
const LIKED_ALIASES = ["begenilen", "liked", "liked songs", "favori", "favoriler", "begendiklerim", "kaydedilen", "saved"];
function isLikedSongs(name: string): boolean {
    const n = name.toLowerCase()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
        .replace(/sarki(lar)?|songs?/g, "").trim();
    if (n.length < 3) return false; // boş/çok kısa "şarkılar" sonrası false-positive olmasın
    return LIKED_ALIASES.some((a) => a.includes(n) || n.includes(a.split(" ")[0]));
}

async function playLikedSongs(): Promise<string> {
    // Beğenilen şarkıları çek (max 50) ve uris ile çal — context_uri yok.
    const r = await api("GET", "/me/tracks?limit=50");
    if (!r.ok) return spotifyErr(r.status, r.data);
    const items = (r.data as {items: {track: {uri: string}}[]}).items ?? [];
    const uris = items.map((it) => it.track?.uri).filter(Boolean);
    if (uris.length === 0) return "Beğenilen şarkın yok.";
    const deviceId = await ensureDevice();
    if (!deviceId) return "Spotify'da aktif cihaz yok. Spotify uygulamasını aç, sonra tekrar dene.";
    const pr = await api("PUT", "/me/player/play", {uris, device_id: deviceId});
    if (!pr.ok && pr.status !== 204) return spotifyErr(pr.status, pr.data);
    return `Beğenilen Şarkılar çalınıyor (${uris.length} şarkı).`;
}

export async function spotifyPlayPlaylist(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Playlist adı veya ID gerekli.";
    try {
        // ID verildiyse doğrudan çal.
        if (/^[A-Za-z0-9]{22}$/.test(nameOrId.trim())) {
            const deviceId = await ensureDevice();
            if (!deviceId) return "Spotify'da aktif cihaz yok. Spotify uygulamasını aç, sonra tekrar dene.";
            const pr = await api("PUT", "/me/player/play", {context_uri: `spotify:playlist:${nameOrId.trim()}`, device_id: deviceId});
            if (!pr.ok && pr.status !== 204) return spotifyErr(pr.status, pr.data);
            return `Playlist başlatıldı.`;
        }

        // İsimle ÖNCE gerçek playlist'lerde ara (kullanıcının "Beğenilen Şarkılar" adında
        // GERÇEK bir playlist'i olabilir — onu tercih et).
        const r = await api("GET", "/me/playlists?limit=50");
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {id: string; name: string}[]}).items ?? [];
        const q = nameOrId.toLowerCase();
        const match = items.find((p) => p.name.toLowerCase() === q)
            ?? items.find((p) => p.name.toLowerCase().includes(q));

        if (match) {
            const deviceId = await ensureDevice();
            if (!deviceId) return "Spotify'da aktif cihaz yok. Spotify uygulamasını aç, sonra tekrar dene.";
            const pr2 = await api("PUT", "/me/player/play", {context_uri: `spotify:playlist:${match.id}`, device_id: deviceId});
            if (!pr2.ok && pr2.status !== 204) return spotifyErr(pr2.status, pr2.data);
            return `Playlist başlatıldı: ${match.name}`;
        }

        // Gerçek playlist bulunamadı — "Beğenilen Şarkılar"/Liked Songs ise özel koleksiyonu çal.
        if (isLikedSongs(nameOrId)) return await playLikedSongs();

        // Hiçbir şey eşleşmedi — kullanıcının seçebilmesi için mevcutları listele.
        const names = items.slice(0, 8).map((p) => `• ${p.name}`).join("\n");
        return `"${nameOrId}" adında playlist bulunamadı.` +
            (names ? `\n\nMevcut playlist'lerin:\n${names}` : " Hiç playlist'in yok gibi görünüyor.") +
            `\n\nNot: Spotify "Beğenilen Şarkılar"ı çalmak için "beğenilenleri çal" diyebilirsin.`;
    } catch (e) { return spotifyConnErr(e); }
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

// ── Player extras ─────────────────────────────────────────────────────────────

export async function spotifySeek(position_ms: number): Promise<string> {
    try {
        const ms = Math.max(0, Math.round(position_ms));
        const r = await api("PUT", `/me/player/seek?position_ms=${ms}`);
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        return `${m}:${String(s).padStart(2, "0")} konumuna gidildi.`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetRecentlyPlayed(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/player/recently-played?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {track: {name: string; artists: {name: string}[]}; played_at: string}[]}).items ?? [];
        if (items.length === 0) return "Son dinlenen şarkı bulunamadı.";
        return `Son Dinlenenler (${items.length}):\n${items.map((it, i) =>
            `${i + 1}. ${it.track.name} — ${it.track.artists.map((a) => a.name).join(", ")} [${new Date(it.played_at).toLocaleTimeString("tr")}]`
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
            lines.push(`Şu an: ${d.currently_playing.name} — ${d.currently_playing.artists.map((a) => a.name).join(", ")}`);
        }
        const q = d.queue?.slice(0, 10) ?? [];
        if (q.length === 0) return lines.join("\n") + "\nSırada şarkı yok.";
        lines.push(`Sıradaki ${q.length} şarkı:`);
        q.forEach((t, i) => lines.push(`  ${i + 1}. ${t.name} — ${t.artists.map((a) => a.name).join(", ")}`));
        return lines.join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

// ── Albums ────────────────────────────────────────────────────────────────────

export async function spotifyGetAlbum(id: string): Promise<string> {
    if (!id) return "HATA: Albüm ID gerekli.";
    try {
        const r = await api("GET", `/albums/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; artists: {name: string}[]; release_date: string; total_tracks: number; label?: string};
        return `${d.name} — ${d.artists.map((a) => a.name).join(", ")} | Çıkış: ${d.release_date} | ${d.total_tracks} şarkı${d.label ? ` | Etiket: ${d.label}` : ""}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetAlbumTracks(id: string): Promise<string> {
    if (!id) return "HATA: Albüm ID gerekli.";
    try {
        const r = await api("GET", `/albums/${encodeURIComponent(id)}/tracks?limit=50`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {track_number: number; name: string; duration_ms: number; uri: string}[]}).items ?? [];
        return items.map((t) => {
            const dur = Math.round(t.duration_ms / 1000);
            return `${t.track_number}. ${t.name} [${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")}] — ${t.uri}`;
        }).join("\n") || "Şarkı bulunamadı.";
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetSavedAlbums(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/albums?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {album: {id: string; name: string; artists: {name: string}[]; release_date: string; total_tracks: number}}[]}).items ?? [];
        if (items.length === 0) return "Kaydedilmiş albüm yok.";
        return `Kayıtlı Albümler (${items.length}):\n${items.map((it, i) =>
            `${i+1}. ${it.album.name} — ${it.album.artists.map((a) => a.name).join(", ")} (${it.album.release_date.slice(0,4)}, ${it.album.total_tracks} şarkı)`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifySaveAlbum(id: string): Promise<string> {
    if (!id) return "HATA: Albüm ID gerekli.";
    try {
        const r = await api("PUT", `/me/albums?ids=${encodeURIComponent(id)}`);
        if (!r.ok && r.status !== 200 && r.status !== 204) return spotifyErr(r.status, r.data);
        return "Albüm kütüphaneye eklendi.";
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyRemoveSavedAlbum(id: string): Promise<string> {
    if (!id) return "HATA: Albüm ID gerekli.";
    try {
        const r = await api("DELETE", `/me/albums?ids=${encodeURIComponent(id)}`);
        if (!r.ok && r.status !== 200 && r.status !== 204) return spotifyErr(r.status, r.data);
        return "Albüm kütüphaneden kaldırıldı.";
    } catch (e) { return spotifyConnErr(e); }
}

// ── Artists ───────────────────────────────────────────────────────────────────

const SPOTIFY_ID_RE = /^[A-Za-z0-9]{22}$/;

async function resolveArtistId(nameOrId: string): Promise<{id: string; resolvedName?: string} | {error: string}> {
    if (SPOTIFY_ID_RE.test(nameOrId.trim())) return {id: nameOrId.trim()};
    const r = await api("GET", `/search?q=${encodeURIComponent(nameOrId)}&type=artist&limit=5`);
    if (!r.ok) return {error: spotifyErr(r.status, r.data)};
    const items = (r.data as {artists: {items: {id: string; name: string}[]}}).artists?.items ?? [];
    if (items.length === 0) return {error: `"${nameOrId}" adında sanatçı bulunamadı.`};
    return {id: items[0].id, resolvedName: items[0].name};
}

export async function spotifyGetArtist(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Sanatçı adı veya ID gerekli.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("GET", `/artists/${resolved.id}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = (r.data ?? {}) as {name?: string; genres?: string[]; followers?: {total?: number}; popularity?: number};
        if (!d.name) return spotifyErr(r.status, r.data);
        // Spotify bazı token/uygulama tiplerinde followers/genres/popularity döndürmüyor —
        // yalnızca gerçekten gelen alanları göster, yoksa uydurma 0 yazma.
        const parts = [d.name];
        if (d.followers?.total != null) parts.push(`Takipçi: ${d.followers.total.toLocaleString("tr")}`);
        if (d.popularity != null) parts.push(`Popülerlik: ${d.popularity}/100`);
        if (d.genres?.length) parts.push(`Türler: ${d.genres.slice(0, 4).join(", ")}`);
        return parts.join(" | ");
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetArtistTopTracks(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Sanatçı adı veya ID gerekli.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("GET", `/artists/${resolved.id}/top-tracks`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const tracks = (r.data as {tracks: {name: string; popularity: number; uri: string; album: {name: string}}[]}).tracks ?? [];
        const header = resolved.resolvedName ? `${resolved.resolvedName} — Top Şarkılar:\n` : "";
        return header + (tracks.slice(0,10).map((t, i) =>
            `${i+1}. ${t.name} (${t.album.name}) — popülerlik: ${t.popularity} — ${t.uri}`
        ).join("\n") || "Şarkı bulunamadı.");
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetArtistAlbums(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Sanatçı adı veya ID gerekli.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("GET", `/artists/${resolved.id}/albums?limit=20&include_groups=album,single`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {id: string; name: string; release_date: string; total_tracks: number; album_type: string}[]}).items ?? [];
        const header = resolved.resolvedName ? `${resolved.resolvedName} — Albümler:\n` : "";
        return header + (items.map((a, i) =>
            `${i+1}. ${a.name} (${a.album_type}, ${a.release_date.slice(0,4)}, ${a.total_tracks} şarkı) — ${a.id}`
        ).join("\n") || "Albüm bulunamadı.");
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetRelatedArtists(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Sanatçı adı veya ID gerekli.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("GET", `/artists/${resolved.id}/related-artists`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const artists = (r.data as {artists: {id: string; name: string; popularity: number; genres: string[]}[]}).artists ?? [];
        return artists.slice(0,10).map((a, i) =>
            `${i+1}. ${a.name} (pop: ${a.popularity}) — ${a.genres.slice(0,2).join(", ")}`
        ).join("\n") || "Benzer sanatçı bulunamadı.";
    } catch (e) { return spotifyConnErr(e); }
}

// ── Tracks ────────────────────────────────────────────────────────────────────

export async function spotifyGetTrack(id: string): Promise<string> {
    if (!id) return "HATA: Şarkı ID gerekli.";
    try {
        const r = await api("GET", `/tracks/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; artists: {name: string}[]; album: {name: string; release_date: string}; duration_ms: number; popularity: number; explicit: boolean; uri: string};
        const dur = Math.round(d.duration_ms / 1000);
        return `${d.name} — ${d.artists.map((a) => a.name).join(", ")} | Albüm: ${d.album.name} (${d.album.release_date.slice(0,4)}) | Süre: ${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")} | Pop: ${d.popularity} | URI: ${d.uri}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetAudioFeatures(id: string): Promise<string> {
    if (!id) return "HATA: Şarkı ID gerekli.";
    try {
        const r = await api("GET", `/audio-features/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {tempo: number; energy: number; valence: number; danceability: number; acousticness: number; speechiness: number; key: number; mode: number; time_signature: number};
        const keys = ["Do","Do#","Re","Re#","Mi","Fa","Fa#","Sol","Sol#","La","La#","Si"];
        return `Tempo: ${Math.round(d.tempo)} BPM | Enerji: ${Math.round(d.energy*100)}% | Neşe: ${Math.round(d.valence*100)}% | Dans: ${Math.round(d.danceability*100)}% | Akustiklik: ${Math.round(d.acousticness*100)}% | Ton: ${keys[d.key] ?? "?"} ${d.mode ? "Major" : "Minor"} | Vuruş: ${d.time_signature}/4`;
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
        return `Önerilen ${tracks.length} şarkı:\n${tracks.map((t, i) =>
            `${i+1}. ${t.name} — ${t.artists.map((a) => a.name).join(", ")} — ${t.uri}`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

// ── Playlists (extended) ──────────────────────────────────────────────────────

export async function spotifyGetPlaylist(id: string): Promise<string> {
    if (!id) return "HATA: Playlist ID gerekli.";
    try {
        const r = await api("GET", `/playlists/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; description: string; owner: {display_name: string}; tracks: {total: number}; public: boolean; uri: string};
        return `${d.name} | Sahibi: ${d.owner.display_name} | ${d.tracks.total} şarkı | ${d.public ? "Herkese açık" : "Gizli"} | URI: ${d.uri}${d.description ? "\nAçıklama: " + d.description : ""}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetPlaylistItems(id: string, limit = 20): Promise<string> {
    if (!id) return "HATA: Playlist ID gerekli.";
    try {
        const r = await api("GET", `/playlists/${encodeURIComponent(id)}/tracks?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {track: {name: string; artists: {name: string}[]; duration_ms: number; uri: string} | null}[]}).items ?? [];
        return items.filter((it) => it.track).map((it, i) => {
            const t = it.track!;
            const dur = Math.round(t.duration_ms / 1000);
            return `${i+1}. ${t.name} — ${t.artists.map((a) => a.name).join(", ")} [${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")}]`;
        }).join("\n") || "Şarkı bulunamadı.";
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyCreatePlaylist(name: string, isPublic = false, description = ""): Promise<string> {
    if (!name) return "HATA: Playlist adı gerekli.";
    try {
        // Kullanıcı ID'si lazım
        const me = await api("GET", "/me");
        if (!me.ok) return spotifyErr(me.status, me.data);
        const userId = (me.data as {id: string}).id;
        const r = await api("POST", `/users/${userId}/playlists`, {name, public: isPublic, description});
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {id: string; uri: string; name: string};
        return `Playlist oluşturuldu: ${d.name} | ID: ${d.id} | URI: ${d.uri}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyPlaylistAdd(playlistId: string, uris: string[]): Promise<string> {
    if (!playlistId || uris.length === 0) return "HATA: Playlist ID ve en az bir URI gerekli.";
    try {
        const r = await api("POST", `/playlists/${encodeURIComponent(playlistId)}/tracks`, {uris});
        if (!r.ok) return spotifyErr(r.status, r.data);
        return `${uris.length} şarkı playlist'e eklendi.`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyPlaylistRemove(playlistId: string, uris: string[]): Promise<string> {
    if (!playlistId || uris.length === 0) return "HATA: Playlist ID ve en az bir URI gerekli.";
    try {
        const r = await api("DELETE", `/playlists/${encodeURIComponent(playlistId)}/tracks`, {tracks: uris.map((uri) => ({uri}))});
        if (!r.ok) return spotifyErr(r.status, r.data);
        return `${uris.length} şarkı playlist'ten kaldırıldı.`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetFeaturedPlaylists(): Promise<string> {
    try {
        const r = await api("GET", "/browse/featured-playlists?limit=10");
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {message?: string; playlists: {items: {id: string; name: string; description: string; tracks: {total: number}}[]}};
        const items = d.playlists?.items ?? [];
        const header = d.message ? `${d.message}\n` : "";
        return header + items.map((p, i) => `${i+1}. ${p.name} (${p.tracks.total} şarkı) — ${p.description || ""}`).join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

// ── Library ───────────────────────────────────────────────────────────────────

export async function spotifyGetSavedTracks(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/tracks?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {added_at: string; track: {name: string; artists: {name: string}[]; uri: string}}[]}).items ?? [];
        if (items.length === 0) return "Beğenilen şarkı yok.";
        return `Beğenilen Şarkılar (${items.length}):\n${items.map((it, i) =>
            `${i+1}. ${it.track.name} — ${it.track.artists.map((a) => a.name).join(", ")}`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyCheckSavedTracks(ids: string[]): Promise<string> {
    if (ids.length === 0) return "HATA: En az bir şarkı ID gerekli.";
    try {
        const r = await api("GET", `/me/tracks/contains?ids=${ids.slice(0,50).join(",")}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const results = r.data as boolean[];
        return ids.map((id, i) => `${id}: ${results[i] ? "beğenilmiş" : "beğenilmemiş"}`).join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetSavedShows(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/shows?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {show: {id: string; name: string; publisher: string; total_episodes: number}}[]}).items ?? [];
        if (items.length === 0) return "Kayıtlı podcast yok.";
        return `Kayıtlı Podcastler (${items.length}):\n${items.map((it, i) =>
            `${i+1}. ${it.show.name} — ${it.show.publisher} (${it.show.total_episodes} bölüm) — ID: ${it.show.id}`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetSavedEpisodes(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/episodes?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {episode: {name: string; show: {name: string}; duration_ms: number; uri: string}}[]}).items ?? [];
        if (items.length === 0) return "Kayıtlı bölüm yok.";
        return items.map((it, i) => {
            const dur = Math.round(it.episode.duration_ms / 1000 / 60);
            return `${i+1}. ${it.episode.name} (${it.episode.show.name}) [${dur} dk]`;
        }).join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetSavedAudiobooks(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/audiobooks?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {id: string; name: string; authors: {name: string}[]; total_chapters: number}[]}).items ?? [];
        if (items.length === 0) return "Kayıtlı sesli kitap yok.";
        return items.map((b, i) =>
            `${i+1}. ${b.name} — ${b.authors.map((a) => a.name).join(", ")} (${b.total_chapters} bölüm)`
        ).join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function spotifyGetCurrentUser(): Promise<string> {
    try {
        const r = await api("GET", "/me");
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {display_name: string; email?: string; country: string; product: string; followers: {total: number}; id: string};
        return `${d.display_name} | ID: ${d.id}${d.email ? ` | E-posta: ${d.email}` : ""} | Ülke: ${d.country} | Plan: ${d.product} | Takipçi: ${d.followers.total}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetTopItems(type: "artists" | "tracks", timeRange: "short_term" | "medium_term" | "long_term" = "medium_term", limit = 10): Promise<string> {
    try {
        const r = await api("GET", `/me/top/${type}?time_range=${timeRange}&limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {name: string; artists?: {name: string}[]; genres?: string[]; popularity: number}[]}).items ?? [];
        const rangeLabel: Record<string, string> = {short_term: "Son 4 Hafta", medium_term: "Son 6 Ay", long_term: "Tüm Zamanlar"};
        const header = `En Çok Dinlenen ${type === "artists" ? "Sanatçılar" : "Şarkılar"} (${rangeLabel[timeRange]}):\n`;
        return header + items.map((it, i) => {
            if (type === "artists") return `${i+1}. ${it.name} — ${it.genres?.slice(0,2).join(", ") ?? ""}`;
            return `${i+1}. ${it.name} — ${it.artists?.map((a) => a.name).join(", ") ?? ""}`;
        }).join("\n");
    } catch (e) { return spotifyConnErr(e); }
}

// ── Follow ────────────────────────────────────────────────────────────────────

export async function spotifyFollowArtist(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Sanatçı adı veya ID gerekli.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("PUT", `/me/following?type=artist&ids=${resolved.id}`);
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        return `${resolved.resolvedName ?? nameOrId} takip edildi.`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyUnfollowArtist(nameOrId: string): Promise<string> {
    if (!nameOrId) return "HATA: Sanatçı adı veya ID gerekli.";
    try {
        const resolved = await resolveArtistId(nameOrId);
        if ("error" in resolved) return resolved.error;
        const r = await api("DELETE", `/me/following?type=artist&ids=${resolved.id}`);
        if (!r.ok && r.status !== 204) return spotifyErr(r.status, r.data);
        return `${resolved.resolvedName ?? nameOrId} takipten çıkarıldı.`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetFollowedArtists(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/me/following?type=artist&limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const artists = (r.data as {artists: {items: {id: string; name: string; popularity: number; genres: string[]}[]}}).artists?.items ?? [];
        if (artists.length === 0) return "Takip edilen sanatçı yok.";
        return `Takip Edilen Sanatçılar (${artists.length}):\n${artists.map((a, i) =>
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
        return `Yeni Çıkanlar (${items.length}):\n${items.map((a, i) =>
            `${i+1}. ${a.name} — ${a.artists.map((x) => x.name).join(", ")} (${a.album_type}, ${a.release_date}) — ID: ${a.id}`
        ).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetCategories(limit = 20): Promise<string> {
    try {
        const r = await api("GET", `/browse/categories?limit=${Math.min(50, limit)}&locale=tr_TR`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {categories: {items: {id: string; name: string}[]}}).categories?.items ?? [];
        return `Spotify Kategorileri (${items.length}):\n${items.map((c, i) => `${i+1}. ${c.name} — ID: ${c.id}`).join("\n")}`;
    } catch (e) { return spotifyConnErr(e); }
}

// ── Shows / Episodes / Audiobooks ─────────────────────────────────────────────

export async function spotifyGetShow(id: string): Promise<string> {
    if (!id) return "HATA: Podcast ID gerekli.";
    try {
        const r = await api("GET", `/shows/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; publisher: string; description: string; total_episodes: number; explicit: boolean; languages: string[]};
        return `${d.name} | Yayıncı: ${d.publisher} | ${d.total_episodes} bölüm | Dil: ${d.languages.join(", ")}${d.description ? "\n" + d.description.slice(0,200) : ""}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetShowEpisodes(id: string, limit = 10): Promise<string> {
    if (!id) return "HATA: Podcast ID gerekli.";
    try {
        const r = await api("GET", `/shows/${encodeURIComponent(id)}/episodes?limit=${Math.min(50, limit)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const items = (r.data as {items: {name: string; description: string; duration_ms: number; release_date: string; uri: string}[]}).items ?? [];
        return items.map((ep, i) => {
            const dur = Math.round(ep.duration_ms / 1000 / 60);
            return `${i+1}. ${ep.name} [${dur} dk, ${ep.release_date}]\n   ${ep.description.slice(0,100)}…\n   URI: ${ep.uri}`;
        }).join("\n\n") || "Bölüm bulunamadı.";
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetEpisode(id: string): Promise<string> {
    if (!id) return "HATA: Bölüm ID gerekli.";
    try {
        const r = await api("GET", `/episodes/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; description: string; show: {name: string}; duration_ms: number; release_date: string; uri: string};
        const dur = Math.round(d.duration_ms / 1000 / 60);
        return `${d.name} | Podcast: ${d.show.name} | Süre: ${dur} dk | Yayın: ${d.release_date}\n${d.description.slice(0,300)}`;
    } catch (e) { return spotifyConnErr(e); }
}

export async function spotifyGetAudiobook(id: string): Promise<string> {
    if (!id) return "HATA: Sesli kitap ID gerekli.";
    try {
        const r = await api("GET", `/audiobooks/${encodeURIComponent(id)}`);
        if (!r.ok) return spotifyErr(r.status, r.data);
        const d = r.data as {name: string; authors: {name: string}[]; narrators: {name: string}[]; description: string; total_chapters: number; languages: string[]};
        return `${d.name} | Yazar: ${d.authors.map((a) => a.name).join(", ")} | Anlatıcı: ${d.narrators.map((n) => n.name).join(", ")} | ${d.total_chapters} bölüm | Dil: ${d.languages.join(", ")}\n${d.description.slice(0,200)}`;
    } catch (e) { return spotifyConnErr(e); }
}
