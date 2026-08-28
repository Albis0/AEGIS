//! # vavis-tools — ELLER katmanı
//!
//! Asistanın gerçek işler yapmasını sağlayan yetenekler.
//!
//! Mimari kural: bu katman `vavis-core` ve `vavis-brain`'i kullanır; arayüzü
//! tanımaz. Onay sorma işi `AgentHost` trait'i üzerinden dışarı devredilir —
//! böylece hem gerçek arayüz hem de test aynı mantığı çalıştırır.
//!
//! # Tasarımın özü
//!
//! Eski projede 353 tool vardı ve modele 64'ü sunuluyordu. Burada az sayıda
//! geniş kapsamlı tool var ve modele **asla 12'den fazlası gönderilmez**
//! (bkz. [`selection::MAX_TOOLS`]).

pub mod agent;
pub mod builtin;
pub mod permission;
pub mod selection;
pub mod tool;

pub use agent::{Agent, AgentHost, Approval, MAX_STEPS};
pub use permission::{ApprovalReason, Decision, PermissionGate};
pub use selection::{match_domains, select_tools, MAX_TOOLS};
pub use tool::{Domain, Param, Registry, Risk, Tool, ToolOutcome};

/// Tüm yerleşik tool'larla dolu bir kayıt defteri.
pub fn default_registry() -> Registry {
    let mut reg = Registry::new();
    builtin::register_all(&mut reg);
    reg
}
