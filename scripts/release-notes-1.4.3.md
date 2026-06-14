## AEGIS v1.4.3

> **Çoğu kullanıcı için önerilen indirme:** `AEGIS-Setup-1.4.3.exe` — kurulum sihirbazıyla gelir, masaüstü/başlat menüsü kısayolu oluşturur ve otomatik güncelleme alır. Sıradan kullanıcılar bunu indirmeli.
>
> Kurulum istemeyen / taşınabilir kullanım için: `AEGIS-1.4.3.exe` (portable — kurulum yapmadan doğrudan çalışır).

### Düzeltmeler
- **Kokoro TTS artık paketlenmiş app'te gerçekten çalışıyor.** Kütüphane (kokoro-js + onnxruntime) kuruluma dahil edildi; "İNDİR" sadece ~900MB model ağırlıklarını yazılabilir klasöre indiriyor (eski `spawn cmd.exe ENOENT` hatası giderildi). "Sil" gerçekten siliyor ve durum diskten doğrulanıyor. (1.4.1'de kütüphane CI cache sorunu yüzünden pakete girmemişti — düzeltildi.)
- **Spotify "Beğenilen Şarkılar" çalma + takılma giderildi.** "Şu listeyi çal" deyince "playlist bulunamadı" ve ~1 dakika takılma oluyordu. Beğenilen Şarkılar (Liked Songs) Spotify'da normal playlist değil; artık önce gerçek playlist'ler aranıyor, bulunamazsa Liked Songs özel olarak çalınıyor, gereksiz tekrar deneme (takılma) kalktı.

### Kurulum
1. `AEGIS-Setup-1.4.3.exe` indir ve çalıştır.
2. Kurulum dizinini seçip ilerle — kısayollar otomatik oluşur.
3. Uygulama açıldığında ayarlardan AI sağlayıcı anahtarını gir.

> Windows SmartScreen uyarısı çıkarsa (imzasız build): **Daha fazla bilgi → Yine de çalıştır**.
