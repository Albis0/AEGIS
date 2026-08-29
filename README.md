# VAVIS

> Telaffuz: **veyvis**
> Windows için kişisel AI asistanı. Tek `.exe`, ~9 MB, kurulum yok.

AEGIS/RealJarvis'in (TypeScript + Electron, ~1 GB) yerine sıfırdan Rust'la yazıldı.

---

## Hızlı başlangıç

```bash
cargo run --release
```

İlk açılışta:

1. **Anahtar gir** — Groq ücretsiz katmanı var, hem sohbet hem ses tanıma için kullanılıyor:
   ```
   /key groq gsk_...
   ```
   Anahtarı [console.groq.com](https://console.groq.com) üzerinden alabilirsin.

2. **Konuş** — bir şeyler yaz ve Enter'a bas.

3. **Sesi aç** (isteğe bağlı) — `Ctrl+M` veya `/ses surekli`

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `/help` | Tüm komutlar |
| `/key <sağlayıcı> <anahtar>` | API anahtarı kaydeder (DPAPI ile şifreli) |
| `/keys` | Hangi sağlayıcıların anahtarı var (anahtar gösterilmez) |
| `/provider <ad>` | groq · openai · gemini · anthropic · mistral · deepseek · xai · local |
| `/model <ad>` | Kullanılacak model |
| `/models` | Sağlayıcıdan canlı model listesi |
| `/ses <mod>` | kapali · surekli · uyandirma |
| `/ayar <alan> <değer>` | isim · dil · yazitipi · pencere |
| `/ayarlar` | Mevcut ayarları göster |
| `/health` | Sistem durumu |
| `/clear` | Sohbeti temizler (**hafıza korunur**) |
| `/quit` | Çıkar |

## Kısayollar

| Tuş | Ne yapar |
|---|---|
| `ESC` | **Konuşmayı anında keser** (barge-in) |
| `Ctrl+M` | Ses modunu değiştirir |
| `Ctrl+L` | Sohbeti temizler |
| `F1` | Sistem durumu |

---

## Yetenekler — 32 tool, 9 alan

| Alan | Tool'lar |
|---|---|
| **Çekirdek** | tarih/saat, hesaplama |
| **Sistem (okuma)** | CPU/RAM/disk durumu, çalışan uygulamalar, pil |
| **Kontrol** | ses, parlaklık, uygulama aç/kapat, PowerShell, pano oku/yaz, pencereler |
| **Dosya** | okuma, yazma, listeleme, arama |
| **Görü** | ekran görüntüsü, tıklama, klavye, tuş kombinasyonu, ekran boyutu |
| **Web** | arama (DuckDuckGo), sayfa okuma |
| **Medya** | oynat/duraklat/sonraki/önceki, çalan parça (Spotify · YouTube · VLC) |
| **Otomasyon** | zamanlanmış görev kur, listele, sil |
| **Hafıza** | kalıcı bilgi kaydet, ara, sil |

**Yıkıcı işlemler onay ister** (dosya yazma, uygulama kapatma, komut çalıştırma,
tıklama, klavye). Tek çalıştırmada 3'ten fazla yıkıcı işlem yapılırsa "hep izin
ver" seçilmiş olsa bile tekrar sorulur.

### Otomasyon örnekleri

```
her sabah 09:00'da hava durumunu söyle     → günlük
her 30 dakikada cpu durumunu kontrol et    → aralıklı
pil 20'nin altına inince beni uyar         → koşullu
cpu 80'in üstüne çıkınca haber ver         → koşullu
```

---

## LLM sağlayıcıları

| Sağlayıcı | Not |
|---|---|
| **Groq** | Varsayılan. Ücretsiz katman var, hızlı. Ses tanıma da bunu kullanır. |
| **Anthropic** | Claude. Ayrı API şeması (x-api-key, top-level system, farklı tool biçimi). |
| OpenAI · Gemini · Mistral · DeepSeek · xAI | OpenAI-uyumlu, tek kod yolu. |
| **Local** | Ollama / LM Studio — anahtar istemez. `/provider local` |

Görüntü desteği (ekran görüntüsü modele gösterme) hem OpenAI-uyumlu
sağlayıcılarda hem Anthropic'te çalışır.

---

## Mimari

```
┌──────────────────────────────────┐
│  vavis-shell   KABUK             │  Tauri penceresi + Svelte arayüz
├──────────────────────────────────┤
│  vavis-brain   BEYİN             │  LLM, bağlam bütçesi, anahtarlar
├──────────────────────────────────┤
│  vavis-tools   ELLER             │  57 tool, izin kapısı, ajan döngüsü
├──────────────────────────────────┤
│  vavis-audio   DUYULAR           │  STT · TTS · VAD · barge-in
├──────────────────────────────────┤
│  vavis-core    ÇEKİRDEK          │  ayarlar, SQLite, arama, zamanlayıcı
└──────────────────────────────────┘
```

**Bağımlılık tek yönlüdür.** Alt katman üstünü tanımaz — arayüz tamamen
değişse alt katmanlara dokunulmaz.

---

## Tasarımın kritik kararları

### 1. Modele asla 12'den fazla tool gönderilmez

Eski projede 353 tool tanımlıydı ve modele her istekte **64 tanesi**
gönderiliyordu. Hiçbir LLM 64 seçenek arasından güvenilir seçim yapamaz.

Burada iki kademeli seçim var: mesajdan **alan** çıkarılır, sadece o alanın
tool'ları sunulur. 32 tool var ama **ortalama 7.8 tanesi** gidiyor.

Sohbet mesajlarına (`merhaba`, `bana bir şiir yaz`, `iyi geceler`) **hiç tool
gönderilmez** — modeli boş yere kışkırtmamak için.

Bunu koruyan iki mekanizma:

- **Zayıf fiil kuralı**: "yaz", "oku", "aç" gibi genel fiiller tek başına alan
  tetiklemez. "dosya yaz" → Files ✓ · "şiir yaz" → hiçbir şey ✓
- **Alan ayrımı**: Sistem okuma ve sistem değiştirme ayrı alanlar. "cpu durumu"
  sorusuna `komut_calistir` sunmak hem gereksiz hem riskli.

### 2. Barge-in yapısal olarak doğru

Eski projede `ESC` çalan cümleyi kesiyor ama **sıradakini başlatıyordu**:
`stopSpeaking()` senkron bir geri çağırma tetikliyor, o da kuyruğu boşaltıp
yeni cümleyi çalmaya başlıyordu.

Burada kuyruk ve oynatma durumu tek kilit altında, geri çağırma yok —
yeniden başlatacak bir yol da yok. `generation` sayacı sayesinde durdurulmuş
bir konuşmanın geç gelen sesi yeni konuşmaya karışamaz.

### 3. Bağlam bütçesinde her şey sayılır

Eski projedeki 413 ("message too long") hatasının sebebi tool şemalarının
sayılmamasıydı. Burada tool token'ları **ve** görüntüler bütçeye dahil.
Görüntü sabit 1100 token sayılır — base64 uzunluğu sayılsaydı 2 MB'lık bir
PNG bütçeyi anında patlatırdı.

---

## Geliştirme

```bash
cargo test                    # 393 test
cargo test -- --ignored       # gerçek ekran görüntüsü alan test
cargo build --release         # ~9 MB tek exe

# Tool seçim kalitesi ölçümü
cargo test -p vavis-tools --test selection_eval -- --nocapture
```

### Veri konumu

`%APPDATA%\vavis\data\`

| Dosya | İçerik |
|---|---|
| `vavis.toml` | Ayarlar |
| `vavis.db` | Sohbet geçmişi + hafıza + otomasyonlar (SQLite) |
| `keys.dat` | API anahtarları (DPAPI ile şifreli) |
| `logs/` | Günlük log dosyaları + çökme kaydı |

---

## Ölçümler

| | AEGIS (eski) | VAVIS |
|---|---|---|
| Paket boyutu | ~1 GB | **8.9 MB** |
| Kod | 31.813 satır | 14.544 satır |
| RAM (boşta) | ~400 MB | ~30 MB |
| Açılış | 3-5 sn | anında |
| Tool sayısı | 353 tanım | 32 |
| Modele sunulan | 64 | **≤ 12** (ort. 7.8) |
| Tool seçim skoru | — | **%100** (36 senaryo) |
| Test | 58 dosya | **393 test** |
| Ses duraklaması | var (GC) | yok |
| Dağıtım | kurulum gerekli | tek `.exe` |

---

## Bilinen sınırlar

- **Edge TTS** kodu yazıldı ama servis 403 döndürüyor (Microsoft tarafı
  kısıtlama). Varsayılan Windows SAPI; Edge seçilirse başarısızlıkta
  otomatik SAPI'ye düşer.
- **STT bulut** (Groq Whisper) — yerel whisper eklenmedi.
- **Parlaklık** sadece dizüstü panelinde çalışır, harici monitörde değil.
- **Medya kontrolü** sistem tuşlarıyla — "şu şarkıyı çal" gibi arama
  gerektiren komutlar için Spotify'ı `uygulama_ac` ile açıp arama yapılmalı.

---

*Apache-2.0*
