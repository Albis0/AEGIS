## AEGIS v1.5.1

> **Çoğu kullanıcı için önerilen indirme:** `AEGIS-Setup-1.5.1.exe` — kurulum sihirbazıyla gelir, masaüstü/başlat menüsü kısayolu oluşturur. Sıradan kullanıcılar bunu indirmeli.
>
> Kurulum istemeyen / taşınabilir kullanım için: `AEGIS-1.5.1.exe` (portable).

### Düzeltme: Güncelleme indirme hatası
- **"Please check update first" hatası giderildi.** "Güncellemeleri Denetle" butonu ham GitHub isteği yapıyor, indirme motorunu beslemiyordu; "İndir"e basınca güncelleme motoru "önce kontrol et" diye reddediyordu. Artık **denetleme ve indirme aynı güncelleme motorunu** kullanıyor — indirme öncesi otomatik kontrol garanti.

> **Not (mevcut 1.4.5 / 1.5.0 kullanıcıları):** Bu düzeltme uygulama içine yerleştiği için, ona ulaşmak üzere bu sürümü **bir kez elle** kurman gerekir (eski güncelleyici bozuktu). 1.5.1'i kurduktan sonra **sonraki güncellemeler uygulama içinden sorunsuz inecek**.

### Kurulum
1. `AEGIS-Setup-1.5.1.exe` indir ve çalıştır.
2. Kurulum dizinini seçip ilerle — kısayollar otomatik oluşur.
3. Açıldığında ayarlardan AI sağlayıcı anahtarını gir.

> Windows SmartScreen uyarısı çıkarsa (imzasız build): **Daha fazla bilgi → Yine de çalıştır**.
