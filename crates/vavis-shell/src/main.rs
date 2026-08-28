//! VAVIS — entry point.
//!
//! Wires the four logic crates to a Tauri window. The interface itself is
//! Svelte, living in `ui/`; this file owns process startup, the command
//! surface, and the background ticker.

// No console window in release builds. Debug keeps one — that is where
// tracing output goes while developing.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;
mod voice;

use state::AppState;
use tauri::{Emitter, Manager};
use vavis_core::{App as CoreApp, Paths};

fn main() {
    let paths = match Paths::discover() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("could not determine the data directory: {e}");
            std::process::exit(1);
        }
    };

    // Held for the process lifetime: dropping it stops the log writer.
    let _log_guard = vavis_core::logging::init(&paths);
    install_panic_hook(&paths);

    let core = match CoreApp::boot(paths) {
        Ok(core) => core,
        Err(e) => {
            tracing::error!(%e, "startup failed");
            std::process::exit(1);
        }
    };

    let window_mode = core.config.window_mode();

    let app_state = match AppState::new(core) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(%e, "could not build application state");
            std::process::exit(1);
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::load_history,
            commands::send_message,
            commands::answer_approval,
            commands::clear_conversation,
            commands::set_key,
            commands::set_provider,
            commands::set_model,
            commands::list_models,
            commands::set_setting,
            commands::cycle_voice,
            commands::stop_speaking,
            commands::poll_voice,
            commands::list_facts,
            commands::forget_fact,
            commands::list_automations,
            commands::delete_automation,
            commands::toggle_automation,
            commands::list_tools,
        ])
        .setup(move |app| {
            apply_window_mode(app.handle(), window_mode);
            start_ticker(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            tracing::error!(%e, "the interface failed to start");
            std::process::exit(1);
        });

    tracing::info!("vavis closed");
}

/// Applies the saved window mode at startup.
fn apply_window_mode(app: &tauri::AppHandle, mode: vavis_core::WindowMode) {
    use vavis_core::WindowMode;

    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    // The interface draws its own title strip, so the OS decorations stay
    // off in every mode — turning them on gives two title bars.
    match mode {
        WindowMode::Windowed => {}
        WindowMode::Borderless => {
            let _ = window.maximize();
        }
        WindowMode::Fullscreen => {
            let _ = window.set_fullscreen(true);
        }
    }
    tracing::info!(?mode, "window opened");
}

/// Background ticker: fires automations and forwards voice events.
///
/// Runs on its own thread rather than a UI timer, so it keeps working
/// while the window is minimised — a scheduled automation must not be
/// missed because nobody was looking.
fn start_ticker(app: tauri::AppHandle) {
    use vavis_core::Trigger;

    std::thread::spawn(move || {
        let mut last_automation_check = std::time::Instant::now();

        loop {
            std::thread::sleep(std::time::Duration::from_millis(250));

            let Some(state) = app.try_state::<AppState>() else {
                return; // shutting down
            };

            // Voice events are latency-sensitive: poll them often.
            let events = AppState::lock(&state.voice).poll();
            for event in events {
                let _ = app.emit("voice", event);
            }

            // Automations only need minute resolution.
            if last_automation_check.elapsed().as_secs() < 60 {
                continue;
            }
            last_automation_check = std::time::Instant::now();

            let now = chrono::Utc::now().timestamp();
            let local = chrono::Local::now();
            let (hour, minute) = {
                use chrono::Timelike;
                (local.hour(), local.minute())
            };

            let battery = vavis_tools::builtin::system::battery_percent();
            let cpu = vavis_tools::builtin::system::cpu_percent();

            let due: Vec<_> = {
                let store = AppState::lock(&state.store);
                store
                    .all_automations()
                    .unwrap_or_default()
                    .into_iter()
                    .filter(|a| {
                        let measurement = match a.trigger {
                            Trigger::BatteryBelow { .. } => battery,
                            Trigger::CpuAbove { .. } => cpu,
                            _ => None,
                        };
                        a.should_fire(now, hour, minute, measurement)
                    })
                    .collect()
            };

            for automation in due {
                tracing::info!(id = automation.id, "automation fired");

                // Mark it fired before dispatching: if the send fails, the
                // automation must not retry every tick.
                {
                    let store = AppState::lock(&state.store);
                    let _ = store.mark_automation_fired(automation.id, now);
                }

                let _ = app.emit(
                    "automation",
                    serde_json::json!({
                        "id": automation.id,
                        "prompt": automation.prompt,
                        "trigger": automation.trigger.describe(),
                    }),
                );
            }
        }
    });
}

/// Writes panics to the log.
///
/// Release builds have no console, so without this a panic would vanish
/// and the user would only see the window disappear.
fn install_panic_hook(paths: &Paths) {
    let log_dir = paths.log_dir();
    let default_hook = std::panic::take_hook();

    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown".into());

        let message = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| (*s).to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "no reason given".into());

        tracing::error!(location, message, "PANIC");

        // The logging pipeline may itself be broken; write a plain file too.
        let entry = format!("[{}] {location}\n{message}\n\n", timestamp());
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_dir.join("crash.log"))
            .and_then(|mut f| {
                use std::io::Write;
                f.write_all(entry.as_bytes())
            });

        default_hook(info);
    }));
}

fn timestamp() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}
