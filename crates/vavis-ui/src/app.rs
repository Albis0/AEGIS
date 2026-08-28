//! Ana pencere — terminal görünümü.
//!
//! F1 kapsamı: pencere açılır, feed görünür, giriş kutusu çalışır, sağlık
//! bilgisi gösterilir. **LLM bağlantısı F2'de** — şu an girilen metin yankılanır.
//!
//! Mimari not: bu tip `vavis_core::App`'i *kullanır*, ona hiçbir şey dayatmaz.

use crate::feed::{Feed, Speaker};
use crate::theme::Theme;
use eframe::egui;
use vavis_core::{App as CoreApp, VERSION};

pub struct VavisUi {
    core: CoreApp,
    feed: Feed,
    input: String,
    show_health: bool,
    /// Bir sonraki karede giriş kutusuna odaklan (Enter'dan sonra odak kaçmasın).
    focus_input: bool,
}

impl VavisUi {
    pub fn new(cc: &eframe::CreationContext<'_>, core: CoreApp) -> Self {
        Theme::apply(&cc.egui_ctx, core.config.ui.font_size);

        let mut feed = Feed::new(2000);
        feed.push(
            Speaker::System,
            format!("VAVIS v{VERSION} — hazır. Faz 1: çekirdek + arayüz."),
        );
        feed.push(
            Speaker::System,
            "LLM bağlantısı Faz 2'de gelecek. Şimdilik yazdığın yankılanır.",
        );
        feed.push(Speaker::System, "F1 yardım · Ctrl+L temizle · ESC çıkış");

        Self {
            core,
            feed,
            input: String::new(),
            show_health: false,
            focus_input: true,
        }
    }

    /// Girilen metni işler. F2'de burası LLM'e gidecek.
    fn submit(&mut self) {
        let text = self.input.trim().to_string();
        self.input.clear();
        self.focus_input = true;
        if text.is_empty() {
            return;
        }

        self.feed.push(Speaker::User, text.clone());

        // Yerleşik komutlar — LLM olmadan da bir şeyler çalışsın.
        match text.as_str() {
            "/help" | "/yardim" => {
                self.feed.push(Speaker::System, "/health  — sistem durumu");
                self.feed.push(Speaker::System, "/clear   — ekranı temizle");
                self.feed.push(Speaker::System, "/quit    — çık");
            }
            "/health" | "/durum" => self.show_health = true,
            "/clear" | "/temizle" => self.feed.clear(),
            _ => {
                self.feed
                    .push(Speaker::Assistant, format!("(yankı) {text}"));
            }
        }
    }

    fn draw_feed(&mut self, ui: &mut egui::Ui) {
        let scroll_to_bottom = self.feed.take_dirty();

        egui::ScrollArea::vertical()
            .auto_shrink([false, false])
            .stick_to_bottom(scroll_to_bottom)
            .show(ui, |ui| {
                ui.add_space(4.0);
                for line in self.feed.iter() {
                    let color = match line.speaker {
                        Speaker::User => Theme::ACCENT,
                        Speaker::Assistant => Theme::ASSISTANT,
                        Speaker::System => Theme::FG_DIM,
                        Speaker::Error => Theme::ERROR,
                    };

                    ui.horizontal_top(|ui| {
                        ui.spacing_mut().item_spacing.x = 6.0;
                        ui.colored_label(color, line.speaker.prefix());
                        // Uzun satırlar sarmalı, yatay kaydırma olmamalı.
                        ui.with_layout(
                            egui::Layout::top_down(egui::Align::LEFT),
                            |ui| {
                                ui.add(
                                    egui::Label::new(
                                        egui::RichText::new(&line.text).color(color),
                                    )
                                    .wrap(),
                                );
                            },
                        );
                    });
                }
                ui.add_space(4.0);
            });
    }

    fn draw_input(&mut self, ui: &mut egui::Ui) {
        ui.add_space(4.0);
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = 6.0;
            ui.colored_label(Theme::ACCENT, "❯");

            let response = ui.add_sized(
                [ui.available_width(), ui.spacing().interact_size.y],
                egui::TextEdit::singleline(&mut self.input)
                    .frame(false)
                    .hint_text("bir şeyler yaz…")
                    .text_color(Theme::FG),
            );

            if self.focus_input {
                response.request_focus();
                self.focus_input = false;
            }

            if response.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                self.submit();
            }
        });
        ui.add_space(4.0);
    }

    fn draw_health(&mut self, ctx: &egui::Context) {
        let mut open = self.show_health;
        egui::Window::new("sistem durumu")
            .open(&mut open)
            .collapsible(false)
            .resizable(false)
            .show(ctx, |ui| {
                let msg_count = self
                    .core
                    .store
                    .message_count()
                    .map(|n| n.to_string())
                    .unwrap_or_else(|e| format!("hata: {e}"));

                let rows: [(&str, String); 5] = [
                    ("sürüm", VERSION.to_string()),
                    ("veri dizini", self.core.paths.root().display().to_string()),
                    ("ayar", self.core.paths.config_file().display().to_string()),
                    ("veritabanı", format!("{msg_count} mesaj")),
                    ("pencere modu", self.core.config.ui.window_mode.clone()),
                ];

                egui::Grid::new("health_grid").num_columns(2).spacing([12.0, 4.0]).show(
                    ui,
                    |ui| {
                        for (k, v) in rows {
                            ui.colored_label(Theme::FG_DIM, k);
                            ui.colored_label(Theme::FG, v);
                            ui.end_row();
                        }
                    },
                );
            });
        self.show_health = open;
    }

    fn handle_shortcuts(&mut self, ctx: &egui::Context) {
        ctx.input(|i| {
            if i.key_pressed(egui::Key::F1) {
                self.show_health = !self.show_health;
            }
            if i.modifiers.ctrl && i.key_pressed(egui::Key::L) {
                self.feed.clear();
                self.focus_input = true;
            }
        });
    }
}

impl eframe::App for VavisUi {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.handle_shortcuts(ctx);
        self.draw_health(ctx);

        // Giriş kutusu altta sabit; feed kalan alanı doldurur.
        egui::TopBottomPanel::bottom("input_panel")
            .frame(
                egui::Frame::none()
                    .fill(Theme::BG_PANEL)
                    .inner_margin(egui::Margin::symmetric(10.0, 2.0)),
            )
            .show(ctx, |ui| self.draw_input(ui));

        egui::CentralPanel::default()
            .frame(
                egui::Frame::none()
                    .fill(Theme::BG)
                    .inner_margin(egui::Margin::symmetric(10.0, 4.0)),
            )
            .show(ctx, |ui| self.draw_feed(ui));
    }
}
