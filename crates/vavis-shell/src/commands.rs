//! Commands the interface can invoke.
//!
//! Each `#[tauri::command]` is one call the frontend can make. They are
//! deliberately thin: validate, delegate to a layer, return a plain type.
//! Business logic belongs in `vavis-brain` / `vavis-tools`, not here.
//!
//! Long-running work (a model request) emits events instead of blocking,
//! so the interface stays responsive and can stream tokens as they arrive.

use crate::state::AppState;
use serde::Serialize;
use std::sync::atomic::Ordering;
use tauri::{Emitter, State};
use vavis_brain::{system_prompt, ChatConfig, Message, Provider, StreamEvent};
use vavis_tools::{AgentHost, Approval, ApprovalReason, ToolOutcome, MAX_STEPS};

/// A snapshot of everything the interface shows in its side panels.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub version: String,
    pub assistant_name: String,
    pub language: String,
    pub provider: String,
    pub model: String,
    pub providers: Vec<ProviderInfo>,
    pub keys: Vec<String>,
    pub tool_count: usize,
    pub history_len: usize,
    pub fact_count: i64,
    pub automation_count: usize,
    pub message_count: i64,
    pub voice_mode: String,
    pub busy: bool,
    pub speaking: bool,
    pub cpu: Option<u32>,
    pub battery: Option<u32>,
    pub uptime_secs: u64,
    pub data_dir: String,
    pub window_mode: String,
    pub font_size: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInfo {
    pub id: String,
    pub needs_key: bool,
    pub has_key: bool,
    pub default_model: String,
}

/// Everything the panels need, in one round trip.
///
/// One call rather than a dozen: the interface polls this on a timer, and
/// a dozen separate IPC calls per second would be wasteful.
#[tauri::command]
pub fn get_status(state: State<AppState>) -> Status {
    let core = AppState::lock(&state.core);
    let keys = AppState::lock(&state.keys);

    let provider = Provider::parse(&core.config.llm.provider).unwrap_or(Provider::Groq);
    let model = if core.config.llm.model.trim().is_empty() {
        provider.default_model().to_string()
    } else {
        core.config.llm.model.clone()
    };

    let (facts, automations, messages) = {
        let store = AppState::lock(&state.store);
        (
            store.fact_count().unwrap_or(0),
            store.all_automations().map(|a| a.len()).unwrap_or(0),
            store.message_count().unwrap_or(0),
        )
    };

    let voice = AppState::lock(&state.voice);

    Status {
        version: vavis_core::VERSION.to_string(),
        assistant_name: core.config.general.assistant_name.clone(),
        language: core.config.general.language.clone(),
        provider: provider.key_name().to_string(),
        model,
        providers: Provider::ALL
            .iter()
            .map(|p| ProviderInfo {
                id: p.key_name().to_string(),
                needs_key: p.needs_key(),
                has_key: keys.get(p.key_name()).is_some(),
                default_model: p.default_model().to_string(),
            })
            .collect(),
        keys: keys.configured().iter().map(|s| s.to_string()).collect(),
        tool_count: AppState::lock(&state.agent).registry.len(),
        history_len: AppState::lock(&state.history).len(),
        fact_count: facts,
        automation_count: automations,
        message_count: messages,
        voice_mode: crate::voice::mode_name(voice.mode()).to_string(),
        busy: state.busy.load(Ordering::SeqCst),
        speaking: voice.is_speaking(),
        cpu: vavis_tools::builtin::system::cpu_percent(),
        battery: vavis_tools::builtin::system::battery_percent(),
        uptime_secs: state.started.elapsed().as_secs(),
        data_dir: core.paths.root().display().to_string(),
        window_mode: core.config.ui.window_mode.clone(),
        font_size: core.config.ui.font_size,
    }
}

/// A stored message, for restoring the conversation on startup.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredLine {
    pub role: String,
    pub content: String,
}

/// Restores the tail of the previous conversation.
///
/// Only the last few turns: loading everything would fill the context
/// budget before the user typed a word.
#[tauri::command]
pub fn load_history(state: State<AppState>) -> Vec<StoredLine> {
    const RESTORE: usize = 20;

    let stored = AppState::lock(&state.store).recent_messages(RESTORE);
    let Ok(messages) = stored else {
        return Vec::new();
    };

    let mut history = AppState::lock(&state.history);
    let mut out = Vec::new();

    for m in messages {
        let role = match m.role.as_str() {
            "user" => vavis_brain::Role::User,
            "assistant" => vavis_brain::Role::Assistant,
            _ => continue, // tool and system messages are not replayed
        };

        history.push(Message {
            role,
            content: m.content.clone(),
            tool_call_id: None,
            tool_calls: None,
            image: None,
        });
        out.push(StoredLine {
            role: m.role,
            content: m.content,
        });
    }

    out
}

/// Sends a message to the model.
///
/// Returns immediately; progress arrives as events:
///
/// | Event | Payload |
/// |---|---|
/// | `chat:delta` | `{ text }` — a chunk of the reply |
/// | `chat:tool-start` | `{ tool }` |
/// | `chat:tool-done` | `{ tool, ok, summary }` |
/// | `chat:approval` | `{ tool, args, reason }` |
/// | `chat:done` | `{ text }` |
/// | `chat:error` | `{ message }` |
#[tauri::command]
pub fn send_message(
    app: tauri::AppHandle,
    state: State<AppState>,
    text: String,
) -> Result<(), String> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("empty message".into());
    }

    if !state.try_claim() {
        return Err("a reply is already in progress".into());
    }

    let (cfg, system, history) = {
        let core = AppState::lock(&state.core);
        let keys = AppState::lock(&state.keys);

        let provider = Provider::parse(&core.config.llm.provider).unwrap_or(Provider::Groq);
        let key = keys
            .get(provider.key_name())
            .unwrap_or_default()
            .to_string();

        if provider.needs_key() && key.is_empty() {
            state.release();
            return Err(format!("no API key for {provider}"));
        }

        let model = if core.config.llm.model.trim().is_empty() {
            provider.default_model().to_string()
        } else {
            core.config.llm.model.clone()
        };

        // The system prompt is rebuilt each turn so a settings change
        // takes effect on the very next message.
        let system = Message::system(system_prompt(
            &core.config.general.assistant_name,
            &core.config.general.language,
        ));

        let mut history = AppState::lock(&state.history);
        history.push(Message::user(text.clone()));

        (
            ChatConfig::new(provider, model, key),
            system,
            history.clone(),
        )
    };

    // Persist the user's turn before the request goes out — if the app
    // dies mid-reply the question is still on record.
    if let Err(e) = AppState::lock(&state.store).add_message("user", &text) {
        tracing::warn!(%e, "could not persist message");
    }

    let client = state.client.clone();
    let agent = state.agent.clone();
    let busy = state.busy.clone();
    let approval_rx = state.approval_rx.clone();
    let voice = state.voice.clone();
    let store = state.store.clone();
    let history_handle = state.history.clone();

    std::thread::spawn(move || {
        let runtime = match tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
        {
            Ok(r) => r,
            Err(e) => {
                let _ = app.emit(
                    "chat:error",
                    ErrorPayload {
                        message: e.to_string(),
                    },
                );
                busy.store(false, Ordering::SeqCst);
                return;
            }
        };

        let result = runtime.block_on(run_turn(
            &app,
            &client,
            &agent,
            &approval_rx,
            &cfg,
            system,
            history,
            &text,
        ));

        match result {
            Ok(reply) => {
                if !reply.trim().is_empty() {
                    AppState::lock(&history_handle).push(Message::assistant(reply.clone()));
                    if let Err(e) = AppState::lock(&store).add_message("assistant", &reply) {
                        tracing::warn!(%e, "could not persist reply");
                    }
                    AppState::lock(&voice).speak(&reply);
                }
                let _ = app.emit("chat:done", DonePayload { text: reply });
            }
            Err(message) => {
                // Drop the unanswered user turn: leaving it would produce
                // two user messages in a row on the next request.
                let mut h = AppState::lock(&history_handle);
                if h.last().map(|m| m.role) == Some(vavis_brain::Role::User) {
                    h.pop();
                }
                let _ = app.emit("chat:error", ErrorPayload { message });
            }
        }

        busy.store(false, Ordering::SeqCst);
    });

    Ok(())
}

#[derive(Serialize, Clone)]
struct DeltaPayload {
    text: String,
}
#[derive(Serialize, Clone)]
struct DonePayload {
    text: String,
}
#[derive(Serialize, Clone)]
struct ErrorPayload {
    message: String,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ToolStartPayload {
    tool: String,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ToolDonePayload {
    tool: String,
    ok: bool,
    summary: String,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ApprovalPayload {
    tool: String,
    args: String,
    reason: String,
}

/// One full turn: model → tools → model → … → reply.
#[allow(clippy::too_many_arguments)]
async fn run_turn(
    app: &tauri::AppHandle,
    client: &vavis_brain::BrainClient,
    agent: &std::sync::Arc<std::sync::Mutex<vavis_tools::Agent>>,
    approval_rx: &std::sync::Arc<std::sync::Mutex<std::sync::mpsc::Receiver<Approval>>>,
    cfg: &ChatConfig,
    system: Message,
    history: Vec<Message>,
    user_message: &str,
) -> Result<String, String> {
    let tools = {
        let mut guard = AppState::lock(agent);
        guard.start_run();
        guard.tools_for(user_message)
    };
    tracing::info!(count = tools.len(), "tools offered for this request");

    let mut messages = vec![system];
    messages.extend(history);
    let mut final_text = String::new();

    for step in 0..MAX_STEPS {
        let emit = app.clone();

        let response = client
            .chat_stream_with_tools(cfg, messages.clone(), &tools, move |event| {
                if let StreamEvent::Delta(text) = event {
                    let _ = emit.emit("chat:delta", DeltaPayload { text });
                }
            })
            .await
            .map_err(|e| friendly_error(&e))?;

        if !response.text.is_empty() {
            final_text = response.text.clone();
        }

        if response.tool_calls.is_empty() {
            return Ok(final_text);
        }

        // Echo the model's tool request back, so the provider can match
        // results to calls on the next turn.
        messages.push(Message {
            role: vavis_brain::Role::Assistant,
            content: response.text.clone(),
            tool_call_id: None,
            tool_calls: Some(response.tool_calls.clone()),
            image: None,
        });

        let mut host = EventHost {
            app: app.clone(),
            approval_rx: approval_rx.clone(),
        };

        let results = {
            let mut guard = AppState::lock(agent);
            guard.execute_calls(&response.tool_calls, &mut host)
        };
        messages.extend(results);

        // A screenshot tool puts its image in a side channel — tool
        // results must be text, so it cannot ride along with them.
        if let Some(image) = vavis_tools::builtin::vision::take_pending_image() {
            messages.push(Message::user_with_image("(screenshot attached)", image));
        }

        if step == MAX_STEPS - 1 {
            return Err(format!("no answer after {MAX_STEPS} steps"));
        }
    }

    Ok(final_text)
}

/// Bridges the agent to the interface: emits events, waits for approvals.
struct EventHost {
    app: tauri::AppHandle,
    approval_rx: std::sync::Arc<std::sync::Mutex<std::sync::mpsc::Receiver<Approval>>>,
}

impl AgentHost for EventHost {
    fn ask_approval(&mut self, tool: &str, args: &str, reason: ApprovalReason) -> Approval {
        let _ = self.app.emit(
            "chat:approval",
            ApprovalPayload {
                tool: tool.to_string(),
                args: args.to_string(),
                reason: match reason {
                    ApprovalReason::RiskLevel => "risk".into(),
                    ApprovalReason::BudgetExceeded => "budget".into(),
                },
            },
        );

        // Block this thread — not the interface's. The dialog is drawn by
        // the frontend, which is a separate process entirely.
        let Ok(rx) = self.approval_rx.lock() else {
            return Approval::Deny;
        };
        rx.recv().unwrap_or(Approval::Deny)
    }

    fn on_tool_start(&mut self, tool: &str, _args: &str) {
        let _ = self.app.emit(
            "chat:tool-start",
            ToolStartPayload {
                tool: tool.to_string(),
            },
        );
    }

    fn on_tool_result(&mut self, tool: &str, outcome: &ToolOutcome) {
        // Only a summary reaches the interface; the full text goes to the
        // model and would flood the feed.
        let summary: String = outcome.content.chars().take(160).collect();
        let _ = self.app.emit(
            "chat:tool-done",
            ToolDonePayload {
                tool: tool.to_string(),
                ok: outcome.ok,
                summary,
            },
        );
    }
}

/// Turns a provider error into something the user can act on.
fn friendly_error(err: &vavis_brain::BrainError) -> String {
    use vavis_brain::BrainError as E;
    match err {
        E::MissingKey { provider } => format!("No API key for {provider}."),
        E::Api { status: 401, .. } => "API key rejected — update it in settings.".into(),
        E::Api { status: 429, .. } => "Rate limited — wait a moment and try again.".into(),
        E::Api { status: 404, .. } => "Model not found — pick another one.".into(),
        E::Api { status, body } if *status == 413 || body.contains("too long") => {
            "Request too long — clear the conversation.".into()
        }
        E::Api { status, body } => format!("Provider error {status}: {body}"),
        E::Network(e) if e.is_timeout() => "Timed out — the provider did not respond.".into(),
        E::Network(e) if e.is_connect() => "Could not connect — check your network.".into(),
        E::Network(e) => format!("Network error: {e}"),
        E::Parse(e) => format!("Could not read the response: {e}"),
    }
}

/// Answers a pending approval dialog.
#[tauri::command]
pub fn answer_approval(state: State<AppState>, decision: String) {
    let approval = match decision.as_str() {
        "allow" => Approval::Allow,
        "always" => Approval::AllowAlways,
        _ => Approval::Deny,
    };
    let _ = state.approval_tx.send(approval);
}

/// Clears the conversation. Remembered facts survive — a user who saved
/// something with "remember this" must not lose it to a clear.
#[tauri::command]
pub fn clear_conversation(state: State<AppState>) -> Result<(), String> {
    AppState::lock(&state.history).clear();
    AppState::lock(&state.store)
        .clear_messages()
        .map_err(|e| e.to_string())
}

/// Stores an API key, encrypted.
#[tauri::command]
pub fn set_key(state: State<AppState>, provider: String, key: String) -> Result<(), String> {
    let Some(provider) = Provider::parse(&provider) else {
        return Err(format!("unknown provider: {provider}"));
    };

    let mut keys = AppState::lock(&state.keys);
    keys.set(provider.key_name(), key);

    // Speech recognition runs on Groq too — keep it in step.
    if provider == Provider::Groq {
        if let Some(k) = keys.get("groq") {
            AppState::lock(&state.voice).set_api_key(k.to_string());
        }
    }

    let root = AppState::lock(&state.core).paths.root().to_path_buf();
    keys.save(&root).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_provider(state: State<AppState>, provider: String) -> Result<String, String> {
    let Some(provider) = Provider::parse(&provider) else {
        return Err(format!("unknown provider: {provider}"));
    };

    let mut core = AppState::lock(&state.core);
    core.config.llm.provider = provider.key_name().to_string();
    // Models are provider-specific: keeping the old name would 404.
    core.config.llm.model = provider.default_model().to_string();
    core.config.save(&core.paths).map_err(|e| e.to_string())?;

    Ok(provider.default_model().to_string())
}

#[tauri::command]
pub fn set_model(state: State<AppState>, model: String) -> Result<(), String> {
    let mut core = AppState::lock(&state.core);
    core.config.llm.model = model;
    core.config.save(&core.paths).map_err(|e| e.to_string())
}

/// Fetches the provider's live model list.
#[tauri::command]
pub async fn list_models(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let (provider, key, client) = {
        let core = AppState::lock(&state.core);
        let keys = AppState::lock(&state.keys);
        let provider = Provider::parse(&core.config.llm.provider).unwrap_or(Provider::Groq);
        (
            provider,
            keys.get(provider.key_name())
                .unwrap_or_default()
                .to_string(),
            state.client.clone(),
        )
    };

    client
        .list_models(provider, &key)
        .await
        .map_err(|e| friendly_error(&e))
}

/// Updates one setting.
#[tauri::command]
pub fn set_setting(state: State<AppState>, field: String, value: String) -> Result<(), String> {
    let mut core = AppState::lock(&state.core);

    match field.as_str() {
        "name" => core.config.general.assistant_name = value,
        "language" => {
            if vavis_core::Lang::parse(&value).is_none() {
                return Err("language must be one of: en, tr, de, fr, es".into());
            }
            core.config.general.language = value.clone();
            AppState::lock(&state.voice).set_language(value);
        }
        "fontSize" => {
            let size: f32 = value.parse().map_err(|_| "font size must be a number")?;
            if !(8.0..=32.0).contains(&size) {
                return Err("font size must be between 8 and 32".into());
            }
            core.config.ui.font_size = size;
        }
        "windowMode" => {
            if !["windowed", "borderless", "fullscreen"].contains(&value.as_str()) {
                return Err("window mode: windowed, borderless or fullscreen".into());
            }
            core.config.ui.window_mode = value;
        }
        other => return Err(format!("unknown setting: {other}")),
    }

    core.config.save(&core.paths).map_err(|e| e.to_string())
}

/// Cycles the voice mode, returning the new one.
#[tauri::command]
pub fn cycle_voice(state: State<AppState>) -> Result<String, String> {
    let mode = AppState::lock(&state.voice).cycle_mode()?;
    Ok(crate::voice::mode_name(mode).to_string())
}

/// Barge-in: stops speech immediately.
#[tauri::command]
pub fn stop_speaking(state: State<AppState>) {
    AppState::lock(&state.voice).stop_speaking();
}

/// Drains queued voice events.
#[tauri::command]
pub fn poll_voice(state: State<AppState>) -> Vec<crate::voice::VoiceEvent> {
    AppState::lock(&state.voice).poll()
}

/// A remembered fact.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FactView {
    pub id: i64,
    pub text: String,
}

#[tauri::command]
pub fn list_facts(state: State<AppState>) -> Vec<FactView> {
    AppState::lock(&state.store)
        .all_facts()
        .unwrap_or_default()
        .into_iter()
        .map(|f| FactView {
            id: f.id,
            text: f.text,
        })
        .collect()
}

#[tauri::command]
pub fn forget_fact(state: State<AppState>, id: i64) -> Result<bool, String> {
    AppState::lock(&state.store)
        .delete_fact(id)
        .map_err(|e| e.to_string())
}

/// A scheduled or conditional automation.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationView {
    pub id: i64,
    pub prompt: String,
    pub trigger: String,
    pub enabled: bool,
}

#[tauri::command]
pub fn list_automations(state: State<AppState>) -> Vec<AutomationView> {
    AppState::lock(&state.store)
        .all_automations()
        .unwrap_or_default()
        .into_iter()
        .map(|a| AutomationView {
            id: a.id,
            prompt: a.prompt,
            trigger: a.trigger.describe(),
            enabled: a.enabled,
        })
        .collect()
}

#[tauri::command]
pub fn delete_automation(state: State<AppState>, id: i64) -> Result<bool, String> {
    AppState::lock(&state.store)
        .delete_automation(id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_automation(state: State<AppState>, id: i64, enabled: bool) -> Result<bool, String> {
    AppState::lock(&state.store)
        .set_automation_enabled(id, enabled)
        .map_err(|e| e.to_string())
}

/// A registered tool, for the tools panel.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolView {
    pub name: String,
    pub description: String,
    pub domain: String,
    pub risk: String,
}

#[tauri::command]
pub fn list_tools(state: State<AppState>) -> Vec<ToolView> {
    AppState::lock(&state.agent)
        .registry
        .iter()
        .map(|t| ToolView {
            name: t.name().to_string(),
            description: t.description().to_string(),
            domain: t.domain().name().to_string(),
            risk: match t.risk() {
                vavis_tools::Risk::Safe => "safe",
                vavis_tools::Risk::Moderate => "moderate",
                vavis_tools::Risk::Destructive => "destructive",
            }
            .to_string(),
        })
        .collect()
}
