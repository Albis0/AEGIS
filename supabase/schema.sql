-- AEGIS — Supabase schema
-- Supabase Dashboard → SQL Editor → buraya yapıştır → Run

-- Sessions (konuşma oturumları)
create table if not exists sessions (
    id         uuid primary key default gen_random_uuid(),
    summary    text,
    ended_at   timestamptz,
    created_at timestamptz default now()
);

-- Messages (her mesaj)
create table if not exists messages (
    id         uuid primary key default gen_random_uuid(),
    session_id uuid references sessions(id) on delete cascade,
    role       text not null,          -- 'user' | 'assistant' | 'tool'
    content    text not null,
    tool_name  text,
    created_at timestamptz default now()
);

-- User profile (AEGIS'in öğrendiği bilgiler)
create table if not exists user_profile (
    key        text primary key,
    value      text not null,
    updated_at timestamptz default now()
);

-- Notes & reminders
create table if not exists notes (
    id         uuid primary key default gen_random_uuid(),
    content    text not null,
    remind_at  timestamptz,
    done       boolean default false,
    created_at timestamptz default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- Faz 30 — Dağıtım: deneme modu + kimlik
-- Çoklu kullanıcı. Aşağıdaki tablolar auth.users'a bağlıdır ve RLS ile korunur.
-- Eski tablolar (sessions/messages/notes/user_profile) bu adımda DEĞİŞMEZ.
-- ════════════════════════════════════════════════════════════════════════════

-- Rate limit sayacı (deneme modu) — her kullanıcı/gün için tek satır.
-- Kullanıcı KENDİ satırını yalnızca OKUYABİLİR (kalan kotayı görmek için).
-- Sayacı yalnızca Edge Function (service_role) arttırır — client yazamaz,
-- aksi halde limit bypass edilirdi.
create table if not exists usage (
    user_id       uuid    not null references auth.users(id) on delete cascade,
    day           date    not null default current_date,
    request_count integer not null default 0,
    token_count   bigint  not null default 0,
    updated_at    timestamptz default now(),
    primary key (user_id, day)
);

alter table usage enable row level security;

-- Kullanıcı yalnızca kendi usage satırlarını okur
drop policy if exists "usage_select_own" on usage;
create policy "usage_select_own" on usage
    for select using (auth.uid() = user_id);

-- NOT: usage için insert/update/delete politikası TANIMLANMADI.
-- RLS açıkken politikası olmayan işlem reddedilir → anon/authenticated client
-- yazamaz. service_role RLS'i bypass eder, yani Edge Function serbestçe yazar.


-- Cloud sync (gelişmiş mod) — kullanıcının ayarları + şifreli API key'leri.
-- API key'leri istemci tarafında şifrelenir; sunucu düz metin görmez.
create table if not exists user_configs (
    user_id        uuid primary key references auth.users(id) on delete cascade,
    settings       jsonb  default '{}'::jsonb,
    encrypted_keys text,
    updated_at     timestamptz default now()
);

alter table user_configs enable row level security;

-- Kullanıcı yalnızca kendi config satırını okur/yazar
drop policy if exists "user_configs_select_own" on user_configs;
create policy "user_configs_select_own" on user_configs
    for select using (auth.uid() = user_id);

drop policy if exists "user_configs_insert_own" on user_configs;
create policy "user_configs_insert_own" on user_configs
    for insert with check (auth.uid() = user_id);

drop policy if exists "user_configs_update_own" on user_configs;
create policy "user_configs_update_own" on user_configs
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- Atomik usage arttırma — chat-proxy Edge Function bunu çağırır.
-- "satır yoksa oluştur, varsa arttır" işini tek işlemde yapar (race-condition'sız).
-- security definer: service_role ile çağrılır, RLS'i bypass eder.
create or replace function increment_usage(p_user_id uuid, p_day date, p_tokens bigint)
returns void
language plpgsql
security definer
as $$
begin
    insert into usage (user_id, day, request_count, token_count, updated_at)
    values (p_user_id, p_day, 1, p_tokens, now())
    on conflict (user_id, day) do update
        set request_count = usage.request_count + 1,
            token_count   = usage.token_count + p_tokens,
            updated_at    = now();
end;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- Public-release hardening (2026-07-03)
-- The legacy single-user tables predate RLS. In the SHARED cloud project the
-- bundled anon key must not be able to touch them: enabling RLS with NO
-- policies denies all anon/authenticated access, while service_role (used by
-- self-hosted advanced mode and Edge Functions) bypasses RLS and keeps working.
-- Run this block in the Supabase SQL editor of the shared project.
-- ════════════════════════════════════════════════════════════════════════════

alter table sessions     enable row level security;
alter table messages     enable row level security;
alter table user_profile enable row level security;
alter table notes        enable row level security;
