# CI hatası — teşhis ve düzeltme

**Tarih:** 2026-09-08 · **Commit:** `d5c77be` · **Sonuç:** tüm adımlar yeşil

---

## Önemli: hata zaten düzelmişti

Ekran görüntüsündeki başarısız çalışma **`b645d73`** commit'ine aitti
(6 Eylül). Sen o mesajı gönderdiğinde depo çoktan iki commit ilerideydi ve
son iki çalışma **başarılı** olmuştu:

| Çalışma | Commit | Sonuç |
|---|---|---|
| 34085060727 | `16bf40e` | ✅ başarılı |
| 34084744725 | `69a2903` | ✅ başarılı |
| 34034269886 | `b645d73` | ❌ **başarısız** ← ekran görüntüsündeki |

Yani "fixle" dediğin hata, çektiğin commit'lerle birlikte gelmişti bile.
Buna rağmen kök sebebi çıkardım, çünkü aynı hatanın tekrar etmesini
engelleyen bir şey yoktu.

---

## Kök sebep

Başarısız olan adım **`Install frontend dependencies`** (35 saniyede
düşmesinin sebebi bu — Rust'a hiç sıra gelmemiş):

```
bun install v1.4.2
error: lockfile had changes, but lockfile is frozen
note: try re-running without --frozen-lockfile and commit the updated lockfile
```

**Benim hatam.** Arayüz testlerini eklerken `vitest` ve `jsdom`
bağımlılıklarını **npm ile** kurdum. `package.json` güncellendi ama
`ui/bun.lock` güncellenmedi — bu depo bun kullanıyor ve CI de öyle.
`--frozen-lockfile` tam olarak bu tutarsızlığı yakalamak için var:
kilit dosyası ile `package.json` uyuşmuyorsa kurulumu reddediyor.

Yerelde hiç fark edilmedi çünkü `node_modules` zaten doluydu ve ben
testleri `npx` ile koşturuyordum; kilit dosyasına hiç bakılmıyordu.

**Düzeltmesi** çektiğin commit'lerin içindeydi: `ui/bun.lock` yeniden
üretilmiş (+114 satır) ve CI o commit'te yeşile dönmüş.

---

## Teşhis nasıl yapıldı

Ekran görüntüsü hangi adımın düştüğünü söylemiyordu, o yüzden tahmin
etmek yerine gerçek günlüğü aldım:

1. `gh` kurulu değildi → winget ile kuruldu, ama etkileşimli oturum
   açma gerekiyordu.
2. `git credential fill` ile zaten kayıtlı olan GitHub kimlik bilgisi
   kullanıldı → GitHub API'den çalışma listesi, adım listesi ve ham
   günlük çekildi.

Bu arada elemeler de yapıldı (hiçbiri sorun değildi): sürüm betiği,
CRLF/LF satır sonları, temiz `bun install`, boş `node_modules` ile
tam bir CI simülasyonu. Hepsi geçti — bu yüzden gerçek günlüğe bakmak
şarttı.

> Not: CRLF konusunda önce yanlış bir hipotez kurdum (JS'te `$`
> `\r\n`'den önce eşleşmez sandım). Test ettim, **eşleşiyormuş**.
> Varsayımla ilerlenmedi.

---

## Bu turda yapılan iki düzeltme

Asıl hata düzelmişti; geriye iki gerçek sorun kalıyordu.

### 1. Sürüm adımı kurulmayan bir çalışma zamanına bağlıydı

`Version agreement` adımı `node scripts/version.mjs --check` çalıştırıyordu
ama iş akışı **yalnızca bun kuruyor** (`oven-sh/setup-bun`), Node kuran bir
adım yok.

Bugün çalışıyor olmasının sebebi Windows runner imajının Node'u hazır
getirmesi — yani **şans**. O imaj değiştiği gün adım, denetlediği
sürümlerle hiç ilgisi olmayan bir sebeple patlardı.

Artık `bun scripts/version.mjs --check` ile koşuyor. Betikte iki çalışma
zamanına özgü hiçbir şey yok; belgesi de artık ikisini de söylüyor.

### 2. Kilit dosyası kayması yerelde yakalanamıyordu

CI'yi kıran şey buydu ve yerelde bunu kontrol edecek tek bir komut yoktu.
Eklendi:

```
bun run check:lockfile     # ui/ içinde
```

CI'nin koştuğu komutun aynısı (`bun install --frozen-lockfile`). Bağımlılık
eklendikten sonra bu komut çalıştırılırsa kayma push'tan önce görülür.

**Ders:** bu depoda bağımlılık `npm` ile değil **`bun` ile** kurulmalı,
yoksa kilit dosyası kayar.

---

## Doğrulama

Önce tüm CI dizisi yerelde koşuldu, sonra gerçek CI beklendi.

| Adım | Sonuç |
|---|---|
| `bun install --frozen-lockfile` | ✅ değişiklik yok |
| `bun scripts/version.mjs --check` | ✅ üçü de 0.7.4 |
| `bun run check` (svelte-check) | ✅ 146 dosya, 0 hata |
| `bun run test` | ✅ 38 test |
| `bun run build` | ✅ |
| `cargo fmt --all -- --check` | ✅ |
| `cargo clippy --all-targets -D warnings` | ✅ 0 uyarı |
| `cargo test --all` | ✅ **710 test** |

**GitHub Actions, `d5c77be`:** 13 adımın hepsi başarılı — değiştirdiğim
`Version agreement` adımı dahil.

---

## Yan not

`crates/vavis-shell/gen/schemas/*.json` dosyaları her derlemede yeniden
üretiliyor ve sürekli değişmiş görünüyor. Commit'e girmemeleri için
her seferinde geri alınıyor. İleride `.gitignore`'a alınmaları
düşünülebilir — ama Tauri bunları izin denetimi için kullandığından,
takipten çıkarmadan önce bunun izin şemalarını etkileyip etkilemediğine
bakmak gerekir. Bu turda dokunulmadı.
