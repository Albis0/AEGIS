# AEGIS v0.7.3 — Reliability & Polish

> ⚠️ **AEGIS is under active development.** Not everything works perfectly yet. Treat this as an early-stage project — bug reports and PRs are very welcome.

## ⬇️ Download

| File | For whom |
|---|---|
| **AEGIS-Setup-0.7.3.exe** ⭐ **(recommended)** | Regular users — install wizard, shortcuts, auto-update |
| AEGIS-0.7.3.exe | Portable — a single file, no installation |

**SmartScreen note:** the exe is not code-signed (free hobby project — this is permanent). Click *More info → Run anyway*, or verify the download first: [how to verify](https://github.com/Albis0/AEGIS/blob/main/SECURITY.md#unsigned-releases--how-to-verify-a-download).

## 🔧 What's fixed / new

- **Critical:** finishing **trial-mode onboarding quit the app** in packaged builds — fixed. If v0.7.2 "closed itself" after you signed up, this was it.
- **New AEGIS app icon** — exe, installer, shortcuts and system tray now carry the real logo (previous releases shipped with Electron's default icon).
- **Smoother voice output** — sentences are pre-synthesized while the previous one is still playing; no more dead air after the first sentence, no more rushed tail.
- **Trial server wake-up handling** — the free backend sleeps after inactivity; AEGIS now retries quietly (~30 s) instead of showing a raw network error on first launch.
- **Bug-report form** (Settings → About): report issues from inside the app, optionally attaching a screenshot. Reports queue offline and send later.
- **Softer startup notices** — informational messages no longer render as red error boxes.
- **Settings panel fully translated** into all 5 languages (TR/EN/DE/FR/ES).
- **Model catalog refreshed** — deprecated/removed provider models cleaned up, new defaults (July 2026).

---

🇹🇷 **TR:** Kritik düzeltme: deneme modu kurulumu bitince uygulamanın kapanması düzeltildi. Yeni uygulama ikonu, akıcı sesli okuma (ön-sentezleme), deneme sunucusu uyanırken otomatik yeniden deneme, uygulama içi hata bildirme formu (ekran görüntüsü ekleyebilirsin), 5 dilde tam çevrilmiş ayarlar paneli ve güncellenmiş model kataloğu. Önerilen indirme: **AEGIS-Setup-0.7.3.exe**.
