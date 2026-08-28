//! Yerleşik tool'lar.
//!
//! Eski projede 353 tool vardı ve `routine_*` gibi tek özellik için 9 ayrı
//! tool tanımlanmıştı. Burada bilinçli olarak **az sayıda, geniş kapsamlı**
//! tool var — model az seçenek arasından daha isabetli seçer.

pub mod core;
pub mod files;
pub mod memory;
pub mod system;
pub mod web;

use crate::tool::Registry;

/// Tüm yerleşik tool'ları kaydeder.
pub fn register_all(registry: &mut Registry) {
    // Çekirdek — her alanla birlikte sunulur.
    registry.register(Box::new(core::Now));
    registry.register(Box::new(core::Calculate));

    // Sistem.
    registry.register(Box::new(system::SystemInfo));
    registry.register(Box::new(system::ListProcesses));
    registry.register(Box::new(system::Battery));
    registry.register(Box::new(system::SetVolume));

    // Dosya.
    registry.register(Box::new(files::ReadFile));
    registry.register(Box::new(files::ListDir));
    registry.register(Box::new(files::WriteFile));
    registry.register(Box::new(files::FindFile));

    // Web.
    registry.register(Box::new(web::WebSearch));
    registry.register(Box::new(web::FetchUrl));

    // Hafıza.
    registry.register(Box::new(memory::Remember));
    registry.register(Box::new(memory::Recall));
    registry.register(Box::new(memory::Forget));
}
