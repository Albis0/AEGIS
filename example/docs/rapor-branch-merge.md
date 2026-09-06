# Dal birleştirme raporu

**Tarih:** 2026-09-06 · **Sonuç:** `main` = `610493c`, origin ile eşit

---

## Yapılan

`feat/tool-budget-and-router` dalındaki 6 commit `main`'e alındı ve
push edildi. Birleştirme **fast-forward** oldu — `main` hiç ilerlememişti,
dolayısıyla çakışma yok, birleştirme commit'i yok, geçmiş düz kaldı.

```
745e4e5..610493c  main -> main
```

Yerel `feat/tool-budget-and-router` dalı silindi (içeriği artık `main`'de).

---

## Birleştirilmeyen dal — ve neden

`origin/feat/claude-code-parity` **birleştirilmedi.** Bu bilinçli bir karar,
atlama değil.

**Sebep: bu dal aynı projenin bir dalı değil.** İki geçmişin ortak atası yok:

```
git merge-base main origin/feat/claude-code-parity  ->  (boş)
```

Kök commit'lere bakınca ne olduğu belli oluyor:

| Dal | Kök commit |
|---|---|
| `main` | `feat(f1): VAVIS iskelet - cekirdek + terminal gorunumlu arayuz` |
| `feat/claude-code-parity` | `Initial commit: Electron + Vite + React AI assistant (Jarvis)` |

Yani bu dal, VAVIS'in Rust'a geçmeden önceki **eski Electron/React
sürümü** — ayrı bir kod tabanı. Son commit'i 25 Temmuz, `main` ise 30
Ağustos'ta ilerlemiş; 360 commit ileride görünmesi ilerlemiş olmasından
değil, hiç aynı ağaçta olmamasından.

**Birleştirilseydi ne olurdu:**

- `--allow-unrelated-histories` gerekirdi (git normalde reddediyor)
- 12 dosyada çakışma: `README.md`, `LICENSE`, `.gitignore`,
  `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`,
  `.github/workflows/release.yml`, `.github/workflows/test.yml` ve üç
  issue/PR şablonu
- Depoya `electron/`, `src/`, `supabase/`, `tailwind.config.js`,
  `package.json`, `vite.config.ts` gibi ikinci bir uygulamanın tüm ağacı
  eklenirdi — Rust workspace'in yanına, çalışmayan bir React uygulaması
- İki farklı `package.json` ve iki farklı CI iş akışı çakışırdı

Kısacası: bu birleştirme depoyu tamir edilmesi gereken bir hâle sokardı,
kazanç ise sıfır olurdu. Eski koda erişim gerekirse dal `origin`'de
duruyor ve yedekte de var.

---

## Sürüm dalları

`origin/release/0.4.0`, `0.4.1`, `0.4.2` — üçü de **`main`'in içinde**:

```
release/0.4.0    contained in main
release/0.4.1    contained in main
release/0.4.2    contained in main
```

Birleştirilecek bir şey yok, zaten birleşmişler. Silinmeleri istendi ama
**uzak dal silme izni engellendi** (Claude Code izin filtresi). Silinmeleri
gerekiyorsa elle:

```
git push origin --delete release/0.4.0 release/0.4.1 release/0.4.2
```

Bunu yapmak güvenli: her üçü de `main`'in atası ve ayrıca `v0.4.2` gibi
etiketler o noktaları bağımsız olarak koruyor. Yine de acele etmeye gerek
yok — duran dal kimseye zarar vermiyor.

---

## Doğrulama

Birleştirme sonrası `main` üzerinde:

| | Sonuç |
|---|---|
| `cargo test --workspace` | **710 geçti, 0 başarısız** |
| `vitest run` | **38 geçti, 0 başarısız** |
| `version.mjs --check` | üçü de 0.6.3 |
| Çalışma ağacı | temiz |
| `main` ↔ `origin/main` | eşit |

---

## Yedekler

`scratchpad/branch-backup/` altında, silinmesi söylenene kadar duruyor:

- **`all-refs.bundle`** (4,4 MB) — deponun **her ref'i**: tüm dallar, tüm
  etiketler, `feat/claude-code-parity` dahil. Tek dosyadan tam geri
  yükleme yapılabilir:
  `git clone all-refs.bundle kurtarma`
- **`refs-before-merge.txt`** — birleştirme öncesi her ref'in tam commit
  hash'i. Bir şey yanlış giderse hangi dalın nerede olduğu buradan
  okunabilir.
