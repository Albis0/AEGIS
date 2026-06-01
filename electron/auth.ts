// AEGIS — Supabase Auth (Faz 30.3)
//
// Main process'te oturum yönetimi. Anon key ile Supabase Auth'a bağlanır;
// login/signup/logout + token saklama + sessiz yenileme.
//
// Oturum ~/.aegis/session.json'da tutulur. Node'da localStorage olmadığı için
// supabase-js'e dosya tabanlı bir storage adaptörü veriyoruz.

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {createClient, type SupabaseClient, type Session} from "@supabase/supabase-js";
import {AEGIS_SUPABASE_URL, AEGIS_SUPABASE_ANON_KEY} from "./aegis-config";

const SESSION_PATH = path.join(os.homedir(), ".aegis", "session.json");

// supabase-js storage arayüzü — senkron dosya okuma/yazma yeterli (tek süreç).
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
        } catch { /* yeni dosya */ }
        all[key] = value;
        fs.mkdirSync(path.dirname(SESSION_PATH), {recursive: true});
        fs.writeFileSync(SESSION_PATH, JSON.stringify(all), "utf-8");
    },
    removeItem(key: string): void {
        try {
            const all = JSON.parse(fs.readFileSync(SESSION_PATH, "utf-8"));
            delete all[key];
            fs.writeFileSync(SESSION_PATH, JSON.stringify(all), "utf-8");
        } catch { /* yoksa sorun değil */ }
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

export async function signUp(email: string, password: string): Promise<AuthResult> {
    const {data, error} = await getAuthClient().auth.signUp({email, password});
    if (error) return {ok: false, error: error.message};
    return {ok: true, userId: data.user?.id, email: data.user?.email};
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
    const {data, error} = await getAuthClient().auth.signInWithPassword({email, password});
    if (error) return {ok: false, error: error.message};
    return {ok: true, userId: data.user?.id, email: data.user?.email};
}

export async function signOut(): Promise<void> {
    await getAuthClient().auth.signOut();
}

// Geçerli oturumu döndürür (varsa otomatik yenilenmiş). Yoksa null.
export async function getSession(): Promise<Session | null> {
    const {data} = await getAuthClient().auth.getSession();
    return data.session;
}

// Proxy çağrıları için taze access_token. Süresi dolmuşsa yeniler.
export async function getAccessToken(): Promise<string | null> {
    const session = await getSession();
    return session?.access_token ?? null;
}

export async function getCurrentUser(): Promise<{userId: string; email?: string} | null> {
    const session = await getSession();
    if (!session?.user) return null;
    return {userId: session.user.id, email: session.user.email};
}

// Deneme modu günlük kotası. Edge Function'daki limitlerle TUTARLI tutulmalı.
export const TRIAL_DAILY_REQUEST_LIMIT = 50;
export const TRIAL_DAILY_TOKEN_LIMIT = 100_000;

export interface UsageInfo {
    signedIn: boolean;
    usedRequests: number;
    usedTokens: number;
    limitRequests: number;
    limitTokens: number;
}

// Kullanıcının bugünkü (UTC) kullanımını döndürür. RLS sayesinde anon client
// kendi satırını okuyabilir. Gün sınırı UTC'ye göredir (Edge Function ile aynı).
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
