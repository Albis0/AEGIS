# AEGIS — Windows AI asistanı (Electron + React + Vite)

Türkçe yanıt ver. Özellik bitip derleme temizse sorma, commit + push at.

Güncel durum (v1.8.0): **330 tool**, 8 AI provider, 48 electron modülü, 16 skin, 5 dil,
386 test (26 dosya). Faz 1–53 + 62 ✅; Faz 54–61 (güvenilirlik — gelecek hedef) planlı.

## Mimari

- **electron/** (main process, CJS, 47 modül) — `main.ts` giriş (runAgent tool döngüsü, system prompt); `tools.ts` (~2366 satır: `executors`+`getAllToolSchemas`+executeTool) + `tools/schemas.ts` (**330 tool** şeması, saf veri — tools.ts import+re-export eder); `ai-client.ts` (provider çağrıları, param kırpma); `model-capabilities.ts` (model yetenek kayıt defteri — sıfır-hata AI katmanı); `model-router.ts` (deterministik tool yönlendirme); `short-term-memory.ts` + `reference-resolver.ts` (referans çözümleme); `routines.ts` (deterministik çok-adımlı kayıt), `macros.ts`, `automations.ts`; `memory-plus.ts` (facts/habits/sabah özeti); `spotify.ts`, `steam.ts`, `smart-home.ts` (Home Assistant), `local-devices.ts` (HA'sız yerel ağ cihaz keşfi — mDNS/SSDP), `computer-use.ts`; `tts.ts`, `auth.ts`+`cloud-sync.ts`+`aegis-config.ts` (Supabase deneme modu/gömülü public token).
- **src/** (renderer, React) — `App.tsx` (üst seviye; update toast burada), `components/skins/registry.tsx` (4 aile × 4 ferdi), `components/settings/tabs/`, `i18n.ts` (5 dil: tr/en/de/fr/es), `changelog.ts` (yama notları), `update-state.ts` (updater toast reducer).
- IPC: `electron/preload.ts` (`window.jarvis`), tip: `src/electron.d.ts`.

## Komutlar

- `bun run dev` — vite + electron (geliştirme)
- `bun run build` — `vite build && tsc -p tsconfig.electron.json`
- `node node_modules/vitest/vitest.mjs run` — testler (npx tsc/vitest bazen yanlış global'i çeker; `node node_modules/...` kullan)
- Tip kontrol: `node node_modules/typescript/bin/tsc -p tsconfig.electron.json` ve `-p tsconfig.json --noEmit`
- `bun run test:trio` (tool schema↔executor), `test:convo` (konuşma harness), `test:gui` (Playwright updater toast)

## Release (otomatik)

1. `package.json` version bump + `src/changelog.ts`'e 5 dilli giriş (en üste).
2. commit → tag `vX.Y.Z` → push tag. GitHub Actions (`.github/workflows/release.yml`, windows) build + publish eder.
3. Release oluşunca GitHub API ile description PATCH'le (electron-builder boş bırakıyor). Asset: `AEGIS-Setup-X.Y.Z.exe` (önerilen) + `AEGIS-X.Y.Z.exe` (portable).
4. Token: `.claude` hafızasında (reference-github-token). Repo: Albis0/AEGIS (private).

## Kritik gotcha'lar (hafızada da var)

- **NSIS installer boyutu yanıltıcı**: ~261MB = LZMA sıkıştırması; "Kokoro yok" demek değil. Doğrulamak için exe'yi 7-Zip ile aç → içteki `app-64.7z` → `onnxruntime.dll` ara.
- **bun postinstall'ı güvenilmeyen paketlerde atlar** → native binary indirilmez. `package.json > trustedDependencies` (onnxruntime-node, sharp, @img/sharp-win32-x64) şart. electron.exe de aynı sebeple eksik kalabilir → `node node_modules/electron/install.js`.
- **Bu shell'de `ELECTRON_RUN_AS_NODE=1` baked** → electron.exe GUI yerine Node açar (app undefined). GUI testi için: vite + Playwright ile renderer'ı aç, `window.jarvis`'i `addInitScript` ile stub'la (stub metodları Promise döndürmeli).
- Paketlenmiş app'te asar/node_modules **salt-okunur**: runtime yazma `app.getPath("userData")`'ya. Kokoro modeli oraya iner.
- **Tool seçimi (tools.ts)**: Groq 64-tool limiti var; eşleşen grup tool'ları öne alınır. Şema `number` paramları `string` olmalı (Groq number'a string gelince tool_use_failed). Referans turnleri için STM sticky-context.

## Test

- Test stratejisini Claude belirler; kullanıcı "test yaz" demez. Her değişiklikte gerekli testi sessizce ekle (yeni özellik → birim/harness, bug fix → bug'ı yakalayan test, davranış değişikliği → regresyon). Spam yapma; aynı bug'ın geri dönmesini önleyecek kadar koruma kur.
- I/O modülleri gerçek `~/.aegis/` dosyalarıyla test edilir (`beforeEach`/`afterEach` temizlik); saf-fonksiyon modülleri (model-capabilities) mock'suz.
- Trio (`test:trio`): tool schema ↔ executor senkronu. Number paramlar string olmalı (Groq).

## Detay

Sürüm notları `scripts/release-notes-*.md`. Üretilen rapor/screenshot'lar `.gitignore`'da.
