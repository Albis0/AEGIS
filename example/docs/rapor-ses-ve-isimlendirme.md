# Ses motorları ve İngilizce araç adları

**Tarih:** 2026-09-08 · **Commit:** `cb39f72`, `e097633` · **Sürüm:** 0.7.4

---

## 1. Ses: iki motordan beşe

Öncesinde iki motor vardı (SAPI, Edge) ve **ayarlar hiçbirine
ulaşmıyordu** — kabuk `TtsConfig::default()` ile sabit kodlanmıştı.
Yani kullanıcı ne seçerse seçsin aynı ses çıkıyordu.

| Motor | Anahtar | Nerede çalışır |
|---|---|---|
| SAPI | yok | işletim sistemi, çevrimdışı |
| Edge | yok | Microsoft sunucusu, Türkçe iyi |
| **Kokoro** | yok | **kullanıcının kendi makinesi** |
| **ElevenLabs** | var | bulut, en doğal |
| **OpenAI** | var | bulut, anahtar çoğu kullanıcıda zaten var |

### Kokoro neden gömülü değil

Senin şartın buydu ve teknik olarak da doğrusu bu. Kokoro bir sinir ağı:
model yüzlerce megabayt, üstüne Python/ONNX yığını gerekiyor. Gömseydik:

- sesi hiç kullanmayacak kişi de o yüzlerce megabaytı indirirdi,
- model güncellendiğinde **uygulamayı** yeniden yayınlamak gerekirdi,
- model süreci çöktüğünde asistanın tamamı çökerdi.

Bu yüzden Vavis Kokoro'yu **kurmuyor, başlatmıyor, paketlemiyor** —
yalnızca HTTP ile konuşuyor. Ayarlar ekranında çalıştırma komutu
yazıyor:

```
docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu
```

Aynı uç nokta şeklini konuşan başka bir sunucu da (LM Studio, kendi
sarmalayıcın) aynı ayarla çalışır.

### OpenAI'yi neden ekledim

Sen "başka fikrin varsa ekle" dedin. Sohbet için OpenAI anahtarı girmiş
biri, ses için **hiçbir şey yapmadan** doğal bir sese kavuşuyor — ikinci
hesap yok, ikinci anahtar yok. Kurulum maliyeti sıfır olan tek doğal ses.

### ElevenLabs'te yeniden deneme yok

Bilinçli: her karakter kotadan düşüyor. Sessiz bir yeniden deneme, tek
cümlelik konuşma için kotayı iki kez harcar ve kullanıcı bunu ancak
fatura gelince görür.

---

## 2. Yedeğe düşüş artık **sesli** söyleniyor

Senin ikinci isteğin. Sadece ekranda bildirim yetmiyordu, çünkü sesi
açık kullanan kişi çoğu zaman ekrana bakmıyor.

**Nasıl çalışıyor:** seçilen motor düşerse, sıradaki motor **önce**
durumu söylüyor, **sonra** cevabı okuyor:

> "Bilgi: Kokoro sesi yanıt vermedi, sistem sesiyle devam ediyorum."

Duyuru cevabın **önünde** çünkü sesin neden değiştiğini cevabı
dinledikten sonra öğrenmek geç. Ekrana bakan kullanıcı için ayrıca
bildirim de gidiyor — ikisi birbirinin yerine geçmiyor.

**Canlı doğrulandı.** Kokoro seçili ama sunucu kapalıyken:

```
WARN  ses motoru başarısız     engine="kokoro"  (sunucuya ulaşılamadı)
WARN  yedek ses motoru da başarısız  engine="edge"  (403 Forbidden)
INFO  yedek ses motoruna düşüldü  from="kokoro" to="sapi" announced=true
```

`announced=true` — duyuru gerçekten yapıldı, sonra konuşuldu.

**Zincir kuralları:** SAPI her zaman en sonda (ağ da anahtar da
istemeyen tek motor o); ücretli motorlar önce **ücretsiz doğal** sese
düşüyor, ki kota bitince kullanıcı robot ses değil hâlâ iyi bir ses
duysun; bir motor kendi zincirinde tekrar denenmiyor.

---

## 3. Araç adları artık İngilizce

Senin en önemli maddendi ve haklıydın: bu adlar **modele giden
sözleşme**. Model onları okuyup ne çağıracağına karar veriyor, ve
modeller ezici çoğunlukla İngilizce tanımlayıcılarla eğitiliyor.

58 araç, tüm parametreler, açıklamalar ve modelin **üretmesi gereken**
değerler çevrildi:

| Eski | Yeni |
|---|---|
| `simdiki_zaman` | `get_current_time` |
| `dosya_oku` | `read_file` |
| `web_ara` | `web_search` |
| `komut_calistir` | `run_command` |
| `"yol"` | `"path"` |
| `"oynat \| duraklat"` | `"play \| pause"` |

### İki şey bilerek Türkçe kaldı

**1. Alan eşleştirme kelimeleri.** Bunlar **senin yazdığın** kelimeler,
modelin okuduğu değil. `"ses"` kelimesini İngilizceye çevirseydim "sesi
kıs" cümlesi ses aracını bulamaz olurdu. Yeniden adlandırma betiği
`keywords()` bloklarını ve `DOMAIN_KEYWORDS` tablosunu tamamen atlıyor.

**2. Türkçe değerler hâlâ *kabul* ediliyor.** Şema İngilizce ilan
ediyor, ama Türkçe konuşan bir model bazen alanı Türkçe dolduruyor.
Bunu hata saymak bilgiçlik olurdu — `"şarkı"` da `"track"` da çalışıyor.

### Bu arada bulduğum bir hata

Bazı açıklamalar araçları **eski adlarıyla** işaret ediyordu ("önce
`hafizada_ara` ile numarasını bul"). Çeviri olmasa bile bu bir hataydı;
model artık var olmayan bir aracı arardı. Hepsi yeni adlara çevrildi.

---

## 4. Sesli AI modelleri hakkında

Not ettiğin konu: Gemini gibi **kendi sesi olan** modeller bu listeye
girmiyor. Buradaki beş motor yalnızca **metni sese çeviriyor** — modelin
ne söyleyeceğine karışmıyorlar. Sesli konuşan modeller bambaşka bir
mimari (ses girip ses çıkıyor, metin hiç uğramıyor) ve onları bu listeye
koymak ikisini karıştırmak olurdu. İleride istersen ayrı bir şey olarak
eklenir.

---

## 5. Kod tarafında

- **`playback.rs`** — tüm motorların ortak çalma yolu. Öncesinde Edge'in
  içine gömülüydü; dört motor dört kopya demek olurdu ve barge-in birinde
  çalışıp diğerinde çalışmazdı. Tek uygulama var.
- **`[voice]` ayar bölümü** — motor, hız, ses seviyesi ve her motorun
  sesi. **Anahtarlar burada değil**: onlar şifreli depoda (DPAPI) ve
  ayar dosyasına hiç yazılmıyor.
- **`refresh_voice()`** — diğer `refresh_*` fonksiyonlarıyla aynı
  desende; ayar değişince yeniden başlatma gerekmiyor.
- **Ayarlar ekranı** — motor seçici, motora göre değişen ses listesi,
  hız/seviye, "hear this voice" önizlemesi, Kokoro için docker komutu,
  ElevenLabs için anahtar alanı.

Küçük bir hata da yakalandı: ayar alanlarını sonekle ayırt eden kısa yol
(`endsWith("Model")`) `routerModel`'i de yakalıyordu, yani router
değişince ses motoru boşuna yeniden kuruluyordu. Açık listeye çevrildi.

---

## Kendi hatam — ve nasıl yakalandı

İlk gönderimde **8 test kırıktı ve ben "hepsi geçti" dedim.** Sebebi
doğrulama yöntemimdi: suite'lerin `passed` sütunlarını toplayıp
yazdırıyordum, ama `FAILED` durumuna hiç bakmıyordum. Kırık suite'in
sayısı toplama giriyor, "FAILED" kelimesi ekrana hiç gelmiyordu.

CI yakaladı. Üç tür artık kalmış:

1. **Router testleri** — modelin cevabını taklit eden girdiler hâlâ
   Türkçe ad kullanıyor, ama beklenen çıktı İngilizceye çevrilmişti.
2. **29 hata mesajı** — `"yol parametresi gerekli"` gibi. Bu mesajlar
   **modele geri gidiyor**; yani modele artık var olmayan bir parametre
   adı söylüyorlardı. Çeviriden bağımsız olarak da bir hataydı.
3. **`click` düğme değerleri** — şema İngilizce ilan ediyor ama kod
   Türkçe varsayılan bekliyordu.

Artık her suite'in durumuna bakıyorum, sayı toplamıyorum.

## Doğrulama

| | Sonuç |
|---|---|
| `cargo test --workspace` | **740 geçti, 0 başarısız** (15 suite'in hepsi ok) |
| GitHub Actions | 13 adımın hepsi yeşil |
| `cargo clippy --all-targets` | 0 uyarı |
| `cargo fmt --check` | temiz |
| `vitest` | 38 geçti |
| `svelte-check` | 146 dosya, 0 hata |
| Canlı: yedek zinciri | Kokoro → Edge → SAPI, duyuru yapıldı |
| Canlı: ayarlar ekranı | beş motor listeleniyor, Kokoro bölümü çıkıyor |

## Yedekler

- `scratchpad/before-rename/crates/` — yeniden adlandırmadan önceki tüm
  kaynak ağacı
- `scratchpad/vavis-data-before-run/` — uygulama verisi (anahtarlar dahil)
- `scratchpad/branch-backup/all-refs.bundle` — deponun tüm ref'leri

Hepsi sen "sil" diyene kadar duracak.

## Not

Uygulama **açık bırakıldı** — kapatmadım.
