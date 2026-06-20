# AEGIS — Roadmap

> Kişisel AI asistan. Dinler, düşünür, yapar.

**Özet (v1.9.0):** 332 tool · 8 AI provider · 16 skin · 5 dil · 511 test (35 dosya) ·
**Faz 1–63 TAMAMLANDI** — Güvenilirlik Sürümü (53–61) + Domain UI bileşenleri (63) dahil.

---

## Mevcut Durum ✓

| Özellik                                          | Durum |
| ------------------------------------------------ | ----- |
| 8 AI provider + tool calling (330 tool)          | ✅    |
| PowerShell komut çalıştırma                      | ✅    |
| Dosya okuma / yazma / listeleme / organizasyon   | ✅    |
| Web arama (Tavily / Serper / DuckDuckGo)         | ✅    |
| Ses tanıma — Whisper, çok dilli                  | ✅    |
| TTS — Edge / ElevenLabs / Kokoro (offline)       | ✅    |
| Wake-word / always-on mod + VAD                  | ✅    |
| Sistem telemetri (CPU/RAM/GPU/disk/batarya/ağ)   | ✅    |
| Vision (ekran görüntüsü analizi) + Computer Use  | ✅    |
| Spotify (Web API) + Steam built-in kontrol       | ✅    |
| Akıllı ev (Home Assistant) + IoT                 | ✅    |
| Supabase: deneme modu proxy + auth + cloud sync  | ✅    |

---

## Faz 1 — Hafıza & Bağlam 🧠

_Temel. Bunlar olmadan AEGIS her gün sıfırdan başlıyor._

### 1.1 Konuşma Hafızası ✅

- ✅ Geçmiş session'lardan özet çıkar, yeni konuşmaya bağlam olarak ekle
- ✅ "Dün ne konuştuk?" sorusu çalışsın
- ✅ Session'lar arası bağlam köprüsü

### 1.2 Kullanıcı Profili ✅

- ✅ "Benim adım X", "Python kullanıyorum" gibi bilgileri öğrenip kaydet
- ✅ Profil bilgilerini her konuşmada system prompt'a ekle
- ✅ `set_profile` / `get_profile` tool'ları

### 1.3 Notlar & Hatırlatıcılar ✅

- ✅ "Bunu not et" → Supabase `notes` tablosuna yaz
- ✅ "Notlarımı göster" → listele
- ✅ Zamanlı hatırlatıcı — app açılınca süresi dolmuş notları bildirir

---

## Faz 2 — Ayarlar & Model Seçimi ✅ ⚙️

_Kullanıcının AEGIS'i kendine göre ayarlayabilmesi._

### 2.1 Ayarlar Paneli ✅

- ✅ ⚙ butonu — title bar'da, slide-in modal panel
- ✅ Ayarlar `~/.aegis/settings.json` dosyasında saklanır
- ✅ API key yönetimi — "API KEYS" tab'ından göster/değiştir/kaydet
- ✅ Tema rengi — 6 renk seçeneği (Cyan, Purple, Green, Orange, Red, Yellow), anında aktif

### 2.2 AI Model Seçimi ✅

- ✅ **Groq modelleri** — qwen3-32b, llama-3.3-70b, mixtral vb. ayarlar panelinden seç
- ✅ Seçilen model anında aktif olur, yeniden başlatma gerekmez
- ✅ **Kendi API key'i** — OpenAI, Anthropic, Mistral API key girip o modeli kullan
- ✅ **Local model** — Ollama entegrasyonu, internet olmadan çalışsın

### 2.3 Ses Kişiselleştirme ✅

- ✅ Hazır sesler: **EmelNeural (TR)**, **AhmetNeural (TR)**, **AriaNeural (EN)**, **GuyNeural (EN)**, **SoniaNeural (EN-GB)**
- ✅ Konuşma hızı (0.5x – 2.0x) slider
- ✅ Ses testi butonu — "Merhaba, ben AEGIS" ile dene
- ✅ ElevenLabs API key girince o motor aktif olur

---

## Faz 3 — UI Temaları & Skinler 🖥️

_Görsel kimlik. Herkes farklı bir AEGIS ister._

### 3.1 UI Tipi Değiştirme ✅

- ✅ Birden fazla hazır skin: **Hologram** (şu anki), **Minimal**, **Terminal**, **Dashboard**
- ✅ Ayarlar'dan tek tıkla geçiş, canlı önizleme
- ✅ Her skin kendi renk paleti, layout ve animasyonuyla gelir
- ✅ Skin sistemi component bazlı — yeni skin eklemek mevcut kodu bozmaz

### 3.2 Görsel Özelleştirme ✅

- ✅ Accent rengi — 6 renk, ayarlar panelinden seçilir
- ✅ Font seçimi (JetBrains Mono, Orbitron, Rajdhani, Inter)
- ✅ Kompakt / geniş layout modu
- ✅ Özel CSS inject (ileri seviye kullanıcılar için)

---

## Faz 4 — Dil Desteği 🌍 ✅

_AEGIS dil bilmez, kullanıcı dil seçer._

### 4.1 Tam Çok Dil ✅

- ✅ Arayüz dili: TR / EN / DE / FR / ES dropdown'dan seç
- ✅ Konuşma dili: Whisper seçilen dili kullanır, TTS aynı dilde yanıt verir
- ✅ Yazışma dili: LLM system prompt seçilen dile göre dinamik güncellenir
- ✅ LLM system prompt seçilen dile göre dinamik güncellenir

### 4.2 Dil Başına Yapılandırma ✅

- ✅ Her dil için varsayılan TTS sesi (TR → EmelNeural, EN → AriaNeural, DE → KatjaNeural...)
- ✅ Dil değişince Whisper ve TTS senkron değişir
- ✅ "Switch to English / Türkçeye geç" sesli komutla da çalışır (`set_language` tool)

---

## Faz 5 — Görme & Ekran 👁️ ✅

_AEGIS ekranı okuyunca çok daha güçlü hale gelir._

### 5.1 Screenshot + Vision ✅

- ✅ `screenshot` tool: tam ekran yakalar, AEGIS penceresi gizlenir
- ✅ Vision modeli ile analiz et (Llama-4-Scout-17b)
- ✅ "Ekranımda ne var?", "Bu hata ne?" soruları çalışır

### 5.2 Clipboard ✅

- ✅ `read_clipboard` / `write_clipboard` tool
- ✅ "Panoya kopyala", "Panodan oku" komutları

### 5.3 Pencere Yönetimi ✅

- ✅ `list_windows`: açık pencereleri listele
- ✅ `focus_window`: pencereyi öne getir / odakla

---

## Faz 6 — Sistem Kontrolü 🖱️ ✅

_Günlük kullanımda en çok işe yarayan şeyler._

### 6.1 Ses & Ekran ✅

- ✅ `set_volume`: sistem ses seviyesi ayarla (0-100)
- ✅ `set_brightness`: ekran parlaklığı kontrolü (dahili ekranlar)
- ✅ "Sesi %50 yap", "Ekranı karat"

### 6.2 Zamanlanmış Görevler ✅

- ✅ `remind_in`: X dakika sonra sesli/yazılı hatırlatıcı
- ✅ Hatırlatıcı gelince feed'e eklenir + TTS ile seslendirilir

### 6.3 Uygulama Profilleri ✅

- ✅ `save_app_profile`: profil oluştur (komut listesi, ~/.aegis/app-profiles.json)
- ✅ `run_app_profile`: profili çalıştır
- ✅ `list_app_profiles`: kayıtlı profilleri listele

---

## Faz 7 — Web & İletişim 🌐 ✅

### 7.1 Web İçerik Okuma ✅

- ✅ `fetch_url` tool: URL ver → sayfa HTML'ini çek, düz metne dönüştür, özetle
- ✅ "Bu haberi özetle", "Şu sayfada ne yazıyor?" soruları çalışır
- ✅ 12sn timeout, redirect takibi, HTML tag sıyırma

### 7.2 Bildirim Sistemi ✅

- ✅ `show_notification`: Electron Notification API ile Windows toast bildirimi
- ✅ "Bildirim gönder başlık: X mesaj: Y" komutu çalışır
- [ ] AEGIS kapalıyken bildirim (background service) — Faz 10 kapsamı

### 7.3 Email & Takvim _(opsiyonel)_

- [ ] Gmail / Outlook entegrasyonu — OAuth gerektiriyor, ileride

---

## Faz 8 — Gelişmiş Ses 🎙️

### 8.1 Sözünü Kesme ✅

- ✅ ESC tuşu veya ⏹ DURDUR butonu ile TTS kesilir
- ✅ Kesince mic otomatik açılır, dinlemeye geçer

### 8.2 Chat Geçmişi UI ✅

- ✅ Session bazlı konuşma listesi (◷ butonu → slide-in sidebar)
- ✅ Geçmiş konuşmayı aç, "DEVAM ET" ile historyRef'e yükle
- ✅ "DIŞA AKTAR" ile .md dosyası olarak indir

### 8.3 Command Palette ✅

- ✅ `Ctrl+Space` ile hızlı komut paleti (HologramSkin'de)
- ✅ 19 built-in komut, arama/filtreleme, ↑↓ klavye navigasyonu
- ✅ ANLIK (direkt gönder) / DÜZENLE (input'a yaz) modları

---

## Faz 9 — Plugin Sistemi 🔌 ✅

_Uzun vadeli genişleme katmanı._

### 9.1 Dinamik Tool Yükleme ✅

- ✅ `~/.aegis/plugins/<name>/` klasöründen otomatik yükle
- ✅ Her plugin: `manifest.json` (şema) + `index.js` (executor)
- ✅ Yeniden derleme gerektirmez — runtime `require()` ile yüklenir
- ✅ `list_plugins` / `reload_plugins` tool'ları: AEGIS'e "plugin'leri listele" diyerek yönet
- ✅ `require.cache` temizlenerek hot-reload desteklenir

### 9.2 Hazır Plugin'ler ✅

- ✅ **Spotify** — çal/duraklat, atla, önceki, ne çalıyor, ses, arama+çal (6 tool)
- ✅ **VS Code** — dosya/klasör aç, terminal komutu, yeni dosya, son projeler, uzantı kur (6 tool)
- ✅ **Steam** — oyun başlat (ad veya App ID), kütüphane listesi, Steam aç, oyun kapat (4 tool)
- ✅ **OBS** — kayıt başlat/durdur, yayın başlat/durdur, durum, sahne değiştir, sahneler, ses (8 tool, obs-websocket 5.x)

---

---

## Faz 10 — Arka Plan Servisi & Bildirimler 🔔

_AEGIS kapalıyken bile çalışsın._

### 10.1 Background Service ✅

- ✅ Windows'ta sistem tepsisinde (system tray) küçük ikon — AEGIS kapatılınca tamamen kapanmaz
- ✅ Tray menüsü: "Göster", "Mikrofon Aç", "Çıkış"
- ✅ Pencere kapatılınca gizle (`minimizeToTray` ayarı açıkken)
- ✅ Başlangıçta otomatik başlat seçeneği (`app.setLoginItemSettings` ile Windows registry)

### 10.2 Zamanlanmış Görevler & Cron ✅

- ✅ `schedule_task` tool: "every 30 minutes", "daily at 09:00" gibi ifadelerle tekrarlayan görev
- ✅ `list_scheduled_tasks` / `cancel_scheduled_task` / `toggle_scheduled_task` tool'ları
- ✅ Görevler `~/.aegis/scheduled-tasks.json`'da saklanır, uygulama açılışında yüklenir
- ✅ Görev tetiklenince `chat-stream-inject` ile AEGIS'e komut gönderilir + Windows bildirimi

### 10.3 Anlık Bildirim Tetikleyiciler ✅

- ✅ `watch_condition` tool: "GPU %90 geçerse uyar", "RAM %80 üstüne çıkarsa bildir" gibi
- ✅ `list_watch_conditions` / `remove_watch_condition` tool'ları
- ✅ CPU/RAM/GPU/Disk eşiği ayarlar panelinden (Telemetri sekmesi) de ayarlanabilir
- ✅ Windows toast bildirimi + feed'e uyarı mesajı; 60sn cooldown ile spam engellenir

---

## Faz 11 — Performans & Streaming ⚡

_Her token hissedilsin, her re-render önlensin._

### 11.1 Gerçek LLM Streaming

- [ ] Groq: `stream: true` — her token gelince `chat-delta` IPC'ye gönder
- [ ] Kullanıcı ilk kelimeyi ~200ms'de görsün, tüm yanıt bir anda değil
- [ ] Diğer provider'lar (OpenAI, Anthropic, Gemini) için de streaming aktif

### 11.2 Paralel Tool Execution

- [ ] Birden fazla tool çağrısı `Promise.all()` ile eş zamanlı çalışsın
- [ ] `web_search` + `get_weather` gibi bağımsız araçlar aynı anda dönsün

### 11.3 React Render Optimizasyonu

- [ ] `FeedItem` bileşeni `React.memo` ile ayrılsın — önceki balonlar re-render etmesin
- [ ] `skinProps` `useMemo` ile sarılsın — her render'da yeni nesne oluşturulmasın
- [ ] `CpuRow` / `GpuRow` / `TelRow` helper'ları `React.memo` ile izole

### 11.4 Diğer Optimizasyonlar

- [ ] `getUserProfile()` modül seviyesinde 60sn cache — her mesajda DB round-trip olmasın
- [ ] Telemetri interval'ları `before-quit`'te temizlensin — process artakalamasın
- [ ] Web search `AbortController` + 8sn timeout — Tavily donunca 30sn beklemesin
- [ ] CSS `@import` Google Fonts render-blocking kaldırılsın; `will-change` hint'leri eklenmeli

---

## Faz 12 — Ajans Modu & Otomasyon 🤖

_AEGIS sadece yanıtlamakla kalmaz, görevleri başından sonuna tamamlar._

### 12.1 Multi-Step Ajan ✅

- ✅ `agent_run` tool: hedef ver, AEGIS araçları zincirleme kullanarak tamamlar
- ✅ Sistem prompt'a ajan modu direktifi + maks adım limiti inject edilir
- ✅ Mevcut `runAgent` döngüsü (maks 8 adım) ajan modunu da karşılar
- ✅ `agent_run` → `registerAgentCallback` → `runAgent` zinciri

### 12.2 Makro Kayıt & Tekrar ✅

- ✅ `start_macro` / `stop_macro`: kullanıcı komutlarını `macros.json`'a kaydet
- ✅ `run_macro`: kaydedilmiş diziyi `chat-stream-inject` ile adım adım tekrarla
- ✅ `list_macros` / `delete_macro` tool'ları
- ✅ Makrolar `~/.aegis/macros.json`'da saklanır

### 12.3 Koşullu Otomasyon ✅

- ✅ `if_then` tool: `"cpu > 80"`, `"hour == 23"`, `"ram >= 75"` gibi koşullar tanımla
- ✅ `list_automations` / `remove_automation` / `toggle_automation` tool'ları
- ✅ Kurallar `~/.aegis/automations.json`'da saklanır
- ✅ Her 1.5sn telemetri döngüsünde değerlendirilir; 2dk cooldown ile spam engellenir

---

## Faz 13 — Bilgi Tabanı & RAG 📚

_AEGIS kendi belgelerin üzerinde akıl yürütebilsin._

### 13.1 Yerel Belge İndeksleme ✅

- ✅ `index_file` / `index_folder` tool: dosyaları 800-char chunk'lara böl, `~/.aegis/index/`'e kaydet
- ✅ `.txt`, `.md`, `.ts`, `.js`, `.py`, `.json`, `.csv` desteği
- ✅ SHA-256 hash ile değişen dosyalar incremental olarak güncellenir
- ✅ `list_indexed_files` / `remove_from_index` tool'ları

### 13.2 Semantik Arama ✅

- ✅ `search_knowledge` tool: BM25-lite kelime eşleşmesi ile en alakalı chunk'ları bul
- ✅ "Proje notlarımda X hakkında ne var?" sorusu çalışır
- ✅ Kaynak dosya adı + skor yanıtta gösterilir

### 13.3 Belge Sohbeti ✅

- ✅ `chat_with_file` tool: dosya içeriğini LLM bağlamına yükle (maks 12K karakter)
- ✅ "Bu dosyayı özetle", "Şu dosyada ne yazıyor?" soruları çalışır

---

## Faz 14 — Telefon & Mobil Köprüsü 📱

_AEGIS masaüstü ile telefonun arasındaki köprü olsun._

### 14.1 Yerel Ağ API ✅

- ✅ `electron/api-server.ts`: Node.js yerleşik `http` modülü ile sunucu (port 7331, harici bağımlılık yok)
- ✅ `GET /api/status` — sağlık kontrolü (auth gerekmez)
- ✅ `POST /api/ask` — `{text}` → AEGIS tek-turlu cevap
- ✅ `POST /api/tts` — `{text}` → base64 MP3
- ✅ `GET /api/qr` — IP + port + token bilgisi
- ✅ `POST /api/token/reset` — yeni token üret
- ✅ Bearer token auth; token `~/.aegis/api-token.txt`'te saklanır
- ✅ Ayarlar paneli toggle'ı (Görünüm → Uygulama)

### 14.2 Mobil Kısayollar ✅

- ✅ `curl -H "Authorization: Bearer <token>" -d '{"text":"soru"}' http://<ip>:7331/api/ask` ile iOS/Android Tasker entegrasyonu

### 14.3 QR Bağlantı ✅

- ✅ `GET /api/qr` endpoint'i IP + port + token döndürür; QR oluşturmak için herhangi bir QR aracına yapıştırılabilir

---

## Faz 15 — Web Arayüzü 🌐

_AEGIS'e başka cihazdan tarayıcıdan da erişilebilsin._

### 15.1 Tarayıcı Tabanlı UI ✅

- ✅ `GET /` → minimal AEGIS web arayüzü (saf HTML/CSS/JS, React gerekmez)
- ✅ Kullanıcı mesaj gönderebilir, yanıtları görebilir
- ✅ `GET /events?token=…` — SSE (Server-Sent Events) ile gerçek zamanlı delta/tool/done akışı
- ✅ Token localStorage'da saklanır

### 15.2 Çok Cihaz Senkronizasyonu ✅

- ✅ `runAgent` → `send()` → SSE broadcast: masaüstü + tarayıcı eş zamanlı güncellenir
- ✅ `delta`, `done`, `tool` event tipleri her bağlı client'a iletilir

---

## Faz 16 — Gelişmiş Hafıza & Kişiselleştirme 🧠+

_Faz 1'in üzerine derin öğrenme katmanı._

### 16.1 Kalıcı Gerçekler ✅

- ✅ `remember_fact` tool: "Bunu bil: …" ile manuel gerçek kaydet (`~/.aegis/facts.json`)
- ✅ `list_facts` / `forget_fact` tool'ları
- ✅ Gerçekler her konuşmada system prompt'a otomatik inject edilir

### 16.2 Alışkanlık Takibi ✅

- ✅ Her tool çağrısı `habits.json`'a kaydedilir (araç adı + kullanım sayısı)
- ✅ `list_habits` tool: "en sık hangi araçları kullanıyorum?" sorusunu yanıtlar

### 16.3 Sabah Özeti ✅

- ✅ İlk günlük açılışta otomatik sabah özeti: hava + notlar + görevler
- ✅ `morning-check.json` ile günde bir kez tetiklenir, tekrar etmez
- ✅ 4sn gecikmeyle pencere yüklendikten sonra başlar

---

## Faz 17 — Güvenlik & Gizlilik 🔒

_AEGIS'in verilerini güvende tut._

### 17.1 API Key Vault ✅

- ✅ `vault_store` / `vault_list` / `vault_delete` tool'ları
- ✅ Electron `safeStorage` (OS DPAPI/Keychain) ile AES-256 şifreli depo
- ✅ Şifreli değerler `~/.aegis/vault.enc.json`'da hex olarak saklanır

### 17.2 Veri Denetimi ✅

- ✅ `privacy_audit` tool: tüm AEGIS veri konumlarını listele (mevcut/değil işaretli)
- ✅ `clear_old_data` tool: X günden eski bilgi tabanı + devre dışı görevleri temizle

### 17.3 Güvenli Başlatma ✅

- ✅ `initVault(safeStorage)` ile boot'ta şifreleme motoru başlatılır
- ✅ `safeStorage.isEncryptionAvailable()` kontrolü; desteklenmiyorsa hata verir

---

## Faz 18 — Gelişmiş Plugin Ekosistemi 🔌+

_Faz 9'un üzerine marketplace katmanı._

### 18.1 Plugin Marketplace ✅

- ✅ `plugin_search` tool: GitHub Search API ile aegis-plugin araması
- ✅ `plugin_install` tool: repo zip indir → manifest doğrula → güvenlik taraması → kur
- ✅ `plugin_remove` tool: plugin klasörünü kaldır

### 18.2 Plugin Güvenlik Taraması ✅

- ✅ `manifest.json` şema doğrulaması (name, tools, tool.name kontrolleri)
- ✅ `index.js` statik kod taraması — şüpheli pattern'lar reddedilir
- ✅ Kurulum öncesi güvenlik başarısız olursa işlem iptal edilir

### 18.3 Yeni Hazır Plugin'ler ✅

- ✅ **Discord** (3 tool): webhook mesaj, durum ayarla, rich presence
- ✅ **Notion** (3 tool): sayfa oluştur, arama, blok ekle (Notion API v1)
- ✅ **Home Assistant** (3 tool): cihaz durumu, servis çağrısı, entity listesi (yerel HTTP API)
- ✅ **YouTube** (3 tool): video ara (Invidious API), tarayıcıda aç, transkript al (yt-dlp)

---

## Faz 19 — Ses & Müzik Üretimi 🎵 ✅

_AEGIS sadece dinlemez, üretir de._

### 19.1 Ses Efektleri ✅

- ✅ `play_sound` tool: özel `.wav`/`.mp3` çal; `~/.aegis/sounds/` klasöründen veya tam yol
- ✅ `list_sounds` tool: mevcut ses dosyalarını listele
- ✅ Ses dosyaları `~/.aegis/sounds/`'tan yüklenir

### 19.2 Ambient Ses Modu ✅

- ✅ `ambient_start` / `ambient_stop`: arka planda odaklanma müziği / beyaz gürültü
- ✅ Hazır kategoriler: rain, forest, cafe, white, space, lofi
- ✅ Yerel `.mp3` dosya desteği; `~/.aegis/sounds/` klasörüne dosya koyunca aktif olur

---

## Faz 20 — Kod Asistanı & Geliştirici Araçları 👨‍💻 ✅

_AEGIS bir programcının en iyi yardımcısı olsun._

### 20.1 Git Entegrasyonu ✅

- ✅ `git_status` / `git_log` / `git_diff` tool'ları: repo durumunu sorgula
- ✅ `git_commit` tool: staged değişiklikleri commit et
- ✅ `git_branch` tool: branch oluştur (create), değiştir (switch), listele (list)

### 20.2 Terminal Çıktısı Analizi ✅

- ✅ `run_and_analyze` tool: komut çalıştır + çıktıyı LLM ile yorumla
- ✅ "Bu hata ne anlama geliyor?" soruları için stack trace analizi

### 20.3 Proje Şablonları ✅

- ✅ `scaffold_project` tool: 5 hazır şablon — python-fastapi, react-tailwind, node-express, electron-app, next-ts
- ✅ `list_templates` tool: mevcut şablonları listele
- ✅ Şablon dosyaları doğrudan hedef dizinde oluşturulur

---

## Faz 21 — Takvim & Zaman Yönetimi 📅 ✅

_AEGIS zamanı planlar, seni hatırlatır._

### 21.1 Yerel Takvim Entegrasyonu ✅

- ✅ `calendar_get_events` tool: Windows Takvim / UWP API ile etkinlik sorgulama
- ✅ `calendar_add_event` tool: Outlook COM ile etkinlik ekle (başlık, saat, süre, notlar)

### 21.2 Pomodoro & Odaklanma Modu ✅

- ✅ `pomodoro_start` / `pomodoro_stop`: özelleştirilebilir çalışma/mola döngüsü (varsayılan 25/5 dk)
- ✅ Her pomodoro bitiminde Windows bildirim (`~/.aegis/pomodoro-state.json`)
- ✅ Oturum sayacı ve faz takibi (work / break)

### 21.3 Zaman Takibi ✅

- ✅ `time_track_start` / `time_track_stop`: görev bazlı zaman kayıt
- ✅ `time_track_report`: today / week / month raporu (`~/.aegis/time-log.json`)
- ✅ Aynı anda birden fazla aktif görev önlenir; önceki otomatik durdurulur

---

## Faz 22 — Dosya & Medya Yönetimi 🗂️ ✅

_AEGIS dosyaları anlar, düzenler, dönüştürür._

### 22.1 Akıllı Dosya Organizasyonu ✅

- ✅ `organize_folder` tool: uzantı veya tarih bazlı alt klasörlere taşı
- ✅ `find_duplicates` tool: MD5 hash ile yinelenen dosyaları bul (recursive desteği)
- ✅ `bulk_rename` tool: regex + `{n}` sıra numarası ile toplu yeniden adlandır

### 22.2 Görüntü Analizi & İşleme ✅

- ✅ `analyze_image` tool: base64 kodlama + vision model hazırlığı (OpenAI API key ile aktif)
- ✅ `resize_image` tool: .NET System.Drawing ile yüksek kaliteli yeniden boyutlandırma
- ✅ `convert_image` tool: PNG/JPEG/BMP/GIF format dönüşümü

### 22.3 PDF & Belge İşleme ✅

- ✅ `pdf_to_text` tool: Word COM nesnesi ile PDF'ten metin çıkarma (Outlook kuruluysa)
- ✅ Alternatif: `index_file` ile PDF bilgi tabanına indekslenebilir

---

## Faz 23 — Yapay Zeka Kişiliği & Rol Sistemi 🎭 ✅

_AEGIS farklı modlarda çalışsın — asistan, koç, arkadaş._

### 23.1 Kişilik Profilleri ✅

- ✅ `set_persona` tool: default, formal, friendly, coach, teacher + özel persona
- ✅ `get_persona` / `list_personas` tool'ları
- ✅ `add_persona` tool: özel kişilik ekle (`~/.aegis/personas.json`)
- ✅ Her persona kendi system prompt direktifleriyle gelir

### 23.2 Rol Yapma & Simülasyon ✅

- ✅ `roleplay_start` tool: karakter + senaryo ver, AEGIS o karakterde konuşur
- ✅ `roleplay_stop` ile normal moda dön
- ✅ Rol durumu `~/.aegis/roleplay-state.json`'da kalıcı olarak saklanır

### 23.3 Kişilik Sistem Promptu ✅

- ✅ `getPersonaSystemPrompt()` fonksiyonu main.ts system prompt'una inject edilebilir
- ✅ Rol yapma aktifken karakter direktifi otomatik eklenir

---

## Faz 24 — Ağ & Sunucu Yönetimi 🌐 ✅

_AEGIS ağı izler ve sunucu işlerini halleder._

### 24.1 Ağ Tanılama ✅

- ✅ `ping_host` tool: Test-Connection ile gecikme ölçümü
- ✅ `trace_route` tool: tracert ile ağ yolunu izle
- ✅ `port_scan` tool: TCP bağlantı testi ile açık portları listele
- ✅ `dns_lookup` tool: Resolve-DnsName ile A/MX/TXT/CNAME kayıt sorgusu

### 24.2 SSH & Uzak Sunucu ✅

- ✅ `ssh_run` tool: kaydedilmiş profile ile SSH komut çalıştır
- ✅ `ssh_add_host` tool: SSH profili kaydet (`~/.aegis/ssh-hosts.json`)
- ✅ Private key desteği, özelleştirilebilir port

### 24.3 Docker Yönetimi ✅

- ✅ `docker_ps` / `docker_start` / `docker_stop` tool'ları
- ✅ `docker_logs` tool: container son N satır log
- ✅ Docker kurulu değilse anlamlı hata mesajı döner

---

## Faz 25 — Gelişmiş Görselleştirme & Dashboard 📊 ✅

_AEGIS verileri görsel olarak sunsun._

### 25.1 Grafik Oluşturma ✅

- ✅ `create_chart` tool: ASCII tabanlı bar, line, pie grafik oluştur
- ✅ Veri formatları: `{labels:[...], values:[...]}` veya `[[label,val],...]`
- ✅ Feed'de anında gösterilir, başlık desteği

### 25.2 Sistem Sağlık Raporu ✅

- ✅ `system_report` tool: CPU model/çekirdek, RAM, disk, uptime, OS versiyonu
- ✅ Disk bilgisi PowerShell Get-PSDrive ile tüm sürücüleri kapsar
- ✅ Zamanlanmış görev ile haftalık otomatik rapor kurulabilir

---

## Faz 26 — E-posta & İletişim 📧 ✅

_AEGIS mesajları okur, yazar ve düzenler._

### 26.1 SMTP / IMAP E-posta ✅

- ✅ `email_send` tool: PowerShell Send-MailMessage ile SMTP e-posta gönder
- ✅ `email_fetch` tool: IMAP / Outlook COM ile gelen kutusu oku
- ✅ `email_setup_smtp` tool: SMTP/IMAP profili kaydet (`~/.aegis/email-profiles.json`)
- ✅ Şifreler vault ile güvenli saklanır

### 26.2 E-posta Özetleme & Taslak ✅

- ✅ `email_draft` tool: niyet + alıcı + ton ile profesyonel e-posta taslağı oluştur
- ✅ Dil (TR/EN) ve ton (formal/friendly/assertive) desteği

### 26.3 Slack & Teams _(mevcut Discord plugin)_

- ✅ Discord webhook ile kanal mesajı gönderme (Faz 18 eklendi)
- Slack/Teams: webhook URL ile `run_command` üzerinden SendGrid/curl ile gönderilebilir

---

## Faz 27 — Öğrenme & Kişisel Gelişim 📚 ✅

_AEGIS öğrenmeyi takip eder ve destekler._

### 27.1 Flashcard Sistemi ✅

- ✅ `card_add` tool: ön yüz + arka yüz + etiket ile kart ekle (`~/.aegis/flashcards.json`)
- ✅ `card_review` tool: SM-2 lite spaced repetition algoritması; otomatik interval güncelleme
- ✅ Etiket bazlı filtreleme, sonraki tekrar zamanı gösterimi

### 27.2 Okuma Listesi & Özet ✅

- ✅ `reading_add` tool: URL veya kitap adı ekle, öncelik 1-5
- ✅ `reading_summarize` tool: URL fetch → HTML → metin çıkarma → LLM özetleme
- ✅ `reading_list` tool: öncelik sıralı liste, durum filtreleme (pending/done/all)

### 27.3 Hedef Takibi ✅

- ✅ `goal_set` tool: başlık, son tarih, alt adımlar ile hedef oluştur (`~/.aegis/goals.json`)
- ✅ `goal_check_in` tool: ilerleme yüzdesi + not ekle; %100'de otomatik tamamlandı
- ✅ `goal_list` tool: ASCII progress bar ile hedef görünümü, durum filtreleme

---

## Faz 28 — Fiziksel Dünya & IoT Entegrasyonu 🏠 ✅

_AEGIS fiziksel dünyaya uzanır._

### 28.1 Hava İstasyonu Verileri ✅

- ✅ `weather_station` tool: OpenWeatherMap API ile sıcaklık, nem, basınç, rüzgar
- ✅ OPENWEATHER_API_KEY ayarlardan girilince aktif olur
- ✅ Konum belirtilmezse settings'teki şehir kullanılır

### 28.2 Bluetooth & USB Cihaz Yönetimi ✅

- ✅ `list_bluetooth` tool: Get-PnpDevice -Class Bluetooth ile cihaz listesi
- ✅ `connect_bluetooth` / `disconnect_bluetooth` tool'ları (Enable/Disable-PnpDevice)
- ✅ `list_usb` tool: USB instanceId ile takılı cihazları listele

### 28.3 Baskı ✅

- ✅ `list_printers` tool: Get-Printer ile yazıcı listesi
- ✅ `print_file` tool: Start-Process -Verb Print ile yazdır
- ✅ `printer_status` tool: yazıcı durumu (WorkOffline, PrinterStatus)

---

## Faz 29 — Yapay Zeka Zinciri & Çoklu Model 🤖 ✅

_AEGIS tek model değil, model orkestrasyonu olsun._

### 29.1 Çoklu Model Yönlendirme ✅

- ✅ `model_route_set` tool: görev türüne model eşle (`~/.aegis/model-routing.json`)
- ✅ `model_route_list` tool: mevcut yönlendirme kurallarını listele
- ✅ task_type bazlı özelleştirilebilir kural tablosu

### 29.2 Zincirleme Prompt (Pipeline) ✅

- ✅ `pipeline_save` tool: adım adım prompt zinciri tanımla (`~/.aegis/pipelines.json`)
- ✅ `pipeline_run` tool: pipeline çalıştır, `{{input}}` placeholder ile adımlar arası veri aktarımı
- ✅ `pipeline_list` tool: mevcut pipeline'ları listele

### 29.3 Model Karşılaştırma ✅

- ✅ `model_compare` tool: aynı prompt'u birden fazla modele gönder, yanıtları karşılaştır
- ✅ Provider:model formatı (örn: groq:qwen3-32b, groq:llama-3.3-70b)
- ✅ Gerçek API çağrısı için tüm provider key'leri ayarlanmalı

---

## Faz 30 — Dağıtım: Deneme Modu + Kimlik + Proxy 🚀

_AEGIS son kullanıcıya dağıtılabilir olsun. İki giriş: "Hızlı Başlangıç" (deneme, senin sunucun, rate limited) ve "Gelişmiş Kurulum" (kullanıcının kendi anahtarları). Tüm kimlik doğrulama senin Supabase'ine bağlanır._

_Sırlar (Groq + Supabase service_role) yalnızca Edge Function secret'ında durur. Client'ta yalnızca public-safe anon key + RLS bulunur — repo public olsa bile sızıntı olmaz._

### 30.1 Supabase backend temeli ✅

- ✅ Supabase Auth aç — email/şifre (confirm-email kapalı)
- ✅ `usage` tablosu: günlük istek + token sayacı (`user_id, day, request_count, token_count`)
- ✅ `user_configs` tablosu: cloud sync için `settings jsonb` + `encrypted_keys`
- ✅ RLS politikaları — herkes yalnızca kendi satırını okur; `usage` yazımı yalnızca Edge Function'a açık (client INSERT/UPDATE 403 ile reddedildi — test edildi)
- ✅ `supabase/schema.sql` güncellendi + `increment_usage` atomik RPC (security definer)

### 30.2 Edge Function `chat-proxy` (deneme beyni) ✅

- ✅ JWT doğrula → `usage`'dan limit kontrol → aşımda `429`
- ✅ Limit OK → Edge secret'taki Groq key ile Groq'a streaming, yanıtı client'a aktar
- ✅ Yanıt sonunda `usage` satırını arttır (istek + token) — `increment_usage` ile
- ✅ Dashboard'dan deploy; `GROQ_API_KEY` Edge secret. Uçtan uca test: stream cevap + sayaç arttı + RLS yazma engeli doğrulandı

### 30.3 Electron — gömülü public config + sır temizliği ✅

- ✅ Gömülü sabitler `electron/aegis-config.ts`: `AEGIS_SUPABASE_URL`, `AEGIS_SUPABASE_ANON_KEY`, `AEGIS_PROXY_URL` (env override destekli)
- ✅ `electron/auth.ts` — anon key ile Supabase Auth (login/signup/logout, dosya tabanlı oturum, sessiz yenileme)
- ✅ `callProxy` — deneme modunda chat senin proxy'inden (stream + tool-call). Kendi Groq key'i varsa bypass
- ✅ Uçtan uca test: login → getAccessToken → proxy 200 "PROXY_OK"

### 30.4 Mod seçim + kimlik ekranları ✅

- ✅ `ModeSelectScreen` — "Hızlı Başlangıç (Deneme)" vs "Gelişmiş Kurulum"
- ✅ `AuthScreen` — email/şifre kayıt + giriş; deneme→zorunlu, gelişmiş→opsiyonel + "Atla"
- ✅ `Onboarding` state machine; `main.ts` ilk açılış mantığı (ownReady/trialReady → onboarding)
- ✅ `SetupScreen` gelişmiş kuruluma dönüştü; Supabase opsiyonel oldu (`db.ts` graceful no-op)
- ✅ Temiz makinede test: onboarding açıldı, mod seçim → auth geçişi çalıştı

### 30.5 Chat akışını moda göre yönlendir ✅

- ✅ Deneme modu: `callProxy` ile proxy fetch + JWT (stream + tool-call korunur)
- ✅ Deneme + kullanıcının kendi Groq key'i → proxy bypass, direkt Groq
- ✅ Gelişmiş mod → mevcut direkt-provider akışı (değişiklik yok)
- ✅ Vision/screenshot analizi de deneme modunda proxy'e gider
- ✅ 429 limit yanıtı UI'da "sistem hatası" damgası olmadan, doğrudan mesaj olarak gösterilir

### 30.6 Rate limit cilası & kötüye kullanım koruması ✅

- ✅ Edge Function limitleri sabit (50 istek/gün, 100k token/gün, 8192 token/istek)
- ✅ Kalan kota Ayarlar → Hesap sekmesinde gösterilir (`usage-get` IPC + RLS okuma)
- ✅ İstek başına token tavanı Edge'de zorlanıyor; 429 limit testi doğrulandı
- ✅ Hesap sekmesi: mod, e-posta, kota çubukları, çıkış; UTC sıfırlama notu

### 30.7 Cloud sync (Gelişmiş mod, opsiyonel auth) ✅

- ✅ Ayarlar + şifreli API key'leri `user_configs`'e yaz (`cloud-sync.ts`, debounce'lu otomatik push)
- ✅ İstemci tarafı şifreleme — AES-256-GCM (user.id'den türetilen anahtar); sunucuda key düz metin DEĞİL (test edildi)
- ✅ Açılışta `pullFromCloud` ile çek, yerel `~/.aegis` ile birleştir; uçtan uca roundtrip test edildi
- ✅ "Bu cihazı senkronla" toggle'ı (Ayarlar → Hesap)

### 30.8 Dağıtım sertleştirme & yayın 🔶

- ✅ Repo sır taraması — service_role / Groq key sızıntısı yok (anon key güvenli); pre-commit hook (`scripts/check-secrets.sh`) gerçek sırrı engelliyor (test edildi)
- ⬜ `electron-builder` imzalı build; `AEGIS_*` env'leri CI secret'tan enjekte (release ertelendi — daha çok fix var)
- ✅ Onboarding çok dilli (5 dil) + en başta dil seçim ekranı
- ✅ Hata durumları: proxy/Supabase/ağ down → "Gelişmiş moda geç" önerili anlamlı mesaj

---

## Faz 31 — Model-Özel Revizyon & Sıfır-Hata AI Katmanı 🎯 ✅

_Projenin ana amacı: her model yalnızca DESTEKLEDİĞİ kadarını yapsın, desteklemediği
parametre hiç gönderilmesin → 400/422 "unsupported parameter / max_tokens too large /
no tool support" hataları kökten bitsin. Her provider'ın resmi dokümanı tek tek okundu._

### 31.1 Model yetenek kayıt defteri ✅

- ✅ `electron/model-capabilities.ts` — `getModelCapabilities(provider, model)` tek doğruluk kaynağı
- ✅ Her model için: tool / temperature / system / vision / streaming / reasoning desteği + `maxOutputTokens` + `contextWindow` + `usesMaxCompletionTokens`
- ✅ Veriler resmi dokümanlardan derlendi (Groq, OpenAI, Anthropic, Gemini, Mistral, DeepSeek, xAI — Haziran 2026)
- ✅ Bilinmeyen model → güvenli muhafazakâr varsayılan (hata almamak önce)
- ✅ 16 temsili modelde doğrulandı (smoke test)

### 31.2 callAI modele göre parametre kırpma ✅

- ✅ `max_tokens` modelin çıktı tavanına clamp'lenir (kritik: claude-3-opus/haiku 8192→**4096**, yoksa 400)
- ✅ OpenAI o-serisi/gpt-5 → `max_tokens` yerine **`max_completion_tokens`**; temperature atılır
- ✅ Reasoning modelleri (deepseek-reasoner, o1-mini…) → tool + temperature gönderilmez (deepseek-reasoner tool desteklemiyor)
- ✅ Tool desteklemeyen model (gemma2, o1-mini…) → şema HİÇ gönderilmez (token + hata tasarrufu)
- ✅ system rolü desteklemeyen model (o1-mini/o1-preview) → system metni ilk user mesajına birleştirilir
- ✅ Vision desteklemeyen modele giden görüntüler stripleniyor (yer tutucu metin) → 400 önlenir
- ✅ Tüm provider dalları (groq/anthropic/gemini/ollama/xai/deepseek/openai/mistral) tek tek elden geçti

### 31.3 Bağlam penceresine göre geçmiş yönetimi ✅

- ✅ Sabit "son 20 mesaj" yerine MODELE GÖRE token bütçesi (`trimToBudget`): küçük-ctx modelde daha az, geniş-ctx modelde dolu kullanım
- ✅ Pencere boundary düzeltme korunur (tool/araç-çağrılı assistant ile başlamaz → 400 yok)
- ✅ Deneme modunda yetenekler efektif olarak Groq'a göre hesaplanır (proxy Groq'a gider)
- ✅ `summarizeAndSave` yerel Groq anahtarı yoksa sessizce atlar (401 spam'i biter)

### 31.4 UI — model yetenek görünürlüğü ✅

- ✅ `caps-get` IPC + Model sekmesinde "BU MODEL NE YAPABİLİR" rozetleri (Araçlar/Görüntü/Reasoning/Bağlam/Çıktı)
- ✅ Kullanıcı seçtiği modelin sınırlarını net görür

---

## Faz 32 — Renk/Zemin Palet Presetleri 🎨 ✅

_Hazır palet preset'leri: accent + arka plan + font tek tıkla. (Not: bu "palet"tir;
gerçek skin "aileleri" Faz 33'te.)_

- ✅ `src/themes.ts`: `UI_FAMILIES` — cyber/synthwave/matrix/aurora/ember (bg + accent + font preset)
- ✅ `--bg`/`--bg-deep` CSS değişkenleri; skin arka planları + body + `.backdrop` bunları kullanıyor (sabit `#03060c` kaldırıldı)
- ✅ `applyFamilyBg` (App): aile → arka plan; aile seçimi accent + font'u da preset'ler (kullanıcı sonra tek tek ezebilir)
- ✅ Ayarlar → Görünüm: "UI AİLESİ" seçici (swatch + label); `uiFamily` settings'e kalıcı
- ✅ Skinlerin sabit fontu da `var(--ui-font)`'a bağlandı (aile fontu etki etsin)

---

## Faz 33 — Skin Aileleri 🧩 ✅ (4 aile × 4 skin = 16)

_Mevcut 4 skin tek bir AİLE altında toplandı; kullanıcının istediği 3 yeni
bağımsız aile eklendi — her biri gerçek farklı tasarım dili (recolor değil),
4'er ferdi (skin)._

- ✅ Mimari: `src/components/skins/registry.tsx` — skinler ailelere gruplu; `getSkinComp(id)`; App render + Ayarlar seçici buradan; `skin` tipi `string`
- ✅ Ayarlar → Görünüm: skin seçici "AİLE › FERDİ" gruplu
- ✅ **Aegis HUD** (neon/keskin/glow): Hologram / Minimal / Terminal / Dashboard
- ✅ **Nebula** (yumuşak/yuvarlak/bubble/gradient): Aura / Chat / Board / Zen — `NebulaFamily.tsx`
- ✅ **Codex** (düz/editöryel/brutalist mono): Doc / Split / Grid / Log — `CodexFamily.tsx`
- ✅ **Retro** (CRT/beveled/scanline/synthwave): CRT / Boot / Panel / Wave — `RetroFamily.tsx`
- Her aile "PALET" (Faz 32) ile de birleşebilir → çok daha fazla görsel kombinasyon

---

## Faz 34 — Benzersiz UI Aileleri + Zengin Ana Ekran 🎨 (planlı · tek tek)

**Problem:** Faz 33 aileleri birbirine benziyor — çünkü (a) hepsi tek seçili
rengi/zemini kullanıyor (renk = "palet", layout = "aile" diye ayrılmıştı), (b)
ana ekran sadece telemetri + chat'ten oluştuğu için UI'da işlenecek malzeme az.
**Karar (kullanıcı):** Her aile KENDİ tam kimliğini dayatsın; hepsi birbirinden
tamamen unique olsun; tek tek yapılacak, her aile bitince dur–göster–onay.

### 34.1 Aile kimlik sistemi (altyapı) ✅

- Her aile kendi hardcoded renk/zemin/font paletini doğrudan TSX sabitleri olarak taşır
- Nebula/Codex/Retro registry'den çıkarıldı; Skeuomorphism/Neo-brutalism/Claymorphism eklendi

### 34.2 Ana ekran içerik genişletme (ailelere malzeme) ⬜

Telemetri+chat dışında, ailelerin farklı dizebileceği opsiyonel modül havuzu:

- Hızlı aksiyon dock'u / uygulama başlatıcı
- Bugünün ajandası (takvim) + notlar/hatırlatıcılar paneli
- Medya / now-playing widget
- CPU/RAM/GPU mini geçmiş grafikleri (sparkline)
- Ses dalga görselleştirici (dinlerken)
- Komut önerisi chip'leri / selamlama başlığı
- Saat varyantları (analog, dünya saatleri); aktif otomasyon/izleme, persona göstergesi

### 34.3 Aileler — 4 akım × 4 ferdi (her biri ayrı tasarım AKIMI) ✅

Her ailede aynı **4 arketip** o akımın diliyle yorumlanır: **İmza** (vitrin),
**Sohbet** (konuşma öncelikli), **Kompakt** (yoğun/mini), **Pano** (telemetri/widget).

**0. Aegis HUD** ✅ (mevcut, dokunulmaz) — _Cyberpunk / Sci-fi HUD_: koyu, neon-glow, keskin
→ Hologram · Minimal · Terminal · Dashboard

**1. Skeuomorphism** ✅ — gerçek nesne & doku (deri/metal/cam/kâğıt, gerçekçi gölge, fiziksel düğme). Sıcak koyu deri zemin, pirinç/amber vurgu, Oxanium/Rajdhani.
→ **Desk** (İmza) · **Journal** (Sohbet) · **Walkman** (Kompakt) · **Cockpit** (Pano)

**2. Neo-brutalism** ✅ — ham/cesur (kalın çerçeve, sert ofset gölge, dev tipografi). Koyu siyah zemin, krem metin, Space Grotesk bold.
→ **Poster** (İmza) · **Stack** (Sohbet) · **Switch** (Kompakt) · **Grid** (Pano)

**3. Claymorphism** ✅ — yumuşak puffy 3D (pastel, çok yuvarlak, çift gölge, kabarık). Derin mor zemin, lila/mint/şeftali pastel vurgu, Poppins.
→ **Orb** (İmza) · **Pillow** (Sohbet) · **Pebble** (Kompakt) · **Tiles** (Pano)

_(Faz 33'teki Nebula/Codex/Retro registry'den çıkarıldı; 3 yeni benzersiz aile ile değiştirildi.)_
_Faz değil. Onboarding çok dilli oldu ama uygulamanın geri kalanı hâlâ sabit Türkçe.
Dil seçiminin etki etmediği yerler — kullanıcı görme sırasına göre öncelikli. Her madde
i18n.ts'e string ekleyip ilgili dosyada `t.` ile değiştirmek demek (5 dil: tr/en/de/fr/es)._

**Öncelik 1 — Ana ekran (hep görünür): ✅ BİTTİ**

- ✅ Skinler: input placeholder, durum metinleri (KONUŞMA, CANLI/HAZIR/İŞLENİYOR/DİNLİYOR), boş-feed mesajları, buton etiketleri (GÖNDER/DURDUR/KAPAT), saat locale — Hologram/Minimal/Terminal/Dashboard (Minimal/Terminal bilinçli İngilizce estetik korundu)
- ✅ FeedItem: "HATA" etiketi, tool fiilleri (KOMUT YÜRÜTÜLÜYOR, DOSYA OKUNUYOR…)
- ✅ CommandPalette: arama/ipuçları/ANLIK-DÜZENLE + 19 komutun label/açıklama/text'i (5 dil)
- ✅ ChatHistorySidebar: başlık, yükleniyor/boş/özet-yok, DEVAM ET/DIŞA AKTAR, SİZ/AEGIS, tarih locale
- ✅ VoiceModeToggle: mod etiketleri (MİK KAPALI/SÜREKLİ/UYANDIRMA) + başlık
- Altyapı: i18n.ts `UI.LangStrings` (~40 anahtar) + `EXTRA` + `PALETTE_COMMANDS`; `t` skinProps'tan, `lang` standalone panellere geçiyor

**Öncelik 2 — Ayarlar paneli (en yoğun, ~200 metin):**

- ⬜ SettingsPanel: NAV_ITEMS (sekme adları + alt başlıklar)
- ⬜ settings/shared.tsx: ortak primitive metinleri, model tag'leri
- ⬜ AccountTab, ModelTab, VoiceTab, AppearanceTab, KeysTab, TelemetryTab, ToolsTab, ShortcutsTab — her sekmenin SectionLabel/Hint/FieldLabel'ları
- ⬜ SetupScreen (Gelişmiş kurulum) — alan etiketleri, ipuçları, hata mesajları

**Öncelik 3 — Backend kullanıcıya dönen metinler:**

- ⬜ main.ts hata/limit mesajları (friendlyHttpError, friendlyGroqError, callProxy) — şu an sabit Türkçe; dile göre çevrilmeli
- ⬜ tools.ts executor dönüş mesajları (ENGELLENDI, HATA, başarı metinleri) — opsiyonel (AI'a gidiyor, kullanıcı dolaylı görür)

**Yaklaşım:** Öncelik 1'i bir turda bitir → commit. Öncelik 2'yi tab-tab (her commit birkaç tab). Öncelik 3 en son. Tahmini: 1 birkaç saat, 2 birkaç tur, 3 kısa.

---

---

## Faz 35 — Gerçek Zamanlı Sesli Çeviri 🌐🎙️ ✅

_Konuşurken anlık çeviri — toplantıda, videoda, yabancı içerikte._

### 35.1 Sürekli Çeviri Modu ✅

- ✅ `translation_start` / `translation_stop` tool: kaynak + hedef dil belirt → çeviri modu
- ✅ Desteklenen dil çiftleri: Whisper destekli tüm diller
- ✅ Çeviri motoru: Groq Whisper (transkripsiyon) + LLM translate

### 35.2 Dosya & Metin Çevirisi ✅

- ✅ `translate_text` tool: metin ver → hedef dile çevir (bağlam korumalı, LLM tabanlı)
- ✅ `translate_file` tool: .txt / .md dosyasını çevir → `_<lang>.md` olarak kaydet
- ✅ Ton seçeneği: resmi / gündelik / teknik

### 35.3 Altyazı Modu ✅

- ✅ `subtitle_toggle` tool: overlay modu aç/kapat

---

## Faz 36 — Akıllı Bildirim Filtresi & Özet 🔔 ✅

_Windows bildirimlerini AEGIS süzer, özetler, önceliklendirir._

### 36.1 Windows Bildirim Yakalama ✅

- ✅ `notification_recent` / `notification_history` tool'ları: WinEvent + Application log
- ✅ Uygulama filtresi: `notification_filter_set` / `notification_filter_list`

### 36.2 Akıllı Önceliklendirme ✅

- ✅ `notification_filter_set` tool: uygulama bazlı göster/gizle kuralı

### 36.3 Sessiz Saatler ✅

- ✅ `do_not_disturb` tool: X dakika DND aktif / kapat

---

## Faz 37 — Kod Derleyici & Test Koşucusu 👨‍💻⚡ ✅

_AEGIS projeyi derler, test eder, hataları açıklar — tek komutla._

### 37.1 Proje Tanıma & Build ✅

- ✅ `project_detect` tool: Node.js/Rust/Python/Go/Java otomatik tanıma
- ✅ `build_project` tool: proje tipine göre doğru build komutu (npm/cargo/pip/go build…)

### 37.2 Test Koşucu ✅

- ✅ `run_tests` tool: `npm test`, `pytest`, `cargo test`, `go test` + sonuç özeti
- ✅ Belirli test dosyası desteği

### 37.3 Lint & Kod Kalitesi ✅

- ✅ `lint_project` tool: eslint, pylint, cargo clippy, golangci-lint
- ✅ `format_code` tool: prettier, black, rustfmt, gofmt

---

## Faz 38 — Canlı Haber & Fiyat Takibi 📈 ✅

_AEGIS güncel kalır — haber, döviz, kripto, borsa._

### 38.1 RSS & Haber Akışı ✅

- ✅ `rss_add` / `rss_remove` / `rss_list` / `rss_fetch` tool'ları (RSS+Atom desteği)

### 38.2 Döviz & Kripto Fiyatları ✅

- ✅ `fx_rate` tool: exchangerate-api.com ile döviz kuru
- ✅ `crypto_price` tool: CoinGecko ile kripto (USD+TRY)
- ✅ `price_alert_set` tool: hedef fiyat aleti

### 38.3 Borsa Fiyatları ✅

- ✅ `price_get` tool: Yahoo Finance ile hisse senedi (AAPL, TSLA, BIST vb.)

---

## Faz 39 — Sesli Toplantı Asistanı 🎙️📝 ✅

_Toplantıyı dinler, madde madde özetler, eylem maddelerini çıkarır._

### 39.1 Toplantı Kaydı ✅

- ✅ `meeting_start` / `meeting_stop` tool'ları: transkript `~/.aegis/meetings/` altına kaydedilir

### 39.2 Akıllı Özet ✅

- ✅ `meeting_summarize` tool: LLM ile kararlar / eylem maddeleri / süre özeti
- ✅ `meeting_list` / `meeting_export` tool'ları: .md dışa aktar

### 39.3 Eylem Maddeleri ✅

- ✅ `meeting_action_items` tool: toplantıdan eylem maddelerini çıkar

---

## Faz 40 — Bağlam-Duyarlı Otomatik Eylem 🖥️🤖 ✅

_AEGIS aktif pencereye bakarak ne yapman gerektiğini önerir veya otomatik yapar._

### 40.1 Aktif Uygulama Algılama ✅

- ✅ `get_active_context` tool: aktif pencere + bağlam tespiti (kod/tarayıcı/toplantı/oyun) + araç önerileri
- ✅ `context_rule_set` / `context_rule_list` tool'ları: kural tanımla

### 40.2 Akıllı Snippet Panosu ✅

- ✅ `clipboard_watch` tool: URL/kod/hata tespiti + akıllı öneriler
- ✅ `clipboard_history` / `clipboard_search` tool'ları: son 50 giriş geçmişi

---

## Faz 41 — Güçlü Yerel Arama 🔍 ✅

_Dosya sistemi + içerik + uygulama hızlı başlatıcı._

### 41.1 Dosya & İçerik Arama ✅

- ✅ `file_search` tool: Everything API (varsa) veya PowerShell recursive fallback
- ✅ `content_search` tool: klasör içinde tüm dosyalarda metin ara, satır numarasıyla döner, uzantı filtresi

### 41.2 Uygulama Hızlı Başlatıcı ✅

- ✅ `app_search` tool: Start Menu + PATH taraması, fuzzy matching ("chr" → Chrome)
- ✅ Son kullanılan uygulamalar önceliklendirilir (`app-launch-history.json`)

---

## Faz 42 — Gerçek Zamanlı Sistem Optimizasyonu ⚡🔧 ✅

_AEGIS yavaşlama olunca müdahale eder, kaynakları yönetir._

### 42.1 Akıllı Process Yönetimi ✅

- ✅ `kill_heavy_process` tool: en fazla kaynak tüketen prosesler + onaylı kapatma
- ✅ `suspend_process` / `resume_process` tool'ları (Idle/Normal öncelik)

### 42.2 Disk & Bellek Temizliği ✅

- ✅ `clear_temp` tool: %TEMP% temizleme + yer raporu
- ✅ `flush_dns` tool
- ✅ `startup_manager` tool: başlangıç uygulamalarını listele / devre dışı bırak

### 42.3 Performans Modu ✅

- ✅ `perf_mode_start` / `perf_mode_stop`: güç planı Yüksek Performans, arka plan Idle

---

## Faz 43 — Çoklu Oturum & Workspace 🗂️ ✅

_Proje bazlı izole çalışma alanları._

### 43.1 Workspace Sistemi ✅

- ✅ `workspace_create` / `workspace_switch` / `workspace_list` / `workspace_delete`
- ✅ Her workspace: kendi system prompt, model, çalışma dizini (`~/.aegis/workspaces/<name>/`)

### 43.2 Export/Import ✅

- ✅ `workspace_export` / `workspace_import` tool'ları: JSON olarak taşı

---

## Faz 44 — Yapay Zeka Tabanlı Günlük Rapor & Analitik 📊 ✅

_AEGIS günü, haftayı anlamlı özetlerle sunar._

### 44.1 Günlük & Haftalık Rapor ✅

- ✅ `daily_report` tool: araç kullanımı + zaman takibi + hedef ilerlemesi → `~/.aegis/reports/` .md olarak
- ✅ `weekly_report` tool: 7 günlük özet, görev dağılımı, araç istatistiği

### 44.2 Verimlilik Koçu ✅

- ✅ `productivity_insights` tool: alışkanlık + zaman + hedef verilerini birleştir → LLM kişisel öneriler

---

## Faz 45 — Sağlamlık & Test Altyapısı 🧪 ✅

_"10 saat açık bırakınca çöküyor mu?" sorusunun cevabı burada._

### 45.1 Bilinen Kırılganlıkların Düzeltilmesi ✅

**Memory Leak — interval/listener birikimi**

- ✅ `electron/main.ts`: `telemetryInterval` → `telIntervals[]` array'inde, `before-quit`'te `telIntervals.forEach(clearInterval)` + `stopScheduler()` — temiz
- ✅ `src/App.tsx`: tüm `ipcRenderer.on` çağrıları `window.jarvis.on()` wrapper'ı ile yapılıyor, `useEffect` cleanup'ında `off()` çağrısı var
- ✅ `electron/scheduler.ts`: `startScheduler` → `if (schedulerTimer) return;` koruması ile double-start engelleniyor

**Plugin yükle/sil 100x — dosya handle birikimi**

- ✅ `electron/plugins.ts`: `require.cache` temizleme mevcut, `fs.watch` / `chokidar` kullanılmıyor — handle birikimi riski yok

**500MB bilgi tabanı — RAM kontrolü**

- ✅ `electron/knowledge.ts`: `searchKnowledge` her chunk'ı ayrı `<id>.json` dosyasından okur (chunk-başına lazy load), tüm corpus belleğe alınmıyor

**10 ajan aynı anda — historyRef yarış koşulu**

- ✅ `electron/main.ts`: `runAgent(history, reqId, isSubAgent)` imzasına geçildi — `isSubAgent=true` ile çağrılan ajan callback / morning summary `sessionHistory` global state'ini ezmiyor

**Supabase çökünce — chat de çöküyor**

- ✅ `electron/db.ts`: `startSession`, `saveMessage`, `saveSessionSummary`, `saveNote`, `markNoteDone`, `setUserProfile` → tümü `try/catch` ile sarıldı, exception fırlatmıyor
- ✅ `electron/cloud-sync.ts`: `pullFromCloud` settings bozulma koruması — cloud veri type-guard ile doğrulanıyor
- ✅ `electron/auth.ts`: `getAccessToken` → `try/catch`, hata durumunda `null` dönüyor

---

### 45.2 Test Altyapısı Kurulumu ✅

- ✅ `vitest@^2.1.9` devDependency eklendi; `package.json`'a `"test": "vitest run"`, `"bench": "vitest bench"` scriptleri
- ✅ `vitest.config.ts` — electron mock alias, test/bench include pattern
- ✅ `tests/__mocks__/electron.ts` — Electron API mock'u (test ortamı için)
- ✅ `tests/tools/scheduler.test.ts` — 7 test (create/list/cancel/daily/double-start/invalid)
- ✅ `tests/tools/knowledge.test.ts` — 7 test (index/search/list/remove/missing-file)
- ✅ `tests/tools/workspace.test.ts` — 7 test (create/duplicate/list/switch/export-import/delete)
- ✅ `tests/integration/settings.test.ts` — 3 test (defaults/save-reload/merge)
- ✅ `tests/integration/supabase-offline.test.ts` — 6 test (offline graceful degradation)
- ✅ `tests/bench/knowledge.bench.ts` — benchmark (50KB indeks, `vitest bench` ile çalışır)
- ✅ **30/30 test geçiyor** (`npx vitest run` → 5 test dosyası, 30 test)

---

### 45.3 CI Pipeline ✅

- ✅ `.github/workflows/test.yml`: her PR + main push'unda `tsc --noEmit` (electron + renderer) + `npm test`
- ✅ Benchmark sadece `main` push'unda çalışır, sonuçlar artifact olarak upload edilir
- ✅ Test başarısız → CI job fail → merge engellenir

> **Güncel test durumu (v1.7.1):** 213 test / 15 dosya geçiyor. Faz 45'ten bu yana
> eklenenler: routines, model-capabilities, memory-plus, macros, automations,
> reference-resolver, smart-home, updater-logic, update-state birim testleri +
> konuşma harness'i (`tests/harness/`, 60 senaryo).

---

## Faz 46 — Spotify & Steam Built-in Kontrol 🎵🎮 ✅

_Plugin kurma gerektirmeden, direkt built-in tool olarak Spotify ve Steam kontrolü._

### 46.1 Spotify ✅

- ✅ `spotify_play` — müziği başlat / devam ettir (Spotify kapalıysa açar)
- ✅ `spotify_pause` — duraklat
- ✅ `spotify_next` / `spotify_prev` — parça atla / geri dön
- ✅ `spotify_volume` — ses seviyesi ayarla (0-100)
- ✅ `spotify_now_playing` — şu an ne çalıyor?
- ✅ `spotify_open` — Spotify'ı aç ve öne getir
- ✅ `spotify_search` — şarkı/sanatçı ara ve çal
- Yöntem: media key simülasyonu (WinAPI keybd_event) — Spotify Web API key gerekmez

### 46.2 Steam ✅

- ✅ `steam_launch` — oyun adı veya AppID ile oyun başlat (Steam kapalıysa açar)
- ✅ `steam_list` — bilgisayarda yüklü Steam oyunlarını listele (appmanifest\_\*.acf parse)
- ✅ `steam_open` — Steam'i aç ve öne getir
- ✅ `steam_close` — Steam'i kapat
- ✅ `steam_game_running` — şu an çalışan oyun var mı?
- Yöntem: `steam://rungameid/` URI protokolü + acf dosyalarından oyun listesi

---

## Faz 47 — Computer Use: AI ile Bilgisayar Kontrolü 🖥️🤖 ✅

_AI mouse ve klavyeyi kullanarak her uygulamayı direkt kontrol eder._

### 47.1 Temel Input Kontrolü ✅

- ✅ `mouse_move(x, y)` — fare imleci taşı
- ✅ `mouse_click(x, y, button, double)` — sol/sağ/orta, tek/çift tıklama
- ✅ `mouse_scroll(x, y, direction, amount)` — kaydır
- ✅ `mouse_drag(x1, y1, x2, y2)` — sürükle bırak
- ✅ `key_press(keys)` — klavye kısayolu (ctrl+c, alt+tab, win+d, f5 vb.)
- ✅ `type_text(text)` — aktif alana metin yaz (WScript.Shell SendKeys)
- ✅ `screen_size` — ekran çözünürlüğünü öğren
- Yöntem: WinAPI P/Invoke (Add-Type + user32.dll SendInput / SetCursorPos)

### 47.2 Vision Döngüsü ✅

- ✅ `computer_use(goal, max_steps)` — serbest dil hedefi → screenshot → AI analiz → eylem → tekrar
- ✅ AI her adımda JSON eylem döndürür: click/double_click/right_click/type/key/scroll/move/done/fail
- ✅ Maksimum 20 adım limiti; `done`/`fail` ile erken çıkış
- ✅ Her adım arası 600ms bekleme (UI güncellemesi için)
- Örnek: "Chrome aç ve youtube.com'a git", "Spotify'da arama yap"

---

## Faz 48 — Sağlamlık v2 & Hata Mesajları 🔧 ✅

_Her ağda, her PC'de çalışır. Hata olunca kullanıcı ne olduğunu anlar._

### 48.1 Fetch Timeout (Aşama A) ✅

- ✅ `electron/fetch-utils.ts` — `fetchWithTimeout` + `anySignal` + `isTimeoutError` + `TIMEOUT_MSG`
- ✅ Spotify (token exchange/refresh/API), weather, proxy, Anthropic, Gemini, Ollama, xAI, DeepSeek, OpenAI-compat, ElevenLabs, vision, model listing — tüm fetch çağrıları 8–90 saniye arasında timeout'a bağlandı
- ✅ Timeout anında "İstek zaman aşımına uğradı. Ağ bağlantını kontrol et" mesajı

### 48.2 Tool Hata İzolasyonu (Aşama B) ✅

- ✅ `Promise.all` → `Promise.allSettled` — bir tool patlasa diğerleri çalışmaya devam eder
- ✅ Başarısız tool "Araç hatası: …" mesajıyla modele bildirilir

### 48.3 Global Handler + Spotify FS (Aşama C & D) ✅

- ✅ `process.on('unhandledRejection')` + `uncaughtException` — sessiz crash'ler loglanır
- ✅ `saveToken` EACCES/ENOSPC durumlarında anlamlı hata yazar, crash etmez

### 48.4 Streaming Finally + Port Bildirimi (Aşama E & F) ✅

- ✅ `chat-stream` handler'ına `finally` eklendi — her koşulda `chat-done` gönderilir
- ✅ API server port çakışması → UI'da feed uyarısı (`feed-event`)

### 48.5 Diğer Düzeltmeler (Aşama G, H, I) ✅

- ✅ Windows sürümü `os.release()` ile dinamik (`build ≥ 22000 = Win11`, aksi = Win10)
- ✅ Min pencere boyutu 800×550 (küçük ekranlarda UI bozulmaz)
- ✅ Tüm `.catch(() => {})` → `.catch((e) => console.error(…))` — hata loglanır

### 48.6 Gelişmiş Hata Mesajları ✅

- ✅ `friendlyHttpError` — 400/401/403/404/413/422/429/5xx ayrı ayrı Türkçe, hangi servis hangisini verdi belli
- ✅ `friendlyGroqError` — timeout, rate limit, model geçersiz, ağ hatası ayrıştırılır
- ✅ Spotify hata mesajları — 401/403/404/429/5xx + Premium/kayıtlı değil özel mesajları
- ✅ `executeTool` bilinmeyen araç → anlamlı Türkçe hata (önceden boş dönerdi)
- ✅ Proxy timeout mesajı servis adıyla birlikte gösterilir

### 48.7 Güvenilirlik İyileştirmeleri ✅

- ✅ Groq 429 → 3s bekle, otomatik 1x retry
- ✅ Groq model listesi çekilemezse hardcoded fallback (6 bilinen model) gösterilir
- ✅ Proxy (trial mod) timeout 10s → 90s (SSE stream için yeterli süre)
- ✅ Spotify duplicate tool fix — `CORE_SCHEMAS`'dan çıkarıldı, sadece bağlama göre ekleniyor
- ✅ Sistem prompt'a yerel tarih/saat inject — "saat kaç?" soruları çalışır
- ✅ `spotify_open` sistem prompt kurallarına eklendi — AI artık `run_command` değil `spotify_open` kullanır

---

## Faz 49 — Onboarding Fix & Bun Geçişi ✅

_Kurulum ekranı düzeltmesi + paket yöneticisi modernizasyonu._

### 49.1 Onboarding Dil Seçimi Fix ✅

- ✅ `settings-set` IPC handler'ı `bootApp()` dışına taşındı — onboarding sırasında da erişilebilir
- ✅ Dil seçim düğmelerine tıklanınca adım ilerliyor, ayar kaydediliyor

### 49.2 Bun Paket Yöneticisi ✅

- ✅ `npm` → `bun` geçişi: `package-lock.json` → `bun.lock`
- ✅ CI workflow güncellendi (`oven-sh/setup-bun@v2`, `--frozen-lockfile`)
- ✅ Kurulum süresi ~45s → ~9s

---

## Faz 50 — AI Çekirdeği Yeniden Yazımı: Hafıza + Deterministik Yönlendirme 🧠⚡

_GPT analizi (2026-06-13): AEGIS şu an her mesajda sıfırdan başlıyor, tool sonuçlarını unutuyor, yönlendirme tutarsız, ve "bunu aç / onu kapat / tekrar yap" gibi referans komutları anlamıyor. Bunlar AEGIS'in "Jarvis hissi" vermesini engelleyen 4 temel sorun._

### 50.1 Short-Term Konuşma Hafızası (RAM) ✅

_Şu an: userMessage → LLM → tool seç → çalıştır → cevap (her seferinde bağlamsız)_
_Olması gereken: conversationMemory → userMessage → intent → tool → tool result → memory update → response_

- ✅ Son 20 işlem RAM'de tutuluyor (`electron/short-term-memory.ts`, `ToolMemoryEntry[]`, MAX_ENTRIES=20)
- ✅ Her tool çağrısı `{tool, args, result, success, ts, entity, source}` şeklinde kayıt (`stmRecord`)
- ✅ System prompt'a son 5 işlem özeti inject edilir (`stmBuildPromptBlock`)

### 50.2 Tool Sonucu Hafızaya Yazılıyor ✅

_Şu an: `spotify_open` çalıştı → sistem unutuyor → "onu kapat" deyince ne olduğunu bilmiyor_

- ✅ Her tool çalışınca `stmRecord` ile kayıt (`main.ts` runAgent döngüsü, hem LLM hem resolver yolu)
- ✅ `lastTool` / `lastTarget` / `lastSpotifyTrack` / `lastEntity` / `lastIntent` context değişkenleri güncellenir
- ✅ "tekrar yap" / "onu kapat" / "geri al" referans komutları bu context'ten çözülür (Faz 50.4)

### 50.3 Deterministik Tool Router ⬜ → Faz 55'e taşındı

_Bu maddenin asıl ölçülebilir hali Faz 55 (Tool-Seçim Eval Harness). Tool seçim
tutarsızlığı ("bi çalışıyor bi çalışmıyor") önce SKORLU ölçülmeli, sonra router/validate
katmanı buna göre tasarlanmalı. Aşağıdaki alt-maddeler hâlâ AÇIK iş:_

- [ ] JSON intent + schema validate + clarification katmanı (Faz 55 ölçümü üstüne)
- [ ] Tool adı geçersizse "anlamadım, şunu mu dedin: X?" netleştirme
- [ ] Belirsiz input → tool çağırmaz, önce sorar
- _(Referans ifadeleri için deterministik çözüm Faz 50.4'te ✅ — resolver zaten bunu yapıyor)_

### 50.4 Referans Çözümleme (Asıl Jarvis Hissi) ✅

_"bunu aç" / "onu kapat" / "tekrar yap" / "bir öncekini geri al" / "az önceki şarkıyı aç" / "sesi biraz artır" / "aynısını yap" — bunlar çalışmalı_

- ✅ `lastTool` / `lastSpotifyTrack` / `lastTarget` / `lastEntity` / `lastIntent` saklanır (STM'ye `entity` + `source` eklendi)
- ✅ `electron/reference-resolver.ts` — kural tabanlı, deterministik refleks (BEYİN değil): yalnız referans ifadelerini çözer, gerisi LLM'e düşer
- ✅ "onu/bunu kapat" → son tool'un grubuna göre kapatma (steam_close / spotify_pause)
- ✅ "biraz artır/azalt" → mevcut seviyeyi al, context-aware delta (biraz=±5, biraz daha=±10), 0-100 clamp
- ✅ "bir öncekini" → shortTermMemory[-2]'den resolve
- ✅ "aynısını yap" / "tekrar yap" → lastTool + lastArgs ile replay
- ✅ Confidence katmanı: belirsizse (<0.7) işlem yapmaz, netleştirme sorar
- ✅ Geliştirici "Açıklama Modu" (`explainMode`) + 16 birim testi + 5 konuşma senaryosu

---

## Faz 51 — Spotify Web API Tam Entegrasyon (96 Endpoint) ✅

_Mevcut 17 Spotify aracına ek olarak `example.claude/spotifyWebApi.json`'daki tüm anlamlı endpoint'ler AEGIS'e kazandırıldı. Toplam ~50 Spotify aracı._

### Eklenen Araçlar

**Player:** `spotify_seek`, `spotify_recently_played`, `spotify_get_queue`

**Albums:** `spotify_get_album`, `spotify_album_tracks`, `spotify_saved_albums`, `spotify_save_album`, `spotify_remove_album`

**Artists:** `spotify_get_artist`, `spotify_artist_top_tracks`, `spotify_artist_albums`, `spotify_related_artists`

**Tracks:** `spotify_get_track`, `spotify_audio_features`, `spotify_recommendations`

**Playlists:** `spotify_get_playlist`, `spotify_playlist_tracks`, `spotify_create_playlist`, `spotify_playlist_add`, `spotify_playlist_remove`, `spotify_featured_playlists`

**Library:** `spotify_saved_tracks`, `spotify_check_saved_tracks`, `spotify_saved_shows`, `spotify_saved_episodes`, `spotify_saved_audiobooks`

**User:** `spotify_me`, `spotify_top_items`

**Follow:** `spotify_follow_artist`, `spotify_unfollow_artist`, `spotify_followed_artists`

**Browse:** `spotify_new_releases`, `spotify_categories`

**Shows/Episodes/Audiobooks:** `spotify_get_show`, `spotify_show_episodes`, `spotify_get_episode`, `spotify_get_audiobook`

---

## Faz 52 — Routines (Deterministik Çok-Adımlı Aksiyon Kaydı) ✅

_Kullanıcı birden fazla aksiyonu tek isim altında kaydeder, sonra tek komutla tekrar çalıştırır.
Macro'dan farkı: macro doğal-dil komut METNİ kaydedip LLM'e geri yollar; routine TOOL
ÇAĞRILARINI ({tool, args}) yakalayıp doğrudan `executeTool` ile deterministik çalıştırır —
LLM'e geri dönmeden, Faz 50 felsefesine uygun "Jarvis hissi"._

- ✅ `electron/routines.ts` — kayıt durumu (RAM) + `routines.json` kalıcılığı; `Routine{id,name,steps,createdAt,updatedAt}`
- ✅ **Kayıt:** `routine_record_start` ("Kayıt başlat: Oyun Modu") → sonraki eylem tool'ları yakalanır → `routine_record_stop` ("Kayıt bitir") routine olarak saklar; `routine_record_cancel` kaydetmeden iptal eder
- ✅ **STM entegrasyonu:** `runAgent` tool döngüsünde `stmRecord`'un hemen yanında `routines.captureStep` çağrılır; sistem prompt'a "ROUTINE KAYDI AKTİF" notu inject edilir
- ✅ **Akıllı süzme:** yalnız durum değiştiren eylemler kaydedilir; salt-okuma (web_search, screenshot, list_*, get_*, *_now_playing) + meta tool'lar (routine_*/macro/agent) atlanır (`isRecordableTool`)
- ✅ **Çalıştır:** `routine_run` adımları sırayla deterministik uygular ("Oyun Modunu aç")
- ✅ **CRUD + düzenle:** `routine_list` / `routine_show` / `routine_delete` / `routine_rename` / `routine_delete_step`
- ✅ Aynı isimle yeniden kayıt → günceller (üzerine yazar); kısmi+case-insensitive isim eşleşmesi
- ✅ 18 birim testi (`tests/tools/routines.test.ts`); trio 325/325; tam build temiz
- Yeni provider/UI eklenmedi (built-in tool grubu; bağlam köklerine "routine/rutin/kayit/record/oyun modu" eklendi)

---

# ════════════════════════════════════════════════════════════
# GÜVENİLİRLİK SÜRÜMÜ — Faz 53–61 ✅ TAMAMLANDI
# ════════════════════════════════════════════════════════════

_Buraya kadar olan fazlar AEGIS'i "geniş" yaptı (330 tool). Aşağıdaki fazlar
AEGIS'i "derin" yapar: daha çok kullanılan değil, daha çok GÜVENİLEN bir asistan.
Hedef "ikinci ben" hissi — takıldığında durur, tehlikeli işte sorar, doğruluğunu
ölçer, görevi bitirir, seni hatırlar. **Durum: TAMAMLANDI** — Faz 53–61'in tamamı
(Loop Guard, İzin Kapısı, Eval Harness, Goal Executor, Adaptif Hafıza, Boundary Guard,
Self-Healing, Computer Use Doğrulama, Proaktif Öğrenme) bitti. Detaylı analiz: `docs/AEGIS-2.0-roadmap-gaps.md`._

**Eksik alan teşhisi:** Loop prevention 🔴 · Permission/Safety 🔴 · Recovery 🟡 ·
Goal execution 🟡 · Adaptive memory 🔴 · Self-healing 🔴 · Long-running tasks 🔴 ·
Skorlu evaluation 🟡. AEGIS'in eksiği yetenek değil — yeteneklerine GÜVEN.

---

## Faz 53 — Loop Guard & Eylem Bütçesi 🛑 ✅ [MUST HAVE]

_`main.ts`'teki 8-adım limiti degenerate döngüyü çözmez, sadece geç keser. Aynı
tool'u tekrar tekrar çağıran model token/para yakar + "AEGIS takıldı" hissi verir._

- ✅ Yeni `electron/loop-guard.ts` — saf `LoopGuard` sınıfı (Electron/IO bağımsız); `runAgent` her çağrıda kendi örneğini açar (paralel istek izolasyonu)
- ✅ **Aynı (tool,args) tekrarı:** anahtar-sırası bağımsız imza hash'i; 3. çağrı (`MAX_IDENTICAL`) engellenir
- ✅ **A-B-A-B ping-pong:** son 4 çağrılık pencerede tam-değişimli salınım 2. turda yakalanır
- ✅ **Polling tool'ları** (status/durum/get_/list_/check/ilerleme…) identical/ping-pong'tan muaf; yalnızca gevşek `POLL_BUDGET` (6) uygulanır
- ✅ Engellenen çağrı `executeTool`'a HİÇ gitmez → model'e açıklayıcı "ENGELLENDI (döngü koruması)" sonucu döner; tüm tur engellenirse bir toparlama turu sonrası temiz kapanış
- ✅ 10 birim testi (`tests/tools/loop-guard.test.ts`): identical eşiği, args sırası, ping-pong, poll muafiyeti/bütçesi, örnek izolasyonu — tüm başarı kriterleri kapsanıyor
- ✅ Doğrulama: electron+renderer tsc, trio 330/330, 386 test (26 dosya), vite build — hepsi yeşil
- **OpenJarvis ilhamı:** `agents/loop_guard.py` (max_identical_calls / ping_pong_window / poll_tool_budget) sadeleştirilerek port edildi

## Faz 54 — Yıkıcı Eylem İzin Kapısı 🔐 ✅ [MUST HAVE]

_`run_command` / `delete_file` / `kill_heavy_process` şu an SINIRSIZ. Model tek yanlış
argümanla geri dönülmez hasar verebilir. Güven = geri alınamaz eylemde durup sorma._

- ✅ Yeni `electron/permissions.ts` — saf risk sınıflandırma + kalıcı izin store
  - `classifyRisk(tool,args)`: `delete_file`/`move_file`/`kill_heavy_process`/`bulk_rename`/`clear_old_data`/`organize_folder`/`format_code` her zaman yıkıcı; `run_command` argümanı tehlikeliyse (Remove-Item, rm -rf, Stop-Process, taskkill, reg delete, Restart-Computer, Format…) yıkıcı; geri kalan **safe**
  - `~/.aegis/permissions.json` "her zaman izin ver" store (load/save/grant/revoke, in-memory cache); bozuk JSON → boş liste (çökmez)
- ✅ `main.ts` — guard'dan sonra, `executeTool` öncesi kapı: yıkıcı + kalıcı izin yok → native `dialog.showMessageBox` (İptal / İzin ver / Her zaman izin ver); varsayılan = İptal (güvenli)
  - "Her zaman izin ver" → `grantAlways`, bir daha sorulmaz; reddedilirse model'e "kullanıcı onayı reddedildi" sonucu döner
  - **Tam PC Erişimi** açıksa kapı sormaz (kullanıcı zaten tam yetki vermiş); sub-agent çağrılarında da sormaz (otomasyon kilitlenmesin)
  - 5 dilli system prompt güncellendi ("onay isteme" → "sistem otomatik onay gösterebilir, reddedilirse ısrar etme")
- ✅ 10 birim testi (`tests/tools/permissions.test.ts`): salt-okuma muafiyeti, sabit+komut yıkıcı sınıflandırma, kalıcı izin diske yazım/geri alma, duplicate yok, bozuk dosya
- ✅ Doğrulama: electron+renderer tsc, trio 330/330, 396 test (27 dosya), vite build — hepsi yeşil
- **OpenJarvis ilhamı:** `security/capabilities.py` risk-tier + always_approve/deny deseni sadeleştirilerek alındı (tam RBAC ALINMADI)

## Faz 55 — Tool-Seçim Eval Harness'ı (Skorlu) 🎯 ✅ [MUST HAVE]

_"Bi çalışıyor bi çalışmıyor" sorunu şu an GÖRÜNMEZ — convo harness smoke düzeyinde,
skor yok. Ölçemediğini düzeltemezsin. (Faz 50.3 "deterministik router"ın asıl işi budur.)_

- ✅ Yeni `tests/harness/eval-cases.mjs` — **40 etiketli vaka** (offer / resolver / negative); `tool-selection-eval.mjs` runner skorlar
- ✅ Skor: her çalıştırmada **tool-seçim doğruluk %'si** + tür bazında kırılım; `EVAL_THRESHOLD` (varsayılan %90) altına düşerse **exit 1** (CI uyarısı); `eval-report.json` üretir
- ✅ Üç vaka türü: `offer` (tool teklif edilmeli), `resolver` (deterministik resolver tam tool+args üretmeli), `negative` (saf sohbette tool seçilmemeli — yanlış-pozitif yakalar)
- ✅ `npm run test:eval` script'i; mevcut convo harness (105 senaryo) regresyon kalkanı olarak korundu
- ✅ **Eval gerçek açıkları yakaladı ve kapattım** (doğruluk %82.5 → **%100**):
  - Eksik kökler eklendi: `system_report` ("cpu/ram/bellek/kullanım"), `weather_station` ("hava/sıcaklık/nem"), `email_send` ("posta/gmail")
  - 64-limit kırpması düzeltildi: `priorityCore` (set_volume/set_brightness — temel tool'lar kırpılmaz) + `remind_in` scheduler grubuna, `fetch_url` knowledge grubuna eklendi (grup başında → kırpılmaz)
- ✅ 8 birim testi (`tests/tools/tool-selection.test.ts` Faz 55 bloğu — açık düzeltmeleri kilitler, 64-limit + büyük domain korunur) + 7 vaka-bütünlük testi (`tests/harness/eval-cases.test.ts`)
- ✅ Doğrulama: electron+renderer tsc, trio 330/330, 411 test (28 dosya), eval %100, convo 105/0, vite build — hepsi yeşil
- **OpenJarvis ilhamı:** `agentic_runner.py` + `scorer.py` mini çekirdeği (girdi→beklenen→skor); 37k satırlık framework + enerji/FLOP metrikleri ALINMADI

## Faz 56 — Goal Executor: Plan → Adım → Doğrula → Toparla 🧩 ✅ [SHOULD HAVE]

_`agent_run` şu an "8 adım dene, olmazsa pes". Plan yok, ara-doğrulama yok, takılınca
toparlama yok. "İkinci ben" = ben olsam bitirirdim; şu an bitiremiyor._

- ✅ Yeni `electron/goal-executor.ts` — saf çekirdek (Electron/IO bağımsız):
  - `classifyError(result)` — tool sonucunu hata TAKSONOMİSİNE atar: ok / transient (yeniden dene) / permission / not_found / invalid_args / blocked / fatal; her birine retriable + Türkçe yönlendirme
  - `verifyStep(result)` — adım doğrulama: progress / retry / stuck / fail kararı
  - `buildPlanPrompt(goal, maxSteps)` — hedefi "planla → yap → doğrula → takılınca dur" promptuna çevirir (sonsuz deneme yasak)
- ✅ `main.ts` entegrasyonu: `agent_run` artık plan-temelli prompt kullanır; `runAgent` döngüsünde her tool sonucu `classifyError`'dan geçer →
  - STM `success` artık doğru hesaplanır (önceden her zaman `true` idi — sessiz bug düzeltildi)
  - yeniden-denenmemesi gereken hatalarda (not_found/invalid_args/permission) modele `[YÖNLENDİRME: …]` eklenir → kör tekrar önlenir (Faz 53 loop-guard'ı tamamlar)
- ✅ 13 birim testi (`tests/tools/goal-executor.test.ts`): tüm taksonomi sınıfları, öncelik sırası, verifyStep kararları, plan prompt
- ✅ Doğrulama: electron+renderer tsc, trio 330/330, 424 test (29 dosya), eval %100, convo 105/0, vite build — hepsi yeşil
- **OpenJarvis ilhamı:** `agents/executor.py` error taxonomy sadeleştirilerek alındı; meta-planner ALINMADI

## Faz 57 — Adaptif Hafıza: Semantik + Otomatik Çıkarım 🧠 ✅ [SHOULD HAVE]

_`facts.json` düz-JSON + keyword. AEGIS kullanıcıyı kaydediyor ama ÖĞRENMİYOR.
"İkinci ben" için en kritik eksen._

- ✅ Yeni `electron/adaptive-memory.ts` — saf çekirdek (Electron/IO bağımsız), `memory-plus.ts`'e bağlandı:
  - `searchFacts` — token-overlap (Jaccard-benzeri) semantik arama; **embedding YOK**, yerel sıfır-bağımlılık keyword (ROADMAP "graceful keyword" kriteri); embedding eklenirse buraya takılır
  - `inferFacts` — konuşmadan otomatik çıkarım (isim / kullanılan dil / sevme-sevmeme; TR+EN); komut/geçici cümlelerden çıkarmaz
  - `reconcileFact` + `subjectOf` — çelişki çözme: aynı özneli yeni gerçek ESKİYİ günceller (kopya değil); girdi + kayıtlı çıktı kalıplarını tanır
- ✅ `memory-plus.ts`: `searchMemory` (→ `search_memory` tool'u, trio 331), `addFactReconciled` (çelişki-çözer `remember_fact`), `autoLearnFromMessage`
- ✅ `main.ts`: `runAgent` her ana-akış turunda son kullanıcı mesajından **sessizce öğrenir** (autoLearn) → AEGIS konuşurken hatırlamaya başlar
- ✅ "Geçen ay X hakkında ne demiştim?" çalışır; otomatik çıkarım çelişkide eskiyi günceller; embedding yoksa keyword fallback — üç başarı kriteri de karşılandı
- ✅ 15 + 5 birim/I/O testi (`tests/tools/adaptive-memory.test.ts`, `memory-plus.test.ts` Faz 57 bloğu)
- ✅ Doğrulama: electron+renderer tsc, trio 331/331, 444 test (31 dosya), eval %100, convo 105/0, vite build — hepsi yeşil
- **OpenJarvis ilhamı:** `embedding_store.py` + `hybrid_search.py` ruhu (semantik arama soyutlaması); SQLite consolidation/decay ALINMADI; **yeni provider eklenmedi**

## Faz 58 — Boundary Guard: Dışarı Sızıntı Koruması 🛡️ ✅ [SHOULD HAVE]

_Tool sonuçları + dosya içeriği cloud LLM'e (trial'da senin proxy'inden) gidiyor.
Bir `.env` okutup özetletmek = anahtarın log'a düşmesi. Bir sızıntı = kalıcı güven kaybı._

- ✅ Yeni `electron/boundary-guard.ts` — saf redaksiyon (Electron/IO bağımsız):
  - 14 sır deseni: AWS (AKIA + secret), OpenAI/Anthropic `sk-`, Google `AIza`, GitHub `ghp_`, Slack `xox`, Stripe, JWT, Bearer, private key blokları, `password=`/`parola=`, prefix'li `*_API_KEY`/`*_TOKEN`/`*_SECRET`
  - `redactSecrets` (string), `redactContent` (parça dizisi — text maskelenir, görüntü dokunulmaz), `redactMessages` (mesaj dizisi)
  - `hasSecret` maske-farkında → redaksiyon **idempotent**; sırsız metin AYNI referansla döner (perf)
- ✅ `ai-client.ts`: `callAI` giden mesajları dönüşüm zincirinin başında redakte eder; **Ollama hariç** (içerik yerelden çıkmıyor) — cloud + deneme-modu proxy korunur
- ✅ Normal metni bozmaz (kod örnekleri, "monkey/turkey/token" gibi kelimeler maskelenmez); birim testle kanıtlı
- ✅ 23 birim testi (`tests/tools/boundary-guard.test.ts`): tüm sır türleri, normal-metin korunması, parça/mesaj redaksiyonu, idempotentlik
- ✅ Doğrulama: electron+renderer tsc, trio 331/331, 467 test (32 dosya), eval %100, convo 105/0, vite build — hepsi yeşil
- **OpenJarvis ilhamı:** `boundary.py` redact modu + `credential_stripper.py` sadeleştirilerek alındı; taint/SSRF/signing ALINMADI

## Faz 59 — Self-Healing: Tekrarlayan Hata Tanıma 🔁 ✅ [NICE TO HAVE]

- ✅ Yeni `electron/self-healing.ts` — saf `diagnose(recent, threshold=3)` (Electron/IO bağımsız):
  - STM geçmişinde (tool-AİLESİ + hata-SINIFI) örüntüsünü çıkarır → aynı domain (ör. "spotify") farklı argümanlarla da olsa 3+ kez aynı tür hatayla düşüyorsa yakalar (loop-guard'ın AYNI-çağrı tekrarından farkı: aynı KÖK SEBEP)
  - Faz 56 `classifyError` ile hata sınıfını paylaşır; her sınıfa eyleme dönük, domain-duyarlı teşhis ("Spotify yetki/Premium…", "hedef bulunamıyor, adı doğrula…")
- ✅ `main.ts`: tool turundan sonra örüntü tespit edilirse modele `[ÖZ-İYİLEŞME TEŞHİSİ]` system mesajı **bir kez** enjekte edilir → kör tekrar yerine yön değişir
- ✅ 8 birim testi (`tests/tools/self-healing.test.ts`): eşik, sınıf ayrımı, domain izolasyonu, başarı kirletmemesi, parametrik eşik, tekil tool
- ✅ Doğrulama: electron+renderer tsc, trio 331/331, 475 test (33 dosya), eval %100, convo 105/0, vite build — hepsi yeşil
- **OpenJarvis ilhamı:** `agents/errors.py` classify_error taksonomisi; trace-mining ALINMADI

## Faz 60 — Computer Use Doğrulama Döngüsü 👁️🔁 ✅ [NICE TO HAVE]

- ✅ Yeni `electron/action-verifier.ts` — saf doğrulama çekirdeği (Electron/IO bağımsız):
  - `frameSignature` (parça-bazlı hafif imza — kısmi değişimi de yakalar) + `signatureDiff` ([0..1] normalize fark)
  - `verifyChange(before, after)` — eşik altı fark = "tıklama ıskalamış olabilir" uyarısı; screenshot alınamazsa güvenli rapor
  - `actWithVerification(snapshot, doAction)` — kare-al → eylem → kare-al → karşılaştır akışı (snapshot hatasında çökmez)
- ✅ `tools.ts`: `mouse_click` artık `verify="true"` parametresini destekler → tıkla, ekran değişti mi doğrula, sonuca `[DOĞRULAMA]` notu ekle (kör tıklama kontrolü); şema güncellendi (trio 331)
- ✅ Eylem sonrası beklenen değişiklik olmazsa AEGIS fark eder ve modele bildirir → başarı kriteri karşılandı
- ✅ 10 birim testi (`tests/tools/action-verifier.test.ts`): imza/fark, değişim tespiti, ıska uyarısı, boş-kare güvenliği, akış sırası
- ✅ Doğrulama: electron+renderer tsc, trio 331/331, 485 test (34 dosya), eval %100, convo 105/0, vite build — hepsi yeşil
- **OpenJarvis ilhamı:** `browser_axtree.py` (koordinat yerine doğrulama) ruhu; tam UIAutomation element-tree opsiyonel/sonraya bırakıldı

## Faz 61 — Proaktif Örüntü Öğrenme (Opt-in) 🌅 ✅ [NICE TO HAVE]

_"İkinci ben"in tacı proaktifliktir — ama güven tabanı kurulmadan ters teper. Bu yüzden EN SON ve opt-in._

- ✅ Yeni `electron/proactive.ts` — saf örüntü çıkarımı (Electron/IO bağımsız):
  - `detectPatterns(records)` — zaman-damgalı kullanımları (tool + saat-bandı) gruplar; "gerçek alışkanlık" eşiği: ≥2 AYRI gün + ≥3 tekrar (tek-seferlik tesadüf elenir); 3 saatlik bant + sabah/öğle/akşam/gece etiketi
  - `buildProactiveSuggestion(records, enabled)` — **opt-in**: `enabled=false` (varsayılan) → `null` (spam yok)
- ✅ `memory-plus.ts`: `recordToolUsage` artık zaman-damgalı `usage-log.json` da tutar (son 500); `getProactivePatterns` / `getProactiveSuggestion`
- ✅ `settings.ts`: `proactiveSuggestions` bayrağı (varsayılan **KAPALI**); `main.ts`: sabah özetine açıksa örüntü önerisi eklenir (model "otomatikleştirmek ister misin?" diye SORAR, zorlamaz — Faz 54 izin kapısıyla uyumlu, öneri ≠ otomatik eylem)
- ✅ UI: Ayarlar → Görünüm → Uygulama'da "Proaktif öneriler" toggle (5 dilli) → **kapatılabilir**
- ✅ Başarı kriterleri: ≥2 gün+ tekrar örüntüsü tespit edilir; opt-in; kapatılabilir; eşikler spam'i önler — hepsi karşılandı
- ✅ 9 + 3 birim/I/O testi (`tests/tools/proactive.test.ts`, `memory-plus.test.ts` Faz 61 bloğu)
- ✅ Doğrulama: electron+renderer tsc, trio 331/331, 497 test (36 dosya), eval %100, convo 105/0, vite build — hepsi yeşil
- **OpenJarvis ilhamı:** `proactive_agent.py` cron + tier'lı öneri ruhu; digest_collect/connector ağı ALINMADI

---

## Faz 62 — Akıllı Ev Kontrolü (Home Assistant) 🏠💡 ✅

_Jarvis fiziksel evi yönetsin: ışık, priz, kilit, termostat, panjur, sahne.
Faz 18.3'teki düşük seviye HA plugin'i (entity/servis çağrısı) yerine, yerleşik ve
akıllı bir katman: doğal dil hedefini cihazlara çözer, kritik cihazlarda onay ister._

### 62.1 Home Assistant bağlantısı ✅

- ✅ `electron/smart-home.ts` — HA REST API (`/api/states`, `/api/services/...`); tek HA
  sunucusu arkasındaki tüm markaları (Hue/Tapo/Tuya/Matter/Zigbee) tek API'den yönetir
- ✅ Kimlik: `AegisConfig.homeAssistantUrl` + `homeAssistantToken` (Ayarlar → API Keys);
  `applyConfig` ile `HOME_ASSISTANT_URL/TOKEN` env'e yansır, executor anında okur
- ✅ Bağlantı testi + anlamlı hata mesajları (401 token, ulaşılamadı, kurulu değil)

### 62.2 Akıllı doğal-dil katmanı ✅

- ✅ `resolveEntities`: "salonu karart", "her şeyi kapat", "yatak odasını %30 yap" →
  entity çözümleme; oda adı o odadaki tüm ışıkları kapsar; ışık varsa ışıkları önceler
- ✅ TR + EN + DE/FR/ES normalize (aksan→ASCII); toplu kapsam ("tüm ışıklar", "her şey")
- ✅ 4 tool: `smart_home_devices` (oda bazlı liste+durum), `smart_home_status`,
  `smart_home_control` (on/off/toggle/brightness/temperature/lock/cover), `smart_home_scene`
- ✅ TOOL_GROUP kökleri (ışık/priz/kilit/termostat/oda adları, 4 dil) — Faz 50 router ile uyumlu

### 62.3 Kritik cihaz onay kapısı ✅

- ✅ `isCriticalEntity`: kilit/garaj/termostat/su ısıtıcı domain'leri + isim ipuçlu prizler
  (ısıtıcı/soba/pompa) kritik sayılır
- ✅ Işık/sahne gibi zararsız eylemler direkt çalışır; kritik cihaz komutunda `confirm:"true"`
  yoksa AEGIS durup onay ister (Faz 54 izin kapısının küçük öncülü)
- ✅ Birim testleri (`tests/smart-home.test.ts`, 14 test): çözümleme + onay + durum özeti
- ✅ Trio validator template-literal kör noktası da düzeltildi (`scripts/validate-tools.mjs`)

---

## Faz 63 — Domain UI Bileşenleri (Widget / Popup / Modal) 🎨🧩 ✅

> **Altyapı:** Genel `window.jarvis.runTool(name, args)` IPC'si (`main.ts` `run-tool` handler +
> `preload.ts` + `electron.d.ts`) → tüm domain UI'ları canlı veriyi tek köprüden çeker.
> **Sonuç:** 4 canlı widget (Spotify + Steam + Pomodoro + Akıllı Ev) sol panelde · 1 Hafıza modal'ı ·
> 1 sekmeli Komut Merkezi (6 sekme: Görevler/Bilgi/Otomasyon/Öğrenme/Kişilik/Pluginler). 11/14 madde
> yapıldı; 3 isteğe-bağlı (63.12–63.14) bilinçle ertelendi (risk/değer veya dep gerekçesiyle).

_Bugün yalnız **Spotify**'ın sol panelde canlı, interaktif bir widget'ı var (`SpotifyWidget.tsx`:
tool çıktısını parse edip kart + kaydırıcı + butona çevirir). Diğer onlarca tool grubu yalnız
metin döndürüyor — görsel yüzü yok. Bu faz, durumu/etkileşimi görsel sunmaya DEĞEN domain'lere
Spotify kalitesinde UI verir. Üç tip: **Widget** (sol panel, canlı poll), **Modal** (tıkla-aç,
liste/grid), **Popup/Toast** (anlık, küçük)._

**Tasarım ilkeleri:** her bileşen mevcut tool çıktısını parse eder (yeni IPC gerekmezse eklenmez),
skin-agnostik (`var(--hud)`/`--accent` kullanır), SVG line-icon (emoji yok), 5 dilli. Bir bileşen
bittiğinde dur–göster–onay. Sıra: önce yüksek-değer widget'lar.

### 🥇 Yüksek değer — Canlı WIDGET (sol panel)

- **63.1 Sistem Telemetri widget'ı** ✅ (mevcut) — HologramSkin'in sol panelinde zaten zengin
  canlı telemetri var (CpuRow/RamRow/DiskRows/GpuRow/fan/ağ); ayrı bir widget'a gerek yok
- **63.2 Steam / Çalışan Oyun widget'ı** ✅ — `SteamWidget.tsx`: çalışan oyun(lar)ı canlı gösterir
  (8sn poll, `steam_game_running` çıktısını parse eder), hover'da "oyunu kapat" butonu
  (`steam_close_game`); oyun yokken render etmez. Sol panele Spotify yanına eklendi
- **63.3 Akıllı Ev widget'ı** ✅ — `SmartHomeWidget.tsx`: cihaz sayısı + açık ışık sayısı,
  "Tümünü Aç/Kapat" hızlı butonları (`smart_home_devices`/`smart_home_control`, 10sn poll);
  Home Assistant yapılandırılmamışsa render etmez
- **63.4 Zaman & Pomodoro widget'ı** ✅ — `PomodoroWidget.tsx`: canlı geri sayım (saniye saniye,
  15sn sunucu senkronu) + faz (odaklanma/mola) + durdur butonu; yeni `pomodoro_status` tool'u
  (makine-okunur "PHASE|kalanSaniye|oturum"); aktif pomodoro yoksa render etmez
- **63.5 Görevler & Hatırlatıcılar** ✅ — Komut Merkezi panelinde "GÖREVLER" sekmesi
  (`list_scheduled_tasks` + `list_watch_conditions`, satırdan iptal `cancel_scheduled_task`)

### 🥈 Orta değer — POPUP / MODAL (tıkla-aç)

- **63.6 Hafıza & Gerçekler modal'ı** ✅ — `MemoryModal.tsx`: öğrenilen gerçekleri listeler
  (`list_facts`), anlamca arama kutusu (`search_memory` — Faz 57), gerçek silme (`forget_fact`);
  title bar'da beyin ikonu butonu + Esc ile kapanır; 5 dilli ipucu (`tipMemory`)
> **63.7–63.11 → tek `DomainPanel.tsx` (Komut Merkezi):** sekmeli modal, title bar'da
> ızgara ikonu butonu (5 dilli `tipCommandCenter`). Her sekme `runTool` ile veri çeker,
> ham metin yerine okunur bloklar gösterir (kırılgan parse yok). Esc ile kapanır.

- **63.7 Bilgi Tabanı / RAG** ✅ — "BİLGİ" sekmesi: `list_indexed_files` + `search_knowledge` arama kutusu
- **63.8 Öğrenme** ✅ — "ÖĞRENME" sekmesi: `goal_list` (hedefler) + `reading_list` (okuma)
- **63.9 Plugin Marketplace** ✅ — "PLUGİNLER" sekmesi: `list_plugins` + `plugin_search` arama
- **63.10 Otomasyon / Makro / Routine** ✅ — "OTOMASYON" sekmesi: `list_automations` + `list_macros` + `routine_list`
- **63.11 Persona** ✅ — "KİŞİLİK" sekmesi: `get_persona` (aktif) + `list_personas` (mevcutlar)

### 🥉 İsteğe bağlı — küçük POPUP / inline (bilinçle ERTELENDİ)

- **63.12 Yıkıcı eylem onay toast'ı** ⏸️ — Faz 54 native `dialog` zaten çalışıyor ve güvenli
  (modal, varsayılan İptal). Feed-içi toast'a çevirmek onay akışını renderer'a taşır → risk/değer kötü; ertelendi
- **63.13 Proaktif öneri kartı** ⏸️ — Faz 61 önerisi şu an sabah özeti promptuna gidiyor (model doğal dille sorar);
  ayrı inline kart App akışına dokunur, marjinal değer; ertelendi
- **63.14 Gerçek grafik modal'ı** ⏸️ — `create_chart` ASCII feed'de gösteriliyor; canvas grafik yeni
  bağımlılık ister ("yeni provider/dep ekleme" ruhuna aykırı); ertelendi

**UI'ı mantıklı OLMAYANLAR (bilinçle dışarıda):** network (ping/ssh/docker), email, medya-dönüştürme,
code-runner, computer-use, agent, sound, security-vault (zaten gizli kalmalı) — bunlar tek-atış komut,
canlı durum/etkileşim yüzü gereksiz.

---

## ⚠️ OpenJarvis'ten KOPYALANMAYACAKLAR (overengineered / ürün için anlamsız)

LoRA/GRPO/SFT learning pipeline · 37k satır eval framework'ün tamamı · tam RBAC
capability · Docker/WASM sandbox · A2A + multi-agent orchestration + harici agent
runner'ları · litellm'e geçiş (mevcut elle provider katmanı daha iyi + "yeni provider
ekleme" kuralıyla çelişir) · SSRF/taint/signing · çok-kanal bridge (whatsapp/imessage)
· meta-planner (kendi config'ini yeniden yazan).

---

## Öncelik Sırası

```
✅  Faz 1    Hafıza & bağlam              ← TAMAMLANDI
✅  Faz 2    Ayarlar & model seçimi       ← TAMAMLANDI
✅  Faz 3    UI temaları & skinler        ← TAMAMLANDI
✅  Faz 4    Dil desteği                  ← TAMAMLANDI
✅  Faz 5    Görme & ekran                ← TAMAMLANDI
✅  Faz 6    Sistem kontrolü              ← TAMAMLANDI
✅  Faz 7    Web & iletişim               ← TAMAMLANDI
✅  Faz 8.1  Sözünü kesme                 ← TAMAMLANDI
✅  Faz 8.2  Chat geçmişi UI              ← TAMAMLANDI
✅  Faz 8.3  Command palette              ← TAMAMLANDI
✅  Faz 9    Plugin sistemi               ← TAMAMLANDI
✅  Faz 9.2  Hazır plugin'ler             ← TAMAMLANDI (Spotify/VSCode/Steam/OBS)
✅  Faz 10   Arka plan servisi & bildirim ← TAMAMLANDI
✅  Faz 11   Performans & streaming       ← TAMAMLANDI
✅  Faz 12   Ajans modu & otomasyon       ← TAMAMLANDI
✅  Faz 13   Bilgi tabanı & RAG           ← TAMAMLANDI
✅  Faz 14   Telefon & mobil köprüsü      ← TAMAMLANDI
✅  Faz 15   Web arayüzü                  ← TAMAMLANDI
✅  Faz 16   Gelişmiş hafıza              ← TAMAMLANDI
✅  Faz 17   Güvenlik & gizlilik          ← TAMAMLANDI
✅  Faz 18   Gelişmiş plugin ekosistemi   ← TAMAMLANDI
✅  Faz 19   Ses & müzik üretimi          ← TAMAMLANDI
✅  Faz 20   Kod asistanı & geliştirici   ← TAMAMLANDI
✅  Faz 21   Takvim & zaman yönetimi      ← TAMAMLANDI
✅  Faz 22   Dosya & medya yönetimi       ← TAMAMLANDI
✅  Faz 23   Yapay zeka kişiliği & rol    ← TAMAMLANDI
✅  Faz 24   Ağ & sunucu yönetimi         ← TAMAMLANDI
✅  Faz 25   Gelişmiş görselleştirme      ← TAMAMLANDI
✅  Faz 26   E-posta & iletişim           ← TAMAMLANDI
✅  Faz 27   Öğrenme & kişisel gelişim    ← TAMAMLANDI
✅  Faz 28   Fiziksel dünya & IoT         ← TAMAMLANDI
✅  Faz 29   Çoklu model orkestrasyonu    ← TAMAMLANDI
✅  Faz 30   Dağıtım: deneme modu + auth  ← TAMAMLANDI (30.8 imzalı build ertelendi)
✅  Faz 31   Model-özel revizyon          ← TAMAMLANDI
✅  Faz 32   Renk/zemin palet presetleri  ← TAMAMLANDI
✅  Faz 33   Skin aileleri (mimari)       ← TAMAMLANDI
✅  Faz 34   Benzersiz UI aileleri        ← TAMAMLANDI (34.2 widget'lar opsiyonel/sonra)
✅  Faz 35   Gerçek zamanlı sesli çeviri  ← TAMAMLANDI
✅  Faz 36   Akıllı bildirim filtresi     ← TAMAMLANDI
✅  Faz 37   Kod derleyici & test koşucusu ← TAMAMLANDI
✅  Faz 38   Canlı haber & fiyat takibi   ← TAMAMLANDI
✅  Faz 39   Sesli toplantı asistanı      ← TAMAMLANDI
✅  Faz 40   Bağlam-duyarlı otomatik eylem ← TAMAMLANDI
✅  Faz 41   Güçlü yerel arama            ← TAMAMLANDI
✅  Faz 42   Sistem optimizasyonu         ← TAMAMLANDI
✅  Faz 43   Workspace sistemi            ← TAMAMLANDI
✅  Faz 44   Günlük rapor & analitik      ← TAMAMLANDI
🔶  i18n Ö2  Ayarlar paneli ~200 metin   ← DEVAM EDİYOR
✅  Faz 45   Sağlamlık & Test Altyapısı   ← TAMAMLANDI
✅  Faz 46   Spotify & Steam built-in     ← TAMAMLANDI
✅  Faz 47   Computer Use (mouse/kb AI)   ← TAMAMLANDI
✅  Faz 48   Sağlamlık v2 & Hata Mesajları ← TAMAMLANDI
✅  Faz 49   Onboarding fix & Bun geçişi  ← TAMAMLANDI
✅  Faz 50   AI çekirdeği: hafıza + deterministik router  ← TAMAMLANDI
✅  Faz 51   Spotify Web API tam entegrasyon (96 endpoint) ← TAMAMLANDI
✅  Faz 52   Routines (deterministik çok-adımlı aksiyon kaydı) ← TAMAMLANDI
✅  Faz 62   Akıllı ev kontrolü (Home Assistant)  ← TAMAMLANDI

──────────  GÜVENİLİRLİK SÜRÜMÜ — Faz 53–61 ✅ TAMAMLANDI  ──────────
✅  Faz 53   Loop Guard & eylem bütçesi        ← MUST · etki 9/zorluk 3  ← TAMAMLANDI
✅  Faz 54   Yıkıcı eylem izin kapısı          ← MUST · etki 9/zorluk 5  ← TAMAMLANDI
✅  Faz 55   Tool-seçim eval harness (skorlu)  ← MUST · etki 8/zorluk 4  ← TAMAMLANDI
✅  Faz 56   Goal executor (plan/doğrula)      ← SHOULD · etki 8/zorluk 6  ← TAMAMLANDI
✅  Faz 57   Adaptif hafıza (semantik)         ← SHOULD · etki 8/zorluk 6  ← TAMAMLANDI
✅  Faz 58   Boundary guard (sızıntı koruması) ← SHOULD · etki 7/zorluk 4  ← TAMAMLANDI
✅  Faz 59   Self-healing (hata örüntüsü)      ← NICE · etki 6/zorluk 5  ← TAMAMLANDI
✅  Faz 60   Computer use doğrulama döngüsü    ← NICE · etki 6/zorluk 7  ← TAMAMLANDI
✅  Faz 61   Proaktif örüntü öğrenme (opt-in)  ← NICE · etki 6/zorluk 6  ← TAMAMLANDI

──────────  UI GENİŞLEME  ──────────
✅  Faz 63   Domain UI bileşenleri (widget/popup/modal)  ← 4 widget + Hafıza modal + 6-sekmeli Komut Merkezi (11/14; 3 ertelendi)
```
