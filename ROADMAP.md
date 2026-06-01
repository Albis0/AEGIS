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

### 14.1 Yerel Ağ API
- [ ] `electron/api-server.ts`: Express HTTP sunucusu, yerel ağda dinlesin (varsayılan `http://0.0.0.0:7331`)
- [ ] `/api/ask` POST: JSON body `{text, voice?}` → AEGIS'e sor, yanıtı döndür
- [ ] `/api/tts` POST: metni sese çevir, MP3 döndür
- [ ] Bearer token auth (ayarlardan token oluştur/sıfırla)

### 14.2 Mobil Kısayollar
- [ ] iOS Kısayollar / Android Tasker ile `curl` üzerinden entegrasyon tarifi (README)
- [ ] Sesli mesaj → `/api/stt` endpoint → metin → AEGIS'e gönder
- [ ] Telefon bildirimlerini masaüstüne yansıt (Android Debug Bridge ile opsiyonel)

### 14.3 QR Bağlantı
- [ ] Ayarlar'da "Mobil Bağlan" butonu — yerel IP + token içeren QR kodu göster
- [ ] Tarayıcıdan `http://<ip>:7331` ile basit web UI'ı aç (Faz 14.4 kapsamı)

---

## Faz 15 — Web Arayüzü 🌐
*AEGIS'e başka cihazdan tarayıcıdan da erişilebilsin.*

### 15.1 Tarayıcı Tabanlı UI
- [ ] Faz 14'te açılan Express sunucusunda aynı React UI'ı statik olarak sun
- [ ] Gerçek zamanlı mesajlaşma WebSocket üzerinden (Socket.io veya native WS)
- [ ] Hologram skin'in tarayıcı uyumlu versiyonu

### 15.2 Çok Cihaz Senkronizasyonu
- [ ] Masaüstü + web UI'ı aynı anda kullanılabilsin
- [ ] Feed, iki tarafta da senkron güncellensin
- [ ] Konuşma Supabase'de zaten saklandığı için senkronizasyon doğal

---

## Faz 16 — Gelişmiş Hafıza & Kişiselleştirme 🧠+
*Faz 1'in üzerine derin öğrenme katmanı.*

### 16.1 Vektör Hafızası
- [ ] Her konuşmadan önemli gerçekleri otomatik çıkar (`extract_facts` arka plan görevi)
- [ ] Gerçekler embedding ile saklanır, ilgili sohbette otomatik inject edilir
- [ ] "Bunu bil" komutuyla manuel gerçek eklenebilir

### 16.2 Alışkanlık & Davranış Takibi
- [ ] AEGIS'in hangi tool'ların ne sıklıkta kullanıldığını takip etmesi
- [ ] Sık kullanılan komutlar Command Palette'in üstüne çıksın
- [ ] "Bu hafta ne kadar çalıştım?" sorusu çalışsın

### 16.3 Proaktif Öneriler
- [ ] Sabah ilk açılışta günlük özet: hava, takvim, önemli notlar
- [ ] Uzun süredir tamamlanmamış notlar için "hâlâ geçerli mi?" sorusu
- [ ] Proje bazlı bağlam: "Dün X projesinde çalışıyordun, devam etmek ister misin?"

---

## Faz 17 — Güvenlik & Gizlilik 🔒
*AEGIS'in verilerini güvende tut.*

### 17.1 Yerel Şifreleme
- [ ] `~/.aegis/` klasörü isteğe bağlı AES-256 ile şifreli — şifre ayarlardan girilir
- [ ] Uygulama açılışında şifre sor (PIN veya biyometrik — Windows Hello API)
- [ ] Şifreli mod: API key'ler, profil, notlar, geçmiş korunur

### 17.2 Veri Denetimi
- [ ] `privacy_audit` tool: hangi verilerin nerede saklandığını listele
- [ ] `clear_history` / `clear_profile` / `clear_notes` araçları
- [ ] Otomatik silme: X günden eski konuşmalar kaldırılsın (ayarlanabilir)

### 17.3 API Key Vault
- [ ] API key'ler düz JSON yerine Windows Credential Manager'da (DPAPI) saklansın
- [ ] Ayarlar panelinden "Güvenli Depoya Taşı" tek tıkla

---

## Faz 18 — Gelişmiş Plugin Ekosistemi 🔌+
*Faz 9'un üzerine marketplace katmanı.*

### 18.1 Plugin Marketplace
- [ ] `plugin_search` tool: GitHub'da `aegis-plugin-` prefix'li repoları ara
- [ ] `plugin_install` tool: URL ver → `~/.aegis/plugins/`'e indir, doğrula, etkinleştir
- [ ] `plugin_update` / `plugin_remove` tool'ları

### 18.2 Plugin Güvenlik Sandboxu
- [ ] Plugin'ler `vm2` veya Node `--experimental-vm-modules` ile izolasyonda çalışsın
- [ ] İzin sistemi: `manifest.json`'da hangi sistem kaynaklarına erişebileceği bildirilsin
- [ ] İzin dışı erişim denenince kullanıcıya sor

### 18.3 Daha Fazla Hazır Plugin
- [ ] **Discord** — mesaj gönder, kanal listele, durum ayarla (Discord RPC)
- [ ] **Notion** — sayfa oluştur/oku/güncelle, veritabanı sorgula (Notion API)
- [ ] **Home Assistant** — akıllı ev cihazlarını kontrol et (HA WebSocket API)
- [ ] **YouTube** — video ara, açıklamasını oku, transcript çek (yt-dlp)

---

## Faz 19 — Ses & Müzik Üretimi 🎵
*AEGIS sadece dinlemez, üretir de.*

### 19.1 Ses Efektleri
- [ ] `play_sound` tool: sistem sesi veya özel `.wav`/`.mp3` çal
- [ ] Olay bazlı ses: "görev tamamlandı", "hata", "uyarı" için özel sesler
- [ ] Ses dosyaları `~/.aegis/sounds/`'tan yüklenir

### 19.2 Müzik Üretimi Entegrasyonu
- [ ] Suno AI veya Udio API entegrasyonu — "Lo-fi çalışma müziği üret" komutu
- [ ] Üretilen müziği kaydet + oynat
- [ ] `generate_music` tool: stil/mood/süre parametreleri

### 19.3 Ambient Ses Modu
- [ ] `ambient_start` / `ambient_stop`: arka planda odaklanma müziği / beyaz gürültü
- [ ] Hazır kategoriler: yağmur, kafe, orman, uzay, lo-fi
- [ ] Ses seviyesi AEGIS'in konuşmasıyla otomatik düşsün (ducking)

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
[ ] Faz 10   Arka plan servisi & bildirim ← SIRADA
[ ] Faz 11   Performans & streaming       ← SIRADA
[ ] Faz 12   Ajans modu & otomasyon       ← SIRADA
[ ] Faz 13   Bilgi tabanı & RAG           ← SIRADA
[ ] Faz 14   Telefon & mobil köprüsü      ← SIRADA
[ ] Faz 15   Web arayüzü                  ← SIRADA
[ ] Faz 16   Gelişmiş hafıza              ← SIRADA
[ ] Faz 17   Güvenlik & gizlilik          ← SIRADA
[ ] Faz 18   Gelişmiş plugin ekosistemi   ← SIRADA
[ ] Faz 19   Ses & müzik üretimi          ← SIRADA
```
