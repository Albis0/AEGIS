//! Spotify authorisation — OAuth with PKCE.
//!
//! PKCE rather than the client-secret flow: a desktop app cannot keep a
//! secret, so there is none. The app sends a hash of a random verifier up
//! front and the verifier itself when redeeming the code, which is what stops
//! an intercepted code from being useful to anyone else.
//!
//! The browser comes back to a loopback listener that accepts exactly one
//! request and then closes. That page is the only screen the user sees after
//! being sent out to the browser, so it is a real page rather than a bare
//! "200 OK".

use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener};
use std::time::{Duration, Instant};

/// Loopback port for the redirect.
///
/// Fixed rather than random: Spotify requires the exact redirect URI to be
/// registered on the developer dashboard, so it cannot change per run. This
/// particular number is the one registered against [`DEFAULT_CLIENT_ID`], so
/// changing it breaks connecting for everyone who has not registered an app
/// of their own.
pub const CALLBACK_PORT: u16 = 17832;

/// The application's own Spotify client id.
///
/// This is why connecting is one click: without it every user would have to
/// visit the developer dashboard, register an app, copy the redirect URI in
/// and the id back out before the button did anything.
///
/// It is not a secret and does not belong in `keys.dat`. PKCE exists
/// precisely because a desktop app cannot keep a secret, so a public client
/// has no secret to keep: the client id is shipped inside every native
/// Spotify integration there is, and on its own it authorises nothing. The
/// tokens it eventually yields are secrets, and those do go to `keys.dat`.
pub const DEFAULT_CLIENT_ID: &str = "3650da8ef6774cc99e857cfdc1d9999a";

/// The client id to actually use.
///
/// A configured id overrides the built-in one, which is what someone wants if
/// they would rather the consent screen carried their own app's name, or they
/// need scopes this build does not ask for. Empty means the built-in one, so
/// clearing the box in settings goes back to the zero-setup path rather than
/// breaking the integration.
pub fn client_id_or_default(configured: &str) -> &str {
    let trimmed = configured.trim();
    if trimmed.is_empty() {
        DEFAULT_CLIENT_ID
    } else {
        trimmed
    }
}

/// The redirect URI that must be registered in the Spotify app settings.
///
/// Only relevant to someone bringing their own client id; the built-in app
/// already has it registered.
pub fn redirect_uri() -> String {
    format!("http://127.0.0.1:{CALLBACK_PORT}/callback")
}

/// How long the listener waits before giving up.
///
/// Long enough to log in and read a consent screen, short enough that an
/// abandoned attempt does not leave a socket open all session.
const LISTEN_TIMEOUT: Duration = Duration::from_secs(90);

/// Scopes requested.
///
/// Kept to what the tools actually use — every extra scope is one more line
/// on the consent screen and one more thing to justify.
pub const SCOPES: &str = "user-read-playback-state user-modify-playback-state \
                          user-read-currently-playing playlist-read-private \
                          user-library-modify user-library-read";

/// URL-safe base64 without padding, as PKCE requires.
fn base64url(bytes: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);

    for chunk in bytes.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;

        out.push(ALPHABET[(n >> 18) as usize & 63] as char);
        out.push(ALPHABET[(n >> 12) as usize & 63] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[(n >> 6) as usize & 63] as char);
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[n as usize & 63] as char);
        }
    }

    out
}

/// A fresh PKCE verifier and its challenge.
pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
    /// Opaque value echoed back by Spotify; guards against a stray request
    /// on the loopback port being mistaken for our callback.
    pub state: String,
}

impl Pkce {
    pub fn generate() -> Self {
        use rand::RngCore;

        let mut rng = rand::thread_rng();
        let mut verifier_bytes = [0u8; 48];
        let mut state_bytes = [0u8; 16];
        rng.fill_bytes(&mut verifier_bytes);
        rng.fill_bytes(&mut state_bytes);

        let verifier = base64url(&verifier_bytes);
        let challenge = base64url(&Sha256::digest(verifier.as_bytes()));

        Self {
            verifier,
            challenge,
            state: base64url(&state_bytes),
        }
    }
}

/// Checks that a string looks like a Spotify client id.
///
/// Worth doing because of one specific mistake, which is easy to make and
/// impossible to diagnose from the result: the settings screen prints the
/// redirect URI directly above the client id box, and pasting the URI into
/// the box is the obvious slip. Spotify then answers the authorise request
/// with a bare `client_id: Not present` page -- it does not say the id was
/// malformed, or echo what it received, so the user is left staring at a
/// blank white page with no way to tell what went wrong.
///
/// The id is a 32-character lowercase hex string. Rather than insist on that
/// exactly -- Spotify has never promised the format, and a future change
/// would lock people out of their own settings -- this rejects only what is
/// definitely not an id: something with a scheme, a slash, or whitespace in
/// it, or something far from the right length.
pub fn check_client_id(raw: &str) -> Result<(), String> {
    let id = raw.trim();

    if id.is_empty() {
        return Err("client id is empty".into());
    }
    if id.contains("://") || id.starts_with("http") {
        return Err(format!(
            "that is a URL, not a client id -- {} goes on the Spotify              dashboard as the redirect URI, and the client id is the 32              character code the dashboard shows next to it",
            redirect_uri()
        ));
    }
    if id.contains('/') || id.contains(char::is_whitespace) {
        return Err("a client id has no slashes or spaces in it".into());
    }
    if !id.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("a client id is letters and digits only".into());
    }
    // The real ones are exactly 32; allow a little room rather than break if
    // Spotify ever changes the length.
    if !(20..=64).contains(&id.chars().count()) {
        return Err(format!(
            "a client id is 32 characters long -- this one is {}",
            id.chars().count()
        ));
    }
    Ok(())
}

/// The URL to open in the browser.
pub fn authorize_url(client_id: &str, pkce: &Pkce) -> String {
    format!(
        "https://accounts.spotify.com/authorize\
         ?response_type=code\
         &client_id={}\
         &scope={}\
         &code_challenge_method=S256\
         &code_challenge={}\
         &redirect_uri={}\
         &state={}",
        urlencode(client_id.trim()),
        urlencode(SCOPES),
        pkce.challenge,
        urlencode(&redirect_uri()),
        pkce.state
    )
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

/// Pulls `key` out of a query string.
pub fn query_param(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let (name, value) = pair.split_once('=')?;
        (name == key).then(|| urldecode(value))
    })
}

fn urldecode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;

    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
                match u8::from_str_radix(hex, 16) {
                    Ok(byte) => {
                        out.push(byte);
                        i += 3;
                    }
                    Err(_) => {
                        out.push(bytes[i]);
                        i += 1;
                    }
                }
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }

    String::from_utf8_lossy(&out).to_string()
}

/// The page the browser lands on.
///
/// Everything is inline: this must render identically with no network, and
/// pulling a font or a stylesheet from a CDN would be both slower and a
/// pointless disclosure that someone just linked their Spotify.
fn result_page(title: &str, message: &str, retry: bool) -> String {
    let retry_link = if retry {
        "<p class=\"retry\">Vavis'e dön ve tekrar dene.</p>"
    } else {
        ""
    };

    format!(
        "<!doctype html><html lang=\"tr\"><head><meta charset=\"utf-8\">\
         <title>Vavis · Spotify</title><style>\
         :root{{color-scheme:dark}}\
         body{{margin:0;min-height:100vh;display:flex;align-items:center;\
         justify-content:center;background:#0a111a;\
         font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:#c8d6e5}}\
         .card{{max-width:26rem;padding:2.5rem;border:1px solid #1e3342;\
         border-radius:8px;background:rgba(16,26,38,.7);text-align:center}}\
         h1{{margin:0 0 .75rem;font-size:1.05rem;letter-spacing:.14em;\
         text-transform:uppercase;color:#22d3ee}}\
         p{{margin:0;font-size:.9rem;line-height:1.6}}\
         .retry{{margin-top:1rem;color:#7c93a8;font-size:.8rem}}\
         .brand{{margin-top:1.75rem;font-size:.7rem;letter-spacing:.2em;color:#44607a}}\
         </style></head><body><div class=\"card\">\
         <h1>{title}</h1><p>{message}</p>{retry_link}\
         <div class=\"brand\">VAVIS</div></div></body></html>"
    )
}

/// What came back on the loopback port.
pub enum Callback {
    Code(String),
    /// Spotify reported a problem, or the user pressed cancel.
    Denied(String),
}

/// Waits for the browser redirect and returns the authorisation code.
///
/// Binds to `127.0.0.1` only — never `0.0.0.0`, which would expose the
/// listener to the network for as long as it is open.
pub fn wait_for_callback(expected_state: &str) -> Result<Callback, String> {
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, CALLBACK_PORT));
    let listener = TcpListener::bind(addr).map_err(|e| {
        format!(
            "could not listen on port {CALLBACK_PORT} ({e}) -- another application may be using it"
        )
    })?;
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("could not configure the callback listener: {e}"))?;

    let started = Instant::now();

    loop {
        if started.elapsed() > LISTEN_TIMEOUT {
            return Err("the Spotify consent step timed out".into());
        }

        match listener.accept() {
            Ok((mut stream, _)) => {
                let mut buffer = [0u8; 4096];
                let read = stream.read(&mut buffer).unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..read]);

                // "GET /callback?code=...&state=... HTTP/1.1"
                let target = request
                    .lines()
                    .next()
                    .and_then(|line| line.split_whitespace().nth(1))
                    .unwrap_or("");
                let query = target.split_once('?').map(|(_, q)| q).unwrap_or("");

                let state = query_param(query, "state").unwrap_or_default();
                let outcome = if state != expected_state {
                    // Not our redirect: something else hit the port.
                    Err("an unexpected request arrived on the callback port".to_string())
                } else if let Some(code) = query_param(query, "code") {
                    Ok(Callback::Code(code))
                } else {
                    Ok(Callback::Denied(
                        query_param(query, "error")
                            .unwrap_or_else(|| "access was not granted".into()),
                    ))
                };

                let body = match &outcome {
                    Ok(Callback::Code(_)) => result_page(
                        "Connected",
                        "Your Spotify account is connected to Vavis. You can close this tab.",
                        false,
                    ),
                    Ok(Callback::Denied(reason)) => result_page("Not granted", reason, true),
                    Err(reason) => result_page("Something went wrong", reason, true),
                };

                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
                     Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(response.as_bytes());
                let _ = stream.flush();

                return outcome.map_err(|e| e.to_string());
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(120));
            }
            Err(e) => return Err(format!("bağlantı kabul edilemedi: {e}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64url_matches_the_rfc_vectors() {
        // RFC 4648 test vectors, URL alphabet, padding stripped.
        assert_eq!(base64url(b""), "");
        assert_eq!(base64url(b"f"), "Zg");
        assert_eq!(base64url(b"fo"), "Zm8");
        assert_eq!(base64url(b"foo"), "Zm9v");
        assert_eq!(base64url(b"foob"), "Zm9vYg");
        assert_eq!(base64url(b"fooba"), "Zm9vYmE");
        assert_eq!(base64url(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn base64url_never_emits_padding_or_unsafe_characters() {
        let encoded = base64url(&[251, 255, 190, 0, 1, 2]);
        assert!(!encoded.contains('='), "padding is not allowed: {encoded}");
        assert!(
            !encoded.contains('+'),
            "must use the URL alphabet: {encoded}"
        );
        assert!(
            !encoded.contains('/'),
            "must use the URL alphabet: {encoded}"
        );
    }

    #[test]
    fn the_challenge_is_the_sha256_of_the_verifier() {
        let pkce = Pkce::generate();
        let expected = base64url(&Sha256::digest(pkce.verifier.as_bytes()));
        assert_eq!(pkce.challenge, expected);
    }

    #[test]
    fn each_attempt_gets_fresh_secrets() {
        let a = Pkce::generate();
        let b = Pkce::generate();
        assert_ne!(a.verifier, b.verifier, "verifier must not repeat");
        assert_ne!(a.state, b.state, "state must not repeat");
    }

    #[test]
    fn the_verifier_is_long_enough_for_the_spec() {
        // RFC 7636 requires 43..=128 characters.
        let pkce = Pkce::generate();
        assert!(
            (43..=128).contains(&pkce.verifier.len()),
            "length {} is out of spec",
            pkce.verifier.len()
        );
    }

    #[test]
    fn the_authorize_url_carries_the_challenge_not_the_verifier() {
        let pkce = Pkce::generate();
        let url = authorize_url("abc123", &pkce);

        assert!(url.contains("code_challenge_method=S256"));
        assert!(url.contains(&format!("code_challenge={}", pkce.challenge)));
        assert!(
            !url.contains(&pkce.verifier),
            "the verifier must never leave the machine until redemption"
        );
        assert!(url.contains("client_id=abc123"));
    }

    /// Everything that matters is behind an `&`.
    ///
    /// Worth stating outright, because whatever opens this URL must not go
    /// through a Windows command shell: `&` separates commands there, so the
    /// browser is handed `...authorize?response_type=code` and nothing else.
    /// Spotify answers with a blank `client_id: Not present` page and no step
    /// in the chain reports a failure. See `open_in_browser` in the shell.
    #[test]
    fn every_parameter_but_the_first_is_behind_an_ampersand() {
        let url = authorize_url("abc123", &Pkce::generate());
        let (head, _) = url.split_once('&').expect("the URL must have parameters");

        assert!(
            !head.contains("client_id"),
            "a shell that cuts at the first & would drop the client id: {head}"
        );
        assert!(url.matches('&').count() >= 5, "{url}");
    }

    /// The exact mistake that produced a blank `client_id: Not present` page
    /// from the other direction: the redirect URI is printed above the input,
    /// so it gets pasted in.
    #[test]
    fn the_redirect_uri_is_not_accepted_as_a_client_id() {
        let err = check_client_id(&redirect_uri()).expect_err("should be rejected");
        assert!(
            err.contains("URL"),
            "the message should say what is wrong: {err}"
        );
    }

    #[test]
    fn a_real_looking_client_id_is_accepted() {
        assert!(check_client_id("4c2a1f9e8b7d6c5a4f3e2d1c0b9a8f7e").is_ok());
        // Surrounding whitespace comes free with any paste.
        assert!(check_client_id(
            "  4c2a1f9e8b7d6c5a4f3e2d1c0b9a8f7e
"
        )
        .is_ok());
    }

    #[test]
    fn obviously_wrong_ids_are_rejected() {
        for bad in [
            "",
            "   ",
            "short",
            "has spaces in it aaaaaaaaaaaaaaaa",
            "https://example.com/callback",
            "path/like/this/aaaaaaaaaaaaaaaaaa",
            "punctuation!!!!!!!!!!!!!!!!!!!!!!",
        ] {
            assert!(
                check_client_id(bad).is_err(),
                "should have been rejected: {bad:?}"
            );
        }
    }

    #[test]
    fn the_redirect_is_loopback_only() {
        let uri = redirect_uri();
        assert!(uri.starts_with("http://127.0.0.1:"), "got {uri}");
        assert!(!uri.contains("0.0.0.0"), "must never bind the network");
    }

    #[test]
    fn query_parameters_are_parsed_and_decoded() {
        let q = "code=AQD1%2Fx&state=abc&error=access%20denied";
        assert_eq!(query_param(q, "code").as_deref(), Some("AQD1/x"));
        assert_eq!(query_param(q, "state").as_deref(), Some("abc"));
        assert_eq!(query_param(q, "error").as_deref(), Some("access denied"));
        assert_eq!(query_param(q, "missing"), None);
    }

    #[test]
    fn the_result_page_is_self_contained() {
        let page = result_page("Connected", "ok", false);
        // Nothing external: the page has to render with no network at all.
        assert!(!page.contains("http://"), "no external references allowed");
        assert!(!page.contains("https://"), "no external references allowed");
        assert!(page.contains("<style>"), "styles must be inline");
    }

    #[test]
    fn only_the_requested_scopes_are_asked_for() {
        // Every extra scope is another line on the consent screen.
        assert!(!SCOPES.contains("user-follow"), "following is not used");
        assert!(!SCOPES.contains("playlist-modify"), "editing is not used");
        assert!(SCOPES.contains("user-modify-playback-state"));
    }
}
