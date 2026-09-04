# VAVIS — Yapılacaklar

**Tarih:** 2026-09-04 · **Sürüm:** 0.6.3

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

### A3 · Model kendi de düşünebilsin ✅ BİTTİ

Router seçmediyse bile model "bana şu tool lazım" diyebiliyor.

- [x] Meta-tool: `arac_iste(ihtiyac)` — model ne yapmak istediğini yazar,
      sonraki adımda ilgili tool'lar sunulur
- [x] Tur başına 2 istek sınırı. Sınırın ötesi **hata değil**, başarılı bir
      cevap: "yeterince istendi, eldekiyle devam et" — hata dönmek modeli
      düzeltmeye çalışmaya iterdi
- [x] İstenen tool'lar **eklenir**, mevcutların yerine geçmez — model tur
      ortasında elindekini kaybetmez
- [x] Sistem promptunda tek cümle: "elinde yoksa uydurma, `arac_iste` ile iste"

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

### B1 · Prompt injection savunması ✅ BİTTİ

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
- [x] **Kullanıcı kapatabilsin** — B2'deki tam yetki modu bunu da kapatıyor

**Not:** İçerik sansürlenmiyor — şüpheli sayfa yine modele gidiyor, sadece
çerçeveleniyor ve o tur temkinli olunuyor. Sebep: yanlış pozitifte veri
kaybetmemek.

### B2 · "Tam yetki" modu ✅ BİTTİ

- [x] Ayarlarda tek anahtar: **Tam yetki** — Ayarlar → Tools → Permissions
- [x] Açarken bir kez net uyarı, sonra bir daha sorma. Kapatırken onay yok:
      korumayı geri açmak riskli yön değil
- [x] Durum çubuğunda kalıcı gösterge — etkisi "hiçbir şey çıkmaması" olan bir
      modun kendisi görünmez olmamalı
- [x] Bütçe kuralı (3 yıkıcı işlem) bu modda devre dışı
- [x] **Enjeksiyon koruması da kapanıyor.** Bilinçli: o koruma tam olarak
      "kullanıcının kendi izninin arkasından iş çevrilmesi"ne karşı var, ve tam
      yetki tam olarak o korumayı kapatma tercihi. Yarısını açık bırakmak
      anahtarı yalancı yapardı
- [x] Ayar dosyasında `[security] full_authority`, varsayılan `false`

### B3 · CI tarafında gizli anahtar taraması ✅ BİTTİ

- [x] `gitleaks` action eklendi — `.github/workflows/secrets.yml`
- [x] Geçmişi de tarıyor (`fetch-depth: 0`): eklenip silinen anahtar hâlâ geçmişte

---

## Bölüm C — Kalite

### C1 · Arayüz testleri ✅ BİTTİ

Rust tarafında 710 test vardı, `ui/` altında sıfır. Artık 38 test var.

- [x] Vitest + jsdom kuruldu (`ui/vitest.config.ts`, `bun run test`)
- [x] `markdown.ts` — **XSS**, kod bloğu, akış sırasında yarım kalan girdi.
      Model cevabı güvenilmez metin ve `innerHTML`'e gidiyor; buradaki en
      önemli test kümesi bu
- [x] `store.svelte.ts` — komut geçmişi (yarım kalan yazının korunması dahil),
      akan cevapların tek balonda birleşmesi, boş balonun düşürülmesi
- [x] CI'a eklendi
- [ ] ~~`api.ts` — olay ayrıştırma~~ **Yapılmadı, bilinçli.** `api.ts` yalnızca
      `invoke` sarmalayıcısı; test edilecek mantık yok, testi mock'u test
      ederdi. Mantığın olduğu yer store, ve olay işleyicileri oradan test edildi

**Not:** `ChatStore` sınıfı testler için dışa açıldı — testler kendi
örneklerini kuruyor, yoksa biri diğerinin geçmişini devralıyordu.

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

### C5 · Sürüm otomasyonu ✅ BİTTİ

- [x] `CHANGELOG.md` — gerçek git geçmişinden yazıldı
- [x] `scripts/version.mjs` — sürüm üç dosyada birden duruyor
      (`Cargo.toml`, `ui/package.json`, `tauri.conf.json`); betik üçünü
      birden değiştiriyor. `major`/`minor`/`patch` ya da doğrudan numara
- [x] `--check` üçünün aynı olduğunu doğruluyor, CI'da koşuyor — uyuşmazlık
      kendi kurulumundaki sürümle farklı bir ikili yayınlamak demek ve başka
      hiçbir şey bunu fark etmiyor

---

## Bölüm D — Kapsam genişletme (şimdilik değil, ama yol haritasında)

Windows masaüstü **şimdilik** — kalıcı karar değil.

- [ ] **Telefondan erişim** — bitterbot'ta WhatsApp/Telegram/Slack/Discord/Signal var
- [ ] **Uzaktan erişim** — yerel sunucu + token, başka makineden bağlan
- [ ] **Linux/macOS** — DPAPI ve Win32 çağrıları soyutlanmalı (B ve C2 bunu kolaylaştırır)

---

## Durum

**Bitti:** A1 (model başına bütçe) · A2 (ucuz router) · A3 (model kendi tool
isteyebiliyor) · B1 (injection savunması) · B2 (tam yetki) · B3 (gitleaks) ·
C1 (arayüz testleri) · C5 (sürüm otomasyonu) · E1, E2, E3, E4, E5, E6, E7

**Kalan:** A4 (yeni tool'lar — bu hiç bitmez, felsefe bu) · C2 (operatör
soyutlaması) · C3 (klasör tabanlı beceriler) · C4 (hibrit hafıza) ·
D (kanallar, uzaktan erişim, çoklu platform)

Testler: 710 Rust + 38 arayüz, sıfır hata.

## Sıra

**1. Şimdi**
1. A4 — yeni tool'lar. **Asıl iş bu.** "Eksiğimiz değil fazlamız olmalı"
   cümlesinin karşılığı burada; geri kalanı altyapı. Takvim ve bildirim
   ucuz ve hemen işe yarar, tarayıcı kontrolü ile kod ajanı en çok açan iki
   tanesi
2. C3 — klasör tabanlı beceriler. A4'ü **çarpan**: yeni yetenek için Rust
   derlemesi gerekmezse yetenek sayısı derleme hızından bağımsız büyür

**2. Sonra**
3. C2 — operatör soyutlaması (tarayıcı kontrolü zaten buna ihtiyaç duyacak)
4. C4 — hibrit hafıza

**3. Yol haritası**
5. D — kanallar, uzaktan erişim, çoklu platform

---

## Not: rapor düzeltildi ✅

`karsilastirma.md` ve `karsilastirma.html` yanlış felsefeyle yazılmıştı.
İkisi de düzeltildi:

- [x] "Küçük, sıkı, tek amaç" → Jarvis hedefi. Başa bir düzeltme notu kondu:
      ölçümler doğruydu, yanlış olan yorumlardı
- [x] "9 MB" bir üstünlük olarak sunulmuştu → tablodan çıkarıldı. İş görmeyen
      9 MB'ın iş gören 900 MB'a üstünlüğü yok. Kurulum olmaması ise gerçek bir
      kazanç ve öyle yazıldı — dosya boyutundan bağımsız
- [x] "Modele max 12 tool" bir zafer gibi sunulmuştu → o sınırın zayıf model
      çaresi olduğu ve kaldırıldığı yazıldı. Sonuç bölümünde de açıkça
      geri alındı
- [x] "57 tool" yeterlilik göstergesi gibiydi → "58 — az" oldu
- [x] "Windows masaüstü kapsam kararı" → "şimdilik"
- [x] Kapanan bulgular güncellendi: injection, arayüz testleri, gitleaks ve
      sürüm otomasyonu artık "Kapatıldı" diyor. Açık kalan üç bulgu (klasör
      tabanlı beceriler, operatör soyutlaması, hafıza) olduğu gibi bırakıldı

---

## Bölüm E — Canlı denemede çıkan hatalar (2026-09-04)

Uygulama gerçekten çalıştırıldı. Bütçe (`budget=16`) ve dosya aracı doğrulandı,
injection savunması canlı bir saldırı sayfasına karşı test edildi ve çalıştı.
Ama şunlar çıktı:

### E1 · Çekirdek araçlar hiç sunulmuyor ✅ DÜZELTİLDİ

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

**Yapıldı:**
- [x] `DOMAIN_KEYWORDS`'e Core satırı eklendi
- [x] Zaman isimleri (`bugün`, `gün`, `zaman`) **zayıf** sayılıyor: yanlarında
      güçlü bir kelime yoksa alan açılmıyor. Yoksa "bugün nasılsın" cümlesi de
      araç listesi çekerdi — düzeltmenin diğer yarısı bu
- [x] Aritmetik ifade kelimeden bağımsız yakalanıyor: "15 * 3 kaç eder"
      cümlesinde niyeti belli eden şey kelime değil, iki sayı arasındaki
      operatör. ("kaç eder" iki kelime olduğu için anahtar kelime tablosuna
      giremiyordu — tablo boşlukta bölüyor.)
- [x] `selection_eval`'a 9 çekirdek vakası eklendi
- [x] İki regresyon testi: biri saatin sunulduğunu, diğeri sohbetin
      tetiklemediğini sabitliyor

### E2 · Araç satırında çerçeve görünüyor ✅ DÜZELTİLDİ

**Belirti:** Sohbet akışında `sayfa_oku — --- DIŞ İÇERİK BAŞLANGICI (kaynak:...`
yazıyordu. Benim injection çerçevem kullanıcıya sızmıştı.

- [x] `untrusted::strip_framing()` eklendi, `on_tool_result` bunu kullanıyor
- [x] Modele giden metin değişmiyor — yalnızca gösterim temizleniyor
- [x] 3 test eklendi

### E3 · Web arama hiç yapılandırılmamış ✅ DÜZELTİLDİ

**Belirti:** `'İstanbul saat kaç' aranamadı (tavily: not configured, brave:
not configured, custom: not configured, duckduckgo: no results)`

Üç sağlayıcının anahtarı yok, ücretsiz olan DuckDuckGo da sonuç döndürmüyor.
Yani **web arama fiilen çalışmıyor.**

**Teşhis:** kazıma bozulmamış — kullanılan uç nokta (Instant Answer API)
zaten yalnızca **ansiklopedik varlıkları** biliyor. "rust programming language"
tam bir özet döndürüyor, "istanbul saat kaç" ise bomboş bir belge. Yani hata
değil, yanlış uç nokta: anahtarı olmayan kullanıcının yazdığı hemen her şey
boş dönüyordu.

- [x] Genel sorgular için Lite uç noktasına düşülüyor — anahtarsız, gerçek web
      sonuçları. Önce API deneniyor: yapısal cevap ayrıştırılmış cevaptan iyi
- [x] `Answer` alanı okunuyor — hesaplanan cevapları (çevrim, gün doğumu)
      taşıyan alan atılıyordu, ki bu uç noktanın gerçekten iyi olduğu tek şey
- [x] **Kısıtlama sayfası ayırt ediliyor.** HTTP 200 dönüyor, dolayısıyla
      durum kodundan anlaşılmıyor; "sonuç yok" demek zincire yalan söylemekti
      ve zincir bir sonraki soruda aynı uç noktayı yine deniyordu
- [x] Ayarlardaki açıklama düzeltildi
- [x] Ayrıştırıcı **gerçek sayfaya** karşı test ediliyor (yakalanmış fixture),
      ayrıştırıcıya uydurulmuş markup'a karşı değil
- [x] Ağa çıkan test: anahtarsız kullanıcı sonuç alıyor mu
      (`cargo test -p vavis-tools --test websearch_live -- --ignored`)

### E4 · Pencere modu ekranı kaplamıyor ✅ DÜZELTİLDİ

F11 ile `borderless` moduna geçiyor (ayar dosyasına yazılıyor) ama pencere
boyutu değişmiyor. Ayrıca sohbet paneli 1530px genişlikte sağ kenardan taşıyor,
metinler kesiliyor.

**Teşhis:** F11 yolu ile açılış yolu **ayrı ayrı yazılmıştı** ve yalnızca
açılıştaki çalışıyordu. Ön yüz `maximize()` çağırıyordu; başlık çubuğu kapalı
bir pencerede "maximized" güvenilir biçimde çalışma alanının tamamı değil.
Ayrıca tam ekrandan çıkmak anlık değil — aynı nefeste maximize istemek yarışı
kaybediyor.

- [x] Tek bir arka uç komutu (`set_window_mode`) hem taşıyor hem kaydediyor;
      açılış da onu çağırıyor. İki uygulama vardı, artık bir tane var
- [x] Kenarlıksız modda monitör ölçülüp boyut doğrudan veriliyor
- [x] Panel taşması: `.body` satırında `min-width: 0` eksikti. Flex satırının
      çocukları varsayılan olarak `min-width: auto`, dolayısıyla toplamları
      pencereyi aşabiliyor ve panel sağ kenardan taşıyordu

### E5 · Hız sınırı mesajı ✅ DÜZELTİLDİ

`Sending too fast — try again in about 32s.` Groq ücretsiz katmanında normal,
ama arka arkaya araç çağrısı yapınca kolay tetikleniyor.

- [x] Sağlayıcının söylediği bekleme **uygulanıyor**. Bu bilgi zaten geliyordu
      ve atılıyordu
- [x] En fazla iki kez, ve yalnızca süre **açıkça söylendiyse**: söylenmediyse
      tahmin yürütmek net bir mesajı açıklanamayan bir duraklamaya çevirirdi
- [x] 60 saniyeden uzun bekleme reddediliyor — orası dakikalık sınır değil,
      günlük kota; kullanıcı spinner izlemek yerine bilgilendirilmeli
- [x] Beklerken sohbette söyleniyor: sessiz 20 saniye donma gibi okunuyor
- [ ] Araç çağrıları arasında sabit bekleme — **yapılmadı, gerek kalmadı.**
      Sınıra çarpmadan yavaşlatmak, çarpınca beklemekten kötü

### E6 · Terminal tarzı geçmiş ✅ EKLENDİ

- [x] ↑/↓ ile son 20 mesaj arasında gezinme
- [x] Çok satırlı metinde imleç hareketini bozmuyor (yalnızca metnin
      başında ↑, sonunda ↓ geçmişi açar)
- [x] Yarım kalan yazı korunuyor, ↓ ile geri geliyor
- [x] Yazmaya başlayınca gezinmeden çıkıyor
- [x] Uygulama yeniden açılınca geçmiş korunuyor

### E7 · NVIDIA sağlayıcısı ✅ BİTTİ

- [x] `Provider::Nvidia` — build.nvidia.com, OpenAI uyumlu
- [x] Varsayılan model: `meta/llama-3.3-70b-instruct`
- [x] Ayarlarda anahtar girişi: sağlayıcı listesi `Provider::ALL`'dan
      üretiliyor, dolayısıyla NVIDIA ek bir değişiklik olmadan çıkıyor

---
