//! Spotify tool'ları.
//!
//! `media.rs` medya tuşlarıyla çalanı kontrol ediyor ve kalıyor — hesabı
//! olmayanın yolu o. Buradakiler hesabı olan için: isimle şarkı çaldırma,
//! katalog arama, playlist bilme.
//!
//! Ücretsiz hesapta çalma uç noktaları 403 dönüyor; o durumda kullanıcıya
//! medya tuşları öneriliyor, arama ve "ne çalıyor" çalışmaya devam ediyor.

use crate::spotify::{self, SpotifyError};
use crate::tool::{arg_num, arg_str, Domain, Param, Risk, Tool, ToolOutcome};
use serde_json::Value;

const WORDS: &[&str] = &[
    "spotify", "şarkı", "track", "müzik", "muzik", "çal", "cal", "song", "music", "playlist",
];

/// Ücretsiz hesap hatasını, medya tuşu önerisiyle birlikte anlatır.
fn explain(err: SpotifyError) -> ToolOutcome {
    ToolOutcome::err(err.to_string())
}

/// Oynatma kontrolü.
pub struct Playback;

impl Tool for Playback {
    fn name(&self) -> &'static str {
        "spotify_control"
    }

    fn description(&self) -> &'static str {
        "Controls Spotify playback: play, pause, next, previous."
    }

    fn domain(&self) -> Domain {
        Domain::Spotify
    }

    fn risk(&self) -> Risk {
        // Geri alınabilir: yanlışlıkla duraklatmak felaket değil.
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("process", "play | pause | next | previous")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        WORDS
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(action) = arg_str(args, "process") else {
            return ToolOutcome::err("islem parametresi gerekli");
        };

        let mapped = match action.to_lowercase().as_str() {
            "cal" | "çal" | "play" | "devam" => "play",
            "duraklat" | "durdur" | "pause" | "stop" => "pause",
            "sonraki" | "next" | "ileri" | "geç" | "gec" => "next",
            "onceki" | "önceki" | "previous" | "geri" => "previous",
            other => return ToolOutcome::err(format!("bilinmeyen işlem: {other}")),
        };

        match spotify::transport(mapped) {
            Ok(()) => ToolOutcome::ok(format!("{action} yapıldı.")),
            Err(e) => explain(e),
        }
    }
}

/// Şu an çalan.
pub struct NowPlaying;

impl Tool for NowPlaying {
    fn name(&self) -> &'static str {
        "spotify_now_playing"
    }

    fn description(&self) -> &'static str {
        "Says which track Spotify is playing now."
    }

    fn domain(&self) -> Domain {
        Domain::Spotify
    }

    fn keywords(&self) -> &'static [&'static str] {
        WORDS
    }

    fn run(&self, _args: &Value) -> ToolOutcome {
        match spotify::now_playing() {
            Ok(Some(np)) => {
                let state = if np.playing {
                    "çalıyor"
                } else {
                    "duraklatıldı"
                };
                let mut out = format!("{} — {} ({state})", np.track, np.artist);
                if let Some(device) = &np.device {
                    out.push_str(&format!(", {device} üzerinde"));
                }
                ToolOutcome::ok(out)
            }
            Ok(None) => ToolOutcome::ok("Spotify'da şu an bir şey çalmıyor.".to_string()),
            Err(e) => explain(e),
        }
    }
}

/// Katalog araması ve çalma.
pub struct PlaySearch;

impl Tool for PlaySearch {
    fn name(&self) -> &'static str {
        "spotify_play"
    }

    fn description(&self) -> &'static str {
        "Spotify'da isimle şarkı, albüm veya playlist bulup çalar. \
         Sadece aramak için calma='hayir' ver."
    }

    fn domain(&self) -> Domain {
        Domain::Spotify
    }

    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::required("what", "Track, album, artist or playlist name"),
            Param::optional("kind", "track | album | artist | playlist (default: track)"),
            Param::optional("playing", "'no' searches without starting playback"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        WORDS
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(query) = arg_str(args, "what") else {
            return ToolOutcome::err("ne parametresi gerekli");
        };
        // The canonical values are English, because that is what the schema
        // advertises. The Turkish aliases stay because a model answering a
        // Turkish conversation sometimes fills the field in Turkish, and
        // failing the call over that would be pedantry rather than safety.
        let kind = match arg_str(args, "kind").unwrap_or("track") {
            k @ ("track" | "album" | "artist" | "playlist") => k,
            "şarkı" | "sarki" | "parça" | "parca" => "track",
            "albüm" | "albom" => "album",
            "sanatçı" | "sanatci" => "artist",
            "liste" => "playlist",
            other => return ToolOutcome::err(format!("bilinmeyen tür: {other}")),
        };

        let results = match spotify::search(query, kind, 5) {
            Ok(r) => r,
            Err(e) => return explain(e),
        };

        let Some((label, uri)) = results.first() else {
            return ToolOutcome::ok(format!("'{query}' için sonuç yok."));
        };

        let search_only = arg_str(args, "playing")
            .is_some_and(|v| matches!(v.to_lowercase().as_str(), "hayir" | "hayır" | "no"));

        if search_only {
            let listed: Vec<&str> = results.iter().map(|(l, _)| l.as_str()).collect();
            return ToolOutcome::ok(listed.join("\n"));
        }

        match spotify::play_uri(uri) {
            Ok(()) => ToolOutcome::ok(format!("çalınıyor: {label}")),
            Err(e) => explain(e),
        }
    }
}

/// Kuyruğa ekleme.
pub struct Queue;

impl Tool for Queue {
    fn name(&self) -> &'static str {
        "spotify_queue"
    }

    fn description(&self) -> &'static str {
        "Adds a track to the Spotify queue."
    }

    fn domain(&self) -> Domain {
        Domain::Spotify
    }

    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("track", "Name of the track to queue")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["kuyruk", "queue", "sıraya", "siraya", "spotify"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(query) = arg_str(args, "track") else {
            return ToolOutcome::err("sarki parametresi gerekli");
        };

        let results = match spotify::search(query, "track", 1) {
            Ok(r) => r,
            Err(e) => return explain(e),
        };
        let Some((label, uri)) = results.first() else {
            return ToolOutcome::ok(format!("'{query}' bulunamadı."));
        };

        match spotify::queue(uri) {
            Ok(()) => ToolOutcome::ok(format!("kuyruğa eklendi: {label}")),
            Err(e) => explain(e),
        }
    }
}

/// Ses, karıştırma, tekrar.
pub struct PlayerSettings;

impl Tool for PlayerSettings {
    fn name(&self) -> &'static str {
        "spotify_settings"
    }

    fn description(&self) -> &'static str {
        "Sets Spotify volume, shuffle or repeat."
    }

    fn domain(&self) -> Domain {
        Domain::Spotify
    }

    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::optional("volume", "Volume level between 0 and 100"),
            Param::optional("shuffle", "on | off"),
            Param::optional("repeat", "off | track | context"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &[
            "ses",
            "karıştır",
            "karistir",
            "shuffle",
            "tekrar",
            "repeat",
            "spotify",
        ]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let mut done: Vec<String> = Vec::new();

        if let Some(volume) = arg_num(args, "volume") {
            let percent = volume.clamp(0.0, 100.0) as u8;
            if let Err(e) = spotify::set_volume(percent) {
                return explain(e);
            }
            done.push(format!("ses %{percent}"));
        }

        if let Some(shuffle) = arg_str(args, "shuffle") {
            let on = matches!(
                shuffle.to_lowercase().as_str(),
                "acik" | "açık" | "on" | "evet"
            );
            if let Err(e) = spotify::set_shuffle(on) {
                return explain(e);
            }
            done.push(format!("karıştırma {}", if on { "açık" } else { "kapalı" }));
        }

        if let Some(repeat) = arg_str(args, "repeat") {
            if let Err(e) = spotify::set_repeat(&repeat.to_lowercase()) {
                return explain(e);
            }
            done.push(format!("tekrar {repeat}"));
        }

        if done.is_empty() {
            return ToolOutcome::err("ses, karistir veya tekrar parametrelerinden biri gerekli");
        }
        ToolOutcome::ok(done.join(", "))
    }
}

/// Beğenme.
pub struct Like;

impl Tool for Like {
    fn name(&self) -> &'static str {
        "spotify_like"
    }

    fn description(&self) -> &'static str {
        "Saves the currently playing track to the Spotify library."
    }

    fn domain(&self) -> Domain {
        Domain::Spotify
    }

    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["beğen", "begen", "like", "kaydet", "spotify"]
    }

    fn run(&self, _args: &Value) -> ToolOutcome {
        match spotify::like_current() {
            Ok(name) => ToolOutcome::ok(format!("beğenildi: {name}")),
            Err(e) => explain(e),
        }
    }
}

/// Cihaz listeleme ve değiştirme.
pub struct Devices;

impl Tool for Devices {
    fn name(&self) -> &'static str {
        "spotify_devices"
    }

    fn description(&self) -> &'static str {
        "Lists Spotify devices; moves playback to one when a name is given."
    }

    fn domain(&self) -> Domain {
        Domain::Spotify
    }

    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::optional("device", "Name of the device to switch to")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["cihaz", "device", "hoparlör", "hoparlor", "spotify"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let list = match spotify::devices() {
            Ok(l) => l,
            Err(e) => return explain(e),
        };

        if list.is_empty() {
            return ToolOutcome::ok(
                "Görünür Spotify cihazı yok — bir cihazda Spotify'ı açman gerekiyor.".to_string(),
            );
        }

        let Some(wanted) = arg_str(args, "device") else {
            let listed: Vec<String> = list
                .iter()
                .map(|(name, _, active)| {
                    if *active {
                        format!("{name} (aktif)")
                    } else {
                        name.clone()
                    }
                })
                .collect();
            return ToolOutcome::ok(listed.join("\n"));
        };

        let needle = wanted.to_lowercase();
        let matched = list
            .iter()
            .find(|(name, _, _)| name.to_lowercase().contains(&needle));

        match matched {
            Some((name, id, _)) => match spotify::transfer(id) {
                Ok(()) => ToolOutcome::ok(format!("{name} cihazına geçildi.")),
                Err(e) => explain(e),
            },
            None => ToolOutcome::err(format!("'{wanted}' adlı cihaz görünmüyor")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::spotify::Settings;

    fn test_lock() -> std::sync::MutexGuard<'static, ()> {
        static LOCK: std::sync::OnceLock<std::sync::Mutex<()>> = std::sync::OnceLock::new();
        LOCK.get_or_init(|| std::sync::Mutex::new(()))
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }

    #[test]
    fn tools_say_that_spotify_is_not_connected() {
        let _guard = test_lock();
        spotify::configure(Settings::default());

        for (name, out) in [
            ("calan", NowPlaying.run(&serde_json::json!({}))),
            (
                "kontrol",
                Playback.run(&serde_json::json!({"process": "cal"})),
            ),
            ("begen", Like.run(&serde_json::json!({}))),
        ] {
            assert!(!out.ok, "{name} bağlantısız başarılı olmamalı");
            assert!(
                out.content.contains("bağlı değil"),
                "{name}: {}",
                out.content
            );
        }
    }

    #[test]
    fn unknown_actions_are_rejected_before_any_request() {
        let _guard = test_lock();
        spotify::configure(Settings::default());

        let out = Playback.run(&serde_json::json!({"process": "havala"}));
        assert!(!out.ok);
        assert!(out.content.contains("bilinmeyen işlem"), "{}", out.content);

        let out = PlaySearch.run(&serde_json::json!({"what": "x", "kind": "kedi"}));
        assert!(out.content.contains("bilinmeyen tür"), "{}", out.content);
    }

    #[test]
    fn turkish_action_words_are_understood() {
        let _guard = test_lock();
        spotify::configure(Settings::default());

        // Bunlar tanınmalı; bağlantı olmadığı için hata "bağlı değil" olmalı,
        // "bilinmeyen işlem" değil.
        for word in ["çal", "duraklat", "sonraki", "önceki", "durdur", "geri"] {
            let out = Playback.run(&serde_json::json!({ "process": word }));
            assert!(
                out.content.contains("bağlı değil"),
                "'{word}' tanınmalıydı: {}",
                out.content
            );
        }
    }

    #[test]
    fn player_settings_need_at_least_one_parameter() {
        let _guard = test_lock();
        spotify::configure(Settings::default());
        let out = PlayerSettings.run(&serde_json::json!({}));
        assert!(!out.ok);
        assert!(out.content.contains("gerekli"), "{}", out.content);
    }

    #[test]
    fn reading_is_safe_and_control_is_moderate() {
        // Hiçbiri yıkıcı değil: en kötüsü müziği durdurmak, o da geri alınır.
        assert_eq!(NowPlaying.risk(), Risk::Safe);
        assert_eq!(Playback.risk(), Risk::Moderate);
        assert_eq!(PlaySearch.risk(), Risk::Moderate);
        assert_eq!(Like.risk(), Risk::Moderate);
    }

    #[test]
    fn missing_parameters_are_rejected() {
        assert!(!Playback.run(&serde_json::json!({})).ok);
        assert!(!PlaySearch.run(&serde_json::json!({})).ok);
        assert!(!Queue.run(&serde_json::json!({})).ok);
    }
}
