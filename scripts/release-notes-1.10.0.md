# AEGIS v1.10.0 — Görsel Paneller

Şimdiye kadar yalnız Spotify'ın canlı bir arayüzü vardı; diğer alanlar sadece metin döndürüyordu. Bu sürüm, durumu/etkileşimi görsel sunmaya değen domain'lere Spotify kalitesinde UI getiriyor. (ROADMAP Faz 63.)

## 🎛️ Sol panelde 3 yeni canlı widget
- **Steam** — çalışan oyun(lar)ı gösterir, üstüne gelince "oyunu kapat" butonu.
- **Pomodoro** — canlı geri sayım + faz (odaklanma/mola) + durdur butonu.
- **Akıllı Ev** — cihaz/açık ışık sayısı + "Tümünü Aç / Kapat" (Home Assistant yoksa görünmez).

## 🧠 Hafıza penceresi
Başlık çubuğundaki beyin simgesi → AEGIS'in senin hakkında öğrendiği her şeyi gör, içinde anlamca ara ("geçen ay X hakkında ne demiştim?"), istemediğini sil.

## 🗂️ Komut Merkezi
Başlık çubuğundaki ızgara simgesi → tek pencerede sekmeler:
**Görevler** (zamanlanmış görevler + izleme koşulları) · **Bilgi** (indekslenmiş dosyalar + arama) · **Otomasyon** (kurallar/makrolar/rutinler) · **Öğrenme** (hedefler + okuma listesi) · **Kişilik** (aktif + mevcut personalar) · **Pluginler** (yüklü + ara).

---

## 🔧 Altyapı
- Genel `runTool` köprüsü: tüm görsel paneller canlı veriyi tek IPC'den çeker.
- Yeni `pomodoro_status` tool'u (canlı geri sayım için).

**Kalite:** 511 test (35 dosya) · trio 332/332 · eval %100 · convo 105/0 — hepsi yeşil.

**İndirme:** `AEGIS-Setup-1.10.0.exe` (önerilen kurulum) · `AEGIS-1.10.0.exe` (portable)
