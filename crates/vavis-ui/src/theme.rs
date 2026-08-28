//! Terminal görünümü teması.
//!
//! Tek yer: renkler ve boşluklar burada tanımlı, widget'lar kendi rengini
//! uydurmaz. Sonra "güzel işler" yapılacağında değişecek tek dosya burası.

use egui::{Color32, Rounding, Stroke};

pub struct Theme;

impl Theme {
    // ── Renkler ──────────────────────────────────────────────────────────
    /// Ana zemin — saf siyah değil, göz yormasın diye çok koyu gri.
    pub const BG: Color32 = Color32::from_rgb(0x0d, 0x11, 0x17);
    /// Giriş kutusu / panel zemini.
    pub const BG_PANEL: Color32 = Color32::from_rgb(0x14, 0x1a, 0x23);
    /// Normal metin.
    pub const FG: Color32 = Color32::from_rgb(0xc9, 0xd1, 0xd9);
    /// Sönük metin (zaman damgası, ipucu).
    pub const FG_DIM: Color32 = Color32::from_rgb(0x6e, 0x7b, 0x8b);
    /// Vurgu — kullanıcı satırı, imleç.
    pub const ACCENT: Color32 = Color32::from_rgb(0x39, 0xd3, 0x53);
    /// Asistan cevabı.
    pub const ASSISTANT: Color32 = Color32::from_rgb(0x58, 0xa6, 0xff);
    /// Hata.
    pub const ERROR: Color32 = Color32::from_rgb(0xf8, 0x51, 0x49);
    /// Sistem/bilgi satırı.
    pub const SYSTEM: Color32 = Color32::from_rgb(0xd2, 0x99, 0x22);
    /// Ayraç çizgisi.
    pub const BORDER: Color32 = Color32::from_rgb(0x24, 0x2c, 0x38);

    /// Temayı egui bağlamına uygular.
    pub fn apply(ctx: &egui::Context, font_size: f32) {
        let mut style = (*ctx.style()).clone();

        // Terminal hissi: her yerde eşit genişlikli yazı tipi.
        use egui::{FontFamily::Monospace, FontId, TextStyle};
        style.text_styles = [
            (TextStyle::Heading, FontId::new(font_size + 4.0, Monospace)),
            (TextStyle::Body, FontId::new(font_size, Monospace)),
            (TextStyle::Monospace, FontId::new(font_size, Monospace)),
            (TextStyle::Button, FontId::new(font_size, Monospace)),
            (TextStyle::Small, FontId::new(font_size - 2.0, Monospace)),
        ]
        .into();

        let v = &mut style.visuals;
        v.dark_mode = true;
        v.panel_fill = Self::BG;
        v.window_fill = Self::BG;
        v.extreme_bg_color = Self::BG_PANEL;
        v.override_text_color = Some(Self::FG);

        // Köşeler keskin — terminal görünümü için yuvarlaklık yok.
        let sharp = Rounding::ZERO;
        v.widgets.noninteractive.rounding = sharp;
        v.widgets.inactive.rounding = sharp;
        v.widgets.hovered.rounding = sharp;
        v.widgets.active.rounding = sharp;

        v.widgets.noninteractive.bg_stroke = Stroke::new(1.0_f32, Self::BORDER);
        v.widgets.inactive.bg_fill = Self::BG_PANEL;
        v.widgets.hovered.bg_fill = Self::BG_PANEL;
        v.selection.bg_fill = Self::ACCENT.gamma_multiply(0.3);
        v.selection.stroke = Stroke::new(1.0_f32, Self::ACCENT);

        style.spacing.item_spacing = egui::vec2(6.0, 4.0);
        style.spacing.window_margin = egui::Margin::same(0.0);

        ctx.set_style(style);
    }
}
