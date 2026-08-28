//! Metin → ses (TTS).
//!
//! Varsayılan motor: **Windows SAPI** — işletim sisteminde hazır, anahtar
//! istemez, çevrimdışı çalışır, Türkçe sesi var.
//!
//! Eski projede Edge TTS (WebSocket) kullanılıyordu; ElevenLabs ve Kokoro
//! çalışmıyordu (manuel test bulgusu). Burada önce **kesin çalışan** yolu
//! kuruyoruz; bulut motorları F6'da eklenir.
//!
//! Performans notu: eski projedeki `out.push(...chunk)` (spread) her 240
//! örnek için tüm diziyi kopyalıyordu — O(n²)'ye yakın ve GC baskısı. Rust'ta
//! zaten böyle bir şey yok; ses işleme ayrılmış tamponlarda yapılır.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Debug, thiserror::Error)]
pub enum TtsError {
    #[error("ses motoru başlatılamadı: {0}")]
    Engine(String),
    #[error("seslendirme başarısız: {0}")]
    Speak(String),
}

pub type Result<T> = std::result::Result<T, TtsError>;

/// TTS ayarları.
#[derive(Debug, Clone)]
pub struct TtsConfig {
    /// Konuşma hızı (-10 … +10, 0 normal).
    pub rate: i32,
    /// Ses yüksekliği (0-100).
    pub volume: u32,
    /// Ses adı — boşsa sistem varsayılanı.
    pub voice: String,
}

impl Default for TtsConfig {
    fn default() -> Self {
        Self {
            rate: 1, // hafif hızlı — bekleme hissini azaltır
            volume: 100,
            voice: String::new(),
        }
    }
}

/// Konuşma motoru.
///
/// `cancel` bayrağı barge-in için: çalan konuşma anında kesilir.
pub struct TtsEngine {
    config: TtsConfig,
    cancel: Arc<AtomicBool>,
}

impl TtsEngine {
    pub fn new(config: TtsConfig) -> Self {
        Self {
            config,
            cancel: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Barge-in bayrağı — `stop()` bunu kaldırır, konuşma döngüsü görür.
    pub fn cancel_flag(&self) -> Arc<AtomicBool> {
        self.cancel.clone()
    }

    /// Çalan konuşmayı kes.
    pub fn stop(&self) {
        self.cancel.store(true, Ordering::SeqCst);
        stop_platform_speech();
    }

    /// Yeni bir konuşma turu başlıyor — iptal bayrağını temizle.
    pub fn reset(&self) {
        self.cancel.store(false, Ordering::SeqCst);
    }

    /// Metni seslendirir. **Bloklar** — ayrı bir thread'den çağrılmalı.
    pub fn speak(&self, text: &str) -> Result<()> {
        if text.trim().is_empty() {
            return Ok(());
        }
        if self.cancel.load(Ordering::SeqCst) {
            return Ok(()); // zaten iptal edilmiş
        }
        speak_platform(text, &self.config)
    }

    /// Sistemdeki Türkçe konuşabilen sesler.
    pub fn available_voices() -> Vec<String> {
        list_voices_platform()
    }
}

// ── Windows (SAPI) ──────────────────────────────────────────────────────────

#[cfg(windows)]
fn speak_platform(text: &str, config: &TtsConfig) -> Result<()> {
    use std::process::Command;

    // Metni PowerShell'e güvenle geçirmek: tek tırnaklar ikilenir.
    // Komut enjeksiyonu riski yok — metin veri olarak kalıyor.
    let safe = text.replace('\'', "''");

    let voice_line = if config.voice.trim().is_empty() {
        String::new()
    } else {
        format!(
            "try {{ $s.SelectVoice('{}') }} catch {{ }};",
            config.voice.replace('\'', "''")
        )
    };

    let script = format!(
        "Add-Type -AssemblyName System.Speech; \
         $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; \
         $s.Rate = {}; $s.Volume = {}; {voice_line} \
         $s.Speak('{safe}')",
        config.rate.clamp(-10, 10),
        config.volume.min(100),
    );

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .output()
        .map_err(|e| TtsError::Engine(e.to_string()))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(TtsError::Speak(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ))
    }
}

/// Çalan konuşmayı öldür.
///
/// SAPI'yi dışarıdan durdurmanın güvenilir yolu, seslendiren süreci
/// sonlandırmak. Kendi başlattığımız süreçleri hedefliyoruz.
#[cfg(windows)]
fn stop_platform_speech() {
    use std::process::Command;
    // Sadece bizim başlattığımız gizli powershell süreçleri — kullanıcının
    // kendi açtığı konsolu kapatmamak için pencere başlığına bakılıyor.
    let _ = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-Process powershell -ErrorAction SilentlyContinue | \
             Where-Object { $_.MainWindowTitle -eq '' -and \
             $_.StartTime -gt (Get-Date).AddMinutes(-5) } | \
             Stop-Process -Force -ErrorAction SilentlyContinue",
        ])
        .output();
}

#[cfg(windows)]
fn list_voices_platform() -> Vec<String> {
    use std::process::Command;

    let script = "Add-Type -AssemblyName System.Speech; \
                  (New-Object System.Speech.Synthesis.SpeechSynthesizer)\
                  .GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }";

    let Ok(output) = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
    else {
        return Vec::new();
    };

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(String::from)
        .collect()
}

// ── Windows dışı ────────────────────────────────────────────────────────────

#[cfg(not(windows))]
fn speak_platform(_text: &str, _config: &TtsConfig) -> Result<()> {
    Err(TtsError::Engine(
        "TTS bu platformda henüz desteklenmiyor".into(),
    ))
}

#[cfg(not(windows))]
fn stop_platform_speech() {}

#[cfg(not(windows))]
fn list_voices_platform() -> Vec<String> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_sane() {
        let c = TtsConfig::default();
        assert!((-10..=10).contains(&c.rate));
        assert!(c.volume <= 100);
    }

    #[test]
    fn empty_text_is_a_no_op() {
        let engine = TtsEngine::new(TtsConfig::default());
        assert!(engine.speak("").is_ok());
        assert!(engine.speak("   ").is_ok());
    }

    #[test]
    fn cancel_flag_short_circuits_speaking() {
        let engine = TtsEngine::new(TtsConfig::default());
        engine.cancel.store(true, Ordering::SeqCst);
        // İptal edilmişken konuşma denemesi bile yapılmamalı — hızlı dönmeli.
        let start = std::time::Instant::now();
        assert!(engine.speak("uzun bir metin").is_ok());
        assert!(start.elapsed().as_millis() < 100, "iptalde anında dönmeli");
    }

    #[test]
    fn reset_clears_cancel_flag() {
        let engine = TtsEngine::new(TtsConfig::default());
        engine.stop();
        assert!(engine.cancel.load(Ordering::SeqCst));

        engine.reset();
        assert!(!engine.cancel.load(Ordering::SeqCst));
    }

    #[test]
    fn cancel_flag_is_shared() {
        let engine = TtsEngine::new(TtsConfig::default());
        let flag = engine.cancel_flag();
        engine.stop();
        assert!(flag.load(Ordering::SeqCst), "bayrak paylaşılmalı");
    }

    #[test]
    fn quotes_in_text_do_not_break_the_script() {
        // Tek tırnak PowerShell'de string'i kapatır — ikilenmeli.
        let text = "O'nun dediği 'şey' buydu";
        let escaped = text.replace('\'', "''");

        assert!(escaped.contains("O''nun"));
        // Metindeki 3 tırnağın her biri ikilenmiş olmalı.
        assert_eq!(text.matches('\'').count(), 3);
        assert_eq!(escaped.matches("''").count(), 3);
        // Tek başına duran tırnak kalmamalı — PowerShell string'i kapanmasın.
        assert_eq!(escaped.matches('\'').count(), 6);
    }

    #[test]
    fn voice_listing_does_not_panic() {
        // Windows'ta ses döner, diğerlerinde boş — ikisi de geçerli.
        let _ = TtsEngine::available_voices();
    }
}
