//! Spotify Web API.
//!
//! Sits alongside the media-key control in `builtin/media.rs` rather than
//! replacing it: media keys work for anyone with a player open, this works
//! for someone with an account and adds what keys cannot do — playing a
//! named song, searching the catalogue, knowing what a playlist contains.
//!
//! Only the endpoints people actually ask for out loud are wrapped. The Web
//! API has around eighty; wrapping them all would repeat the old project's
//! 353-tool mistake.

pub mod auth;

use serde_json::Value;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const API: &str = "https://api.spotify.com/v1";
const TOKEN_URL: &str = "https://accounts.spotify.com/api/token";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(12);

/// Refresh this long before the token actually expires.
///
/// A token that dies mid-request turns into a spurious error the user sees;
/// a minute of slack costs nothing.
const REFRESH_MARGIN: Duration = Duration::from_secs(60);

/// Stored credentials.
#[derive(Debug, Clone, Default, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct Token {
    pub access: String,
    pub refresh: String,
    /// Unix seconds when `access` stops working.
    pub expires_at: i64,
}

impl Token {
    fn is_fresh(&self) -> bool {
        if self.access.trim().is_empty() {
            return false;
        }
        let now = chrono::Utc::now().timestamp();
        self.expires_at > now + REFRESH_MARGIN.as_secs() as i64
    }
}

/// What the tools need to talk to Spotify.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Settings {
    /// From the user's Spotify developer dashboard. No secret: PKCE.
    pub client_id: String,
    pub token: Token,
}

impl Settings {
    pub fn is_connected(&self) -> bool {
        !self.token.refresh.trim().is_empty() || self.token.is_fresh()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum SpotifyError {
    /// No client id, or never authorised.
    NotConnected,
    /// Playback endpoints need Premium; free accounts get 403.
    NeedsPremium,
    /// Nothing is playing, or no device is active.
    NoActiveDevice,
    Failed(String),
}

impl std::fmt::Display for SpotifyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotConnected => write!(
                f,
                "Spotify bağlı değil — ayarlardan 'Spotify'a bağlan' ile izin ver"
            ),
            Self::NeedsPremium => write!(
                f,
                "bu işlem Spotify Premium istiyor; medya tuşlarıyla deneyebilirim"
            ),
            Self::NoActiveDevice => write!(
                f,
                "Spotify'da aktif cihaz yok — telefonunda veya bilgisayarında bir şey çal"
            ),
            Self::Failed(e) => write!(f, "{e}"),
        }
    }
}

fn settings() -> &'static Mutex<Settings> {
    static SETTINGS: OnceLock<Mutex<Settings>> = OnceLock::new();
    SETTINGS.get_or_init(|| Mutex::new(Settings::default()))
}

pub fn configure(new: Settings) {
    *settings().lock().unwrap_or_else(|e| e.into_inner()) = new;
    clear_now_playing_cache();
}

pub fn current() -> Settings {
    settings()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
}

/// Set by the shell so a refreshed token survives a restart.
type TokenSink = Box<dyn Fn(&Token) + Send + Sync>;

fn token_sink() -> &'static Mutex<Option<TokenSink>> {
    static SINK: OnceLock<Mutex<Option<TokenSink>>> = OnceLock::new();
    SINK.get_or_init(|| Mutex::new(None))
}

/// Registers where refreshed tokens should be persisted.
///
/// Refreshing happens deep inside a tool call, far from the key store; this
/// hands back the one thing that has to outlive the process.
pub fn on_token_refreshed(sink: impl Fn(&Token) + Send + Sync + 'static) {
    *token_sink().lock().unwrap_or_else(|e| e.into_inner()) = Some(Box::new(sink));
}

fn store_token(token: &Token) {
    {
        let mut s = settings().lock().unwrap_or_else(|e| e.into_inner());
        s.token = token.clone();
    }
    if let Some(sink) = token_sink()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .as_ref()
    {
        sink(token);
    }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

fn runtime() -> Result<tokio::runtime::Runtime, SpotifyError> {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| SpotifyError::Failed(e.to_string()))
}

fn client() -> Result<reqwest::Client, SpotifyError> {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| SpotifyError::Failed(e.to_string()))
}

/// Exchanges an authorisation code for a token pair.
pub fn exchange_code(client_id: &str, code: &str, verifier: &str) -> Result<Token, SpotifyError> {
    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", &auth::redirect_uri()),
        ("client_id", client_id.trim()),
        ("code_verifier", verifier),
    ];
    post_token(&params)
}

/// Trades the refresh token for a new access token.
fn refresh_token(client_id: &str, refresh: &str) -> Result<Token, SpotifyError> {
    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh),
        ("client_id", client_id.trim()),
    ];
    let mut token = post_token(&params)?;

    // Spotify may omit the refresh token on renewal; keeping the old one is
    // required, or the next refresh has nothing to present.
    if token.refresh.trim().is_empty() {
        token.refresh = refresh.to_string();
    }
    Ok(token)
}

fn post_token(params: &[(&str, &str)]) -> Result<Token, SpotifyError> {
    let runtime = runtime()?;
    let client = client()?;

    let (status, body) = runtime.block_on(async {
        let resp = client
            .post(TOKEN_URL)
            .form(params)
            .send()
            .await
            .map_err(|e| SpotifyError::Failed(e.to_string()))?;
        let status = resp.status().as_u16();
        let text = resp
            .text()
            .await
            .map_err(|e| SpotifyError::Failed(e.to_string()))?;
        Ok::<_, SpotifyError>((status, text))
    })?;

    if !(200..300).contains(&status) {
        let detail = serde_json::from_str::<Value>(&body)
            .ok()
            .and_then(|j| {
                j["error_description"]
                    .as_str()
                    .or_else(|| j["error"].as_str())
                    .map(str::to_string)
            })
            .unwrap_or_else(|| format!("HTTP {status}"));
        return Err(SpotifyError::Failed(format!("Spotify: {detail}")));
    }

    let json: Value =
        serde_json::from_str(&body).map_err(|_| SpotifyError::Failed("bozuk yanıt".into()))?;

    let access = json["access_token"]
        .as_str()
        .ok_or_else(|| SpotifyError::Failed("erişim anahtarı gelmedi".into()))?
        .to_string();
    let expires_in = json["expires_in"].as_i64().unwrap_or(3600);

    Ok(Token {
        access,
        refresh: json["refresh_token"].as_str().unwrap_or("").to_string(),
        expires_at: chrono::Utc::now().timestamp() + expires_in,
    })
}

/// A usable access token, refreshing first if it is close to expiry.
fn access_token() -> Result<String, SpotifyError> {
    let s = current();
    if s.client_id.trim().is_empty() {
        return Err(SpotifyError::NotConnected);
    }
    if s.token.is_fresh() {
        return Ok(s.token.access);
    }
    if s.token.refresh.trim().is_empty() {
        return Err(SpotifyError::NotConnected);
    }

    let token = refresh_token(&s.client_id, &s.token.refresh)?;
    let access = token.access.clone();
    store_token(&token);
    Ok(access)
}

/// One authorised API call. `body` is sent for PUT/POST when present.
fn call(method: reqwest::Method, path: &str, body: Option<Value>) -> Result<Value, SpotifyError> {
    let token = access_token()?;
    let runtime = runtime()?;
    let client = client()?;
    let url = format!("{API}{path}");

    let (status, text) = runtime.block_on(async {
        let mut req = client.request(method, &url).bearer_auth(&token);
        // Spotify rejects a PUT with no body and no content-length.
        req = match body {
            Some(json) => req.json(&json),
            None => req.header("Content-Length", "0"),
        };

        let resp = req
            .send()
            .await
            .map_err(|e| SpotifyError::Failed(e.to_string()))?;
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        Ok::<_, SpotifyError>((status, text))
    })?;

    match status {
        // 204 is Spotify's "done, nothing to say" for playback commands.
        204 => Ok(Value::Null),
        200..=299 => Ok(serde_json::from_str(&text).unwrap_or(Value::Null)),
        401 => Err(SpotifyError::NotConnected),
        403 => Err(SpotifyError::NeedsPremium),
        404 => Err(SpotifyError::NoActiveDevice),
        429 => Err(SpotifyError::Failed(
            "Spotify istek sınırına takıldı, biraz bekle".into(),
        )),
        s => {
            let detail = serde_json::from_str::<Value>(&text)
                .ok()
                .and_then(|j| j["error"]["message"].as_str().map(str::to_string))
                .unwrap_or_else(|| format!("HTTP {s}"));
            Err(SpotifyError::Failed(detail))
        }
    }
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

/// What is playing right now.
#[derive(Debug, Clone, PartialEq)]
pub struct NowPlaying {
    pub track: String,
    pub artist: String,
    pub album_art: Option<String>,
    /// Track length in milliseconds.
    pub duration_ms: u64,
    pub progress_ms: u64,
    pub playing: bool,
    /// Set when playback is on another device, so the panel can say where.
    pub device: Option<String>,
}

type CachedNowPlaying = Option<(Instant, Option<NowPlaying>)>;

/// Now-playing is polled by the interface; the API is rate limited, so the
/// answer is reused briefly and the progress bar is counted locally.
const NOW_PLAYING_TTL: Duration = Duration::from_secs(5);

fn now_playing_cache() -> &'static Mutex<CachedNowPlaying> {
    static CACHE: OnceLock<Mutex<CachedNowPlaying>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

pub fn clear_now_playing_cache() {
    *now_playing_cache().lock().unwrap_or_else(|e| e.into_inner()) = None;
}

fn parse_now_playing(json: &Value) -> Option<NowPlaying> {
    let item = &json["item"];
    let track = item["name"].as_str()?.to_string();

    let artist = item["artists"]
        .as_array()
        .map(|list| {
            list.iter()
                .filter_map(|a| a["name"].as_str())
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default();

    // Images come largest-first; the panel is small, so take the last.
    let album_art = item["album"]["images"]
        .as_array()
        .and_then(|images| images.last())
        .and_then(|i| i["url"].as_str())
        .map(str::to_string);

    Some(NowPlaying {
        track,
        artist,
        album_art,
        duration_ms: item["duration_ms"].as_u64().unwrap_or(0),
        progress_ms: json["progress_ms"].as_u64().unwrap_or(0),
        playing: json["is_playing"].as_bool().unwrap_or(false),
        device: json["device"]["name"].as_str().map(str::to_string),
    })
}

/// The current track, cached for the status poll.
pub fn now_playing() -> Result<Option<NowPlaying>, SpotifyError> {
    {
        let cache = now_playing_cache().lock().unwrap_or_else(|e| e.into_inner());
        if let Some((at, ref found)) = *cache {
            if at.elapsed() < NOW_PLAYING_TTL {
                return Ok(found.clone());
            }
        }
    }

    let json = call(reqwest::Method::GET, "/me/player", None)?;
    let found = if json.is_null() {
        None
    } else {
        parse_now_playing(&json)
    };

    *now_playing_cache().lock().unwrap_or_else(|e| e.into_inner()) =
        Some((Instant::now(), found.clone()));
    Ok(found)
}

/// play / pause / next / previous.
pub fn transport(action: &str) -> Result<(), SpotifyError> {
    let (method, path) = match action {
        "play" => (reqwest::Method::PUT, "/me/player/play"),
        "pause" => (reqwest::Method::PUT, "/me/player/pause"),
        "next" => (reqwest::Method::POST, "/me/player/next"),
        "previous" => (reqwest::Method::POST, "/me/player/previous"),
        other => return Err(SpotifyError::Failed(format!("bilinmeyen işlem: {other}"))),
    };
    call(method, path, None)?;
    clear_now_playing_cache();
    Ok(())
}

/// Searches the catalogue. `kind` is `track`, `album`, `artist` or `playlist`.
pub fn search(query: &str, kind: &str, limit: usize) -> Result<Vec<(String, String)>, SpotifyError> {
    let path = format!(
        "/search?q={}&type={kind}&limit={}",
        urlencode(query),
        limit.clamp(1, 20)
    );
    let json = call(reqwest::Method::GET, &path, None)?;

    let plural = format!("{kind}s");
    let items = json[&plural]["items"].as_array().cloned().unwrap_or_default();

    Ok(items
        .iter()
        .filter_map(|item| {
            let name = item["name"].as_str()?.to_string();
            let uri = item["uri"].as_str()?.to_string();
            let artist = item["artists"]
                .as_array()
                .and_then(|a| a.first())
                .and_then(|a| a["name"].as_str())
                .unwrap_or("");
            let label = if artist.is_empty() {
                name
            } else {
                format!("{name} — {artist}")
            };
            Some((label, uri))
        })
        .collect())
}

/// Starts playing a URI (track, album, playlist).
pub fn play_uri(uri: &str) -> Result<(), SpotifyError> {
    // Tracks go in `uris`, everything else is a context.
    let body = if uri.contains(":track:") {
        serde_json::json!({ "uris": [uri] })
    } else {
        serde_json::json!({ "context_uri": uri })
    };
    call(reqwest::Method::PUT, "/me/player/play", Some(body))?;
    clear_now_playing_cache();
    Ok(())
}

/// Adds a track to the queue.
pub fn queue(uri: &str) -> Result<(), SpotifyError> {
    let path = format!("/me/player/queue?uri={}", urlencode(uri));
    call(reqwest::Method::POST, &path, None)?;
    Ok(())
}

pub fn set_volume(percent: u8) -> Result<(), SpotifyError> {
    let path = format!("/me/player/volume?volume_percent={}", percent.min(100));
    call(reqwest::Method::PUT, &path, None)?;
    Ok(())
}

pub fn set_shuffle(on: bool) -> Result<(), SpotifyError> {
    let path = format!("/me/player/shuffle?state={on}");
    call(reqwest::Method::PUT, &path, None)?;
    Ok(())
}

/// `off`, `track` or `context`.
pub fn set_repeat(mode: &str) -> Result<(), SpotifyError> {
    if !["off", "track", "context"].contains(&mode) {
        return Err(SpotifyError::Failed(
            "tekrar modu: off, track veya context".into(),
        ));
    }
    let path = format!("/me/player/repeat?state={mode}");
    call(reqwest::Method::PUT, &path, None)?;
    Ok(())
}

/// Saves the currently playing track to the library.
pub fn like_current() -> Result<String, SpotifyError> {
    let json = call(reqwest::Method::GET, "/me/player/currently-playing", None)?;
    let id = json["item"]["id"]
        .as_str()
        .ok_or(SpotifyError::NoActiveDevice)?;
    let name = json["item"]["name"].as_str().unwrap_or("parça").to_string();

    call(reqwest::Method::PUT, &format!("/me/tracks?ids={id}"), None)?;
    Ok(name)
}

/// Available playback devices as (name, id, active).
pub fn devices() -> Result<Vec<(String, String, bool)>, SpotifyError> {
    let json = call(reqwest::Method::GET, "/me/player/devices", None)?;
    Ok(json["devices"]
        .as_array()
        .map(|list| {
            list.iter()
                .filter_map(|d| {
                    Some((
                        d["name"].as_str()?.to_string(),
                        d["id"].as_str()?.to_string(),
                        d["is_active"].as_bool().unwrap_or(false),
                    ))
                })
                .collect()
        })
        .unwrap_or_default())
}

/// Moves playback to another device.
pub fn transfer(device_id: &str) -> Result<(), SpotifyError> {
    let body = serde_json::json!({ "device_ids": [device_id], "play": true });
    call(reqwest::Method::PUT, "/me/player", Some(body))?;
    clear_now_playing_cache();
    Ok(())
}

/// Downloads album artwork.
///
/// Lives here rather than in the shell because this is the layer that owns
/// HTTP. The caller decides where to cache the bytes.
pub fn fetch_album_art(url: &str) -> Result<Vec<u8>, SpotifyError> {
    if !url.starts_with("https://") {
        return Err(SpotifyError::Failed("sadece https görsel alınır".into()));
    }

    let runtime = runtime()?;
    let client = client()?;

    runtime.block_on(async {
        let resp = client
            .get(url)
            .send()
            .await
            .map_err(|e| SpotifyError::Failed(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(SpotifyError::Failed(format!(
                "görsel {} döndü",
                resp.status()
            )));
        }
        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| SpotifyError::Failed(e.to_string()))
    })
}

fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_lock() -> std::sync::MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }

    #[test]
    fn an_empty_token_is_never_fresh() {
        assert!(!Token::default().is_fresh());
    }

    #[test]
    fn a_token_expiring_within_the_margin_is_stale() {
        let now = chrono::Utc::now().timestamp();
        let almost = Token {
            access: "x".into(),
            refresh: "r".into(),
            // Inside the refresh margin: treat as stale so it is renewed
            // before a request can fail on it.
            expires_at: now + 30,
        };
        assert!(!almost.is_fresh());

        let good = Token {
            expires_at: now + 3600,
            ..almost
        };
        assert!(good.is_fresh());
    }

    #[test]
    fn a_refresh_token_alone_counts_as_connected() {
        // The access token expires constantly; the refresh token is what
        // means "the user authorised this".
        let s = Settings {
            client_id: "id".into(),
            token: Token {
                refresh: "r".into(),
                ..Default::default()
            },
        };
        assert!(s.is_connected());
        assert!(!Settings::default().is_connected());
    }

    #[test]
    fn calls_without_a_client_id_stop_before_the_network() {
        let _guard = test_lock();
        configure(Settings::default());
        assert_eq!(access_token().unwrap_err(), SpotifyError::NotConnected);
    }

    #[test]
    fn a_client_id_without_authorisation_is_still_not_connected() {
        let _guard = test_lock();
        configure(Settings {
            client_id: "abc".into(),
            token: Token::default(),
        });
        assert_eq!(access_token().unwrap_err(), SpotifyError::NotConnected);
    }

    #[test]
    fn free_accounts_get_a_message_about_premium() {
        // Playback endpoints answer 403 without Premium; the message has to
        // say so rather than leaking a status code.
        let msg = SpotifyError::NeedsPremium.to_string();
        assert!(msg.contains("Premium"), "{msg}");
        assert!(msg.contains("medya tuş"), "should offer the fallback: {msg}");
    }

    #[test]
    fn now_playing_is_parsed_from_a_realistic_payload() {
        let json = serde_json::json!({
            "is_playing": true,
            "progress_ms": 42_000,
            "device": { "name": "Phone" },
            "item": {
                "name": "Song",
                "duration_ms": 210_000,
                "artists": [{ "name": "A" }, { "name": "B" }],
                "album": { "images": [
                    { "url": "big.jpg", "height": 640 },
                    { "url": "small.jpg", "height": 64 }
                ]}
            }
        });

        let np = parse_now_playing(&json).expect("should parse");
        assert_eq!(np.track, "Song");
        assert_eq!(np.artist, "A, B", "every artist should be listed");
        assert_eq!(np.album_art.as_deref(), Some("small.jpg"), "smallest art");
        assert_eq!(np.device.as_deref(), Some("Phone"));
        assert!(np.playing);
    }

    #[test]
    fn now_playing_tolerates_a_missing_item() {
        // Spotify sends this shape between tracks and while an ad plays.
        assert!(parse_now_playing(&serde_json::json!({ "is_playing": false })).is_none());
    }

    #[test]
    fn an_unknown_transport_action_is_rejected() {
        let _guard = test_lock();
        configure(Settings::default());
        let err = transport("explode").unwrap_err();
        // It must fail on the action, not by attempting a request.
        assert!(matches!(err, SpotifyError::Failed(_)), "{err}");
    }

    #[test]
    fn repeat_mode_is_validated() {
        let _guard = test_lock();
        configure(Settings::default());
        let err = set_repeat("sometimes").unwrap_err();
        assert!(err.to_string().contains("tekrar modu"), "{err}");
    }

    #[test]
    fn urlencoding_escapes_query_text() {
        assert_eq!(urlencode("a b"), "a%20b");
        assert_eq!(urlencode("spotify:track:1"), "spotify%3Atrack%3A1");
    }
}
