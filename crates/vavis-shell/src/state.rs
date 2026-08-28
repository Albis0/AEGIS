//! Shared application state.
//!
//! One instance lives for the lifetime of the process, held by Tauri and
//! handed to every command. Interior mutability is deliberate: commands
//! arrive on many threads and must not need `&mut self`.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use vavis_brain::{BrainClient, KeyStore, Message};
use vavis_core::{App as CoreApp, Store};
use vavis_tools::Agent;

/// Everything a command might need.
pub struct AppState {
    pub core: Mutex<CoreApp>,
    pub keys: Mutex<KeyStore>,
    pub store: Arc<Mutex<Store>>,
    pub agent: Arc<Mutex<Agent>>,
    pub client: Arc<BrainClient>,

    /// Conversation as sent to the model — system prompt excluded.
    ///
    /// `Arc` because the request thread outlives the command that
    /// started it and must still append the reply.
    pub history: Arc<Mutex<Vec<Message>>>,

    /// True while a request is in flight. Guards against double submits;
    /// the interface also disables its input, but a slow click could
    /// otherwise slip through.
    pub busy: Arc<AtomicBool>,

    /// Reply from an approval dialog, handed back to the waiting agent
    /// thread.
    pub approval_tx: std::sync::mpsc::Sender<vavis_tools::Approval>,
    pub approval_rx: Arc<Mutex<std::sync::mpsc::Receiver<vavis_tools::Approval>>>,

    /// Voice subsystem — microphone, speech recognition, speech synthesis.
    pub voice: Arc<Mutex<crate::voice::VoiceState>>,

    /// Wall-clock start, used by the interface for uptime.
    pub started: std::time::Instant,
}

impl AppState {
    pub fn new(core: CoreApp) -> anyhow::Result<Self> {
        let keys = KeyStore::load(core.paths.root());

        let store = Arc::new(Mutex::new(Store::open(&core.paths)?));
        // Memory and automation tools reach the database through these —
        // one store, one source of truth.
        vavis_tools::builtin::memory::attach_store(store.clone());
        vavis_tools::builtin::automation::attach_store(store.clone());

        let (approval_tx, approval_rx) = std::sync::mpsc::channel();

        let voice = crate::voice::VoiceState::new(
            core.config.general.assistant_name.to_lowercase(),
            core.config.general.language.clone(),
            keys.get("groq").unwrap_or_default().to_string(),
        );

        Ok(Self {
            core: Mutex::new(core),
            keys: Mutex::new(keys),
            store,
            agent: Arc::new(Mutex::new(Agent::new(vavis_tools::default_registry()))),
            client: Arc::new(BrainClient::new()),
            history: Arc::new(Mutex::new(Vec::new())),
            busy: Arc::new(AtomicBool::new(false)),
            approval_tx,
            approval_rx: Arc::new(Mutex::new(approval_rx)),
            voice: Arc::new(Mutex::new(voice)),
            started: std::time::Instant::now(),
        })
    }

    /// Claims the busy flag. Returns false if a request is already running.
    pub fn try_claim(&self) -> bool {
        !self.busy.swap(true, Ordering::SeqCst)
    }

    pub fn release(&self) {
        self.busy.store(false, Ordering::SeqCst);
    }

    /// Locks a mutex, recovering from poisoning.
    ///
    /// A panic in one command must not permanently disable the assistant;
    /// the data behind these locks is plain state, not an invariant that a
    /// panic could have corrupted.
    pub fn lock<'a, T>(m: &'a Mutex<T>) -> std::sync::MutexGuard<'a, T> {
        m.lock().unwrap_or_else(|e| e.into_inner())
    }
}
