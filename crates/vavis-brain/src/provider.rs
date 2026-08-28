//! LLM sağlayıcıları.
//!
//! Eski projede her sağlayıcı için ayrı fonksiyon vardı (ai-client.ts 720 satır).
//! Burada hepsi tek şekil: OpenAI-uyumlu uç nokta + anahtar. Farklı olan sadece
//! URL ve model listesi.
//!
//! Anthropic bilinçli olarak **yok** — farklı gövde şeması istiyor, F2'yi
//! şişirmemek için sonraya bırakıldı (F6).

use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Groq,
    OpenAI,
    Gemini,
    Mistral,
    DeepSeek,
    XAI,
    /// Claude — OpenAI-uyumlu DEGIL, ayri govde semasi (bkz. `anthropic` modulu).
    Anthropic,
    /// Yerel sunucu (Ollama / LM Studio) — anahtar istemez.
    Local,
}

impl Provider {
    pub const ALL: [Provider; 8] = [
        Self::Groq,
        Self::OpenAI,
        Self::Gemini,
        Self::Mistral,
        Self::DeepSeek,
        Self::XAI,
        Self::Anthropic,
        Self::Local,
    ];

    /// Sohbet tamamlama uç noktası (OpenAI-uyumlu).
    pub fn chat_url(self) -> &'static str {
        match self {
            Self::Groq => "https://api.groq.com/openai/v1/chat/completions",
            Self::OpenAI => "https://api.openai.com/v1/chat/completions",
            Self::Gemini => {
                "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
            }
            Self::Mistral => "https://api.mistral.ai/v1/chat/completions",
            Self::DeepSeek => "https://api.deepseek.com/v1/chat/completions",
            Self::XAI => "https://api.x.ai/v1/chat/completions",
            Self::Anthropic => crate::anthropic::CHAT_URL,
            Self::Local => "http://127.0.0.1:11434/v1/chat/completions",
        }
    }

    /// Canlı model listesi uç noktası.
    pub fn models_url(self) -> &'static str {
        match self {
            Self::Groq => "https://api.groq.com/openai/v1/models",
            Self::OpenAI => "https://api.openai.com/v1/models",
            Self::Gemini => "https://generativelanguage.googleapis.com/v1beta/openai/models",
            Self::Mistral => "https://api.mistral.ai/v1/models",
            Self::DeepSeek => "https://api.deepseek.com/v1/models",
            Self::XAI => "https://api.x.ai/v1/models",
            Self::Anthropic => crate::anthropic::MODELS_URL,
            Self::Local => "http://127.0.0.1:11434/v1/models",
        }
    }

    /// Ayar dosyasındaki anahtar adı.
    pub fn key_name(self) -> &'static str {
        match self {
            Self::Groq => "groq",
            Self::OpenAI => "openai",
            Self::Gemini => "gemini",
            Self::Mistral => "mistral",
            Self::DeepSeek => "deepseek",
            Self::XAI => "xai",
            Self::Anthropic => "anthropic",
            Self::Local => "local",
        }
    }

    pub fn needs_key(self) -> bool {
        !matches!(self, Self::Local)
    }

    /// Anahtar yokken kullanılacak makul varsayılan model.
    pub fn default_model(self) -> &'static str {
        match self {
            Self::Groq => "llama-3.3-70b-versatile",
            Self::OpenAI => "gpt-4o-mini",
            Self::Gemini => "gemini-2.5-flash",
            Self::Mistral => "mistral-small-latest",
            Self::DeepSeek => "deepseek-chat",
            Self::XAI => "grok-3",
            Self::Anthropic => crate::anthropic::DEFAULT_MODEL,
            Self::Local => "llama3.2",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "groq" => Some(Self::Groq),
            "openai" => Some(Self::OpenAI),
            "gemini" | "google" => Some(Self::Gemini),
            "mistral" => Some(Self::Mistral),
            "deepseek" => Some(Self::DeepSeek),
            "xai" | "grok" => Some(Self::XAI),
            "anthropic" | "claude" => Some(Self::Anthropic),
            "local" | "ollama" => Some(Self::Local),
            _ => None,
        }
    }
}

impl fmt::Display for Provider {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.key_name())
    }
}

/// Sohbet dışı modelleri eler (whisper, embedding, tts…).
///
/// Eski `models.ts`'ten taşındı — kullanıcı "çok fazla gereksiz Gemini modeli
/// var" diye şikayet etmişti; gürültü burada kesiliyor.
pub fn is_chat_model(id: &str) -> bool {
    const NOISE: [&str; 12] = [
        "whisper",
        "tts",
        "embed",
        "guard",
        "moderation",
        "rerank",
        "dall-e",
        "image",
        "ocr",
        "aqa",
        "imagen",
        "learnlm",
    ];
    let lower = id.to_ascii_lowercase();
    !NOISE.iter().any(|n| lower.contains(n))
}

/// Sağlayıcıya özel "işe yarar model" süzgeci.
///
/// Hiçbir şey kalmazsa çağıran taraf süzülmemiş listeye döner — boş liste
/// göstermek, gürültülü liste göstermekten kötüdür.
pub fn is_useful_model(provider: Provider, id: &str) -> bool {
    let lower = id.to_ascii_lowercase();
    if !is_chat_model(&lower) {
        return false;
    }
    match provider {
        Provider::Gemini => {
            // Emekli nesiller ve deneysel varyantlar elenir.
            if lower.contains("gemini-1.0") || lower.contains("gemini-1.5") {
                return false;
            }
            lower.contains("gemini-2") || lower.contains("gemini-3")
        }
        Provider::OpenAI => {
            if lower.contains("gpt-3.5") || lower.contains("davinci") || lower.contains("instruct")
            {
                return false;
            }
            lower.starts_with("gpt-4") || lower.starts_with("gpt-5") || lower.starts_with('o')
        }
        Provider::XAI => !lower.contains("grok-2") && !lower.contains("beta"),
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_providers_have_distinct_urls() {
        let mut urls: Vec<&str> = Provider::ALL.iter().map(|p| p.chat_url()).collect();
        urls.sort_unstable();
        let before = urls.len();
        urls.dedup();
        assert_eq!(before, urls.len(), "iki sağlayıcı aynı URL'yi paylaşamaz");
    }

    #[test]
    fn local_needs_no_key() {
        assert!(!Provider::Local.needs_key());
        assert!(Provider::Groq.needs_key());
    }

    #[test]
    fn parse_accepts_aliases() {
        assert_eq!(Provider::parse("GROQ"), Some(Provider::Groq));
        assert_eq!(Provider::parse("google"), Some(Provider::Gemini));
        assert_eq!(Provider::parse("ollama"), Some(Provider::Local));
        assert_eq!(Provider::parse("yok-böyle"), None);
    }

    #[test]
    fn noise_models_are_filtered() {
        assert!(!is_chat_model("whisper-large-v3"));
        assert!(!is_chat_model("text-embedding-3-small"));
        assert!(is_chat_model("llama-3.3-70b-versatile"));
    }

    #[test]
    fn gemini_filter_drops_retired_generations() {
        assert!(!is_useful_model(Provider::Gemini, "gemini-1.5-pro"));
        assert!(is_useful_model(Provider::Gemini, "gemini-2.5-flash"));
        assert!(is_useful_model(Provider::Gemini, "gemini-3.5-flash"));
    }

    #[test]
    fn every_provider_has_a_default_model() {
        for p in Provider::ALL {
            assert!(!p.default_model().is_empty(), "{p} varsayılansız");
        }
    }
}
