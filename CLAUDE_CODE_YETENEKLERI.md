# Claude Code (VSCode Extension) — Yetenek Rehberi

> Bu belge, seninle konuştuğun **Claude Code** asistanının (VSCode native extension /
> Claude Agent SDK üzerinde çalışan) bu ortamda yapabildiği her şeyi özetler.
> Ortam: Windows 11 · PowerShell + Bash · Model: Opus 4.8

---

## 1. Genel Bakış

Claude Code, kod yazma ve yazılım mühendisliği görevlerinde sana yardımcı olan
**etkileşimli (interactive) bir ajandır**. Sadece soru cevaplamaz — dosyaları okur,
düzenler, komut çalıştırır, testleri koşar, git işlemleri yapar, araştırma yürütür ve
çok adımlı görevleri baştan sona kendisi yürütür.

Çıktılar terminalde **GitHub-flavored Markdown** olarak gösterilir. Dosya ve kod
referansları tıklanabilir bağlantılar olarak verilir (`dosya.ts:42`).

---

## 2. Dosya İşlemleri

| Yetenek | Açıklama |
|---|---|
| **Okuma** | Herhangi bir dosyayı okur — kod, metin, **resim** (PNG/JPG görsel olarak), **PDF** (sayfa aralığıyla), **Jupyter notebook** (hücre + çıktılar). |
| **Yazma** | Yeni dosya oluşturur veya mevcut dosyayı tamamen değiştirir. |
| **Düzenleme (Edit)** | Bir dosyada birebir metin değiştirme (tekil veya tümünü değiştir). |
| **Notebook düzenleme** | `.ipynb` hücrelerini düzenler. |

Büyük dosyalarda sadece gereken bölüm okunabilir (offset/limit).

---

## 3. Arama & Keşif

| Araç | Ne işe yarar |
|---|---|
| **Glob** | Dosya adı desenine göre hızlı dosya bulma (`**/*.ts`). |
| **Grep** | ripgrep tabanlı içerik araması (tam regex, glob/type filtresi, satır no, bağlam satırları, multiline). |
| **Explore ajanı** | Çok sayıda dosya/dizin taraması gerektiren geniş "fan-out" aramalar için salt-okunur keşif ajanı. |

---

## 4. Komut Çalıştırma (Terminal)

- **PowerShell** (Windows PowerShell 5.1) — birincil kabuk. Git, npm, docker, PS cmdlet'leri.
- **Bash** (Git Bash / POSIX sh) — POSIX script'ler için.
- **Arka planda çalıştırma** — uzun süren işleri detached çalıştırır, bitince haber verir.
- Çalışma dizini kalıcıdır; kabuk state (env/fonksiyon) kalıcı değildir.
- Zaman aşımı ayarlanabilir (varsayılan 2 dk, maks 10 dk).

---

## 5. Git & GitHub

- Durum inceleme, diff, log, branch, commit, push (kullanıcı istediğinde).
- Varsayılan branch'te doğrudan çalışmak yerine **önce branch açar**.
- **`gh` CLI** ile GitHub işlemleri: PR, issue, API.
- Geri alması zor işlemlerde (force push, hard reset) önce onay ister.
- Bu projede senin kuralın: *özellik bitip compile temizse sormadan commit + push*.

---

## 6. Planlama & Görev Yönetimi

| Yetenek | Açıklama |
|---|---|
| **Plan modu** | Karmaşık işlerde önce plan çıkarır, onayına sunar (ExitPlanMode). |
| **TodoWrite** | Çok adımlı görevlerde ilerlemeyi izleyen yapılacaklar listesi tutar. |
| **AskUserQuestion** | Yalnızca senin karar vermen gereken durumlarda seçenekli soru sorar. |
| **Plan ajanı** | Uygulama stratejisi tasarlar, kritik dosyaları belirler, mimari ödünleşimleri değerlendirir. |

---

## 7. Alt-Ajanlar (Subagents)

Karmaşık, çok adımlı işleri devredebileceğin uzman ajanlar (yalnızca sen isteyince spawn edilir):

- **general-purpose** — genel araştırma / çok adımlı görevler.
- **Explore** — geniş kod araması (salt-okunur).
- **Plan** — mimari plan tasarımı.
- **claude-code-guide** — Claude Code / SDK / API hakkında sorular.
- **statusline-setup** — status line yapılandırması.
- Ayrıca yüklü paketlerden gelen çok sayıda uzman ajan (SEO, fullstack-dev, vb.).

Ajanlar arka planda çalışabilir; `SendMessage` ile bağlamı koruyarak devam ettirilebilir.
`isolation: worktree` ile izole bir git worktree'de çalışabilirler.

---

## 8. Skills (Yetenek Paketleri)

Belirli görev türleri için paketlenmiş talimat setleri. Öne çıkanlar:

- **Belge üretimi:** `docx`, `xlsx`, `pptx`, `pdf` — Word / Excel / PowerPoint / PDF oluştur, oku, düzenle.
- **Diyagram:** `drawio-skill` — akış şeması, mimari, UML, ER, ağ topolojisi (.drawio + PNG/SVG export).
- **Veri görselleştirme:** `dataviz` — grafik/dashboard tasarımı.
- **Artifact:** `artifact-design`, `artifact-capabilities` — claude.ai'de barındırılan web sayfaları.
- **Kod kalitesi:** `simplify`, `review`, `security-review`, `tdd`.
- **Claude API referansı:** `claude-api` — model id'leri, fiyat, streaming, tool use, caching.
- **Yapılandırma:** `update-config` (settings.json/hooks), `keybindings-help`, `fewer-permission-prompts`.
- **Zamanlama:** `loop` (tekrarlı görev), `schedule` (cron cloud ajanları).
- Ve yüzlerce alan-özel skill (frontend-design, mcp-builder, prompt-engineer, seo-*, vb.).

---

## 9. Web & Dış Dünya

| Yetenek | Açıklama |
|---|---|
| **WebFetch** | Bir URL'nin içeriğini getirip işler. |
| **WebSearch** | Web araması yapar. |
| **Artifact** | HTML/Markdown'ı claude.ai'de barındırılan bir web sayfasına dönüştürür (varsayılan gizli). |

---

## 10. Entegrasyonlar (MCP)

MCP sunucuları üzerinden dış servislere bağlanır (yetkilendirme gerektirir):

- **Gmail** — thread arama, mesaj/thread okuma, taslak oluşturma, etiketleme.
- **Google Calendar**, **Google Drive**, **Vercel** — bu oturumda yetkilendirme bekliyor.

> Not: OAuth akışı etkileşimli oturumda (claude.ai connector ayarları veya `/mcp`) yapılır.

---

## 11. Zamanlama & Otomasyon

- **loop** — bir prompt/komutu belirli aralıkla tekrar çalıştırma.
- **schedule / Cron** — cron takvimiyle çalışan cloud ajanları (routines) oluşturma/yönetme.
- **ScheduleWakeup** — dinamik loop modunda kendini yeniden çağırma.
- **Hooks** — settings.json ile otomatik davranışlar ("her X olduğunda Y yap").
- **PushNotification / Monitor** — bildirim ve durum izleme.

---

## 12. Kalıcı Hafıza (Memory)

`~/.claude/projects/.../memory/` altında dosya tabanlı kalıcı hafıza:

- Her hafıza tek bir dosya, tek bir gerçek (frontmatter'lı).
- Türler: `user`, `feedback`, `project`, `reference`.
- `MEMORY.md` her oturumda yüklenen indeks.
- Oturumlar arası tercih, geri bildirim ve proje bağlamını hatırlar.

---

## 13. Kod İnceleme

- **/code-review** — mevcut branch veya bir GitHub PR için çok-ajanlı bulut incelemesi (`ultra` modu billed, kullanıcı tetikler).
- **ReportFindings** — bulguları tipli liste olarak raporlar.
- **/security-review**, **/review** — güvenlik ve kalite incelemeleri.

---

## 14. Bu Ortamın Özellikleri

- **Platform:** Windows 11 · Shell: PowerShell (birincil) + Bash.
- **Model:** Opus 4.8 (`claude-opus-4-8`), fast mode `/fast` ile.
- **Scratchpad:** Geçici dosyalar için ayrılmış izole dizin.
- **Bağlam yönetimi:** Uzun konuşmalarda otomatik özetleme ile devam.
- **Tıklanabilir referanslar:** Dosya/satır bağlantıları IDE'de doğrudan açılır.

---

## 15. Sınırlar & İlkeler

- Yetkili güvenlik testi, savunma amaçlı güvenlik ve eğitim bağlamlarına yardım eder;
  yıkıcı/kötü amaçlı istekleri reddeder.
- Geri alması zor veya dışa dönük işlemlerde önce onay ister.
- Sonuçları dürüst raporlar — testler başarısızsa söyler, atlanan adımı belirtir.
- Etkileşimli olmayan oturumda OAuth gibi akışları çalıştıramaz; kullanıcıyı yönlendirir.

---

*Oluşturulma tarihi: 2026-07-22*
