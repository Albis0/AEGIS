# AEGIS v1.8.0

## ✨ Yeni

- **Yerel ağ cihaz keşfi** — Home Assistant olmadan da evdeki cihazları (Chromecast, akıllı TV, yazıcı, hoparlör vb.) ağda tarayıp bulur. "Ağdaki cihazları tara" deyin. (mDNS + SSDP, harici bağımlılık yok)

## 🛡️ Güvenilirlik

- 8 AI sağlayıcısının tamamı resmi dokümantasyona göre yeniden doğrulandı.
- Gemini API anahtarı artık URL query param yerine güvenli `x-goog-api-key` başlığında gönderiliyor (loglara sızma riski giderildi).
- Kullanımdan kalkan Groq modelleri (gemma2-9b-it, mistral-saba-24b, llama-4-maverick) temizlendi; UI model listesi senkronlandı.
- Gemini 3.x ve DeepSeek V4 için model yetenek kayıtları eklendi.

## 🐛 Düzeltmeler

- **E-posta SMTP kurulumu**: şifre aslında kasaya kaydedilmiyordu (sadece "kaydedildi" deniyordu) — artık gerçekten güvenli kasaya yazılıyor.

## 🔧 İç iyileştirmeler

- `tools.ts` modülerleştirildi: 330 tool şeması ayrı `tools/schemas.ts`'e taşındı (3705 → 2366 satır).
- 28 kullanılmayan kod parçası temizlendi; ajan-modu tool şeması üretimi memoize edildi.
- Test sayısı 213 → **376** (15 → 25 dosya); 4 katmanlı doğrulama (tsc ×2, trio, vitest, build) her adımda yeşil.

---

**İndirme:** `AEGIS-Setup-1.8.0.exe` (önerilen kurulum) · `AEGIS-1.8.0.exe` (portable)
