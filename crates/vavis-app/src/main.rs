//! VAVIS — giriş noktası.
//!
//! Görevi sadece bağlamak: panik yakalayıcı → log → çekirdek → arayüz.
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

    install_panic_hook(&paths);

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

/// Panikleri log dosyasına yazar.
///
/// Sürüm derlemesinde konsol yok — panik mesajı hiçbir yere gitmezdi.
/// Kullanıcı "kapandı gitti" der, elimizde kanıt olmazdı. Artık log
/// dosyasında duruyor.
fn install_panic_hook(paths: &Paths) {
    let log_dir = paths.log_dir();
    let default_hook = std::panic::take_hook();

    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "bilinmiyor".to_string());

        // Panik yükü genelde &str veya String olur.
        let message = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| (*s).to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "sebep bilinmiyor".to_string());

        tracing::error!(location, message, "PANİK — uygulama çöktü");

        // Loglama altyapısı da bozulmuş olabilir; ayrı bir dosyaya da yaz.
        let crash_file = log_dir.join("cokme.log");
        let entry = format!(
            "[{}] {location}\n{message}\n\n",
            chrono_like_timestamp()
        );
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&crash_file)
            .and_then(|mut f| {
                use std::io::Write;
                f.write_all(entry.as_bytes())
            });

        default_hook(info);
    }));
}

/// Bağımlılık eklemeden kaba bir zaman damgası.
///
/// `chrono` bu crate'te yok; çökme kaydı için Unix zamanı yeterli.
fn chrono_like_timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
