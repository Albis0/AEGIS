# AEGIS v1.9.0 — Güvenilirlik Sürümü

AEGIS bu sürümle "geniş"ten "derin"e geçiyor: daha çok kullanılan değil, daha çok **GÜVENİLEN** bir asistan. Takıldığında durur, tehlikeli işte sorar, doğruluğunu ölçer, görevi bitirir, seni hatırlar. (ROADMAP Faz 53–61 — tamamı bu sürümde.)

## 🛑 Takılmayı önleme (Loop Guard)
- Aynı işi boşuna tekrarlayıp donmak yerine AEGIS kendini durdurur ve net söyler.
- Aynı çağrı 3. kez, A-B-A-B salınımı 2. turda yakalanır; durum sorguları (telemetri vb.) muaf.

## 🔐 Yıkıcı eylem onayı
- Dosya silme, süreç kapatma, riskli komutlar artık **önce onay ister** (İptal / İzin ver / Her zaman izin ver).
- "Her zaman izin ver" kalıcı; salt-okuma işlemleri hiç sormaz; Tam PC Erişimi açıkken sormaz.

## 🛡️ Sızıntı koruması (Boundary Guard)
- Bir `.env`/şifre dosyası okutulduğunda API anahtarları, parolalar, token'lar yapay zekâya **gitmeden otomatik maskelenir** (14 desen: AWS/OpenAI/Google/GitHub/JWT/Bearer/private key…).
- Yerel Ollama hariç tüm sağlayıcılar + deneme-modu proxy korunur. Normal metin/kod bozulmaz.

## 🧠 Adaptif hafıza
- Konuşmadan **otomatik öğrenir** ("adım X", "Python kullanıyorum", "kahve severim"); çelişkide eskiyi günceller.
- `search_memory`: "geçen ay X hakkında ne demiştim?" — anlamca arama (yerel, embedding gerektirmez).

## 🧩 Görev bitirme (Goal Executor)
- Çok-adımlı görevde plan yapar, her adımı doğrular; hatayı sınıflandırıp (geçici/yetki/bulunamadı…) körlemesine tekrar yerine **yön değiştirir**.

## 🔁 Öz-iyileşme (Self-Healing)
- Aynı domain (ör. Spotify) farklı argümanlarla da olsa hep aynı hatayı veriyorsa örüntüyü tanır ve net teşhis sunar ("muhtemelen Premium gerekiyor").

## 👁️ Computer Use doğrulama
- `mouse_click verify="true"`: tıkla → ekran değişti mi doğrula → ıskaladıysa fark et.

## 🌅 Proaktif öneriler (opsiyonel, varsayılan KAPALI)
- Zamansal alışkanlıkları fark edip ("her sabah X kullanıyorsun") otomatikleştirmeyi **teklif eder, zorlamaz**. Ayarlar → Görünüm'den açılır/kapanır.

## 🎯 Tool-seçim doğruluğu ölçüldü → %100
- Yeni skorlu eval harness (40 etiketli senaryo) ile tool-seçim doğruluğu ölçülür hale geldi; bulunan açıklar kapatıldı (%82.5 → **%100**), daha az "bir çalışıyor bir çalışmıyor".

---

**Kalite:** 497 test (36 dosya) · trio 330/330 · convo 105/0 · eval %100 — hepsi yeşil.

**İndirme:** `AEGIS-Setup-1.9.0.exe` (önerilen kurulum) · `AEGIS-1.9.0.exe` (portable)
