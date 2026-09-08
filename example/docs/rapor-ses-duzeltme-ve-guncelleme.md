# Sesin bozukluğu ve güncelleme sistemi

**Tarih:** 2026-09-08 · **Sürüm:** 0.7.4

---

## Kısa özet

Ses "bazen konuşuyor, bazen tuhaf şeyler söylüyor, ayarı değişmiyor"
diye bildirilmişti. Üç ayrı hata vardı ve üçü birbirini gizliyordu.
Hepsi düzeltildi. Ayrıca güncelleme sistemi eklendi.

---

## 1. Doğal ses **hiç** çalışmıyordu (403)

En büyük hata buydu ve diğer her şeyi açıklıyor.

Edge TTS bağlantısı imza doğrulaması istiyor. İmzanın yanında gönderilen
tarayıcı sürümü (`Sec-MS-GEC-Version`) `1-130.0.2849.68` yazıyordu.
Servis artık bu sürümü tanımıyor ve isteği **403 Forbidden** ile
reddediyor.

Ölçüldü, tahmin değil:

| Sürüm dizesi | Sonuç |
|---|---|
| `1-130.0.2849.68` (eskisi) | 403 Forbidden |
| `1-131.0.2903.63` | 403 Forbidden |
| **`1-143.0.3650.75`** | **bağlandı** |
| `1-152.0.3651.50` | bağlandı |

İmza hesabının kendisi doğruydu — bağımsız bir uygulamayla aynı belirteci
ürettiği doğrulandı. Sorun yalnızca sürüm dizesiydi.

**Sonucu neden bu kadar kötüydü:** yedek zinciri çalışıyordu, yani ses
tamamen susmuyordu. Her istek sessizce SAPI'ye düşüyordu. Kullanıcının
duyduğu "bozuk ses" aslında **hep yedek sesti**.

Sürüm dizesi ile `User-Agent` artık tek yerden geliyor ve bir test ikisinin
ayrışmasını engelliyor — ayrı ayrı güncellenirlerse istek yine reddedilirdi.

### Bu tekrar olacak

Edge yeni bir kararlı sürüm çıkardığında bu değer yine eskiyecek ve ses
yine sessizce SAPI'ye düşecek. Kalıcı çözüm bu değeri uzaktan almak olurdu,
ama o da güncelleme kanalını dışarıya açardı. Şimdilik: `edge_tts.rs`
içindeki `GEC_VERSION` ve `CHROMIUM_VERSION` birlikte güncellenmeli.

---

## 2. Türkçe metin İngilizce sesle okunuyordu

Bu makinede yüklü SAPI sesleri:

```
Microsoft David Desktop | en-US
Microsoft Zira Desktop  | en-US
```

Türkçe ses **yok**. Kayıtlı ayar ise `engine = "sapi"`, `language = "tr"`.

Yani Türkçe cevap, İngilizce telaffuz kurallarıyla harf harf uydurularak
okunuyordu. "Tuhaf şeyler söylüyor" tam olarak bu.

Üç değişiklik:

- **Varsayılan motor artık Edge.** Edge de anahtar istemiyor ama
  kullanıcının dilini konuşuyor. Ulaşılamazsa zincir zaten SAPI'ye
  düşüyor, yani çevrimdışı kullanıcı yine ses duyuyor.
- **SAPI dile uyan sesi seçiyor.** Ses seçilmemişse yüklü sesler
  arasından dilin sesi aranıyor. Uyan yoksa sistem varsayılanı kullanılıyor.
- **SSML'deki `xml:lang` sesin adından türüyor.** Sabit `tr-TR` yazıyordu:
  İngilizce bir ses seçildiğinde İngilizce metin Türkçe telaffuzla okunurdu.

Ayrıca dil ayarı değişince ses motoru yeniden kuruluyor. Önceden yalnızca
*duyuru* dili değişiyordu, sesin dili eski kalıyordu.

---

## 3. Ayarlardan ses değiştirilemiyordu

Arayüz hatası, ve tek satırlık bir Svelte tuzağı:

```svelte
<select value={voice.engine}>
    {#each voice.engines as e}<option value={e.id}>{e.label}</option>{/each}
</select>
```

`<select>` seçenekleri **var olmadan önce** oluşuyor. Henüz orada olmayan
bir seçeneği gösteren `value` atılıyor ve kutu ilk seçeneğe düşüyor. Yani
seçim kaydediliyordu ama ekran eski hâline dönüyordu — kullanıcıya
"değişmiyor" gibi görünüyor.

`value` yerine seçeneğin kendisinde `selected` kullanıldı. Aynı hata dil
ve pencere kutularında da vardı; ikisi de düzeltildi.

Bir de "default" seçeneği artık ne anlama geldiğini yazıyor
("default (Emel)"), boş bir seçim bırakmıyor.

---

## 4. Markdown yüksek sesle okunuyordu

Model markdown yazıyor, ses katmanına **ham** gidiyordu. Hoparlörden
çıkan şey:

> yıldız yıldız önemli yıldız yıldız … h t t p s iki nokta bölü bölü …

Yeni `speakable` modülü yalnızca **hoparlöre giden kopyayı** temizliyor;
ekrandaki metne dokunulmuyor.

| Girdi | Okunan |
|---|---|
| `**önemli**` | önemli |
| `` `dosya.txt` `` | dosya.txt |
| `[belgelere](https://…)` | belgelere |
| `https://example.com/x` | *(atlanıyor)* |
| ` ```kod bloğu``` ` | "Burada bir kod bloğu var, ekranda duruyor." |
| `\| Ad \| Değer \|` | "Ad, Değer" |

Kod bloğu okunmuyor ama **sessizce de atlanmıyor**: otuz satırlık betiği
dinlemek kimsenin işine yaramıyor, ama hiçbir şey dememek "cevabın yarısı
kayboldu" hissi verirdi.

`dosya_adi` gibi kelime içi alt çizgiler korunuyor — atılsaydı "dosyaadi"
okunurdu, daha da tuhaf.

---

## 5. Güncelleme sistemi (yeni)

İstenen: sürüm arttığında kullanıcı GitHub'dan yeni `.exe`'yi indirsin.

### Nasıl çalışıyor

1. Açılışta bir kez, deponun genel yayın listesine bakılıyor.
2. Yeni sürüm varsa **kalıcı** bir bildirim çıkıyor, "indir" düğmesiyle.
3. Düğme yayın sayfasını tarayıcıda açıyor; `.exe` ve sağlama toplamı orada.
4. Ayarlar → Updates bölümünden istendiğinde elle de kontrol edilebiliyor.

### Bilinçli kararlar

**Kendi kendine indirip kurmuyor.** Çalışan uygulamanın kendi üstüne
yazması, yarıda kaldığında ne eski ne yeni sürüm bırakır. Doğrusu Tauri'nin
imzalı güncelleyicisi olurdu, o da imzalama anahtarı istiyor; bu ikili
bilinçle imzasız yayınlanıyor. İmzasız bir ikiliyi arka planda indirip
çalıştırmak, güncelleme kanalını olduğu gibi saldırı yüzeyine çevirirdi.

**Açılan adres ikilinin içinde sabit**, ağdan gelen `html_url` değil.
Yanıttan gelen adres *veri*; onu doğrudan işletim sisteminin "şunu aç"
komutuna vermek, sahte bir yayın akışının istediği şeyi açtırabilmesi
demekti.

**Sürüm karşılaştırma metin değil sayı.** `"0.10.0" < "0.9.0"` — metin
olarak doğru, sürüm olarak yanlış. Bu hatanın sonucu sessiz olurdu:
kullanıcı 0.10.0 çıktığında 0.9.0'da kalır ve hiçbir uyarı görmezdi. Test
var.

**Başarısız kontrol "güncelsin" demiyor.** Ağ yoksa bu ayrı bir sonuç.
İkisini birleştirmek, eski sürümde kalmış birini güncel olduğuna
inandırırdı. Açılıştaki bildirim başarısızlıkta susuyor (kullanıcı
istemedi), Updates ekranı ise söylüyor (kullanıcı sordu).

**Bir kez söylüyor.** Reddedilen sürüm makineye yazılıyor, her sabah aynı
bildirim çıkmıyor. Sürüm bazında: 0.8.0'ı atlamak 0.9.0'ı da gizlemiyor.

**Gizlilik:** giden istekte kullanıcıya ait hiçbir şey yok — kimlik yok,
ayar yok, makine bilgisi yok, kimlik doğrulaması yok. Yalnızca genel yayın
listesi okunuyor.

---

## Doğrulama

| | Sonuç |
|---|---|
| `cargo test --workspace` | 15 suite'in **hepsi ok**, 0 FAILED, çıkış kodu 0 |
| `cargo clippy --all-targets` | 0 uyarı |
| `cargo fmt --check` | temiz |
| `svelte-check` | 146 dosya, 0 hata |
| `vitest` | 38 geçti |
| Canlı: Edge TTS (Türkçe) | 15984 bayt ses üretildi |
| Canlı: Edge TTS (İngilizce) | 14400 bayt ses üretildi |
| Canlı: yayın akışı | `v0.7.4` okundu, "güncel" kararı doğru |
| Canlı: Edge seçili | doğrudan konuştu, yedeğe düşmedi |
| Canlı: SAPI + İngilizce | doğrudan konuştu |
| Canlı: SAPI + Türkçe | Edge'e düştü, duyuru yapıldı |
| Canlı: uygulama | açıldı, günlükte 403 yok |
| GitHub Actions | `tests` ve `secrets` — ikisi de yeşil |

Suite sayılarını toplamak yerine **her suite'in durumuna** bakılıyor —
geçen sefer 8 kırık testi "geçti" diye bildirmemin sebebi buydu.

### Değiştirilen iki test

`default_engine_is_sapi` ve `settings_can_be_swapped_at_runtime` eski
davranışı doğruluyordu. Testi düzeltmek için değil, davranış bilerek
değiştiği için güncellendiler; yerlerine niyeti anlatan testler kondu
(varsayılan motor *anahtar istememeli ve kullanıcının dilini konuşmalı*).

---

## Yedekler

- `scratchpad/vavis-data-before-update-work/` — bu oturumdan önceki
  uygulama verisi (`keys.dat`, veritabanı, ayarlar)
- `scratchpad/before-rename/crates/` — önceki oturumdan
- `scratchpad/vavis-data-before-run/` — önceki oturumdan
- `scratchpad/branch-backup/all-refs.bundle` — deponun tüm ref'leri

Hepsi "sil" denene kadar duruyor.

## 6. Kayıtlı ayarı olan kullanıcı ne oluyor

Varsayılanı değiştirmek yalnızca **yeni** kurulumlara yarıyor. Bu makinede
kayıtlı ayar `engine = "sapi"`, `language = "tr"` — yani düzeltme
olmasaydı sen yine bozuk ses duyacaktın.

Ayarı zorla değiştirmedim: kullanıcının bilinçli seçimini üzerine yazmak
yanlış olurdu. Bunun yerine SAPI, **dile uyan ses yüklü değilse konuşmayı
reddediyor**. Reddetmek zinciri devreye sokuyor; yanlış dilde okumak ise
sessizce gürültü üretiyordu.

Fark önemli: yanlış dilde okumak *hata vermiyor*, bu yüzden hiçbir yedek
tetiklenmiyordu. Şimdi kullanıcı hem sesli duyuruyu duyuyor hem de
anlaşılır bir ses geliyor. Kullanıcı bir ses **seçmişse** ona karışılmıyor.

Canlı doğrulandı: SAPI seçili + Türkçe → Edge'e düştü, duyuru yapıldı.

---

## Açık kalan

- Edge sürüm dizesi eskidiğinde ses yine sessizce SAPI'ye düşecek
  (yukarıda, bölüm 1).
- Bu makinede Türkçe SAPI sesi yok. Windows'a Türkçe dil paketi
  eklenirse çevrimdışı ses de düzgün konuşur; şart değil, çünkü
  varsayılan artık Edge.
