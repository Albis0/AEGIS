//! The council — several models on one question.
//!
//! One conversation is one train of thought. Some questions want more than
//! that: the same question put to Claude and to a local model, side by side,
//! is worth more than either answer alone.
//!
//! Three rules shape everything here.
//!
//! **Parallel means parallel.** Seats in a wave are sent together and awaited
//! together. Running them one after another would make this an expensive way
//! to talk to one model four times.
//!
//! **One seat failing is one seat failing.** A rate limit or a dead key ends
//! that seat's turn and nothing else. The whole point is having other answers.
//!
//! **Nothing spawns itself.** The user says how many seats, which models and
//! what task. A system that decides on its own to open four more seats has an
//! unpredictable bill and no way to debug it.

use vavis_brain::{estimate_tokens, ChatConfig, Message, Provider};

/// One participant.
#[derive(Debug, Clone, PartialEq)]
pub struct Seat {
    /// Stable identifier, so events can be routed to the right panel.
    pub id: String,
    pub provider: String,
    pub model: String,
    /// Whether this seat is shown what the independent seats said.
    ///
    /// Off is the default and the interesting case: two models that have not
    /// seen each other's work give genuinely independent answers, and an
    /// answer that merely agrees with one it was just shown is worth little.
    pub sees_others: bool,
    /// Extra instruction for this seat alone — "argue the opposite", "be the
    /// sceptic". Empty for most seats.
    pub brief: String,
}

/// How the run is ordered.
///
/// Independent seats go first, all at once. Seats that read the others follow,
/// also all at once, with the first wave's answers in hand. Two waves rather
/// than one is what makes "have one agent critique another" possible without
/// giving up parallelism inside each wave.
pub fn plan(seats: &[Seat]) -> (Vec<usize>, Vec<usize>) {
    let independent = seats
        .iter()
        .enumerate()
        .filter(|(_, s)| !s.sees_others)
        .map(|(i, _)| i)
        .collect::<Vec<_>>();
    let informed = seats
        .iter()
        .enumerate()
        .filter(|(_, s)| s.sees_others)
        .map(|(i, _)| i)
        .collect::<Vec<_>>();

    (independent, informed)
}

/// What one seat gets sent.
///
/// `prior` holds the answers from the first wave, as (seat label, text). It is
/// empty for an independent seat.
pub fn build_messages(task: &str, seat: &Seat, prior: &[(String, String)]) -> Vec<Message> {
    let mut system = String::from(
        "You are one of several assistants answering the same question \
         independently. Answer it directly and completely. Do not ask the \
         user follow-up questions.",
    );
    if !seat.brief.trim().is_empty() {
        system.push_str("\n\nYour particular angle: ");
        system.push_str(seat.brief.trim());
    }

    let mut user = task.to_string();
    if !prior.is_empty() {
        user.push_str("\n\n---\nOther assistants answered as follows.");
        for (label, text) in prior {
            user.push_str(&format!("\n\n## {label}\n{text}"));
        }
        user.push_str(
            "\n\n---\nUse these as material: say where you agree, where you \
             disagree, and what they missed.",
        );
    }

    vec![Message::system(system), Message::user(user)]
}

/// A short label for a seat, used in the transcript handed to later seats.
pub fn label(seat: &Seat) -> String {
    if seat.model.trim().is_empty() {
        seat.provider.clone()
    } else {
        format!("{} · {}", seat.provider, seat.model)
    }
}

/// What a seat's turn is expected to cost, before it runs.
///
/// Shown before the button is pressed. The output side is a guess — nobody
/// knows how long an answer will be — so it assumes a full-length reply and
/// therefore over-estimates rather than under.
pub fn forecast(task: &str, seats: &[Seat]) -> Forecast {
    /// A generous assumption for a reply, so the number shown is a ceiling.
    const ASSUMED_OUTPUT: usize = 800;

    let input = estimate_tokens(task) + 60; // plus the system prompt
    let mut total_tokens = 0;
    let mut dollars = 0.0;
    let mut priced = 0;

    for seat in seats {
        // A seat reading the others carries their answers on top of the task.
        let seat_input = if seat.sees_others {
            input + ASSUMED_OUTPUT * seats.iter().filter(|s| !s.sees_others).count()
        } else {
            input
        };
        total_tokens += seat_input + ASSUMED_OUTPUT;

        if let Some(cost) = vavis_brain::estimate_cost(&seat.model, seat_input, ASSUMED_OUTPUT) {
            dollars += cost;
            priced += 1;
        }
    }

    Forecast {
        requests: seats.len(),
        tokens: total_tokens,
        dollars,
        // Reported so the interface can say "plus 2 unpriced" instead of
        // presenting a partial total as though it covered everything.
        unpriced: seats.len() - priced,
    }
}

/// The estimate shown before a run.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Forecast {
    pub requests: usize,
    pub tokens: usize,
    pub dollars: f64,
    /// Seats whose model has no published price — local models, mostly.
    pub unpriced: usize,
}

/// Turns a seat into a request configuration, or explains why it cannot.
pub fn config_for(seat: &Seat, key: &str) -> Result<ChatConfig, String> {
    let provider = Provider::parse(&seat.provider)
        .ok_or_else(|| format!("unknown provider: {}", seat.provider))?;

    if provider.needs_key() && key.trim().is_empty() {
        return Err(format!("no API key for {}", seat.provider));
    }

    let model = if seat.model.trim().is_empty() {
        provider.default_model().to_string()
    } else {
        seat.model.clone()
    };

    Ok(ChatConfig::new(provider, model, key))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seat(id: &str, sees_others: bool) -> Seat {
        Seat {
            id: id.to_string(),
            provider: "groq".to_string(),
            model: "llama-3.3-70b".to_string(),
            sees_others,
            brief: String::new(),
        }
    }

    #[test]
    fn independent_seats_all_go_in_the_first_wave() {
        let seats = vec![seat("a", false), seat("b", false), seat("c", false)];
        let (first, second) = plan(&seats);

        // All three at once. One after another would make this four
        // conversations with one model, not a council.
        assert_eq!(first, vec![0, 1, 2]);
        assert!(second.is_empty());
    }

    #[test]
    fn a_seat_that_reads_the_others_waits_for_them() {
        let seats = vec![seat("a", false), seat("critic", true), seat("b", false)];
        let (first, second) = plan(&seats);

        assert_eq!(first, vec![0, 2]);
        assert_eq!(second, vec![1]);
    }

    #[test]
    fn a_council_of_only_critics_still_runs() {
        // Nothing to critique, but the run must not deadlock waiting for a
        // first wave that will never happen.
        let seats = vec![seat("a", true), seat("b", true)];
        let (first, second) = plan(&seats);

        assert!(first.is_empty());
        assert_eq!(second, vec![0, 1]);
    }

    #[test]
    fn an_independent_seat_is_not_told_what_the_others_said() {
        let messages = build_messages("why is the sky blue", &seat("a", false), &[]);
        let text = messages[1].content.clone();

        assert_eq!(text, "why is the sky blue");
        assert!(!text.contains("Other assistants"));
    }

    #[test]
    fn an_informed_seat_receives_the_earlier_answers() {
        let prior = vec![
            ("groq · llama".to_string(), "Rayleigh scattering.".to_string()),
            ("openai · gpt".to_string(), "Short wavelengths.".to_string()),
        ];
        let messages = build_messages("why is the sky blue", &seat("critic", true), &prior);
        let text = &messages[1].content;

        assert!(text.contains("Rayleigh scattering."));
        assert!(text.contains("Short wavelengths."));
        assert!(text.contains("groq · llama"));
    }

    #[test]
    fn a_seat_brief_reaches_the_system_prompt_not_the_task() {
        let mut s = seat("devil", false);
        s.brief = "argue the opposite".into();
        let messages = build_messages("is X a good idea", &s, &[]);

        assert!(messages[0].content.contains("argue the opposite"));
        // The user turn stays the shared task; every seat answers the same
        // question, and mixing the brief in would change it.
        assert_eq!(messages[1].content, "is X a good idea");
    }

    #[test]
    fn seats_are_told_not_to_ask_follow_up_questions() {
        // Four panels each opening with "could you clarify?" is the failure
        // mode this interface must not have.
        let messages = build_messages("do the thing", &seat("a", false), &[]);
        assert!(messages[0].content.contains("follow-up"));
    }

    #[test]
    fn the_forecast_grows_with_every_seat() {
        let one = forecast("a task", &[seat("a", false)]);
        let three = forecast(
            "a task",
            &[seat("a", false), seat("b", false), seat("c", false)],
        );

        assert_eq!(one.requests, 1);
        assert_eq!(three.requests, 3);
        // Three agents is three times the tokens, which is the number the
        // user has to see before pressing go.
        assert!(three.tokens > one.tokens * 2);
    }

    #[test]
    fn a_seat_reading_the_others_is_forecast_as_more_expensive() {
        let plain = forecast("a task", &[seat("a", false), seat("b", false)]);
        let with_critic = forecast(
            "a task",
            &[seat("a", false), seat("b", false), seat("critic", true)],
        );

        // The critic carries both answers as input, so it is not simply one
        // more seat's worth.
        assert!(with_critic.tokens > plain.tokens + 900);
    }

    #[test]
    fn unpriced_models_are_counted_rather_than_treated_as_free() {
        let mut local = seat("local", false);
        local.model = "my-own-model".into();
        let f = forecast("a task", &[local]);

        assert_eq!(f.unpriced, 1);
        assert_eq!(f.dollars, 0.0);
    }

    #[test]
    fn a_priced_model_produces_a_number() {
        let mut paid = seat("paid", false);
        paid.model = "claude-sonnet-4-5".into();
        let f = forecast("a task", &[paid]);

        assert_eq!(f.unpriced, 0);
        assert!(f.dollars > 0.0);
    }

    #[test]
    fn a_seat_with_no_model_falls_back_to_the_provider_default() {
        let mut s = seat("a", false);
        s.model = String::new();
        let cfg = config_for(&s, "key").unwrap();
        assert!(!cfg.model.is_empty());
    }

    #[test]
    fn a_seat_without_its_key_is_rejected_before_the_run_starts() {
        // Better here than as a failed panel: the user can fix it before
        // paying for the other three.
        let err = config_for(&seat("a", false), "  ").unwrap_err();
        assert!(err.contains("no API key"));
    }

    #[test]
    fn an_unknown_provider_is_named_in_the_error() {
        let mut s = seat("a", false);
        s.provider = "nonesuch".into();
        assert!(config_for(&s, "key").unwrap_err().contains("nonesuch"));
    }

    #[test]
    fn a_local_provider_needs_no_key() {
        let mut s = seat("a", false);
        s.provider = "local".into();
        assert!(config_for(&s, "").is_ok());
    }

    #[test]
    fn a_seat_is_labelled_by_provider_and_model() {
        assert_eq!(label(&seat("a", false)), "groq · llama-3.3-70b");

        let mut bare = seat("a", false);
        bare.model = String::new();
        assert_eq!(label(&bare), "groq");
    }
}
