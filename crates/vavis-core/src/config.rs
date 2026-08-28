//! Ayarlar (TOML).
//!
//! Tasarım kararları:
//! 1. **Her alanın varsayılanı var.** Eksik alan hata değil — eski sürümden
//!    gelen dosya yeni alanlar eklendiğinde de okunabilir kalır.
//! 2. **Bozuk dosya app'i öldürmez.** `load_or_default` bozuk dosyayı yedekleyip
//!    varsayılanla devam eder. (Eski projede bozuk ayar açılışı engelliyordu.)
//! 3. **Atomik yazma.** Önce `.tmp`'ye yaz, sonra taşı — yazma sırasında elektrik
//!    giderse ayar dosyası yarım kalmaz.

use crate::error::{CoreError, Result};
use crate::paths::Paths;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Config {
    pub general: General,
    pub ui: Ui,
    pub llm: Llm,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Llm {
    /// "groq" | "openai" | "gemini" | "mistral" | "deepseek" | "xai" | "local"
    pub provider: String,
    /// Boş bırakılırsa sağlayıcının varsayılan modeli kullanılır.
    pub model: String,
}

impl Default for Llm {
    fn default() -> Self {
        Self {
            // Groq varsayılan: ücretsiz katmanı var ve hızlı.
            provider: "groq".to_string(),
            model: String::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct General {
    /// Asistanın kendine verdiği ad. TTS bunu okuyacağı için telaffuza uygun.
    pub assistant_name: String,
    /// Arayüz dili: "tr" | "en"
    pub language: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Ui {
    /// Terminal görünümü için yazı boyutu.
    pub font_size: f32,
    /// Pencere modu: "windowed" | "borderless" | "fullscreen"
    /// (Manuel testte istenen özellik — F1'den itibaren var.)
    pub window_mode: String,
}

impl Default for General {
    fn default() -> Self {
        Self {
            assistant_name: "Vavis".to_string(),
            language: "tr".to_string(),
        }
    }
}

impl Default for Ui {
    fn default() -> Self {
        Self {
            font_size: 14.0,
            window_mode: "windowed".to_string(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            general: General::default(),
            ui: Ui::default(),
            llm: Llm::default(),
        }
    }
}

/// Pencere modu — string yerine tip. Geçersiz değer sessizce `Windowed` olur.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowMode {
    Windowed,
    Borderless,
    Fullscreen,
}

impl WindowMode {
    pub fn parse(s: &str) -> Self {
        match s.trim().to_ascii_lowercase().as_str() {
            "borderless" => Self::Borderless,
            "fullscreen" => Self::Fullscreen,
            _ => Self::Windowed,
        }
    }
}

impl Config {
    pub fn window_mode(&self) -> WindowMode {
        WindowMode::parse(&self.ui.window_mode)
    }

    /// Dosyadan oku. Dosya yoksa varsayılanı döner (hata değil).
    pub fn load(paths: &Paths) -> Result<Self> {
        let file = paths.config_file();
        if !file.exists() {
            return Ok(Self::default());
        }
        let text = std::fs::read_to_string(&file).map_err(|source| CoreError::ConfigRead {
            path: file.clone(),
            source,
        })?;
        toml::from_str(&text).map_err(|source| CoreError::ConfigParse { path: file, source })
    }

    /// Bozuk dosyada çökmek yerine: yedekle, uyar, varsayılanla devam et.
    ///
    /// Açılışın hiçbir koşulda engellenmemesi için ana yol budur.
    pub fn load_or_default(paths: &Paths) -> Self {
        match Self::load(paths) {
            Ok(cfg) => cfg,
            Err(err) => {
                tracing::warn!(%err, "ayar dosyası okunamadı — varsayılana dönülüyor");
                let file = paths.config_file();
                if file.exists() {
                    let backup = file.with_extension("toml.bozuk");
                    if let Err(e) = std::fs::rename(&file, &backup) {
                        tracing::warn!(%e, "bozuk ayar yedeklenemedi");
                    } else {
                        tracing::info!(backup = %backup.display(), "bozuk ayar yedeklendi");
                    }
                }
                Self::default()
            }
        }
    }

    /// Atomik yazma: `.tmp` → rename. Yarım dosya bırakmaz.
    pub fn save(&self, paths: &Paths) -> Result<()> {
        paths.ensure()?;
        let file = paths.config_file();
        let text = toml::to_string_pretty(self).expect("Config her zaman serileştirilebilir");

        let tmp = file.with_extension("toml.tmp");
        std::fs::write(&tmp, &text).map_err(|source| CoreError::ConfigWrite {
            path: tmp.clone(),
            source,
        })?;
        std::fs::rename(&tmp, &file).map_err(|source| CoreError::ConfigWrite {
            path: file.clone(),
            source,
        })?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_paths() -> (tempfile::TempDir, Paths) {
        let tmp = tempfile::tempdir().unwrap();
        let paths = Paths::with_root(tmp.path());
        paths.ensure().unwrap();
        (tmp, paths)
    }

    #[test]
    fn defaults_are_sane() {
        let cfg = Config::default();
        assert_eq!(cfg.general.assistant_name, "Vavis");
        assert_eq!(cfg.general.language, "tr");
        assert_eq!(cfg.window_mode(), WindowMode::Windowed);
    }

    #[test]
    fn missing_file_yields_defaults() {
        let (_tmp, paths) = tmp_paths();
        assert_eq!(Config::load(&paths).unwrap(), Config::default());
    }

    #[test]
    fn save_then_load_roundtrips() {
        let (_tmp, paths) = tmp_paths();
        let mut cfg = Config::default();
        cfg.ui.font_size = 18.0;
        cfg.ui.window_mode = "fullscreen".into();
        cfg.save(&paths).unwrap();

        let loaded = Config::load(&paths).unwrap();
        assert_eq!(loaded, cfg);
        assert_eq!(loaded.window_mode(), WindowMode::Fullscreen);
    }

    #[test]
    fn partial_file_fills_missing_fields() {
        // Eski sürümden gelen, yeni alanları olmayan dosya okunabilmeli.
        let (_tmp, paths) = tmp_paths();
        std::fs::write(paths.config_file(), "[general]\nlanguage = \"en\"\n").unwrap();

        let cfg = Config::load(&paths).unwrap();
        assert_eq!(cfg.general.language, "en");
        assert_eq!(cfg.general.assistant_name, "Vavis"); // varsayılandan geldi
        assert_eq!(cfg.ui.font_size, 14.0);
    }

    #[test]
    fn corrupt_file_is_backed_up_not_fatal() {
        let (_tmp, paths) = tmp_paths();
        std::fs::write(paths.config_file(), "bu geçerli toml değil {{{").unwrap();

        let cfg = Config::load_or_default(&paths);
        assert_eq!(cfg, Config::default());
        assert!(paths.config_file().with_extension("toml.bozuk").exists());
    }

    #[test]
    fn save_leaves_no_temp_file() {
        let (_tmp, paths) = tmp_paths();
        Config::default().save(&paths).unwrap();
        assert!(!paths.config_file().with_extension("toml.tmp").exists());
    }

    #[test]
    fn window_mode_parsing_is_forgiving() {
        assert_eq!(WindowMode::parse("FullScreen"), WindowMode::Fullscreen);
        assert_eq!(WindowMode::parse(" borderless "), WindowMode::Borderless);
        assert_eq!(WindowMode::parse("saçmalık"), WindowMode::Windowed);
    }
}
