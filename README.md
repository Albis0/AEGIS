# AEGIS — Personal AI Assistant

Electron + React masaüstü AI asistanı. Konuşur, dinler, PowerShell çalıştırır, web'de arar.

**Built with:** Electron · React · TypeScript · Vite · Tailwind CSS · Groq SDK · Supabase

---

## Gereksinimler

- **Node.js 18+** — https://nodejs.org
- **Windows 10/11** (msedge-tts Windows'a özel)
- NVIDIA GPU — opsiyonel, yoksa GPU telemetri boş görünür

---

## Kurulum

### 1. Repoyu klonla

```bash
git clone https://github.com/Albis0/AEGIS.git
cd AEGIS
npm install
```

### 2. API key'leri al

#### Groq (ZORUNLU — ücretsiz)
1. https://console.groq.com adresine git
2. Kayıt ol → **API Keys** → **Create API Key**
3. Key'i kopyala

#### Supabase (ZORUNLU — ücretsiz)
1. https://supabase.com → **New Project** oluştur
2. **Settings → API** sayfasını aç
3. **Project URL** ve **service_role** key'ini kopyala (`anon` key değil, `service_role`)

#### Web Arama (opsiyonel)
- Tavily: https://app.tavily.com → API Keys (ücretsiz tier var)
- Serper: https://serper.dev → API Key (ücretsiz tier var)
- İkisi de yoksa DuckDuckGo fallback'i kullanılır

### 3. .env dosyası oluştur

`.env.example` dosyasını kopyala ve key'leri doldur:

```bash
cp .env.example .env
```

`.env` içeriği:

```
GROQ_API_KEY=gsk_...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
TAVILY_API_KEY=tvly-...   # opsiyonel
SERPER_API_KEY=...        # opsiyonel
```

### 4. Supabase tablolarını oluştur

1. Supabase Dashboard → **SQL Editor**
2. `supabase/schema.sql` dosyasının içeriğini yapıştır
3. **Run** butonuna bas

### 5. Çalıştır

```bash
npm run dev
```

---

## Kullanım

| Kısayol | Eylem |
|---|---|
| `M` | Mikrofon: Kapalı → Always-on → Wake-word → Kapalı |
| `ESC` | Konuşmayı durdur |
| `F11` | Tam ekran |
| ⚙ (title bar) | Ayarlar paneli |

**Wake-word modu:** "Jarvis, hava nasıl?" veya sadece "Jarvis" de, sonra konuş.

---

## Ayarlar (⚙)

- **AI Modeli** — Groq modelleri arasında geçiş (anında aktif)
- **TTS Sesi** — Türkçe/İngilizce ses seçimi
- **Konuşma Hızı** — 0.5x – 2.0x

Ayarlar `~/.aegis/settings.json` dosyasında saklanır.
