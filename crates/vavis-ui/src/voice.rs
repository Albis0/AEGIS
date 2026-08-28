//! Ses yöneticisi — mikrofon, STT ve TTS'i UI'ya bağlar.
//!
//! Her şey arka plan thread'lerinde koşar; UI sadece kanal boşaltır.
//!
//! # Barge-in
//!
//! ESC → [`VoiceManager::stop_speaking`] → kuyruk temizlenir **ve** çalan ses
//! kesilir. Sıradaki cümlenin başlaması yapısal olarak imkânsız
//! (bkz. `vavis_audio::queue`).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::Arc;
use vavis_audio::{
    contains_wake_word, split_sentences, strip_wake_word, Microphone, SpeechQueue, SttClient,
    TtsConfig, TtsEngine, VoiceMode,
};

/// Ses katmanından UI'ya gelen olaylar.
#[derive(Debug, Clone)]
pub enum VoiceEvent {
    /// Kullanıcı konuştu, metne çevrildi — LLM'e gönderilmeli.
    Heard(String),
    /// Uyandırma kelimesi duyuldu ama istek boş ("Vavis" deyip susmuş).
    Woke,
    /// Bilgi/hata mesajı.
    Notice(String),
    /// Konuşma başladı/bitti — arayüz göstergesi için.
    SpeakingChanged(bool),
}

pub struct VoiceManager {
    mode: VoiceMode,
    mic: Option<Microphone>,

    queue: SpeechQueue,
    tts: Arc<TtsEngine>,
    /// TTS konuşurken true — mikrofon susturulur.
    speaking: Arc<AtomicBool>,

    runtime: tokio::runtime::Runtime,
    stt: Arc<SttClient>,

    tx: Sender<VoiceEvent>,
    rx: Receiver<VoiceEvent>,

    /// Whisper için Groq anahtarı.
    api_key: String,
    language: String,
    wake_word: String,
}

impl VoiceManager {
    pub fn new(wake_word: String, language: String) -> std::io::Result<Self> {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(1)
            .enable_all()
            .build()?;

        let (tx, rx) = std::sync::mpsc::channel();

        Ok(Self {
            mode: VoiceMode::Off,
            mic: None,
            queue: SpeechQueue::new(),
            tts: Arc::new(TtsEngine::new(TtsConfig::default())),
            speaking: Arc::new(AtomicBool::new(false)),
            runtime,
            stt: Arc::new(SttClient::new()),
            tx,
            rx,
            api_key: String::new(),
            language,
            wake_word,
        })
    }

    pub fn mode(&self) -> VoiceMode {
        self.mode
    }

    pub fn set_api_key(&mut self, key: String) {
        self.api_key = key;
    }

    pub fn is_speaking(&self) -> bool {
        self.speaking.load(Ordering::Relaxed)
    }

    /// M tuşu: modu ilerlet. Mikrofonu gerektiğinde açar/kapatır.
    pub fn cycle_mode(&mut self) -> VoiceMode {
        self.set_mode(self.mode.next());
        self.mode
    }

    pub fn set_mode(&mut self, mode: VoiceMode) {
        if mode == self.mode {
            return;
        }
        self.mode = mode;

        if mode.is_listening() {
            if self.mic.is_none() {
                match Microphone::start() {
                    Ok(mic) => {
                        self.mic = Some(mic);
                        tracing::info!(?mode, "mikrofon açıldı");
                    }
                    Err(e) => {
                        let _ = self.tx.send(VoiceEvent::Notice(format!("mikrofon açılamadı: {e}")));
                        self.mode = VoiceMode::Off;
                        return;
                    }
                }
            }
        } else {
            // Mikrofonu bırak — Drop akışı durdurur.
            self.mic = None;
            self.stop_speaking();
        }
    }

    /// **Barge-in.** Konuşmayı anında keser.
    ///
    /// Sıra önemli: önce kuyruk (yeni parça başlayamasın), sonra çalan ses.
    pub fn stop_speaking(&self) {
        self.queue.stop();
        self.tts.stop();
        self.speaking.store(false, Ordering::Relaxed);
        if let Some(mic) = &self.mic {
            mic.set_muted(false);
        }
        let _ = self.tx.send(VoiceEvent::SpeakingChanged(false));
    }

    /// Asistanın cevabını seslendirir.
    ///
    /// Metin cümlelere bölünür; ilk cümle hazır olur olmaz çalar — tüm cevabı
    /// beklemek yok. Kullanıcının "TTS gecikmeli" şikayetinin çaresi bu.
    pub fn speak(&self, text: &str, ctx: Option<egui::Context>) {
        if self.mode == VoiceMode::Off || text.trim().is_empty() {
            return;
        }

        self.tts.reset();
        for piece in split_sentences(text) {
            self.queue.push(piece);
        }
        self.drain_queue(ctx);
    }

    /// Kuyruktaki parçaları sırayla seslendirir.
    fn drain_queue(&self, ctx: Option<egui::Context>) {
        let Some(utterance) = self.queue.next() else {
            return; // ya boş ya da zaten konuşuluyor
        };

        let queue = self.queue.clone();
        let tts = self.tts.clone();
        let speaking = self.speaking.clone();
        let tx = self.tx.clone();
        // Konuşurken kendi sesimizi duymamak için mikrofonu sustur.
        let muted = self.mic.as_ref().map(|_| ());

        speaking.store(true, Ordering::Relaxed);
        let _ = tx.send(VoiceEvent::SpeakingChanged(true));

        std::thread::spawn(move || {
            let generation = utterance.generation;

            if let Err(e) = tts.speak(&utterance.text) {
                tracing::warn!(%e, "seslendirme başarısız");
            }

            // Nesil değiştiyse (barge-in oldu) hiçbir şey yapma.
            if generation != queue.generation() {
                return;
            }

            queue.finished(generation);

            // Sıradaki parça varsa devam et.
            if queue.pending_count() > 0 {
                // Özyineleme yerine döngü: yığın taşmasın.
                while let Some(next) = queue.next() {
                    if next.generation != queue.generation() {
                        break;
                    }
                    if tts.speak(&next.text).is_err() {
                        break;
                    }
                    queue.finished(next.generation);
                }
            }

            speaking.store(false, Ordering::Relaxed);
            let _ = tx.send(VoiceEvent::SpeakingChanged(false));
            if let Some(c) = &ctx {
                c.request_repaint();
            }
            let _ = muted;
        });
    }

    /// Her karede çağrılır: mikrofonu yoklar, konuşmaları metne çevirir.
    pub fn poll(&mut self, ctx: Option<egui::Context>) -> Vec<VoiceEvent> {
        // Mikrofonu TTS konuşurken sustur — asistan kendini duymasın.
        if let Some(mic) = &self.mic {
            let should_mute = self.is_speaking();
            if mic.is_muted() != should_mute {
                mic.set_muted(should_mute);
            }

            for utterance in mic.poll() {
                self.transcribe(utterance, ctx.clone());
            }
        }

        self.rx.try_iter().collect()
    }

    /// Bir konuşmayı arka planda metne çevirir.
    fn transcribe(&self, utterance: vavis_audio::Utterance, ctx: Option<egui::Context>) {
        if self.api_key.trim().is_empty() {
            let _ = self.tx.send(VoiceEvent::Notice(
                "STT için Groq anahtarı gerekli → /key groq <anahtar>".into(),
            ));
            return;
        }

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
                    tracing::warn!(%e, "tanıma başarısız");
                    let _ = tx.send(VoiceEvent::Notice(format!("ses tanınamadı: {e}")));
                    return;
                }
            };

            if text.trim().is_empty() {
                return; // sessizlik veya halüsinasyon filtrelendi
            }

            let event = match mode {
                VoiceMode::WakeWord => {
                    if !contains_wake_word(&text, &wake_word) {
                        return; // bize hitap edilmedi
                    }
                    let request = strip_wake_word(&text, &wake_word);
                    if request.is_empty() {
                        VoiceEvent::Woke
                    } else {
                        VoiceEvent::Heard(request)
                    }
                }
                VoiceMode::Continuous => VoiceEvent::Heard(text),
                VoiceMode::Off => return,
            };

            let _ = tx.send(event);
            if let Some(c) = ctx {
                c.request_repaint();
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manager() -> VoiceManager {
        VoiceManager::new("vavis".into(), "tr".into()).unwrap()
    }

    #[test]
    fn starts_muted_and_idle() {
        let vm = manager();
        assert_eq!(vm.mode(), VoiceMode::Off);
        assert!(!vm.is_speaking());
    }

    #[test]
    fn speaking_is_a_no_op_when_voice_is_off() {
        let vm = manager();
        vm.speak("bir şeyler", None);
        assert!(!vm.is_speaking(), "ses kapalıyken konuşmamalı");
        assert_eq!(vm.queue.pending_count(), 0);
    }

    #[test]
    fn stop_speaking_clears_the_queue() {
        let vm = manager();
        vm.queue.push("bir");
        vm.queue.push("iki");

        vm.stop_speaking();

        assert_eq!(vm.queue.pending_count(), 0);
        assert!(!vm.is_speaking());
    }

    #[test]
    fn stop_speaking_is_safe_when_nothing_is_playing() {
        let vm = manager();
        vm.stop_speaking();
        vm.stop_speaking();
        assert!(!vm.is_speaking());
    }

    #[test]
    fn api_key_can_be_updated() {
        let mut vm = manager();
        assert!(vm.api_key.is_empty());
        vm.set_api_key("gsk_test".into());
        assert_eq!(vm.api_key, "gsk_test");
    }

    #[test]
    fn events_are_drained_in_order() {
        let mut vm = manager();
        vm.tx.send(VoiceEvent::Notice("bir".into())).unwrap();
        vm.tx.send(VoiceEvent::Notice("iki".into())).unwrap();

        let events = vm.poll(None);
        assert_eq!(events.len(), 2);
        assert!(matches!(&events[0], VoiceEvent::Notice(m) if m == "bir"));
    }

    #[test]
    fn setting_the_same_mode_twice_is_harmless() {
        let mut vm = manager();
        vm.set_mode(VoiceMode::Off);
        assert_eq!(vm.mode(), VoiceMode::Off);
    }
}
