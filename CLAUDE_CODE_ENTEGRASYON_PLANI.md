# Claude Code Yeteneklerini RealJarvis'e Entegrasyon Planı

> **Bu belge yeni bir session için yürütülebilir bir iş emridir.**
> Yeni session açıp *"CLAUDE_CODE_ENTEGRASYON_PLANI.md'yi yap"* dendiğinde,
> aşağıdaki fazları **sırayla**, mevcut mimariye dokunarak uygular.
> Referans yetenek listesi: [CLAUDE_CODE_YETENEKLERI.md](CLAUDE_CODE_YETENEKLERI.md)

---

## 0. YENİ SESSION İÇİN AÇILIŞ TALİMATI (önce bunu oku)

Sen RealJarvis/AEGIS deposunda çalışan Claude Code'sun. Görevin: aşağıdaki fazları
uygulamak. Kurallar:

1. **Önce mevcut kodu oku, sonra yaz.** Her fazın başında "Dokunulacak dosyalar"
   bölümündeki dosyaları `Read` ile aç. Havadan kod yazma.
2. **Bir fazı bitir, `bun run build` ile TypeScript'i derle, temizse commit + push at**
   (kullanıcının kuralı: özellik bitip compile temizse sormadan commit + push).
   Commit mesajı: `feat(cc): Faz N - <kısa özet>`.
3. **ROADMAP.md'yi aynı commit'te güncelle** (kullanıcının kuralı).
4. **Emoji kullanma**, UI'da SVG line-icon (currentColor) kullan.
5. **Test stratejisini sen belirle**, kullanıcıya sorma; `tests/` altına ekle,
   `bun run test` ile koştur.
6. Her faz bağımsız sevk edilebilir. Sıra önerilir ama zorunlu değil — bloke olursan
   sonraki faza geç, atladığını raporla.
7. Bitişte tek satır rapor: hangi fazlar bitti, hangi commit'ler atıldı.

### Mevcut mimari (bildiğin kabul edilir, ama doğrula)

- **Ana süreç:** `electron/` (66 modül). Kalp: [electron/agent-loop.ts](electron/agent-loop.ts)
  — `runAgentLoop`, `MAX_AGENT_STEPS=8`, `AgentDeps` DI arayüzü.
- **Araçlar:** [electron/tools/](electron/tools/) — `executor-types.ts`, `schemas.ts`,
  `exec-*.ts`. Araç şemaları `getToolSchemas(context)` ile döner.
- **İzin/güvenlik:** `permissions.ts`, `taint.ts`, `loop-guard.ts`, `boundary-guard.ts`,
  `action-verifier.ts` (destructive budget zaten `DESTRUCTIVE_BUDGET_PER_RUN=3`).
- **Kendini iyileştirme:** `self-healing.ts`, `goal-executor.ts`, `error-report.ts`.
- **Hafıza:** `memory-plus.ts`, `adaptive-memory.ts`, `short-term-memory.ts`, `knowledge.ts`.
- **Zamanlama:** `scheduler.ts`, `routines.ts`, `macros.ts`, `automations.ts`, `proactive.ts`.
- **Model:** `models.ts`, `model-router.ts`, `model-capabilities.ts`, `ai-client.ts`.
- **Bilgisayar kullanımı:** `computer-use.ts`. **Eklentiler:** `plugins.ts`, `plugin-manager.ts`.
- **Renderer:** `src/` — skins, widget'lar, `SettingsPanel.tsx`, `CommandPalette.tsx`.

> **Doğrulama şart:** Bu isimler hafızadan; her fazda gerçek imza/dışa-aktarımları
> `Read`/`Grep` ile teyit et. Değişmişse plana değil koda uy.

### Kapsam kararı

RealJarvis zaten Claude Code'un birçok yeteneğinin karşılığına sahip (araç döngüsü,
onay/izin, self-healing, hafıza, zamanlama, computer-use). Bu plan **sıfırdan inşa
değil, EKSİK OLANI eklemek + MEVCUDU Claude Code seviyesine çıkarmaktır.**

---

## Yetenek → Mevcut Durum → Aksiyon Haritası

| Claude Code yeteneği | RealJarvis'te karşılığı | Durum | Faz |
|---|---|---|---|
| Dosya oku/yaz/düzenle | computer-use + fs araçları | Kısmi | **F1** |
| Kod arama (Glob/Grep) | — | Yok | **F1** |
| Komut çalıştırma (shell) | dev-runner.ts | Kısmi | **F2** |
| Araç döngüsü (agentic loop) | agent-loop.ts | Var | ✅ (F6 iyileştir) |
| Plan modu / TodoWrite | goal-executor.ts | Kısmi | **F3** |
| Alt-ajanlar (subagents) | agent-loop `isSubAgent` | Kısmi | **F6** |
| Skills (paketli talimatlar) | plugins.ts | Kısmi | **F4** |
| Web (fetch/search) | search-plus.ts, feeds.ts | Var | ✅ |
| Kalıcı hafıza | memory-plus + adaptive-memory | Var | ✅ (F5 dosya-tabanlı) |
| Zamanlama/cron | scheduler + routines | Var | ✅ |
| İzin/onay/taint | permissions + taint + loop-guard | Var | ✅ |
| Kod inceleme | — | Yok | **F7** (opsiyonel) |
| Artifact (HTML yayın) | — | Yok | Kapsam dışı |

---

## FAZ 1 — Kod Farkındalıklı Dosya Araçları (Glob + Grep + Edit)

**Amaç:** Asistan bir klasörde dosya bulup (glob), içerik arayıp (grep) ve birebir
string değişimi (edit) yapabilsin. Claude Code'un temel farkı bu.

**Dokunulacak dosyalar:**
- `electron/tools/schemas.ts` — 3 yeni araç şeması ekle: `glob_files`, `grep_content`, `edit_file`.
- `electron/tools/` altına yeni `exec-fs.ts` — implementasyonlar.
- `electron/tools/executor-types.ts` — yeni araçları executor'a bağla.
- İzin: `permissions.ts` içinde `edit_file`'ı destructive/approval sınıfına ekle.

**Yapılacak:**
1. `glob_files(pattern, cwd)` — Node `fs` + basit glob (veya `fast-glob` yoksa manuel).
   node_modules ve `.git` hariç tut. Sonucu mtime'a göre sırala, max 100 satır dön.
2. `grep_content(pattern, glob?, path?)` — regex arama. Dosya başı max 250 eşleşme.
   Büyük binary dosyaları atla.
3. `edit_file(path, old_string, new_string, replace_all?)` — birebir değişim; `old_string`
   benzersiz değilse ve `replace_all` false ise hata dön (Claude Code semantiği).
4. Hepsini `getToolSchemas` "code"/"filesystem" context'ine ekle.
5. Test: `tests/fs-tools.test.ts` — glob deseni, grep eşleşme, edit benzersizlik hatası.

**Kabul kriteri:** "src altında `runAgentLoop` geçen dosyaları bul ve X'i Y yap" komutu çalışır.

---

## FAZ 2 — Güvenli Shell Aracı (dev-runner üstüne)

**Amaç:** Asistan gerçek terminal komutu çalıştırabilsin (npm, git, python), Claude
Code'un Bash/PowerShell tool'u gibi — ama RealJarvis'in izin sistemiyle korunmuş.

**Dokunulacak dosyalar:**
- [electron/dev-runner.ts](electron/dev-runner.ts) — mevcut çalıştırma altyapısını oku, üstüne bir `runShell` API'si.
- `electron/tools/schemas.ts` — `run_command` şeması (command, cwd, timeout, background?).
- `permissions.ts` — `run_command` her zaman approval gerektirir (taint + budget'a tabi).
- **Hafıza notu:** `electron-run-as-node-gotcha` — spawn'dan önce `ELECTRON_RUN_AS_NODE`
  env'ini strip et (dev shell'de set, Electron'u sessizce bozar).

**Yapılacak:**
1. `run_command` — child_process spawn, stdout/stderr yakala, timeout (varsayılan 2dk,
   maks 10dk). `background:true` ise detached çalıştır, bitince feed'e event.
2. Approval: her komut `askApproval(..., "risk")` → allow/always/deny. Loop-guard +
   destructive budget zaten devrede.
3. Çıktıyı 30k karaktere kırp.
4. Test: `tests/run-command.test.ts` — env strip, timeout, approval reddi durumu.

**Kabul kriteri:** "npm test çalıştır" → onay diyaloğu → çıktı feed'de görünür.

---

## FAZ 3 — Görev Planlama & Todo İzleme (goal-executor üstüne)

**Amaç:** Çok adımlı işlerde Claude Code'un plan modu + TodoWrite deneyimi: asistan
önce plan çıkarır, adımları izler, UI'da gösterir.

**Dokunulacak dosyalar:**
- [electron/goal-executor.ts](electron/goal-executor.ts) — mevcut hedef yürütmeyi oku; plan/todo state ekle.
- `electron/agent-loop.ts` — döngü içinde adım tamamlanınca todo güncelle, `send("todo-update", ...)`.
- `src/components/` — yeni `TodoPanel.tsx` (feed yanında ilerleme listesi, SVG check ikonları).
- `src/components/skins/toolLabels.ts` — todo etiketleri i18n.

**Yapılacak:**
1. `plan` state: `{steps: {text, status: 'pending'|'in_progress'|'done'}[]}`.
2. Karmaşık istek algılandığında (>2 adım) asistan plan üretir, UI'da gösterir.
3. Her tool çağrısı bir adımı ilerletir; renderer canlı günceller.
4. i18n: 5 dilde (mevcut i18n altyapısını kullan).

**Kabul kriteri:** "şunu kur, test et, commit at" → 3 adımlı görsel todo, canlı ilerler.

---

## FAZ 4 — Skill/Prompt Paketleri (plugins üstüne)

**Amaç:** Claude Code'un "skills" kavramı: belirli görevler için paketli talimat setleri.
RealJarvis'in `plugins.ts`/`plugin-manager.ts`'i buna en yakın nokta.

**Dokunulacak dosyalar:**
- [electron/plugins.ts](electron/plugins.ts) + [electron/plugin-manager.ts](electron/plugin-manager.ts) — skill formatını oku/genişlet.
- `electron/prompts.ts` — aktif skill talimatını sistem prompt'una enjekte et.
- `userData/skills/` — kullanıcı skill klasörü (her skill: `SKILL.md` + opsiyonel araç kısıtı).

**Yapılacak:**
1. Skill formatı: `{name, description, instructions, allowedTools?}`. `SKILL.md` frontmatter'lı.
2. Kullanıcı mesajı skill açıklamasıyla eşleşirse (veya `/skill-adı` yazılırsa) talimat
   sistem prompt'una eklenir.
3. Örnek 2-3 skill ekle: `commit-yaz`, `test-yaz`, `refactor`.
4. SettingsPanel'de skill listesi/aç-kapa.

**Kabul kriteri:** `/commit-yaz` → skill talimatı devreye girer, davranış değişir.

---

## FAZ 5 — Dosya Tabanlı Kalıcı Hafıza (Claude Code memory paritesi)

**Amaç:** Claude Code'un `memory/*.md` + `MEMORY.md` indeks modelini RealJarvis'e taşı.
Mevcut `memory-plus`/`adaptive-memory` DB tabanlı; bunun yanına insan-okur, dosya-tabanlı
bir katman ekle.

**Dokunulacak dosyalar:**
- [electron/memory-plus.ts](electron/memory-plus.ts) + [electron/adaptive-memory.ts](electron/adaptive-memory.ts) — mevcut modeli oku.
- Yeni `electron/memory-files.ts` — `userData/memory/` altında md dosyaları + `MEMORY.md` indeks.
- `electron/prompts.ts` — MEMORY.md indeksini sistem prompt'una yükle.
- `src/components/MemoryModal.tsx` — dosya hafızasını göster/düzenle.

**Yapılacak:**
1. Hafıza yazma aracı: `remember(fact, type)` → tek dosya, frontmatter'lı, MEMORY.md'ye pointer.
   Türler: `user | feedback | project | reference` (Claude Code ile aynı).
2. Oturum başında MEMORY.md indeksi prompt'a yüklenir.
3. Duplikasyon kontrolü: aynı konuyu kapsayan dosya varsa güncelle.
4. MemoryModal'da liste + sil/düzenle.

**Kabul kriteri:** "bunu hatırla" → `userData/memory/x.md` oluşur, sonraki oturumda hatırlanır.

---

## FAZ 6 — Alt-Ajanlar (subagent) Güçlendirmesi

**Amaç:** Claude Code'un subagent modeli: ana ajan alt görevi izole bir ajana devreder,
sonucu alır. RealJarvis'te `agent-loop.ts` zaten `isSubAgent` biliyor — bunu gerçek bir
"görev devri" API'sine çıkar.

**Dokunulacak dosyalar:**
- [electron/agent-loop.ts](electron/agent-loop.ts) — `isSubAgent` yolunu oku; `spawn_subagent` aracı ekle.
- `electron/tools/schemas.ts` — `spawn_subagent(task, allowedTools?)` şeması.
- `electron/model-router.ts` — subagent için model seçimi (hızlı/ucuz model opsiyonu).

**Yapılacak:**
1. `spawn_subagent(task)` — yeni `runAgentLoop` çağrısı, `isSubAgent:true`, izole geçmiş.
   Sonuç ana döngüye string olarak döner.
2. Sonsuz özyineleme koruması: subagent subagent spawn edemez (derinlik=1).
3. Loop-guard + destructive budget subagent içinde de geçerli.
4. Test: `tests/subagent.test.ts` — devir, sonuç dönüşü, derinlik limiti.

**Kabul kriteri:** "şu 3 dosyayı ayrı ayrı özetle" → 3 subagent, sonuçlar birleşir.

---

## FAZ 7 — Kod İnceleme Aracı (opsiyonel)

**Amaç:** Claude Code'un `/code-review` benzeri: git diff'i analiz edip bulgu raporu.

**Dokunulacak dosyalar:**
- Yeni `electron/code-review.ts` — `git diff` al, LLM'e ver, yapılandırılmış bulgu döndür.
- `electron/tools/schemas.ts` — `review_changes(base?)` şeması.
- `src/components/` — bulgu listesi paneli (severity'ye göre sıralı, SVG ikon).

**Yapılacak:**
1. `review_changes` — `git diff`, her bulgu `{file, line, severity, summary}`.
2. Sonucu feed'de yapılandırılmış göster.

**Kabul kriteri:** "değişikliklerimi incele" → dosya/satır bazlı bulgu listesi.

---

## Faz Bağımlılıkları & Önerilen Sıra

```
F1 (fs araçları) ──┬─► F2 (shell) ──► F7 (review)
                   ├─► F6 (subagent)
F3 (todo) ─────────┘
F4 (skills) ── bağımsız
F5 (memory) ── bağımsız
```

**Önerilen sıra:** F1 → F2 → F3 → F5 → F4 → F6 → F7.
F1 ve F2 en yüksek değer/en düşük risk. F7 opsiyonel.

---

## Her Faz İçin Definition of Done

- [ ] Dokunulacak dosyalar okundu, gerçek imzalar teyit edildi.
- [ ] Kod yazıldı, mevcut idiom/isimlendirmeye uyuldu.
- [ ] Emoji yok, SVG line-icon kullanıldı (UI dokunuşu varsa).
- [ ] `bun run build` temiz (TypeScript hatasız).
- [ ] Test eklendi, `bun run test` geçti.
- [ ] i18n gerekiyorsa 5 dilde eklendi.
- [ ] ROADMAP.md aynı commit'te güncellendi.
- [ ] `feat(cc): Faz N - <özet>` commit + push.

---

## Riskler & Notlar

- **Güvenlik:** F1 edit_file ve F2 run_command en riskli. İkisi de mutlaka
  `permissions.ts` approval + `taint.ts` + `loop-guard.ts` + destructive budget'a bağlı olmalı.
- **`ELECTRON_RUN_AS_NODE`:** F2'de spawn öncesi strip et (bkz. hafıza notu).
- **Paketleme:** F5 dosya hafızası `userData/`'ya yazmalı (asar salt-okunur; bkz. Kokoro notu).
- **Provider limitleri:** Yeni araçlar `model-capabilities.ts` araç-sayısı/limit kurallarına
  takılabilir; şema eklerken 64-araç limitini ve kırpmayı gözet.

---

*Oluşturulma: 2026-07-22 · Hedef repo: RealJarvis/AEGIS (Electron+React+TS)*
