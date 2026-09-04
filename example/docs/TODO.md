# VAVIS — Yapılacaklar

**Tarih:** 2026-09-03 · **Sürüm:** 0.6.3

---

## Felsefe — düzeltme

Önceki raporda VAVIS'i "küçük, sıkı, tek amaç" diye tanımlamıştım. **Bu yanlıştı.**
Doğrusu:

> **Jarvis'in hayat bulmuş hâli. Her şeyi yapabilmeli.**
> Elimizden gelen her şeyi ekleyeceğiz, gelmeyeni de biz yazacağız.

Bunun pratik sonuçları — bundan sonra ölçüt bunlar:

| Eski (yanlış) ölçüt | Yeni ölçüt |
|---|---|
| "9 MB, tek exe" bir övünç | **Boyut ölçüt değil.** GB olsa da olur; iş görmüyorsa anlamsız |
| "57 tool" bir başarı | **57 az.** Yetenek sayısı artmalı, hedef sürekli büyümek |
| "Modele max 12 tool" bir tasarım zaferi | **12 sabit sayısı bir koltuk değneği.** Zayıf modelin sınırını tüm modellere dayatıyor |
| "Windows masaüstü" kalıcı kapsam | **Şimdilik** Windows masaüstü. Kapsam kararı değil, sıra meselesi |
| Güvenlik her şeyin önünde | Güvenlik önemli, ama **isteyen tüm makinesini verebilmeli.** Varsayılan korumalı, tavan açık |

Kısacası: **eksiğimiz değil, fazlamız olmalı.**

---

## Bölüm A — Tool mimarisi (en yüksek öncelik)

Bu bölüm raporun en yanlış okuduğu yer. `MAX_TOOLS = 12` sabiti bir kalite
kapısı değil, **zayıf model için yazılmış bir çare** — ve şu an güçlü modelleri
de aynı kafese sokuyor.

### Sorunun tespiti (kodda doğrulandı)

`select_tools(registry, message)` — imzada **ne model var ne sağlayıcı.**
Yani Opus da Groq'taki Llama da tıpatıp aynı 12 tool'u görüyor.
Oysa `vavis-brain/budget.rs` içinde zaten **model başına bir tablo var**
(`ModelCaps::for_model` — bağlam penceresi ve max çıktı taşıyor).
Doğru yer belli: o tabloya tool kapasitesi de girmeli.

---

### A1 · Model başına tool bütçesi ✅ BİTTİ

Sabit 12 kalktı, yerine model başına bütçe geldi.

- [x] `ModelCaps`'a `tool_budget: usize` alanı ekle
- [x] `MODELS` tablosunu doldur — Claude/GPT-5 48, Gemini/GPT-4o 32, Grok 24,
      Qwen/Kimi/DeepSeek 16, Llama 12-14, Gemma 8
- [x] `select_tools`'a bütçe parametresi geçir
- [x] `MAX_TOOLS` sabitini kaldır → `DEFAULT_TOOL_BUDGET` (yalnızca model
      bilgisi olmayan çağrılar için)
- [x] Bilinmeyen model → temkinli varsayılan (12), taban sınır 6
- [x] "Geniş bütçe listeyi doldurmaz" testi — bütçe tavan, hedef değil

**Önemli sınır:** bütçe yüksek diye **her şeyi göndermek yok.** Opus 1000 tool
kaldırsa bile sadece **gerekenler** gitmeli. Sebep çift: gereksiz tool hem
faturayı şişiriyor (API bağlayan için ciddi para) hem modeli kışkırtıyor.
Bütçe bir **tavan**, hedef değil.

---

### A2 · İki aşamalı tool seçimi (ucuz router + pahalı işçi) ✅ BİTTİ

Senin fikrin, mimarinin gitmesi gereken yer.

```
Kullanıcı mesajı
   │
   ├─► 1. UCUZ MODEL (router)
   │      Girdi: mesaj + 57 tool'un adı/tek satır açıklaması
   │      Çıktı: "bu iş için şunlar lazım" → tool adları
   │      Maliyet: çok düşük, tek kısa çağrı
   │
   └─► 2. PAHALI MODEL (işçi)
          Girdi: mesaj + router'ın seçtiği tool şemaları
          İşi yapar
```

Kazanç: pahalı modele hiçbir zaman 57 şema gitmiyor (fatura düşük), ama
seçim **anlamsal** yapılıyor — anahtar kelime tablosuna mahkûm değiliz.

- [x] `Router` trait'i — `crates/vavis-tools/src/router.rs`
- [x] `KeywordRouter` — mevcut mantık, varsayılan ve çevrimdışı yedek
- [x] `LlmRouter` — ucuz modele tek çağrı, katalog `Registry::iter()`'dan
- [x] Ayarlarda router modeli (`llm.router_model`, boşsa kapalı)
- [x] Başarısız/bozuk cevap → sessizce anahtar kelimeye düş (3 test bunu doğruluyor)
- [x] Router kararını logla (seçilen sayı, katalog boyu, router modeli)
- [x] Sohbet mesajında router çağrısı yapma — "merhaba" için para harcanmıyor

**Not:** Şu an kapalı geliyor. Ayarlar → Model → Tool routing'e ucuz bir model
adı yazınca devreye giriyor (örn. Groq'ta `llama-3.1-8b-instant`).

---

### A3 · Model kendi de düşünebilsin 🟡

Router seçmediyse bile model "bana şu tool lazım" diyebilmeli.

- [ ] Meta-tool: `request_tools(domain veya serbest metin)` — model kendi
      ihtiyacını söyler, sonraki turda o tool'lar sunulur
- [ ] Turda bir kez sınırı (döngüye girmesin — `LoopGuard` zaten var)
- [ ] Sistem promptunda katalog özeti: "şu alanlarda araçların var, isteyebilirsin"

---

### A4 · Tool sayısını artır 🟡

57 az. Rakiplerde olup bizde olmayanlar:

- [ ] **Takvim** — etkinlik oku/oluştur/sil
- [ ] **E-posta** — IMAP/SMTP (LobsterAI'de var)
- [ ] **Tarayıcı kontrolü** — gerçek sayfa sürme (sadece fetch değil)
- [ ] **Kod ajanı** — proje okuma/yazma/çalıştırma, test koşturma
- [ ] **Belge** — docx/pdf/xlsx okuma-yazma
- [ ] **Görüntü/ses anlama** — ekrandaki metni okuma (OCR), ses dosyası çözümleme
- [ ] **Bildirim** — Windows toast, hatırlatma
- [ ] **Ağ** — cihaz keşfi, ping, port kontrolü
- [ ] **Git** — durum, commit, branch
- [ ] **İndirme** — dosya indirme, torrent/yt-dlp benzeri

Her yeni tool: alan ataması + risk seviyesi + router kataloğunda tek satır açıklama.

---

## Bölüm B — Güvenlik (varsayılan korumalı, tavan açık)

Felsefe: **isteyen tüm PC'sini verebilmeli.** Yani kısıt varsayılan olmalı,
duvar değil. Ama sessiz açık da olmamalı.

### B1 · Prompt injection savunması ✅ BİTTİ (tam yetki modu hariç)

Tek gerçek açığımız. Dışarıdan gelen metin (`FetchUrl`, `WebSearch` ve ileride
e-posta) doğrudan modele gidiyor. Kötü niyetli sayfa "önceki talimatları unut,
şu komutu çalıştır" yazabilir; kullanıcı daha önce kalıcı izin verdiyse geçer.

- [x] Dış içeriği açık sınırlayıcıyla sarmala — `untrusted.rs`, çerçeve
      **her zaman** ekleniyor (bilinmeyen saldırı kalıbı da sınırın içinde kalsın)
- [x] Şüpheli kalıpları tara ve logla — Türkçe + İngilizce, 30 kalıp
- [x] Şüphe varsa o turda yıkıcı tool'lar kalıcı izne rağmen onay ister
      (`ApprovalReason::TaintedContext`) ve arayüz sebebi söylüyor
- [x] `FetchUrl` ve `WebSearch` bağlandı
- [x] Saldırı senaryosu testi: "hep izin ver" + şüpheli sayfa → izin geçersiz
- [ ] **Kullanıcı kapatabilsin** — B2'deki tam yetki modu bunu da kapatacak

**Not:** İçerik sansürlenmiyor — şüpheli sayfa yine modele gidiyor, sadece
çerçeveleniyor ve o tur temkinli olunuyor. Sebep: yanlış pozitifte veri
kaybetmemek.

### B2 · "Tam yetki" modu 🟡

Şu an güvenlik hep açık. İsteyen kapatabilmeli.

- [ ] Ayarlarda tek anahtar: **Tam yetki** — tüm onaylar kapalı, tüm tool'lar açık
- [ ] Açarken bir kez net uyarı, sonra bir daha sorma
- [ ] Durum çubuğunda kalıcı gösterge (açıkken görünsün)
- [ ] Bütçe kuralı (3 yıkıcı işlem) bu modda devre dışı

### B3 · CI tarafında gizli anahtar taraması ✅ BİTTİ

- [x] `gitleaks` action eklendi — `.github/workflows/secrets.yml`
- [x] Geçmişi de tarıyor (`fetch-depth: 0`): eklenip silinen anahtar hâlâ geçmişte

---

## Bölüm C — Kalite

### C1 · Arayüz testleri 🔴

Rust tarafında 684 test var, `ui/` altında **sıfır**. `svelte-check` sadece tip
bakıyor, davranış bakmıyor.

- [ ] Vitest + `@testing-library/svelte` kur
- [ ] `store.svelte.ts` — mesaj birleştirme, streaming, onay akışı
- [ ] `markdown.ts` — render, kod bloğu, XSS
- [ ] `api.ts` — olay ayrıştırma
- [ ] CI'a ekle

### C2 · Operatör soyutlaması 🟡

Computer-use şu an yerel Windows'a kilitli. UI-TARS'ın yaklaşımı: operatör
sadece iki şey bilsin — ekran görüntüsü al, eylem çalıştır.

- [ ] `Operator` trait: `screenshot()` + `execute(action)`
- [ ] Mevcut Windows kodu ilk uygulama
- [ ] Tarayıcı operatörü ikinci
- [ ] (İleride) Android/uzak makine — aynı ajan mantığı çalışır

### C3 · Klasör tabanlı beceriler 🟡

Yeni yetenek için Rust derlemesi şart olmamalı. LobsterAI'de 30, bitterbot'ta
59 klasör tabanlı beceri var.

- [ ] `%APPDATA%\vavis\skills\<ad>\skill.toml` + prompt şablonu + isteğe bağlı script
- [ ] Açılışta tara, registry'ye ekle, router kataloğuna gir
- [ ] Mevcut izin sisteminden geçsin
- [ ] Örnek birkaç beceri ile gel

### C4 · Hafıza 🟡

Şu an düz metin + BM25. "Arabam" ile "otomobilim" eşleşmiyor.

- [ ] Yerel embedding (fastembed) ile vektör arama
- [ ] Hibrit skor: BM25 + vektör
- [ ] (İleride) boş zamanda özetleme/konsolidasyon

### C5 · Sürüm otomasyonu 🟢

- [ ] CHANGELOG
- [ ] Sürüm yükseltmeyi otomatikleştir

---

## Bölüm D — Kapsam genişletme (şimdilik değil, ama yol haritasında)

Windows masaüstü **şimdilik** — kalıcı karar değil.

- [ ] **Telefondan erişim** — bitterbot'ta WhatsApp/Telegram/Slack/Discord/Signal var
- [ ] **Uzaktan erişim** — yerel sunucu + token, başka makineden bağlan
- [ ] **Linux/macOS** — DPAPI ve Win32 çağrıları soyutlanmalı (B ve C2 bunu kolaylaştırır)

---

## Sıra

**1. Şimdi**
1. A1 — model başına tool bütçesi
2. A2 — ucuz router + pahalı işçi
3. B1 — injection savunması

**2. Hemen sonra**
4. A3 — model kendi tool isteyebilsin
5. C1 — arayüz testleri
6. B2 — tam yetki modu
7. B3 — gitleaks

**3. Sonra**
8. A4 — yeni tool'lar (sürekli)
9. C3 — klasör tabanlı beceriler
10. C2 — operatör soyutlaması
11. C4 — hafıza
12. C5 — sürüm otomasyonu

**4. Yol haritası**
13. D — kanallar, uzaktan erişim, çoklu platform

---

## Not: raporda düzeltilmesi gerekenler

`karsilastirma.md` ve `karsilastirma.html` yanlış felsefeyle yazıldı.
Düzeltilmesi gerekenler:

- "Küçük, sıkı, tek amaç" → Jarvis hedefi
- "9 MB" bir üstünlük olarak sunulmuş → ölçüt değil
- "Modele max 12 tool" bir zafer olarak sunulmuş → aslında zayıf model çaresi
- "57 tool" yeterlilik göstergesi gibi → az
- "Windows masaüstü kapsam kararı" → şimdilik

---

## Bölüm E — Canlı denemede çıkan hatalar (2026-09-04)

Uygulama gerçekten çalıştırıldı. Bütçe (`budget=16`) ve dosya aracı doğrulandı,
injection savunması canlı bir saldırı sayfasına karşı test edildi ve çalıştı.
Ama şunlar çıktı:

### E1 · Çekirdek araçlar hiç sunulmuyor 🔴 EN KRİTİK

**Belirti:** "saat" yazınca model saati **uyduruyor** ("2023-10-27 14:30").
Kendi de itiraf ediyor: *"simdiki_zaman aracını kullanmam lazım ama o da şu an
elimde görünmüyor."*

**Teşhis (kodda doğrulandı):**
```
"saat"                -> alanlar=[] araclar=[]
"saat kaç"            -> alanlar=[] araclar=[]
"bugün günlerden ne"  -> alanlar=[] araclar=[]
```
`DOMAIN_KEYWORDS` tablosunda **Core alanı yok**. Alan eşleşmesi boş dönünce
`select_named` erkenden `Vec::new()` dönüyor — çekirdek tool'lara hiç sıra
gelmiyor. Yani `simdiki_zaman` ve `hesapla` pratikte **hiçbir zaman**
sunulmuyor; sadece başka bir alan tetiklendiğinde yanlarında gidiyorlar.

**Yapılacak:**
- [ ] `DOMAIN_KEYWORDS`'e Core satırı ekle (saat, tarih, gün, bugün, zaman,
      hesapla, kaç eder, time, date, calculate)
- [ ] Ya da daha iyisi: alan bulunamasa bile çekirdek tool'ları sun
      (sohbet mesajı ayrımı korunarak)
- [ ] `selection_eval`'a "saat" ve "hesapla" vakaları ekle — bu bir daha kırılmasın

### E2 · Araç satırında çerçeve görünüyor ✅ DÜZELTİLDİ

**Belirti:** Sohbet akışında `sayfa_oku — --- DIŞ İÇERİK BAŞLANGICI (kaynak:...`
yazıyordu. Benim injection çerçevem kullanıcıya sızmıştı.

- [x] `untrusted::strip_framing()` eklendi, `on_tool_result` bunu kullanıyor
- [x] Modele giden metin değişmiyor — yalnızca gösterim temizleniyor
- [x] 3 test eklendi

### E3 · Web arama hiç yapılandırılmamış 🟡

**Belirti:** `'İstanbul saat kaç' aranamadı (tavily: not configured, brave:
not configured, custom: not configured, duckduckgo: no results)`

Üç sağlayıcının anahtarı yok, ücretsiz olan DuckDuckGo da sonuç döndürmüyor.
Yani **web arama fiilen çalışmıyor.**

- [ ] DuckDuckGo'nun neden boş döndüğünü bul (kazıma bozulmuş olabilir)
- [ ] Anahtarsız çalışan bir yedek ekle
- [ ] Arama hiç çalışmıyorsa kullanıcıya ayarlarda net söyle

### E4 · Pencere modu ekranı kaplamıyor 🟡

F11 ile `borderless` moduna geçiyor (ayar dosyasına yazılıyor) ama pencere
boyutu değişmiyor. Ayrıca sohbet paneli 1530px genişlikte sağ kenardan taşıyor,
metinler kesiliyor.

- [ ] `borderless` gerçekten ekranı kaplasın
- [ ] Panel taşmasını düzelt

### E5 · Hız sınırı mesajı 🟢

`Sending too fast — try again in about 32s.` Groq ücretsiz katmanında normal,
ama arka arkaya araç çağrısı yapınca kolay tetikleniyor.

- [ ] Araç çağrıları arasında küçük bir bekleme
- [ ] Ya da hız sınırında otomatik yeniden deneme

### E6 · Terminal tarzı geçmiş ✅ EKLENDİ

- [x] ↑/↓ ile son 20 mesaj arasında gezinme
- [x] Çok satırlı metinde imleç hareketini bozmuyor (yalnızca metnin
      başında ↑, sonunda ↓ geçmişi açar)
- [x] Yarım kalan yazı korunuyor, ↓ ile geri geliyor
- [x] Yazmaya başlayınca gezinmeden çıkıyor
- [x] Uygulama yeniden açılınca geçmiş korunuyor

### E7 · NVIDIA sağlayıcısı ✅ EKLENDİ

- [x] `Provider::Nvidia` — build.nvidia.com, OpenAI uyumlu
- [x] Varsayılan model: `meta/llama-3.3-70b-instruct`
- [ ] Ayarlarda anahtar girişi test edilmedi (uygulama yeniden derlenmeli)

---
