// AEGIS — embedded public configuration (Phase 30.3)
//
// These values are PUBLIC-SAFE and safe to embed in the bundle:
//   - SUPABASE_ANON_KEY: anon/public key — normal to be exposed since RLS protects it
//   - SUPABASE_URL / PROXY_URL: already publicly accessible endpoints
//
// ⚠️ The service_role key and the Groq key are NEVER written HERE — they live only
//    in the Supabase Edge Function secret. Safe even if the repo is public.
//
// Can be overridden via env at build time (for CI secret injection), but since
// these are anon-safe values, the defaults are embedded directly in the code.

export const AEGIS_SUPABASE_URL =
    process.env.AEGIS_SUPABASE_URL ??
    "https://wnpgyalsymoqeengtsbi.supabase.co";

export const AEGIS_SUPABASE_ANON_KEY =
    process.env.AEGIS_SUPABASE_ANON_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducGd5YWxzeW1vcWVlbmd0c2JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjc0NzYsImV4cCI6MjA5NTgwMzQ3Nn0.djJ5dB8JjMKA9oeRVzPmqoXfkEIsFqkqDYWX9z-IjMM";

// GitHub token must never be bundled. Private-repo update checks may pass a
// read-only token via environment at build/runtime; otherwise updater fails
// closed instead of shipping a credential to every client.
export const AEGIS_GITHUB_TOKEN =
    process.env.AEGIS_GITHUB_TOKEN ?? "";

// chat-proxy Edge Function endpoint (trial mode LLM calls go here)
export const AEGIS_PROXY_URL =
    process.env.AEGIS_PROXY_URL ??
    `${AEGIS_SUPABASE_URL}/functions/v1/chat-proxy`;
