// AEGIS — gömülü public yapılandırma (Faz 30.3)
//
// Bu değerler PUBLIC-SAFE'tir ve bundle'a gömülmesi güvenlidir:
//   - SUPABASE_ANON_KEY: anon/public key — RLS koruduğu için açıkta olması normal
//   - SUPABASE_URL / PROXY_URL: zaten herkese açık endpoint'ler
//
// ⚠️ service_role key ve Groq key BURAYA ASLA YAZILMAZ — onlar yalnızca
//    Supabase Edge Function secret'ında yaşar. Repo public olsa bile güvenli.
//
// Build sırasında env ile override edilebilir (CI secret enjeksiyonu için),
// ama anon-safe değerler olduğundan default'lar doğrudan koda gömülüdür.

export const AEGIS_SUPABASE_URL =
    process.env.AEGIS_SUPABASE_URL ??
    "https://wnpgyalsymoqeengtsbi.supabase.co";

export const AEGIS_SUPABASE_ANON_KEY =
    process.env.AEGIS_SUPABASE_ANON_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducGd5YWxzeW1vcWVlbmd0c2JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjc0NzYsImV4cCI6MjA5NTgwMzQ3Nn0.djJ5dB8JjMKA9oeRVzPmqoXfkEIsFqkqDYWX9z-IjMM";

// chat-proxy Edge Function endpoint'i (deneme modu LLM çağrıları buraya gider)
export const AEGIS_PROXY_URL =
    process.env.AEGIS_PROXY_URL ??
    `${AEGIS_SUPABASE_URL}/functions/v1/chat-proxy`;
