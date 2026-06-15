## AEGIS v1.5.0

> **Çoğu kullanıcı için önerilen indirme:** `AEGIS-Setup-1.5.0.exe` — kurulum sihirbazıyla gelir, masaüstü/başlat menüsü kısayolu oluşturur. Sıradan kullanıcılar bunu indirmeli.
>
> Kurulum istemeyen / taşınabilir kullanım için: `AEGIS-1.5.0.exe` (portable).

### Yeni: Steam entegrasyonu (53 yeni araç)
AEGIS artık Steam'i çok daha derin kontrol edebiliyor. Çoğu araç **anında çalışır** (API key gerektirmez); bazıları profil verisi için Steam Web API ister.

**Hemen çalışır (key gerekmez):**
- Oyun başlat / kapat / yeniden başlat, yüklü oyunları listele, çalışan oyunları gör.
- Kurulum / kaldırma / dosya doğrulama / güncelleme başlat.
- Mağazada oyun ara, **detay**, **fiyat**, **indirimler** ve **haberler**.
- Oyun klasörünü aç, disk kullanımını göster, ekran görüntüleri yöneticisini aç.

**Steam API key + SteamID girince (Ayarlar > API Keys):**
- Kütüphanen, oynama süreleri, en çok oynananlar, oyun önerisi.
- Başarımlar ve ilerleme, oyuncu istatistikleri.
- Profil özeti, Steam seviyesi.
- Arkadaş listesi, çevrimiçi arkadaşlar, bir arkadaşın oynadığı oyun, bir oyunu kimler oynuyor.

**Deneysel (Steam dışarıdan tam kontrol vermez — ilgili sayfa/diyaloğu açar):**
- İstek listesi ekle/çıkar/listele, indirme duraklat/devam/iptal, Workshop, sohbet/mesaj, yedekleme.

### Kurulum
1. `AEGIS-Setup-1.5.0.exe` indir ve çalıştır.
2. Kurulum dizinini seçip ilerle — kısayollar otomatik oluşur.
3. Açıldığında ayarlardan AI sağlayıcı anahtarını gir. Steam profil araçlarını kullanmak istersen Ayarlar > API Keys'ten Steam API Key + SteamID64 gir.

> Windows SmartScreen uyarısı çıkarsa (imzasız build): **Daha fazla bilgi → Yine de çalıştır**.
