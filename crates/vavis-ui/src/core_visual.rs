//! Enerji çekirdeği — HUD'un kalbi.
//!
//! Asistanın durumunu **tek bakışta** gösterir. Kullanıcı "ne oluyor
//! anlamıyorum" dediğinde asıl cevap bu: metin okumadan, çekirdeğin
//! davranışından durumu anlarsın.
//!
//! | Durum | Görünüm |
//! |---|---|
//! | Boşta | Yavaş dönen halkalar, sakin nabız |
//! | Dinliyor | Halkalar açılır, camgöbeği parlar, nabız hızlanır |
//! | Düşünüyor | Halkalar ters yöne hızlanır, turuncu kıvılcımlar |
//! | Konuşuyor | Dışa doğru dalgalar |
//! | Tool çalışıyor | İç halka kesikli döner |
//!
//! # Neden elle çiziliyor
//!
//! egui doğrudan GPU'ya çiziyor; bu animasyon her karede yeniden üretiliyor
//! ve durum tutmuyor (zaman dışında). Bir resim dosyası veya video yerine
//! saf matematik: her çözünürlükte keskin, dosya boyutu sıfır.

use crate::theme::Theme;
use egui::{Color32, Pos2, Rect, Stroke, Ui, Vec2};

/// Asistanın o anki durumu.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum CoreState {
    /// Bekliyor.
    #[default]
    Idle,
    /// Mikrofon açık, kullanıcıyı dinliyor.
    Listening,
    /// Modelden cevap bekleniyor.
    Thinking,
    /// Sesli cevap veriliyor.
    Speaking,
    /// Bir tool çalışıyor.
    Working,
}

impl CoreState {
    /// Bu durumda çekirdeğin ana rengi.
    fn colour(self) -> Color32 {
        match self {
            Self::Idle => Theme::CYAN_DIM,
            Self::Listening => Theme::CYAN_BRIGHT,
            Self::Thinking => Theme::AMBER,
            Self::Speaking => Theme::ASSISTANT,
            Self::Working => Theme::CYAN,
        }
    }

    /// Halkaların dönme hızı (radyan/saniye). Negatif = ters yön.
    fn spin_speed(self) -> f32 {
        match self {
            Self::Idle => 0.15,
            Self::Listening => 0.5,
            Self::Thinking => -1.2,
            Self::Speaking => 0.8,
            Self::Working => 2.0,
        }
    }

    /// Nabız hızı (döngü/saniye).
    fn pulse_speed(self) -> f32 {
        match self {
            Self::Idle => 0.4,
            Self::Listening => 1.5,
            Self::Thinking => 2.5,
            Self::Speaking => 3.0,
            Self::Working => 1.8,
        }
    }

    /// Durum etiketi — çekirdeğin altında yazar.
    pub fn label(self) -> &'static str {
        match self {
            Self::Idle => "IDLE",
            Self::Listening => "LISTENING",
            Self::Thinking => "THINKING",
            Self::Speaking => "SPEAKING",
            Self::Working => "WORKING",
        }
    }

    /// Bu durum sürekli yeniden çizim gerektiriyor mu?
    ///
    /// Boştayken bile hafif hareket var, ama daha düşük kare hızı yeter —
    /// pil ve CPU boşa gitmesin.
    pub fn repaint_interval_ms(self) -> u64 {
        match self {
            Self::Idle => 50, // ~20 fps, sakin nefes
            _ => 16,          // ~60 fps, canlı
        }
    }
}

/// Çekirdeği çizer.
///
/// `time`: uygulama açıldığından beri geçen saniye. Animasyon buna bağlı,
/// kare sayısına değil — kare hızı düşse de animasyon aynı hızda akar.
///
/// `audio_level`: 0.0-1.0 arası mikrofon/konuşma şiddeti. Dinlerken ve
/// konuşurken çekirdeği besler; yoksa 0 geçilir.
pub fn draw_core(ui: &mut Ui, rect: Rect, state: CoreState, time: f32, audio_level: f32) {
    let painter = ui.painter_at(rect);
    let center = rect.center();
    // Kısa kenara göre ölçekle — pencere oranı ne olursa olsun daire kalsın.
    let radius = rect.width().min(rect.height()) * 0.5;

    let colour = state.colour();
    let spin = time * state.spin_speed();
    let pulse = (time * state.pulse_speed() * std::f32::consts::TAU).sin() * 0.5 + 0.5;

    // Ses seviyesi nabza eklenir — konuşurken çekirdek sesle birlikte atar.
    let energy = (pulse + audio_level * 0.6).clamp(0.0, 1.4);

    // ── Dış parıltı ──────────────────────────────────────────────────────
    // Birkaç iç içe daire ile yumuşak hale; egui'de gerçek gölge yok.
    for i in 0..6 {
        let t = i as f32 / 6.0;
        let r = radius * (0.85 + t * 0.5);
        let a = ((1.0 - t) * 28.0 * (0.6 + energy * 0.4)) as u8;
        painter.circle_filled(center, r, Theme::alpha(colour, a));
    }

    // ── Dış halka: kesikli, yavaş döner ──────────────────────────────────
    draw_dashed_ring(
        &painter,
        center,
        Ring {
            radius: radius * 0.92,
            rotation: spin * 0.4,
            segments: 24,
            fill: 0.6,
            colour,
            alpha: 90,
        },
    );

    // ── Orta halka: ters yön, daha az parça ──────────────────────────────
    draw_dashed_ring(
        &painter,
        center,
        Ring {
            radius: radius * 0.74,
            rotation: -spin * 0.7,
            segments: 12,
            fill: 0.45,
            colour,
            alpha: 140,
        },
    );

    // ── İç halka: sürekli çizgi, nabızla kalınlaşır ──────────────────────
    painter.circle_stroke(
        center,
        radius * 0.55,
        Stroke::new(1.0 + energy * 1.5, Theme::alpha(colour, 200)),
    );

    // ── Çekirdek: dolu daire, enerjiyle büyür ────────────────────────────
    let core_radius = radius * (0.22 + energy * 0.06);
    painter.circle_filled(center, core_radius, Theme::alpha(colour, 230));
    // İçteki en parlak nokta.
    painter.circle_filled(
        center,
        core_radius * 0.5,
        Theme::alpha(Theme::CYAN_BRIGHT, (180.0 + energy * 60.0).min(255.0) as u8),
    );

    // ── Işınlar: çekirdekten dışa, dönen ─────────────────────────────────
    draw_rays(&painter, center, radius, spin, colour, energy);

    // ── Düşünürken kıvılcımlar ───────────────────────────────────────────
    if state == CoreState::Thinking {
        draw_sparks(&painter, center, radius, time, Theme::AMBER);
    }

    // ── Konuşurken dışa dalga ────────────────────────────────────────────
    if state == CoreState::Speaking {
        draw_waves(&painter, center, radius, time, colour);
    }
}

/// Kesikli halkanın biçimi.
///
/// Parametreleri tek yapıda topluyoruz — sekiz ayrı argüman hem okunmaz
/// hem de sıralarını karıştırmak kolay (ikisi de `f32`).
struct Ring {
    radius: f32,
    rotation: f32,
    /// Kaç parçaya bölünecek.
    segments: usize,
    /// Her parçanın dolu oranı (0-1).
    fill: f32,
    colour: Color32,
    alpha: u8,
}

/// Kesikli halka çizer.
fn draw_dashed_ring(painter: &egui::Painter, center: Pos2, ring: Ring) {
    use std::f32::consts::TAU;

    let Ring {
        radius,
        rotation,
        segments,
        fill,
        colour,
        alpha,
    } = ring;

    let step = TAU / segments as f32;
    let arc = step * fill;

    for i in 0..segments {
        let start = rotation + i as f32 * step;
        // Her yayı kısa doğru parçalarıyla çiziyoruz — egui'de yay ilkeli yok.
        let points: Vec<Pos2> = (0..=6)
            .map(|j| {
                let angle = start + arc * (j as f32 / 6.0);
                center + Vec2::new(angle.cos(), angle.sin()) * radius
            })
            .collect();

        painter.add(egui::Shape::line(
            points,
            Stroke::new(1.5_f32, Theme::alpha(colour, alpha)),
        ));
    }
}

/// Çekirdekten dışa uzanan ışınlar.
fn draw_rays(
    painter: &egui::Painter,
    center: Pos2,
    radius: f32,
    rotation: f32,
    colour: Color32,
    energy: f32,
) {
    use std::f32::consts::TAU;

    const COUNT: usize = 8;
    for i in 0..COUNT {
        let angle = rotation * 0.3 + (i as f32 / COUNT as f32) * TAU;
        let dir = Vec2::new(angle.cos(), angle.sin());

        // Işınların boyu enerjiyle ve sıra numarasıyla değişir — hepsi
        // aynı uzunlukta olsa mekanik görünür.
        let variation = ((i as f32 * 1.7).sin() * 0.5 + 0.5) * 0.15;
        let inner = radius * 0.3;
        let outer = radius * (0.45 + variation + energy * 0.1);

        painter.line_segment(
            [center + dir * inner, center + dir * outer],
            Stroke::new(1.0_f32, Theme::alpha(colour, 120)),
        );
    }
}

/// Düşünürken çekirdeğin çevresinde dolanan kıvılcımlar.
fn draw_sparks(painter: &egui::Painter, center: Pos2, radius: f32, time: f32, colour: Color32) {
    use std::f32::consts::TAU;

    const COUNT: usize = 5;
    for i in 0..COUNT {
        // Her kıvılcım farklı hızda ve yarıçapta — düzensizlik canlılık verir.
        let speed = 1.5 + (i as f32 * 0.37).fract() * 2.0;
        let angle = time * speed + (i as f32 / COUNT as f32) * TAU;
        let orbit = radius * (0.6 + (time * 0.7 + i as f32).sin() * 0.15);

        let pos = center + Vec2::new(angle.cos(), angle.sin()) * orbit;
        let size = 1.5 + (time * 4.0 + i as f32).sin().abs() * 1.5;

        painter.circle_filled(pos, size, Theme::alpha(colour, 200));
    }
}

/// Konuşurken dışa doğru genişleyen dalgalar.
fn draw_waves(painter: &egui::Painter, center: Pos2, radius: f32, time: f32, colour: Color32) {
    const COUNT: usize = 3;
    for i in 0..COUNT {
        // Dalgalar sırayla doğar; her biri büyüyüp sönerek kaybolur.
        let phase = (time * 1.2 + i as f32 / COUNT as f32).fract();
        let r = radius * (0.55 + phase * 0.6);
        let alpha = ((1.0 - phase) * 90.0) as u8;

        painter.circle_stroke(center, r, Stroke::new(1.5_f32, Theme::alpha(colour, alpha)));
    }
}

/// Arka plan ızgarası — HUD'un "teknik" hissini veren ince çizgiler.
///
/// Çok sönük çizilir; fark edilmesi değil, boşluğun boş hissettirmemesi için.
pub fn draw_grid(painter: &egui::Painter, rect: Rect, time: f32) {
    const SPACING: f32 = 48.0;

    // Izgara çok yavaş kayar — sabit dursa ölü, hızlı kaysa rahatsız edici.
    let drift = (time * 3.0) % SPACING;

    let colour = Theme::alpha(Theme::FG_FAINT, 40);
    let stroke = Stroke::new(0.5_f32, colour);

    let mut x = rect.left() - drift;
    while x < rect.right() {
        painter.line_segment(
            [Pos2::new(x, rect.top()), Pos2::new(x, rect.bottom())],
            stroke,
        );
        x += SPACING;
    }

    let mut y = rect.top() - drift;
    while y < rect.bottom() {
        painter.line_segment(
            [Pos2::new(rect.left(), y), Pos2::new(rect.right(), y)],
            stroke,
        );
        y += SPACING;
    }
}

/// Köşe süsleri — HUD çerçevesi hissi.
///
/// Dört köşeye kısa açılı çizgiler; ekranın "bir cihaz ekranı" olduğunu
/// ima eder.
pub fn draw_corners(painter: &egui::Painter, rect: Rect) {
    const LEN: f32 = 24.0;
    let stroke = Stroke::new(1.5_f32, Theme::alpha(Theme::CYAN_DIM, 160));
    let m = 8.0; // kenardan boşluk

    let (l, r, t, b) = (
        rect.left() + m,
        rect.right() - m,
        rect.top() + m,
        rect.bottom() - m,
    );

    // Sol üst
    painter.line_segment([Pos2::new(l, t + LEN), Pos2::new(l, t)], stroke);
    painter.line_segment([Pos2::new(l, t), Pos2::new(l + LEN, t)], stroke);
    // Sağ üst
    painter.line_segment([Pos2::new(r - LEN, t), Pos2::new(r, t)], stroke);
    painter.line_segment([Pos2::new(r, t), Pos2::new(r, t + LEN)], stroke);
    // Sol alt
    painter.line_segment([Pos2::new(l, b - LEN), Pos2::new(l, b)], stroke);
    painter.line_segment([Pos2::new(l, b), Pos2::new(l + LEN, b)], stroke);
    // Sağ alt
    painter.line_segment([Pos2::new(r - LEN, b), Pos2::new(r, b)], stroke);
    painter.line_segment([Pos2::new(r, b), Pos2::new(r, b - LEN)], stroke);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_state_has_a_distinct_label() {
        let states = [
            CoreState::Idle,
            CoreState::Listening,
            CoreState::Thinking,
            CoreState::Speaking,
            CoreState::Working,
        ];

        let mut labels: Vec<&str> = states.iter().map(|s| s.label()).collect();
        let before = labels.len();
        labels.sort_unstable();
        labels.dedup();

        assert_eq!(before, labels.len(), "iki durum aynı etiketi paylaşıyor");
        for label in labels {
            assert!(!label.is_empty());
        }
    }

    #[test]
    fn idle_repaints_less_often_than_active_states() {
        // Boştayken pil ve CPU boşa gitmemeli.
        let idle = CoreState::Idle.repaint_interval_ms();
        for state in [
            CoreState::Listening,
            CoreState::Thinking,
            CoreState::Speaking,
            CoreState::Working,
        ] {
            assert!(
                state.repaint_interval_ms() < idle,
                "{:?} boştan daha sık çizilmeli",
                state
            );
        }
    }

    #[test]
    fn thinking_spins_the_other_way() {
        // Ters yön "işliyor" hissini metin okumadan verir.
        assert!(CoreState::Thinking.spin_speed() < 0.0);
        assert!(CoreState::Idle.spin_speed() > 0.0);
    }

    #[test]
    fn active_states_spin_faster_than_idle() {
        let idle = CoreState::Idle.spin_speed().abs();
        for state in [
            CoreState::Listening,
            CoreState::Thinking,
            CoreState::Speaking,
            CoreState::Working,
        ] {
            assert!(
                state.spin_speed().abs() > idle,
                "{:?} boştan hızlı dönmeli",
                state
            );
        }
    }

    #[test]
    fn active_states_pulse_faster_than_idle() {
        let idle = CoreState::Idle.pulse_speed();
        for state in [
            CoreState::Listening,
            CoreState::Thinking,
            CoreState::Speaking,
            CoreState::Working,
        ] {
            assert!(state.pulse_speed() > idle);
        }
    }

    #[test]
    fn each_state_has_its_own_colour() {
        let states = [
            CoreState::Idle,
            CoreState::Listening,
            CoreState::Thinking,
            CoreState::Speaking,
        ];
        // Working, Listening ile aynı aileden olabilir; asıl ayrım
        // düşünme (turuncu) ile diğerleri arasında.
        assert_ne!(CoreState::Thinking.colour(), CoreState::Idle.colour());
        assert_ne!(CoreState::Speaking.colour(), CoreState::Thinking.colour());
        let _ = states;
    }

    #[test]
    fn default_state_is_idle() {
        assert_eq!(CoreState::default(), CoreState::Idle);
    }
}
