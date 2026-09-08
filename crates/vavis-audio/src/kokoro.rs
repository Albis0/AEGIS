//! Kokoro TTS — kullanıcının kendi makinesinde çalışan yerel ses motoru.
//!
//! # Neden ayrı bir süreç, gömülü değil
//!
//! Kokoro bir sinir ağı: model dosyası yüzlerce megabayt, çalışması için de
//! bir Python/ONNX yığını gerekiyor. Bunu uygulamanın içine gömmek üç şeyi
//! birden bozardı:
//!
//! * **Kurulum.** Sesi hiç kullanmayacak kişi de yüzlerce megabaytı indirirdi.
//! * **Güncelleme.** Model yenilendiğinde uygulamayı yeniden yayınlamak
//!   gerekirdi.
//! * **Çökme.** Model süreci düşerse asistanın tamamı düşerdi.
//!
//! Bu yüzden Vavis Kokoro'yu **çalıştırmıyor**, yalnızca **konuşuyor**.
//! Kullanıcı sunucuyu kendi başlatıyor (Docker ya da `pip`), Vavis de
//! adresine HTTP isteği atıyor. Sunucu kapalıysa ses gelmiyor, ama uygulama
//! çalışmaya devam ediyor — bir motorun yokluğu asistanı durdurmamalı.
//!
//! # Protokol
//!
//! Kokoro-FastAPI, OpenAI'nin `/v1/audio/speech` uç noktasını taklit ediyor.
//! Yani buradaki istek gövdesi OpenAI ile birebir aynı; tek fark adresin
//! kullanıcının kendi makinesini göstermesi ve anahtar istememesi.
//!
//! Aynı şekli konuşan başka bir sunucu da (LM Studio, kendi sarmalayıcın)
//! aynı ayarla çalışır — burada Kokoro'ya özgü hiçbir varsayım yok.

use std::time::Duration;

#[derive(Debug, thiserror::Error)]
pub enum KokoroError {
    #[error("sunucuya ulaşılamadı ({url}) — Kokoro çalışıyor mu? {source}")]
    Unreachable {
        url: String,
        #[source]
        source: reqwest::Error,
    },
    #[error("sunucu hata döndü ({status}): {body}")]
    Server { status: u16, body: String },
    #[error("ses verisi boş geldi")]
    NoAudio,
}

pub type Result<T> = std::result::Result<T, KokoroError>;

/// Kokoro-FastAPI'nin varsayılan adresi.
///
/// Docker imajı da `pip` kurulumu da bu portu kullanıyor, dolayısıyla
/// çoğu kullanıcının hiçbir şey yazması gerekmiyor.
pub const DEFAULT_URL: &str = "http://localhost:8880/v1/audio/speech";

/// Varsayılan ses.
///
/// `af_` öneki Amerikan-İngilizce kadın sesleri; `af_heart` Kokoro'nun
/// örneklerinde öne çıkan ve en doğal olanı.
pub const DEFAULT_VOICE: &str = "af_heart";

/// Uzun bir cümle için üst sınır.
///
/// Yerel model GPU'suz makinede yavaş olabiliyor. Yine de sınırsız
/// beklemek yok: ses gelmeyecekse kullanıcı bunu sessizce beklemek yerine
/// bilmeli.
const TIMEOUT: Duration = Duration::from_secs(60);

/// Kokoro'nun kutudan çıkan sesleri — arayüzde listelemek için.
///
/// Sunucu bunları `/v1/audio/voices` altında da veriyor, ama o çağrı
/// sunucu kapalıyken başarısız olur ve ayarlar ekranı boş kalırdı.
/// Sabit liste, sunucu kapalıyken de bir şey seçilebilmesini sağlıyor.
pub fn voices() -> &'static [(&'static str, &'static str)] {
    &[
        ("af_heart", "Heart (EN, kadın)"),
        ("af_bella", "Bella (EN, kadın)"),
        ("af_nicole", "Nicole (EN, kadın)"),
        ("af_sarah", "Sarah (EN, kadın)"),
        ("am_adam", "Adam (EN, erkek)"),
        ("am_michael", "Michael (EN, erkek)"),
        ("bf_emma", "Emma (EN-GB, kadın)"),
        ("bm_george", "George (EN-GB, erkek)"),
    ]
}

/// Konuşma hızını Kokoro'nun beklediği çarpana çevirir.
///
/// Uygulama içinde hız her yerde SAPI ölçeğinde (-10…+10, 0 normal);
/// Kokoro ise 0.5–2.0 arası bir çarpan istiyor. Ortak ölçeği tek bir yerde
/// çevirmek, her motorun kendi biriminde konuşmasından iyi.
pub fn speed_from_rate(rate: i32) -> f32 {
    // -10 → 0.5×, 0 → 1.0×, +10 → 2.0×
    let r = rate.clamp(-10, 10) as f32;
    if r >= 0.0 {
        1.0 + r / 10.0
    } else {
        1.0 + r / 20.0
    }
}

/// İstek gövdesi. Ayrı fonksiyon: ağa çıkmadan test edilebilsin.
pub fn request_body(text: &str, voice: &str, rate: i32) -> serde_json::Value {
    serde_json::json!({
        // Sunucu bu alanı yok sayıyor ama OpenAI şeması zorunlu tutuyor.
        "model": "kokoro",
        "input": text,
        "voice": voice,
        "response_format": "mp3",
        "speed": speed_from_rate(rate),
    })
}

/// Metni seslendirip MP3 baytlarını döndürür.
pub fn synthesize(text: &str, url: &str, voice: &str, rate: i32) -> Result<Vec<u8>> {
    let url = if url.trim().is_empty() {
        DEFAULT_URL
    } else {
        url.trim()
    };
    let voice = if voice.trim().is_empty() {
        DEFAULT_VOICE
    } else {
        voice.trim()
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(TIMEOUT)
        .build()
        .map_err(|e| KokoroError::Unreachable {
            url: url.to_string(),
            source: e,
        })?;

    let response = client
        .post(url)
        .json(&request_body(text, voice, rate))
        .send()
        .map_err(|e| KokoroError::Unreachable {
            url: url.to_string(),
            source: e,
        })?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().unwrap_or_default();
        return Err(KokoroError::Server {
            status: status.as_u16(),
            // Uzun HTML hata sayfaları günlüğü boğuyor.
            body: body.chars().take(300).collect(),
        });
    }

    let audio = response
        .bytes()
        .map_err(|e| KokoroError::Unreachable {
            url: url.to_string(),
            source: e,
        })?
        .to_vec();

    if audio.is_empty() {
        Err(KokoroError::NoAudio)
    } else {
        Ok(audio)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rate_maps_onto_kokoro_speed() {
        assert_eq!(speed_from_rate(0), 1.0);
        assert_eq!(speed_from_rate(10), 2.0);
        assert_eq!(speed_from_rate(-10), 0.5);
        // Sunucunun kabul ettiği aralığın dışına asla çıkılmamalı.
        for r in [-100, -11, 11, 100] {
            let s = speed_from_rate(r);
            assert!((0.5..=2.0).contains(&s), "rate {r} -> {s}");
        }
    }

    #[test]
    fn the_body_carries_what_the_server_needs() {
        let b = request_body("merhaba", "af_heart", 0);
        assert_eq!(b["input"], "merhaba");
        assert_eq!(b["voice"], "af_heart");
        // MP3 isteniyor: ortak çalma yolu uzantıdan biçimi tanıyor.
        assert_eq!(b["response_format"], "mp3");
        assert_eq!(b["speed"], 1.0);
    }

    /// Sunucu kapalıyken hata **anlaşılır** olmalı: kullanıcı neyi
    /// başlatması gerektiğini mesajdan okuyabilmeli.
    #[test]
    fn an_unreachable_server_names_the_url() {
        // Kapalı olduğu kesin bir port.
        let err = synthesize("test", "http://127.0.0.1:9/v1/audio/speech", "af_heart", 0)
            .expect_err("kapalı porta bağlanmamalıydı");
        let msg = err.to_string();
        assert!(msg.contains("127.0.0.1:9"), "adres görünmeli: {msg}");
        assert!(msg.contains("Kokoro"), "ne başlatılacağı söylenmeli: {msg}");
    }

    #[test]
    fn blank_settings_fall_back_to_defaults() {
        // Boş değerler varsayılana düşmeli, isteği bozmamalı.
        let b = request_body("x", DEFAULT_VOICE, 0);
        assert_eq!(b["voice"], DEFAULT_VOICE);
        assert!(DEFAULT_URL.starts_with("http://localhost"));
    }

    #[test]
    fn every_voice_has_a_label() {
        assert!(!voices().is_empty());
        for (id, label) in voices() {
            assert!(!id.is_empty() && !label.is_empty());
        }
    }
}
