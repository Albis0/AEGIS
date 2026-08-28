//! HUD teması — Iron Man tarzı görsel dil.
//!
//! # Tasarım kararları
//!
//! **Renkler tek yerde.** Widget'lar kendi rengini uydurmaz; hepsi buradan
//! gelir. Tema değiştirmek tek dosyayı düzenlemek demek.
//!
//! **Camgöbeği/mavi ana, turuncu vurgu.** Filmdeki HUD'un iki rengi bu.
//! Turuncu az kullanılır — çok kullanılırsa vurgu olmaktan çıkar.
//!
//! **Saf siyah yok.** `#05080d` neredeyse siyah ama tam değil; OLED'de bile
//! yüzey hissi kalır ve parlayan öğeler üstünde daha iyi durur.

use egui::{Color32, Rounding, Stroke};

pub struct Theme;

impl Theme {
    // ── Zemin ────────────────────────────────────────────────────────────
    /// Ana zemin — neredeyse siyah, hafif mavi tonlu.
    pub const BG: Color32 = Color32::from_rgb(0x05, 0x08, 0x0d);
    /// Panel zemini — zeminden bir tık açık.
    pub const BG_PANEL: Color32 = Color32::from_rgb(0x0a, 0x11, 0x1a);
    /// Kart zemini — mesaj balonları.
    pub const BG_CARD: Color32 = Color32::from_rgb(0x0d, 0x16, 0x21);
    /// Kod bloğu zemini.
    pub const BG_CODE: Color32 = Color32::from_rgb(0x08, 0x0e, 0x16);

    // ── Metin ────────────────────────────────────────────────────────────
    /// Ana metin — saf beyaz değil, camgöbeğine çalan.
    pub const FG: Color32 = Color32::from_rgb(0xc8, 0xe4, 0xf0);
    /// Sönük metin — zaman damgası, ipucu, ikincil bilgi.
    pub const FG_DIM: Color32 = Color32::from_rgb(0x5a, 0x7a, 0x8c);
    /// Çok sönük — arka plan detayları, ızgara çizgileri.
    pub const FG_FAINT: Color32 = Color32::from_rgb(0x1e, 0x33, 0x42);

    // ── Vurgu ────────────────────────────────────────────────────────────
    /// Ana HUD rengi — camgöbeği. Çekirdek, çerçeveler, kullanıcı satırı.
    pub const CYAN: Color32 = Color32::from_rgb(0x22, 0xd3, 0xee);
    /// Parlak camgöbeği — aktif durum, parıltı.
    pub const CYAN_BRIGHT: Color32 = Color32::from_rgb(0x67, 0xe8, 0xf9);
    /// Koyu camgöbeği — pasif çerçeveler.
    pub const CYAN_DIM: Color32 = Color32::from_rgb(0x0e, 0x74, 0x90);
    /// Turuncu vurgu — uyarı, dikkat, enerji. **Az kullanılır.**
    pub const AMBER: Color32 = Color32::from_rgb(0xf5, 0x9e, 0x0b);
    /// Asistan cevabı — mavi.
    pub const ASSISTANT: Color32 = Color32::from_rgb(0x60, 0xa5, 0xfa);
    /// Hata — kırmızı, ama HUD paletine uyumlu.
    pub const ERROR: Color32 = Color32::from_rgb(0xf8, 0x71, 0x71);
    /// Başarı / onay.
    pub const SUCCESS: Color32 = Color32::from_rgb(0x4a, 0xde, 0x80);

    // ── Çizgiler ─────────────────────────────────────────────────────────
    /// Panel kenarlığı.
    pub const BORDER: Color32 = Color32::from_rgb(0x14, 0x38, 0x4a);
    /// Aktif kenarlık — odaklanmış öğe.
    pub const BORDER_ACTIVE: Color32 = Color32::from_rgb(0x0e, 0x74, 0x90);

    // ── Ölçüler ──────────────────────────────────────────────────────────
    /// Panel iç boşluğu.
    pub const PAD: f32 = 12.0;
    /// Kart köşe yuvarlaklığı — HUD keskin ama tamamen köşeli değil.
    pub const RADIUS: f32 = 4.0;

    /// Bir rengin şeffaf halini verir.
    ///
    /// `Color32::gamma_multiply` parlaklığı düşürür, alfa'yı değil.
    /// Parıltı efektleri için alfa lazım.
    pub const fn alpha(color: Color32, a: u8) -> Color32 {
        Color32::from_rgba_premultiplied(
            (color.r() as u16 * a as u16 / 255) as u8,
            (color.g() as u16 * a as u16 / 255) as u8,
            (color.b() as u16 * a as u16 / 255) as u8,
            a,
        )
    }

    /// Temayı egui bağlamına uygular.
    pub fn apply(ctx: &egui::Context, font_size: f32) {
        let mut style = (*ctx.style()).clone();

        // HUD hissi için eşit genişlikli yazı; okunabilirlik için gövde
        // metni biraz büyük.
        use egui::{FontFamily::Monospace, FontId, TextStyle};
        style.text_styles = [
            (TextStyle::Heading, FontId::new(font_size + 6.0, Monospace)),
            (TextStyle::Body, FontId::new(font_size, Monospace)),
            (
                TextStyle::Monospace,
                FontId::new(font_size - 1.0, Monospace),
            ),
            (TextStyle::Button, FontId::new(font_size, Monospace)),
            (TextStyle::Small, FontId::new(font_size - 3.0, Monospace)),
        ]
        .into();

        let v = &mut style.visuals;
        v.dark_mode = true;
        v.panel_fill = Self::BG;
        v.window_fill = Self::BG_PANEL;
        v.extreme_bg_color = Self::BG_CODE;
        v.faint_bg_color = Self::BG_CARD;
        v.override_text_color = Some(Self::FG);

        // Pencere ve panel kenarlıkları.
        v.window_stroke = Stroke::new(1.0_f32, Self::BORDER);
        v.window_rounding = Rounding::same(Self::RADIUS);

        let radius = Rounding::same(Self::RADIUS);
        v.widgets.noninteractive.rounding = radius;
        v.widgets.inactive.rounding = radius;
        v.widgets.hovered.rounding = radius;
        v.widgets.active.rounding = radius;

        // Etkileşimli öğeler: üstüne gelince camgöbeği parlar.
        v.widgets.noninteractive.bg_stroke = Stroke::new(1.0_f32, Self::BORDER);
        v.widgets.noninteractive.fg_stroke = Stroke::new(1.0_f32, Self::FG);

        v.widgets.inactive.bg_fill = Self::BG_CARD;
        v.widgets.inactive.weak_bg_fill = Self::BG_CARD;
        v.widgets.inactive.bg_stroke = Stroke::new(1.0_f32, Self::BORDER);
        v.widgets.inactive.fg_stroke = Stroke::new(1.0_f32, Self::FG_DIM);

        v.widgets.hovered.bg_fill = Self::alpha(Self::CYAN, 30);
        v.widgets.hovered.weak_bg_fill = Self::alpha(Self::CYAN, 30);
        v.widgets.hovered.bg_stroke = Stroke::new(1.0_f32, Self::CYAN_DIM);
        v.widgets.hovered.fg_stroke = Stroke::new(1.0_f32, Self::CYAN_BRIGHT);

        v.widgets.active.bg_fill = Self::alpha(Self::CYAN, 50);
        v.widgets.active.weak_bg_fill = Self::alpha(Self::CYAN, 50);
        v.widgets.active.bg_stroke = Stroke::new(1.0_f32, Self::CYAN);
        v.widgets.active.fg_stroke = Stroke::new(1.0_f32, Self::CYAN_BRIGHT);

        v.selection.bg_fill = Self::alpha(Self::CYAN, 60);
        v.selection.stroke = Stroke::new(1.0_f32, Self::CYAN_BRIGHT);

        // Kaydırma çubuğu ince ve sönük — HUD'da göze batmamalı.
        style.spacing.scroll = egui::style::ScrollStyle {
            bar_width: 6.0,
            handle_min_length: 24.0,
            ..egui::style::ScrollStyle::solid()
        };

        style.spacing.item_spacing = egui::vec2(8.0, 6.0);
        style.spacing.button_padding = egui::vec2(10.0, 5.0);
        style.spacing.window_margin = egui::Margin::same(Self::PAD);

        ctx.set_style(style);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alpha_produces_transparent_colour() {
        let solid = Theme::CYAN;
        let faded = Theme::alpha(solid, 128);

        assert_eq!(faded.a(), 128, "alfa uygulanmalı");
        assert!(
            faded.r() < solid.r() || solid.r() == 0,
            "önceden çarpılmış renk kanalları da azalmalı"
        );
    }

    #[test]
    fn alpha_zero_is_fully_transparent() {
        let clear = Theme::alpha(Theme::CYAN, 0);
        assert_eq!(clear.a(), 0);
    }

    #[test]
    fn alpha_full_preserves_the_colour() {
        let same = Theme::alpha(Theme::CYAN, 255);
        assert_eq!(same.r(), Theme::CYAN.r());
        assert_eq!(same.g(), Theme::CYAN.g());
        assert_eq!(same.b(), Theme::CYAN.b());
    }

    #[test]
    fn background_is_not_pure_black() {
        // Saf siyahta parlayan öğelerin kenarı sert görünür.
        let bg = Theme::BG;
        assert!(
            bg.r() > 0 || bg.g() > 0 || bg.b() > 0,
            "zemin tamamen siyah olmamalı"
        );
    }

    #[test]
    fn text_has_enough_contrast_against_background() {
        // Kaba parlaklık farkı — okunabilirlik için yeterli olmalı.
        fn luma(c: Color32) -> f32 {
            0.299 * c.r() as f32 + 0.587 * c.g() as f32 + 0.114 * c.b() as f32
        }

        let contrast = luma(Theme::FG) - luma(Theme::BG);
        assert!(contrast > 150.0, "metin/zemin kontrastı düşük: {contrast}");
    }

    #[test]
    fn dim_text_is_dimmer_than_normal_text() {
        fn luma(c: Color32) -> f32 {
            0.299 * c.r() as f32 + 0.587 * c.g() as f32 + 0.114 * c.b() as f32
        }
        assert!(luma(Theme::FG_DIM) < luma(Theme::FG));
        assert!(luma(Theme::FG_FAINT) < luma(Theme::FG_DIM));
    }

    #[test]
    fn accent_colours_are_distinct() {
        // Aynı görünen iki vurgu rengi anlamsız olur.
        let accents = [
            Theme::CYAN,
            Theme::AMBER,
            Theme::ASSISTANT,
            Theme::ERROR,
            Theme::SUCCESS,
        ];
        for (i, a) in accents.iter().enumerate() {
            for b in accents.iter().skip(i + 1) {
                let diff = (a.r() as i32 - b.r() as i32).abs()
                    + (a.g() as i32 - b.g() as i32).abs()
                    + (a.b() as i32 - b.b() as i32).abs();
                assert!(diff > 60, "iki vurgu rengi çok benzer: {a:?} / {b:?}");
            }
        }
    }
}
