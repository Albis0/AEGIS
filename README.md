# VAVIS

> Telaffuz: **veyvis**
> Windows için kişisel AI asistanı. Tek `.exe`, ~8 MB, kurulum yok.

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
| `/provider <ad>` | groq · openai · gemini · mistral · deepseek · xai · local |
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

## Yetenekler

Asistan 15 tool kullanabiliyor:

- **Sistem** — CPU/RAM/disk durumu, çalışan uygulamalar, pil, ses seviyesi
- **Dosya** — okuma, yazma, listeleme, arama
- **Web** — arama, sayfa okuma
- **Hafıza** — kalıcı bilgi kaydetme, arama, silme
- **Çekirdek** — tarih/saat, hesaplama

**Yıkıcı işlemler onay ister** (dosya yazma, hafızadan silme). Tek çalıştırmada
3'ten fazla yıkıcı işlem yapılırsa "hep izin ver" seçilmiş olsa bile tekrar sorulur.

---

## Mimari

```
┌──────────────────────────────────┐
│  vavis-ui      KABUK             │  terminal görünümlü arayüz (egui)
├──────────────────────────────────┤
│  vavis-brain   BEYİN             │  LLM, bağlam bütçesi, anahtarlar
├──────────────────────────────────┤
│  vavis-tools   ELLER             │  tool'lar, izin kapısı, ajan döngüsü
├──────────────────────────────────┤
│  vavis-audio   DUYULAR           │  STT · TTS · VAD · barge-in
├──────────────────────────────────┤
│  vavis-core    ÇEKİRDEK          │  ayarlar, SQLite, arama, loglama
└──────────────────────────────────┘
```

**Bağımlılık tek yönlüdür.** Alt katman üstünü tanımaz — arayüz tamamen
değişse alt katmanlara dokunulmaz.

---

## Tasarımın iki kritik kararı

### 1. Modele asla 12'den fazla tool gönderilmez

Eski projede 353 tool tanımlıydı ve modele her istekte **64 tanesi**
gönderiliyordu. Hiçbir LLM 64 seçenek arasından güvenilir seçim yapamaz.

Burada iki kademeli seçim var: mesajdan **alan** çıkarılır (dosya/sistem/web/
hafıza), sadece o alanın tool'ları sunulur. Ortalama **6.2 tool** gidiyor.

Sohbet mesajlarına (`merhaba`, `bana bir şiir yaz`) **hiç tool gönderilmez** —
modeli boş yere kışkırtmamak için.

### 2. Barge-in yapısal olarak doğru

Eski projede `ESC` çalan cümleyi kesiyor ama **sıradakini başlatıyordu**:
`stopSpeaking()` senkron bir geri çağırma tetikliyor, o da kuyruğu boşaltıp
yeni cümleyi çalmaya başlıyordu.

Burada kuyruk ve oynatma durumu tek kilit altında, geri çağırma yok —
yeniden başlatacak bir yol da yok. `generation` sayacı sayesinde durdurulmuş
bir konuşmanın geç gelen sesi yeni konuşmaya karışamaz.

---

## Geliştirme

```bash
cargo test              # tüm testler (258)
cargo test -p vavis-tools --test selection_eval -- --nocapture
                        # tool seçim kalitesi ölçümü
cargo build --release   # ~8 MB tek exe
```

### Veri konumu

`%APPDATA%\vavis\data\`

| Dosya | İçerik |
|---|---|
| `vavis.toml` | Ayarlar |
| `vavis.db` | Sohbet geçmişi + hafıza (SQLite) |
| `keys.dat` | API anahtarları (DPAPI ile şifreli) |
| `logs/` | Günlük log dosyaları + çökme kaydı |

---

## Ölçümler

| | AEGIS (eski) | VAVIS |
|---|---|---|
| Paket boyutu | ~1 GB | **8.4 MB** |
| RAM (boşta) | ~400 MB | ~30 MB |
| Açılış | 3-5 sn | anında |
| Modele sunulan tool | 64 | **≤ 12** (ort. 6.2) |
| Ses duraklaması | var (GC) | yok |
| Dağıtım | kurulum gerekli | tek `.exe` |

---

*Apache-2.0*
