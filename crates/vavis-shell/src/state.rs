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
        // The generation tool writes into the same gallery the canvas reads,
        // so an image asked for in chat is waiting in the grid afterwards.
        vavis_tools::builtin::canvas::attach(store.clone(), core.paths.media_dir());

        // The search chain reads its order from config and its keys from the
        // key store; both live here, so the shell installs the snapshot.
        push_search_settings(&core.config, &keys);
        push_canvas_settings(&core.config, &keys);
        push_steam_settings(&core.config, &keys);
        push_spotify_settings(&core.config, &keys);

        // Pick a vault up front: the configured one, else whichever Obsidian
        // opened last. The note tools are useless without one, and asking the
        // user to paste a path when the answer is already on disk is rude.
        vavis_tools::obsidian::set_active(vavis_tools::obsidian::autoselect(
            &core.config.obsidian.vault,
        ));

        // Built-ins plus whatever MCP servers the user configured.
        let registry = build_registry(&core.config, &keys);

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
            agent: Arc::new(Mutex::new(Agent::new(registry))),
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

    /// Re-installs the search chain snapshot.
    ///
    /// Called after a key or provider-order change so a freshly pasted key
    /// takes effect without a restart.
    pub fn refresh_search(&self) {
        let core = Self::lock(&self.core);
        let keys = Self::lock(&self.keys);
        push_search_settings(&core.config, &keys);
    }

    /// Re-installs the generation chain snapshot.
    pub fn refresh_canvas(&self) {
        let core = Self::lock(&self.core);
        let keys = Self::lock(&self.keys);
        push_canvas_settings(&core.config, &keys);
    }

    /// Re-installs the Steam credentials snapshot.
    pub fn refresh_steam(&self) {
        let core = Self::lock(&self.core);
        let keys = Self::lock(&self.keys);
        push_steam_settings(&core.config, &keys);
    }

    /// Re-installs the Spotify snapshot.
    pub fn refresh_spotify(&self) {
        let core = Self::lock(&self.core);
        let keys = Self::lock(&self.keys);
        push_spotify_settings(&core.config, &keys);
    }

    /// Reconnects every MCP server and rebuilds the tool registry.
    ///
    /// A whole rebuild rather than a surgical add: servers publish tools at
    /// connect time, so adding, removing or toggling one changes which tools
    /// exist. Rebuilding keeps one code path correct instead of two.
    pub fn reload_mcp(&self) -> Vec<vavis_tools::mcp::ServerStatus> {
        // Drop the old connections first, or the child processes leak.
        vavis_tools::mcp::disconnect_all();

        let core = Self::lock(&self.core);
        let keys = Self::lock(&self.keys);

        let mut registry = vavis_tools::default_registry();
        let mut statuses = Vec::new();

        for server in &core.config.mcp.servers {
            if server.id.trim().is_empty() {
                continue;
            }
            let secret = keys
                .get(&format!("mcp_{}", server.id))
                .unwrap_or_default()
                .to_string();
            statuses.push(vavis_tools::mcp::connect(
                &mut registry,
                &mcp_server_config(server, &secret),
                &secret,
            ));
        }

        Self::lock(&self.agent).registry = registry;
        statuses
    }

    /// Persists a Spotify token, encrypted.
    ///
    /// Called both after authorisation and whenever the access token is
    /// silently refreshed mid-session — otherwise the refresh would be lost
    /// on restart and the user would have to authorise again.
    pub fn save_spotify_token(&self, token: &vavis_tools::spotify::Token) {
        let core = Self::lock(&self.core);
        let mut keys = Self::lock(&self.keys);

        match serde_json::to_string(token) {
            Ok(json) => {
                keys.set("spotify_token", json);
                if let Err(e) = keys.save(core.paths.root()) {
                    tracing::warn!(%e, "spotify token could not be saved");
                }
            }
            Err(e) => tracing::warn!(%e, "spotify token could not be serialised"),
        }
    }
}

/// Turns a config entry into what the MCP client expects.
///
/// Secrets live in the key store, so `{key}` placeholders are filled here
/// rather than being written into the settings file.
pub fn mcp_server_config(server: &vavis_core::McpServer, secret: &str) -> vavis_tools::mcp::ServerConfig {
    let transport = if server.transport.eq_ignore_ascii_case("http") {
        vavis_tools::mcp::Transport::Http {
            url: server.url.clone(),
            header_name: server.header_name.clone(),
            header_value: server.header_value.clone(),
        }
    } else {
        vavis_tools::mcp::Transport::Stdio {
            command: server.command.clone(),
            args: server.args.clone(),
            env: server
                .env
                .iter()
                .map(|(name, value)| (name.clone(), value.replace("{key}", secret)))
                .collect(),
        }
    };

    vavis_tools::mcp::ServerConfig {
        id: server.id.clone(),
        transport,
        disabled: server.disabled.clone(),
        enabled: server.enabled,
    }
}

/// Builds a registry with every built-in plus every configured MCP server.
///
/// Connecting happens here because the registry is what MCP tools register
/// into; a server that fails to start is logged and skipped so one bad entry
/// cannot stop the assistant from booting.
fn build_registry(config: &vavis_core::Config, keys: &KeyStore) -> vavis_tools::Registry {
    let mut registry = vavis_tools::default_registry();

    for server in &config.mcp.servers {
        if server.id.trim().is_empty() {
            continue;
        }
        let secret = keys
            .get(&format!("mcp_{}", server.id))
            .unwrap_or_default()
            .to_string();
        let status = vavis_tools::mcp::connect(&mut registry, &mcp_server_config(server, &secret), &secret);
        if let Some(error) = &status.error {
            tracing::warn!(server = %server.id, %error, "mcp server unavailable");
        } else {
            tracing::info!(server = %server.id, tools = status.tools.len(), "mcp server connected");
        }
    }

    registry
}

/// Copies Spotify settings into the tool layer.
fn push_spotify_settings(config: &vavis_core::Config, keys: &KeyStore) {
    let token = keys
        .get("spotify_token")
        .and_then(|raw| serde_json::from_str(raw).ok())
        .unwrap_or_default();

    vavis_tools::spotify::configure(vavis_tools::spotify::Settings {
        client_id: config.spotify.client_id.clone(),
        token,
    });
}

/// Copies Steam credentials into the tool layer.
fn push_steam_settings(config: &vavis_core::Config, keys: &KeyStore) {
    vavis_tools::steam::configure(vavis_tools::steam::Settings {
        api_key: keys.get("steam").unwrap_or_default().to_string(),
        steam_id: config.steam.steam_id.clone(),
    });
}

/// Copies config and keys into the search layer.
///
/// Config carries the order and the custom endpoint; secrets stay in the
/// encrypted key store and are only read here.
/// Installs the image and video generation snapshot.
fn push_canvas_settings(config: &vavis_core::Config, keys: &KeyStore) {
    let canvas = &config.canvas;
    vavis_tools::canvas::configure(vavis_tools::canvas::Settings {
        image_order: canvas.image_order.clone(),
        video_order: canvas.video_order.clone(),
        image_model: canvas.image_model.clone(),
        video_model: canvas.video_model.clone(),
        // The OpenAI key is one key. A user who already pasted it for chat
        // should not have to paste it again to draw something; the dedicated
        // slot still wins, for a separate billing account.
        openai_key: keys
            .get("canvas_openai")
            .or_else(|| keys.get("openai"))
            .unwrap_or_default()
            .to_string(),
        stability_key: keys.get("canvas_stability").unwrap_or_default().to_string(),
        replicate_key: keys.get("canvas_replicate").unwrap_or_default().to_string(),
        custom: vavis_tools::canvas::providers::CustomConfig {
            url: canvas.custom.url.clone(),
            header_name: canvas.custom.header_name.clone(),
            header_value: canvas.custom.header_value.clone(),
            model: canvas.custom.model.clone(),
        },
        custom_key: keys.get("canvas_custom").unwrap_or_default().to_string(),
    });
}

fn push_search_settings(config: &vavis_core::Config, keys: &KeyStore) {
    let custom = &config.search.custom;
    vavis_tools::websearch::configure(vavis_tools::websearch::Settings {
        order: config.search.order.clone(),
        tavily_key: keys.get("tavily").unwrap_or_default().to_string(),
        brave_key: keys.get("brave").unwrap_or_default().to_string(),
        custom: vavis_tools::websearch::providers::CustomConfig {
            url: custom.url.clone(),
            header_name: custom.header_name.clone(),
            header_value: custom.header_value.clone(),
            results_path: custom.results_path.clone(),
            title_key: custom.title_key.clone(),
            url_key: custom.url_key.clone(),
            snippet_key: custom.snippet_key.clone(),
        },
        custom_key: keys.get("search_custom").unwrap_or_default().to_string(),
    });
}
