# AEGIS — Personal AI Assistant

> A Windows-native AI assistant. It listens, thinks, and acts.

![AEGIS — Hologram skin](assets/screenshots/hologram.png)

> [!WARNING]
> **AEGIS is under active development.** Not everything works perfectly yet — some tools and features may be unreliable, incomplete, or break in certain situations. Known issues are tracked and fixed incrementally with each version bump, so expect rough edges between releases. Use it as an early-stage project, not a finished product. Bug reports and PRs are very welcome.

> [!NOTE]
> **Built with AI ("vibe coded").** AEGIS was developed largely with the help of AI coding assistants. The architecture, tools, and UI were shaped through iterative prompting rather than written entirely by hand. This is shared openly for transparency — it also means some corners may be rougher than a hand-crafted codebase, which ties into the development-stage note above.

**AEGIS** is a desktop AI assistant for Windows, combining speech recognition, LLM reasoning, and **332 tools**. It supports Groq, OpenAI, Anthropic, Gemini, xAI, DeepSeek, Mistral, and Ollama. Give it commands by voice or text to control your system, Spotify, Steam, smart home devices, web search, file management, screen vision, mouse/keyboard control, and much more.

---

## Features

| Category          | What it can do                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------- |
| **Chat**           | Groq, OpenAI, Anthropic, Gemini, xAI, DeepSeek, Mistral, Ollama                          |
| **Voice**          | Microphone → Whisper transcription, TTS (Edge / ElevenLabs / Kokoro offline), wake-word, VAD |
| **System**         | PowerShell, volume/brightness, window management, processes, disk cleanup               |
| **Spotify**        | Play/pause/skip/volume/search/playlists — Spotify Web API integration                   |
| **Steam**          | Launch games, library listing, open/close Steam                                         |
| **Web**            | Tavily/Serper/DuckDuckGo search, URL content reading                                    |
| **Files**          | Read/write/list/organize/find duplicates/batch rename                                   |
| **Vision**         | Screenshot capture + AI analysis, visual Q&A                                            |
| **Computer Use**   | AI controls mouse and keyboard via free-form natural language goals                     |
| **Memory**         | User profile, notes, facts, session summaries, cloud sync                               |
| **Automation**     | Scheduled tasks, conditional automations, macros, routines, agent mode                  |
| **Smart Home**     | Home Assistant (lights/outlets/locks/thermostats/scenes), natural-language device control |
| **Developer**      | Git, build/test running, project templates, terminal output analysis, SSH/Docker        |
| **Productivity**   | Calendar, pomodoro, time tracking, flashcards, goals, email, real-time translation       |
| **Telemetry**      | Live CPU/RAM/GPU/disk/battery/network monitoring + alerts                               |
| **Security**       | API key vault (OS DPAPI), privacy audit                                                 |
| **UI**             | 4 skin families × 4 variants (16 skins), 5 languages, custom accents                     |

---

## Skins

16 skins across 4 families — a few of them:

| Dashboard | Terminal |
|---|---|
| ![Dashboard](assets/screenshots/dashboard.png) | ![Terminal](assets/screenshots/terminal.png) |

---

## Install (Users)

1. Download **`AEGIS-Setup-x.y.z.exe`** (installer, recommended) or the portable exe from the [latest release](https://github.com/Albis0/AEGIS/releases/latest).
2. Launch it and pick a mode in onboarding:
   - **Trial mode — zero keys needed.** Sign up with an email and start talking; requests go through a rate-limited proxy (daily request/token quota).
   - **Advanced mode — your own key.** Paste a free [Groq](https://console.groq.com) API key (or any supported provider's) in the UI. Keys are stored DPAPI-encrypted on your machine and never leave it except to the provider you chose.
3. That's it — no `.env` file, no terminal. Everything below this point is for developers. Auto-updates arrive through GitHub Releases.

Requires **Windows 10/11**.

> [!IMPORTANT]
> **Windows SmartScreen warning is expected.** The executable is currently **not code-signed** (an EV/OV certificate is planned but costly for an early-stage open-source project), so Windows shows "Windows protected your PC" for a new download. Click **More info → Run anyway** if you trust the source. Why the warning is louder than usual: AEGIS legitimately uses screen capture, simulated mouse/keyboard input (the Computer Use feature) and a self-updater — the same APIs security software watches for. The entire source is in this repo, every release is built by the public [GitHub Actions workflow](.github/workflows/release.yml) from a tagged commit, and you can verify any installer on [VirusTotal](https://www.virustotal.com) before running it. If you'd rather not take the word of a README: build it yourself with `bun run electron:build`.

---

## Development Setup

Requirements: **Windows 10/11** · **Node.js 18+** ([nodejs.org](https://nodejs.org)) · **Bun** ([bun.sh](https://bun.sh))

### 1. Clone the repo

```bash
git clone https://github.com/Albis0/AEGIS.git
cd AEGIS
bun install
# .env is OPTIONAL — keys can be entered in-app (Settings → API Keys).
# Copy .env.example only if you prefer environment variables in development.
```

### 2. Pick an AI provider

You can use an API key from any supported provider. For the fastest start, use **Groq** (free):

1. [console.groq.com](https://console.groq.com) → Sign up
2. **API Keys → Create API Key**
3. Copy the key — enter it on the onboarding screen on first launch

### 3. Start the app

```bash
bun run dev
```

### 4. Optional dependencies and API keys

| Service                                       | What it's for               | Where to get it          |
| ----------------------------------------------| ----------------------------| --------------------------|
| Supabase                                      | Cloud sync, session storage | supabase.com              |
| ElevenLabs                                    | Realistic TTS voice         | elevenlabs.io             |
| Tavily / Serper                               | Advanced web search         | tavily.com / serper.dev   |
| OpenAI / Anthropic / Gemini / xAI / Mistral   | Alternative AI providers    | provider websites         |
| Ollama                                        | Run models locally           | ollama.com                |

Keys are entered under **Settings → API Keys**.

#### Local TTS (Kokoro)

The Kokoro offline voice engine is optional — it doesn't ship with the default `bun install` (~900 MB ONNX model).

```bash
bun add kokoro-js
```

Once installed, select it under **Settings → Voice → TTS Engine → Kokoro**.

---

## Spotify Integration

AEGIS uses the Spotify Web API (requires Premium):

1. [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → Create an app
2. Add `http://localhost:17832/callback` as a Redirect URI
3. Enter the Client ID and Secret under **Settings → API Keys → Spotify**
4. Click "Connect to AEGIS" to complete OAuth authorization

---

## Usage

| Shortcut           | Action                                          |
| ------------------- | ------------------------------------------------ |
| `M`                 | Microphone: Off → Continuous → Wake-word → Off  |
| `Ctrl+L`            | Focus the message box                           |
| `Ctrl+Space`        | Command palette                                 |
| `ESC`               | Stop speaking                                   |
| `F11`               | Fullscreen                                      |
| ⚙ (title bar)       | Settings panel                                  |

**Wake-word:** Say "Aegis, what's the weather?" or just "Aegis" and wait.

**Attaching files/images:** Use the `⊕` button or paste with `Ctrl+V` (after `Win+Shift+S`).

---

## Build (Release)

```bash
bun run electron:build
```

Produces an installer `.exe` + portable build under `dist/`.

---

## Project Structure

```
electron/          # Main process (main.ts, agent-loop.ts, tools.ts, ipc/, etc.)
src/               # Renderer (React UI)
  components/
    skins/         # 4 families x 4 variants = 16 skins
    settings/      # Settings tab components
tests/             # Vitest tests + conversation harness scenarios
supabase/          # Edge Function + schema
```

For the trust model, agent-loop pipeline, and the invariants a PR must not break, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Tech Stack

- **Electron 31** + **React 19** + **TypeScript** + **Vite** + **Tailwind CSS**
- **Groq SDK** (streaming, tool calling)
- **Supabase** (auth, DB, Edge Functions)
- **electron-updater** (auto-update)
- **msedge-tts** (free Edge TTS)
- **kokoro-js** _(optional)_ — offline local TTS, no API key required
- **Sentence-level streaming TTS** (voices sentences as the LLM streams them)

---

## Security Model

- API keys are stored using OS-level encryption (Windows DPAPI)
- `.env` is never committed
- The `service_role` key lives only in the Supabase Edge Function, never in the repo
- Row-Level Security (RLS) ensures each user can only read their own data
- No secrets are bundled into the client; tokens required for private-repo update checks are supplied via environment variables at build/runtime — the updater fails closed without one rather than shipping a credential to every install

To report a vulnerability, see [SECURITY.md](SECURITY.md).

---

## Troubleshooting

- **Kokoro / local TTS not working:** It's optional and not installed by default. Run `bun add kokoro-js`; the ONNX model (~900 MB) downloads to your user data directory on first use.
- **Native binaries missing after install (onnxruntime, sharp):** `bun` skips postinstall for untrusted packages. The required packages are listed under `trustedDependencies` in `package.json`; re-run `bun install`.
- **Electron opens as Node instead of a window:** If `ELECTRON_RUN_AS_NODE` is set in your shell, unset it before `bun run dev`.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and the PR process, and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

Licensed under the [Apache License 2.0](LICENSE).
