## AEGIS v1.7.1

Güncelleyici (updater) düzeltmesi.

### 🐛 Düzeltmeler

- **İndir butonu sorunu giderildi:** Ayarlar → Hakkında ekranında "İNDİR"e bastıktan sonra buton ~2 saniye içinde geri geliyor ve indirme hiç başlamamış gibi görünüyordu. Sebep: indirme başlamadan önce yapılan ikinci sürüm kontrolü, "yeni sürüm var" olayını yeniden tetikleyip arayüz durumunu *indiriliyor*'dan *indir*'e geri çeviriyordu. Artık indirme/kurulum sürerken gelen bu olay durumu geri çevirmiyor — indirme durumu korunuyor ve ilerleme sorunsuz gösteriliyor.
- Aynı koruma App üst-seviye güncelleme bildirimi (toast) için de eklendi.
- Regresyon testleri eklendi.

---

### 📥 Kurulum

- **Önerilen:** `AEGIS-Setup-1.7.1.exe` (kurulumlu, otomatik güncelleme destekli)
- **Taşınabilir:** `AEGIS-1.7.1.exe` (portable)

> Mevcut kullanıcılar bu sürüme uygulama içinden otomatik güncellenebilir (Ayarlar → Hakkında → Güncellemeleri Denetle).
