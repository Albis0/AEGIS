## AEGIS v1.4.1

> **Çoğu kullanıcı için önerilen indirme:** `AEGIS-Setup-1.4.1.exe` — kurulum sihirbazıyla gelir, masaüstü/başlat menüsü kısayolu oluşturur ve otomatik güncelleme alır. Sıradan kullanıcılar bunu indirmeli.
>
> Kurulum istemeyen / taşınabilir kullanım için: `AEGIS-1.4.1.exe` (portable — kurulum yapmadan doğrudan çalışır).

### Düzeltmeler
- **Spotify "Beğenilen Şarkılar" çalma + takılma giderildi.** "Şu listeyi çal" deyince "playlist bulunamadı" hatası ve ~1 dakika takılma yaşanıyordu. Sebep: Beğenilen Şarkılar (Liked Songs) Spotify'da normal bir playlist değil. Artık gerçek playlist'ler önce aranıyor, bulunamazsa Liked Songs özel olarak çalınıyor; boşuna tekrar deneme (takılma) ortadan kalktı.
- **Kokoro TTS indir/sil paketlenmiş app'te çalışıyor.** Önceki sürümde "İNDİR" `spawn cmd.exe ENOENT` veriyor, "sil" UI'ı değiştirip aslında silmiyordu. Artık model ağırlıkları yazılabilir klasöre iniyor (cmd.exe/bun gerekmez), silme gerçekten siliyor ve durum diskten doğrulanıyor.

### Kurulum
1. `AEGIS-Setup-1.4.1.exe` indir ve çalıştır.
2. Kurulum dizinini seçip ilerle — kısayollar otomatik oluşur.
3. Uygulama açıldığında ayarlardan AI sağlayıcı anahtarını gir.

> Windows SmartScreen uyarısı çıkarsa (imzasız build): **Daha fazla bilgi → Yine de çalıştır**.
