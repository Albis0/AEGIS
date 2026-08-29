//! Steam access.
//!
//! Steam is read-heavy: there is very little to control and a great deal to
//! know — what was bought, what was never played, what is on sale. The one
//! thing that changes the world is launching a game, and that goes through
//! the permission gate.
//!
//! Two sources are used, deliberately:
//!
//! * the **Web API** for the library, achievements and friends (needs a key,
//!   and a public profile);
//! * the **local Steam install** for what is running right now. The Web API
//!   reports that late and only for public profiles; reading the running
//!   processes is instant and works on a private profile too.

use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// How long an owned-games response is reused.
///
/// A library changes when something is bought — rarely — and the payload is
/// large, so re-fetching it on every question is pure waste.
const LIBRARY_TTL: Duration = Duration::from_secs(30 * 60);

const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

/// One game in the library.
#[derive(Debug, Clone, PartialEq)]
pub struct Game {
    pub appid: u32,
    pub name: String,
    /// Total playtime in minutes, as Steam reports it.
    pub minutes: u32,
}

impl Game {
    /// Playtime rendered the way a person says it.
    pub fn playtime(&self) -> String {
        match self.minutes {
            0 => "hiç oynanmamış".to_string(),
            m if m < 60 => format!("{m} dk"),
            m => {
                let (h, rest) = (m / 60, m % 60);
                if rest == 0 {
                    format!("{h} saat")
                } else {
                    format!("{h} saat {rest} dk")
                }
            }
        }
    }
}

/// Why a Steam call did not produce an answer.
#[derive(Debug, Clone, PartialEq)]
pub enum SteamError {
    /// No API key or no SteamID configured.
    NotConfigured,
    /// The call worked but came back empty, which for Steam almost always
    /// means the profile is private rather than that the account is empty.
    ProfilePrivate,
    Failed(String),
}

impl std::fmt::Display for SteamError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotConfigured => write!(
                f,
                "Steam ayarlanmamış — ayarlardan Web API anahtarı ve SteamID64 gir"
            ),
            Self::ProfilePrivate => write!(
                f,
                "Steam profili gizli görünüyor. Profil → Gizlilik Ayarları → \
                 'Oyun ayrıntıları' bölümünü Herkese Açık yap"
            ),
            Self::Failed(e) => write!(f, "{e}"),
        }
    }
}

/// Credentials, refreshed from config and the key store.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Settings {
    pub api_key: String,
    pub steam_id: String,
}

impl Settings {
    pub fn is_configured(&self) -> bool {
        !self.api_key.trim().is_empty() && !self.steam_id.trim().is_empty()
    }
}

fn settings() -> &'static Mutex<Settings> {
    static SETTINGS: OnceLock<Mutex<Settings>> = OnceLock::new();
    SETTINGS.get_or_init(|| Mutex::new(Settings::default()))
}

/// Installs credentials. Called at startup and after a settings change.
pub fn configure(new: Settings) {
    *settings().lock().unwrap_or_else(|e| e.into_inner()) = new;
    // Credentials changed: whatever is cached was fetched for someone else.
    clear_cache();
}

pub fn current() -> Settings {
    settings().lock().unwrap_or_else(|e| e.into_inner()).clone()
}

/// A library response and the moment it arrived.
type CachedLibrary = Option<(Instant, Vec<Game>)>;

/// The cached library and when it was fetched.
fn cache() -> &'static Mutex<CachedLibrary> {
    static CACHE: OnceLock<Mutex<CachedLibrary>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

pub fn clear_cache() {
    *cache().lock().unwrap_or_else(|e| e.into_inner()) = None;
}

/// A blocking GET returning the body.
///
/// Uses [`run_async`](crate::run_async): the agent loop is async, so building
/// a runtime here and blocking on it directly would panic.
fn get(url: &str) -> Result<(u16, String), SteamError> {
    crate::run_async(async {
        let client = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .user_agent("Mozilla/5.0 (compatible; Vavis/0.3)")
            .build()
            .map_err(|e| SteamError::Failed(e.to_string()))?;

        let resp = client.get(url).send().await.map_err(|e| {
            if e.is_timeout() {
                SteamError::Failed("Steam yanıt vermedi (zaman aşımı)".into())
            } else {
                SteamError::Failed(e.to_string())
            }
        })?;

        let status = resp.status().as_u16();
        let text = resp
            .text()
            .await
            .map_err(|e| SteamError::Failed(e.to_string()))?;
        Ok((status, text))
    })
    .map_err(SteamError::Failed)?
}

fn api_url(path: &str, query: &str) -> Result<String, SteamError> {
    let s = current();
    if !s.is_configured() {
        return Err(SteamError::NotConfigured);
    }
    Ok(format!(
        "https://api.steampowered.com/{path}?key={}&steamid={}{query}",
        s.api_key.trim(),
        s.steam_id.trim()
    ))
}

fn parse(body: &str) -> Result<serde_json::Value, SteamError> {
    serde_json::from_str(body).map_err(|_| SteamError::Failed("Steam yanıtı çözümlenemedi".into()))
}

/// Maps a status code onto a message worth showing.
fn check_status(status: u16) -> Result<(), SteamError> {
    match status {
        200..=299 => Ok(()),
        401 | 403 => Err(SteamError::Failed(
            "Steam anahtarı reddedildi — ayarlardan kontrol et".into(),
        )),
        429 => Err(SteamError::Failed(
            "Steam istek sınırına takıldı, biraz sonra tekrar dene".into(),
        )),
        s => Err(SteamError::Failed(format!("Steam {s} döndü"))),
    }
}

/// The owned library, cached.
pub fn library() -> Result<Vec<Game>, SteamError> {
    if let Some((at, games)) = cache().lock().unwrap_or_else(|e| e.into_inner()).clone() {
        if at.elapsed() < LIBRARY_TTL {
            return Ok(games);
        }
    }

    let url = api_url(
        "IPlayerService/GetOwnedGames/v1/",
        "&include_appinfo=1&include_played_free_games=1&format=json",
    )?;
    let (status, body) = get(&url)?;
    check_status(status)?;

    let json = parse(&body)?;
    let games = json["response"]["games"].as_array();

    // Steam answers 200 with an empty object for a private profile. Saying
    // "you own no games" there would be wrong and confusing.
    let Some(rows) = games else {
        return Err(SteamError::ProfilePrivate);
    };

    let mut out: Vec<Game> = rows
        .iter()
        .filter_map(|g| {
            Some(Game {
                appid: g["appid"].as_u64()? as u32,
                name: g["name"].as_str().unwrap_or("(isimsiz)").to_string(),
                minutes: g["playtime_forever"].as_u64().unwrap_or(0) as u32,
            })
        })
        .collect();

    if out.is_empty() {
        return Err(SteamError::ProfilePrivate);
    }

    out.sort_by_key(|g| std::cmp::Reverse(g.minutes));
    *cache().lock().unwrap_or_else(|e| e.into_inner()) = Some((Instant::now(), out.clone()));
    Ok(out)
}

/// Achievements for one game: (unlocked, total, recent names).
pub fn achievements(appid: u32) -> Result<(usize, usize, Vec<String>), SteamError> {
    let url = api_url(
        "ISteamUserStats/GetPlayerAchievements/v1/",
        &format!("&appid={appid}&l=turkish"),
    )?;
    let (status, body) = get(&url)?;
    check_status(status)?;

    let json = parse(&body)?;
    let Some(rows) = json["playerstats"]["achievements"].as_array() else {
        // Steam says so explicitly when a game simply has none.
        return Err(SteamError::Failed(
            "bu oyunun başarımı yok ya da profil gizli".into(),
        ));
    };

    let total = rows.len();
    let unlocked: Vec<String> = rows
        .iter()
        .filter(|a| a["achieved"].as_u64() == Some(1))
        .filter_map(|a| {
            a["name"]
                .as_str()
                .or_else(|| a["apiname"].as_str())
                .map(str::to_string)
        })
        .collect();

    let count = unlocked.len();
    Ok((count, total, unlocked.into_iter().rev().take(5).collect()))
}

/// Friend count and a few names.
pub fn friends() -> Result<Vec<String>, SteamError> {
    let url = api_url("ISteamUser/GetFriendList/v1/", "&relationship=friend")?;
    let (status, body) = get(&url)?;
    check_status(status)?;

    let json = parse(&body)?;
    let Some(rows) = json["friendslist"]["friends"].as_array() else {
        return Err(SteamError::ProfilePrivate);
    };

    // The list is only SteamIDs; resolving names takes a second call.
    let ids: Vec<String> = rows
        .iter()
        .filter_map(|f| f["steamid"].as_str().map(str::to_string))
        .take(50)
        .collect();
    if ids.is_empty() {
        return Ok(Vec::new());
    }

    let s = current();
    let url = format!(
        "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key={}&steamids={}",
        s.api_key.trim(),
        ids.join(",")
    );
    let (status, body) = get(&url)?;
    check_status(status)?;
    let json = parse(&body)?;

    Ok(json["response"]["players"]
        .as_array()
        .map(|players| {
            players
                .iter()
                .filter_map(|p| {
                    let name = p["personaname"].as_str()?;
                    // personastate 0 is offline; anything else is some form of
                    // online, which is the interesting part.
                    let online = p["personastate"].as_u64().unwrap_or(0) != 0;
                    let playing = p["gameextrainfo"].as_str();
                    Some(match (online, playing) {
                        (_, Some(game)) => format!("{name} — {game} oynuyor"),
                        (true, None) => format!("{name} — çevrimiçi"),
                        (false, None) => format!("{name} — çevrimdışı"),
                    })
                })
                .collect()
        })
        .unwrap_or_default())
}

/// Store details for one app: (name, price text, discount percent).
///
/// The store API needs no key, so this works for a user who never set one up.
pub fn store(appid: u32, country: &str) -> Result<(String, String, u32), SteamError> {
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={appid}&cc={country}&l=turkish"
    );
    let (status, body) = get(&url)?;
    check_status(status)?;

    let json = parse(&body)?;
    let entry = &json[appid.to_string()];
    if entry["success"].as_bool() != Some(true) {
        return Err(SteamError::Failed("mağazada bulunamadı".into()));
    }

    let data = &entry["data"];
    let name = data["name"].as_str().unwrap_or("(isimsiz)").to_string();

    if data["is_free"].as_bool() == Some(true) {
        return Ok((name, "ücretsiz".to_string(), 0));
    }

    let price = &data["price_overview"];
    let text = price["final_formatted"]
        .as_str()
        .unwrap_or("fiyat yok")
        .to_string();
    let discount = price["discount_percent"].as_u64().unwrap_or(0) as u32;
    Ok((name, text, discount))
}

/// Wishlist entries as (appid, name).
pub fn wishlist() -> Result<Vec<(u32, String)>, SteamError> {
    let s = current();
    if s.steam_id.trim().is_empty() {
        return Err(SteamError::NotConfigured);
    }

    let url = format!(
        "https://store.steampowered.com/wishlist/profiles/{}/wishlistdata/?p=0",
        s.steam_id.trim()
    );
    let (status, body) = get(&url)?;
    check_status(status)?;

    // A private wishlist answers with an empty array rather than an object.
    let json = parse(&body)?;
    let Some(map) = json.as_object() else {
        return Err(SteamError::ProfilePrivate);
    };

    let mut out: Vec<(u32, String)> = map
        .iter()
        .filter_map(|(id, entry)| {
            Some((id.parse::<u32>().ok()?, entry["name"].as_str()?.to_string()))
        })
        .collect();
    out.sort_by(|a, b| a.1.cmp(&b.1));
    Ok(out)
}

// ---------------------------------------------------------------------------
// Local Steam install
// ---------------------------------------------------------------------------

/// An installed game found on disk.
#[derive(Debug, Clone, PartialEq)]
pub struct Installed {
    pub appid: u32,
    pub name: String,
    /// Folder under `steamapps/common`.
    pub install_dir: String,
}

/// Steam's root folder.
fn steam_root() -> Option<std::path::PathBuf> {
    // The registry would be more correct, but these two cover essentially
    // every default install and need no extra dependency.
    for var in ["ProgramFiles(x86)", "ProgramFiles"] {
        if let Some(base) = std::env::var_os(var) {
            let path = std::path::PathBuf::from(base).join("Steam");
            if path.is_dir() {
                return Some(path);
            }
        }
    }
    None
}

/// Reads a value out of Steam's VDF format: `"key"  "value"`.
fn vdf_value(line: &str, key: &str) -> Option<String> {
    let mut parts = line.split('"').filter(|p| !p.trim().is_empty());
    let found = parts.next()?;
    if !found.eq_ignore_ascii_case(key) {
        return None;
    }
    parts.next().map(|v| v.trim().to_string())
}

/// Every `steamapps` folder Steam knows about, across library drives.
fn library_folders() -> Vec<std::path::PathBuf> {
    let Some(root) = steam_root() else {
        return Vec::new();
    };
    let mut folders = vec![root.join("steamapps")];

    let vdf = root.join("steamapps").join("libraryfolders.vdf");
    if let Ok(text) = std::fs::read_to_string(&vdf) {
        for line in text.lines() {
            if let Some(path) = vdf_value(line.trim(), "path") {
                let candidate =
                    std::path::PathBuf::from(path.replace("\\\\", "\\")).join("steamapps");
                if candidate.is_dir() && !folders.contains(&candidate) {
                    folders.push(candidate);
                }
            }
        }
    }

    folders
}

/// Games installed on this machine, from the `appmanifest_*.acf` files.
pub fn installed() -> Vec<Installed> {
    let mut out = Vec::new();

    for folder in library_folders() {
        let Ok(entries) = std::fs::read_dir(&folder) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("appmanifest_") || !name.ends_with(".acf") {
                continue;
            }
            let Ok(text) = std::fs::read_to_string(entry.path()) else {
                continue;
            };

            let (mut appid, mut game, mut dir) = (None, None, None);
            for line in text.lines() {
                let line = line.trim();
                if let Some(v) = vdf_value(line, "appid") {
                    appid = v.parse::<u32>().ok();
                } else if let Some(v) = vdf_value(line, "name") {
                    game = Some(v);
                } else if let Some(v) = vdf_value(line, "installdir") {
                    dir = Some(v);
                }
            }

            if let (Some(appid), Some(name), Some(install_dir)) = (appid, game, dir) {
                out.push(Installed {
                    appid,
                    name,
                    install_dir,
                });
            }
        }
    }

    out
}

/// Steam apps that are not games, or that run all the time.
///
/// Without this the "now playing" line reports Wallpaper Engine forever,
/// because it starts with Windows and never stops. Steam marks these as
/// tools in `appinfo.vdf`, but that file is a binary format; a short list of
/// the usual suspects buys the same result for none of the complexity.
const NON_GAME_APPIDS: [u32; 6] = [
    228980,  // Steamworks Common Redistributables
    431960,  // Wallpaper Engine
    250820,  // SteamVR
    1070560, // Steam Linux Runtime
    1391110, // Steam Linux Runtime 2.0
    1493710, // Proton Experimental
];

fn is_game(appid: u32) -> bool {
    !NON_GAME_APPIDS.contains(&appid)
}

/// The Steam game running right now, detected locally.
///
/// Matches running process paths against `steamapps/common/<installdir>`,
/// which is where every Steam game lives. Instant, and unlike the Web API it
/// works on a private profile.
pub fn running_game() -> Option<Installed> {
    let games: Vec<Installed> = installed()
        .into_iter()
        .filter(|g| is_game(g.appid))
        .collect();
    if games.is_empty() {
        return None;
    }

    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    for process in sys.processes().values() {
        let Some(exe) = process.exe() else {
            continue;
        };
        let path = exe.to_string_lossy().replace('\\', "/").to_lowercase();
        if !path.contains("/steamapps/common/") {
            continue;
        }
        for game in &games {
            let needle = format!("/steamapps/common/{}/", game.install_dir.to_lowercase());
            if path.contains(&needle) {
                return Some(game.clone());
            }
        }
    }

    None
}

/// How long a running-game answer is reused.
///
/// The interface polls status once a second; walking every process that
/// often would be a needless, constant cost for something that changes when
/// a game starts or stops.
const RUNNING_TTL: Duration = Duration::from_secs(10);

type CachedRunning = Option<(Instant, Option<Installed>)>;

fn running_cache() -> &'static Mutex<CachedRunning> {
    static CACHE: OnceLock<Mutex<CachedRunning>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

/// [`running_game`], throttled for the status poll.
pub fn running_game_cached() -> Option<Installed> {
    {
        let cache = running_cache().lock().unwrap_or_else(|e| e.into_inner());
        if let Some((at, ref found)) = *cache {
            if at.elapsed() < RUNNING_TTL {
                return found.clone();
            }
        }
    }

    let found = running_game();
    *running_cache().lock().unwrap_or_else(|e| e.into_inner()) =
        Some((Instant::now(), found.clone()));
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_running_game_check_is_cached_between_polls() {
        // Two calls in a row must not both walk the process table.
        let first = running_game_cached();
        let second = running_game_cached();
        assert_eq!(first, second);
        assert!(
            running_cache()
                .lock()
                .unwrap()
                .as_ref()
                .is_some_and(|(at, _)| at.elapsed() < RUNNING_TTL),
            "the answer should have been cached"
        );
    }

    #[test]
    fn playtime_reads_the_way_a_person_says_it() {
        assert_eq!(
            Game {
                appid: 1,
                name: "x".into(),
                minutes: 0
            }
            .playtime(),
            "hiç oynanmamış"
        );
        assert_eq!(
            Game {
                appid: 1,
                name: "x".into(),
                minutes: 45
            }
            .playtime(),
            "45 dk"
        );
        assert_eq!(
            Game {
                appid: 1,
                name: "x".into(),
                minutes: 120
            }
            .playtime(),
            "2 saat"
        );
        assert_eq!(
            Game {
                appid: 1,
                name: "x".into(),
                minutes: 134
            }
            .playtime(),
            "2 saat 14 dk"
        );
    }

    #[test]
    fn settings_need_both_a_key_and_an_id() {
        assert!(!Settings::default().is_configured());
        assert!(!Settings {
            api_key: "k".into(),
            steam_id: String::new()
        }
        .is_configured());
        assert!(!Settings {
            api_key: String::new(),
            steam_id: "7656".into()
        }
        .is_configured());
        assert!(Settings {
            api_key: "k".into(),
            steam_id: "7656".into()
        }
        .is_configured());
    }

    #[test]
    fn unconfigured_calls_fail_without_touching_the_network() {
        configure(Settings::default());
        assert_eq!(api_url("x", "").unwrap_err(), SteamError::NotConfigured);
    }

    #[test]
    fn vdf_lines_are_parsed() {
        assert_eq!(
            vdf_value("\"installdir\"\t\t\"Elden Ring\"", "installdir").as_deref(),
            Some("Elden Ring")
        );
        assert_eq!(
            vdf_value("\"appid\"  \"1245620\"", "appid").as_deref(),
            Some("1245620")
        );
        // A different key must not match.
        assert_eq!(vdf_value("\"name\" \"x\"", "appid"), None);
    }

    #[test]
    fn status_codes_map_to_useful_messages() {
        assert!(check_status(200).is_ok());
        assert!(matches!(check_status(403), Err(SteamError::Failed(_))));
        let rate = check_status(429).unwrap_err();
        assert!(rate.to_string().contains("sınır"), "{rate}");
    }

    #[test]
    fn a_private_profile_reads_as_private_not_empty() {
        // The whole point: Steam answers 200 with nothing, and telling the
        // user "you own no games" would be both wrong and baffling.
        let msg = SteamError::ProfilePrivate.to_string();
        assert!(msg.contains("gizli"), "{msg}");
        assert!(msg.contains("Gizlilik"), "must say how to fix it: {msg}");
    }

    #[test]
    fn always_on_utilities_are_not_reported_as_being_played() {
        // Wallpaper Engine starts with Windows; without this filter the
        // "now playing" line would never be anything else.
        assert!(!is_game(431960), "Wallpaper Engine is not a game");
        assert!(!is_game(228980), "redistributables are not a game");
        assert!(is_game(489830), "Skyrim is a game");
    }

    #[test]
    fn installed_games_scan_does_not_panic_without_steam() {
        // On a machine with no Steam this must return empty, not blow up.
        let _ = installed();
    }

    /// Reads the actual Steam install on this machine.
    ///
    /// Skipped by default — the result depends on what is installed. Run with:
    /// `cargo test -p vavis-tools local_steam -- --ignored --nocapture`
    #[test]
    #[ignore = "depends on a local Steam install"]
    fn local_steam_library_is_readable() {
        let games = installed();
        println!("{} installed games", games.len());
        for game in games.iter().take(10) {
            println!("  {} ({}) -> {}", game.name, game.appid, game.install_dir);
        }
        assert!(
            !games.is_empty(),
            "no appmanifest files parsed — check steam_root/vdf parsing"
        );

        match running_game() {
            Some(game) => println!("running now: {}", game.name),
            None => println!("no Steam game running"),
        }
    }
}
