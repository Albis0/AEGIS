//! Obsidian kasası tool'ları.
//!
//! Kasa erişimi [`crate::obsidian`] içinde; burası sadece modelin göreceği
//! yüzey. Arama en kritik olanı — diğer her işlem "şu konudaki notu bul" ile
//! başlıyor, o yüzden model yol bilmeden de çalışabilmeli.

use crate::obsidian::{self, Vault};
use crate::tool::{arg_num, arg_str, Domain, Param, Risk, Tool, ToolOutcome};
use serde_json::Value;

/// Aramada varsayılan sonuç sayısı.
const DEFAULT_LIMIT: usize = 8;

/// Aktif kasayı verir, yoksa kullanıcıya ne yapacağını söyler.
fn vault() -> Result<Vault, ToolOutcome> {
    obsidian::current().ok_or_else(|| {
        ToolOutcome::err(
            "Obsidian kasası seçili değil. Ayarlardan bir kasa seç \
             (Obsidian kurulu ise otomatik bulunur).",
        )
    })
}

/// Ortak anahtar kelimeler — hepsi aynı alanı tetikliyor.
const VAULT_WORDS: &[&str] = &[
    "obsidian", "kasa", "vault", "not", "notlar", "note", "markdown",
];

/// Kasada arama.
pub struct SearchNotes;

impl Tool for SearchNotes {
    fn name(&self) -> &'static str {
        "not_ara"
    }

    fn description(&self) -> &'static str {
        "Obsidian kasasında not arar. Kullanıcı kendi notlarındaki bir şeyi \
         sorduğunda önce bunu kullan — yol bilmene gerek yok."
    }

    fn domain(&self) -> Domain {
        Domain::Obsidian
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::required("sorgu", "Aranacak konu veya kelimeler"),
            Param::optional("etiket", "Sadece bu etiketi taşıyan notlar"),
            Param::optional("adet", "Kaç sonuç (varsayılan 8)"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        VAULT_WORDS
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let vault = match vault() {
            Ok(v) => v,
            Err(e) => return e,
        };
        let Some(query) = arg_str(args, "sorgu") else {
            return ToolOutcome::err("sorgu parametresi gerekli");
        };
        let limit = arg_num(args, "adet")
            .map(|n| (n as usize).clamp(1, 25))
            .unwrap_or(DEFAULT_LIMIT);

        // Etiket filtresi aramadan önce uygulanıyor: "şu etiketteki notlarda
        // ara" isteği, etiketi olmayan yüksek puanlı notları elemeli.
        let tag = arg_str(args, "etiket");
        let results = match vault.search(query, limit * 3) {
            Ok(r) => r,
            Err(e) => return ToolOutcome::err(e),
        };

        let filtered: Vec<_> = results
            .into_iter()
            .filter(|(note, _)| tag.is_none_or(|t| note.has_tag(t)))
            .take(limit)
            .collect();

        if filtered.is_empty() {
            return ToolOutcome::ok(format!("'{query}' ile eşleşen not yok."));
        }

        let mut out = String::new();
        for (note, _score) in &filtered {
            out.push_str(&format!("{} — {}\n", note.title, note.path));
            // İlk anlamlı satır, notun ne olduğunu göstermeye yetiyor.
            if let Some(preview) = first_prose_line(&note.body) {
                out.push_str(&format!("  {preview}\n"));
            }
        }
        ToolOutcome::ok(out.trim_end().to_string())
    }
}

/// Notun ilk anlamlı satırı — başlık ve boş satırlar atlanır.
fn first_prose_line(body: &str) -> Option<String> {
    body.lines()
        .map(str::trim)
        .find(|l| !l.is_empty() && !l.starts_with('#'))
        .map(|l| {
            let clipped: String = l.chars().take(120).collect();
            clipped
        })
}

/// Bir notu okur.
pub struct ReadNote;

impl Tool for ReadNote {
    fn name(&self) -> &'static str {
        "not_oku"
    }

    fn description(&self) -> &'static str {
        "Bir Obsidian notunun içeriğini getirir. Yolu bilmiyorsan önce not_ara kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Obsidian
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("yol", "Kasa içindeki yol, örn. projeler/vavis.md")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        VAULT_WORDS
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let vault = match vault() {
            Ok(v) => v,
            Err(e) => return e,
        };
        let Some(path) = arg_str(args, "yol") else {
            return ToolOutcome::err("yol parametresi gerekli");
        };

        match vault.read(path) {
            Ok((note, raw)) => {
                let mut header = format!("# {}\n{}\n", note.title, note.path);
                if !note.tags.is_empty() {
                    let tags: Vec<String> =
                        note.tags.iter().map(|t| format!("#{t}")).collect();
                    header.push_str(&format!("etiketler: {}\n", tags.join(" ")));
                }
                // Gömülü notlar açılmıyor: beş not gömen bir not bağlam
                // maliyetini sessizce katlar. Sadece bildiriliyor.
                if !note.embeds.is_empty() {
                    let embeds: Vec<&str> =
                        note.embeds.iter().map(String::as_str).collect();
                    header.push_str(&format!(
                        "gömülü (açılmadı): {}\n",
                        embeds.join(", ")
                    ));
                }
                ToolOutcome::ok(format!("{header}\n{}", obsidian::clip(&raw)))
            }
            Err(e) => ToolOutcome::err(e),
        }
    }
}

/// Kasadaki notları listeler.
pub struct ListNotes;

impl Tool for ListNotes {
    fn name(&self) -> &'static str {
        "not_listele"
    }

    fn description(&self) -> &'static str {
        "Kasadaki notları listeler. Klasör veya etiket ile daraltılabilir; \
         hiçbiri verilmezse kasanın özeti ve etiketleri döner."
    }

    fn domain(&self) -> Domain {
        Domain::Obsidian
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::optional("klasor", "Sadece bu klasördeki notlar"),
            Param::optional("etiket", "Sadece bu etiketi taşıyan notlar"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        VAULT_WORDS
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let vault = match vault() {
            Ok(v) => v,
            Err(e) => return e,
        };
        let notes = match vault.scan() {
            Ok(n) => n,
            Err(e) => return ToolOutcome::err(e),
        };

        let folder = arg_str(args, "klasor").map(|f| {
            let f = f.trim_matches('/').replace('\\', "/");
            format!("{f}/")
        });
        let tag = arg_str(args, "etiket");

        let matching: Vec<_> = notes
            .iter()
            .filter(|n| folder.as_ref().is_none_or(|f| n.path.starts_with(f)))
            .filter(|n| tag.is_none_or(|t| n.has_tag(t)))
            .collect();

        // Filtresiz çağrı "kasada ne var" sorusudur; ham liste yerine özet
        // daha kullanışlı ve çok daha ucuz.
        if folder.is_none() && tag.is_none() {
            let tags = vault.tags().unwrap_or_default();
            let top: Vec<String> = tags
                .iter()
                .take(20)
                .map(|(t, c)| format!("#{t} ({c})"))
                .collect();
            let folders = top_folders(&notes);
            return ToolOutcome::ok(format!(
                "{} not.\nklasörler: {}\netiketler: {}",
                notes.len(),
                if folders.is_empty() {
                    "(kök)".to_string()
                } else {
                    folders.join(", ")
                },
                if top.is_empty() {
                    "(yok)".to_string()
                } else {
                    top.join(" ")
                }
            ));
        }

        if matching.is_empty() {
            return ToolOutcome::ok("Eşleşen not yok.".to_string());
        }

        let listed: Vec<String> = matching
            .iter()
            .take(60)
            .map(|n| format!("{} — {}", n.title, n.path))
            .collect();
        let mut out = listed.join("\n");
        if matching.len() > 60 {
            out.push_str(&format!("\n…({} not daha)", matching.len() - 60));
        }
        ToolOutcome::ok(out)
    }
}

/// Kasadaki üst düzey klasörler.
fn top_folders(notes: &[crate::obsidian::note::Note]) -> Vec<String> {
    let mut set: std::collections::BTreeSet<String> = Default::default();
    for note in notes {
        if let Some((folder, _)) = note.path.split_once('/') {
            set.insert(folder.to_string());
        }
    }
    set.into_iter().take(15).collect()
}

/// Yeni not oluşturur.
pub struct CreateNote;

impl Tool for CreateNote {
    fn name(&self) -> &'static str {
        "not_olustur"
    }

    fn description(&self) -> &'static str {
        "Kasada yeni bir not oluşturur. Not varsa hata verir — mevcut nota \
         eklemek için not_ekle kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Obsidian
    }

    fn risk(&self) -> Risk {
        // Yeni dosya yazıyor ama var olanı bozmuyor: oluşturma reddediliyor
        // eğer dosya varsa. Geri alınabilir bir işlem.
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::required("yol", "Kasa içindeki yol, örn. fikirler/yeni.md"),
            Param::required("icerik", "Notun Markdown içeriği"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        VAULT_WORDS
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let vault = match vault() {
            Ok(v) => v,
            Err(e) => return e,
        };
        let (Some(path), Some(content)) = (arg_str(args, "yol"), arg_str(args, "icerik")) else {
            return ToolOutcome::err("yol ve icerik parametreleri gerekli");
        };

        match vault.create(path, content) {
            Ok(written) => ToolOutcome::ok(format!("oluşturuldu: {written}")),
            Err(e) => ToolOutcome::err(e),
        }
    }
}

/// Notun sonuna ekler.
pub struct AppendNote;

impl Tool for AppendNote {
    fn name(&self) -> &'static str {
        "not_ekle"
    }

    fn description(&self) -> &'static str {
        "Bir notun sonuna metin ekler. Not yoksa oluşturur. Mevcut içeriğe \
         dokunmaz."
    }

    fn domain(&self) -> Domain {
        Domain::Obsidian
    }

    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::required("yol", "Kasa içindeki yol"),
            Param::required("icerik", "Eklenecek metin"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        VAULT_WORDS
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let vault = match vault() {
            Ok(v) => v,
            Err(e) => return e,
        };
        let (Some(path), Some(content)) = (arg_str(args, "yol"), arg_str(args, "icerik")) else {
            return ToolOutcome::err("yol ve icerik parametreleri gerekli");
        };

        match vault.append(path, content) {
            Ok(written) => ToolOutcome::ok(format!("eklendi: {written}")),
            Err(e) => ToolOutcome::err(e),
        }
    }
}

/// Notun içindeki bir bölümü değiştirir.
pub struct EditNote;

impl Tool for EditNote {
    fn name(&self) -> &'static str {
        "not_duzenle"
    }

    fn description(&self) -> &'static str {
        "Notun içindeki bir metni başkasıyla değiştirir. Eski metin birebir \
         ve tek olmalı — notun geri kalanına dokunulmaz."
    }

    fn domain(&self) -> Domain {
        Domain::Obsidian
    }

    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::required("yol", "Kasa içindeki yol"),
            Param::required("eski", "Değiştirilecek metin, birebir"),
            Param::required("yeni", "Yerine yazılacak metin"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        VAULT_WORDS
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let vault = match vault() {
            Ok(v) => v,
            Err(e) => return e,
        };
        let (Some(path), Some(old)) = (arg_str(args, "yol"), arg_str(args, "eski")) else {
            return ToolOutcome::err("yol ve eski parametreleri gerekli");
        };
        // Boş "yeni" silme demektir; arg_str boş dizeyi eleyeceği için ayrı okunuyor.
        let new = args
            .get("yeni")
            .and_then(Value::as_str)
            .unwrap_or_default();

        match vault.edit(path, old, new) {
            Ok(written) => ToolOutcome::ok(format!("düzenlendi: {written}")),
            Err(e) => ToolOutcome::err(e),
        }
    }
}

/// Notu çöpe taşır.
pub struct DeleteNote;

impl Tool for DeleteNote {
    fn name(&self) -> &'static str {
        "not_sil"
    }

    fn description(&self) -> &'static str {
        "Bir notu kasanın .trash klasörüne taşır. Tek not siler, toplu silme yok."
    }

    fn domain(&self) -> Domain {
        Domain::Obsidian
    }

    fn risk(&self) -> Risk {
        // Sohbet kaydından kurtarılamayacak tek şey: kullanıcının kendi notu.
        // Çöpe taşınıyor olması onayı gereksiz kılmıyor.
        Risk::Destructive
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("yol", "Silinecek notun kasa içindeki yolu")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        VAULT_WORDS
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let vault = match vault() {
            Ok(v) => v,
            Err(e) => return e,
        };
        let Some(path) = arg_str(args, "yol") else {
            return ToolOutcome::err("yol parametresi gerekli");
        };
        // Joker karakter tek notu değil, bir yığını hedefler.
        if path.contains('*') || path.contains('?') {
            return ToolOutcome::err("toplu silme yok — tek bir not yolu ver");
        }

        match vault.delete(path) {
            Ok(trashed) => ToolOutcome::ok(format!("çöpe taşındı: {trashed}")),
            Err(e) => ToolOutcome::err(e),
        }
    }
}

/// Notun bağlantıları ve ona gelen bağlantılar.
pub struct NoteLinks;

impl Tool for NoteLinks {
    fn name(&self) -> &'static str {
        "not_baglantilar"
    }

    fn description(&self) -> &'static str {
        "Bir nota gelen (backlink) ve ondan giden bağlantıları listeler."
    }

    fn domain(&self) -> Domain {
        Domain::Obsidian
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("yol", "Kasa içindeki yol")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        VAULT_WORDS
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let vault = match vault() {
            Ok(v) => v,
            Err(e) => return e,
        };
        let Some(path) = arg_str(args, "yol") else {
            return ToolOutcome::err("yol parametresi gerekli");
        };

        match vault.links(path) {
            Ok((backlinks, outgoing)) => {
                let mut out = String::new();
                out.push_str(&format!("gelen ({}):\n", backlinks.len()));
                for b in backlinks.iter().take(40) {
                    out.push_str(&format!("  {} — {}\n", b.title, b.path));
                }
                out.push_str(&format!("giden ({}):\n", outgoing.len()));
                for o in outgoing.iter().take(40) {
                    out.push_str(&format!("  {}\n", o.title));
                }
                ToolOutcome::ok(out.trim_end().to_string())
            }
            Err(e) => ToolOutcome::err(e),
        }
    }
}

/// Günlük not.
pub struct DailyNote;

impl Tool for DailyNote {
    fn name(&self) -> &'static str {
        "gunluk_not"
    }

    fn description(&self) -> &'static str {
        "Bugünün günlük notunu okur; icerik verilirse sonuna ekler. \
         Tarih verilerek başka bir güne de bakılabilir."
    }

    fn domain(&self) -> Domain {
        Domain::Obsidian
    }

    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::optional("icerik", "Eklenecek metin; boşsa sadece okunur"),
            Param::optional("tarih", "YYYY-AA-GG; boşsa bugün"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["günlük", "gunluk", "daily", "bugün", "bugun", "not"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let vault = match vault() {
            Ok(v) => v,
            Err(e) => return e,
        };

        let date = match arg_str(args, "tarih") {
            Some(d) => {
                if !is_iso_date(d) {
                    return ToolOutcome::err("tarih YYYY-AA-GG biçiminde olmalı");
                }
                d.to_string()
            }
            None => chrono::Local::now().format("%Y-%m-%d").to_string(),
        };

        // Günlük notun yeri kasadan kasaya değişiyor; mevcut olanı bulmak
        // kullanıcının düzenine uymak demek, yoksa köke yazılır.
        let path = existing_daily(&vault, &date).unwrap_or_else(|| format!("{date}.md"));

        match arg_str(args, "icerik") {
            Some(content) => match vault.append(&path, content) {
                Ok(written) => ToolOutcome::ok(format!("günlük nota eklendi: {written}")),
                Err(e) => ToolOutcome::err(e),
            },
            None => match vault.read(&path) {
                Ok((_, raw)) => ToolOutcome::ok(obsidian::clip(&raw)),
                Err(_) => ToolOutcome::ok(format!("{date} için günlük not yok.")),
            },
        }
    }
}

/// Kasadaki tarihe göre adlandırılmış notu arar.
fn existing_daily(vault: &Vault, date: &str) -> Option<String> {
    let notes = vault.scan().ok()?;
    notes
        .into_iter()
        .find(|n| crate::obsidian::note::stem(&n.path) == date)
        .map(|n| n.path)
}

fn is_iso_date(s: &str) -> bool {
    let bytes = s.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(i, b)| i == 4 || i == 7 || b.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, MutexGuard, OnceLock};

    /// Aktif kasa süreç geneli olduğu için kasaya dokunan testler
    /// serileştiriliyor — paralel çalışsalar birbirinin kasasını değiştirirler.
    fn test_lock() -> MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }

    /// Geçici bir kasa kurar, test bitince aktif kasayı temizler.
    fn with_vault(files: &[(&str, &str)], f: impl FnOnce(&Vault)) {
        let _guard = test_lock();
        let tmp = tempfile::tempdir().unwrap();
        for (name, content) in files {
            let path = tmp.path().join(name);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, content).unwrap();
        }
        let vault = Vault::new(tmp.path());
        obsidian::set_active(Some(vault.clone()));
        f(&vault);
        obsidian::set_active(None);
    }

    #[test]
    fn tools_report_a_missing_vault_instead_of_failing_obscurely() {
        let _guard = test_lock();
        obsidian::set_active(None);

        for (name, out) in [
            ("not_ara", SearchNotes.run(&serde_json::json!({"sorgu": "x"}))),
            ("not_oku", ReadNote.run(&serde_json::json!({"yol": "a.md"}))),
            ("not_listele", ListNotes.run(&serde_json::json!({}))),
        ] {
            assert!(!out.ok, "{name} kasasız başarılı olmamalı");
            assert!(out.content.contains("kasa"), "{name}: {}", out.content);
        }
    }

    #[test]
    fn delete_refuses_wildcards() {
        with_vault(&[("a.md", "x\n")], |_| {
            let out = DeleteNote.run(&serde_json::json!({"yol": "*.md"}));
            assert!(!out.ok);
            assert!(out.content.contains("toplu silme yok"), "{}", out.content);
        });
    }

    #[test]
    fn delete_is_destructive_and_the_rest_are_not() {
        // İzin kapısı bu seviyelere bakıyor; silme her zaman onay istemeli.
        assert_eq!(DeleteNote.risk(), Risk::Destructive);
        assert_eq!(SearchNotes.risk(), Risk::Safe);
        assert_eq!(ReadNote.risk(), Risk::Safe);
        assert_eq!(ListNotes.risk(), Risk::Safe);
        assert_eq!(NoteLinks.risk(), Risk::Safe);
        assert_eq!(CreateNote.risk(), Risk::Moderate);
        assert_eq!(EditNote.risk(), Risk::Moderate);
    }

    #[test]
    fn missing_parameters_are_rejected() {
        with_vault(&[], |_| {
            assert!(!SearchNotes.run(&serde_json::json!({})).ok);
            assert!(!ReadNote.run(&serde_json::json!({})).ok);
            assert!(!CreateNote.run(&serde_json::json!({"yol": "a.md"})).ok);
            assert!(!EditNote.run(&serde_json::json!({"yol": "a.md"})).ok);
        });
    }

    #[test]
    fn iso_dates_are_validated() {
        assert!(is_iso_date("2026-08-28"));
        assert!(!is_iso_date("28-08-2026"));
        assert!(!is_iso_date("2026-8-28"));
        assert!(!is_iso_date("bugün"));
    }

    #[test]
    fn a_bad_date_is_rejected_before_touching_the_vault() {
        with_vault(&[], |_| {
            let out = DailyNote.run(&serde_json::json!({"tarih": "dün"}));
            assert!(!out.ok);
            assert!(out.content.contains("YYYY"), "{}", out.content);
        });
    }

    #[test]
    fn first_prose_line_skips_headings_and_blanks() {
        assert_eq!(
            first_prose_line("# Title\n\nthe body\n").as_deref(),
            Some("the body")
        );
        assert_eq!(first_prose_line("# Only a title\n"), None);
    }

    #[test]
    fn search_returns_titles_with_paths() {
        with_vault(&[("spotify.md", "# Spotify\nplayback notes\n")], |_| {
            let out = SearchNotes.run(&serde_json::json!({"sorgu": "spotify"}));
            assert!(out.ok, "{}", out.content);
            assert!(out.content.contains("spotify.md"), "{}", out.content);
        });
    }

    #[test]
    fn search_honours_a_tag_filter() {
        with_vault(
            &[
                ("a.md", "# Alpha\n#keep\nshared word\n"),
                ("b.md", "# Beta\nshared word\n"),
            ],
            |_| {
                let out =
                    SearchNotes.run(&serde_json::json!({"sorgu": "shared", "etiket": "keep"}));
                assert!(out.content.contains("a.md"), "{}", out.content);
                assert!(!out.content.contains("b.md"), "{}", out.content);
            },
        );
    }

    #[test]
    fn reading_reports_embeds_without_expanding_them() {
        with_vault(
            &[
                ("a.md", "# A\n![[Big Note]]\n"),
                ("Big Note.md", "huge content here\n"),
            ],
            |_| {
                let out = ReadNote.run(&serde_json::json!({"yol": "a.md"}));
                assert!(out.content.contains("gömülü"), "{}", out.content);
                assert!(
                    !out.content.contains("huge content"),
                    "embed must not be expanded: {}",
                    out.content
                );
            },
        );
    }

    #[test]
    fn a_full_create_read_edit_delete_cycle_works() {
        with_vault(&[], |vault| {
            let created = CreateNote.run(
                &serde_json::json!({"yol": "fikirler/yeni.md", "icerik": "ilk satır"}),
            );
            assert!(created.ok, "{}", created.content);

            let read = ReadNote.run(&serde_json::json!({"yol": "fikirler/yeni.md"}));
            assert!(read.content.contains("ilk satır"), "{}", read.content);

            let edited = EditNote.run(&serde_json::json!({
                "yol": "fikirler/yeni.md", "eski": "ilk satır", "yeni": "değişti"
            }));
            assert!(edited.ok, "{}", edited.content);

            let deleted = DeleteNote.run(&serde_json::json!({"yol": "fikirler/yeni.md"}));
            assert!(deleted.ok, "{}", deleted.content);
            assert!(
                vault.root.join(".trash/yeni.md").exists(),
                "silinen not çöpte olmalı"
            );
        });
    }
}
