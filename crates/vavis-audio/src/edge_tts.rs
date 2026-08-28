//! Microsoft Edge TTS — ücretsiz, doğal sesler, anahtar gerektirmez.
//!
//! Edge tarayıcısının "Yüksek Sesle Oku" özelliğinin arkasındaki servis.
//! SAPI'den belirgin daha doğal; Türkçe için iki ses var (Emel, Ahmet).
//!
//! # Protokol
//!
//! WebSocket üzerinden çalışır:
//!   1. Bağlan (URL'de bir istemci belirteci var — Edge'in sabit değeri)
//!   2. Ses biçimi ayarını gönder (metin çerçeve)
//!   3. SSML gönder (metin çerçeve)
//!   4. Sunucu ikili çerçevelerde MP3 gönderir; her çerçeve
//!      `[2 bayt başlık uzunluğu][başlık][ses verisi]` şeklinde
//!   5. `Path:turn.end` gelince biter
//!
//! # Neden ikili çerçeve ayrıştırması gerekiyor
//!
//! Ses verisi düz gelmiyor — her parçanın başında HTTP benzeri bir başlık
//! bloğu var. Bunu atlamazsak MP3 bozulur ve çalmaz.

use std::io::Write;

#[derive(Debug, thiserror::Error)]
pub enum EdgeError {
    #[error("bağlantı kurulamadı: {0}")]
    Connect(String),
    #[error("iletişim hatası: {0}")]
    Protocol(String),
    #[error("ses verisi alınamadı")]
    NoAudio,
}

pub type Result<T> = std::result::Result<T, EdgeError>;

/// Edge TTS uç noktası. Belirteç Edge tarayıcısının sabit değeri.
const WSS_BASE: &str = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";

/// `Sec-MS-GEC` imzasında kullanılan sabit tuz (Edge istemcisinin değeri).
const GEC_SALT: &str = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

/// Edge sürümü — `Sec-MS-GEC-Version` başlığında gidiyor.
const GEC_VERSION: &str = "1-130.0.2849.68";

/// `Sec-MS-GEC` imzasını üretir.
///
/// **Neden gerekli:** Servis 2024'ten beri imzasız istekleri 403 ile
/// reddediyor. İmza = SHA256(windows_ticks + salt), büyük harf onaltılık.
///
/// `windows_ticks`: 1601-01-01'den bu yana geçen 100 nanosaniyelik aralık
/// sayısı, en yakın 5 dakikaya yuvarlanmış.
/// Teshis icin disa acilan imza uretici.
pub fn debug_gec() -> String {
    gec_token()
}

fn gec_token() -> String {
    use sha2::{Digest, Sha256};

    // Unix epoch (1970) ile Windows epoch (1601) arası saniye farkı.
    const EPOCH_DIFF_SECS: u64 = 11_644_473_600;
    const TICKS_PER_SEC: u64 = 10_000_000;

    let unix_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // 5 dakikalık pencereye yuvarla — servis bunu bekliyor.
    let rounded = (unix_secs + EPOCH_DIFF_SECS) / 300 * 300;
    let ticks = rounded * TICKS_PER_SEC;

    let mut hasher = Sha256::new();
    hasher.update(format!("{ticks}{GEC_SALT}").as_bytes());
    let digest = hasher.finalize();

    digest.iter().map(|b| format!("{b:02X}")).collect()
}

/// Tam WebSocket URL'si — imza ve bağlantı kimliği dahil.
fn build_url(connection_id: &str) -> String {
    format!(
        "{WSS_BASE}&Sec-MS-GEC={}&Sec-MS-GEC-Version={GEC_VERSION}&ConnectionId={connection_id}",
        gec_token()
    )
}

/// Türkçe sesler.
pub const VOICE_TR_FEMALE: &str = "tr-TR-EmelNeural";
pub const VOICE_TR_MALE: &str = "tr-TR-AhmetNeural";
/// İngilizce sesler.
pub const VOICE_EN_FEMALE: &str = "en-US-AriaNeural";
pub const VOICE_EN_MALE: &str = "en-US-GuyNeural";

/// Dile göre varsayılan ses.
pub fn default_voice(language: &str) -> &'static str {
    match language {
        "en" => VOICE_EN_FEMALE,
        _ => VOICE_TR_FEMALE,
    }
}

/// Kullanılabilir sesler — arayüzde listelemek için.
pub fn voices() -> &'static [(&'static str, &'static str)] {
    &[
        (VOICE_TR_FEMALE, "Emel (TR, kadın)"),
        (VOICE_TR_MALE, "Ahmet (TR, erkek)"),
        (VOICE_EN_FEMALE, "Aria (EN, kadın)"),
        (VOICE_EN_MALE, "Guy (EN, erkek)"),
    ]
}

/// XML özel karakterlerini kaçırır.
///
/// **Güvenlik:** Metin doğrudan SSML'e gömülüyor. Kaçırılmazsa içindeki
/// `<` `&` karakterleri SSML'i bozar (ve teorik olarak enjeksiyon olur).
pub fn escape_xml(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 16);
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            c => out.push(c),
        }
    }
    out
}

/// SSML belgesi üretir.
pub fn build_ssml(text: &str, voice: &str, rate_percent: i32, volume_percent: i32) -> String {
    // Aşırı değerler servisi hata verdiriyor.
    let rate = rate_percent.clamp(-50, 100);
    let volume = volume_percent.clamp(0, 100);

    format!(
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='tr-TR'>\
         <voice name='{voice}'>\
         <prosody pitch='+0Hz' rate='{rate:+}%' volume='{volume:+}%'>{}</prosody>\
         </voice></speak>",
        escape_xml(text)
    )
}

/// Bağlantı kurulurken gönderilen ses biçimi ayarı.
fn config_message(timestamp: &str) -> String {
    format!(
        "X-Timestamp:{timestamp}\r\n\
         Content-Type:application/json; charset=utf-8\r\n\
         Path:speech.config\r\n\r\n\
         {{\"context\":{{\"synthesis\":{{\"audio\":{{\"metadataoptions\":\
         {{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"}},\
         \"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}}}}}"
    )
}

/// SSML isteği çerçevesi.
fn ssml_message(request_id: &str, timestamp: &str, ssml: &str) -> String {
    format!(
        "X-RequestId:{request_id}\r\n\
         Content-Type:application/ssml+xml\r\n\
         X-Timestamp:{timestamp}\r\n\
         Path:ssml\r\n\r\n{ssml}"
    )
}

/// İkili çerçeveden ses verisini ayıklar.
///
/// Biçim: `[2 bayt başlık uzunluğu (big-endian)][başlık][ses]`
/// Başlık uzunluğu bozuksa `None` — çerçeveyi atlarız, çökmeyiz.
pub fn extract_audio(frame: &[u8]) -> Option<&[u8]> {
    if frame.len() < 2 {
        return None;
    }
    let header_len = u16::from_be_bytes([frame[0], frame[1]]) as usize;
    let start = 2 + header_len;
    if start > frame.len() {
        return None;
    }
    Some(&frame[start..])
}

/// Metni MP3'e çevirir.
///
/// **Bloklar** — ayrı bir thread'den çağrılmalı.
pub fn synthesize(text: &str, voice: &str, rate: i32, volume: i32) -> Result<Vec<u8>> {
    use tungstenite::{connect, Message as WsMessage};

    if text.trim().is_empty() {
        return Ok(Vec::new());
    }

    let connection_id = request_id();
    let request = tungstenite::http::Request::builder()
        .uri(build_url(&connection_id))
        // Bu başlıklar olmadan servis 403 döner.
        .header(
            "Origin",
            "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        )
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
        )
        .header("Host", "speech.platform.bing.com")
        .header("Connection", "Upgrade")
        .header("Upgrade", "websocket")
        .header("Sec-WebSocket-Version", "13")
        .header(
            "Sec-WebSocket-Key",
            tungstenite::handshake::client::generate_key(),
        )
        .body(())
        .map_err(|e| EdgeError::Connect(e.to_string()))?;

    let (mut socket, _) = connect(request).map_err(|e| EdgeError::Connect(e.to_string()))?;

    let timestamp = timestamp_now();
    let request_id = connection_id.clone();

    socket
        .send(WsMessage::Text(config_message(&timestamp).into()))
        .map_err(|e| EdgeError::Protocol(e.to_string()))?;

    let ssml = build_ssml(text, voice, rate, volume);
    socket
        .send(WsMessage::Text(
            ssml_message(&request_id, &timestamp, &ssml).into(),
        ))
        .map_err(|e| EdgeError::Protocol(e.to_string()))?;

    let mut audio: Vec<u8> = Vec::with_capacity(64 * 1024);

    loop {
        let msg = socket
            .read()
            .map_err(|e| EdgeError::Protocol(e.to_string()))?;

        match msg {
            WsMessage::Binary(data) => {
                if let Some(chunk) = extract_audio(&data) {
                    audio.extend_from_slice(chunk);
                }
            }
            WsMessage::Text(text) => {
                // Sunucu bitişi metin çerçevesiyle bildiriyor.
                if text.contains("Path:turn.end") {
                    break;
                }
            }
            WsMessage::Close(_) => break,
            _ => {}
        }
    }

    let _ = socket.close(None);

    if audio.is_empty() {
        Err(EdgeError::NoAudio)
    } else {
        Ok(audio)
    }
}

/// MP3'ü geçici dosyaya yazıp sistem oynatıcısıyla çalar.
///
/// `cancel` bayrağı kaldırılırsa oynatma başlamaz/kesilir.
pub fn speak(
    text: &str,
    voice: &str,
    rate: i32,
    volume: i32,
    cancel: &std::sync::atomic::AtomicBool,
) -> Result<()> {
    use std::sync::atomic::Ordering;

    if cancel.load(Ordering::SeqCst) {
        return Ok(());
    }

    let mp3 = synthesize(text, voice, rate, volume)?;
    if mp3.is_empty() || cancel.load(Ordering::SeqCst) {
        return Ok(());
    }

    // Geçici dosya — süreç kimliği + zaman damgası ile çakışma önlenir.
    let path = std::env::temp_dir().join(format!(
        "vavis_tts_{}_{}.mp3",
        std::process::id(),
        timestamp_millis()
    ));

    let mut file = std::fs::File::create(&path).map_err(|e| EdgeError::Protocol(e.to_string()))?;
    file.write_all(&mp3)
        .map_err(|e| EdgeError::Protocol(e.to_string()))?;
    drop(file);

    let result = play_file(&path, cancel);
    // Çalma başarısız olsa da geçici dosyayı bırakma.
    let _ = std::fs::remove_file(&path);
    result
}

#[cfg(windows)]
fn play_file(path: &std::path::Path, cancel: &std::sync::atomic::AtomicBool) -> Result<()> {
    use std::process::Command;
    use std::sync::atomic::Ordering;

    // MediaPlayer: MP3 çalar, ek bağımlılık yok, süre bilgisi verir.
    let script = format!(
        "Add-Type -AssemblyName presentationCore; \
         $p = New-Object System.Windows.Media.MediaPlayer; \
         $p.Open([uri]'{}'); \
         Start-Sleep -Milliseconds 400; \
         $p.Play(); \
         $d = $p.NaturalDuration.TimeSpan.TotalMilliseconds; \
         if ($d -le 0) {{ $d = 3000 }}; \
         Start-Sleep -Milliseconds $d; \
         $p.Stop(); $p.Close()",
        path.display()
    );

    let mut child = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .spawn()
        .map_err(|e| EdgeError::Protocol(e.to_string()))?;

    // Barge-in: iptal edilirse oynatıcıyı öldür.
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return Ok(()),
            Ok(None) => {
                if cancel.load(Ordering::SeqCst) {
                    let _ = child.kill();
                    return Ok(());
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            Err(e) => return Err(EdgeError::Protocol(e.to_string())),
        }
    }
}

#[cfg(not(windows))]
fn play_file(_path: &std::path::Path, _cancel: &std::sync::atomic::AtomicBool) -> Result<()> {
    Err(EdgeError::Protocol(
        "oynatma bu platformda desteklenmiyor".into(),
    ))
}

fn timestamp_now() -> String {
    // Edge bu biçimi bekliyor; saniye hassasiyeti yeterli.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}Z")
}

fn timestamp_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Tireli olmayan rastgele istek kimliği (Edge'in beklediği biçim).
fn request_id() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id() as u128;
    format!("{:032x}", nanos.wrapping_mul(31).wrapping_add(pid))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xml_special_characters_are_escaped() {
        assert_eq!(escape_xml("a & b"), "a &amp; b");
        assert_eq!(escape_xml("<script>"), "&lt;script&gt;");
        assert_eq!(escape_xml("O'nun \"sözü\""), "O&apos;nun &quot;sözü&quot;");
    }

    #[test]
    fn turkish_characters_survive_escaping() {
        let text = "Çğıöşü ĞİÖŞÜ";
        assert_eq!(escape_xml(text), text, "Türkçe karakterler bozulmamalı");
    }

    #[test]
    fn ssml_embeds_escaped_text_not_raw() {
        // Kaçırılmazsa SSML bozulur.
        let ssml = build_ssml("<b>kalın</b> & şey", VOICE_TR_FEMALE, 0, 100);
        assert!(ssml.contains("&lt;b&gt;"), "ham etiket kalmamalı: {ssml}");
        assert!(ssml.contains("&amp;"));
        assert!(!ssml.contains("<b>"));
    }

    #[test]
    fn ssml_contains_the_requested_voice() {
        let ssml = build_ssml("merhaba", VOICE_TR_MALE, 0, 100);
        assert!(ssml.contains(VOICE_TR_MALE));
        assert!(ssml.contains("<speak"));
        assert!(ssml.contains("</speak>"));
    }

    #[test]
    fn extreme_rate_and_volume_are_clamped() {
        let ssml = build_ssml("x", VOICE_TR_FEMALE, 9999, 9999);
        assert!(ssml.contains("+100%"), "hız kırpılmalı: {ssml}");

        let ssml = build_ssml("x", VOICE_TR_FEMALE, -9999, -50);
        assert!(ssml.contains("-50%"), "hız alt sınırda: {ssml}");
    }

    #[test]
    fn rate_is_formatted_with_explicit_sign() {
        // "+0%" olmalı, "0%" değil — servis işaretsiz değeri reddediyor.
        let ssml = build_ssml("x", VOICE_TR_FEMALE, 0, 100);
        assert!(ssml.contains("rate='+0%'"), "{ssml}");
    }

    #[test]
    fn binary_frame_header_is_stripped() {
        // [0x00 0x05]["HELLO"][ses baytları]
        let mut frame = vec![0x00, 0x05];
        frame.extend_from_slice(b"HELLO");
        frame.extend_from_slice(&[0xFF, 0xFB, 0x90]); // MP3 başlangıcı

        let audio = extract_audio(&frame).unwrap();
        assert_eq!(audio, &[0xFF, 0xFB, 0x90]);
    }

    #[test]
    fn malformed_frames_are_rejected_not_panicked() {
        assert!(extract_audio(&[]).is_none());
        assert!(extract_audio(&[0x00]).is_none());
        // Başlık uzunluğu çerçeveden büyük.
        assert!(extract_audio(&[0xFF, 0xFF, 0x01]).is_none());
    }

    #[test]
    fn frame_with_no_audio_yields_empty_slice() {
        let frame = vec![0x00, 0x02, b'A', b'B'];
        assert_eq!(extract_audio(&frame).unwrap().len(), 0);
    }

    #[test]
    fn default_voice_follows_language() {
        assert_eq!(default_voice("tr"), VOICE_TR_FEMALE);
        assert_eq!(default_voice("en"), VOICE_EN_FEMALE);
        assert_eq!(default_voice("bilinmeyen"), VOICE_TR_FEMALE);
    }

    #[test]
    fn every_listed_voice_has_a_label() {
        for (id, label) in voices() {
            assert!(!id.is_empty() && !label.is_empty());
            assert!(id.contains("Neural"), "geçersiz ses adı: {id}");
        }
    }

    #[test]
    fn config_message_requests_mp3_output() {
        let msg = config_message("123Z");
        assert!(msg.contains("Path:speech.config"));
        assert!(msg.contains("mp3"), "MP3 istenmelidir");
    }

    #[test]
    fn ssml_message_carries_request_id() {
        let msg = ssml_message("abc123", "1Z", "<speak/>");
        assert!(msg.contains("X-RequestId:abc123"));
        assert!(msg.contains("Path:ssml"));
    }

    #[test]
    fn request_ids_are_unique() {
        let a = request_id();
        std::thread::sleep(std::time::Duration::from_millis(2));
        let b = request_id();
        assert_ne!(a, b);
        assert_eq!(a.len(), 32, "32 onaltılık karakter olmalı");
    }

    #[test]
    fn empty_text_synthesizes_to_nothing_without_network() {
        // Ağa çıkmadan dönmeli.
        assert!(synthesize("", VOICE_TR_FEMALE, 0, 100).unwrap().is_empty());
        assert!(synthesize("   ", VOICE_TR_FEMALE, 0, 100)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn cancelled_speak_returns_immediately() {
        use std::sync::atomic::{AtomicBool, Ordering};
        let cancel = AtomicBool::new(true);
        cancel.store(true, Ordering::SeqCst);

        let start = std::time::Instant::now();
        assert!(speak("uzun metin", VOICE_TR_FEMALE, 0, 100, &cancel).is_ok());
        assert!(start.elapsed().as_millis() < 100, "iptalde anında dönmeli");
    }
}
