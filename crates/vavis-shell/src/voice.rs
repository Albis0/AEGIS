//! Voice subsystem wiring.
//!
//! Wraps the pieces in `vavis-audio` and exposes them as something the
//! interface can drive: cycle the mode, speak a reply, stop mid-sentence.
//!
//! # Barge-in
//!
//! [`VoiceState::stop_speaking`] clears the queue *before* stopping
//! playback, and nothing in between can restart it. The predecessor
//! project had this backwards — its stop call synchronously drained the
//! queue, which started the next sentence.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::Arc;
use vavis_audio::{
    contains_wake_word, split_sentences, strip_wake_word, Microphone, SpeechQueue, SttClient,
    TtsConfig, TtsEngine, VoiceMode,
};

/// Something the voice layer wants the interface to know.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum VoiceEvent {
    /// Speech was recognised and should be sent to the model.
    Heard { text: String },
    /// The wake word was heard with no request after it.
    Woke,
    /// Informational message for the feed.
    Notice { text: String },
    /// Speaking started or stopped — drives the core animation.
    Speaking { active: bool },
}

pub struct VoiceState {
    mode: VoiceMode,
    mic: Option<Microphone>,
    queue: SpeechQueue,
    tts: Arc<TtsEngine>,
    speaking: Arc<AtomicBool>,
    runtime: tokio::runtime::Runtime,
    stt: Arc<SttClient>,
    tx: Sender<VoiceEvent>,
    rx: Receiver<VoiceEvent>,
    api_key: String,
    language: String,
    wake_word: String,
}

impl VoiceState {
    pub fn new(wake_word: String, language: String, api_key: String) -> Self {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(1)
            .enable_all()
            .build()
            .expect("tokio runtime");

        let (tx, rx) = std::sync::mpsc::channel();

        Self {
            mode: VoiceMode::Off,
            mic: None,
            queue: SpeechQueue::new(),
            tts: Arc::new(TtsEngine::new(TtsConfig::default())),
            speaking: Arc::new(AtomicBool::new(false)),
            runtime,
            stt: Arc::new(SttClient::new()),
            tx,
            rx,
            api_key,
            language,
            wake_word,
        }
    }

    pub fn mode(&self) -> VoiceMode {
        self.mode
    }

    pub fn is_speaking(&self) -> bool {
        self.speaking.load(Ordering::Relaxed)
    }

    pub fn set_api_key(&mut self, key: String) {
        self.api_key = key;
    }

    pub fn set_language(&mut self, language: String) {
        self.language = language;
    }

    /// Advances to the next mode, opening or releasing the microphone.
    ///
    /// Returns an error string if the microphone could not be opened —
    /// the caller surfaces it rather than failing silently.
    pub fn cycle_mode(&mut self) -> Result<VoiceMode, String> {
        self.set_mode(self.mode.next())
    }

    pub fn set_mode(&mut self, mode: VoiceMode) -> Result<VoiceMode, String> {
        if mode == self.mode {
            return Ok(mode);
        }

        if mode.is_listening() {
            if self.api_key.trim().is_empty() {
                return Err("speech recognition needs a Groq key".into());
            }
            if self.mic.is_none() {
                match Microphone::start() {
                    Ok(mic) => self.mic = Some(mic),
                    Err(e) => return Err(format!("microphone: {e}")),
                }
            }
        } else {
            // Dropping the handle stops the capture thread.
            self.mic = None;
            self.stop_speaking();
        }

        self.mode = mode;
        Ok(mode)
    }

    /// **Barge-in.** Cuts speech immediately.
    ///
    /// Order matters: clear the queue first so no further utterance can
    /// start, then stop what is playing.
    pub fn stop_speaking(&self) {
        self.queue.stop();
        self.tts.stop();
        self.speaking.store(false, Ordering::Relaxed);
        if let Some(mic) = &self.mic {
            mic.set_muted(false);
        }
        let _ = self.tx.send(VoiceEvent::Speaking { active: false });
    }

    /// Speaks a reply.
    ///
    /// The text is split into sentences so the first one starts playing
    /// while the rest is still being synthesised — waiting for the whole
    /// answer made speech feel late.
    pub fn speak(&self, text: &str) {
        if self.mode == VoiceMode::Off || text.trim().is_empty() {
            return;
        }

        self.tts.reset();
        for piece in split_sentences(text) {
            self.queue.push(piece);
        }
        self.drain();
    }

    fn drain(&self) {
        let Some(utterance) = self.queue.next() else {
            return; // empty, or already speaking
        };

        let queue = self.queue.clone();
        let tts = self.tts.clone();
        let speaking = self.speaking.clone();
        let tx = self.tx.clone();

        speaking.store(true, Ordering::Relaxed);
        let _ = tx.send(VoiceEvent::Speaking { active: true });

        std::thread::spawn(move || {
            let generation = utterance.generation;

            if let Err(e) = tts.speak(&utterance.text) {
                tracing::warn!(%e, "speech synthesis failed");
            }

            // A barge-in bumped the generation while we were speaking:
            // everything after this point belongs to a cancelled turn.
            if generation != queue.generation() {
                return;
            }
            queue.finished(generation);

            // Loop rather than recurse — a long answer would otherwise
            // grow the stack one sentence at a time.
            while let Some(next) = queue.next() {
                if next.generation != queue.generation() {
                    break;
                }
                if tts.speak(&next.text).is_err() {
                    break;
                }
                queue.finished(next.generation);
            }

            speaking.store(false, Ordering::Relaxed);
            let _ = tx.send(VoiceEvent::Speaking { active: false });
        });
    }

    /// Polls the microphone and drains pending events.
    ///
    /// Called on a timer by the shell; returns whatever has accumulated.
    pub fn poll(&mut self) -> Vec<VoiceEvent> {
        if let Some(mic) = &self.mic {
            // Mute the microphone while speaking, or the assistant hears
            // itself and answers its own voice.
            let should_mute = self.is_speaking();
            if mic.is_muted() != should_mute {
                mic.set_muted(should_mute);
            }

            for utterance in mic.poll() {
                self.transcribe(utterance);
            }
        }
        self.rx.try_iter().collect()
    }

    fn transcribe(&self, utterance: vavis_audio::Utterance) {
        let stt = self.stt.clone();
        let tx = self.tx.clone();
        let key = self.api_key.clone();
        let language = self.language.clone();
        let wake_word = self.wake_word.clone();
        let mode = self.mode;

        self.runtime.spawn(async move {
            let text = match stt.transcribe(&utterance, &key, &language).await {
                Ok(t) => t,
                Err(e) => {
                    let _ = tx.send(VoiceEvent::Notice {
                        text: format!("speech not recognised: {e}"),
                    });
                    return;
                }
            };

            if text.trim().is_empty() {
                return; // silence, or a filtered hallucination
            }

            let event = match mode {
                VoiceMode::WakeWord => {
                    if !contains_wake_word(&text, &wake_word) {
                        return; // not addressed to us
                    }
                    let request = strip_wake_word(&text, &wake_word);
                    if request.is_empty() {
                        VoiceEvent::Woke
                    } else {
                        VoiceEvent::Heard { text: request }
                    }
                }
                VoiceMode::Continuous => VoiceEvent::Heard { text },
                VoiceMode::Off => return,
            };

            let _ = tx.send(event);
        });
    }
}

/// Mode name for the interface.
pub fn mode_name(mode: VoiceMode) -> &'static str {
    match mode {
        VoiceMode::Off => "off",
        VoiceMode::Continuous => "continuous",
        VoiceMode::WakeWord => "wake",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state() -> VoiceState {
        VoiceState::new("vavis".into(), "en".into(), String::new())
    }

    #[test]
    fn starts_off_and_silent() {
        let v = state();
        assert_eq!(v.mode(), VoiceMode::Off);
        assert!(!v.is_speaking());
    }

    #[test]
    fn listening_without_a_key_is_refused() {
        // Failing loudly beats opening a microphone that can never
        // transcribe anything.
        let mut v = state();
        let err = v.set_mode(VoiceMode::Continuous).unwrap_err();
        assert!(err.contains("Groq"));
        assert_eq!(v.mode(), VoiceMode::Off, "mode must not change on failure");
    }

    #[test]
    fn speaking_is_a_no_op_while_voice_is_off() {
        let v = state();
        v.speak("hello");
        assert!(!v.is_speaking());
    }

    #[test]
    fn stop_speaking_is_safe_when_idle() {
        let v = state();
        v.stop_speaking();
        v.stop_speaking();
        assert!(!v.is_speaking());
    }

    #[test]
    fn setting_the_same_mode_twice_is_harmless() {
        let mut v = state();
        assert_eq!(v.set_mode(VoiceMode::Off).unwrap(), VoiceMode::Off);
    }

    #[test]
    fn mode_names_are_distinct() {
        let names = [
            mode_name(VoiceMode::Off),
            mode_name(VoiceMode::Continuous),
            mode_name(VoiceMode::WakeWord),
        ];
        let mut sorted = names;
        sorted.sort_unstable();
        let before = sorted.len();
        let mut deduped = sorted.to_vec();
        deduped.dedup();
        assert_eq!(before, deduped.len());
    }

    #[test]
    fn events_drain_in_order() {
        let mut v = state();
        v.tx.send(VoiceEvent::Woke).unwrap();
        v.tx.send(VoiceEvent::Notice {
            text: "second".into(),
        })
        .unwrap();

        let events = v.poll();
        assert_eq!(events.len(), 2);
        assert!(matches!(events[0], VoiceEvent::Woke));
    }
}
