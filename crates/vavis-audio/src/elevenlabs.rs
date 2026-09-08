//! ElevenLabs TTS — en doğal ses, anahtar gerektirir.
//!
//! Diğer motorlardan ayrıldığı nokta para: her karakter kullanıcının
//! kotasından düşüyor. Bu yüzden burada sessiz yeniden deneme **yok** —
//! başarısız bir istek tekrarlanırsa kota iki kez harcanır ve kullanıcı
//! bunu ancak fatura gelince görür. Bir kez denenir, olmazsa çağıran katman
//! başka bir motora düşer.
//!
//! # Anahtar nereden geliyor
//!
//! Şifreli anahtar deposundan (DPAPI). Bu modül anahtarı **almıyor**,
//! kendisine verilmesini bekliyor: ses katmanının anahtar deposunu tanıması
//! gerekmiyor, ve tanımaması onu test edilebilir tutuyor.

use std::time::Duration;

#[derive(Debug, thiserror::Error)]
pub enum ElevenError {
    #[error("ElevenLabs anahtarı yok — ayarlardan ekle")]
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

pub type Result<T> = std::result::Result<T, ElevenError>;

/// Varsayılan ses: "Rachel" — ElevenLabs'in kendi örneklerindeki temel ses.
pub const DEFAULT_VOICE_ID: &str = "21m00Tcm4TlvDq8ikWAM";

/// Çok dilli model. Türkçe **yalnızca** bu modelde var; tek dilli
/// (İngilizce) modeller Türkçe metni İngilizce fonetiğiyle okuyor.
pub const DEFAULT_MODEL: &str = "eleven_multilingual_v2";

const TIMEOUT: Duration = Duration::from_secs(45);

/// Kutudan çıkan sesler.
///
/// Kullanıcının kendi klonladığı sesler bu listede yok ama kimlik elle
/// yazılabiliyor — arayüzdeki alan serbest metin.
pub fn voices() -> &'static [(&'static str, &'static str)] {
    &[
        ("21m00Tcm4TlvDq8ikWAM", "Rachel (kadın)"),
        ("AZnzlk1XvdvUeBnXmlld", "Domi (kadın)"),
        ("EXAVITQu4vr4xnSDxMaL", "Sarah (kadın)"),
        ("ErXwobaYiN019PkySvjV", "Antoni (erkek)"),
        ("TxGEqnHWrfWFTfGW9XjX", "Josh (erkek)"),
        ("VR6AewLTigWG4xSOukaG", "Arnold (erkek)"),
        ("pNInz6obpgDQGcFmaJgB", "Adam (erkek)"),
    ]
}

fn endpoint(voice_id: &str) -> String {
    format!("https://api.elevenlabs.io/v1/text-to-speech/{voice_id}")
}

/// İstek gövdesi. Ayrı fonksiyon: ağa çıkmadan test edilebilsin.
pub fn request_body(text: &str, model: &str) -> serde_json::Value {
    serde_json::json!({
        "text": text,
        "model_id": model,
        // Sağlayıcının önerdiği denge: daha yüksek "stability" monoton,
        // daha düşüğü ise cümleden cümleye tutarsız okuyor.
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        }
    })
}

/// HTTP durumunu bu katmanın hata diline çevirir.
///
/// Ayrı tutuluyor çünkü **hangi hatanın yeniden denenebilir olduğu**
/// buradan okunuyor: kota hatasıyla bozuk anahtar aynı şey değil, ve
/// ikisini karıştırmak kullanıcıya yanlış şeyi düzelttiriyor.
pub fn classify(status: u16, body: &str) -> Option<ElevenError> {
    match status {
        200..=299 => None,
        401 | 403 => Some(ElevenError::BadKey),
        429 => Some(ElevenError::QuotaOrRateLimit),
        // 422: metin çok uzun ya da ses kimliği yok — gövde bunu söylüyor.
        _ => Some(ElevenError::Server {
            status,
            body: body.chars().take(300).collect(),
        }),
    }
}

/// Metni seslendirip MP3 baytlarını döndürür.
pub fn synthesize(text: &str, key: &str, voice_id: &str, model: &str) -> Result<Vec<u8>> {
    if key.trim().is_empty() {
        return Err(ElevenError::NoKey);
    }

    let voice_id = if voice_id.trim().is_empty() {
        DEFAULT_VOICE_ID
    } else {
        voice_id.trim()
    };
    let model = if model.trim().is_empty() {
        DEFAULT_MODEL
    } else {
        model.trim()
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(TIMEOUT)
        .build()
        .map_err(|e| ElevenError::Network(e.to_string()))?;

    let response = client
        .post(endpoint(voice_id))
        .header("xi-api-key", key.trim())
        .header("accept", "audio/mpeg")
        .json(&request_body(text, model))
        .send()
        .map_err(|e| ElevenError::Network(e.to_string()))?;

    let status = response.status().as_u16();
    if let Some(err) = classify(status, "") {
        // Gövde yalnızca hata durumunda okunuyor: başarıda o baytlar ses.
        let body = response.text().unwrap_or_default();
        return Err(match err {
            ElevenError::Server { status, .. } => ElevenError::Server {
                status,
                body: body.chars().take(300).collect(),
            },
            other => other,
        });
    }

    let audio = response
        .bytes()
        .map_err(|e| ElevenError::Network(e.to_string()))?
        .to_vec();

    if audio.is_empty() {
        Err(ElevenError::NoAudio)
    } else {
        Ok(audio)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Anahtarsızken **ağa çıkılmamalı**: boşuna istek de yok, kafa
    /// karıştıran ağ hatası da yok — söylenen şey eksik olan şey.
    #[test]
    fn a_missing_key_is_reported_without_a_request() {
        let start = std::time::Instant::now();
        let err = synthesize("merhaba", "", "", "").expect_err("anahtarsız çalışmamalı");
        assert!(matches!(err, ElevenError::NoKey));
        assert!(start.elapsed().as_millis() < 100, "ağa çıkmamalı");

        assert!(matches!(
            synthesize("merhaba", "   ", "", "").unwrap_err(),
            ElevenError::NoKey
        ));
    }

    /// Yanlış anahtar ile dolu kota farklı sorunlar: kullanıcıya doğru
    /// olanı söylenmeli.
    #[test]
    fn failures_are_told_apart() {
        assert!(matches!(classify(401, ""), Some(ElevenError::BadKey)));
        assert!(matches!(classify(403, ""), Some(ElevenError::BadKey)));
        assert!(matches!(
            classify(429, ""),
            Some(ElevenError::QuotaOrRateLimit)
        ));
        assert!(matches!(
            classify(422, "text too long"),
            Some(ElevenError::Server { status: 422, .. })
        ));
        assert!(classify(200, "").is_none());
    }

    #[test]
    fn the_body_asks_for_the_multilingual_model() {
        let b = request_body("merhaba dünya", DEFAULT_MODEL);
        assert_eq!(b["text"], "merhaba dünya");
        // Türkçe yalnızca çok dilli modelde var.
        assert_eq!(b["model_id"], "eleven_multilingual_v2");
        assert!(b["voice_settings"]["stability"].is_number());
    }

    #[test]
    fn long_error_bodies_are_clipped() {
        let huge = "x".repeat(5000);
        let Some(ElevenError::Server { body, .. }) = classify(500, &huge) else {
            panic!("sunucu hatası bekleniyordu");
        };
        assert!(body.chars().count() <= 300, "günlüğü boğmamalı");
    }

    #[test]
    fn the_endpoint_carries_the_voice() {
        assert!(endpoint("abc123").ends_with("/text-to-speech/abc123"));
    }

    #[test]
    fn every_voice_has_a_label() {
        assert!(!voices().is_empty());
        for (id, label) in voices() {
            assert!(!id.is_empty() && !label.is_empty());
        }
    }
}
