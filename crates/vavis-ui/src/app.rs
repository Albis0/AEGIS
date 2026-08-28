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
use crate::ticker::Ticker;
use crate::voice::{VoiceEvent, VoiceManager};
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
    /// Ses katmanı — mikrofon, STT, TTS.
    voice: VoiceManager,
    /// Kalıcı depo — hafıza ve sohbet geçmişi.
    store: std::sync::Arc<std::sync::Mutex<vavis_core::Store>>,
    /// Otomasyon zamanlayıcısı — arka planda tetikleyicileri izler.
    ticker: Ticker,
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

        // Hafıza tool'ları depoyu buradan alır — tek kaynak.
        let store = std::sync::Arc::new(std::sync::Mutex::new(
            vavis_core::Store::open(&core.paths).expect("veritabanı açılamadı"),
        ));
        vavis_tools::builtin::memory::attach_store(store.clone());
        vavis_tools::builtin::automation::attach_store(store.clone());

        // Otomasyon zamanlayıcısı: koşullu tetikleyiciler için pil ve CPU
        // ölçümünü tool katmanından alıyor — ölçüm mantığı tek yerde.
        let ticker = Ticker::start(store.clone(), Some(cc.egui_ctx.clone()), || {
            (
                vavis_tools::builtin::system::battery_percent(),
                vavis_tools::builtin::system::cpu_percent(),
            )
        });

        let agent = Agent::new(vavis_tools::default_registry());
        let bridge = Bridge::new(agent).expect("tokio çalışma zamanı kurulamadı");

        let mut voice = VoiceManager::new(
            core.config.general.assistant_name.to_lowercase(),
            core.config.general.language.clone(),
        )
        .expect("ses katmanı kurulamadı");
        // STT Groq'un Whisper'ını kullanıyor — anahtar zaten varsa devral.
        if let Some(key) = keys.get("groq") {
            voice.set_api_key(key.to_string());
        }

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
            voice,
            store,
            ticker,
        };
        ui.restore_history();
        ui.greet();
        ui
    }

    /// Önceki oturumun sohbetini geri yükler.
    ///
    /// Sadece son birkaç tur — tüm geçmişi yüklemek bağlam bütçesini
    /// baştan doldururdu.
    fn restore_history(&mut self) {
        const RESTORE_COUNT: usize = 20;

        let stored = {
            let guard = self.store.lock().unwrap_or_else(|e| e.into_inner());
            guard.recent_messages(RESTORE_COUNT)
        };

        let Ok(messages) = stored else {
            return;
        };
        if messages.is_empty() {
            return;
        }

        for m in &messages {
            let (role, speaker) = match m.role.as_str() {
                "user" => (Role::User, Speaker::User),
                "assistant" => (Role::Assistant, Speaker::Assistant),
                _ => continue, // tool/system mesajları geri yüklenmez
            };
            self.feed.push(speaker, m.content.clone());
            self.history.push(Message {
                role,
                content: m.content.clone(),
                tool_call_id: None,
                tool_calls: None,
                image: None,
            });
        }

        self.feed.push(
            Speaker::System,
            format!("— önceki oturumdan {} mesaj yüklendi —", messages.len()),
        );
    }

    /// Bir mesajı kalıcı depoya yazar.
    fn persist(&self, role: &str, content: &str) {
        let guard = self.store.lock().unwrap_or_else(|e| e.into_inner());
        if let Err(e) = guard.add_message(role, content) {
            tracing::warn!(%e, "mesaj kaydedilemedi");
        }
    }

    /// Sohbeti temizler — ekran, bellek ve depo.
    ///
    /// Hafızadaki **olgular silinmez**: kullanıcı "beni hatırla" diye
    /// kaydettirdiği şeyi /clear ile kaybetmemeli.
    fn clear_history(&mut self) {
        self.feed.clear();
        self.history.clear();

        let cleared = {
            let guard = self.store.lock().unwrap_or_else(|e| e.into_inner());
            guard.clear_messages()
        };
        if let Err(e) = cleared {
            tracing::warn!(%e, "geçmiş silinemedi");
        }

        self.feed
            .push(Speaker::System, "sohbet temizlendi (hafıza korundu)");
        self.focus_input = true;
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
            Command::Clear => self.clear_history(),
            Command::Quit => ctx.send_viewport_cmd(egui::ViewportCommand::Close),
            Command::SetKey { provider, key } => self.set_key(&provider, key),
            Command::ListKeys => self.list_keys(),
            Command::SetProvider(name) => self.set_provider(&name),
            Command::SetModel(name) => self.set_model(name),
            Command::ListModels => self.fetch_models(ctx),
            Command::ShowSettings => self.show_settings(),
            Command::Voice(mode) => self.set_voice_mode(&mode),
            Command::Set { field, value } => self.set_setting(&field, value),
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
        self.persist("user", &text);
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

    /// Mevcut ayarları listeler.
    fn show_settings(&mut self) {
        let cfg = &self.core.config;
        let rows = [
            format!("isim       {}", cfg.general.assistant_name),
            format!("dil        {}", cfg.general.language),
            format!("yazitipi   {}", cfg.ui.font_size),
            format!("pencere    {}", cfg.ui.window_mode),
            format!("saglayici  {}", cfg.llm.provider),
            format!("model      {}", self.model()),
        ];
        for r in rows {
            self.feed.push(Speaker::System, r);
        }
        self.feed
            .push(Speaker::System, "değiştirmek için: /ayar <alan> <değer>");
    }

    /// Tek bir ayarı değiştirir.
    ///
    /// Ayarlar hemen diske yazılır; bazıları (yazı tipi, pencere modu)
    /// yeniden başlatma ister — kullanıcıya söyleniyor.
    fn set_setting(&mut self, field: &str, value: String) {
        let mut needs_restart = false;

        match field {
            "isim" | "name" => {
                self.core.config.general.assistant_name = value.clone();
                self.feed
                    .push(Speaker::System, format!("isim: {value}"));
            }
            "dil" | "language" | "lang" => {
                let lang = value.to_lowercase();
                if !["tr", "en"].contains(&lang.as_str()) {
                    self.feed
                        .push(Speaker::Error, "dil sadece 'tr' veya 'en' olabilir");
                    return;
                }
                self.core.config.general.language = lang.clone();
                self.feed.push(Speaker::System, format!("dil: {lang}"));
            }
            "yazitipi" | "yazıtipi" | "font" => {
                let Ok(size) = value.trim().parse::<f32>() else {
                    self.feed.push(Speaker::Error, "yazı tipi bir sayı olmalı");
                    return;
                };
                if !(8.0..=32.0).contains(&size) {
                    self.feed
                        .push(Speaker::Error, "yazı tipi 8-32 arasında olmalı");
                    return;
                }
                self.core.config.ui.font_size = size;
                needs_restart = true;
                self.feed.push(Speaker::System, format!("yazı tipi: {size}"));
            }
            "pencere" | "window" => {
                let mode = value.to_lowercase();
                if !["windowed", "borderless", "fullscreen"].contains(&mode.as_str()) {
                    self.feed.push(
                        Speaker::Error,
                        "pencere: windowed · borderless · fullscreen",
                    );
                    return;
                }
                self.core.config.ui.window_mode = mode.clone();
                needs_restart = true;
                self.feed.push(Speaker::System, format!("pencere modu: {mode}"));
            }
            other => {
                self.feed.push(
                    Speaker::Error,
                    format!("bilinmeyen ayar: {other} — /ayarlar ile listeyi gör"),
                );
                return;
            }
        }

        self.save_config();
        if needs_restart {
            self.feed
                .push(Speaker::System, "(yeniden başlatınca etkili olacak)");
        }
    }

    /// Ses modunu adıyla ayarlar.
    fn set_voice_mode(&mut self, name: &str) {
        use vavis_audio::VoiceMode;

        let mode = match name {
            "kapali" | "kapalı" | "off" | "" => VoiceMode::Off,
            "surekli" | "sürekli" | "on" | "continuous" => VoiceMode::Continuous,
            "uyandirma" | "uyandırma" | "wake" | "wakeword" => VoiceMode::WakeWord,
            other => {
                self.feed.push(
                    Speaker::Error,
                    format!("bilinmeyen mod: {other} — kapali · surekli · uyandirma"),
                );
                return;
            }
        };

        // Dinlemeye geçiyorsak STT anahtarı şart.
        if mode.is_listening() {
            match self.keys.get("groq") {
                Some(key) => self.voice.set_api_key(key.to_string()),
                None => {
                    self.feed.push(
                        Speaker::Error,
                        "ses tanıma için Groq anahtarı gerekli → /key groq <anahtar>",
                    );
                    return;
                }
            }
        }

        self.voice.set_mode(mode);
        self.feed
            .push(Speaker::System, format!("ses: {}", self.voice.mode().label()));
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

        // STT de Groq'un Whisper'ını kullanıyor — anahtarı ses katmanına geçir.
        if provider == Provider::Groq {
            if let Some(k) = self.keys.get("groq") {
                self.voice.set_api_key(k.to_string());
            }
        }

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

    fn pump_events(&mut self, ctx: &egui::Context) {
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
                        // Cevabı seslendir — ses açıksa.
                        self.voice.speak(&full, Some(ctx.clone()));
                        self.persist("assistant", &full);
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
            } else if self.voice.is_speaking() {
                // Konuşurken ESC'nin kestiğini hatırlat.
                ui.colored_label(Theme::ASSISTANT, "♪")
                    .on_hover_text("konuşuyor — ESC keser");
            } else if self.voice.mode().is_listening() {
                ui.colored_label(Theme::ACCENT, "◉")
                    .on_hover_text(self.voice.mode().label());
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
                let facts = {
                    let g = self.store.lock().unwrap_or_else(|e| e.into_inner());
                    g.fact_count().unwrap_or(0)
                };
                let automations = {
                    let g = self.store.lock().unwrap_or_else(|e| e.into_inner());
                    g.all_automations().map(|a| a.len()).unwrap_or(0)
                };
                let rows: [(&str, String); 11] = [
                    ("sürüm", VERSION.to_string()),
                    ("sağlayıcı", self.provider().to_string()),
                    ("model", self.model()),
                    ("anahtarlar", if keys.is_empty() { "yok".into() } else { keys }),
                    ("tool sayısı", format!("{} kayıtlı · en fazla {} sunulur", self.bridge.tool_count(), vavis_tools::MAX_TOOLS)),
                    ("geçmiş", format!("{} mesaj (bellekte)", self.history.len())),
                    ("veritabanı", format!("{msgs} mesaj")),
                    ("hafıza", format!("{facts} olgu")),
                    ("otomasyon", format!("{automations} kurulu")),
                    ("ses", self.voice.mode().label().to_string()),
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
        let (f1, ctrl_l, esc, ctrl_m) = ctx.input(|i| {
            (
                i.key_pressed(egui::Key::F1),
                i.modifiers.ctrl && i.key_pressed(egui::Key::L),
                i.key_pressed(egui::Key::Escape),
                i.modifiers.ctrl && i.key_pressed(egui::Key::M),
            )
        });

        if f1 {
            self.show_health = !self.show_health;
        }

        if ctrl_l {
            self.clear_history();
        }

        // ── BARGE-IN ────────────────────────────────────────────────────
        // Eski projede bu, sıradaki cümleyi başlatıyordu. Burada kuyruk
        // yapısal olarak buna izin vermiyor (vavis_audio::queue).
        if esc && self.voice.is_speaking() {
            self.voice.stop_speaking();
            self.feed.push(Speaker::System, "konuşma kesildi");
        }

        // Ctrl+M: ses modunu değiştir. (Yalın M kullanılmıyor — giriş
        // kutusuna "m" yazmak modu değiştirmemeli.)
        if ctrl_m {
            let mode = self.voice.cycle_mode();
            self.feed.push(Speaker::System, format!("ses: {}", mode.label()));

            // STT için anahtar gerekiyor — kullanıcı bilsin.
            if mode.is_listening() {
                let key = self.keys.get("groq").unwrap_or_default().to_string();
                if key.is_empty() {
                    self.feed.push(
                        Speaker::Error,
                        "ses tanıma için Groq anahtarı gerekli → /key groq <anahtar>",
                    );
                } else {
                    self.voice.set_api_key(key);
                }
            }
        }
    }

    /// Tetiklenen otomasyonları işler.
    ///
    /// Otomasyon, kullanıcı yazmış gibi asistana bir istek gönderir.
    /// Asistan meşgulse **atlanmaz, ertelenir**: bir sonraki turda
    /// tekrar denenmez (tetiklendi işareti konuldu), o yüzden burada
    /// meşgulse kullanıcıya haber verilir.
    fn pump_ticker(&mut self, ctx: &egui::Context) {
        for fired in self.ticker.poll() {
            self.feed.push(
                Speaker::System,
                format!("⏰ otomasyon #{} ({})", fired.id, fired.trigger),
            );

            if self.bridge.is_busy() {
                self.feed.push(
                    Speaker::Error,
                    format!("asistan meşgul — otomasyon atlandı: {}", fired.prompt),
                );
                continue;
            }

            self.feed.push(Speaker::User, fired.prompt.clone());
            self.start_chat(fired.prompt, ctx);
        }
    }

    /// Ses katmanından gelen olayları işler.
    fn pump_voice(&mut self, ctx: &egui::Context) {
        let events = self.voice.poll(Some(ctx.clone()));
        for event in events {
            match event {
                VoiceEvent::Heard(text) => {
                    self.feed.push(Speaker::User, format!("🎤 {text}"));
                    self.start_chat(text, ctx);
                }
                VoiceEvent::Woke => {
                    self.feed.push(Speaker::System, "dinliyorum…");
                }
                VoiceEvent::Notice(msg) => {
                    self.feed.push(Speaker::System, msg);
                }
                VoiceEvent::SpeakingChanged(_) => {
                    // Gösterge `is_speaking()` ile okunuyor; ek iş yok.
                }
            }
        }
    }
}

impl eframe::App for VavisUi {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.pump_events(ctx);
        self.pump_voice(ctx);
        self.pump_ticker(ctx);
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
