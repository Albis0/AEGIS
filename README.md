# AEGIS — Personal AI Assistant

Electron + React desktop AI assistant. Talks, listens, runs PowerShell, searches the web.

**Built with:** Electron · React · TypeScript · Vite · Tailwind CSS · Groq SDK · Supabase

---

## Requirements

- **Node.js 18+** — https://nodejs.org
- **Windows 10/11** (msedge-tts is Windows-only)
- NVIDIA GPU — optional, GPU telemetry shows empty without one

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/Albis0/AEGIS.git
cd AEGIS
npm install
```

### 2. Get API keys

#### Groq (REQUIRED — free)
1. Go to https://console.groq.com
2. Sign up → **API Keys** → **Create API Key**
3. Copy the key

#### Supabase (REQUIRED — free)
1. https://supabase.com → Create a **New Project**
2. Open **Settings → API**
3. Copy the **Project URL** and **service_role** key (not `anon`, use `service_role`)

#### Web Search (optional)
- Tavily: https://app.tavily.com → API Keys (free tier available)
- Serper: https://serper.dev → API Key (free tier available)
- Falls back to DuckDuckGo if neither is configured

### 3. Create .env file

Copy `.env.example` and fill in your keys:

```bash
cp .env.example .env
```

`.env` contents:

```
GROQ_API_KEY=gsk_...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
TAVILY_API_KEY=tvly-...   # optional
SERPER_API_KEY=...        # optional
```

### 4. Create Supabase tables

1. Supabase Dashboard → **SQL Editor**
2. Paste the contents of `supabase/schema.sql`
3. Hit **Run**

### 5. Run

```bash
npm run dev
```

---

## Usage

| Shortcut | Action |
|---|---|
| `M` | Mic: Off → Always-on → Wake-word → Off |
| `ESC` | Stop speaking |
| `F11` | Fullscreen |
| ⚙ (title bar) | Settings panel |

**Wake-word mode:** Say "Jarvis, what's the weather?" or just "Jarvis", then speak.

---

## Settings (⚙)

- **AI Model** — Switch between Groq models (takes effect immediately)
- **TTS Voice** — Turkish/English voice selection
- **Speech Rate** — 0.5x – 2.0x

Settings are stored in `~/.aegis/settings.json`.
