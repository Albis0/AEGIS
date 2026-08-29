//! Dosya yolları — tek kaynak.
//!
//! Eski projede yollar birden çok yerde hesaplanıyordu ve bazıları farklı
//! dizinlere yazıyordu. Burada tek bir `Paths` var; başka hiçbir yer kendi
//! yolunu üretmez.
//!
//! Windows'ta: `%APPDATA%\vavis\`

use crate::error::{CoreError, Result};
use directories::ProjectDirs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct Paths {
    root: PathBuf,
}

impl Paths {
    /// İşletim sisteminin standart veri dizinini kullanır.
    pub fn discover() -> Result<Self> {
        let dirs = ProjectDirs::from("", "", "vavis").ok_or(CoreError::NoDataDir)?;
        Ok(Self::with_root(dirs.data_dir()))
    }

    /// Testler ve taşınabilir kurulum için: kökü doğrudan ver.
    pub fn with_root(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn config_file(&self) -> PathBuf {
        self.root.join("vavis.toml")
    }

    pub fn database_file(&self) -> PathBuf {
        self.root.join("vavis.db")
    }

    pub fn log_dir(&self) -> PathBuf {
        self.root.join("logs")
    }

    /// Generated images and video.
    ///
    /// The database stores only a path relative to this directory: writing a
    /// multi-megabyte image into SQLite bloats the file and slows every read
    /// that has nothing to do with the gallery.
    pub fn media_dir(&self) -> PathBuf {
        self.root.join("media")
    }

    /// Gereken tüm dizinleri oluşturur. Zaten varsa sorun değil.
    pub fn ensure(&self) -> Result<()> {
        for dir in [self.root.clone(), self.log_dir(), self.media_dir()] {
            std::fs::create_dir_all(&dir).map_err(|source| CoreError::CreateDir {
                path: dir.clone(),
                source,
            })?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ensure_creates_root_and_logs() {
        let tmp = tempfile::tempdir().unwrap();
        let paths = Paths::with_root(tmp.path().join("vavis"));

        assert!(!paths.root().exists());
        paths.ensure().unwrap();

        assert!(paths.root().exists());
        assert!(paths.log_dir().exists());
    }

    #[test]
    fn ensure_is_idempotent() {
        let tmp = tempfile::tempdir().unwrap();
        let paths = Paths::with_root(tmp.path());
        paths.ensure().unwrap();
        paths.ensure().unwrap(); // ikinci çağrı hata vermemeli
    }

    #[test]
    fn files_live_under_root() {
        let paths = Paths::with_root("/tmp/x");
        assert!(paths.config_file().starts_with("/tmp/x"));
        assert!(paths.database_file().starts_with("/tmp/x"));
    }
}
