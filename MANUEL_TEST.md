# VAVIS — Manuel Test Kılavuzu

> Elle test edilmesi gereken her şey. Otomatik testler (393 tane) mantığı
> doğruluyor; bu liste **gerçekte çalışıyor mu** sorusunu yanıtlıyor.
>
> Çalıştırma: `cargo run --release`
> Kısayollar: `ESC` konuşmayı kes · `Ctrl+M` ses modu · `Ctrl+L` temizle · `F1` durum

---

## 0. Açılış (2 dk)

- [ ] Pencere açıldı, terminal görünümü geldi
- [ ] Karşılama mesajı göründü, anahtar yoksa uyarı verdi
- [ ] `F1` → sistem durumu penceresi açılıyor (sürüm, tool sayısı, veri dizini)
- [ ] Pencere yeniden boyutlandırılabiliyor, metin sarmalanıyor
- [ ] Kapat–aç → önceki sohbet geri yükleniyor

**Not:** _______________________________________________

---

## 1. Sohbet (3 dk)

- [ ] `/key groq gsk_...` → "kaydedildi (şifreli)" mesajı
- [ ] "merhaba" → cevap **harf harf akıyor** (tek seferde belirmiyor)
- [ ] Türkçe soru → Türkçe cevap
- [ ] `/models` → model listesi geliyor
- [ ] `/model <başka-model>` → değişiyor, sonraki cevap o modelden
- [ ] `/provider local` → anahtarsız çalışıyor (Ollama kuruluysa)
- [ ] Uzun bir sohbet → eski mesajlar düşse de hata vermiyor

**Anahtar güvenliği:**
- [ ] `/keys` → sadece sağlayıcı adı görünüyor, **anahtarın kendisi yok**
- [ ] `%APPDATA%\vavis\data\keys.dat` dosyasını Not Defteri'nde aç →
      anahtar **düz metin olarak görünmüyor**

**Not:** _______________________________________________

---

## 2. Tool'lar — sohbet ayrımı (2 dk)

Bu bölüm en kritik. **Sohbet mesajlarına tool gitmemeli.**

- [ ] "bana bir şiir yaz" → şiir yazıyor, dosya tool'u çağırmıyor
- [ ] "bir fıkra anlat" → anlatıyor, tool yok
- [ ] "iyi geceler" → normal cevap, otomasyon kurmuyor
- [ ] "python nedir" → açıklıyor, web araması yapmıyor (bilgi zaten var)

**Not:** _______________________________________________

---

## 3. Sistem tool'ları (3 dk)

- [ ] "cpu durumu nasıl" → gerçek CPU/RAM değerleri
- [ ] "pil yüzde kaç" → pil durumu (masaüstünde "pil yok" der, bu doğru)
- [ ] "hangi uygulamalar çalışıyor" → süreç listesi
- [ ] "saat kaç" → doğru tarih/saat
- [ ] "15 çarpı 23 kaç eder" → 345 (hesap tool'u)

**Not:** _______________________________________________

---

## 4. Kontrol tool'ları — onay kapısı (4 dk)

- [ ] "sesi %30 yap" → **onay diyaloğu çıkıyor** → izin ver → ses değişiyor
- [ ] "parlaklığı azalt" → onay → değişiyor (dizüstünde; harici monitörde hata der)
- [ ] "notepad aç" → onay → Not Defteri açılıyor
- [ ] "panoya 'test' yaz" → onay → pano değişiyor
- [ ] "panoda ne var" → onaysız okuyor (güvenli işlem)

**Onay kapısını sına:**
- [ ] Bir onay diyaloğunda **Reddet** → işlem yapılmıyor, asistan bunu söylüyor
- [ ] "Hep izin ver" → aynı tool bir daha sormuyor
- [ ] Üst üste 4 yıkıcı işlem iste → **4.'de tekrar soruyor** (bütçe koruması)

**Not:** _______________________________________________

---

## 5. Dosya tool'ları (3 dk)

- [ ] "masaüstündeki dosyaları listele" → liste geliyor
- [ ] "şu dosyayı oku: ~/bir-dosya.txt" → içerik geliyor
- [ ] "masaüstüne test.txt oluştur, içine merhaba yaz" → **onay** → dosya oluşuyor
- [ ] Olmayan dosya iste → net hata mesajı (çökme yok)
- [ ] Çok büyük dosya iste → "dosya çok büyük" diyor

**Not:** _______________________________________________

---

## 6. Ses (5 dk)

- [ ] `Ctrl+M` → "sürekli dinliyor" moduna geçiyor, gösterge değişiyor
- [ ] Mikrofona konuş → metne çevriliyor, feed'e `🎤` ile düşüyor
- [ ] Asistan cevabı **sesli okunuyor**
- [ ] **Konuşurken `ESC`** → ses **anında** kesiliyor ve **sonraki cümleye geçmiyor**
      ⚠️ Eski projedeki bug buydu — özellikle dene
- [ ] `Ctrl+M` tekrar → "uyandırma kelimesi bekliyor"
- [ ] "Vavis, saat kaç" → uyanıp cevaplıyor
- [ ] Uyandırma kelimesi olmadan konuş → tepki vermiyor
- [ ] `Ctrl+M` tekrar → ses kapanıyor
- [ ] Asistan konuşurken mikrofon kendi sesini almıyor (sonsuz döngü yok)

**Not:** _______________________________________________

---

## 7. Görü ve computer use (4 dk)

- [ ] "ekranımda ne var" → ekran görüntüsü alınıyor, **model gerçekten görüyor**
      ve içeriği anlatıyor
- [ ] "ekran boyutu nedir" → doğru çözünürlük
- [ ] "şuraya tıkla: 500, 300" → **onay** → tıklıyor
- [ ] "klavyeden 'test' yaz" → **onay** → yazıyor
- [ ] "enter'a bas" → **onay** → basıyor
- [ ] Ekran dışı koordinat iste → reddediyor

**Not:** _______________________________________________

---

## 8. Medya (2 dk)

Spotify veya YouTube açıkken:

- [ ] "müziği duraklat" → **onay** → duruyor
- [ ] "devam ettir" → çalıyor
- [ ] "sonraki şarkı" → geçiyor
- [ ] "ne çalıyor" → parça adını söylüyor

**Not:** _______________________________________________

---

## 9. Hafıza (3 dk)

- [ ] "beni hatırla: kahveyi sade içerim" → kaydediyor, numara veriyor
- [ ] "hakkımda ne biliyorsun" → kaydedileni söylüyor
- [ ] "kahve hakkında ne biliyorsun" → **ek almış hâli de buluyor**
      (BM25 + Türkçe ek eşleşmesi)
- [ ] `/clear` → sohbet siliniyor ama **hafıza duruyor**
- [ ] "hakkımda ne biliyorsun" → hâlâ hatırlıyor ✓
- [ ] Uygulamayı kapat–aç → hâlâ hatırlıyor ✓
- [ ] "#1'i unut" → **onay** → siliniyor

**Not:** _______________________________________________

---

## 10. Otomasyon (5 dk + bekleme)

- [ ] "her 2 dakikada bir saati söyle" → otomasyon kuruluyor
- [ ] "kurulu otomasyonları listele" → görünüyor
- [ ] **2 dakika bekle** → `⏰ otomasyon #N` satırı düşüyor ve asistan çalışıyor
- [ ] "pil 90'ın altına inince uyar" (pil %90'ın altındaysa hemen tetiklenir)
- [ ] "otomasyon #1'i sil" → **onay** → siliniyor
- [ ] Uygulamayı kapat–aç → otomasyonlar duruyor
- [ ] `F1` → otomasyon sayısı doğru

**Not:** _______________________________________________

---

## 11. Web (2 dk)

- [ ] "bugün hava nasıl" → web araması yapıp cevaplıyor
- [ ] "şu sayfayı özetle: example.com" → sayfayı okuyup özetliyor
- [ ] Erişilemeyen adres → net hata (çökme yok)

**Not:** _______________________________________________

---

## 12. Ayarlar (2 dk)

- [ ] `/ayarlar` → mevcut ayarlar listeleniyor
- [ ] `/ayar isim Jarvis` → asistan adı değişiyor
- [ ] `/ayar yazitipi 18` → "yeniden başlatınca etkili" diyor
- [ ] Yeniden başlat → yazı tipi büyümüş
- [ ] `/ayar pencere fullscreen` → yeniden başlat → tam ekran
- [ ] `/ayar pencere windowed` → normale dönüyor
- [ ] Geçersiz değer (`/ayar yazitipi abc`) → net hata

**Not:** _______________________________________________

---

## 13. Dayanıklılık (3 dk)

- [ ] Cevap gelirken yeni mesaj yaz → "önceki cevap sürüyor" diyor, çökmüyor
- [ ] İnternet bağlantısını kes → net hata mesajı ("bağlanılamadı")
- [ ] Yanlış anahtar gir → "API anahtarı geçersiz" diyor
- [ ] Çok uzun bir metin yapıştır → kırpıyor veya sığdırıyor, 413 hatası vermiyor
- [ ] Ayar dosyasını (`vavis.toml`) elle boz → açılış çalışıyor,
      `.toml.bozuk` yedeği oluşuyor
- [ ] `logs/cokme.log` **boş olmalı** — doluysa oradaki hatayı bildir

**Not:** _______________________________________________

---

## Özet

| Bölüm | ✓ / ✗ / kısmi | Kritik sorun |
|---|---|---|
| 0. Açılış | | |
| 1. Sohbet | | |
| 2. Tool–sohbet ayrımı | | |
| 3. Sistem | | |
| 4. Kontrol + onay | | |
| 5. Dosya | | |
| 6. Ses + barge-in | | |
| 7. Görü + computer use | | |
| 8. Medya | | |
| 9. Hafıza | | |
| 10. Otomasyon | | |
| 11. Web | | |
| 12. Ayarlar | | |
| 13. Dayanıklılık | | |

**Genel değerlendirme:** _______________________________________________

---

*VAVIS · 32 tool · 393 otomatik test · manuel test ~40 dk*
