//! Loglama — dosyaya + konsola.
//!
//! Neden önemli: kullanıcı app'i deneyip "çalışmadı" dediğinde elimizde kayıt
//! olmalı. Eski projede konsola basılan loglar pencere kapanınca kayboluyordu.
//!
//! Günlük dosya döndürme: `logs/vavis.log.YYYY-MM-DD`

use crate::paths::Paths;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Döndüğü guard **canlı tutulmalı** — düşerse arka plan yazıcı durur ve
/// tamponlanmış loglar diske yazılmaz.
#[must_use = "guard düşerse log yazımı durur — main içinde tutun"]
pub struct LogGuard(#[allow(dead_code)] WorkerGuard);

pub fn init(paths: &Paths) -> LogGuard {
    let _ = paths.ensure();

    let appender = tracing_appender::rolling::daily(paths.log_dir(), "vavis.log");
    let (writer, guard) = tracing_appender::non_blocking(appender);

    // Varsayılan: info. `VAVIS_LOG=debug` ile ayrıntı açılır.
    let filter = EnvFilter::try_from_env("VAVIS_LOG").unwrap_or_else(|_| EnvFilter::new("info"));

    let file_layer = fmt::layer().with_writer(writer).with_ansi(false).with_target(false);
    let console_layer = fmt::layer().with_target(false);

    // `try_init` — testlerde iki kez çağrılırsa panik yerine sessizce geçer.
    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(file_layer)
        .with(console_layer)
        .try_init();

    LogGuard(guard)
}
