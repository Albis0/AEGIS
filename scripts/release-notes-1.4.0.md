## AEGIS v1.4.0

> **Çoğu kullanıcı için önerilen indirme:** `AEGIS-Setup-1.4.0.exe` — kurulum sihirbazıyla gelir, masaüstü/başlat menüsü kısayolu oluşturur ve otomatik güncelleme alır. Sıradan kullanıcılar bunu indirmeli.
>
> Kurulum istemeyen / taşınabilir kullanım için: `AEGIS-1.4.0.exe` (portable — kurulum yapmadan doğrudan çalışır).

### Bu sürümde
- **Spotify Web API tam entegrasyonu** — 96 endpoint; sanatçı/albüm/şarkı/playlist/öneri/takip ve çok daha fazlası. Sanatçı fonksiyonları artık isim de kabul ediyor (isim→ID otomatik çözümleme).
- **Tool güvenilirliği** — 263 aracın tamamı statik (schema↔executor↔param) + runtime edge-case doğrulamasından geçti. `delete_file`/`move_file` şemaları eklendi, tip-zorlama ve Spotify sanatçı crash'i düzeltildi.
- **Tool seçim kök neden düzeltmeleri** ("bi çalışıyor bi çalışmıyor"):
  - Şema `number` paramları `string`'e çevrildi — Groq'un `tool_use_failed` reddi giderildi (53+ araç etkileniyordu).
  - 64-tool limiti artık eşleşen domain araçlarını kırpmıyor.
  - Eksik kök kelimeler (pomodoro, indeks, dns, çeviri, rapor, sistem optimizasyonu…) eklendi.
  - Referans çözümleme için sticky-context (önceki turn'ün domain araçları korunuyor).
- **Konuşma test harness'i** — 55 senaryo / 76 adım deterministik doğrulama (CI) + opsiyonel canlı Groq modu.
- Kısa süreli bellek (short-term memory) + referans çözümleme ("biraz azalt", "tekrar yap").
- Kokoro TTS kur/sil paneli; güncelleme ilerleme sekmesi sabit kalıyor.

### Kurulum
1. `AEGIS-Setup-1.4.0.exe` indir ve çalıştır.
2. Kurulum dizinini seçip (isteğe bağlı) ilerle — kısayollar otomatik oluşur.
3. Uygulama açıldığında ayarlardan AI sağlayıcı anahtarını gir.

> Windows SmartScreen uyarısı çıkarsa (imzasız build): **Daha fazla bilgi → Yine de çalıştır**.
