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
