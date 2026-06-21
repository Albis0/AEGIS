# AEGIS v1.6.1 — Çok Dilli Güvenilirlik

Türkçe zaten sağlamdı; bu sürüm İngilizce, Almanca, Fransızca ve İspanyolca komutları da aynı seviyeye getirir. Ek olarak Spotify ve Steam'de iki güvenilirlik düzeltmesi.

## ⬇️ İndirme

| Dosya | Kim için |
|---|---|
| **AEGIS-Setup-1.6.1.exe** ⭐ **(önerilen)** | Sıradan kullanıcı — kurulum sihirbazı, Başlat menüsü + masaüstü kısayolu, otomatik güncelleme |
| AEGIS-1.6.1.exe | Taşınabilir (portable) — kurulum istemeyenler için tek dosya |

## ✨ Düzeltmeler

- **Çok dilli tool desteği:** İngilizce/Almanca/Fransızca/İspanyolca komutlar artık doğru aracı çağırıyor. Önceden "play music", "Lautstärke einstellen", "lis le fichier", "aumenta el brillo" gibi komutlar bu dillerde bazen hiç çalışmıyordu — sadece Türkçe sağlamdı. (Tool seçim motoruna bu dillerin fiil kökleri eklendi; ölçüm: EN 2→0, DE 7→0, FR 8→0, ES 8→0 kayıp.)
- **Spotify "Model yanıt üretemedi" hatası giderildi:** "play killshot" / "change it to X" gibi komutlar artık hata vermiyor; şarkıyı adıyla çalma tek araçla çalışıyor.
- **Steam istek listesi:** "oyunu istek listeme ekle" artık mağaza sayfasını açıp "+ İstek Listesine Ekle" butonuna otomatik tıklamayı deniyor (eskiden sadece sayfayı açıyordu; computer-use kırılgandır, başarısızsa elle eklenebilir).

## ✅ Kalite

- Tool şema↔executor doğrulaması: **316/316** temiz
- Birim testleri: **82/82**
- Konuşma senaryoları: **105/105** (+44 çok dilli senaryo: 11 araç × 4 dil)
- Yanlış-pozitif kontrolü: 34 çok dilli sohbet mesajı (thanks/danke/merci/gracias…) → 0 araç
- TypeScript (electron + renderer) + Vite üretim derlemesi temiz

---

🇬🇧 **EN:** Multilingual reliability — English/German/French/Spanish commands now trigger the correct tool (Turkish was already solid). Also fixes the Spotify "model could not generate a response" error on "play X" / "change it to X", and Steam wishlist now auto-clicks "+ Add to wishlist" via computer-use. **Recommended download: AEGIS-Setup-1.6.1.exe** (installer); AEGIS-1.6.1.exe is portable.
