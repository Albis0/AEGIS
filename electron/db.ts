import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

export type Role = 'user' | 'assistant' | 'tool'

let currentSessionId: string | null = null

export async function startSession(): Promise<string> {
    const { data, error } = await supabase
        .from('sessions')
        .insert({})
        .select('id')
        .single()

    if (error) throw error
    currentSessionId = data.id
    return data.id
}

export function getSessionId(): string | null {
    return currentSessionId
}

export async function saveMessage(role: Role, content: string, toolName?: string): Promise<void> {
    if (!currentSessionId) return
    await supabase.from('messages').insert({
        session_id: currentSessionId,
        role,
        content,
        tool_name: toolName ?? null,
    })
}

export async function getRecentMessages(limit = 50): Promise<{ role: Role; content: string; tool_name?: string; created_at: string }[]> {
    const { data } = await supabase
        .from('messages')
        .select('role, content, tool_name, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)

    return (data ?? []).reverse() as { role: Role; content: string; tool_name?: string; created_at: string }[]
}

export async function saveNote(content: string, remindAt?: Date): Promise<void> {
    await supabase.from('notes').insert({
        content,
        remind_at: remindAt?.toISOString() ?? null,
    })
}

export async function getPendingNotes(): Promise<{ id: string; content: string; remind_at: string | null }[]> {
    const { data } = await supabase
        .from('notes')
        .select('id, content, remind_at')
        .eq('done', false)
        .order('created_at', { ascending: true })

    return (data ?? []) as { id: string; content: string; remind_at: string | null }[]
}

export async function markNoteDone(id: string): Promise<void> {
    await supabase.from('notes').update({ done: true }).eq('id', id)
}

export async function setUserProfile(key: string, value: string): Promise<void> {
    await supabase.from('user_profile').upsert({ key, value, updated_at: new Date().toISOString() })
}

export async function getUserProfile(): Promise<Record<string, string>> {
    const { data } = await supabase.from('user_profile').select('key, value')
    const profile: Record<string, string> = {}
    for (const row of data ?? []) profile[(row as { key: string; value: string }).key] = (row as { key: string; value: string }).value
    return profile
}
