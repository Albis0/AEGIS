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

    /// `toml::de::Error` yüzlerce bayt — kutuya alınmazsa `CoreError`'ün
    /// tamamı şişer ve **her** `Result<T>` o boyutu taşır. Hata nadir,
    /// başarı sık: maliyeti hataya yüklüyoruz.
    #[error("ayar dosyası bozuk: {path}")]
    ConfigParse {
        path: PathBuf,
        #[source]
        source: Box<toml::de::Error>,
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
