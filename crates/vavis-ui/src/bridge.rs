//! UI ↔ beyin köprüsü.
//!
//! **Kritik tasarım kararı:** UI iş parçacığı asla bloklanmaz. LLM çağrısı ayrı
//! bir tokio çalışma zamanında koşar, sonuçlar kanalla UI'ya damlar. UI her
//! karede kanalı boşaltır — bekleme yok, donma yok.
//!
//! Eski projede bu IPC ile yapılıyordu (main ↔ renderer, JSON serileştirme).
//! Burada aynı süreç içinde kanal — serileştirme yok, gecikme yok.

use std::sync::mpsc::{Receiver, Sender};
use vavis_brain::{BrainClient, ChatConfig, Message, StreamEvent};

/// Beyinden UI'ya akan olaylar.
#[derive(Debug, Clone)]
pub enum UiEvent {
    /// Metin parçası — feed'e eklenecek.
    Delta(String),
    /// Cevap tamamlandı (tam metin, geçmişe kaydedilecek).
    Complete(String),
    /// Hata — kullanıcıya gösterilecek.
    Failed(String),
    /// Model listesi geldi.
    Models(Vec<String>),
}

/// Beyni ayrı bir çalışma zamanında tutan köprü.
pub struct Bridge {
    runtime: tokio::runtime::Runtime,
    client: std::sync::Arc<BrainClient>,
    tx: Sender<UiEvent>,
    rx: Receiver<UiEvent>,
    /// Şu an bir istek uçuyor mu — çift gönderimi engeller.
    busy: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

impl Bridge {
    pub fn new() -> std::io::Result<Self> {
        // Çok iş parçacıklı değil: 2 worker yeter, RAM'i şişirmeyelim.
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()?;

        let (tx, rx) = std::sync::mpsc::channel();
        Ok(Self {
            runtime,
            client: std::sync::Arc::new(BrainClient::new()),
            tx,
            rx,
            busy: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
        })
    }

    pub fn is_busy(&self) -> bool {
        self.busy.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// UI'nın her karede çağırdığı boşaltma — bloklamaz.
    pub fn drain(&self) -> Vec<UiEvent> {
        self.rx.try_iter().collect()
    }

    /// Sohbet isteğini arka planda başlatır. Anında döner.
    ///
    /// `ctx` verilirse akış geldikçe pencere yeniden çizilir (aksi hâlde
    /// kullanıcı fareyi oynatana kadar metin görünmez).
    pub fn send_chat(
        &self,
        cfg: ChatConfig,
        messages: Vec<Message>,
        ctx: Option<egui::Context>,
    ) {
        use std::sync::atomic::Ordering;
        if self.busy.swap(true, Ordering::SeqCst) {
            tracing::warn!("zaten bir istek uçuyor — yenisi yok sayıldı");
            return;
        }

        let client = self.client.clone();
        let tx = self.tx.clone();
        let busy = self.busy.clone();

        self.runtime.spawn(async move {
            let tx_delta = tx.clone();
            let ctx_delta = ctx.clone();

            let result = client
                .chat_stream(&cfg, messages, move |event| {
                    if let StreamEvent::Delta(text) = event {
                        let _ = tx_delta.send(UiEvent::Delta(text));
                        // Akış geldikçe yeniden çiz — "canlı" hissi bundan gelir.
                        if let Some(c) = &ctx_delta {
                            c.request_repaint();
                        }
                    }
                })
                .await;

            let event = match result {
                Ok(full) => UiEvent::Complete(full),
                Err(err) => {
                    tracing::error!(%err, "sohbet başarısız");
                    UiEvent::Failed(friendly_error(&err))
                }
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
}

/// Ham hata yerine kullanıcının anlayacağı mesaj.
///
/// Eski projede ham sağlayıcı JSON'u feed'e basılıyordu — kullanıcı ne
/// yapacağını anlamıyordu.
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
        E::Network(e) if e.is_connect() => "Bağlanılamadı — internet/sunucu kapalı olabilir.".into(),
        E::Network(e) => format!("Ağ hatası: {e}"),
        E::Parse(e) => format!("Cevap çözümlenemedi: {e}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_starts_idle() {
        let bridge = Bridge::new().unwrap();
        assert!(!bridge.is_busy());
        assert!(bridge.drain().is_empty());
    }

    #[test]
    fn missing_key_produces_actionable_message() {
        let err = vavis_brain::BrainError::MissingKey {
            provider: vavis_brain::Provider::Groq,
        };
        let msg = friendly_error(&err);
        assert!(msg.contains("/key"), "kullanıcıya ne yapacağı söylenmeli");
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
        let bridge = Bridge::new().unwrap();
        bridge.tx.send(UiEvent::Delta("bir".into())).unwrap();
        bridge.tx.send(UiEvent::Delta("iki".into())).unwrap();

        let events = bridge.drain();
        assert_eq!(events.len(), 2);
        assert!(matches!(&events[0], UiEvent::Delta(t) if t == "bir"));
    }
}
