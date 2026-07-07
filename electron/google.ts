/**
 * Google Workspace — Gmail + Calendar (Phase 7.3)
 *
 * Same integration model as Spotify: the user registers their own OAuth client
 * (Google Cloud Console → "Desktop app" credentials), pastes the Client ID and
 * Secret in Settings → API Keys, then says "connect Google". A loopback server
 * on 127.0.0.1:17833 receives the code; tokens are stored DPAPI-encrypted in
 * the vault (never plaintext on disk, never bundled).
 *
 * Scopes: gmail.readonly, gmail.send, calendar.events — the minimum for
 * "read my inbox / send a mail / manage my agenda".
 */

import {exec as execCb} from "child_process";
import * as http from "http";
import * as crypto from "crypto";
import {fetchWithTimeout, isTimeoutError} from "./fetch-utils";
import {vaultStore, vaultGet, vaultDelete} from "./vault";
import {loadConfig} from "./config";

const REDIRECT_URI = "http://127.0.0.1:17833/callback";
const SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.events",
].join(" ");

const VAULT_KEY = "google_oauth_token";

interface TokenData {
    access_token: string;
    refresh_token: string;
    expires_at: number;
}

function getCreds(): {id: string; secret: string} | null {
    const cfg = loadConfig();
    const id = cfg?.googleClientId?.trim();
    const secret = cfg?.googleClientSecret?.trim();
    if (!id || !secret) return null;
    return {id, secret};
}

const NOT_CONFIGURED =
    "Google is not configured. Create an OAuth client (Desktop app) at console.cloud.google.com, " +
    "enable the Gmail and Calendar APIs, then enter the Client ID and Secret under Settings → API Keys → Google.";
const NOT_CONNECTED =
    "No Google account is connected. Say 'connect Google' to authorize Gmail and Calendar access.";

// ── Token storage (DPAPI vault) ───────────────────────────────────────────────
function loadToken(): TokenData | null {
    const raw = vaultGet(VAULT_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as TokenData; } catch { return null; }
}

function saveToken(t: TokenData): void {
    vaultStore(VAULT_KEY, JSON.stringify(t));
}

// ── OAuth flow ────────────────────────────────────────────────────────────────
let _callbackServer: http.Server | null = null;

function callbackPage(ok: boolean, title: string, sub: string): string {
    const accent = ok ? "52, 211, 153" : "248, 113, 113";
    const icon = ok
        ? `<path d="M20 6 9 17l-5-5" stroke="rgb(${accent})" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<circle cx="12" cy="12" r="9" stroke="rgb(${accent})" stroke-width="2.2"/><path d="M12 7v6m0 4h.01" stroke="rgb(${accent})" stroke-width="2.2" stroke-linecap="round"/>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AEGIS · Google</title>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}
body{font-family:system-ui,sans-serif;background:#0a0e17;color:#f8fafc;display:grid;place-items:center}
.card{text-align:center;padding:48px 40px;max-width:420px}
.badge{width:72px;height:72px;border-radius:20px;display:grid;place-items:center;margin:0 auto 24px;
background:rgba(${accent},.12);border:1px solid rgba(${accent},.4)}
h1{font-size:22px;font-weight:600;margin-bottom:10px}p{font-size:14px;line-height:1.6;color:#94a3b8}
.hint{margin-top:28px;font-size:12.5px;color:#64748b}</style></head>
<body><div class="card">
<div class="badge"><svg width="34" height="34" viewBox="0 0 24 24" fill="none">${icon}</svg></div>
<h1>${title}</h1><p>${sub}</p>
<div class="hint">You can close this tab and return to AEGIS.</div>
</div></body></html>`;
}

export async function googleAuthorize(): Promise<string> {
    const creds = getCreds();
    if (!creds) return NOT_CONFIGURED;
    if (_callbackServer) return "Authorization is already in progress. Please finish logging in in the browser.";

    const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const state = crypto.randomBytes(8).toString("hex");

    const params = new URLSearchParams({
        response_type: "code",
        client_id: creds.id,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        state,
        access_type: "offline",
        prompt: "consent", // force a refresh_token even on re-auth
        code_challenge_method: "S256",
        code_challenge: challenge,
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    await new Promise<void>((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            const url = new URL(req.url ?? "/", "http://localhost");
            if (url.pathname !== "/callback") { res.end(); return; }
            const code = url.searchParams.get("code");
            const err = url.searchParams.get("error");
            const gotState = url.searchParams.get("state");

            const finish = (ok: boolean, title: string, sub: string) => {
                res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
                res.end(callbackPage(ok, title, sub));
                server.close();
                _callbackServer = null;
            };

            if (err || !code || gotState !== state) {
                finish(false, "Authorization canceled", err ?? "Could not get the authorization code. You can try again.");
                reject(new Error(err ?? "no code"));
                return;
            }
            try {
                const token = await exchangeCode(code, verifier, creds);
                saveToken(token);
                finish(true, "Google connected", "AEGIS can now read your inbox and manage your calendar.");
            } catch (e) {
                finish(false, "Connection failed", (e as Error).message);
            }
            resolve();
        });

        server.listen(17833, "127.0.0.1", () => {
            _callbackServer = server;
            execCb(`cmd /c start "" "${authUrl}"`, {windowsHide: true}, () => {});
            resolve(); // server is up; the callback arrives async
        });
        server.on("error", (e) => { _callbackServer = null; reject(e); });
    });

    return "Google authorization opened in the browser. Log in and grant access; AEGIS picks up the token automatically.";
}

async function exchangeCode(code: string, verifier: string, creds: {id: string; secret: string}): Promise<TokenData> {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: creds.id,
        client_secret: creds.secret,
        code_verifier: verifier,
    });
    const resp = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: body.toString(),
    }, 15_000);
    if (!resp.ok) throw new Error(`Token exchange failed: ${resp.status} ${await resp.text()}`);
    const data = await resp.json() as {access_token: string; refresh_token?: string; expires_in: number};
    if (!data.refresh_token) throw new Error("Google did not return a refresh token. Remove AEGIS from your Google account permissions (myaccount.google.com/permissions) and connect again.");
    return {access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + data.expires_in * 1000};
}

async function refreshAccessToken(refreshToken: string, creds: {id: string; secret: string}): Promise<TokenData> {
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: creds.id,
        client_secret: creds.secret,
    });
    const resp = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: body.toString(),
    }, 15_000);
    if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status} ${await resp.text()}`);
    const data = await resp.json() as {access_token: string; expires_in: number};
    return {access_token: data.access_token, refresh_token: refreshToken, expires_at: Date.now() + data.expires_in * 1000};
}

async function getToken(): Promise<string> {
    const creds = getCreds();
    if (!creds) throw new Error(NOT_CONFIGURED);
    let token = loadToken();
    if (!token) throw new Error(NOT_CONNECTED);
    if (Date.now() > token.expires_at - 30_000) {
        token = await refreshAccessToken(token.refresh_token, creds);
        saveToken(token);
    }
    return token.access_token;
}

export function googleDisconnect(): string {
    return vaultDelete(VAULT_KEY).includes("deleted")
        ? "Google account disconnected. The saved token was removed."
        : "No Google account was connected.";
}

// ── API wrapper ───────────────────────────────────────────────────────────────
async function api(method: string, url: string, body?: unknown): Promise<{ok: boolean; status: number; data: unknown}> {
    const tok = await getToken();
    const resp = await fetchWithTimeout(url, {
        method,
        headers: {
            "Authorization": `Bearer ${tok}`,
            ...(body ? {"Content-Type": "application/json"} : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    }, 15_000);
    if (resp.status === 204) return {ok: true, status: 204, data: null};
    const text = await resp.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* keep raw text */ }
    return {ok: resp.ok, status: resp.status, data};
}

function googleErr(status: number, data?: unknown): string {
    const msg = (data as {error?: {message?: string}})?.error?.message ?? "";
    if (status === 401) return "Your Google session has expired. Say 'connect Google' to re-authorize.";
    if (status === 403) {
        if (/not been used|is disabled|accessNotConfigured/i.test(msg)) {
            return "The Gmail or Calendar API is not enabled for your Google Cloud project. Enable both at console.cloud.google.com → APIs & Services.";
        }
        return `Google: access denied (403)${msg ? " — " + msg : ""}`;
    }
    if (status === 404) return "Google: item not found (it may have been deleted).";
    if (status === 429) return "Google received too many requests. Wait a few seconds and try again.";
    if (status >= 500) return "The Google server returned a temporary error. Try again shortly.";
    return msg ? `Google: ${msg}` : `Google error (${status})`;
}

function googleConnErr(e: unknown): string {
    if (isTimeoutError(e)) return "Timed out connecting to Google. Check your internet connection.";
    const msg = (e as Error).message ?? String(e);
    if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(msg)) return "Cannot reach Google. Check your internet connection.";
    return msg;
}

// ── Gmail ─────────────────────────────────────────────────────────────────────
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

function header(headers: {name: string; value: string}[] | undefined, name: string): string {
    return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function gmailList(query = "", limit = 10): Promise<string> {
    try {
        const n = Math.max(1, Math.min(25, Math.round(limit)));
        const q = query.trim() || "in:inbox";
        const r = await api("GET", `${GMAIL}/messages?q=${encodeURIComponent(q)}&maxResults=${n}`);
        if (!r.ok) return googleErr(r.status, r.data);
        const ids = ((r.data as {messages?: {id: string}[]}).messages ?? []).map((m) => m.id);
        if (ids.length === 0) return `No emails matched "${q}".`;

        const lines: string[] = [];
        for (const id of ids) {
            const m = await api("GET", `${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
            if (!m.ok) continue;
            const d = m.data as {id: string; snippet?: string; labelIds?: string[]; payload?: {headers?: {name: string; value: string}[]}};
            const unread = d.labelIds?.includes("UNREAD") ? "[UNREAD] " : "";
            lines.push(`${unread}${header(d.payload?.headers, "Subject") || "(no subject)"}\n  From: ${header(d.payload?.headers, "From")} | ${header(d.payload?.headers, "Date")}\n  ${d.snippet ?? ""}\n  ID: ${d.id}`);
        }
        return `Emails (${lines.length}, query: ${q}):\n\n${lines.join("\n\n")}`;
    } catch (e) { return googleConnErr(e); }
}

// Recursively collect text/plain parts of a MIME tree (base64url payloads).
export interface MimePart {mimeType?: string; body?: {data?: string}; parts?: MimePart[]}
export function extractPlainText(part: MimePart | undefined): string {
    if (!part) return "";
    if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf-8");
    }
    for (const p of part.parts ?? []) {
        const t = extractPlainText(p);
        if (t) return t;
    }
    // fall back to text/html stripped of tags
    if (part.mimeType === "text/html" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf-8")
            .replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
    }
    return "";
}

export async function gmailRead(id: string): Promise<string> {
    if (!id) return "ERROR: Email ID is required (get it from gmail_list).";
    try {
        const r = await api("GET", `${GMAIL}/messages/${encodeURIComponent(id)}?format=full`);
        if (!r.ok) return googleErr(r.status, r.data);
        const d = r.data as {payload?: MimePart & {headers?: {name: string; value: string}[]}; snippet?: string};
        const h = (d.payload as {headers?: {name: string; value: string}[]})?.headers;
        const bodyText = extractPlainText(d.payload) || d.snippet || "(empty body)";
        return `Subject: ${header(h, "Subject")}\nFrom: ${header(h, "From")}\nTo: ${header(h, "To")}\nDate: ${header(h, "Date")}\n\n${bodyText.slice(0, 4000)}`;
    } catch (e) { return googleConnErr(e); }
}

// RFC 2822 message with a RFC 2047-encoded UTF-8 subject, base64url for the API.
export function buildRawEmail(to: string, subject: string, body: string): string {
    const encSubject = `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
    return Buffer.from(
        `To: ${to}\r\nSubject: ${encSubject}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(body ?? "", "utf-8").toString("base64")}`,
        "utf-8",
    ).toString("base64url");
}

export async function gmailSend(to: string, subject: string, body: string): Promise<string> {
    if (!to || !subject) return "ERROR: 'to' and 'subject' are required.";
    try {
        const raw = buildRawEmail(to, subject, body);
        const r = await api("POST", `${GMAIL}/messages/send`, {raw});
        if (!r.ok) return googleErr(r.status, r.data);
        return `Email sent to ${to}: "${subject}"`;
    } catch (e) { return googleConnErr(e); }
}

// ── Calendar ──────────────────────────────────────────────────────────────────
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export async function calendarListEvents(days = 7): Promise<string> {
    try {
        const d = Math.max(1, Math.min(60, Math.round(days)));
        const now = new Date();
        const max = new Date(now.getTime() + d * 86_400_000);
        const params = new URLSearchParams({
            timeMin: now.toISOString(),
            timeMax: max.toISOString(),
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "25",
        });
        const r = await api("GET", `${CAL}?${params}`);
        if (!r.ok) return googleErr(r.status, r.data);
        const items = (r.data as {items?: {id: string; summary?: string; location?: string; start?: {dateTime?: string; date?: string}; end?: {dateTime?: string; date?: string}}[]}).items ?? [];
        if (items.length === 0) return `No events in the next ${d} day(s).`;
        const lines = items.map((ev) => {
            const start = ev.start?.dateTime ?? ev.start?.date ?? "?";
            const end = ev.end?.dateTime ?? ev.end?.date ?? "";
            const allDay = !ev.start?.dateTime;
            return `• ${ev.summary ?? "(untitled)"} — ${start}${end && !allDay ? ` → ${end}` : allDay ? " (all day)" : ""}${ev.location ? ` @ ${ev.location}` : ""}\n  ID: ${ev.id}`;
        });
        return `Calendar — next ${d} day(s), ${items.length} event(s):\n${lines.join("\n")}`;
    } catch (e) { return googleConnErr(e); }
}

export async function calendarCreateEvent(opts: {summary: string; start: string; end?: string; description?: string; location?: string}): Promise<string> {
    if (!opts.summary || !opts.start) return "ERROR: 'summary' and 'start' (ISO datetime or YYYY-MM-DD) are required.";
    try {
        const allDay = /^\d{4}-\d{2}-\d{2}$/.test(opts.start.trim());
        const startVal = opts.start.trim();
        // Default duration: 1 hour (timed) / same day (all-day).
        const endVal = opts.end?.trim()
            ?? (allDay ? startVal : new Date(new Date(startVal).getTime() + 3_600_000).toISOString());
        if (!allDay && isNaN(new Date(startVal).getTime())) return "ERROR: 'start' is not a valid datetime. Use ISO format, e.g. 2026-07-10T14:00:00+03:00.";
        const body = {
            summary: opts.summary,
            ...(opts.description ? {description: opts.description} : {}),
            ...(opts.location ? {location: opts.location} : {}),
            start: allDay ? {date: startVal} : {dateTime: new Date(startVal).toISOString()},
            end: allDay ? {date: endVal} : {dateTime: new Date(endVal).toISOString()},
        };
        const r = await api("POST", CAL, body);
        if (!r.ok) return googleErr(r.status, r.data);
        const d = r.data as {id: string; htmlLink?: string};
        return `Event created: "${opts.summary}" (${startVal}). ID: ${d.id}`;
    } catch (e) { return googleConnErr(e); }
}

export async function calendarDeleteEvent(id: string): Promise<string> {
    if (!id) return "ERROR: Event ID is required (get it from calendar_events).";
    try {
        const r = await api("DELETE", `${CAL}/${encodeURIComponent(id)}`);
        if (!r.ok && r.status !== 204 && r.status !== 200) return googleErr(r.status, r.data);
        return "Event deleted.";
    } catch (e) { return googleConnErr(e); }
}

export async function googleStatus(): Promise<string> {
    if (!getCreds()) return NOT_CONFIGURED;
    const token = loadToken();
    if (!token) return NOT_CONNECTED;
    try {
        const r = await api("GET", `${GMAIL}/profile`);
        if (!r.ok) return googleErr(r.status, r.data);
        const d = r.data as {emailAddress?: string; messagesTotal?: number};
        return `Google connected: ${d.emailAddress ?? "?"} (${d.messagesTotal ?? "?"} messages in the mailbox).`;
    } catch (e) { return googleConnErr(e); }
}
