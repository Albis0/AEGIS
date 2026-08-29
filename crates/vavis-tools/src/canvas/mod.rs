//! Image and video generation.
//!
//! Built the same way as [`crate::websearch`], for the same reason: image
//! services appear, change their API and disappear faster than a release
//! cycle. Nothing here is wired to one of them — providers are tried in the
//! order the user chose, and one without a key is skipped rather than failed.
//!
//! Two things this module guarantees, because the interface depends on them:
//!
//! 1. **Every result carries the parameters that made it.** A seed the
//!    provider chose is read back out of the response, not invented, so a
//!    result you liked can be produced again.
//! 2. **Bytes come back, not URLs.** Provider links expire — Replicate's in an
//!    hour — so a gallery of links is a gallery of broken images tomorrow.

pub mod providers;
pub mod storage;

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// How long a rate-limited provider is skipped. Matches the search chain:
/// long enough to stop hammering, short enough to recover within a session.
const RATE_LIMIT_COOLDOWN: Duration = Duration::from_secs(15 * 60);

/// What is being made. The two share a chain but not a provider list — most
/// image services do not do video.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Image,
    Video,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Image => "image",
            Self::Video => "video",
        }
    }

    pub fn parse(text: &str) -> Self {
        match text {
            "video" => Self::Video,
            _ => Self::Image,
        }
    }
}

/// One generation request.
#[derive(Debug, Clone, PartialEq)]
pub struct Request {
    pub prompt: String,
    pub kind: Kind,
    /// Empty means the provider's own default, so a new model upstream does
    /// not need a Vavis release.
    pub model: String,
    pub width: u32,
    pub height: u32,
    pub count: u32,
    /// `None` lets the provider pick; the chosen value comes back in the
    /// [`Asset`] so it can be reused.
    pub seed: Option<i64>,
    pub negative: String,
    /// Video only, in seconds.
    pub duration_secs: u32,
    /// A starting image: the source of a variation, or a video's first frame.
    pub init: Option<Vec<u8>>,
    /// How far a variation may drift from `init`, 0.0 (identical) to 1.0.
    pub strength: f32,
    /// Enlarge `init` instead of drawing something new.
    ///
    /// A separate flag rather than a model name because it is a different
    /// endpoint, not a different model — and because a provider that cannot
    /// do it needs to say so rather than quietly drawing a fresh image.
    pub upscale: bool,
}

impl Default for Request {
    fn default() -> Self {
        Self {
            prompt: String::new(),
            kind: Kind::Image,
            model: String::new(),
            width: 1024,
            height: 1024,
            count: 1,
            seed: None,
            negative: String::new(),
            duration_secs: 5,
            init: None,
            strength: 0.6,
            upscale: false,
        }
    }
}

impl Request {
    pub fn size_label(&self) -> String {
        format!("{}x{}", self.width, self.height)
    }

    /// The nearest aspect ratio a provider will accept.
    ///
    /// Stability and Replicate take a ratio, not a pixel size, and reject
    /// anything outside their list — so an odd size has to be snapped rather
    /// than passed through and refused.
    pub fn aspect_ratio(&self) -> &'static str {
        nearest_ratio(self.width, self.height)
    }
}

/// Allowed ratios, with their decimal value. Ordered as the providers list
/// them; the lookup picks by distance, not by position.
const RATIOS: [(&str, f64); 9] = [
    ("21:9", 21.0 / 9.0),
    ("16:9", 16.0 / 9.0),
    ("3:2", 3.0 / 2.0),
    ("5:4", 5.0 / 4.0),
    ("1:1", 1.0),
    ("4:5", 4.0 / 5.0),
    ("2:3", 2.0 / 3.0),
    ("9:16", 9.0 / 16.0),
    ("9:21", 9.0 / 21.0),
];

fn nearest_ratio(width: u32, height: u32) -> &'static str {
    if width == 0 || height == 0 {
        return "1:1";
    }
    let want = f64::from(width) / f64::from(height);
    RATIOS
        .iter()
        .min_by(|a, b| {
            (a.1 - want)
                .abs()
                .partial_cmp(&(b.1 - want).abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map_or("1:1", |(label, _)| *label)
}

/// One finished file.
#[derive(Debug, Clone, PartialEq)]
pub struct Asset {
    pub bytes: Vec<u8>,
    /// File extension without the dot, taken from the bytes rather than from
    /// what the provider claimed.
    pub ext: String,
    /// What the provider actually used — often not what was asked for, and
    /// the only thing that makes the result reproducible.
    pub seed: Option<i64>,
    pub width: u32,
    pub height: u32,
}

impl Asset {
    /// Builds an asset from raw bytes, reading the format and size out of the
    /// header. `fallback_ext` is used only when the bytes are unrecognised.
    pub fn from_bytes(bytes: Vec<u8>, fallback_ext: &str, seed: Option<i64>) -> Self {
        let ext = sniff_format(&bytes).unwrap_or(fallback_ext).to_string();
        let (width, height) = dimensions(&bytes).unwrap_or((0, 0));
        Self {
            bytes,
            ext,
            seed,
            width,
            height,
        }
    }
}

/// Identifies a format from its magic bytes.
///
/// The provider's `Content-Type` is not trusted here: several return
/// `application/octet-stream`, and a gallery that saves a PNG as `.jpg` shows
/// broken thumbnails on some platforms.
pub fn sniff_format(bytes: &[u8]) -> Option<&'static str> {
    match bytes {
        [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, ..] => Some("png"),
        [0xFF, 0xD8, 0xFF, ..] => Some("jpg"),
        [b'G', b'I', b'F', b'8', ..] => Some("gif"),
        _ if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" => Some("webp"),
        // MP4 and friends: a `ftyp` box at offset 4.
        _ if bytes.len() > 12 && &bytes[4..8] == b"ftyp" => Some("mp4"),
        _ => None,
    }
}

/// Reads pixel dimensions from an image header.
///
/// Only the still formats: the grid needs them to lay tiles out without
/// waiting for every file to decode. Video falls back to the requested size.
pub fn dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    match sniff_format(bytes)? {
        "png" => {
            // IHDR is always the first chunk: width and height at 16..24.
            let w = u32::from_be_bytes(bytes.get(16..20)?.try_into().ok()?);
            let h = u32::from_be_bytes(bytes.get(20..24)?.try_into().ok()?);
            Some((w, h))
        }
        "jpg" => jpeg_dimensions(bytes),
        "gif" => {
            let w = u16::from_le_bytes(bytes.get(6..8)?.try_into().ok()?);
            let h = u16::from_le_bytes(bytes.get(8..10)?.try_into().ok()?);
            Some((u32::from(w), u32::from(h)))
        }
        _ => None,
    }
}

/// Walks JPEG segments to the frame header, which is the only place the size
/// is written. Segments before it vary in number and length, so it has to be
/// walked rather than indexed.
fn jpeg_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    let mut i = 2; // past the SOI marker
    // `<=`: a frame header ends exactly at `i + 9`, and a file trimmed to the
    // header is still a file whose size we can read.
    while i + 9 <= bytes.len() {
        if bytes[i] != 0xFF {
            i += 1;
            continue;
        }
        let marker = bytes[i + 1];
        // SOF0..SOF15, minus the four that are not frame headers.
        let is_frame = (0xC0..=0xCF).contains(&marker)
            && !matches!(marker, 0xC4 | 0xC8 | 0xCC | 0xD8 | 0xD9);
        if is_frame {
            let h = u16::from_be_bytes(bytes.get(i + 5..i + 7)?.try_into().ok()?);
            let w = u16::from_be_bytes(bytes.get(i + 7..i + 9)?.try_into().ok()?);
            return Some((u32::from(w), u32::from(h)));
        }
        let length = u16::from_be_bytes(bytes.get(i + 2..i + 4)?.try_into().ok()?);
        if length < 2 {
            return None; // malformed; walking further would loop
        }
        i += 2 + usize::from(length);
    }
    None
}

/// Why a provider did not produce anything.
#[derive(Debug, Clone, PartialEq)]
pub enum GenError {
    /// No key, or no endpoint configured — this provider is simply not set up.
    NotConfigured,
    /// The provider cannot do what was asked (video from an image-only
    /// service). Not a failure, just the wrong provider.
    Unsupported,
    RateLimited,
    /// The provider refused the prompt. **This does not fail over**: every
    /// other provider would refuse it too, and trying them all just wastes
    /// quota and time.
    Refused(String),
    Failed(String),
}

impl std::fmt::Display for GenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotConfigured => write!(f, "not configured"),
            Self::Unsupported => write!(f, "does not support this"),
            Self::RateLimited => write!(f, "rate limited"),
            Self::Refused(why) => write!(f, "refused: {why}"),
            Self::Failed(e) => write!(f, "{e}"),
        }
    }
}

/// A generation backend.
pub trait Provider: Send + Sync {
    fn id(&self) -> &'static str;

    /// Whether this provider has what it needs (usually an API key).
    fn available(&self) -> bool;

    fn supports(&self, kind: Kind) -> bool;

    fn generate(&self, request: &Request) -> Result<Vec<Asset>, GenError>;
}

/// Rate-limit bookkeeping, keyed by provider id. Passed in rather than reached
/// for, so tests do not share state with each other or with production.
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

pub fn shared_cooldowns() -> &'static Cooldowns {
    static COOLDOWNS: OnceLock<Cooldowns> = OnceLock::new();
    COOLDOWNS.get_or_init(Cooldowns::new)
}

/// Clears the shared cooldowns — called after a key change, where the user has
/// just fixed the reason a provider was failing.
pub fn clear_cooldowns() {
    shared_cooldowns().clear();
}

/// What happened while walking the chain — for the interface, so a user whose
/// generation failed can see which provider said what.
#[derive(Debug, Clone, PartialEq)]
pub struct Attempt {
    pub provider: String,
    pub error: GenError,
}

/// The finished work, with the name of whoever did it.
#[derive(Debug, Clone, PartialEq)]
pub struct Generation {
    pub provider: String,
    pub model: String,
    pub assets: Vec<Asset>,
    /// Providers that failed before this one — shown as a note, not an error.
    pub attempts: Vec<Attempt>,
}

/// Runs `request` against each provider in `order` until one delivers.
///
/// A refusal ends the walk immediately. Everything else moves on: a provider
/// that is down, out of quota or missing a key is a reason to try the next
/// one, but a prompt the provider will not draw is not.
pub fn run_chain(
    providers: &[Box<dyn Provider>],
    order: &[String],
    request: &Request,
    cooldowns: &Cooldowns,
) -> Result<Generation, Vec<Attempt>> {
    let mut attempts = Vec::new();

    for id in order {
        let Some(provider) = providers.iter().find(|p| p.id() == id.as_str()) else {
            // An unknown id in config is the user's typo; skipping quietly
            // beats failing the whole request.
            continue;
        };

        if !provider.supports(request.kind) {
            continue;
        }

        if !provider.available() {
            attempts.push(Attempt {
                provider: id.clone(),
                error: GenError::NotConfigured,
            });
            continue;
        }

        if cooldowns.is_cooling(id) {
            attempts.push(Attempt {
                provider: id.clone(),
                error: GenError::RateLimited,
            });
            continue;
        }

        match provider.generate(request) {
            Ok(assets) if assets.is_empty() => {
                attempts.push(Attempt {
                    provider: id.clone(),
                    error: GenError::Failed("returned nothing".into()),
                });
            }
            Ok(assets) => {
                return Ok(Generation {
                    provider: id.clone(),
                    model: request.model.clone(),
                    assets,
                    attempts,
                })
            }
            Err(GenError::Refused(why)) => {
                attempts.push(Attempt {
                    provider: id.clone(),
                    error: GenError::Refused(why),
                });
                return Err(attempts);
            }
            Err(err) => {
                if err == GenError::RateLimited {
                    cooldowns.start(id);
                }
                tracing::debug!(provider = %id, error = %err, "canvas provider failed over");
                attempts.push(Attempt {
                    provider: id.clone(),
                    error: err,
                });
            }
        }
    }

    Err(attempts)
}

/// Provider ids that can make images, best first.
pub const DEFAULT_IMAGE_ORDER: [&str; 4] = ["openai", "stability", "replicate", "custom"];

/// Provider ids that can make video. Short on purpose — few services do it,
/// and the ones that do are billed by the second.
pub const DEFAULT_VIDEO_ORDER: [&str; 2] = ["replicate", "custom"];

/// Everything the chain needs, refreshed from config and the key store.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Settings {
    pub image_order: Vec<String>,
    pub video_order: Vec<String>,
    pub image_model: String,
    pub video_model: String,
    pub openai_key: String,
    pub stability_key: String,
    pub replicate_key: String,
    pub custom: providers::CustomConfig,
    pub custom_key: String,
}

impl Settings {
    /// Falls back to the default order when config carries none, so an empty
    /// list never silently disables generation.
    pub fn effective_order(&self, kind: Kind) -> Vec<String> {
        let (configured, fallback): (&Vec<String>, &[&str]) = match kind {
            Kind::Image => (&self.image_order, &DEFAULT_IMAGE_ORDER),
            Kind::Video => (&self.video_order, &DEFAULT_VIDEO_ORDER),
        };
        if configured.is_empty() {
            fallback.iter().map(|s| (*s).to_string()).collect()
        } else {
            configured.clone()
        }
    }

    /// The model to use when the request does not name one.
    pub fn default_model(&self, kind: Kind) -> String {
        match kind {
            Kind::Image => self.image_model.clone(),
            Kind::Video => self.video_model.clone(),
        }
    }

    fn build_providers(&self) -> Vec<Box<dyn Provider>> {
        vec![
            Box::new(providers::OpenAi {
                key: self.openai_key.clone(),
            }),
            Box::new(providers::Stability {
                key: self.stability_key.clone(),
            }),
            Box::new(providers::Replicate {
                key: self.replicate_key.clone(),
            }),
            Box::new(providers::Custom {
                config: self.custom.clone(),
                key: self.custom_key.clone(),
            }),
        ]
    }
}

/// The settings the process is currently using.
///
/// Global for the same reason the search settings are: tools are called from
/// wherever the model happens to be running, and threading a config handle
/// through every call site buys nothing.
fn settings_slot() -> &'static Mutex<Settings> {
    static SETTINGS: OnceLock<Mutex<Settings>> = OnceLock::new();
    SETTINGS.get_or_init(|| Mutex::new(Settings::default()))
}

pub fn configure(settings: Settings) {
    let mut slot = settings_slot().lock().unwrap_or_else(|e| e.into_inner());
    *slot = settings;
    clear_cooldowns();
}

pub fn settings() -> Settings {
    settings_slot()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
}

/// True when a configured provider can enlarge an existing image.
///
/// Only Stability and Replicate have a real upscale endpoint. Faking it by
/// redrawing at a larger size would give the user a different picture under a
/// button that promised the same one, bigger.
pub fn can_upscale() -> bool {
    let current = settings();
    let providers = current.build_providers();
    current.effective_order(Kind::Image).iter().any(|id| {
        matches!(id.as_str(), "stability" | "replicate")
            && providers.iter().any(|p| p.id() == id && p.available())
    })
}

/// True when at least one provider for `kind` has a key.
///
/// The interface asks this before showing a prompt box, so a user with no keys
/// gets "add a key in settings" instead of a failure after typing a prompt.
pub fn is_ready(kind: Kind) -> bool {
    let current = settings();
    let providers = current.build_providers();
    current
        .effective_order(kind)
        .iter()
        .any(|id| {
            providers
                .iter()
                .any(|p| p.id() == id && p.supports(kind) && p.available())
        })
}

/// Generates with the configured providers.
pub fn generate(mut request: Request) -> Result<Generation, Vec<Attempt>> {
    let current = settings();
    if request.model.is_empty() {
        request.model = current.default_model(request.kind);
    }
    let providers = current.build_providers();
    let order = current.effective_order(request.kind);
    run_chain(&providers, &order, &request, shared_cooldowns())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A provider that does whatever the test needs, without a network.
    struct Fake {
        id: &'static str,
        available: bool,
        kinds: &'static [Kind],
        result: std::sync::Mutex<Vec<Result<Vec<Asset>, GenError>>>,
    }

    impl Fake {
        fn working(id: &'static str, result: Result<Vec<Asset>, GenError>) -> Box<dyn Provider> {
            Box::new(Self {
                id,
                available: true,
                kinds: &[Kind::Image, Kind::Video],
                result: std::sync::Mutex::new(vec![result]),
            })
        }

        fn unavailable(id: &'static str) -> Box<dyn Provider> {
            Box::new(Self {
                id,
                available: false,
                kinds: &[Kind::Image, Kind::Video],
                result: std::sync::Mutex::new(vec![]),
            })
        }

        fn images_only(id: &'static str) -> Box<dyn Provider> {
            Box::new(Self {
                id,
                available: true,
                kinds: &[Kind::Image],
                result: std::sync::Mutex::new(vec![Ok(vec![asset(1)])]),
            })
        }
    }

    impl Provider for Fake {
        fn id(&self) -> &'static str {
            self.id
        }
        fn available(&self) -> bool {
            self.available
        }
        fn supports(&self, kind: Kind) -> bool {
            self.kinds.contains(&kind)
        }
        fn generate(&self, _request: &Request) -> Result<Vec<Asset>, GenError> {
            self.result
                .lock()
                .unwrap()
                .pop()
                .unwrap_or(Err(GenError::Failed("exhausted".into())))
        }
    }

    fn asset(seed: i64) -> Asset {
        Asset {
            bytes: vec![1, 2, 3],
            ext: "png".into(),
            seed: Some(seed),
            width: 8,
            height: 8,
        }
    }

    fn order(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn first_working_provider_answers() {
        let providers = vec![
            Fake::working("a", Ok(vec![asset(7)])),
            Fake::working("b", Ok(vec![asset(9)])),
        ];
        let got = run_chain(
            &providers,
            &order(&["a", "b"]),
            &Request::default(),
            &Cooldowns::new(),
        )
        .unwrap();

        assert_eq!(got.provider, "a");
        assert_eq!(got.assets[0].seed, Some(7));
        assert!(got.attempts.is_empty());
    }

    #[test]
    fn a_failure_moves_to_the_next_provider() {
        let providers = vec![
            Fake::working("a", Err(GenError::Failed("boom".into()))),
            Fake::working("b", Ok(vec![asset(9)])),
        ];
        let got = run_chain(
            &providers,
            &order(&["a", "b"]),
            &Request::default(),
            &Cooldowns::new(),
        )
        .unwrap();

        assert_eq!(got.provider, "b");
        // The failure is reported, not hidden: the user paid for that attempt.
        assert_eq!(got.attempts.len(), 1);
        assert_eq!(got.attempts[0].provider, "a");
    }

    #[test]
    fn a_refusal_stops_the_chain() {
        let providers = vec![
            Fake::working("a", Err(GenError::Refused("policy".into()))),
            Fake::working("b", Ok(vec![asset(9)])),
        ];
        let attempts = run_chain(
            &providers,
            &order(&["a", "b"]),
            &Request::default(),
            &Cooldowns::new(),
        )
        .unwrap_err();

        // Every provider would refuse the same prompt; walking the rest of the
        // chain only wastes the user's quota.
        assert_eq!(attempts.len(), 1);
        assert!(matches!(attempts[0].error, GenError::Refused(_)));
    }

    #[test]
    fn a_provider_without_a_key_is_skipped_not_failed() {
        let providers = vec![Fake::unavailable("a"), Fake::working("b", Ok(vec![asset(1)]))];
        let got = run_chain(
            &providers,
            &order(&["a", "b"]),
            &Request::default(),
            &Cooldowns::new(),
        )
        .unwrap();

        assert_eq!(got.provider, "b");
        assert_eq!(got.attempts[0].error, GenError::NotConfigured);
    }

    #[test]
    fn a_provider_that_cannot_do_video_is_passed_over_silently() {
        let providers = vec![
            Fake::images_only("stills"),
            Fake::working("motion", Ok(vec![asset(3)])),
        ];
        let request = Request {
            kind: Kind::Video,
            ..Request::default()
        };
        let got = run_chain(
            &providers,
            &order(&["stills", "motion"]),
            &request,
            &Cooldowns::new(),
        )
        .unwrap();

        assert_eq!(got.provider, "motion");
        // Not an attempt: it was never the right provider for this request.
        assert!(got.attempts.is_empty());
    }

    #[test]
    fn a_rate_limit_puts_the_provider_on_cooldown() {
        let cooldowns = Cooldowns::new();
        let providers = vec![
            Fake::working("a", Err(GenError::RateLimited)),
            Fake::working("b", Ok(vec![asset(1)])),
        ];
        run_chain(
            &providers,
            &order(&["a", "b"]),
            &Request::default(),
            &cooldowns,
        )
        .unwrap();

        assert!(cooldowns.is_cooling("a"));
        assert!(!cooldowns.is_cooling("b"));
    }

    #[test]
    fn a_cooling_provider_is_not_called_again() {
        let cooldowns = Cooldowns::new();
        cooldowns.start("a");
        // "a" would succeed if it were called; it must not be.
        let providers = vec![
            Fake::working("a", Ok(vec![asset(1)])),
            Fake::working("b", Ok(vec![asset(2)])),
        ];
        let got = run_chain(
            &providers,
            &order(&["a", "b"]),
            &Request::default(),
            &cooldowns,
        )
        .unwrap();

        assert_eq!(got.provider, "b");
    }

    #[test]
    fn an_empty_result_counts_as_a_failure() {
        let providers = vec![Fake::working("a", Ok(vec![])), Fake::working("b", Ok(vec![asset(1)]))];
        let got = run_chain(
            &providers,
            &order(&["a", "b"]),
            &Request::default(),
            &Cooldowns::new(),
        )
        .unwrap();

        assert_eq!(got.provider, "b");
        assert_eq!(got.attempts.len(), 1);
    }

    #[test]
    fn an_unknown_id_in_config_is_ignored() {
        let providers = vec![Fake::working("b", Ok(vec![asset(1)]))];
        let got = run_chain(
            &providers,
            &order(&["typo", "b"]),
            &Request::default(),
            &Cooldowns::new(),
        )
        .unwrap();

        assert_eq!(got.provider, "b");
        assert!(got.attempts.is_empty());
    }

    #[test]
    fn an_exhausted_chain_reports_every_attempt() {
        let providers = vec![
            Fake::working("a", Err(GenError::Failed("down".into()))),
            Fake::unavailable("b"),
        ];
        let attempts = run_chain(
            &providers,
            &order(&["a", "b"]),
            &Request::default(),
            &Cooldowns::new(),
        )
        .unwrap_err();

        assert_eq!(attempts.len(), 2);
    }

    #[test]
    fn an_empty_configured_order_falls_back_to_the_default() {
        let settings = Settings::default();
        assert_eq!(
            settings.effective_order(Kind::Image),
            order(&DEFAULT_IMAGE_ORDER)
        );
        assert_eq!(
            settings.effective_order(Kind::Video),
            order(&DEFAULT_VIDEO_ORDER)
        );
    }

    #[test]
    fn odd_sizes_snap_to_the_nearest_allowed_ratio() {
        assert_eq!(nearest_ratio(1024, 1024), "1:1");
        assert_eq!(nearest_ratio(1920, 1080), "16:9");
        assert_eq!(nearest_ratio(1080, 1920), "9:16");
        // 1000x1400 is 5:7 — not on the list, and 2:3 is the closest.
        assert_eq!(nearest_ratio(1000, 1400), "2:3");
        // A zero would divide by zero; square is the safe answer.
        assert_eq!(nearest_ratio(0, 0), "1:1");
    }

    #[test]
    fn png_size_is_read_from_the_header() {
        let mut png = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        png.extend_from_slice(&[0, 0, 0, 13]); // IHDR length
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&640u32.to_be_bytes());
        png.extend_from_slice(&480u32.to_be_bytes());

        assert_eq!(sniff_format(&png), Some("png"));
        assert_eq!(dimensions(&png), Some((640, 480)));
    }

    #[test]
    fn jpeg_size_is_found_by_walking_the_segments() {
        // SOI, then an APP0 segment to skip over, then SOF0 with the size.
        let mut jpg = vec![0xFF, 0xD8];
        jpg.extend_from_slice(&[0xFF, 0xE0, 0x00, 0x04, 0x00, 0x00]);
        jpg.extend_from_slice(&[0xFF, 0xC0, 0x00, 0x11, 0x08]);
        jpg.extend_from_slice(&300u16.to_be_bytes()); // height
        jpg.extend_from_slice(&200u16.to_be_bytes()); // width

        assert_eq!(sniff_format(&jpg), Some("jpg"));
        assert_eq!(dimensions(&jpg), Some((200, 300)));
    }

    #[test]
    fn a_truncated_jpeg_does_not_loop_forever() {
        // A zero-length segment would leave the walk on the same byte.
        let jpg = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00, 0, 0, 0, 0, 0, 0];
        assert_eq!(dimensions(&jpg), None);
    }

    #[test]
    fn video_bytes_are_recognised_but_have_no_dimensions() {
        let mut mp4 = vec![0, 0, 0, 0x18];
        mp4.extend_from_slice(b"ftypmp42");
        mp4.extend_from_slice(&[0; 8]);

        assert_eq!(sniff_format(&mp4), Some("mp4"));
        assert_eq!(dimensions(&mp4), None);
    }

    #[test]
    fn the_extension_comes_from_the_bytes_not_the_claim() {
        let mut png = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        png.extend_from_slice(&[0, 0, 0, 13]);
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&64u32.to_be_bytes());
        png.extend_from_slice(&64u32.to_be_bytes());

        // The provider said jpg; the bytes say otherwise.
        let asset = Asset::from_bytes(png, "jpg", Some(5));
        assert_eq!(asset.ext, "png");
        assert_eq!((asset.width, asset.height), (64, 64));
    }

    #[test]
    fn unrecognised_bytes_keep_the_declared_extension() {
        let asset = Asset::from_bytes(vec![1, 2, 3, 4], "webm", None);
        assert_eq!(asset.ext, "webm");
        assert_eq!((asset.width, asset.height), (0, 0));
    }
}
