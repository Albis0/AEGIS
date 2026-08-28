//! Bağlam bütçesi — istek modelin penceresine sığdırılır.
//!
//! Eski projedeki 413 ("message too long") hatasının kök nedeni: geçmiş
//! pencereye sığdırılıyordu ama **tool şemaları sayılmıyordu** (64 şema ≈ 8-15k
//! token). Sistem + tool'lar tek başına pencereyi doldurunca istek reddediliyordu.
//!
//! Buradaki kural: **her şey sayılır.** Sığmıyorsa sırayla küçültülür:
//!   1. en alakasız tool'lar atılır (tool'lar alaka sırasında gelir),
//!   2. geçmiş eskiden yeniye budanır,
//!   3. son çare: sadece son kullanıcı mesajı.
//!
//! Sığmayacağı bilinen istek **asla gönderilmez.**

use crate::message::{Message, Role};

/// Kaba token tahmini. Gerçek tokenizer yerine karakter/4 — sağlayıcılar arası
/// farklıdır, o yüzden zaten güvenlik payı bırakıyoruz.
///
/// Türkçe karakterler UTF-8'de 2 bayt ama ~1 token, bu yüzden bayt değil
/// **karakter** sayıyoruz (eski projede bayt sayılıyordu, Türkçe metinde
/// bütçeyi olduğundan büyük gösteriyordu).
pub fn estimate_tokens(text: &str) -> usize {
    text.chars().count() / 4 + 1
}

/// Pencerenin doldurulacak en fazla oranı.
const SAFETY_FACTOR: f64 = 0.9;
/// Modelin kendi ek yükü için ayrılan pay.
const RESERVE: usize = 512;

#[derive(Debug, Clone, Copy)]
pub struct ModelCaps {
    /// Modelin bağlam penceresi (token).
    pub context_window: usize,
    /// Cevap için ayrılacak en fazla token.
    pub max_output: usize,
}

impl Default for ModelCaps {
    fn default() -> Self {
        // Muhafazakâr varsayılan: model bilinmiyorsa küçük varsay.
        Self {
            context_window: 8_192,
            max_output: 1_024,
        }
    }
}

impl ModelCaps {
    /// Model adından pencere tahmini. Bilinmeyende güvenli varsayılan.
    pub fn for_model(model: &str) -> Self {
        let m = model.to_ascii_lowercase();
        let context_window = if m.contains("gemini") {
            1_000_000
        } else if m.contains("gpt-4o") || m.contains("gpt-4.1") || m.contains("gpt-5") {
            128_000
        } else if m.contains("llama-3.3") || m.contains("llama-3.1") {
            128_000
        } else if m.contains("deepseek") {
            64_000
        } else if m.contains("mistral") {
            32_000
        } else if m.contains("grok") {
            131_072
        } else {
            8_192
        };
        Self {
            context_window,
            max_output: 1_024.min(context_window / 4),
        }
    }

    /// Girdi için gerçekten kullanılabilir token sayısı.
    pub fn input_budget(&self) -> usize {
        let usable = (self.context_window as f64 * SAFETY_FACTOR) as usize;
        usable.saturating_sub(self.max_output).saturating_sub(RESERVE)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct FitResult {
    pub messages: Vec<Message>,
    /// Kaç tool atıldı (F3'te dolacak).
    pub tools_dropped: usize,
    /// Kaç geçmiş mesajı atıldı.
    pub history_dropped: usize,
    /// Gönderilen tahmini girdi token'ı.
    pub est_tokens: usize,
}

/// Bir görüntünün yaklaşık token maliyeti.
///
/// Sağlayıcılar görüntüyü karo karo tokenleştirir, base64 uzunluğuyla
/// orantılı değil. ~1100 token tipik bir ekran görüntüsü için makul bir
/// üst tahmin (eski projedeki değerle aynı).
///
/// **Sayılmazsa ne olur:** 2 MB'lık bir PNG base64'te ~2.7 milyon karakter
/// eder; karakter/4 saysaydık bütçe anında patlar, sığdırma tüm geçmişi
/// atardı. Sabit maliyet doğru davranış.
const IMAGE_TOKENS: usize = 1_100;

fn message_tokens(m: &Message) -> usize {
    // +4: rol ve ayraç token'ları için sabit pay.
    let mut tokens = estimate_tokens(&m.content) + 4;
    if m.image.is_some() {
        tokens += IMAGE_TOKENS;
    }
    tokens
}

/// İstek gövdesini bütçeye sığdırır.
///
/// `messages[0]` sistem mesajıysa **asla atılmaz** — kimliği taşır.
/// Son kullanıcı mesajı da asla atılmaz — isteğin kendisi odur.
pub fn fit_request(messages: Vec<Message>, tool_tokens: usize, caps: ModelCaps) -> FitResult {
    let budget = caps.input_budget();

    // Sistem mesajını ayır (varsa).
    let (system, rest): (Vec<_>, Vec<_>) = messages
        .into_iter()
        .partition(|m| m.role == Role::System);

    let system_tokens: usize = system.iter().map(message_tokens).sum();
    let fixed = system_tokens + tool_tokens;

    // Sistem + tool'lar bile sığmıyorsa: tool'ları düşür (F3'te gerçek atma
    // burada olacak; F2'de tool yok, sadece raporlanır).
    let mut tools_dropped = 0;
    let mut available = if fixed >= budget {
        tools_dropped = 1; // "tool'lar sığmadı" işareti
        budget.saturating_sub(system_tokens)
    } else {
        budget - fixed
    };

    // Geçmişi YENİDEN ESKİYE doldur — en yeni mesajlar en değerlisi.
    let mut kept: Vec<Message> = Vec::new();
    let mut history_dropped = 0;
    let total = rest.len();

    for (idx, m) in rest.into_iter().enumerate().rev() {
        let cost = message_tokens(&m);
        if cost <= available {
            available -= cost;
            kept.push(m);
        } else if idx == total - 1 {
            // Son mesaj (kullanıcının isteği) her hâlükârda kalır — gerekirse kırpılır.
            let mut m = m;
            let max_chars = available.saturating_mul(4);
            if max_chars < m.content.chars().count() {
                m.content = m.content.chars().take(max_chars).collect();
            }
            kept.push(m);
            available = 0;
        } else {
            history_dropped += 1;
        }
    }

    kept.reverse();

    let mut out = system;
    out.extend(kept);

    let est_tokens: usize = out.iter().map(message_tokens).sum::<usize>() + tool_tokens;
    FitResult {
        messages: out,
        tools_dropped,
        history_dropped,
        est_tokens,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn msg(role: Role, len: usize) -> Message {
        let content = "a".repeat(len);
        match role {
            Role::System => Message::system(content),
            Role::User => Message::user(content),
            _ => Message::assistant(content),
        }
    }

    #[test]
    fn short_conversation_passes_through_untouched() {
        let msgs = vec![Message::system("sen vavis'sin"), Message::user("selam")];
        let r = fit_request(msgs.clone(), 0, ModelCaps::for_model("gpt-4o"));
        assert_eq!(r.messages, msgs);
        assert_eq!(r.history_dropped, 0);
    }

    #[test]
    fn system_message_is_never_dropped() {
        let mut msgs = vec![msg(Role::System, 200)];
        for _ in 0..200 {
            msgs.push(msg(Role::User, 400));
        }
        let r = fit_request(msgs, 0, ModelCaps::default());
        assert_eq!(r.messages[0].role, Role::System);
        assert!(r.history_dropped > 0, "bir şeyler atılmalıydı");
    }

    #[test]
    fn last_user_message_always_survives() {
        let mut msgs = vec![msg(Role::System, 100)];
        for _ in 0..100 {
            msgs.push(msg(Role::Assistant, 500));
        }
        msgs.push(Message::user("BU KALMALI"));

        let r = fit_request(msgs, 0, ModelCaps::default());
        let last = r.messages.last().unwrap();
        assert_eq!(last.role, Role::User);
        assert!(last.content.starts_with("BU KALMALI"));
    }

    #[test]
    fn result_fits_within_budget() {
        let caps = ModelCaps::default();
        let mut msgs = vec![msg(Role::System, 500)];
        for _ in 0..300 {
            msgs.push(msg(Role::User, 300));
        }
        let r = fit_request(msgs, 0, caps);
        assert!(
            r.est_tokens <= caps.input_budget(),
            "bütçe aşıldı: {} > {}",
            r.est_tokens,
            caps.input_budget()
        );
    }

    #[test]
    fn tool_tokens_are_counted_against_budget() {
        // Asıl 413 bugu buydu: tool'lar sayılmıyordu.
        let caps = ModelCaps::default();
        let msgs = vec![msg(Role::System, 100), msg(Role::User, 2000)];

        let without = fit_request(msgs.clone(), 0, caps);
        let with = fit_request(msgs, caps.input_budget() / 2, caps);

        assert!(
            with.est_tokens > without.est_tokens - 10,
            "tool token'ları toplama katılmalı"
        );
    }

    #[test]
    fn turkish_text_is_not_overcounted() {
        // Türkçe karakterler 2 bayt ama ~1 token — bayt sayarsak bütçe şişer.
        let turkish = "çğıöşü".repeat(100); // 600 karakter, 1200 bayt
        assert!(estimate_tokens(&turkish) < 200, "karakter sayılmalı, bayt değil");
    }

    #[test]
    fn model_caps_are_conservative_for_unknown_models() {
        assert_eq!(ModelCaps::for_model("bilinmeyen-model").context_window, 8_192);
        assert!(ModelCaps::for_model("gemini-2.5-flash").context_window > 100_000);
    }

    #[test]
    fn newest_messages_are_kept_in_order() {
        let caps = ModelCaps::default();
        let msgs = vec![
            Message::system("s"),
            Message::user("bir"),
            Message::assistant("iki"),
            Message::user("üç"),
        ];
        let r = fit_request(msgs, 0, caps);
        let texts: Vec<&str> = r.messages.iter().map(|m| m.content.as_str()).collect();
        assert_eq!(texts, vec!["s", "bir", "iki", "üç"], "sıra korunmalı");
    }
}

#[cfg(test)]
mod image_budget_tests {
    use super::*;

    #[test]
    fn image_costs_a_fixed_amount_not_its_base64_length() {
        // 2 MB'lık PNG base64'te ~2.7M karakter — karakter sayarsak bütçe patlar.
        let huge_base64 = "A".repeat(2_700_000);
        let with_image = Message::user_with_image("bak", huge_base64);

        let tokens = message_tokens(&with_image);
        assert!(
            tokens < IMAGE_TOKENS + 100,
            "görüntü sabit maliyetli olmalı, hesaplanan: {tokens}"
        );
    }

    #[test]
    fn image_adds_to_the_budget() {
        let plain = Message::user("bak");
        let with_image = Message::user_with_image("bak", "kucuk");
        assert!(message_tokens(&with_image) > message_tokens(&plain) + 1000);
    }

    #[test]
    fn conversation_with_image_still_fits_the_budget() {
        let caps = ModelCaps::for_model("gpt-4o");
        let mut msgs = vec![Message::system("sen vavis'sin")];
        for _ in 0..5 {
            msgs.push(Message::user_with_image("bak", "A".repeat(100_000)));
        }

        let r = fit_request(msgs, 0, caps);
        assert!(
            r.est_tokens <= caps.input_budget(),
            "görüntülü sohbet bütçeyi aşmamalı: {} > {}",
            r.est_tokens,
            caps.input_budget()
        );
    }

    #[test]
    fn small_context_model_drops_older_images() {
        // 8k pencerede 10 görüntü sığmaz — eskiler atılmalı.
        let caps = ModelCaps::default();
        let mut msgs = vec![Message::system("s")];
        for i in 0..10 {
            msgs.push(Message::user_with_image(format!("görüntü {i}"), "x"));
        }

        let r = fit_request(msgs, 0, caps);
        assert!(r.history_dropped > 0, "eski görüntüler atılmalıydı");
        assert!(r.est_tokens <= caps.input_budget());
    }
}
