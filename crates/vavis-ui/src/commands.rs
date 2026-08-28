//! Eğik çizgi komutları.
//!
//! Neden ayrı modül: ayarları değiştirmek için ayrı bir ayar penceresi
//! gerekmesin. Terminal görünümünde her şey yazıyla yapılır — anahtar girme,
//! model seçme, sağlayıcı değiştirme.
//!
//! Ayrıştırma UI'dan bağımsız test edilebilir olsun diye burada duruyor.

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Command {
    Help,
    Health,
    Clear,
    Quit,
    /// `/key groq gsk_...`
    SetKey { provider: String, key: String },
    /// `/keys` — hangi sağlayıcıların anahtarı var
    ListKeys,
    /// `/provider groq`
    SetProvider(String),
    /// `/model llama-3.3-70b`
    SetModel(String),
    /// `/models` — canlı liste çek
    ListModels,
    /// Komut değil — LLM'e gidecek düz metin.
    Chat(String),
    /// Bilinmeyen komut.
    Unknown(String),
}

/// Kullanıcı girdisini komuta çevirir.
///
/// Türkçe ve İngilizce adlar birlikte kabul edilir.
pub fn parse(input: &str) -> Command {
    let trimmed = input.trim();
    if !trimmed.starts_with('/') {
        return Command::Chat(trimmed.to_string());
    }

    let mut parts = trimmed[1..].splitn(3, char::is_whitespace);
    let name = parts.next().unwrap_or("").to_ascii_lowercase();
    let arg1 = parts.next().unwrap_or("").trim().to_string();
    let arg2 = parts.next().unwrap_or("").trim().to_string();

    match name.as_str() {
        "help" | "yardim" | "yardım" | "?" => Command::Help,
        "health" | "durum" => Command::Health,
        "clear" | "temizle" | "cls" => Command::Clear,
        "quit" | "exit" | "cik" | "çık" => Command::Quit,
        "keys" | "anahtarlar" => Command::ListKeys,
        "models" | "modeller" => Command::ListModels,
        "key" | "anahtar" => {
            if arg1.is_empty() || arg2.is_empty() {
                Command::Unknown("kullanım: /key <sağlayıcı> <anahtar>".into())
            } else {
                Command::SetKey {
                    provider: arg1.to_ascii_lowercase(),
                    key: arg2,
                }
            }
        }
        "provider" | "saglayici" | "sağlayıcı" => {
            if arg1.is_empty() {
                Command::Unknown("kullanım: /provider <groq|openai|gemini|…>".into())
            } else {
                Command::SetProvider(arg1.to_ascii_lowercase())
            }
        }
        "model" => {
            if arg1.is_empty() {
                Command::Unknown("kullanım: /model <model-adı>".into())
            } else {
                Command::SetModel(arg1)
            }
        }
        other => Command::Unknown(format!("bilinmeyen komut: /{other} — /help dene")),
    }
}

/// Yardım metni.
pub fn help_lines() -> Vec<&'static str> {
    vec![
        "/help                    bu liste",
        "/key <sağlayıcı> <anah>  API anahtarı kaydet (şifreli saklanır)",
        "/keys                    kayıtlı anahtarlar",
        "/provider <ad>           groq · openai · gemini · mistral · deepseek · xai · local",
        "/model <ad>              kullanılacak model",
        "/models                  sağlayıcıdan canlı model listesi",
        "/health                  sistem durumu (F1)",
        "/clear                   ekranı ve geçmişi temizle (Ctrl+L)",
        "/quit                    çık",
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_text_is_chat() {
        assert_eq!(parse("merhaba"), Command::Chat("merhaba".into()));
    }

    #[test]
    fn slash_commands_are_recognised() {
        assert_eq!(parse("/help"), Command::Help);
        assert_eq!(parse("/clear"), Command::Clear);
        assert_eq!(parse("/quit"), Command::Quit);
    }

    #[test]
    fn turkish_aliases_work() {
        assert_eq!(parse("/yardım"), Command::Help);
        assert_eq!(parse("/temizle"), Command::Clear);
        assert_eq!(parse("/durum"), Command::Health);
    }

    #[test]
    fn key_command_captures_provider_and_key() {
        assert_eq!(
            parse("/key groq gsk_abc123"),
            Command::SetKey {
                provider: "groq".into(),
                key: "gsk_abc123".into()
            }
        );
    }

    #[test]
    fn key_with_spaces_in_value_is_preserved() {
        // splitn(3) sayesinde anahtarın içindeki boşluk bozulmaz.
        let cmd = parse("/key openai sk-proj abc def");
        assert_eq!(
            cmd,
            Command::SetKey {
                provider: "openai".into(),
                key: "sk-proj abc def".into()
            }
        );
    }

    #[test]
    fn incomplete_key_command_explains_usage() {
        match parse("/key groq") {
            Command::Unknown(msg) => assert!(msg.contains("kullanım")),
            other => panic!("beklenmeyen: {other:?}"),
        }
    }

    #[test]
    fn unknown_command_suggests_help() {
        match parse("/saçmalık") {
            Command::Unknown(msg) => assert!(msg.contains("/help")),
            other => panic!("beklenmeyen: {other:?}"),
        }
    }

    #[test]
    fn command_names_are_case_insensitive() {
        assert_eq!(parse("/HELP"), Command::Help);
        assert_eq!(parse("/Provider GROQ"), Command::SetProvider("groq".into()));
    }

    #[test]
    fn empty_input_is_empty_chat() {
        assert_eq!(parse("   "), Command::Chat(String::new()));
    }
}
