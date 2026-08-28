//! `VavisUi`'nin çizim tarafı.
//!
//! `app.rs` durumu tutar ve olayları işler; buradaki `impl` bloğu ekranı
//! çizer. Ayrı dosyada olmasının sebebi: `app.rs` 900 satırı geçmişti ve
//! mantık ile görünüm iç içe geçiyordu.

use crate::app::VavisUi;
use crate::core_visual::{self, CoreState};
use crate::hud;
use crate::theme::Theme;
use egui::RichText;
use vavis_core::{t, Key, VERSION};
use vavis_tools::{Approval, ApprovalReason};

impl VavisUi {
    /// Asistanın o anki durumu — çekirdek bunu gösterir.
    ///
    /// Sıra önemli: konuşma en görünür durum, boşta en az.
    pub(crate) fn core_state(&self) -> CoreState {
        if self.voice.is_speaking() {
            CoreState::Speaking
        } else if self.running_tool.is_some() {
            CoreState::Working
        } else if self.bridge.is_busy() {
            CoreState::Thinking
        } else if self.voice.mode().is_listening() {
            CoreState::Listening
        } else {
            CoreState::Idle
        }
    }

    /// Onay diyaloğu — yıkıcı işlem öncesi.
    ///
    /// Diyalog açıkken ajan iş parçacığı bekliyor; arayüz donmuyor çünkü
    /// bekleyen o thread, bu değil.
    pub(crate) fn draw_approval(&mut self, ctx: &egui::Context) {
        let Some(pending) = self.pending_approval.clone() else {
            return;
        };
        let lang = self.lang();
        let mut decision: Option<Approval> = None;

        egui::Window::new(t(lang, Key::ApprovalNeeded))
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .frame(
                egui::Frame::window(&ctx.style())
                    .fill(Theme::BG_PANEL)
                    // Turuncu kenarlık: bu pencere dikkat ister.
                    .stroke(egui::Stroke::new(1.5_f32, Theme::AMBER)),
            )
            .show(ctx, |ui| {
                ui.set_max_width(460.0);

                ui.horizontal(|ui| {
                    ui.label(RichText::new("⚠").size(20.0).color(Theme::AMBER));
                    ui.label(
                        RichText::new(&pending.tool)
                            .size(16.0)
                            .strong()
                            .color(Theme::AMBER),
                    );
                });
                ui.add_space(6.0);

                let why = match pending.reason {
                    ApprovalReason::RiskLevel => t(lang, Key::ApprovalIrreversible),
                    ApprovalReason::BudgetExceeded => t(lang, Key::ApprovalBudget),
                };
                ui.label(RichText::new(why).color(Theme::FG_DIM));
                ui.add_space(8.0);

                // Argümanlar görünür olmalı — kullanıcı neye izin verdiğini bilmeli.
                egui::Frame::none()
                    .fill(Theme::BG_CODE)
                    .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
                    .rounding(Theme::RADIUS)
                    .inner_margin(8.0)
                    .show(ui, |ui| {
                        let args: String = pending.args.chars().take(400).collect();
                        ui.label(RichText::new(args).monospace().color(Theme::FG));
                    });
                ui.add_space(12.0);

                ui.horizontal(|ui| {
                    if ui.button(t(lang, Key::Allow)).clicked() {
                        decision = Some(Approval::Allow);
                    }
                    if ui.button(t(lang, Key::AllowAlways)).clicked() {
                        decision = Some(Approval::AllowAlways);
                    }
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui
                            .button(RichText::new(t(lang, Key::Deny)).color(Theme::ERROR))
                            .clicked()
                        {
                            decision = Some(Approval::Deny);
                        }
                    });
                });
            });

        if let Some(approval) = decision {
            self.bridge.send_approval(approval);
            self.pending_approval = None;
            if approval != Approval::Deny {
                self.ran_tool_this_turn = true;
            }
        }
    }

    /// Sohbet akışı.
    pub(crate) fn draw_feed(&mut self, ui: &mut egui::Ui) {
        let stick = self.feed.take_dirty();

        egui::ScrollArea::vertical()
            .auto_shrink([false, false])
            .stick_to_bottom(stick)
            .show(ui, |ui| {
                ui.add_space(8.0);
                for line in self.feed.iter() {
                    hud::draw_message(ui, line);
                }
                ui.add_space(8.0);
            });
    }

    /// Giriş satırı.
    pub(crate) fn draw_input(&mut self, ui: &mut egui::Ui, ctx: &egui::Context) {
        let busy = self.bridge.is_busy();
        let lang = self.lang();
        let state = self.core_state();

        ui.add_space(6.0);
        ui.horizontal(|ui| {
            ui.add_space(4.0);

            // Gösterge çekirdekle aynı rengi kullanır — durum iki yerde
            // birden görünür, kullanıcı ilişkiyi kurar.
            let (symbol, colour) = match state {
                CoreState::Speaking => ("♪", Theme::ASSISTANT),
                CoreState::Thinking => ("◈", Theme::AMBER),
                CoreState::Working => ("⚙", Theme::CYAN),
                CoreState::Listening => ("◉", Theme::CYAN_BRIGHT),
                CoreState::Idle => ("❯", Theme::CYAN),
            };
            ui.label(RichText::new(symbol).size(16.0).color(colour));
            ui.add_space(2.0);

            let hint = if busy {
                t(lang, Key::WaitingReply)
            } else {
                t(lang, Key::TypeSomething)
            };

            let response = ui.add_sized(
                [ui.available_width() - 8.0, 26.0],
                egui::TextEdit::singleline(&mut self.input)
                    .frame(false)
                    .hint_text(RichText::new(hint).color(Theme::FG_FAINT))
                    .text_color(Theme::FG),
            );

            if self.focus_input {
                response.request_focus();
                self.focus_input = false;
            }

            if response.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                self.submit(ctx);
            }
        });
        ui.add_space(6.0);
    }

    /// Sol panel — canlı telemetri ve oturum bilgisi.
    pub(crate) fn draw_telemetry(&mut self, ui: &mut egui::Ui) {
        let lang = self.lang();

        ui.add_space(8.0);
        hud::panel_title(ui, "SYSTEM");

        // Ölçüm saniyede bir yenilenir — her karede ölçmek CPU yakar.
        if self.telemetry_age.elapsed().as_secs() >= 1 {
            self.cpu = vavis_tools::builtin::system::cpu_percent();
            self.battery = vavis_tools::builtin::system::battery_percent();
            self.telemetry_age = std::time::Instant::now();
        }

        if let Some(cpu) = self.cpu {
            hud::meter(
                ui,
                "CPU",
                cpu as f32 / 100.0,
                &format!("{cpu}%"),
                Theme::CYAN,
            );
        }
        if let Some(battery) = self.battery {
            // Düşük pil turuncuya döner — dikkat çekmeli.
            let colour = if battery < 20 {
                Theme::AMBER
            } else {
                Theme::CYAN
            };
            hud::meter(
                ui,
                "PWR",
                battery as f32 / 100.0,
                &format!("{battery}%"),
                colour,
            );
        }

        ui.add_space(12.0);
        hud::panel_title(ui, "SESSION");

        hud::stat(
            ui,
            t(lang, Key::HealthProvider),
            &self.provider().to_string(),
        );
        hud::stat(
            ui,
            t(lang, Key::HealthModel),
            &hud::short_model(&self.model()),
        );
        hud::stat(
            ui,
            t(lang, Key::HealthTools),
            &self.bridge.tool_count().to_string(),
        );
        hud::stat(
            ui,
            t(lang, Key::HealthHistory),
            &self.history.len().to_string(),
        );

        let (facts, automations) = {
            let guard = self.store.lock().unwrap_or_else(|e| e.into_inner());
            (
                guard.fact_count().unwrap_or(0),
                guard.all_automations().map(|a| a.len()).unwrap_or(0),
            )
        };
        hud::stat(ui, t(lang, Key::HealthMemory), &facts.to_string());
        hud::stat(
            ui,
            t(lang, Key::HealthAutomations),
            &automations.to_string(),
        );

        ui.add_space(12.0);
        hud::panel_title(ui, "VOICE");
        let voice = match self.voice.mode() {
            vavis_audio::VoiceMode::Off => t(lang, Key::VoiceOff),
            vavis_audio::VoiceMode::Continuous => t(lang, Key::VoiceContinuous),
            vavis_audio::VoiceMode::WakeWord => t(lang, Key::VoiceWakeWord),
        };
        ui.label(RichText::new(voice).small().color(Theme::FG_DIM));
    }

    /// Sağ panel — çekirdek, kısayollar, çalışan tool.
    pub(crate) fn draw_core_panel(&mut self, ui: &mut egui::Ui) {
        let state = self.core_state();

        ui.add_space(16.0);

        // Çekirdek panel genişliğine göre ölçeklenir.
        let size = (ui.available_width() - 24.0).clamp(80.0, 180.0);
        let (rect, _) =
            ui.allocate_exact_size(egui::vec2(ui.available_width(), size), egui::Sense::hover());
        let core_rect = egui::Rect::from_center_size(rect.center(), egui::vec2(size, size));

        core_visual::draw_core(ui, core_rect, state, self.elapsed(), self.audio_level);

        ui.add_space(4.0);
        ui.vertical_centered(|ui| {
            ui.label(
                RichText::new(state.label())
                    .small()
                    .color(Theme::alpha(Theme::CYAN, 200)),
            );
        });

        ui.add_space(16.0);
        hud::panel_title(ui, "KEYS");
        hud::shortcut(ui, "ESC", "stop speech");
        hud::shortcut(ui, "Ctrl+M", "voice mode");
        hud::shortcut(ui, "Ctrl+L", "clear");
        hud::shortcut(ui, "F1", "status");
        hud::shortcut(ui, "F11", "window mode");

        // Çalışan tool — "ne oluyor" sorusunun anlık cevabı.
        if let Some(tool) = self.running_tool.clone() {
            ui.add_space(12.0);
            hud::panel_title(ui, "RUNNING");
            ui.label(RichText::new(tool).small().color(Theme::AMBER));
        }
    }

    /// Sağlık penceresi (F1).
    pub(crate) fn draw_health(&mut self, ctx: &egui::Context) {
        let mut open = self.show_health;
        let lang = self.lang();

        egui::Window::new(t(lang, Key::HealthTitle))
            .open(&mut open)
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                let messages = self
                    .store
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .message_count()
                    .unwrap_or(0);

                let keys = self.keys.configured().join(", ");
                let rows: [(&str, String); 6] = [
                    (t(lang, Key::HealthVersion), VERSION.to_string()),
                    (
                        t(lang, Key::HealthKeys),
                        if keys.is_empty() {
                            t(lang, Key::HealthNone).to_string()
                        } else {
                            keys
                        },
                    ),
                    (t(lang, Key::HealthHistory), messages.to_string()),
                    (
                        t(lang, Key::HealthVoice),
                        self.voice.mode().label().to_string(),
                    ),
                    ("window", self.core.config.ui.window_mode.clone()),
                    (
                        t(lang, Key::HealthDataDir),
                        self.core.paths.root().display().to_string(),
                    ),
                ];

                egui::Grid::new("health")
                    .num_columns(2)
                    .spacing([16.0, 6.0])
                    .show(ui, |ui| {
                        for (key, value) in rows {
                            ui.label(RichText::new(key).color(Theme::FG_DIM));
                            ui.label(RichText::new(value).color(Theme::FG));
                            ui.end_row();
                        }
                    });
            });

        self.show_health = open;
    }
}

impl eframe::App for VavisUi {
    /// Zemin rengi — HUD'un temel katmanı.
    fn clear_color(&self, _visuals: &egui::Visuals) -> [f32; 4] {
        let c = Theme::BG;
        [
            c.r() as f32 / 255.0,
            c.g() as f32 / 255.0,
            c.b() as f32 / 255.0,
            1.0,
        ]
    }

    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.pump_events(ctx);
        self.pump_voice(ctx);
        self.pump_ticker(ctx);
        self.handle_shortcuts(ctx);

        let state = self.core_state();
        // Animasyon kare hızından bağımsız aksın; boştayken daha seyrek çiz.
        ctx.request_repaint_after(std::time::Duration::from_millis(
            state.repaint_interval_ms(),
        ));

        // Arka plan: ızgara ve köşe süsleri — panellerin altında kalır.
        let screen = ctx.screen_rect();
        let background = ctx.layer_painter(egui::LayerId::background());
        core_visual::draw_grid(&background, screen, self.elapsed());
        core_visual::draw_corners(&background, screen);

        // Pencereler panellerin üstünde çizilmeli.
        self.draw_health(ctx);
        self.draw_approval(ctx);

        let panel_frame = |margin_x: f32| {
            egui::Frame::none()
                .fill(Theme::alpha(Theme::BG_PANEL, 225))
                .inner_margin(egui::Margin::symmetric(margin_x, 4.0))
        };

        egui::SidePanel::left("telemetry")
            .exact_width(170.0)
            .resizable(false)
            .frame(panel_frame(10.0))
            .show(ctx, |ui| self.draw_telemetry(ui));

        egui::SidePanel::right("core")
            .exact_width(200.0)
            .resizable(false)
            .frame(panel_frame(10.0))
            .show(ctx, |ui| self.draw_core_panel(ui));

        egui::TopBottomPanel::bottom("input")
            .frame(
                egui::Frame::none()
                    .fill(Theme::alpha(Theme::BG_PANEL, 240))
                    .stroke(egui::Stroke::new(
                        1.0_f32,
                        Theme::alpha(Theme::CYAN_DIM, 110),
                    ))
                    .inner_margin(egui::Margin::symmetric(10.0, 2.0)),
            )
            .show(ctx, |ui| self.draw_input(ui, ctx));

        // Sohbet zemini şeffaf — arkadaki ızgara görünsün.
        egui::CentralPanel::default()
            .frame(
                egui::Frame::none()
                    .fill(egui::Color32::TRANSPARENT)
                    .inner_margin(egui::Margin::symmetric(16.0, 4.0)),
            )
            .show(ctx, |ui| self.draw_feed(ui));
    }
}
