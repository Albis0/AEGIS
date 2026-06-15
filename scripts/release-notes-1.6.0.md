# AEGIS v1.6.0 — Jarvis Güvenilirlik Güncellemesi

AEGIS'in "bi çalışıyor bi çalışmıyor" hissini azaltan, referans komutlarını tutarlı ve tahmin edilebilir hale getiren güvenilirlik sürümü.

## ⬇️ İndirme

| Dosya | Kim için |
|---|---|
| **AEGIS-Setup-1.6.0.exe** ⭐ **(önerilen)** | Sıradan kullanıcı — kurulum sihirbazı, Başlat menüsü + masaüstü kısayolu, otomatik güncelleme |
| AEGIS-1.6.0.exe | Taşınabilir (portable) — kurulum istemeyenler için tek dosya |

## ✨ Yenilikler

- **Deterministik referans çözücü:** "tekrar yap", "onu kapat", "biraz azalt", "son oynadığım oyunu aç", "aynısını yap", "bir öncekini" gibi komutlar artık kural tabanlı ve tutarlı çözülüyor — modele bırakılmıyor. (Bu bir *refleks*; arama/uygulama açma/planlama hâlâ AI'ın işi.)
- **Güçlendirilmiş kısa süreli hafıza:** Her işlem hangi nesne üzerinde (oyun, dosya, şarkı, uygulama) ve hangi kaynakla (model mi refleks mi) yapıldığını hatırlıyor.
- **Bağlama duyarlı delta:** "biraz azalt" = ±5, "biraz daha" = ±10; 0–100 aralığında sınırlanır.
- **Güven katmanı:** Emin olunmadığında rastgele işlem yapmak yerine netleştirme sorulur.
- **Açıklama Modu (geliştirici):** Açıkken niyet, güven skoru ve referans çözümleme adımları gösterilir.

## ✅ Kalite

- Tool şema↔executor doğrulaması: **316/316** temiz
- Birim testleri: **82/82** (16 yeni referans-çözücü testi)
- Konuşma senaryoları: **60/60** (5 yeni güvenilirlik senaryosu)
- TypeScript (electron + renderer) + Vite üretim derlemesi temiz

---

🇬🇧 **EN:** Jarvis Reliability Upgrade — reference commands ("do it again", "close it", "turn it down a bit", "open the last game I played") are now resolved by deterministic rules instead of the model. Short-term memory remembers what each action acted on and its source. When unsure, AEGIS asks instead of guessing. New developer "Explain Mode". **Recommended download: AEGIS-Setup-1.6.0.exe** (installer); AEGIS-1.6.0.exe is portable.
