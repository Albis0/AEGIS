// AEGIS — Supabase Auth (Phase 30.3)
//
// Session management in the main process. Connects to Supabase Auth with the anon
// key; login/signup/logout + token storage + silent refresh.
//
// The session is kept in ~/.aegis/session.json. Since Node has no localStorage,
// we provide supabase-js with a file-based storage adapter.

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {createClient, type SupabaseClient, type Session} from "@supabase/supabase-js";
import {withWakeRetry, isWakingError} from "./retry";
import {AEGIS_SUPABASE_URL, AEGIS_SUPABASE_ANON_KEY} from "./aegis-config";
import {bt} from "./backend-i18n";
 
const WebSocket = require("ws");
// Electron runs on Node 20 which has no native WebSocket — supabase-js Realtime needs it
(globalThis as any).WebSocket = WebSocket;

const SESSION_PATH = path.join(os.homedir(), ".aegis", "session.json");

// supabase-js storage interface — synchronous file read/write is enough (single process).
const fileStorage = {
    getItem(key: string): string | null {
        try {
            const all = JSON.parse(fs.readFileSync(SESSION_PATH, "utf-8"));
            return all[key] ?? null;
        } catch {
            return null;
        }
    },
    setItem(key: string, value: string): void {
        let all: Record<string, string> = {};
        try {
            all = JSON.parse(fs.readFileSync(SESSION_PATH, "utf-8"));
        } catch { /* new file */ }
        all[key] = value;
        fs.mkdirSync(path.dirname(SESSION_PATH), {recursive: true});
        fs.writeFileSync(SESSION_PATH, JSON.stringify(all), "utf-8");
    },
    removeItem(key: string): void {
        try {
            const all = JSON.parse(fs.readFileSync(SESSION_PATH, "utf-8"));
            delete all[key];
            fs.writeFileSync(SESSION_PATH, JSON.stringify(all), "utf-8");
        } catch { /* fine if it doesn't exist */ }
    },
};

let _client: SupabaseClient | null = null;

export function getAuthClient(): SupabaseClient {
    if (!_client) {
        _client = createClient(AEGIS_SUPABASE_URL, AEGIS_SUPABASE_ANON_KEY, {
            auth: {
                storage: fileStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
        });
    }
    return _client;
}

export interface AuthResult {
    ok: boolean;
    error?: string;
    userId?: string;
    email?: string;
}

// UX (adversarial review 1.1) — raw Supabase error strings don't let the user
// tell "wrong password" from "no internet". Map the common cases to actionable
// messages; anything unknown falls through unchanged.
export function friendlyAuthError(message: string): string {
    const m = message.toLowerCase();
    if (/fetch failed|failed to fetch|network|enotfound|econnrefused|timeout|getaddrinfo/.test(m)) {
        return bt("authNet");
    }
    if (/invalid login credentials|invalid grant/.test(m)) {
        return bt("authBadCreds");
    }
    if (/already registered|already exists/.test(m)) {
        return bt("authExists");
    }
    if (/rate limit|too many/.test(m)) {
        return bt("authRate");
    }
    if (/email not confirmed/.test(m)) {
        return bt("authUnconfirmed");
    }
    if (/valid email/.test(m)) {
        return bt("authBadEmail");
    }
    return message;
}

// Waking-server retry: a paused free-tier project fails the first request(s)
// with fetch/DNS errors. Retry those quietly (~3×8s); real auth errors
// (wrong password etc.) are not waking-class and surface immediately.
async function authCall(fn: () => Promise<{data: {user: {id: string; email?: string} | null}; error: {message: string} | null}>): Promise<AuthResult> {
    try {
        const {data, error} = await withWakeRetry(async () => {
            const res = await fn();
            if (res.error && isWakingError(res.error.message)) throw new Error(res.error.message);
            return res;
        }, {attempts: 3, delayMs: 8000});
        if (error) return {ok: false, error: friendlyAuthError(error.message)};
        return {ok: true, userId: data.user?.id, email: data.user?.email};
    } catch (e) {
        return {ok: false, error: friendlyAuthError((e as Error).message ?? String(e))};
    }
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
    return authCall(() => getAuthClient().auth.signUp({email, password}));
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
    return authCall(() => getAuthClient().auth.signInWithPassword({email, password}));
}

export async function signOut(): Promise<void> {
    await getAuthClient().auth.signOut();
}

// Returns the current session (auto-refreshed if present). Null if none.
export async function getSession(): Promise<Session | null> {
    const {data} = await getAuthClient().auth.getSession();
    return data.session;
}

// Fresh access_token for proxy calls. Refreshes if expired.
export async function getAccessToken(): Promise<string | null> {
    try {
        const session = await getSession();
        return session?.access_token ?? null;
    } catch (e) {
        console.warn('[auth] getAccessToken:', (e as Error).message);
        return null;
    }
}

export async function getCurrentUser(): Promise<{userId: string; email?: string} | null> {
    const session = await getSession();
    if (!session?.user) return null;
    return {userId: session.user.id, email: session.user.email};
}

// Trial mode daily quota. Must be kept CONSISTENT with the limits in the Edge Function.
export const TRIAL_DAILY_REQUEST_LIMIT = 50;
export const TRIAL_DAILY_TOKEN_LIMIT = 100_000;

export interface UsageInfo {
    signedIn: boolean;
    usedRequests: number;
    usedTokens: number;
    limitRequests: number;
    limitTokens: number;
}

// Returns the user's usage for today (UTC). Thanks to RLS, the anon client can
// read its own row. The day boundary is in UTC (same as the Edge Function).
export async function getUsage(): Promise<UsageInfo> {
    const base: UsageInfo = {
        signedIn: false,
        usedRequests: 0,
        usedTokens: 0,
        limitRequests: TRIAL_DAILY_REQUEST_LIMIT,
        limitTokens: TRIAL_DAILY_TOKEN_LIMIT,
    };
    const session = await getSession();
    if (!session?.user) return base;
    base.signedIn = true;
    const today = new Date().toISOString().slice(0, 10);
    const {data} = await getAuthClient()
        .from("usage")
        .select("request_count, token_count")
        .eq("user_id", session.user.id)
        .eq("day", today)
        .maybeSingle();
    if (data) {
        base.usedRequests = data.request_count ?? 0;
        base.usedTokens = data.token_count ?? 0;
    }
    return base;
}
