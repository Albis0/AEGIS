//! HUD çizimi — arayüzün görsel katmanı.
//!
//! `app.rs` durumu tutar ve olayları işler; bu modül **sadece çizer**.
//! Ayrı tutmanın sebebi: görünüm değiştiğinde mantığa dokunulmasın.
//!
//! # Düzen
//!
//! ```text
//! ┌──────────┬────────────────────────┬──────────┐
//! │ SYSTEM   │                        │  ◉ core  │
//! │ CPU ▓▓░  │      sohbet akışı      │  IDLE    │
//! │ PWR ▓▓▓  │                        │          │
//! │          │   ┌──────────────┐     │  KEYS    │
//! │ SESSION  │   │ ❯ kullanıcı  │     │  ESC ... │
//! │ provider │   └──────────────┘     │          │
//! │ model    │   ┌──────────────┐     │  RUNNING │
//! │ tools    │   │ ◆ asistan    │     │  ...     │
//! │          │   └──────────────┘     │          │
//! ├──────────┴────────────────────────┴──────────┤
//! │ ❯ giriş satırı                               │
//! └──────────────────────────────────────────────┘
//! ```

use crate::feed::{Line, Speaker};
use crate::markdown;
use crate::theme::Theme;
use egui::{Color32, RichText, Ui};

/// Panel başlığı — ince, camgöbeği, altı çizgili.
pub fn panel_title(ui: &mut Ui, text: &str) {
    ui.label(
        RichText::new(text)
            .small()
            .strong()
            .color(Theme::alpha(Theme::CYAN, 180)),
    );

    let width = ui.available_width();
    let (rect, _) = ui.allocate_exact_size(egui::vec2(width, 1.0), egui::Sense::hover());
    ui.painter()
        .rect_filled(rect, 0.0, Theme::alpha(Theme::CYAN_DIM, 120));
    ui.add_space(4.0);
}

/// Etiket + değer satırı.
///
/// Değer kısaysa aynı satırda sağa dayalı; uzunsa alt satıra iner.
/// Tek satırda zorlamak dar panelde metinleri üst üste bindiriyordu.
pub fn stat(ui: &mut Ui, label: &str, value: &str) {
    // Eşik deneyerek bulundu: 170 px genişlikte, küçük yazıyla bu uzunluğa
    // kadar etiket + değer yan yana sığıyor.
    const INLINE_LIMIT: usize = 14;

    if value.chars().count() <= INLINE_LIMIT {
        ui.horizontal(|ui| {
            ui.label(RichText::new(label).small().color(Theme::FG_DIM));
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(RichText::new(value).small().color(Theme::FG));
            });
        });
    } else {
        ui.label(RichText::new(label).small().color(Theme::FG_DIM));
        ui.horizontal(|ui| {
            ui.add_space(8.0);
            ui.label(RichText::new(value).small().color(Theme::FG));
        });
    }
}

/// Doluluk çubuğu — CPU, pil gibi ölçümler için.
pub fn meter(ui: &mut Ui, label: &str, fraction: f32, value: &str, colour: Color32) {
    ui.horizontal(|ui| {
        ui.label(RichText::new(label).small().color(Theme::FG_DIM));
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(RichText::new(value).small().color(colour));
        });
    });

    let width = ui.available_width();
    let (rect, _) = ui.allocate_exact_size(egui::vec2(width, 4.0), egui::Sense::hover());
    let painter = ui.painter();

    // Boş kısım önce, dolu kısım üstüne.
    painter.rect_filled(rect, 1.0, Theme::alpha(Theme::BORDER, 200));
    let filled = egui::Rect::from_min_size(
        rect.min,
        egui::vec2(rect.width() * fraction.clamp(0.0, 1.0), rect.height()),
    );
    painter.rect_filled(filled, 1.0, colour);

    ui.add_space(6.0);
}

/// Uzun model adlarını kısaltır — yan panel dar.
///
/// Karakter sınırında kesmek Türkçe/UTF-8'de paniğe yol açabilir; bu yüzden
/// karakterle sayıyoruz, baytla değil.
pub fn short_model(model: &str) -> String {
    // Panel 170 px; kucuk yaziyla ~14 karakter sigiyor.
    const MAX: usize = 14;
    if model.chars().count() <= MAX {
        return model.to_string();
    }
    let cut: String = model.chars().take(MAX - 1).collect();
    format!("{cut}…")
}

/// Bir mesajı çizer.
///
/// Kullanıcı ve asistan mesajları kart içinde (okuması kolay); sistem, tool
/// ve hata satırları çerçevesiz (akışı bölmesinler).
pub fn draw_message(ui: &mut Ui, line: &Line) {
    let (colour, prefix, framed) = match line.speaker {
        Speaker::User => (Theme::CYAN_BRIGHT, "❯", true),
        Speaker::Assistant => (Theme::FG, "◆", true),
        Speaker::System => (Theme::FG_DIM, "·", false),
        Speaker::Error => (Theme::ERROR, "✗", false),
        Speaker::Tool => (Theme::AMBER, "⚙", false),
    };

    if framed {
        let border = if line.speaker == Speaker::User {
            Theme::CYAN_DIM
        } else {
            Theme::BORDER
        };

        egui::Frame::none()
            .fill(Theme::BG_CARD)
            .stroke(egui::Stroke::new(1.0_f32, Theme::alpha(border, 200)))
            .rounding(Theme::RADIUS)
            .inner_margin(egui::Margin::symmetric(10.0, 8.0))
            .outer_margin(egui::Margin::symmetric(0.0, 3.0))
            .show(ui, |ui| {
                ui.horizontal_top(|ui| {
                    ui.label(RichText::new(prefix).color(colour));
                    ui.add_space(4.0);

                    ui.vertical(|ui| {
                        // Asistan cevapları markdown içerir: kod blokları,
                        // listeler, tablolar. Düz metin okunmaz oluyordu.
                        if line.speaker == Speaker::Assistant {
                            let blocks = markdown::parse(&line.text);
                            markdown::render(ui, &blocks, colour);
                        } else {
                            ui.add(
                                egui::Label::new(RichText::new(&line.text).color(colour)).wrap(),
                            );
                        }
                    });
                });
            });
    } else {
        ui.horizontal_top(|ui| {
            ui.add_space(6.0);
            ui.label(RichText::new(prefix).small().color(colour));
            ui.add_space(4.0);
            ui.add(egui::Label::new(RichText::new(&line.text).small().color(colour)).wrap());
        });
    }
}

/// Kısayol satırı — sağ panelde.
pub fn shortcut(ui: &mut Ui, keys: &str, action: &str) {
    ui.horizontal(|ui| {
        ui.label(RichText::new(keys).small().color(Theme::CYAN_DIM));
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(RichText::new(action).small().color(Theme::FG_FAINT));
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_names_pass_through_unchanged() {
        assert_eq!(short_model("gpt-4o"), "gpt-4o");
        assert_eq!(short_model("grok-3"), "grok-3");
        assert_eq!(short_model("deepseek-chat"), "deepseek-chat");
    }

    #[test]
    fn long_names_are_truncated_with_an_ellipsis() {
        let long = "llama-3.3-70b-versatile-preview-extended";
        let short = short_model(long);

        assert!(short.chars().count() <= 14);
        assert!(short.ends_with('…'));
    }

    #[test]
    fn truncation_does_not_panic_on_multibyte_names() {
        // Karakter yerine bayt kesilirse UTF-8 sınırında panik olur.
        let turkish = "çok-uzun-türkçe-model-adı-şğüöı-devam";
        let short = short_model(turkish);
        assert!(short.chars().count() <= 14);
    }

    #[test]
    fn exact_length_name_is_not_truncated() {
        let exact: String = "a".repeat(14);
        assert_eq!(short_model(&exact), exact);
    }
}
