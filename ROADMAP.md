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

## Öncelik Sırası

```
✅  Faz 1    Hafıza & bağlam         ← TAMAMLANDI
✅  Faz 2    Ayarlar & model seçimi  ← TAMAMLANDI
✅  Faz 3    UI temaları & skinler   ← TAMAMLANDI
✅  Faz 4    Dil desteği             ← TAMAMLANDI
✅  Faz 5    Görme & ekran           ← TAMAMLANDI
✅  Faz 6    Sistem kontrolü         ← TAMAMLANDI
✅  Faz 7    Web & iletişim          ← TAMAMLANDI
✅  Faz 8.1  Sözünü kesme            ← TAMAMLANDI
✅  Faz 8.2  Chat geçmişi UI         ← TAMAMLANDI
✅  Faz 8.3  Command palette         ← TAMAMLANDI
✅  Faz 9    Plugin sistemi          ← TAMAMLANDI
✅  Faz 9.2  Hazır plugin'ler        ← TAMAMLANDI (Spotify/VSCode/Steam/OBS)
```
