//! OpenAI TTS — iyi ses, ve çoğu kullanıcıda anahtarı zaten var.
//!
//! Listeye eklenme sebebi tam olarak bu: sohbet için OpenAI anahtarı girmiş
//! biri, ses için hiçbir şey kurmadan ve ikinci bir hesap açmadan doğal bir
//! sese kavuşuyor. ElevenLabs kadar iyi değil ama kurulum maliyeti sıfır.
//!
//! Kokoro ile aynı uç nokta şeklini kullanıyor (`/v1/audio/speech`) — zaten
//! Kokoro OpenAI'yi taklit ettiği için. Yine de ayrı modül: adres sabit,
//! anahtar zorunlu ve hata dili farklı.

use std::time::Duration;

#[derive(Debug, thiserror::Error)]
pub enum OpenAiTtsError {
    #[error("OpenAI anahtarı yok — ayarlardan ekle")]
    NoKey,
    #[error("bağlanılamadı: {0}")]
    Network(String),
    #[error("anahtar reddedildi — ayarlardan kontrol et")]
    BadKey,
    #[error("kota doldu ya da hız sınırına takıldı")]
    QuotaOrRateLimit,
    #[error("sunucu hata döndü ({status}): {body}")]
    Server { status: u16, body: String },
    #[error("ses verisi boş geldi")]
    NoAudio,
}

pub type Result<T> = std::result::Result<T, OpenAiTtsError>;

const URL: &str = "https://api.openai.com/v1/audio/speech";
const TIMEOUT: Duration = Duration::from_secs(45);

/// Varsayılan model: `gpt-4o-mini-tts` — `tts-1`'den doğal, `tts-1-hd`'den ucuz.
pub const DEFAULT_MODEL: &str = "gpt-4o-mini-tts";

/// Varsayılan ses.
pub const DEFAULT_VOICE: &str = "nova";

pub fn voices() -> &'static [(&'static str, &'static str)] {
    &[
        ("nova", "Nova (kadın)"),
        ("shimmer", "Shimmer (kadın)"),
        ("alloy", "Alloy (nötr)"),
        ("echo", "Echo (erkek)"),
        ("fable", "Fable (erkek)"),
        ("onyx", "Onyx (erkek)"),
    ]
}

/// Hızı OpenAI'nin kabul ettiği çarpana çevirir (0.25–4.0).
///
/// Uygulama içindeki ortak ölçek SAPI'nin -10…+10 aralığı; burada da
/// Kokoro'daki gibi tek bir yerde çevriliyor.
pub fn speed_from_rate(rate: i32) -> f32 {
    let r = rate.clamp(-10, 10) as f32;
    if r >= 0.0 {
        1.0 + r / 10.0
    } else {
        1.0 + r / 20.0
    }
}

pub fn request_body(text: &str, model: &str, voice: &str, rate: i32) -> serde_json::Value {
    serde_json::json!({
        "model": model,
        "input": text,
        "voice": voice,
        "response_format": "mp3",
        "speed": speed_from_rate(rate),
    })
}

pub fn classify(status: u16, body: &str) -> Option<OpenAiTtsError> {
    match status {
        200..=299 => None,
        401 | 403 => Some(OpenAiTtsError::BadKey),
        429 => Some(OpenAiTtsError::QuotaOrRateLimit),
        _ => Some(OpenAiTtsError::Server {
            status,
            body: body.chars().take(300).collect(),
        }),
    }
}

pub fn synthesize(text: &str, key: &str, voice: &str, model: &str, rate: i32) -> Result<Vec<u8>> {
    if key.trim().is_empty() {
        return Err(OpenAiTtsError::NoKey);
    }

    let voice = if voice.trim().is_empty() {
        DEFAULT_VOICE
    } else {
        voice.trim()
    };
    let model = if model.trim().is_empty() {
        DEFAULT_MODEL
    } else {
        model.trim()
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(TIMEOUT)
        .build()
        .map_err(|e| OpenAiTtsError::Network(e.to_string()))?;

    let response = client
        .post(URL)
        .bearer_auth(key.trim())
        .json(&request_body(text, model, voice, rate))
        .send()
        .map_err(|e| OpenAiTtsError::Network(e.to_string()))?;

    let status = response.status().as_u16();
    if let Some(err) = classify(status, "") {
        let body = response.text().unwrap_or_default();
        return Err(match err {
            OpenAiTtsError::Server { status, .. } => OpenAiTtsError::Server {
                status,
                body: body.chars().take(300).collect(),
            },
            other => other,
        });
    }

    let audio = response
        .bytes()
        .map_err(|e| OpenAiTtsError::Network(e.to_string()))?
        .to_vec();

    if audio.is_empty() {
        Err(OpenAiTtsError::NoAudio)
    } else {
        Ok(audio)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_key_is_reported_without_a_request() {
        let start = std::time::Instant::now();
        assert!(matches!(
            synthesize("merhaba", "", "", "", 0).unwrap_err(),
            OpenAiTtsError::NoKey
        ));
        assert!(start.elapsed().as_millis() < 100, "ağa çıkmamalı");
    }

    #[test]
    fn failures_are_told_apart() {
        assert!(matches!(classify(401, ""), Some(OpenAiTtsError::BadKey)));
        assert!(matches!(
            classify(429, ""),
            Some(OpenAiTtsError::QuotaOrRateLimit)
        ));
        assert!(classify(200, "").is_none());
    }

    #[test]
    fn speed_stays_inside_what_the_api_accepts() {
        for r in [-100, -10, 0, 10, 100] {
            let s = speed_from_rate(r);
            assert!((0.25..=4.0).contains(&s), "rate {r} -> {s}");
        }
        assert_eq!(speed_from_rate(0), 1.0);
    }

    #[test]
    fn the_body_asks_for_mp3() {
        let b = request_body("selam", DEFAULT_MODEL, DEFAULT_VOICE, 0);
        assert_eq!(b["input"], "selam");
        assert_eq!(b["response_format"], "mp3");
        assert_eq!(b["model"], "gpt-4o-mini-tts");
    }

    #[test]
    fn every_voice_has_a_label() {
        assert!(!voices().is_empty());
        for (id, label) in voices() {
            assert!(!id.is_empty() && !label.is_empty());
        }
    }
}
