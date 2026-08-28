//! UI ↔ beyin ↔ eller köprüsü.
//!
//! **Kritik tasarım kararı:** UI iş parçacığı asla bloklanmaz. LLM çağrısı ve
//! tool çalıştırma ayrı bir tokio çalışma zamanında koşar, sonuçlar kanalla
//! UI'ya damlar. UI her karede kanalı boşaltır — bekleme yok, donma yok.
//!
//! Onay soruları da kanalla gelir: ajan iş parçacığı bloklanır, UI diyaloğu
//! gösterir, cevap tekrar kanalla döner. Böylece onay diyaloğu UI'yı dondurmaz.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::Arc;
use vavis_brain::{BrainClient, ChatConfig, Message, StreamEvent};
use vavis_tools::{Agent, AgentHost, Approval, ApprovalReason, ToolOutcome, MAX_STEPS};

/// Beyinden UI'ya akan olaylar.
#[derive(Debug, Clone)]
pub enum UiEvent {
    /// Metin parçası — feed'e eklenecek.
    Delta(String),
    /// Bir tool çalıştırılmaya başladı.
    ToolStart { tool: String },
    /// Tool sonucu geldi.
    ToolDone {
        tool: String,
        ok: bool,
        summary: String,
    },
    /// Onay isteniyor — UI diyalog göstermeli.
    ApprovalNeeded {
        tool: String,
        args: String,
        reason: ApprovalReason,
    },
    /// Cevap tamamlandı (tam metin).
    Complete(String),
    /// Hata.
    Failed(String),
    /// Model listesi geldi.
    Models(Vec<String>),
}

/// UI'dan ajana giden cevaplar.
enum HostReply {
    Approval(Approval),
}

/// Beyni ve elleri ayrı bir çalışma zamanında tutan köprü.
pub struct Bridge {
    runtime: tokio::runtime::Runtime,
    client: Arc<BrainClient>,
    agent: Arc<std::sync::Mutex<Agent>>,

    tx: Sender<UiEvent>,
    rx: Receiver<UiEvent>,
    /// Onay cevabını ajana geri göndermek için.
    reply_tx: Sender<HostReply>,
    reply_rx: Arc<std::sync::Mutex<Receiver<HostReply>>>,

    busy: Arc<AtomicBool>,
}

impl Bridge {
    pub fn new(agent: Agent) -> std::io::Result<Self> {
        // Çok iş parçacıklı değil: 2 worker yeter, RAM'i şişirmeyelim.
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()?;

        let (tx, rx) = std::sync::mpsc::channel();
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();

        Ok(Self {
            runtime,
            client: Arc::new(BrainClient::new()),
            agent: Arc::new(std::sync::Mutex::new(agent)),
            tx,
            rx,
            reply_tx,
            reply_rx: Arc::new(std::sync::Mutex::new(reply_rx)),
            busy: Arc::new(AtomicBool::new(false)),
        })
    }

    pub fn is_busy(&self) -> bool {
        self.busy.load(Ordering::Relaxed)
    }

    /// UI'nın her karede çağırdığı boşaltma — bloklamaz.
    pub fn drain(&self) -> Vec<UiEvent> {
        self.rx.try_iter().collect()
    }

    /// Kullanıcının onay cevabını ajana ilet.
    pub fn send_approval(&self, approval: Approval) {
        let _ = self.reply_tx.send(HostReply::Approval(approval));
    }

    /// Sohbet isteğini arka planda başlatır. Anında döner.
    pub fn send_chat(
        &self,
        cfg: ChatConfig,
        system: Message,
        history: Vec<Message>,
        user_message: String,
        ctx: Option<egui::Context>,
    ) {
        if self.busy.swap(true, Ordering::SeqCst) {
            tracing::warn!("zaten bir istek uçuyor — yenisi yok sayıldı");
            return;
        }

        let client = self.client.clone();
        let agent = self.agent.clone();
        let tx = self.tx.clone();
        let reply_rx = self.reply_rx.clone();
        let busy = self.busy.clone();

        self.runtime.spawn(async move {
            let result = run_agent_turn(
                &client,
                &agent,
                &cfg,
                system,
                history,
                &user_message,
                &tx,
                &reply_rx,
                ctx.as_ref(),
            )
            .await;

            let event = match result {
                Ok(text) => UiEvent::Complete(text),
                Err(msg) => UiEvent::Failed(msg),
            };
            let _ = tx.send(event);
            busy.store(false, Ordering::SeqCst);
            if let Some(c) = &ctx {
                c.request_repaint();
            }
        });
    }

    /// Model listesini arka planda çeker.
    pub fn fetch_models(
        &self,
        provider: vavis_brain::Provider,
        api_key: String,
        ctx: Option<egui::Context>,
    ) {
        let client = self.client.clone();
        let tx = self.tx.clone();

        self.runtime.spawn(async move {
            let event = match client.list_models(provider, &api_key).await {
                Ok(models) => UiEvent::Models(models),
                Err(err) => UiEvent::Failed(friendly_error(&err)),
            };
            let _ = tx.send(event);
            if let Some(c) = ctx {
                c.request_repaint();
            }
        });
    }

    /// Ajanın kayıt defterine erişim (sağlık ekranı için).
    pub fn tool_count(&self) -> usize {
        self.agent.lock().map(|a| a.registry.len()).unwrap_or(0)
    }
}

/// Bir kullanıcı isteğinin tamamı: model → tool → model → … → cevap.
#[allow(clippy::too_many_arguments)]
async fn run_agent_turn(
    client: &BrainClient,
    agent: &Arc<std::sync::Mutex<Agent>>,
    cfg: &ChatConfig,
    system: Message,
    history: Vec<Message>,
    user_message: &str,
    tx: &Sender<UiEvent>,
    reply_rx: &Arc<std::sync::Mutex<Receiver<HostReply>>>,
    ctx: Option<&egui::Context>,
) -> Result<String, String> {
    // Bu istek için tool'ları seç — en fazla MAX_TOOLS.
    let tools = {
        let mut guard = agent.lock().map_err(|_| "ajan kilidi bozuk")?;
        guard.start_run();
        guard.tools_for(user_message)
    };
    tracing::info!(count = tools.len(), "bu istek için sunulan tool sayısı");

    let mut messages = vec![system];
    messages.extend(history);

    let mut final_text = String::new();

    for step in 0..MAX_STEPS {
        let tx_delta = tx.clone();
        let ctx_delta = ctx.cloned();

        let response = client
            .chat_stream_with_tools(cfg, messages.clone(), &tools, move |event| {
                if let StreamEvent::Delta(text) = event {
                    let _ = tx_delta.send(UiEvent::Delta(text));
                    // Akış geldikçe yeniden çiz — "canlı" hissi bundan gelir.
                    if let Some(c) = &ctx_delta {
                        c.request_repaint();
                    }
                }
            })
            .await
            .map_err(|e| friendly_error(&e))?;

        if !response.text.is_empty() {
            final_text = response.text.clone();
        }

        // Tool istemediyse iş bitti.
        if response.tool_calls.is_empty() {
            return Ok(final_text);
        }

        // Modelin tool isteğini geçmişe ekle — sağlayıcı sonraki turda
        // tool sonuçlarının hangi çağrıya ait olduğunu böyle bilir.
        messages.push(Message {
            role: vavis_brain::Role::Assistant,
            content: response.text.clone(),
            tool_call_id: None,
            tool_calls: Some(response.tool_calls.clone()),
            image: None,
        });

        // Tool'ları çalıştır (bloklayan iş → ayrı thread).
        let mut host = ChannelHost {
            tx: tx.clone(),
            reply_rx: reply_rx.clone(),
            ctx: ctx.cloned(),
        };

        let results = {
            let mut guard = agent.lock().map_err(|_| "ajan kilidi bozuk")?;
            guard.execute_calls(&response.tool_calls, &mut host)
        };

        messages.extend(results);

        // Ekran görüntüsü tool'u çalıştıysa görüntüyü modele ilet.
        //
        // Tool sonuçları metin olmak zorunda (protokol öyle), o yüzden
        // görüntü ayrı bir yuvadan geliyor. `take_` çağrısı yuvayı boşaltır —
        // aynı görüntü iki kez gönderilmez.
        if let Some(image) = vavis_tools::builtin::vision::take_pending_image() {
            tracing::info!("ekran görüntüsü modele iletiliyor");
            messages.push(Message::user_with_image("(ekran görüntüsü ektedir)", image));
        }

        if let Some(c) = ctx {
            c.request_repaint();
        }

        if step == MAX_STEPS - 1 {
            return Err(format!(
                "Model {MAX_STEPS} adımda sonuca varamadı — istek durduruldu."
            ));
        }
    }

    Ok(final_text)
}

/// Onayı kanal üzerinden UI'ya soran ajan ana bilgisayarı.
struct ChannelHost {
    tx: Sender<UiEvent>,
    reply_rx: Arc<std::sync::Mutex<Receiver<HostReply>>>,
    ctx: Option<egui::Context>,
}

impl AgentHost for ChannelHost {
    fn ask_approval(&mut self, tool: &str, args: &str, reason: ApprovalReason) -> Approval {
        let _ = self.tx.send(UiEvent::ApprovalNeeded {
            tool: tool.to_string(),
            args: args.to_string(),
            reason,
        });
        if let Some(c) = &self.ctx {
            c.request_repaint();
        }

        // UI cevaplayana kadar bekle. Bu thread ajan thread'i — UI değil,
        // dolayısıyla arayüz donmaz.
        let Ok(rx) = self.reply_rx.lock() else {
            return Approval::Deny;
        };
        match rx.recv() {
            Ok(HostReply::Approval(a)) => a,
            // Kanal koptu (pencere kapandı) → güvenli taraf: reddet.
            Err(_) => Approval::Deny,
        }
    }

    fn on_tool_start(&mut self, tool: &str, _args: &str) {
        let _ = self.tx.send(UiEvent::ToolStart {
            tool: tool.to_string(),
        });
        if let Some(c) = &self.ctx {
            c.request_repaint();
        }
    }

    fn on_tool_result(&mut self, tool: &str, outcome: &ToolOutcome) {
        // Uzun çıktıyı feed'e basma — özet yeter, tam metin modele gidiyor.
        let summary: String = outcome.content.chars().take(120).collect();
        let _ = self.tx.send(UiEvent::ToolDone {
            tool: tool.to_string(),
            ok: outcome.ok,
            summary,
        });
        if let Some(c) = &self.ctx {
            c.request_repaint();
        }
    }
}

/// Ham hata yerine kullanıcının anlayacağı mesaj.
fn friendly_error(err: &vavis_brain::BrainError) -> String {
    use vavis_brain::BrainError as E;
    match err {
        E::MissingKey { provider } => {
            format!("{provider} için API anahtarı yok. `/key {provider} <anahtar>` ile ekle.")
        }
        E::Api { status: 401, .. } => "API anahtarı geçersiz. `/key` ile güncelle.".into(),
        E::Api { status: 429, .. } => "Sağlayıcı hız sınırı — biraz bekleyip tekrar dene.".into(),
        E::Api { status: 404, .. } => {
            "Model bulunamadı. `/models` ile listeyi gör, `/model <ad>` ile değiştir.".into()
        }
        E::Api { status, body } if *status == 413 || body.contains("too long") => {
            "İstek çok uzun — `/clear` ile geçmişi temizle.".into()
        }
        E::Api { status, body } => format!("Sağlayıcı hatası {status}: {body}"),
        E::Network(e) if e.is_timeout() => "Zaman aşımı — sağlayıcı cevap vermedi.".into(),
        E::Network(e) if e.is_connect() => {
            "Bağlanılamadı — internet/sunucu kapalı olabilir.".into()
        }
        E::Network(e) => format!("Ağ hatası: {e}"),
        E::Parse(e) => format!("Cevap çözümlenemedi: {e}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bridge() -> Bridge {
        Bridge::new(Agent::new(vavis_tools::default_registry())).unwrap()
    }

    #[test]
    fn bridge_starts_idle() {
        let b = bridge();
        assert!(!b.is_busy());
        assert!(b.drain().is_empty());
    }

    #[test]
    fn registry_has_tools() {
        assert!(bridge().tool_count() > 0);
    }

    #[test]
    fn missing_key_produces_actionable_message() {
        let err = vavis_brain::BrainError::MissingKey {
            provider: vavis_brain::Provider::Groq,
        };
        assert!(friendly_error(&err).contains("/key"));
    }

    #[test]
    fn rate_limit_is_explained_in_plain_language() {
        let err = vavis_brain::BrainError::Api {
            status: 429,
            body: "rate_limit_exceeded".into(),
        };
        let msg = friendly_error(&err);
        assert!(!msg.contains("429"), "ham durum kodu gösterilmemeli");
        assert!(msg.contains("bekle"));
    }

    #[test]
    fn drain_returns_sent_events_in_order() {
        let b = bridge();
        b.tx.send(UiEvent::Delta("bir".into())).unwrap();
        b.tx.send(UiEvent::Delta("iki".into())).unwrap();

        let events = b.drain();
        assert_eq!(events.len(), 2);
        assert!(matches!(&events[0], UiEvent::Delta(t) if t == "bir"));
    }

    #[test]
    fn approval_reply_reaches_the_waiting_host() {
        let b = bridge();
        b.send_approval(Approval::Allow);

        let rx = b.reply_rx.lock().unwrap();
        assert!(matches!(
            rx.recv().unwrap(),
            HostReply::Approval(Approval::Allow)
        ));
    }
}
