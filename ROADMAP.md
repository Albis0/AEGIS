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

### 1.1 Konuşma Hafızası
- [ ] Geçmiş session'lardan özet çıkar, yeni konuşmaya bağlam olarak ekle
- [ ] "Dün ne konuştuk?" sorusu çalışsın
- [ ] Session'lar arası bağlam köprüsü

### 1.2 Kullanıcı Profili
- [ ] "Benim adım X", "Python kullanıyorum" gibi bilgileri öğrenip kaydet
- [ ] Profil bilgilerini her konuşmada system prompt'a ekle
- [ ] `profil güncelle` / `profil göster` komutları

### 1.3 Notlar & Hatırlatıcılar
- [ ] "Bunu not et" → Supabase `notes` tablosuna yaz
- [ ] "Notlarımı göster" → listele
- [ ] Zamanlı hatırlatıcı (app açıkken tetikle)

---

## Faz 2 — Ayarlar & Model Seçimi ⚙️
*Kullanıcının AEGIS'i kendine göre ayarlayabilmesi.*

### 2.1 Ayarlar Paneli
- [ ] API key yönetimi (şu an sadece .env, UI'dan girilsin)
- [ ] Tema rengi, font, layout seçimi
- [ ] Tüm ayarlar Supabase profilde saklanır

### 2.2 AI Model Seçimi
- [ ] **Groq modelleri** — qwen3-32b, llama-3.3-70b, mixtral vb. dropdown'dan seç
- [ ] **Kendi API key'i** — OpenAI, Anthropic, Mistral API key girip o modeli kullan
- [ ] **Local model** — Ollama entegrasyonu, internet olmadan çalışsın
- [ ] Seçilen model + provider Supabase'e kaydedilir, her oturumda aktif kalır
- [ ] Model değişince system prompt uyarlanır (her modelin güçlü yönleri farklı)

### 2.3 Ses Kişiselleştirme
- [ ] Hazır sesler: **EmelNeural (TR)**, **AhmetNeural (TR)**, **AriaNeural (EN)**, **GuyNeural (EN)**
- [ ] Konuşma hızı (0.5x – 2.0x) ve pitch ayarı
- [ ] Ses testi butonu — "Merhaba, ben AEGIS" ile dene
- [ ] ElevenLabs API key girince o motor aktif olur

---

## Faz 3 — UI Temaları & Skinler 🖥️
*Görsel kimlik. Herkes farklı bir AEGIS ister.*

### 3.1 UI Tipi Değiştirme
- [ ] Birden fazla hazır skin: **Hologram** (şu anki), **Minimal**, **Terminal**, **Dashboard**
- [ ] Ayarlar'dan tek tıkla geçiş, canlı önizleme
- [ ] Her skin kendi renk paleti, layout ve animasyonuyla gelir
- [ ] Skin sistemi component bazlı — yeni skin eklemek mevcut kodu bozmaz

### 3.2 Görsel Özelleştirme
- [ ] Accent rengi, HUD rengi seçimi
- [ ] Font seçimi (Orbitron, Rajdhani, monospace...)
- [ ] Kompakt / geniş layout modu
- [ ] Özel CSS inject (ileri seviye kullanıcılar için)

---

## Faz 4 — Dil Desteği 🌍
*AEGIS dil bilmez, kullanıcı dil seçer.*

### 4.1 Tam Çok Dil
- [ ] Arayüz dili: TR / EN / DE / ... dropdown'dan seç
- [ ] Konuşma dili: Whisper otomatik algılar, TTS aynı dilde yanıt verir
- [ ] Yazışma dili: kullanıcı hangi dilde yazarsa AEGIS aynı dilde cevaplar
- [ ] LLM system prompt seçilen dile göre dinamik güncellenir

### 4.2 Dil Başına Yapılandırma
- [ ] Her dil için varsayılan TTS sesi (TR → EmelNeural, EN → AriaNeural...)
- [ ] Dil değişince VAD, Whisper ve TTS senkron değişir
- [ ] "Switch to English / Türkçeye geç" sesli komutla da çalışır

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

### 8.1 Sözünü Kesme
- [ ] AEGIS konuşurken kullanıcı sözünü kesebilsin
- [ ] "Dur" / "Tamam yeter" → TTS durur, dinlemeye geçer

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
1.  Faz 1.1  Konuşma hafızası        ← AEGIS'i "akıllı" yapan şey
2.  Faz 1.2  Kullanıcı profili       ← kişiselleştirme temeli
3.  Faz 2.1  Ayarlar paneli          ← her şeyin UI'dan yapılabilmesi
4.  Faz 2.2  AI model seçimi         ← esneklik, kendi key'ini getir
5.  Faz 2.3  Ses kişiselleştirme     ← ses deneyimi
6.  Faz 3    UI temaları & skinler   ← görsel kimlik
7.  Faz 4    Dil desteği             ← erişilebilirlik
8.  Faz 5.1  Screenshot + vision     ← güçlü AI hissi
9.  Faz 6    Sistem kontrolü         ← günlük otomasyon
10. Faz 7    Web & iletişim          ← genişleme
11. Faz 8    Gelişmiş ses & UI       ← polish
12. Faz 9    Plugin sistemi          ← uzun vadeli
```
