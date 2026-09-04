# Değişiklikler

Sürümler [semver](https://semver.org/lang/tr/) izliyor. Sürüm numarası üç
dosyada birden duruyor ve `node scripts/version.mjs` ile değiştiriliyor —
elle üç dosya düzenlemek, üçüncüsünün unutulması demek.

Buradaki başlıklar yapılan işi değil, **kullanıcı için değişen şeyi** anlatıyor.
Bir düzeltmenin hangi dosyaya dokunduğu git geçmişinde zaten var.

## Yayınlanmamış

### Eklendi

- **Tam yetki modu.** Ayarlar → Tools altında tek anahtar: bütün onaylar ve
  bütçeler kapanıyor. Açarken bir kez uyarı çıkıyor, sonra bir daha
  sorulmuyor. Açıkken durum çubuğunda kalıcı bir gösterge duruyor — etkisi
  "hiçbir şey çıkmaması" olan bir modun kendisi de görünmez olmamalı.
- **Model kendi aracını isteyebiliyor.** Elinde olmayan bir araca ihtiyaç
  duyduğunda `arac_iste` ile ne yapmak istediğini yazıyor, ilgili araçlar bir
  sonraki adımda sunuluyor. Anahtar kelime tablosu da yönlendirici de
  kullanıcının cümlesine bakıyor; cümlenin söylemediği ihtiyacı ikisi de
  göremiyordu.
- **Model başına araç bütçesi.** Sabit "en fazla 12 araç" kuralı kalktı. O
  sabit en zayıf modelin sınırını herkese dayatıyordu; artık sınır modelden
  geliyor. Bütçe bir tavan, hedef değil — geniş bütçe listeyi doldurmak için
  sebep değil.
- **İki aşamalı araç seçimi.** Ucuz bir model hangi araçların gerektiğine
  karar veriyor, pahalı model işi yapıyor. Varsayılan kapalı; Ayarlar → Model
  altında bir model adı yazınca devreye giriyor. Çalışmazsa sessizce anahtar
  kelime eşleşmesine düşüyor — asistan çalışmaya devam ediyor.
- **Prompt injection savunması.** Dışarıdan gelen metin açık bir çerçeveye
  alınıyor, bilinen saldırı kalıpları taranıyor, ve şüphe varsa o turda yıkıcı
  işlemler kalıcı izne rağmen onay istiyor. İçerik sansürlenmiyor: yanlış
  pozitifte veri kaybetmemek için sayfa yine gösteriliyor.
- **Terminal tarzı geçmiş.** ↑/↓ ile son 20 mesaj arasında geziniyor. Çok
  satırlı metinde imleci bozmuyor, yarım kalan yazı kaybolmuyor, uygulama
  yeniden açılınca geçmiş duruyor.
- **NVIDIA sağlayıcısı.** build.nvidia.com, OpenAI uyumlu.
- **Arayüz testleri.** Markdown kaçışı (model cevabı `innerHTML`'e gidiyor),
  komut geçmişi ve akan cevapların birleştirilmesi. Tip denetimi davranışı
  görmüyordu.
- **Sürüm betiği.** `node scripts/version.mjs` üç dosyayı birden değiştiriyor;
  `--check` üçünün aynı olduğunu doğruluyor.

### Düzeltildi

- **Saat soruluyordu, model uyduruyordu.** Çekirdek araçlar (saat, hesap
  makinesi) pratikte hiçbir zaman modele sunulmuyordu: alan tablosunda
  çekirdek satırı yoktu, alan eşleşmesi boş dönünce de seçim erkenden
  çıkıyordu. Artık "saat kaç" saat aracını getiriyor, "bugün nasılsın" ise
  hâlâ sohbet.
- **Anahtarsız web araması hiçbir şey bulmuyordu.** Kullanılan uç nokta
  yalnızca ansiklopedik varlıkları biliyor, dolayısıyla anahtarı olmayan
  kullanıcının yazdığı hemen her şey boş dönüyordu. Genel sorgular artık
  sonuç veriyor, hesaplanan cevap alanı okunuyor, ve hız kısıtlaması "sonuç
  yok" ile karıştırılmıyor.
- **Kenarlıksız pencere ekranı kaplamıyordu.** F11 yolu ile açılış yolu ayrı
  ayrı yazılmıştı ve yalnızca açılıştaki çalışıyordu. Sohbet paneli de geniş
  ekranda sağ kenardan taşıyor, metinler kesiliyordu.
- **Hız sınırı turu bitiriyordu.** Sağlayıcı ne kadar bekleneceğini söylüyor,
  bu bilgi atılıyordu. Kısa ve açıkça söylenmiş beklemeler artık bekleniyor —
  en fazla iki kez, ve yalnızca süre verildiyse.
- **Enjeksiyon çerçevesi ekrana sızıyordu.** Araç satırında "DIŞ İÇERİK
  BAŞLANGICI" yazıyordu. Çerçeve modele yazılmış bir sözleşme, kullanıcı için
  gürültü; artık yalnızca modele gidiyor.

## 0.6.1 — 2026-08-30

- Uzunluk reddi ile hız sınırı birbirine karışıyordu: iki kelimelik bir mesaja
  "konuşma çok uzadı" deniyordu. Sebep, bazı sağlayıcıların dakikalık kota
  aşımını boyut hatası gibi (413) bildirmesi.
- Çok uzayan konuşmadan çıkış yolu kullanıcıya ulaşmıyordu.
- Sığmayan araçlar yalnızca sayılıyor, listeden düşürülmüyordu.
- Çalan parça kutusu, pencere izinleri ve arayüz dili ile ilgili düzeltmeler.

## 0.6.0 — 2026-08-30

- Modal katmanı, bildirimler ve gerçek onay diyalogları.
- Kod, kanvas ve konsey görünümleri yeniden yazıldı.
- Çalan parça kutusu ekranda istenen yere konulabiliyor.
- Reaktör 2B bir gösterge yüzü olarak çiziliyor.
- Spotify tek tıkla bağlanıyor ve Windows'ta gerçekten çalışıyor.

## 0.3.0 — daha önce

- Arayüz Tauri + Svelte üzerine yeniden kuruldu.
- Kanvas, konsey ve kod arayüzleri; ayarlar yeniden tasarlandı.
- Sürüm ikilisi Defender tarafından yanlışlıkla trojan olarak işaretleniyordu.
