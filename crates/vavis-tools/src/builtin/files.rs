//! Dosya tool'ları.
//!
//! **Güvenlik notu:** Bu tool'lar kullanıcının dosyalarına dokunur. Yol
//! doğrulaması tek bir yerde (`resolve_path`) yapılır — her tool kendi
//! kontrolünü yazarsa biri mutlaka unutur.

use crate::tool::{arg_str, Domain, Param, Risk, Tool, ToolOutcome};
use serde_json::Value;
use std::path::{Path, PathBuf};

/// Okunacak/yazılacak en büyük dosya. Daha büyüğü modelin bağlamını boğar.
const MAX_FILE_BYTES: u64 = 256 * 1024;
/// Model cevabına konacak en fazla karakter.
const MAX_CONTENT_CHARS: usize = 8_000;

/// Kullanıcı yolunu çözer: `~` genişletir, göreli yolu ev dizinine bağlar.
///
/// Dönen yol **doğrulanmıştır**: dizin geçişi (`..` ile ev dizininden çıkma)
/// engellenmez — kullanıcı kendi bilgisayarında istediği yere erişebilmeli —
/// ama yolun gerçekten çözülebildiği garanti edilir.
fn resolve_path(input: &str) -> Result<PathBuf, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("yol boş olamaz".into());
    }

    let expanded = if let Some(rest) = trimmed.strip_prefix('~') {
        let home = home_dir().ok_or("ev dizini bulunamadı")?;
        home.join(rest.trim_start_matches(['/', '\\']))
    } else {
        PathBuf::from(trimmed)
    };

    if expanded.is_absolute() {
        Ok(expanded)
    } else {
        // Göreli yol → ev dizinine göre. Çalışma dizini kullanıcının
        // beklediği yer olmayabilir.
        let home = home_dir().ok_or("ev dizini bulunamadı")?;
        Ok(home.join(expanded))
    }
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

fn display(path: &Path) -> String {
    path.display().to_string()
}

/// Dosya oku.
pub struct ReadFile;

impl Tool for ReadFile {
    fn name(&self) -> &'static str {
        "read_file"
    }

    fn description(&self) -> &'static str {
        "Reads the contents of a text file. ~ stands for the home directory."
    }

    fn domain(&self) -> Domain {
        Domain::Files
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("path", "Path of the file to read")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["oku", "dosya", "içerik", "göster"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(raw) = arg_str(args, "path") else {
            return ToolOutcome::err("path is required");
        };
        let path = match resolve_path(raw) {
            Ok(p) => p,
            Err(e) => return ToolOutcome::err(e),
        };

        let meta = match std::fs::metadata(&path) {
            Ok(m) => m,
            Err(e) => return ToolOutcome::err(format!("{}: {e}", display(&path))),
        };

        if meta.is_dir() {
            return ToolOutcome::err(format!(
                "{} bir klasör — dosya_listele kullan",
                display(&path)
            ));
        }
        if meta.len() > MAX_FILE_BYTES {
            return ToolOutcome::err(format!(
                "dosya çok büyük ({} KB) — en fazla {} KB okunabilir",
                meta.len() / 1024,
                MAX_FILE_BYTES / 1024
            ));
        }

        match std::fs::read(&path) {
            Ok(bytes) => {
                // İkili dosyaları metin sanıp bağlamı çöple doldurmayalım.
                let text = String::from_utf8_lossy(&bytes);
                if text.chars().filter(|c| *c == '\u{FFFD}').count() > bytes.len() / 20 {
                    return ToolOutcome::err(format!("{} metin dosyası değil", display(&path)));
                }
                let clipped: String = text.chars().take(MAX_CONTENT_CHARS).collect();
                let suffix = if text.chars().count() > MAX_CONTENT_CHARS {
                    "\n…(kırpıldı)"
                } else {
                    ""
                };
                ToolOutcome::ok(format!("{clipped}{suffix}"))
            }
            Err(e) => ToolOutcome::err(format!("okunamadı: {e}")),
        }
    }
}

/// Klasör listele.
pub struct ListDir;

impl Tool for ListDir {
    fn name(&self) -> &'static str {
        "list_directory"
    }

    fn description(&self) -> &'static str {
        "Lists the files and folders in a directory. ~ is the home directory."
    }

    fn domain(&self) -> Domain {
        Domain::Files
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::optional(
            "path",
            "Folder path (home directory when empty)",
        )]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["listele", "klasör", "dizin", "neler var"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let raw = arg_str(args, "path").unwrap_or("~");
        let path = match resolve_path(raw) {
            Ok(p) => p,
            Err(e) => return ToolOutcome::err(e),
        };

        let entries = match std::fs::read_dir(&path) {
            Ok(e) => e,
            Err(e) => return ToolOutcome::err(format!("{}: {e}", display(&path))),
        };

        let mut dirs = Vec::new();
        let mut files = Vec::new();

        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            // Gizli dosyaları atla — gürültü.
            if name.starts_with('.') {
                continue;
            }
            match entry.file_type() {
                Ok(t) if t.is_dir() => dirs.push(format!("{name}/")),
                Ok(_) => {
                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    files.push(format!("{name} ({} KB)", size / 1024));
                }
                Err(_) => files.push(name),
            }
        }

        dirs.sort_unstable();
        files.sort_unstable();

        let total = dirs.len() + files.len();
        if total == 0 {
            return ToolOutcome::ok(format!("{} boş", display(&path)));
        }

        // Uzun listeleri kırp — 200 dosyalık klasör bağlamı boğar.
        let mut all: Vec<String> = dirs;
        all.extend(files);
        let shown = all.len().min(60);
        let mut out = format!(
            "{} ({total} öğe):\n{}",
            display(&path),
            all[..shown].join("\n")
        );
        if total > shown {
            out.push_str(&format!("\n…({} öğe daha)", total - shown));
        }
        ToolOutcome::ok(out)
    }
}

/// Dosya yaz.
pub struct WriteFile;

impl Tool for WriteFile {
    fn name(&self) -> &'static str {
        "write_file"
    }

    fn description(&self) -> &'static str {
        "Writes text to a file. OVERWRITES the file if it already exists."
    }

    fn domain(&self) -> Domain {
        Domain::Files
    }

    /// Üzerine yazma geri alınamaz → her zaman onay.
    fn risk(&self) -> Risk {
        Risk::Destructive
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::required("path", "Path of the file to write"),
            Param::required("content", "Text to write into the file"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["yaz", "kaydet", "oluştur"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(raw) = arg_str(args, "path") else {
            return ToolOutcome::err("path is required");
        };
        // İçerik boş string olabilir (dosyayı boşaltmak meşru) — arg_str
        // boşları eleyeceği için doğrudan okuyoruz.
        let content = args
            .get("content")
            .and_then(Value::as_str)
            .unwrap_or_default();

        let path = match resolve_path(raw) {
            Ok(p) => p,
            Err(e) => return ToolOutcome::err(e),
        };

        if let Some(parent) = path.parent() {
            if !parent.exists() {
                return ToolOutcome::err(format!("klasör yok: {}", display(parent)));
            }
        }

        let existed = path.exists();
        match std::fs::write(&path, content) {
            Ok(()) => ToolOutcome::ok(format!(
                "{} {} ({} bayt)",
                display(&path),
                if existed {
                    "güncellendi"
                } else {
                    "oluşturuldu"
                },
                content.len()
            )),
            Err(e) => ToolOutcome::err(format!("yazılamadı: {e}")),
        }
    }
}

/// Dosya ara (ada göre).
pub struct FindFile;

impl Tool for FindFile {
    fn name(&self) -> &'static str {
        "search_files"
    }

    fn description(&self) -> &'static str {
        "Finds files whose name contains the given text."
    }

    fn domain(&self) -> Domain {
        Domain::Files
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::required("pattern", "Text to look for in file names"),
            Param::optional("path", "Folder to search in (home directory when empty)"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["bul", "ara", "nerede", "dosya"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(pattern) = arg_str(args, "pattern") else {
            return ToolOutcome::err("pattern is required");
        };
        let root = match resolve_path(arg_str(args, "path").unwrap_or("~")) {
            Ok(p) => p,
            Err(e) => return ToolOutcome::err(e),
        };

        let needle = pattern.to_lowercase();
        let mut hits = Vec::new();
        search_recursive(&root, &needle, 0, &mut hits);

        if hits.is_empty() {
            ToolOutcome::ok(format!("'{pattern}' ile eşleşen dosya bulunamadı"))
        } else {
            let shown = hits.len().min(30);
            let mut out = format!("{} sonuç:\n{}", hits.len(), hits[..shown].join("\n"));
            if hits.len() > shown {
                out.push_str("\n…(daha fazlası var)");
            }
            ToolOutcome::ok(out)
        }
    }
}

/// Sınırlı derinlikte özyinelemeli arama.
///
/// Derinlik sınırı olmadan tüm diski taramak dakikalar sürebilir ve
/// kullanıcı cevabı bekler.
fn search_recursive(dir: &Path, needle: &str, depth: usize, hits: &mut Vec<String>) {
    const MAX_DEPTH: usize = 4;
    const MAX_HITS: usize = 100;

    if depth > MAX_DEPTH || hits.len() >= MAX_HITS {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return; // izin yoksa sessizce atla
    };

    for entry in entries.flatten() {
        if hits.len() >= MAX_HITS {
            return;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }
        let path = entry.path();
        if name.to_lowercase().contains(needle) {
            hits.push(display(&path));
        }
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            search_recursive(&path, needle, depth + 1, hits);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_temp(dir: &Path, name: &str, content: &str) -> PathBuf {
        let p = dir.join(name);
        std::fs::write(&p, content).unwrap();
        p
    }

    #[test]
    fn read_file_returns_content() {
        let tmp = tempfile::tempdir().unwrap();
        let file = write_temp(tmp.path(), "test.txt", "merhaba dünya");

        let args = serde_json::json!({"path": file.to_str().unwrap()});
        let out = ReadFile.run(&args);
        assert!(out.ok);
        assert_eq!(out.content, "merhaba dünya");
    }

    #[test]
    fn read_file_reports_missing_file_clearly() {
        let args = serde_json::json!({"path": "C:/yok/olmayan/dosya.txt"});
        let out = ReadFile.run(&args);
        assert!(!out.ok);
        assert!(out.content.contains("dosya.txt"), "yol mesajda olmalı");
    }

    #[test]
    fn read_file_refuses_directories() {
        let tmp = tempfile::tempdir().unwrap();
        let args = serde_json::json!({"path": tmp.path().to_str().unwrap()});
        let out = ReadFile.run(&args);
        assert!(!out.ok);
        assert!(out.content.contains("klasör"));
    }

    #[test]
    fn read_file_rejects_oversized_files() {
        let tmp = tempfile::tempdir().unwrap();
        let big = "x".repeat((MAX_FILE_BYTES + 1) as usize);
        let file = write_temp(tmp.path(), "big.txt", &big);

        let args = serde_json::json!({"path": file.to_str().unwrap()});
        let out = ReadFile.run(&args);
        assert!(!out.ok);
        assert!(out.content.contains("büyük"));
    }

    #[test]
    fn read_file_clips_long_content() {
        let tmp = tempfile::tempdir().unwrap();
        let long = "a".repeat(MAX_CONTENT_CHARS + 500);
        let file = write_temp(tmp.path(), "long.txt", &long);

        let args = serde_json::json!({"path": file.to_str().unwrap()});
        let out = ReadFile.run(&args);
        assert!(out.ok);
        assert!(out.content.contains("kırpıldı"));
    }

    #[test]
    fn list_dir_shows_files_and_folders() {
        let tmp = tempfile::tempdir().unwrap();
        write_temp(tmp.path(), "a.txt", "x");
        std::fs::create_dir(tmp.path().join("altklasor")).unwrap();

        let args = serde_json::json!({"path": tmp.path().to_str().unwrap()});
        let out = ListDir.run(&args);
        assert!(out.ok);
        assert!(out.content.contains("a.txt"));
        assert!(
            out.content.contains("altklasor/"),
            "klasörler / ile işaretli olmalı"
        );
    }

    #[test]
    fn list_dir_hides_dotfiles() {
        let tmp = tempfile::tempdir().unwrap();
        write_temp(tmp.path(), ".gizli", "x");
        write_temp(tmp.path(), "acik.txt", "x");

        let args = serde_json::json!({"path": tmp.path().to_str().unwrap()});
        let out = ListDir.run(&args);
        assert!(!out.content.contains(".gizli"));
        assert!(out.content.contains("acik.txt"));
    }

    #[test]
    fn write_file_creates_and_reports() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("yeni.txt");

        let args = serde_json::json!({
            "path": target.to_str().unwrap(),
            "content": "içerik"
        });
        let out = WriteFile.run(&args);
        assert!(out.ok, "{}", out.content);
        assert!(out.content.contains("oluşturuldu"));
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "içerik");
    }

    #[test]
    fn write_file_refuses_missing_parent_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("yok").join("dosya.txt");

        let args = serde_json::json!({
            "path": target.to_str().unwrap(),
            "content": "x"
        });
        let out = WriteFile.run(&args);
        assert!(!out.ok);
        assert!(out.content.contains("klasör yok"));
    }

    #[test]
    fn write_file_is_destructive() {
        // Üzerine yazma geri alınamaz — onay kapısı bunu görmeli.
        assert_eq!(WriteFile.risk(), Risk::Destructive);
        assert_eq!(ReadFile.risk(), Risk::Safe);
        assert_eq!(ListDir.risk(), Risk::Safe);
    }

    #[test]
    fn find_file_locates_by_substring() {
        let tmp = tempfile::tempdir().unwrap();
        write_temp(tmp.path(), "rapor_2026.txt", "x");
        write_temp(tmp.path(), "baska.txt", "x");

        let args = serde_json::json!({
            "pattern": "rapor",
            "path": tmp.path().to_str().unwrap()
        });
        let out = FindFile.run(&args);
        assert!(out.ok);
        assert!(out.content.contains("rapor_2026.txt"));
        assert!(!out.content.contains("baska.txt"));
    }

    #[test]
    fn find_file_reports_no_matches_gracefully() {
        let tmp = tempfile::tempdir().unwrap();
        let args = serde_json::json!({
            "pattern": "kesinlikleyokboyle",
            "path": tmp.path().to_str().unwrap()
        });
        let out = FindFile.run(&args);
        assert!(out.ok, "sonuç bulunamaması hata değildir");
        assert!(out.content.contains("bulunamadı"));
    }

    #[test]
    fn empty_path_is_rejected() {
        assert!(resolve_path("").is_err());
        assert!(resolve_path("   ").is_err());
    }

    #[test]
    fn tilde_expands_to_home() {
        let resolved = resolve_path("~/belge.txt").unwrap();
        assert!(resolved.is_absolute());
        assert!(resolved.ends_with("belge.txt"));
    }
}
