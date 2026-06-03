# AEGIS — Roadmap

> Kişisel AI asistan. Dinler, düşünür, yapar.

---

## Mevcut Durum ✓

| Özellik | Durum |
|---|---|
| Groq LLM (qwen3-32b) + tool calling | ✅ |
| PowerShell komut çalıştırma | ✅ |
| Dosya okuma / yazma / listeleme | ✅ |
| Web arama (Tavily) | ✅ |
| Ses tanıma — Whisper, Türkçe | ✅ |
| TTS — Edge EmelNeural | ✅ |
| Wake-word / always-on mod | ✅ |
| Sistem telemetri (CPU/RAM/disk/batarya/ağ) | ✅ |
| Hava durumu | ✅ |
| Supabase entegrasyonu (session + mesaj kaydı) | ✅ |

---

## Faz 1 — Hafıza & Bağlam 🧠
*Temel. Bunlar olmadan AEGIS her gün sıfırdan başlıyor.*

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
*Kullanıcının AEGIS'i kendine göre ayarlayabilmesi.*

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
*Görsel kimlik. Herkes farklı bir AEGIS ister.*

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
*AEGIS dil bilmez, kullanıcı dil seçer.*

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
*AEGIS ekranı okuyunca çok daha güçlü hale gelir.*

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
*Günlük kullanımda en çok işe yarayan şeyler.*

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

### 7.3 Email & Takvim *(opsiyonel)*
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
*Uzun vadeli genişleme katmanı.*

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
*AEGIS kapalıyken bile çalışsın.*

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
*Her token hissedilsin, her re-render önlensin.*

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
*AEGIS sadece yanıtlamakla kalmaz, görevleri başından sonuna tamamlar.*

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
*AEGIS kendi belgelerin üzerinde akıl yürütebilsin.*

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
*AEGIS masaüstü ile telefonun arasındaki köprü olsun.*

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
*AEGIS'e başka cihazdan tarayıcıdan da erişilebilsin.*

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
*Faz 1'in üzerine derin öğrenme katmanı.*

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
*AEGIS'in verilerini güvende tut.*

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
*Faz 9'un üzerine marketplace katmanı.*

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
*AEGIS sadece dinlemez, üretir de.*

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
*AEGIS bir programcının en iyi yardımcısı olsun.*

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
*AEGIS zamanı planlar, seni hatırlatır.*

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
*AEGIS dosyaları anlar, düzenler, dönüştürür.*

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
*AEGIS farklı modlarda çalışsın — asistan, koç, arkadaş.*

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
*AEGIS ağı izler ve sunucu işlerini halleder.*

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
*AEGIS verileri görsel olarak sunsun.*

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
*AEGIS mesajları okur, yazar ve düzenler.*

### 26.1 SMTP / IMAP E-posta ✅
- ✅ `email_send` tool: PowerShell Send-MailMessage ile SMTP e-posta gönder
- ✅ `email_fetch` tool: IMAP / Outlook COM ile gelen kutusu oku
- ✅ `email_setup_smtp` tool: SMTP/IMAP profili kaydet (`~/.aegis/email-profiles.json`)
- ✅ Şifreler vault ile güvenli saklanır

### 26.2 E-posta Özetleme & Taslak ✅
- ✅ `email_draft` tool: niyet + alıcı + ton ile profesyonel e-posta taslağı oluştur
- ✅ Dil (TR/EN) ve ton (formal/friendly/assertive) desteği

### 26.3 Slack & Teams *(mevcut Discord plugin)*
- ✅ Discord webhook ile kanal mesajı gönderme (Faz 18 eklendi)
- Slack/Teams: webhook URL ile `run_command` üzerinden SendGrid/curl ile gönderilebilir

---

## Faz 27 — Öğrenme & Kişisel Gelişim 📚 ✅
*AEGIS öğrenmeyi takip eder ve destekler.*

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
*AEGIS fiziksel dünyaya uzanır.*

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
*AEGIS tek model değil, model orkestrasyonu olsun.*

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
*AEGIS son kullanıcıya dağıtılabilir olsun. İki giriş: "Hızlı Başlangıç" (deneme, senin sunucun, rate limited) ve "Gelişmiş Kurulum" (kullanıcının kendi anahtarları). Tüm kimlik doğrulama senin Supabase'ine bağlanır.*

*Sırlar (Groq + Supabase service_role) yalnızca Edge Function secret'ında durur. Client'ta yalnızca public-safe anon key + RLS bulunur — repo public olsa bile sızıntı olmaz.*

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
*Projenin ana amacı: her model yalnızca DESTEKLEDİĞİ kadarını yapsın, desteklemediği
parametre hiç gönderilmesin → 400/422 "unsupported parameter / max_tokens too large /
no tool support" hataları kökten bitsin. Her provider'ın resmi dokümanı tek tek okundu.*

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
*Hazır palet preset'leri: accent + arka plan + font tek tıkla. (Not: bu "palet"tir;
gerçek skin "aileleri" Faz 33'te.)*
- ✅ `src/themes.ts`: `UI_FAMILIES` — cyber/synthwave/matrix/aurora/ember (bg + accent + font preset)
- ✅ `--bg`/`--bg-deep` CSS değişkenleri; skin arka planları + body + `.backdrop` bunları kullanıyor (sabit `#03060c` kaldırıldı)
- ✅ `applyFamilyBg` (App): aile → arka plan; aile seçimi accent + font'u da preset'ler (kullanıcı sonra tek tek ezebilir)
- ✅ Ayarlar → Görünüm: "UI AİLESİ" seçici (swatch + label); `uiFamily` settings'e kalıcı
- ✅ Skinlerin sabit fontu da `var(--ui-font)`'a bağlandı (aile fontu etki etsin)

---

## Faz 33 — Skin Aileleri 🧩 (1/4 aile · sürüyor)
*Mevcut 4 skin tek bir AİLE altında ("Aegis HUD"). Kullanıcı 3 farklı aile daha
istedi, her birinin 4 ferdi (skin) olacak şekilde — recolor değil, gerçek farklı
layout'lar. Toplam hedef: 4 aile × 4 skin = 16.*
- ✅ Mimari: `src/components/skins/registry.tsx` — skinler ailelere gruplu; App render + Ayarlar seçici buradan; `skin` tipi `string`'e açıldı
- ✅ Ayarlar → Görünüm: skin seçici "AİLE › FERDİ" gruplu
- ✅ **Aile 1 — Aegis HUD**: hologram / minimal / terminal / dashboard (mevcut)
- ✅ **Aile 2 — Nebula** (yumuşak/yuvarlak/bubble/gradient): Aura / Chat / Board / Zen — `NebulaFamily.tsx`
- ⬜ **Aile 3** — (gelecek tur) farklı tasarım dili, 4 skin
- ⬜ **Aile 4** — (gelecek tur) farklı tasarım dili, 4 skin

---

## 🌐 Çalışma Listesi — Tam i18n (geçici, bitince sil)
*Faz değil. Onboarding çok dilli oldu ama uygulamanın geri kalanı hâlâ sabit Türkçe.
Dil seçiminin etki etmediği yerler — kullanıcı görme sırasına göre öncelikli. Her madde
i18n.ts'e string ekleyip ilgili dosyada `t.` ile değiştirmek demek (5 dil: tr/en/de/fr/es).*

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
🔶  Faz 30   Dağıtım: deneme modu + auth  ← 30.1-30.4 ✅ / 30.5-30.8 sırada
```
