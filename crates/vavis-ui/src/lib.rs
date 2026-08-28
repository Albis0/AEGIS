//! # vavis-ui — KABUK katmanı
//!
//! Terminal görünümlü sade arayüz (egui). Bu katman `vavis-core`'u kullanır,
//! ama çekirdek bu katmanı tanımaz — arayüz sonra tamamen değişse bile alt
//! katmanlara dokunulmaz.

pub mod app;
pub mod bridge;
pub mod commands;
pub mod voice;
pub mod feed;
pub mod theme;
pub mod ticker;

pub use app::VavisUi;
pub use bridge::{Bridge, UiEvent};
pub use commands::Command;
pub use ticker::{Fired, Ticker};
pub use voice::{VoiceEvent, VoiceManager};
pub use feed::{Feed, Line, Speaker};

use vavis_core::{App as CoreApp, WindowMode};

/// Pencereyi açar ve olay döngüsünü başlatır. Kapanana kadar döner.
pub fn run(core: CoreApp) -> eframe::Result<()> {
    let mode = core.config.window_mode();

    let mut viewport = eframe::egui::ViewportBuilder::default()
        .with_title(format!("VAVIS v{}", vavis_core::VERSION))
        .with_inner_size([900.0, 620.0])
        .with_min_inner_size([420.0, 300.0]);

    // Manuel testte istenen özellik: üç pencere modu.
    viewport = match mode {
        WindowMode::Windowed => viewport,
        WindowMode::Borderless => viewport.with_decorations(false).with_maximized(true),
        WindowMode::Fullscreen => viewport.with_fullscreen(true),
    };

    tracing::info!(?mode, "pencere açılıyor");

    eframe::run_native(
        "vavis",
        eframe::NativeOptions {
            viewport,
            ..Default::default()
        },
        Box::new(move |cc| Ok(Box::new(VavisUi::new(cc, core)))),
    )
}
