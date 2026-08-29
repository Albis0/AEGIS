//! Web search provider chain.
//!
//! A single search tool reaches the model; which provider answered it is a
//! runtime detail. Providers are tried **in order** until one returns usable
//! results — never in parallel, because every parallel query would burn paid
//! quota on providers we did not end up needing.
//!
//! Failover happens on rate limits, exhausted quota, timeouts, transport
//! errors and empty result sets. A provider that reports a rate limit is put
//! on a cooldown so it stops adding its timeout to every later search.

pub mod providers;

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// How long a rate-limited provider is skipped.
///
/// Long enough that a burst of searches stops hammering a provider that
/// already said no, short enough that a per-minute limit recovers within
/// one session.
const RATE_LIMIT_COOLDOWN: Duration = Duration::from_secs(15 * 60);

/// One normalised result row.
///
/// Providers disagree on field names (`content`, `description`, `snippet`);
/// everything is flattened into this so the model sees one stable shape.
#[derive(Debug, Clone, PartialEq)]
pub struct Hit {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

/// A successful search.
#[derive(Debug, Clone, PartialEq)]
pub struct SearchResponse {
    /// Which provider produced this — shown in the UI, irrelevant to the model.
    pub provider: String,
    /// Some providers (Tavily) return a written answer alongside the links.
    pub answer: Option<String>,
    pub hits: Vec<Hit>,
}

/// Why a provider did not answer.
///
/// The distinction matters: `RateLimited` triggers a cooldown, everything else
/// just moves to the next provider.
#[derive(Debug, Clone, PartialEq)]
pub enum ProviderError {
    /// No API key configured — not an error, this provider is simply not set up.
    NotConfigured,
    /// HTTP 429 or an explicit quota message.
    RateLimited,
    /// Reached the provider but it returned nothing usable.
    Empty,
    /// Network failure, timeout, malformed response, auth rejection.
    Failed(String),
}

impl std::fmt::Display for ProviderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotConfigured => write!(f, "not configured"),
            Self::RateLimited => write!(f, "rate limited"),
            Self::Empty => write!(f, "no results"),
            Self::Failed(e) => write!(f, "{e}"),
        }
    }
}

/// A search backend.
pub trait Provider: Send + Sync {
    /// Stable identifier used in the configured order and cooldown bookkeeping.
    fn id(&self) -> &'static str;

    /// Whether this provider has what it needs to run (usually an API key).
    ///
    /// Unavailable providers are skipped silently — a user without a Tavily
    /// key should not see a Tavily failure on every search.
    fn available(&self) -> bool;

    fn search(&self, query: &str, limit: usize) -> Result<SearchResponse, ProviderError>;
}

/// Rate-limit bookkeeping, keyed by provider id.
///
/// Passed into [`run_chain`] rather than reached for as a global, so the chain
/// has no hidden state: production shares one instance, each test owns its own.
#[derive(Debug, Default)]
pub struct Cooldowns {
    until: Mutex<HashMap<String, Instant>>,
}

impl Cooldowns {
    pub fn new() -> Self {
        Self::default()
    }

    fn map(&self) -> std::sync::MutexGuard<'_, HashMap<String, Instant>> {
        self.until.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// True while `id` is serving a cooldown.
    pub fn is_cooling(&self, id: &str) -> bool {
        self.map().get(id).is_some_and(|until| Instant::now() < *until)
    }

    pub fn start(&self, id: &str) {
        self.map()
            .insert(id.to_string(), Instant::now() + RATE_LIMIT_COOLDOWN);
    }

    pub fn clear(&self) {
        self.map().clear();
    }
}

/// The instance used by [`search`].
pub fn shared_cooldowns() -> &'static Cooldowns {
    static COOLDOWNS: OnceLock<Cooldowns> = OnceLock::new();
    COOLDOWNS.get_or_init(Cooldowns::new)
}

/// Clears the shared cooldowns — called after a key change, where the user has
/// just fixed the reason a provider was failing.
pub fn clear_cooldowns() {
    shared_cooldowns().clear();
}

/// What happened while walking the chain — for logs and the UI, not the model.
#[derive(Debug, Clone, PartialEq)]
pub struct Attempt {
    pub provider: String,
    pub error: ProviderError,
}

/// Runs `query` against each provider in `order` until one succeeds.
///
/// Returns the first usable response along with the providers that failed
/// before it. An exhausted chain is an error rather than an empty result —
/// the caller needs to tell the user why nothing came back.
pub fn run_chain(
    providers: &[Box<dyn Provider>],
    order: &[String],
    query: &str,
    limit: usize,
    cooldowns: &Cooldowns,
) -> Result<(SearchResponse, Vec<Attempt>), Vec<Attempt>> {
    let mut attempts = Vec::new();

    for id in order {
        let Some(provider) = providers.iter().find(|p| p.id() == id.as_str()) else {
            // An unknown id in config is the user's typo; skip it quietly
            // rather than failing the whole search.
            continue;
        };

        if !provider.available() {
            attempts.push(Attempt {
                provider: id.clone(),
                error: ProviderError::NotConfigured,
            });
            continue;
        }

        if cooldowns.is_cooling(id) {
            attempts.push(Attempt {
                provider: id.clone(),
                error: ProviderError::RateLimited,
            });
            continue;
        }

        match provider.search(query, limit) {
            Ok(response) => return Ok((response, attempts)),
            Err(err) => {
                if err == ProviderError::RateLimited {
                    cooldowns.start(id);
                }
                tracing::debug!(provider = %id, error = %err, "search provider failed over");
                attempts.push(Attempt {
                    provider: id.clone(),
                    error: err,
                });
            }
        }
    }

    Err(attempts)
}

/// The order used until the user reorders it in settings.
///
/// Quality first, keyless last: a user who has pasted a Tavily key wants it
/// used, and a user with no keys at all still gets DuckDuckGo.
pub const DEFAULT_ORDER: [&str; 4] = ["tavily", "brave", "custom", "duckduckgo"];

/// Everything the chain needs, refreshed from config and the key store.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Settings {
    /// Provider ids, most preferred first.
    pub order: Vec<String>,
    pub tavily_key: String,
    pub brave_key: String,
    pub custom: providers::CustomConfig,
    pub custom_key: String,
}

impl Settings {
    /// Falls back to the default order when config carries none, so an empty
    /// list never silently disables search.
    pub fn effective_order(&self) -> Vec<String> {
        if self.order.is_empty() {
            DEFAULT_ORDER.iter().map(|s| s.to_string()).collect()
        } else {
            self.order.clone()
        }
    }

    fn build_providers(&self) -> Vec<Box<dyn Provider>> {
        vec![
            Box::new(providers::Tavily {
                key: self.tavily_key.clone(),
            }),
            Box::new(providers::Brave {
                key: self.brave_key.clone(),
            }),
            Box::new(providers::Custom {
                config: self.custom.clone(),
                key: self.custom_key.clone(),
            }),
            Box::new(providers::DuckDuckGo),
        ]
    }
}

fn settings() -> &'static Mutex<Settings> {
    static SETTINGS: OnceLock<Mutex<Settings>> = OnceLock::new();
    SETTINGS.get_or_init(|| Mutex::new(Settings::default()))
}

/// Installs the current settings. Called at startup and whenever keys or the
/// provider order change, so a freshly pasted key works without a restart.
pub fn configure(new: Settings) {
    *settings().lock().unwrap_or_else(|e| e.into_inner()) = new;
    // A new key is the usual reason a provider was failing; give it another go.
    clear_cooldowns();
}

/// Reads back the installed settings.
pub fn current() -> Settings {
    settings()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
}

/// Searches using the configured chain.
///
/// This is the entry point the tool layer calls; the chain itself never
/// reaches the model.
pub fn search(query: &str, limit: usize) -> Result<(SearchResponse, Vec<Attempt>), Vec<Attempt>> {
    let settings = current();
    let providers = settings.build_providers();
    run_chain(
        &providers,
        &settings.effective_order(),
        query,
        limit,
        shared_cooldowns(),
    )
}

/// Renders a response into the text handed to the model.
///
/// Kept plain and compact: the written answer when the provider gave one, then
/// numbered results. Titles and URLs stay intact so the model can cite them.
pub fn format_for_model(response: &SearchResponse, max_chars: usize) -> String {
    let mut out = String::new();

    if let Some(answer) = &response.answer {
        if !answer.trim().is_empty() {
            out.push_str(answer.trim());
            out.push_str("\n\n");
        }
    }

    for (i, hit) in response.hits.iter().enumerate() {
        out.push_str(&format!("{}. {}\n{}\n", i + 1, hit.title, hit.url));
        if !hit.snippet.trim().is_empty() {
            out.push_str(hit.snippet.trim());
            out.push('\n');
        }
        out.push('\n');
    }

    let trimmed = out.trim_end();
    if trimmed.chars().count() > max_chars {
        let clipped: String = trimmed.chars().take(max_chars).collect();
        format!("{clipped}\n…(truncated)")
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A provider with scripted behaviour, so chain logic can be tested
    /// without touching the network.
    struct Fake {
        id: &'static str,
        available: bool,
        result: Result<SearchResponse, ProviderError>,
    }

    impl Fake {
        fn ok(id: &'static str) -> Self {
            Self {
                id,
                available: true,
                result: Ok(SearchResponse {
                    provider: id.to_string(),
                    answer: None,
                    hits: vec![Hit {
                        title: "t".into(),
                        url: "https://example.com".into(),
                        snippet: "s".into(),
                    }],
                }),
            }
        }

        fn failing(id: &'static str, err: ProviderError) -> Self {
            Self {
                id,
                available: true,
                result: Err(err),
            }
        }

        fn unavailable(id: &'static str) -> Self {
            Self {
                id,
                available: false,
                result: Err(ProviderError::NotConfigured),
            }
        }
    }

    impl Provider for Fake {
        fn id(&self) -> &'static str {
            self.id
        }
        fn available(&self) -> bool {
            self.available
        }
        fn search(&self, _query: &str, _limit: usize) -> Result<SearchResponse, ProviderError> {
            self.result.clone()
        }
    }

    fn order(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|s| s.to_string()).collect()
    }

    /// Runs the chain against a throwaway cooldown map.
    ///
    /// Tests run in parallel, so they must not share the process-wide
    /// cooldowns — one test's reset would cancel another's.
    fn run_chain_t(
        providers: &[Box<dyn Provider>],
        order: &[String],
        query: &str,
        limit: usize,
    ) -> Result<(SearchResponse, Vec<Attempt>), Vec<Attempt>> {
        run_chain(providers, order, query, limit, &Cooldowns::new())
    }

    #[test]
    fn first_working_provider_wins() {
        let providers: Vec<Box<dyn Provider>> =
            vec![Box::new(Fake::ok("a")), Box::new(Fake::ok("b"))];
        let (resp, attempts) = run_chain_t(&providers, &order(&["a", "b"]), "q", 5).unwrap();
        assert_eq!(resp.provider, "a");
        assert!(attempts.is_empty(), "nothing should have failed first");
    }

    #[test]
    fn failure_falls_through_to_the_next_provider() {
        let providers: Vec<Box<dyn Provider>> = vec![
            Box::new(Fake::failing("a", ProviderError::Failed("boom".into()))),
            Box::new(Fake::ok("b")),
        ];
        let (resp, attempts) = run_chain_t(&providers, &order(&["a", "b"]), "q", 5).unwrap();
        assert_eq!(resp.provider, "b");
        assert_eq!(attempts.len(), 1);
        assert_eq!(attempts[0].provider, "a");
    }

    #[test]
    fn empty_results_fall_through_to_the_next_provider() {
        let providers: Vec<Box<dyn Provider>> = vec![
            Box::new(Fake::failing("a", ProviderError::Empty)),
            Box::new(Fake::ok("b")),
        ];
        let (resp, _) = run_chain_t(&providers, &order(&["a", "b"]), "q", 5).unwrap();
        assert_eq!(resp.provider, "b");
    }

    #[test]
    fn unavailable_providers_are_skipped() {
        let providers: Vec<Box<dyn Provider>> =
            vec![Box::new(Fake::unavailable("a")), Box::new(Fake::ok("b"))];
        let (resp, attempts) = run_chain_t(&providers, &order(&["a", "b"]), "q", 5).unwrap();
        assert_eq!(resp.provider, "b");
        assert_eq!(attempts[0].error, ProviderError::NotConfigured);
    }

    #[test]
    fn rate_limited_provider_is_skipped_on_the_next_search() {
        let providers: Vec<Box<dyn Provider>> = vec![
            Box::new(Fake::failing("a", ProviderError::RateLimited)),
            Box::new(Fake::ok("b")),
        ];
        let cooldowns = Cooldowns::new();
        let chain = order(&["a", "b"]);

        // First search trips the cooldown.
        run_chain(&providers, &chain, "q", 5, &cooldowns).unwrap();
        assert!(cooldowns.is_cooling("a"), "rate limit must start a cooldown");

        // Second search reports it as skipped rather than calling it again.
        let (resp, attempts) = run_chain(&providers, &chain, "q", 5, &cooldowns).unwrap();
        assert_eq!(resp.provider, "b");
        assert_eq!(attempts[0].error, ProviderError::RateLimited);

        cooldowns.clear();
        assert!(!cooldowns.is_cooling("a"), "clear must reset the map");
    }

    #[test]
    fn a_non_rate_limit_failure_does_not_start_a_cooldown() {
        // Only rate limits earn a cooldown; a transient network error should
        // leave the provider eligible for the very next search.
        let providers: Vec<Box<dyn Provider>> = vec![
            Box::new(Fake::failing("a", ProviderError::Failed("dns".into()))),
            Box::new(Fake::ok("b")),
        ];
        let cooldowns = Cooldowns::new();
        run_chain(&providers, &order(&["a", "b"]), "q", 5, &cooldowns).unwrap();
        assert!(!cooldowns.is_cooling("a"));
    }

    #[test]
    fn exhausted_chain_reports_every_attempt() {
        let providers: Vec<Box<dyn Provider>> = vec![
            Box::new(Fake::failing("a", ProviderError::Failed("x".into()))),
            Box::new(Fake::failing("b", ProviderError::Empty)),
        ];
        let attempts = run_chain_t(&providers, &order(&["a", "b"]), "q", 5).unwrap_err();
        assert_eq!(attempts.len(), 2);
    }

    #[test]
    fn unknown_provider_id_in_config_is_ignored() {
        let providers: Vec<Box<dyn Provider>> = vec![Box::new(Fake::ok("b"))];
        let (resp, attempts) = run_chain_t(&providers, &order(&["typo", "b"]), "q", 5).unwrap();
        assert_eq!(resp.provider, "b");
        assert!(attempts.is_empty(), "a typo is not a failed attempt");
    }

    #[test]
    fn configured_order_wins_over_registration_order() {
        let providers: Vec<Box<dyn Provider>> =
            vec![Box::new(Fake::ok("a")), Box::new(Fake::ok("b"))];
        let (resp, _) = run_chain_t(&providers, &order(&["b", "a"]), "q", 5).unwrap();
        assert_eq!(resp.provider, "b");
    }

    #[test]
    fn formatting_includes_answer_and_numbered_hits() {
        let resp = SearchResponse {
            provider: "tavily".into(),
            answer: Some("Short answer.".into()),
            hits: vec![
                Hit {
                    title: "First".into(),
                    url: "https://a.example".into(),
                    snippet: "one".into(),
                },
                Hit {
                    title: "Second".into(),
                    url: "https://b.example".into(),
                    snippet: "two".into(),
                },
            ],
        };
        let text = format_for_model(&resp, 10_000);
        assert!(text.starts_with("Short answer."));
        assert!(text.contains("1. First"));
        assert!(text.contains("2. Second"));
        assert!(text.contains("https://b.example"));
    }

    #[test]
    fn formatting_truncates_long_output() {
        let resp = SearchResponse {
            provider: "x".into(),
            answer: Some("a".repeat(500)),
            hits: vec![],
        };
        let text = format_for_model(&resp, 100);
        assert!(text.contains("truncated"));
        assert!(text.chars().count() < 200);
    }

    #[test]
    fn formatting_omits_absent_answer() {
        let resp = SearchResponse {
            provider: "brave".into(),
            answer: None,
            hits: vec![Hit {
                title: "Only".into(),
                url: "https://x.example".into(),
                snippet: String::new(),
            }],
        };
        let text = format_for_model(&resp, 10_000);
        assert!(text.starts_with("1. Only"));
    }
}
