//! VAVIS — giriş noktası.
//!
//! Görevi sadece bağlamak: log kur → çekirdeği aç → arayüzü çalıştır.
//! Mantık burada durmaz; her şey katmanlarda.

// Sürüm derlemesinde konsol penceresi açılmasın (Windows).
// Hata ayıklarken konsol lazım olduğu için debug'da açık kalır.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::{Context, Result};
use vavis_core::{App, Paths};

fn main() -> Result<()> {
    let paths = Paths::discover().context("veri dizini belirlenemedi")?;

    // Guard main bitene kadar yaşamalı — düşerse loglar diske yazılmaz.
    let _log_guard = vavis_core::logging::init(&paths);

    // Açılıştaki her hata artık loglanabilir (log ilk kuruldu).
    let core = match App::boot(paths) {
        Ok(core) => core,
        Err(err) => {
            tracing::error!(%err, "açılış başarısız");
            return Err(err).context("VAVIS açılamadı");
        }
    };

    if let Err(err) = vavis_ui::run(core) {
        tracing::error!(%err, "arayüz hatası");
        anyhow::bail!("arayüz başlatılamadı: {err}");
    }

    tracing::info!("vavis kapandı");
    Ok(())
}
