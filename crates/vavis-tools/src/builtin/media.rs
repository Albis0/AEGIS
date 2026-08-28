//! Medya kontrolü — Spotify ve diğer oynatıcılar.
//!
//! # Neden OAuth yok
//!
//! Eski projede Spotify OAuth vardı: uygulama kaydı, istemci kimliği,
//! yönlendirme sunucusu, belirteç yenileme… Kullanıcı için kurulum yükü
//! büyük ve `spotify.ts` 1.063 satırdı.
//!
//! Burada **sistem medya tuşları** kullanılıyor. Windows bunları çalan
//! uygulamaya yönlendirir — Spotify, YouTube, VLC, tarayıcı, hepsi çalışır.
//! Kurulum sıfır.
//!
//! Bunun karşılığı: "şu şarkıyı çal" gibi arama gerektiren komutlar
//! yapılamıyor (medya tuşu böyle bir şey bilmez). Onun için Spotify
//! uygulaması `uygulama_ac` ile açılıp arama yapılabilir.

use crate::tool::{arg_str, Domain, Param, Risk, Tool, ToolOutcome};
use serde_json::Value;

#[cfg(windows)]
use super::system::run_powershell;

/// Sanal tuş kodları — Windows medya tuşları.
#[cfg(windows)]
mod vk {
    pub const MEDIA_NEXT_TRACK: u8 = 0xB0;
    pub const MEDIA_PREV_TRACK: u8 = 0xB1;
    pub const MEDIA_STOP: u8 = 0xB2;
    pub const MEDIA_PLAY_PAUSE: u8 = 0xB3;
    pub const VOLUME_MUTE: u8 = 0xAD;
    pub const VOLUME_DOWN: u8 = 0xAE;
    pub const VOLUME_UP: u8 = 0xAF;
}

/// Medya oynatma kontrolü.
pub struct MediaControl;

impl Tool for MediaControl {
    fn name(&self) -> &'static str {
        "medya_kontrol"
    }

    fn description(&self) -> &'static str {
        "Çalan müziği/videoyu kontrol eder (Spotify, YouTube, VLC — hepsi). \
         Eylemler: oynat, duraklat, sonraki, onceki, durdur, sessiz."
    }

    fn domain(&self) -> Domain {
        Domain::Media
    }

    /// Çalan şeyi değiştirir ama geri alınabilir.
    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required(
            "eylem",
            "oynat | duraklat | sonraki | onceki | durdur | sessiz | ses_arttir | ses_azalt",
        )]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &[
            "müzik", "muzik", "şarkı", "sarki", "çal", "cal", "duraklat",
            "spotify", "medya", "oynat", "sonraki", "önceki",
        ]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(action) = arg_str(args, "eylem") else {
            return ToolOutcome::err("eylem parametresi gerekli");
        };

        let Some((key, label)) = resolve_action(action) else {
            return ToolOutcome::err(format!(
                "'{action}' bilinmeyen eylem. Seçenekler: oynat, duraklat, \
                 sonraki, onceki, durdur, sessiz, ses_arttir, ses_azalt"
            ));
        };

        press_media_key(key, label)
    }
}

/// Eylem adını tuş koduna çevirir.
///
/// `oynat` ve `duraklat` aynı tuş: medya tuşu geçiş yapar (toggle).
/// Bunu kullanıcıya söylemek yerine iki ad da kabul ediliyor.
#[cfg(windows)]
fn resolve_action(action: &str) -> Option<(u8, &'static str)> {
    let a = action.trim().to_lowercase();
    let pair = match a.as_str() {
        "oynat" | "cal" | "çal" | "play" | "devam" => (vk::MEDIA_PLAY_PAUSE, "oynat/duraklat"),
        "duraklat" | "durakla" | "pause" | "beklet" => (vk::MEDIA_PLAY_PAUSE, "oynat/duraklat"),
        "sonraki" | "next" | "ileri" | "gec" | "geç" => (vk::MEDIA_NEXT_TRACK, "sonraki parça"),
        "onceki" | "önceki" | "previous" | "prev" | "geri" => {
            (vk::MEDIA_PREV_TRACK, "önceki parça")
        }
        "durdur" | "stop" | "kapat" => (vk::MEDIA_STOP, "durdur"),
        "sessiz" | "mute" | "sustur" => (vk::VOLUME_MUTE, "sessiz"),
        "ses_arttir" | "sesi_ac" | "ses_ac" | "louder" => (vk::VOLUME_UP, "ses arttır"),
        "ses_azalt" | "sesi_kis" | "ses_kis" | "quieter" => (vk::VOLUME_DOWN, "ses azalt"),
        _ => return None,
    };
    Some(pair)
}

#[cfg(not(windows))]
fn resolve_action(_action: &str) -> Option<(u8, &'static str)> {
    None
}

#[cfg(windows)]
fn press_media_key(key: u8, label: &str) -> ToolOutcome {
    #[link(name = "user32")]
    extern "system" {
        fn keybd_event(vk: u8, scan: u8, flags: u32, extra: usize);
    }
    const KEYEVENTF_KEYUP: u32 = 0x0002;
    const KEYEVENTF_EXTENDEDKEY: u32 = 0x0001;

    // SAFETY: sabit sanal tuş kodu gönderiyoruz; API'nin yan etkisi
    // sistemin medya tuşuna basılmış gibi davranması.
    unsafe {
        keybd_event(key, 0, KEYEVENTF_EXTENDEDKEY, 0);
        keybd_event(key, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
    }

    ToolOutcome::ok(format!("{label} komutu gönderildi"))
}

#[cfg(not(windows))]
fn press_media_key(_key: u8, _label: &str) -> ToolOutcome {
    ToolOutcome::err("medya kontrolü bu platformda desteklenmiyor")
}

/// Çalan parça bilgisi.
pub struct NowPlaying;

impl Tool for NowPlaying {
    fn name(&self) -> &'static str {
        "calan_parca"
    }

    fn description(&self) -> &'static str {
        "Şu an çalan şarkıyı/videoyu söyler."
    }

    fn domain(&self) -> Domain {
        Domain::Media
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["çalan", "calan", "şarkı", "hangi", "müzik", "spotify"]
    }

    fn run(&self, _args: &Value) -> ToolOutcome {
        now_playing_platform()
    }
}

#[cfg(windows)]
fn now_playing_platform() -> ToolOutcome {
    // Spotify ve çoğu oynatıcı parça adını PENCERE BAŞLIĞINA yazar.
    // "Sanatçı - Şarkı" biçiminde; duraklatıldığında sadece "Spotify" olur.
    let script = "Get-Process -ErrorAction SilentlyContinue | \
                  Where-Object { $_.MainWindowTitle -ne '' -and \
                    ($_.ProcessName -eq 'Spotify' -or $_.ProcessName -eq 'vlc' -or \
                     $_.ProcessName -like '*music*') } | \
                  Select-Object -First 1 -ExpandProperty MainWindowTitle";

    match run_powershell(script) {
        Ok(title) if title.trim().is_empty() => {
            ToolOutcome::ok("çalan bir şey görünmüyor (oynatıcı kapalı olabilir)")
        }
        Ok(title) => {
            let t = title.trim();
            // Sadece uygulama adı → duraklatılmış demektir.
            if t.eq_ignore_ascii_case("spotify") {
                ToolOutcome::ok("Spotify açık ama çalmıyor (duraklatılmış)")
            } else {
                ToolOutcome::ok(format!("Çalıyor: {t}"))
            }
        }
        Err(e) => ToolOutcome::err(format!("okunamadı: {e}")),
    }
}

#[cfg(not(windows))]
fn now_playing_platform() -> ToolOutcome {
    ToolOutcome::err("çalan parça bilgisi bu platformda desteklenmiyor")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn action_requires_the_parameter() {
        assert!(!MediaControl.run(&serde_json::json!({})).ok);
        assert!(!MediaControl.run(&serde_json::json!({"eylem": "  "})).ok);
    }

    #[test]
    fn unknown_actions_list_the_valid_options() {
        let out = MediaControl.run(&serde_json::json!({"eylem": "saçmalık"}));
        assert!(!out.ok);
        assert!(out.content.contains("oynat"), "seçenekler gösterilmeli");
        assert!(out.content.contains("sonraki"));
    }

    #[cfg(windows)]
    #[test]
    fn turkish_and_english_action_names_both_work() {
        for action in [
            "oynat", "çal", "play", "duraklat", "pause", "sonraki", "next",
            "önceki", "previous", "durdur", "stop", "sessiz", "mute",
        ] {
            assert!(
                resolve_action(action).is_some(),
                "'{action}' tanınmalıydı"
            );
        }
    }

    #[cfg(windows)]
    #[test]
    fn play_and_pause_map_to_the_same_toggle_key() {
        // Medya tuşu geçiş yapar; iki ad da aynı tuşa gitmeli.
        let (play, _) = resolve_action("oynat").unwrap();
        let (pause, _) = resolve_action("duraklat").unwrap();
        assert_eq!(play, pause);
    }

    #[cfg(windows)]
    #[test]
    fn action_names_are_case_insensitive() {
        assert!(resolve_action("OYNAT").is_some());
        assert!(resolve_action("  Sonraki  ").is_some());
    }

    #[cfg(windows)]
    #[test]
    fn distinct_actions_use_distinct_keys() {
        let next = resolve_action("sonraki").unwrap().0;
        let prev = resolve_action("onceki").unwrap().0;
        let stop = resolve_action("durdur").unwrap().0;
        assert_ne!(next, prev);
        assert_ne!(next, stop);
    }

    #[test]
    fn media_control_is_moderate_risk() {
        // Çalanı değiştirir ama geri alınabilir.
        assert_eq!(MediaControl.risk(), Risk::Moderate);
        // Bilgi okuma güvenli.
        assert_eq!(NowPlaying.risk(), Risk::Safe);
    }

    #[test]
    fn now_playing_reports_something_or_explains_why_not() {
        let out = NowPlaying.run(&Value::Null);
        if cfg!(windows) {
            // Oynatıcı kapalıysa da geçerli bir cevap.
            assert!(out.ok, "{}", out.content);
            assert!(!out.content.is_empty());
        }
    }

    #[test]
    fn description_mentions_multiple_players() {
        // Kullanıcı sadece Spotify sanmasın.
        let d = MediaControl.description();
        assert!(d.contains("Spotify"));
        assert!(d.contains("YouTube") || d.contains("VLC"));
    }
}
