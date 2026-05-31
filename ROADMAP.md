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

## Faz 5 — Görme & Ekran 👁️
*AEGIS ekranı okuyunca çok daha güçlü hale gelir.*

### 5.1 Screenshot + Vision
- [ ] `screenshot` tool: ekranı veya belirli pencereyi yakala
- [ ] Vision modeli ile analiz et
- [ ] "Ekranımda ne var?", "Bu hata ne?" soruları çalışsın

### 5.2 Clipboard
- [ ] `read_clipboard` / `write_clipboard` tool
- [ ] "Panoya kopyala", "Panodan oku" komutları

### 5.3 Pencere Yönetimi
- [ ] Açık pencereleri listele ve odakla
- [ ] "Chrome'u kapat", "VSCode'u öne getir"

---

## Faz 6 — Sistem Kontrolü 🖱️
*Günlük kullanımda en çok işe yarayan şeyler.*

### 6.1 Ses & Ekran
- [ ] Sistem ses seviyesi ayarla
- [ ] Ekran parlaklığı kontrolü
- [ ] "Sesi %50 yap", "Ekranı karat"

### 6.2 Zamanlanmış Görevler
- [ ] "10 dakika sonra hatırlat"
- [ ] Belirli saatte komut çalıştır
- [ ] Görev kuyruğu (app açıkken aktif)

### 6.3 Uygulama Profilleri
- [ ] "Çalışma modunu aç" → VSCode + terminal + müzik
- [ ] "Oyun modu", "Film modu" — kullanıcı tanımlı
- [ ] Profiller JSON'da saklanır

---

## Faz 7 — Web & İletişim 🌐

### 7.1 Web İçerik Okuma
- [ ] URL ver → sayfa içeriğini çek ve özetle
- [ ] "Bu haberi özetle", "Şu sayfada ne yazıyor?"
- [ ] RSS feed takibi

### 7.2 Bildirim Sistemi
- [ ] Windows toast bildirimleri
- [ ] Görev bitince / hata olunca bildirim
- [ ] AEGIS kapalıyken de bildirim (background service)

### 7.3 Email & Takvim *(opsiyonel)*
- [ ] Gmail / Outlook entegrasyonu
- [ ] "Bugün toplantım var mı?", "Şuna mail at"

---

## Faz 8 — Gelişmiş Ses 🎙️

### 8.1 Sözünü Kesme ✅
- ✅ ESC tuşu veya ⏹ DURDUR butonu ile TTS kesilir
- ✅ Kesince mic otomatik açılır, dinlemeye geçer

### 8.2 Chat Geçmişi UI
- [ ] Session bazlı konuşma listesi (sidebar)
- [ ] Geçmiş konuşmayı aç, devam et
- [ ] Konuşmayı dışa aktar (MD / TXT)

### 8.3 Command Palette
- [ ] `Ctrl+Space` ile hızlı komut çubuğu
- [ ] `/screenshot`, `/note`, `/profil` slash komutları
- [ ] Araç sonuçları görselleştirme: dosya ağacı, arama kartları, sparkline

---

## Faz 9 — Plugin Sistemi 🔌
*Uzun vadeli genişleme katmanı.*

### 9.1 Dinamik Tool Yükleme
- [ ] `~/.aegis/plugins/` klasöründen tool'ları yükle
- [ ] Her plugin: `manifest.json` + `tool.ts`
- [ ] Yeniden derleme gerektirmesin

### 9.2 Hazır Plugin'ler
- [ ] **Spotify** — çal, durdur, atla, ne çalıyor
- [ ] **VS Code** — dosya aç, terminal komutu
- [ ] **Steam** — oyun başlat
- [ ] **OBS** — kayıt başlat/durdur

---

## Öncelik Sırası

```
✅  Faz 1    Hafıza & bağlam         ← TAMAMLANDI
✅  Faz 2    Ayarlar & model seçimi  ← TAMAMLANDI
✅  Faz 3    UI temaları & skinler   ← TAMAMLANDI
✅  Faz 4    Dil desteği             ← TAMAMLANDI
3.  Faz 5.1  Screenshot + vision     ← güçlü AI hissi
4.  Faz 5.2  Clipboard               ← hızlı veri alışverişi
5.  Faz 6    Sistem kontrolü         ← günlük otomasyon
6.  Faz 7    Web & iletişim          ← genişleme
7.  Faz 8.2  Chat geçmişi UI         ← session listesi
8.  Faz 8.3  Command palette         ← hız & polish
9.  Faz 9    Plugin sistemi          ← uzun vadeli
```
