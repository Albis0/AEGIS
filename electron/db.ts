import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

// Supabase yapılandırılmış mı? (Faz 30: gelişmiş modda Supabase opsiyonel —
// girilmezse session/mesaj kaydı sessizce devre dışı kalır, uygulama çalışmaya devam eder.)
export function hasDb(): boolean {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
}

// Supabase istemcisi — yapılandırılmamışsa null döner (throw etmez).
function db(): SupabaseClient | null {
    if (_supabase) return _supabase
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) return null
    _supabase = createClient(url, key)
    return _supabase
}

export type Role = 'user' | 'assistant' | 'tool'

let currentSessionId: string | null = null

export async function startSession(): Promise<string> {
    const c = db()
    if (!c) return ''
    const { data, error } = await c
        .from('sessions')
        .insert({ summary: null })
        .select('id')
        .single()

    if (error) throw error
    currentSessionId = data.id
    return data.id
}

export async function saveSessionSummary(summary: string): Promise<void> {
    const c = db()
    if (!c || !currentSessionId) return
    await c.from('sessions').update({ summary, ended_at: new Date().toISOString() }).eq('id', currentSessionId)
}

export async function getRecentSummaries(limit = 5): Promise<{ id: string; summary: string; ended_at: string }[]> {
    const c = db()
    if (!c) return []
    const { data } = await c
        .from('sessions')
        .select('id, summary, ended_at')
        .not('summary', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(limit)
    return (data ?? []).reverse() as { id: string; summary: string; ended_at: string }[]
}

export function getSessionId(): string | null {
    return currentSessionId
}

export async function saveMessage(role: Role, content: string, toolName?: string): Promise<void> {
    const c = db()
    if (!c || !currentSessionId) return
    await c.from('messages').insert({
        session_id: currentSessionId,
        role,
        content,
        tool_name: toolName ?? null,
    })
}

export async function getRecentMessages(limit = 50): Promise<{ role: Role; content: string; tool_name?: string; created_at: string }[]> {
    const c = db()
    if (!c) return []
    const { data } = await c
        .from('messages')
        .select('role, content, tool_name, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)

    return (data ?? []).reverse() as { role: Role; content: string; tool_name?: string; created_at: string }[]
}

export async function saveNote(content: string, remindAt?: Date): Promise<void> {
    const c = db()
    if (!c) return
    await c.from('notes').insert({
        content,
        remind_at: remindAt?.toISOString() ?? null,
    })
}

export async function getPendingNotes(): Promise<{ id: string; content: string; remind_at: string | null }[]> {
    const c = db()
    if (!c) return []
    const { data } = await c
        .from('notes')
        .select('id, content, remind_at')
        .eq('done', false)
        .order('created_at', { ascending: true })

    return (data ?? []) as { id: string; content: string; remind_at: string | null }[]
}

export async function markNoteDone(id: string): Promise<void> {
    const c = db()
    if (!c) return
    await c.from('notes').update({ done: true }).eq('id', id)
}

export async function setUserProfile(key: string, value: string): Promise<void> {
    const c = db()
    if (!c) return
    await c.from('user_profile').upsert({ key, value, updated_at: new Date().toISOString() })
}

export async function getUserProfile(): Promise<Record<string, string>> {
    const c = db()
    if (!c) return {}
    const { data } = await c.from('user_profile').select('key, value')
    const profile: Record<string, string> = {}
    for (const row of data ?? []) profile[(row as { key: string; value: string }).key] = (row as { key: string; value: string }).value
    return profile
}

export async function getSessions(limit = 20): Promise<{id: string; summary: string | null; ended_at: string | null; created_at: string}[]> {
    const c = db()
    if (!c) return []
    const {data} = await c
        .from("sessions")
        .select("id, summary, ended_at, created_at")
        .order("created_at", {ascending: false})
        .limit(limit);
    return (data ?? []) as {id: string; summary: string | null; ended_at: string | null; created_at: string}[];
}

export async function getSessionMessages(sessionId: string): Promise<{role: string; content: string; tool_name: string | null; created_at: string}[]> {
    const c = db()
    if (!c) return []
    const {data} = await c
        .from("messages")
        .select("role, content, tool_name, created_at")
        .eq("session_id", sessionId)
        .order("created_at", {ascending: true});
    return (data ?? []) as {role: string; content: string; tool_name: string | null; created_at: string}[];
}
