# Canlı deneme — ikinci tur

**Tarih:** 2026-09-08 · **Sürüm:** 0.7.4 · **Kod değişikliği: yok**

---

## Sonuç

Uygulama çalıştırıldı, ekrandan bakıldı, iki düzeltme **canlı olarak
doğrulandı.** Bozuk bir şey bulunmadı, dolayısıyla hiçbir şey değiştirilmedi.

---

## Bir yanlış alarm — ve sebebi bendim

İlk ekran görüntüsünde sohbet paneli sağ kenardan **kesik** görünüyordu.
Metinler yarıda kalıyordu; daha önce düzelttiğim taşma hatasının (E4) geri
geldiğini sandım.

Sandığım şeye göre iki CSS düzeltmesi yazdım (`styles.css` ve `App.svelte`
içine `width: 100%`). Yeniden derleyip baktım — **hiçbir şey değişmedi.**
Teşhis yanlıştı.

Tahmin etmeyi bırakıp gerçek DOM'u ölçtüm. WebView2'ye uzaktan hata ayıklama
portu açıp elementlerin gerçek konumlarını okudum:

```
window.innerWidth = 1536
.body   x=0     w=1536  right=1536
.stage  x=0     w=1136  right=1136
.panel  x=1136  w=400   right=1536   <- tam kenarda bitiyor
```

Panel tam olarak pencerenin bittiği yerde bitiyor. **Taşma yok.** Yerleşim
kusursuz çalışıyordu.

Asıl ipucu aynı ölçümdeki `dpr=1.25` idi:

| | |
|---|---|
| Gerçek ekran | **1920 × 1200 piksel** |
| Windows ölçekleme | **%125** |
| Mantıksal boyut | 1536 × 960 |

Benim ekran görüntüsü kodum DPI'dan habersizdi, dolayısıyla 1920 piksellik
ekranın yalnızca **1536 pikselini** yakalıyordu. Yani uygulama kesilmiyordu;
**ekran görüntüsü kesiyordu.** Sağdaki 384 piksel hiç fotoğrafa girmemişti.

Yazdığım iki CSS düzeltmesi gereksizdi ve **geri alındı** — çalışan bir
yerleşime, olmayan bir hata için dokunmanın anlamı yok.

**Düzeltilen şey:** ekran görüntüsü yöntemi. Artık ekran API'sine
dokunmadan önce DPI farkındalığı bildiriliyor ve tam 1920 × 1200
yakalanıyor.

**Ders:** görüntüde bir şey bozuk görünüyorsa, önce görüntünün kendisinin
doğru olduğundan emin ol. Ölçmeden düzeltmeye başlamak, olmayan bir hatayı
"düzeltmek" demek.

---

## Doğrulanan düzeltmeler

### E1 — saat artık uydurulmuyor ✅

Kullanıcının şikayet ettiği hata buydu: model saati uyduruyordu.

Yeni mesaj gönderildi:

```
kullanıcı : saat kac
araç      : simdiki_zaman — 2026-09-08 13:49 Salı
cevap     : Şu an saat: 13:49, 8 Eylül 2026, Salı.
```

Kayıtta:

```
tools offered for this request count=3 budget=16 model=qwen/qwen3.8-27b
```

**Kritik nokta:** eskiden bu sayı **0** idi. Çekirdek araçlar hiç
sunulmadığı için model uydurmak zorunda kalıyordu. Artık 3 araç gidiyor ve
model gerçek saati okuyor.

Sohbet geçmişinde hâlâ eski yanlış cevaplar (`2023-10-27 14:30`) görünüyor —
bunlar düzeltmeden **önce** kaydedilmiş mesajlar, veri tabanından geri
yükleniyor. Yeni sorular doğru cevaplanıyor.

### E3 — web araması artık çalışıyor ✅

```
kullanıcı : istanbul nufusu kac web arama yap
araç      : web_ara — 1. İstanbul Nüfusu 2026: Güncel TÜİK Veril...
cevap     : İstanbul nüfusu: 15.701.602 (TÜİK 2026 verisi)
            • Erkek: 7.820.462
            • Kadın: 7.881.140
```

**Hiçbir API anahtarı olmadan.** Geçmişte aynı isteğe "web arama
çalışmıyor — arama motoru yapılandırılmamış" cevabı veriliyordu; ekranda
o eski cevabın hemen altında yenisi duruyor, fark açıkça görülüyor.

---

## Genel durum

| | |
|---|---|
| Açılış | temiz, hata yok, sürüm 0.7.4 |
| Pencere | tam ekran, 1920×1200'ü tam kaplıyor |
| Reaktör | sorunsuz çiziliyor |
| Panel | taşma yok, metinler tam |
| Sağlayıcı | groq / qwen3.8-27b |
| Araç sayısı | 58 |

Kayıtta tek bir uyarı ya da hata satırı yok.

---

## Yedek

Uygulama veriyi diske yazdığı için çalıştırmadan **önce** yedeklendi:

`scratchpad/vavis-data-before-run/` (1,7 MB) — ayar dosyası, veri tabanı ve
şifreli anahtar dosyası dahil. Silinmesi söylenene kadar duracak.

Önceki turlardan kalan yedekler de duruyor (`vavis-data/`,
`branch-backup/all-refs.bundle`, `vault-before/`).

---

## Yan not

Ekrandaki "Activate Windows" filigranı uygulamayla ilgili değil, Windows
lisansıyla ilgili.
