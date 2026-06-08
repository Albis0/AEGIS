# AEGIS — Personal AI Assistant

> Windows için kişisel AI asistanı. Dinler, düşünür, yapar.

**AEGIS**, konuşma tanıma, LLM zekası ve 150+ araçla donatılmış, Windows masaüstüne entegre bir yapay zeka asistanıdır. Groq, OpenAI, Anthropic, Gemini ve daha fazlasını destekler. Sesle veya yazıyla komut verebilir, sistem kontrolü, Spotify, Steam, web araması, dosya yönetimi ve çok daha fazlasını yapabilirsiniz.

---

## Özellikler

| Kategori | Neler yapabilir |
|---|---|
| **Sohbet** | Groq, OpenAI, Anthropic, Gemini, xAI, DeepSeek, Mistral, Ollama |
| **Ses** | Mikrofon → Whisper transkripsiyon, TTS (Edge / ElevenLabs / Kokoro offline), wake-word, VAD hysteresis |
| **Sistem** | PowerShell, ses/parlaklık, pencere yönetimi, process, disk temizliği |
| **Spotify** | Çal/duraklat/atla/ses/ara/playlist — Spotify Web API entegrasyonu |
| **Steam** | Oyun başlat, kütüphane listesi, Steam aç/kapat |
| **Web** | Tavily/Serper/DuckDuckGo arama, URL içerik okuma |
| **Dosya** | Oku/yaz/listele/organize/yinelenen bul/toplu yeniden adlandır |
| **Vision** | Ekran görüntüsü al + AI analiz, görsel soru-cevap |
| **Computer Use** | AI fareyi ve klavyeyi kontrol eder, serbest dil hedefleri |
| **Hafıza** | Kullanıcı profili, notlar, gerçekler, session özeti, bulut sync |
| **Otomasyon** | Zamanlanmış görevler, koşullu otomasyon, makrolar, ajans modu |
| **Telemetri** | CPU/RAM/GPU/Disk/Batarya/Ağ anlık izleme + uyarılar |
| **Güvenlik** | API key vault (OS DPAPI/Keychain), gizlilik denetimi |
| **UI** | 4 skin ailesi × 4 ferdi (16 skin), 5 dil, özel CSS |

---

## Gereksinimler

- **Windows 10/11**
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Bun** — [bun.sh](https://bun.sh)

---

## Kurulum (Geliştirici)

### 1. Repoyu klonla

```bash
git clone https://github.com/Albis0/AEGIS.git
cd AEGIS
bun install
```

### 2. Groq API anahtarı al (ücretsiz, zorunlu)

1. [console.groq.com](https://console.groq.com) → Kayıt ol
2. **API Keys → Create API Key**
3. Anahtarı kopyala

### 3. Uygulamayı başlat

```bash
bun run dev
```

İlk açılışta onboarding ekranı çıkar. Groq anahtarını buradan girebilirsin.

### 4. Opsiyonel API anahtarları

| Servis | Neden | Nereden |
|---|---|---|
| Supabase | Bulut sync, oturum kaydı | supabase.com |
| ElevenLabs | Gerçekçi TTS sesi (opsiyonel, Kokoro ücretsiz alternatif) | elevenlabs.io |
| Tavily / Serper | Web araması | tavily.com / serper.dev |
| OpenAI / Anthropic / Gemini | Alternatif AI provider | provider siteleri |

Anahtarlar **Ayarlar → API Anahtarları** sekmesinden girilir.

---

## Spotify Entegrasyonu

AEGIS, Spotify Web API kullanır (Premium gerektirir):

1. [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → Uygulama oluştur
2. Redirect URI olarak `http://localhost:17832/callback` ekle
3. Client ID ve Secret'ı **Ayarlar → API Anahtarları → Spotify** bölümüne gir
4. "AEGIS'e Bağla" diyerek OAuth yetkilendirmesini tamamla

---

## Kullanım

| Kısayol | Eylem |
|---|---|
| `M` | Mikrofon: Kapalı → Sürekli → Wake-word → Kapalı |
| `Ctrl+L` | Mesaj kutusuna odaklan |
| `Ctrl+Space` | Komut paleti |
| `ESC` | Konuşmayı durdur |
| `F11` | Tam ekran |
| ⚙ (başlık çubuğu) | Ayarlar paneli |

**Wake-word:** "Aegis, hava nasıl?" ya da sadece "Aegis" deyip bekle.

**Dosya/görüntü ekleme:** `⊕` butonuyla veya `Ctrl+V` ile yapıştır (`Win+Shift+S` sonrası).

---

## Derleme (Release)

```bash
bun run electron:build
```

`dist/` altında `.exe` installer + portable üretir.

---

## Proje Yapısı

```
electron/          # Ana süreç (main.ts, tools.ts, spotify.ts, vb.)
src/               # Renderer (React UI)
  components/
    skins/         # 16 UI skin
tests/             # Vitest testleri (30 test)
supabase/          # Edge Function + schema
```

---

## Teknolojiler

- **Electron 31** + **React 19** + **TypeScript** + **Vite** + **Tailwind CSS**
- **Groq SDK** (streaming, tool calling)
- **Supabase** (auth, DB, Edge Functions)
- **electron-updater** (otomatik güncelleme)
- **msedge-tts** (ücretsiz Edge TTS)
- **kokoro-js** (offline TTS, API key gereksiz)
- **Sentence-level streaming TTS** (LLM stream ederken paralel seslendirme)

---

## Güvenlik

- API anahtarları OS şifrelemesiyle saklanır (Windows DPAPI)
- `.env` asla commit edilmez
- `service_role` key yalnızca Supabase Edge Function'da, repo'da yok
- RLS ile her kullanıcı yalnızca kendi verisini okur

---

## Lisans

MIT
