//! Çekirdek hata tipleri.
//!
//! Kural: kütüphane katmanı somut hata döner (`CoreError`), uygulama katmanı
//! `anyhow` ile sarar. Böylece çağıran taraf hatayı *ayırt edebilir* — eski
//! projede her şey string'e çevrildiği için "dosya yok" ile "izin yok" ayrımı
//! kaybolmuştu.

use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("ayar dosyası okunamadı: {path}")]
    ConfigRead {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("ayar dosyası bozuk: {path}")]
    ConfigParse {
        path: PathBuf,
        #[source]
        source: toml::de::Error,
    },

    #[error("ayar dosyası yazılamadı: {path}")]
    ConfigWrite {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("veri dizini bulunamadı (işletim sistemi ev dizinini vermedi)")]
    NoDataDir,

    #[error("veritabanı hatası")]
    Database(#[from] rusqlite::Error),

    #[error("dizin oluşturulamadı: {path}")]
    CreateDir {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
}

pub type Result<T> = std::result::Result<T, CoreError>;
