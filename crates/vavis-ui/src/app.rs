//! Ana pencere — terminal görünümü.
//!
//! F2 kapsamı: gerçek LLM sohbeti, akan cevap, komutlarla ayar yönetimi.
//!
//! Mimari not: bu tip `vavis_core` ve `vavis_brain`'i *kullanır*, onlara hiçbir
//! şey dayatmaz. Arayüz tamamen değişse alt katmanlara dokunulmaz.

use crate::bridge::{Bridge, UiEvent};
use crate::commands::{self, Command};
use crate::feed::{Feed, Speaker};
use crate::theme::Theme;
use eframe::egui;
use vavis_brain::{system_prompt, ChatConfig, KeyStore, Message, Provider, Role};
use vavis_tools::{Agent, Approval, ApprovalReason};
use vavis_core::{App as CoreApp, VERSION};

pub struct VavisUi {
    core: CoreApp,
    keys: KeyStore,
    bridge: Bridge,

    feed: Feed,
    /// LLM'e gönderilen sohbet geçmişi (sistem mesajı hariç).
    history: Vec<Message>,

    input: String,
    show_health: bool,
    focus_input: bool,
    /// Cevap beklenirken gösterilecek animasyon karesi.
    spinner_frame: usize,
    /// Kullanıcı onayı bekleyen tool (varsa).
    pending_approval: Option<PendingApproval>,
    /// Bu turda tool çalıştı mı — boş cevabın normal olup olmadığını belirler.
    ran_tool_this_turn: bool,
}

#[derive(Clone)]
struct PendingApproval {
    tool: String,
    args: String,
    reason: ApprovalReason,
}

impl VavisUi {
    pub fn new(cc: &eframe::CreationContext<'_>, core: CoreApp) -> Self {
        Theme::apply(&cc.egui_ctx, core.config.ui.font_size);

        let keys = KeyStore::load(core.paths.root());
        let agent = Agent::new(vavis_tools::default_registry());
        let bridge = Bridge::new(agent).expect("tokio çalışma zamanı kurulamadı");

        let mut ui = Self {
            core,
            keys,
            bridge,
            feed: Feed::new(2000),
            history: Vec::new(),
            input: String::new(),
            show_health: false,
            focus_input: true,
            spinner_frame: 0,
            pending_approval: None,
            ran_tool_this_turn: false,
        };
        ui.greet();
        ui
    }

    fn greet(&mut self) {
        let name = &self.core.config.general.assistant_name;
        self.feed
            .push(Speaker::System, format!("{name} v{VERSION} — hazır."));

        let provider = self.provider();
        if provider.needs_key() && self.keys.get(provider.key_name()).is_none() {
            self.feed.push(
                Speaker::System,
                format!("{provider} için anahtar yok → /key {provider} <anahtar>"),
            );
            self.feed
                .push(Speaker::System, "Anahtarsız denemek için: /provider local");
        } else {
            self.feed.push(
                Speaker::System,
                format!("{provider} · {} · yazmaya başla", self.model()),
            );
        }
        self.feed.push(Speaker::System, "/help komutlar · F1 durum");
    }

    // ── Ayar erişimi ────────────────────────────────────────────────────────

    fn provider(&self) -> Provider {
        Provider::parse(&self.core.config.llm.provider).unwrap_or(Provider::Groq)
    }

    fn model(&self) -> String {
        let configured = self.core.config.llm.model.trim();
        if configured.is_empty() {
            self.provider().default_model().to_string()
        } else {
            configured.to_string()
        }
    }

    fn save_config(&mut self) {
        if let Err(err) = self.core.config.save(&self.core.paths) {
            tracing::error!(%err, "ayar kaydedilemedi");
            self.feed
                .push(Speaker::Error, format!("ayar kaydedilemedi: {err}"));
        }
    }

    // ── Girdi işleme ────────────────────────────────────────────────────────

    fn submit(&mut self, ctx: &egui::Context) {
        let text = self.input.trim().to_string();
        self.input.clear();
        self.focus_input = true;
        if text.is_empty() {
            return;
        }

        // Komutlar feed'e kullanıcı satırı olarak da yazılır — ne yaptığı görünsün.
        self.feed.push(Speaker::User, text.clone());

        match commands::parse(&text) {
            Command::Chat(msg) => self.start_chat(msg, ctx),
            Command::Help => {
                for line in commands::help_lines() {
                    self.feed.push(Speaker::System, line);
                }
            }
            Command::Health => self.show_health = true,
            Command::Clear => {
                self.feed.clear();
                self.history.clear();
                self.feed.push(Speaker::System, "geçmiş temizlendi");
            }
            Command::Quit => ctx.send_viewport_cmd(egui::ViewportCommand::Close),
            Command::SetKey { provider, key } => self.set_key(&provider, key),
            Command::ListKeys => self.list_keys(),
            Command::SetProvider(name) => self.set_provider(&name),
            Command::SetModel(name) => self.set_model(name),
            Command::ListModels => self.fetch_models(ctx),
            Command::Unknown(msg) => self.feed.push(Speaker::Error, msg),
        }
    }

    fn start_chat(&mut self, text: String, ctx: &egui::Context) {
        if self.bridge.is_busy() {
            self.feed
                .push(Speaker::Error, "önceki cevap sürüyor — bekle");
            return;
        }

        let provider = self.provider();
        if provider.needs_key() && self.keys.get(provider.key_name()).is_none() {
            self.feed.push(
                Speaker::Error,
                format!("{provider} için anahtar yok → /key {provider} <anahtar>"),
            );
            return;
        }

        self.history.push(Message::user(text.clone()));
        self.ran_tool_this_turn = false;

        let cfg = ChatConfig::new(
            provider,
            self.model(),
            self.keys.get(provider.key_name()).unwrap_or_default(),
        );

        // Sistem mesajı her istekte baştan üretilir — ayar değişirse anında yansır.
        let system = Message::system(system_prompt(
            &self.core.config.general.assistant_name,
            &self.core.config.general.language,
        ));

        self.bridge.send_chat(
            cfg,
            system,
            self.history.clone(),
            text,
            Some(ctx.clone()),
        );
    }

    fn set_key(&mut self, provider_name: &str, key: String) {
        let Some(provider) = Provider::parse(provider_name) else {
            self.feed.push(
                Speaker::Error,
                format!("bilinmeyen sağlayıcı: {provider_name}"),
            );
            return;
        };

        self.keys.set(provider.key_name(), key);
        match self.keys.save(self.core.paths.root()) {
            Ok(()) => self.feed.push(
                Speaker::System,
                format!("{provider} anahtarı kaydedildi (şifreli)"),
            ),
            Err(err) => self
                .feed
                .push(Speaker::Error, format!("anahtar kaydedilemedi: {err}")),
        }
    }

    fn list_keys(&mut self) {
        let configured: Vec<String> = self.keys.configured().iter().map(|s| s.to_string()).collect();
        if configured.is_empty() {
            self.feed.push(Speaker::System, "kayıtlı anahtar yok");
        } else {
            // Anahtarın kendisi ASLA gösterilmez — sadece hangi sağlayıcı.
            self.feed
                .push(Speaker::System, format!("anahtarı olanlar: {}", configured.join(", ")));
        }
    }

    fn set_provider(&mut self, name: &str) {
        let Some(provider) = Provider::parse(name) else {
            let all: Vec<&str> = Provider::ALL.iter().map(|p| p.key_name()).collect();
            self.feed.push(
                Speaker::Error,
                format!("bilinmeyen sağlayıcı. seçenekler: {}", all.join(" · ")),
            );
            return;
        };

        self.core.config.llm.provider = provider.key_name().to_string();
        // Model sağlayıcıya özgüdür — değişince varsayılana dön, 404 olmasın.
        self.core.config.llm.model = provider.default_model().to_string();
        self.save_config();

        self.feed.push(
            Speaker::System,
            format!("sağlayıcı: {provider} · model: {}", self.model()),
        );
        if provider.needs_key() && self.keys.get(provider.key_name()).is_none() {
            self.feed
                .push(Speaker::System, format!("anahtar gerek → /key {provider} <anahtar>"));
        }
    }

    fn set_model(&mut self, name: String) {
        self.core.config.llm.model = name;
        self.save_config();
        self.feed
            .push(Speaker::System, format!("model: {}", self.model()));
    }

    fn fetch_models(&mut self, ctx: &egui::Context) {
        let provider = self.provider();
        let key = self.keys.get(provider.key_name()).unwrap_or_default().to_string();
        self.feed
            .push(Speaker::System, format!("{provider} model listesi alınıyor…"));
        self.bridge.fetch_models(provider, key, Some(ctx.clone()));
    }

    // ── Beyin olaylarını işle ───────────────────────────────────────────────

    fn pump_events(&mut self) {
        for event in self.bridge.drain() {
            match event {
                UiEvent::Delta(text) => self.feed.push_delta(Speaker::Assistant, &text),

                UiEvent::ToolStart { tool } => {
                    self.feed.push(Speaker::Tool, format!("{tool}…"));
                }

                UiEvent::ToolDone { tool, ok, summary } => {
                    let mark = if ok { "✓" } else { "✗" };
                    // Çok satırlı çıktıyı tek satıra indir — feed dağılmasın.
                    let flat = summary.replace('\n', " · ");
                    self.feed
                        .push(Speaker::Tool, format!("{tool} {mark} {flat}"));
                }

                UiEvent::ApprovalNeeded { tool, args, reason } => {
                    self.pending_approval = Some(PendingApproval { tool, args, reason });
                }

                UiEvent::Complete(full) => {
                    if full.trim().is_empty() {
                        // Tool çalıştıysa boş metin normaldir (model sadece
                        // tool çağırıp susmuş olabilir) — hata gösterme.
                        if !self.ran_tool_this_turn {
                            self.feed.push(Speaker::Error, "model boş cevap döndü");
                        }
                        if self.history.last().map(|m| m.role) == Some(Role::User) {
                            self.history.pop();
                        }
                    } else {
                        self.history.push(Message::assistant(full));
                    }
                    self.ran_tool_this_turn = false;
                }

                UiEvent::Failed(msg) => {
                    self.feed.push(Speaker::Error, msg);
                    // Cevapsız kalan kullanıcı mesajını geçmişten çıkar — aksi hâlde
                    // sonraki istekte "user, user" ardışıklığı oluşur.
                    if self.history.last().map(|m| m.role) == Some(Role::User) {
                        self.history.pop();
                    }
                    self.pending_approval = None;
                    self.ran_tool_this_turn = false;
                }

                UiEvent::Models(models) => {
                    if models.is_empty() {
                        self.feed.push(Speaker::System, "model bulunamadı");
                    } else {
                        self.feed
                            .push(Speaker::System, format!("{} model:", models.len()));
                        for m in models.iter().take(40) {
                            self.feed.push(Speaker::System, format!("  {m}"));
                        }
                    }
                }
            }
        }
    }

    /// Onay diyaloğu — yıkıcı işlem öncesi.
    ///
    /// Diyalog açıkken ajan iş parçacığı bekliyor; UI donmuyor çünkü bekleyen
    /// o thread, bu değil.
    fn draw_approval(&mut self, ctx: &egui::Context) {
        let Some(pending) = self.pending_approval.clone() else {
            return;
        };

        let mut decision: Option<Approval> = None;

        egui::Window::new("onay gerekiyor")
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.colored_label(Theme::ERROR, format!("⚠ {}", pending.tool));
                ui.add_space(4.0);

                let why = match pending.reason {
                    ApprovalReason::RiskLevel => "Bu işlem geri alınamaz.",
                    ApprovalReason::BudgetExceeded => {
                        "Bu çalıştırmada çok sayıda yıkıcı işlem yapıldı."
                    }
                };
                ui.colored_label(Theme::FG_DIM, why);
                ui.add_space(6.0);

                // Argümanları göster — kullanıcı neye izin verdiğini bilmeli.
                let args: String = pending.args.chars().take(300).collect();
                ui.colored_label(Theme::FG, &args);
                ui.add_space(10.0);

                ui.horizontal(|ui| {
                    if ui.button("İzin ver").clicked() {
                        decision = Some(Approval::Allow);
                    }
                    if ui.button("Hep izin ver").clicked() {
                        decision = Some(Approval::AllowAlways);
                    }
                    if ui.button("Reddet").clicked() {
                        decision = Some(Approval::Deny);
                    }
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

    // ── Çizim ───────────────────────────────────────────────────────────────

    fn draw_feed(&mut self, ui: &mut egui::Ui) {
        let stick = self.feed.take_dirty();

        egui::ScrollArea::vertical()
            .auto_shrink([false, false])
            .stick_to_bottom(stick)
            .show(ui, |ui| {
                ui.add_space(4.0);
                for line in self.feed.iter() {
                    let color = match line.speaker {
                        Speaker::User => Theme::ACCENT,
                        Speaker::Assistant => Theme::ASSISTANT,
                        Speaker::System => Theme::FG_DIM,
                        Speaker::Error => Theme::ERROR,
                        Speaker::Tool => Theme::SYSTEM,
                    };

                    ui.horizontal_top(|ui| {
                        ui.spacing_mut().item_spacing.x = 6.0;
                        ui.colored_label(color, line.speaker.prefix());
                        ui.with_layout(egui::Layout::top_down(egui::Align::LEFT), |ui| {
                            ui.add(
                                egui::Label::new(egui::RichText::new(&line.text).color(color))
                                    .wrap(),
                            );
                        });
                    });
                }
                ui.add_space(4.0);
            });
    }

    fn draw_input(&mut self, ui: &mut egui::Ui, ctx: &egui::Context) {
        let busy = self.bridge.is_busy();

        ui.add_space(4.0);
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = 6.0;

            if busy {
                // Dönen imleç — cevabın geldiğini gösterir.
                const FRAMES: [&str; 4] = ["|", "/", "-", "\\"];
                self.spinner_frame = self.spinner_frame.wrapping_add(1);
                let f = FRAMES[(self.spinner_frame / 8) % FRAMES.len()];
                ui.colored_label(Theme::SYSTEM, f);
            } else {
                ui.colored_label(Theme::ACCENT, "❯");
            }

            let response = ui.add_sized(
                [ui.available_width(), ui.spacing().interact_size.y],
                egui::TextEdit::singleline(&mut self.input)
                    .frame(false)
                    .hint_text(if busy { "cevap bekleniyor…" } else { "bir şeyler yaz…" })
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
        ui.add_space(4.0);
    }

    fn draw_health(&mut self, ctx: &egui::Context) {
        let mut open = self.show_health;
        egui::Window::new("sistem durumu")
            .open(&mut open)
            .collapsible(false)
            .resizable(false)
            .show(ctx, |ui| {
                let msgs = self
                    .core
                    .store
                    .message_count()
                    .map(|n| n.to_string())
                    .unwrap_or_else(|e| format!("hata: {e}"));

                let keys = self.keys.configured().join(", ");
                let rows: [(&str, String); 8] = [
                    ("sürüm", VERSION.to_string()),
                    ("sağlayıcı", self.provider().to_string()),
                    ("model", self.model()),
                    ("anahtarlar", if keys.is_empty() { "yok".into() } else { keys }),
                    ("tool sayısı", format!("{} kayıtlı · en fazla {} sunulur", self.bridge.tool_count(), vavis_tools::MAX_TOOLS)),
                    ("geçmiş", format!("{} mesaj (bellekte)", self.history.len())),
                    ("veritabanı", format!("{msgs} mesaj")),
                    ("veri dizini", self.core.paths.root().display().to_string()),
                ];

                egui::Grid::new("health").num_columns(2).spacing([12.0, 4.0]).show(ui, |ui| {
                    for (k, v) in rows {
                        ui.colored_label(Theme::FG_DIM, k);
                        ui.colored_label(Theme::FG, v);
                        ui.end_row();
                    }
                });
            });
        self.show_health = open;
    }

    fn handle_shortcuts(&mut self, ctx: &egui::Context) {
        let (f1, ctrl_l) = ctx.input(|i| {
            (
                i.key_pressed(egui::Key::F1),
                i.modifiers.ctrl && i.key_pressed(egui::Key::L),
            )
        });
        if f1 {
            self.show_health = !self.show_health;
        }
        if ctrl_l {
            self.feed.clear();
            self.history.clear();
            self.feed.push(Speaker::System, "geçmiş temizlendi");
            self.focus_input = true;
        }
    }
}

impl eframe::App for VavisUi {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.pump_events();
        self.handle_shortcuts(ctx);
        self.draw_health(ctx);
        self.draw_approval(ctx);

        // Cevap beklerken sürekli yeniden çiz — spinner dönsün.
        if self.bridge.is_busy() {
            ctx.request_repaint_after(std::time::Duration::from_millis(80));
        }

        egui::TopBottomPanel::bottom("input")
            .frame(
                egui::Frame::none()
                    .fill(Theme::BG_PANEL)
                    .inner_margin(egui::Margin::symmetric(10.0, 2.0)),
            )
            .show(ctx, |ui| self.draw_input(ui, ctx));

        egui::CentralPanel::default()
            .frame(
                egui::Frame::none()
                    .fill(Theme::BG)
                    .inner_margin(egui::Margin::symmetric(10.0, 4.0)),
            )
            .show(ctx, |ui| self.draw_feed(ui));
    }
}
