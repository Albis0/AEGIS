//! Konuşma kuyruğu ve barge-in.
//!
//! # Eski projedeki bug (bir daha olmayacak)
//!
//! Eski `App.tsx`'te ESC şöyle işleniyordu:
//!
//! ```text
//! stopSpeaking();              // ← bu, onSpeakEnd'i SENKRON çağırıyordu
//! ttsQueue.current = [];       //   → drainQueue() sıradaki cümleyi başlatmıştı
//! ```
//!
//! `stopSpeaking()` içindeki `onSpeakEndRef.current?.()` çağrısı kuyruk
//! boşaltıcısını tetikliyor, o da **sıradaki cümleyi çalmaya başlıyordu**.
//! Sonra 2. satır zaten boşalmış kuyruğu temizliyordu. Kullanıcının gördüğü:
//! *"o cümleyi kesiyor, noktanın bitiminden diğer cümleden devam ediyor."*
//!
//! # Buradaki çözüm
//!
//! Kuyruk ve oynatma durumu **tek bir kilit altında**. `stop()` çağrısı
//! atomiktir: iptal bayrağını kaldırır, kuyruğu boşaltır, sonra oynatmayı
//! durdurur. Geri çağırma yok, dolayısıyla yeniden başlatacak bir yol yok.
//!
//! `generation` sayacı: durdurulan bir konuşmanın geç gelen sesi, yeni
//! konuşmanın üstüne binemez.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

/// Seslendirilmeyi bekleyen bir parça.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Utterance {
    pub text: String,
    /// Hangi konuşma turuna ait — eski turun sesi yenisini bozmasın.
    pub generation: u64,
}

#[derive(Debug, Default)]
struct QueueState {
    pending: VecDeque<String>,
    /// Şu an bir parça çalıyor mu?
    speaking: bool,
}

/// Konuşma kuyruğu — barge-in güvenli.
#[derive(Clone)]
pub struct SpeechQueue {
    state: Arc<Mutex<QueueState>>,
    /// Her `stop()` bunu artırır; eski nesil sesler yok sayılır.
    generation: Arc<AtomicU64>,
}

impl Default for SpeechQueue {
    fn default() -> Self {
        Self::new()
    }
}

impl SpeechQueue {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(QueueState::default())),
            generation: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Şu anki konuşma nesli.
    pub fn generation(&self) -> u64 {
        self.generation.load(Ordering::SeqCst)
    }

    /// Bir parçayı kuyruğa ekler.
    pub fn push(&self, text: impl Into<String>) {
        let text = text.into();
        if text.trim().is_empty() {
            return;
        }
        let mut state = self.lock();
        state.pending.push_back(text);
    }

    /// Sıradaki parçayı alır ve "konuşuyor" durumuna geçer.
    ///
    /// Zaten konuşuluyorsa `None` döner — çift oynatma olmaz.
    pub fn next(&self) -> Option<Utterance> {
        let mut state = self.lock();
        if state.speaking {
            return None;
        }
        let text = state.pending.pop_front()?;
        state.speaking = true;
        Some(Utterance {
            text,
            generation: self.generation(),
        })
    }

    /// Bir parça bitti — sıradakine geçilebilir.
    ///
    /// `generation` eskiyse yok sayılır: durdurulmuş bir konuşmanın geç gelen
    /// "bitti" bildirimi, yeni konuşmayı bozmamalı.
    pub fn finished(&self, generation: u64) {
        if generation != self.generation() {
            tracing::debug!(generation, "eski nesil bitiş bildirimi yok sayıldı");
            return;
        }
        let mut state = self.lock();
        state.speaking = false;
    }

    /// **Barge-in.** Her şeyi anında durdurur.
    ///
    /// Sıra kritik: önce nesli artır (geç gelen bildirimler geçersizleşsin),
    /// sonra kuyruğu boşalt, sonra durumu sıfırla. Hiçbir geri çağırma
    /// tetiklenmez — sıradaki cümle **başlayamaz**.
    ///
    /// Yeni nesil numarasını döner; çağıran, çalan sesi durdurmak için kullanır.
    pub fn stop(&self) -> u64 {
        let new_gen = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        let mut state = self.lock();
        state.pending.clear();
        state.speaking = false;
        tracing::info!(generation = new_gen, "konuşma durduruldu (barge-in)");
        new_gen
    }

    pub fn is_speaking(&self) -> bool {
        self.lock().speaking
    }

    pub fn pending_count(&self) -> usize {
        self.lock().pending.len()
    }

    pub fn is_idle(&self) -> bool {
        let state = self.lock();
        !state.speaking && state.pending.is_empty()
    }

    /// Kilit zehirlenmesinde panik yerine devam et — ses hattı durmamalı.
    fn lock(&self) -> std::sync::MutexGuard<'_, QueueState> {
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// Metni seslendirilebilir parçalara böler.
///
/// Neden cümle cümle: ilk cümle hazır olur olmaz çalmaya başlarız, tüm cevabın
/// üretilmesini beklemeyiz. Kullanıcının "TTS gecikmeli" şikayetinin çaresi bu.
///
/// Kısa parçalar birleştirilir — "Evet." tek başına seslendirilirse kesik kesik
/// duyulur.
pub fn split_sentences(text: &str) -> Vec<String> {
    /// Bir parçanın tek başına seslendirilmesi için gereken en az uzunluk.
    /// Bundan kısa parçalar sonrakiyle birleşir — "Evet." tek başına
    /// seslendirilirse kesik kesik duyulur.
    const MIN_CHARS: usize = 16;

    let mut out: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut chars = text.chars().peekable();

    while let Some(ch) = chars.next() {
        current.push(ch);

        let is_boundary = matches!(ch, '.' | '!' | '?' | '\n' | ':' | ';');
        if !is_boundary {
            continue;
        }

        // Ondalık sayı ("3.14") veya kısaltma cümle sonu değildir:
        // noktadan sonra boşluk/satır sonu gelmeli.
        let ends_here = match chars.peek() {
            None => true,
            Some(next) => next.is_whitespace(),
        };

        if ends_here && current.trim().chars().count() >= MIN_CHARS {
            out.push(current.trim().to_string());
            current.clear();
        }
    }

    let rest = current.trim();
    if !rest.is_empty() {
        // Kalan çok kısaysa öncekine ekle — tek kelimelik parça olmasın.
        if rest.chars().count() < MIN_CHARS {
            if let Some(last) = out.last_mut() {
                last.push(' ');
                last.push_str(rest);
                return out;
            }
        }
        out.push(rest.to_string());
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queue_delivers_in_order() {
        let q = SpeechQueue::new();
        q.push("bir");
        q.push("iki");

        let first = q.next().unwrap();
        assert_eq!(first.text, "bir");

        // Konuşurken ikinci alınamaz.
        assert!(q.next().is_none());

        q.finished(first.generation);
        assert_eq!(q.next().unwrap().text, "iki");
    }

    #[test]
    fn empty_text_is_not_queued() {
        let q = SpeechQueue::new();
        q.push("");
        q.push("   ");
        assert_eq!(q.pending_count(), 0);
    }

    /// **Asıl regresyon testi.** Eski projedeki barge-in bugu.
    ///
    /// ESC'ye basıldığında sıradaki cümle ASLA başlamamalı.
    #[test]
    fn stop_prevents_the_next_utterance_from_starting() {
        let q = SpeechQueue::new();
        q.push("birinci cümle");
        q.push("ikinci cümle");
        q.push("üçüncü cümle");

        let playing = q.next().unwrap();
        assert_eq!(playing.text, "birinci cümle");

        // Kullanıcı ESC'ye bastı.
        q.stop();

        assert!(q.is_idle(), "durdurma sonrası kuyruk boş olmalı");
        assert!(
            q.next().is_none(),
            "ESC'den sonra sıradaki cümle BAŞLAMAMALI — eski projedeki bug buydu"
        );
    }

    /// Durdurulan konuşmanın geç gelen "bitti" bildirimi yeni konuşmayı bozmamalı.
    #[test]
    fn stale_finish_notification_is_ignored() {
        let q = SpeechQueue::new();
        q.push("eski");
        let old = q.next().unwrap();

        q.stop(); // nesil arttı

        q.push("yeni");
        let new = q.next().unwrap();
        assert_eq!(new.text, "yeni");
        assert!(q.is_speaking());

        // Eski konuşmanın bitiş bildirimi geç geldi.
        q.finished(old.generation);

        assert!(
            q.is_speaking(),
            "eski bildirim yeni konuşmayı durdurmamalı"
        );
    }

    #[test]
    fn generation_increases_on_every_stop() {
        let q = SpeechQueue::new();
        let g0 = q.generation();
        let g1 = q.stop();
        let g2 = q.stop();
        assert!(g1 > g0 && g2 > g1);
    }

    #[test]
    fn stop_on_idle_queue_is_safe() {
        let q = SpeechQueue::new();
        q.stop();
        assert!(q.is_idle());
    }

    #[test]
    fn queue_is_shareable_across_threads() {
        let q = SpeechQueue::new();
        let q2 = q.clone();

        let handle = std::thread::spawn(move || {
            for i in 0..50 {
                q2.push(format!("parça {i}"));
            }
        });
        handle.join().unwrap();

        assert_eq!(q.pending_count(), 50);
    }

    #[test]
    fn concurrent_stop_and_push_do_not_deadlock() {
        let q = SpeechQueue::new();
        let mut handles = Vec::new();

        for _ in 0..4 {
            let q = q.clone();
            handles.push(std::thread::spawn(move || {
                for _ in 0..100 {
                    q.push("x");
                    q.stop();
                }
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        // Kilitlenme olmadan buraya geldiyse test geçti.
        assert!(q.generation() > 0);
    }

    // ── Cümle bölme ──────────────────────────────────────────────────────

    #[test]
    fn sentences_split_on_punctuation() {
        let text = "Bu birinci cümle ve yeterince uzun. Bu da ikinci cümle, o da uzun sayılır.";
        let parts = split_sentences(text);
        assert_eq!(parts.len(), 2, "parçalar: {parts:?}");
        assert!(parts[0].ends_with('.'));
    }

    #[test]
    fn short_fragments_merge_instead_of_standing_alone() {
        // "Evet." tek başına seslendirilirse kesik duyulur.
        let text = "Bu yeterince uzun bir cümle olsun diye yazıyorum burada. Evet.";
        let parts = split_sentences(text);
        assert_eq!(parts.len(), 1, "kısa parça öncekine eklenmeli: {parts:?}");
        assert!(parts[0].ends_with("Evet."));
    }

    #[test]
    fn text_without_punctuation_is_one_piece() {
        let parts = split_sentences("noktalama olmadan uzunca bir metin yazıyorum burada");
        assert_eq!(parts.len(), 1);
    }

    #[test]
    fn empty_text_yields_no_pieces() {
        assert!(split_sentences("").is_empty());
        assert!(split_sentences("   \n  ").is_empty());
    }

    #[test]
    fn every_piece_is_non_empty_and_trimmed() {
        let text = "Birinci cümle burada duruyor efendim.  \n\n  İkinci cümle de burada duruyor.";
        for piece in split_sentences(text) {
            assert!(!piece.is_empty());
            assert_eq!(piece, piece.trim());
        }
    }

    #[test]
    fn no_content_is_lost_when_splitting() {
        let text = "Birinci cümle yeterince uzun olsun diye. İkinci cümle de öyle uzun olsun.";
        let joined: String = split_sentences(text).join(" ");
        // Boşluk farkları dışında tüm kelimeler korunmalı.
        let orig_words: Vec<&str> = text.split_whitespace().collect();
        let new_words: Vec<&str> = joined.split_whitespace().collect();
        assert_eq!(orig_words, new_words, "bölme sırasında içerik kaybolmamalı");
    }
}
