//! Ekran görüntüsü ve görü.
//!
//! Ekran görüntüsü alıp modele göstermek, "ekranda ne var" sorusunun tek
//! cevabı. Eski projede bu vardı ama çift-yakalama sorunu yaşanmıştı
//! (manuel test notu) — burada tek yakalama, tek yol.
//!
//! # Görüntü nasıl modele ulaşıyor
//!
//! Tool base64 PNG üretir ve **paylaşılan bir yuvaya** koyar. Ajan döngüsü
//! bu yuvayı okuyup bir sonraki model isteğine görüntü olarak iliştirir.
//! Tool sonucu metinsel olmak zorunda olduğu için (tool protokolü öyle),
//! görüntüyü ayrı bir kanaldan taşımak gerekiyor.

use crate::tool::{arg_str, Domain, Param, Tool, ToolOutcome};
use serde_json::Value;
use std::sync::Mutex;

/// Modele iliştirilmeyi bekleyen görüntü (base64 PNG).
///
/// Ajan döngüsü tool çalıştıktan sonra burayı kontrol eder.
static PENDING_IMAGE: Mutex<Option<String>> = Mutex::new(None);

/// Bekleyen görüntüyü alır ve yuvayı boşaltır.
///
/// Ajan döngüsü çağırır. **Alındıktan sonra silinir** — aynı görüntü iki
/// kez gönderilmesin (eski projedeki çift-yakalama sorunu buydu).
pub fn take_pending_image() -> Option<String> {
    PENDING_IMAGE
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
}

/// Bekleyen görüntü var mı? (Almadan sorar.)
pub fn has_pending_image() -> bool {
    PENDING_IMAGE
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .is_some()
}

fn set_pending_image(base64: String) {
    let mut slot = PENDING_IMAGE.lock().unwrap_or_else(|e| e.into_inner());
    *slot = Some(base64);
}

/// Ekran görüntüsü alma.
pub struct Screenshot;

impl Tool for Screenshot {
    fn name(&self) -> &'static str {
        "ekran_goruntusu"
    }

    fn description(&self) -> &'static str {
        "Ekranın görüntüsünü alır ve sana gösterir. Kullanıcı 'ekranımda ne var', \
         'şuna bak', 'bu hatayı gör' gibi şeyler söylediğinde kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Vision
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::optional(
            "pencere",
            "Sadece bu pencerenin görüntüsü alınsın (boşsa tüm ekran)",
        )]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["ekran", "görüntü", "screenshot", "bak", "gör", "göster"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        match capture_screen(arg_str(args, "pencere")) {
            Ok(base64) => {
                let size_kb = base64.len() * 3 / 4 / 1024;
                set_pending_image(base64);
                ToolOutcome::ok(format!(
                    "Ekran görüntüsü alındı ({size_kb} KB) — görüntü sana iletiliyor."
                ))
            }
            Err(e) => ToolOutcome::err(format!("ekran görüntüsü alınamadı: {e}")),
        }
    }
}

/// Ekranı yakalar, base64 PNG döner.
#[cfg(windows)]
fn capture_screen(window_title: Option<&str>) -> Result<String, String> {
    use super::system::run_powershell;

    let path = std::env::temp_dir().join(format!("vavis_screen_{}.png", std::process::id()));
    let path_str = path.display().to_string().replace('\'', "''");

    // Belirli bir pencere istendiyse önce onu öne getir.
    let focus = match window_title {
        Some(title) if !title.trim().is_empty() => {
            let safe = title.replace('\'', "''");
            format!(
                "$w = Get-Process | Where-Object {{ $_.MainWindowTitle -like '*{safe}*' }} | \
                 Select-Object -First 1; \
                 if ($w) {{ \
                   Add-Type -AssemblyName Microsoft.VisualBasic; \
                   [Microsoft.VisualBasic.Interaction]::AppActivate($w.Id); \
                   Start-Sleep -Milliseconds 400 }}; "
            )
        }
        _ => String::new(),
    };

    let script = format!(
        "{focus}\
         Add-Type -AssemblyName System.Windows.Forms, System.Drawing; \
         $b = [System.Windows.Forms.SystemInformation]::VirtualScreen; \
         $bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height); \
         $g = [System.Drawing.Graphics]::FromImage($bmp); \
         $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size); \
         $bmp.Save('{path_str}', [System.Drawing.Imaging.ImageFormat]::Png); \
         $g.Dispose(); $bmp.Dispose()"
    );

    run_powershell(&script).map_err(|e| e.to_string())?;

    let bytes = std::fs::read(&path).map_err(|e| format!("görüntü okunamadı: {e}"))?;
    let _ = std::fs::remove_file(&path);

    if bytes.is_empty() {
        return Err("boş görüntü".into());
    }

    // Büyük ekranlarda PNG birkaç MB olabilir; model bunu kaldırır ama
    // bağlam maliyeti yüksek. Uyarı logla, yine de gönder.
    if bytes.len() > 4 * 1024 * 1024 {
        tracing::warn!(bytes = bytes.len(), "ekran görüntüsü büyük");
    }

    Ok(base64_encode(&bytes))
}

#[cfg(not(windows))]
fn capture_screen(_window_title: Option<&str>) -> Result<String, String> {
    Err("ekran görüntüsü bu platformda desteklenmiyor".into())
}

/// Base64 kodlama.
///
/// Bağımlılık eklemiyoruz — tek kullanım için 20 satır yeterli.
pub fn base64_encode(data: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);

    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(TABLE[((triple >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3F) as usize] as char);
        // Eksik baytlar '=' ile doldurulur.
        out.push(if chunk.len() > 1 {
            TABLE[((triple >> 6) & 0x3F) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            TABLE[(triple & 0x3F) as usize] as char
        } else {
            '='
        });
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_matches_known_vectors() {
        // RFC 4648 test vektörleri.
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
        assert_eq!(base64_encode(b"foob"), "Zm9vYg==");
        assert_eq!(base64_encode(b"fooba"), "Zm9vYmE=");
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn base64_handles_binary_data() {
        let png_header = [0x89u8, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        let encoded = base64_encode(&png_header);
        assert_eq!(encoded, "iVBORw0KGgo=");
    }

    #[test]
    fn base64_output_length_is_always_a_multiple_of_four() {
        for len in 0..20 {
            let data = vec![0xABu8; len];
            let encoded = base64_encode(&data);
            assert_eq!(encoded.len() % 4, 0, "uzunluk {len} için hizalama bozuk");
        }
    }

    #[test]
    fn pending_image_slot_starts_empty() {
        // Diğer testler doldurmuş olabilir — önce boşalt.
        take_pending_image();
        assert!(!has_pending_image());
        assert!(take_pending_image().is_none());
    }

    #[test]
    fn taking_the_image_clears_the_slot() {
        // Çift-yakalama önlemi: aynı görüntü iki kez gönderilmemeli.
        set_pending_image("SAHTE_BASE64".into());
        assert!(has_pending_image());

        assert_eq!(take_pending_image().as_deref(), Some("SAHTE_BASE64"));
        assert!(!has_pending_image(), "alındıktan sonra yuva boşalmalı");
        assert!(take_pending_image().is_none(), "ikinci alış boş dönmeli");
    }

    #[test]
    fn screenshot_is_safe_risk() {
        // Okuma işlemi — onay gerekmez.
        assert_eq!(Screenshot.risk(), crate::tool::Risk::Safe);
    }

    #[test]
    fn screenshot_description_tells_the_model_when_to_use_it() {
        let d = Screenshot.description();
        assert!(d.contains("ekran"));
        assert!(d.len() > 40, "model ne zaman çağıracağını anlamalı");
    }

    #[test]
    fn screenshot_schema_has_optional_window_param() {
        let schema = Screenshot.schema();
        let required = schema["function"]["parameters"]["required"]
            .as_array()
            .unwrap();
        assert!(required.is_empty(), "pencere parametresi zorunlu olmamalı");
    }

    #[test]
    #[ignore = "gerçek ekran yakalar — elle çalıştır"]
    fn real_screenshot_produces_valid_png() {
        let result = capture_screen(None);
        let base64 = result.expect("ekran yakalanmalı");
        assert!(!base64.is_empty());
        // Base64 çözülünce PNG imzası çıkmalı: iVBORw0KGgo
        assert!(base64.starts_with("iVBORw0KGgo"), "PNG imzası yok");
    }
}
