//! Bilgisayar kullanımı — fare ve klavye simülasyonu.
//!
//! Asistanın ekrandaki şeylere tıklayıp yazabilmesi. Ekran görüntüsüyle
//! birlikte çalışır: model önce bakar, sonra tıklar.
//!
//! # Neden hepsi yıkıcı sayılıyor
//!
//! Bir tıklama "gönder" düğmesine denk gelebilir, bir tuş dizisi
//! kaydedilmemiş belgeyi kapatabilir. Model ekranı %100 doğru yorumlayamaz;
//! kullanıcı her eylemi görmeli. Eski projede de onay isteniyordu.
//!
//! # Güvenlik sınırı
//!
//! Koordinatlar ekran sınırları içinde olmalı; metin uzunluğu sınırlı.
//! Sonsuz döngüye giren bir model klavyeyi kilitleyemesin.

use crate::tool::{arg_num, arg_str, Domain, Param, Risk, Tool, ToolOutcome};
use serde_json::Value;

/// Tek seferde yazılabilecek en fazla karakter.
const MAX_TYPE_CHARS: usize = 500;

/// Fare tıklaması.
pub struct Click;

impl Tool for Click {
    fn name(&self) -> &'static str {
        "tikla"
    }

    fn description(&self) -> &'static str {
        "Ekranda belirtilen koordinata tıklar. Önce ekran_goruntusu ile bak, \
         sonra tıklayacağın yerin koordinatını belirle."
    }

    fn domain(&self) -> Domain {
        Domain::Vision
    }

    /// Neye tıkladığını kesin bilemeyiz — her zaman onay.
    fn risk(&self) -> Risk {
        Risk::Destructive
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::required("x", "Yatay koordinat (piksel)"),
            Param::required("y", "Dikey koordinat (piksel)"),
            Param::optional("dugme", "sol | sag | orta (varsayılan: sol)"),
            Param::optional("cift", "çift tıklama için 'evet'"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["tıkla", "click", "bas", "seç"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let (Some(x), Some(y)) = (arg_num(args, "x"), arg_num(args, "y")) else {
            return ToolOutcome::err("x ve y koordinatları gerekli");
        };

        let (w, h) = screen_size();
        if x < 0.0 || y < 0.0 || x > w as f64 || y > h as f64 {
            return ToolOutcome::err(format!(
                "koordinat ekran dışında ({x:.0},{y:.0}) — ekran {w}x{h}"
            ));
        }

        let button = match arg_str(args, "dugme").unwrap_or("sol") {
            "sag" | "sağ" | "right" => MouseButton::Right,
            "orta" | "middle" => MouseButton::Middle,
            _ => MouseButton::Left,
        };
        let double = arg_str(args, "cift").is_some_and(|v| {
            matches!(v.to_lowercase().as_str(), "evet" | "true" | "yes" | "1")
        });

        click_platform(x as i32, y as i32, button, double)
    }
}

/// Klavyeden metin yazma.
pub struct TypeText;

impl Tool for TypeText {
    fn name(&self) -> &'static str {
        "klavyeyle_yaz"
    }

    fn description(&self) -> &'static str {
        "Klavyeden metin yazar (o an odaklı pencereye). Önce doğru yere \
         tıklayarak odağı ver."
    }

    fn domain(&self) -> Domain {
        Domain::Vision
    }

    fn risk(&self) -> Risk {
        Risk::Destructive
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("metin", "Yazılacak metin")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["yaz", "klavye", "gir", "type"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(text) = arg_str(args, "metin") else {
            return ToolOutcome::err("metin parametresi gerekli");
        };
        if text.chars().count() > MAX_TYPE_CHARS {
            return ToolOutcome::err(format!(
                "metin çok uzun ({} karakter) — en fazla {MAX_TYPE_CHARS}",
                text.chars().count()
            ));
        }
        type_platform(text)
    }
}

/// Tuş kombinasyonu.
pub struct PressKey;

impl Tool for PressKey {
    fn name(&self) -> &'static str {
        "tusa_bas"
    }

    fn description(&self) -> &'static str {
        "Bir tuşa veya kombinasyona basar. Örnek: enter, escape, tab, \
         ctrl+s, ctrl+c, alt+f4, win+d."
    }

    fn domain(&self) -> Domain {
        Domain::Vision
    }

    fn risk(&self) -> Risk {
        Risk::Destructive
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("tus", "Tuş adı veya kombinasyon")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["tuş", "bas", "enter", "escape", "kısayol"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(key) = arg_str(args, "tus") else {
            return ToolOutcome::err("tus parametresi gerekli");
        };
        let Some(sequence) = translate_keys(key) else {
            return ToolOutcome::err(format!("'{key}' tanınmayan bir tuş"));
        };
        press_platform(&sequence, key)
    }
}

/// Ekran boyutu — model koordinat hesaplarken bilmeli.
pub struct ScreenSize;

impl Tool for ScreenSize {
    fn name(&self) -> &'static str {
        "ekran_boyutu"
    }

    fn description(&self) -> &'static str {
        "Ekran çözünürlüğünü verir. Tıklama koordinatı hesaplamadan önce kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Vision
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["ekran", "çözünürlük", "boyut"]
    }

    fn run(&self, _args: &Value) -> ToolOutcome {
        let (w, h) = screen_size();
        ToolOutcome::ok(format!("Ekran: {w}x{h} piksel"))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MouseButton {
    Left,
    Right,
    Middle,
}

/// Kullanıcı tuş adını SendKeys biçimine çevirir.
///
/// `None` dönerse tuş tanınmıyor — körlemesine göndermek yerine hata veriyoruz
/// (tanınmayan metin ekrana harf harf yazılabilirdi).
fn translate_keys(input: &str) -> Option<String> {
    let lower = input.trim().to_lowercase();

    // Kombinasyon mu?
    if lower.contains('+') {
        let mut modifiers = String::new();
        let mut key = None;

        for part in lower.split('+') {
            match part.trim() {
                "ctrl" | "control" => modifiers.push('^'),
                "alt" => modifiers.push('%'),
                "shift" => modifiers.push('+'),
                "win" | "windows" => modifiers.push_str("^{ESC}"), // yaklaşık
                other => key = Some(single_key(other)?),
            }
        }
        let key = key?;
        return Some(format!("{modifiers}{key}"));
    }

    single_key(&lower)
}

/// Tek tuşun SendKeys karşılığı.
fn single_key(name: &str) -> Option<String> {
    let key = match name {
        "enter" | "return" | "giriş" => "{ENTER}",
        "escape" | "esc" | "iptal" => "{ESC}",
        "tab" | "sekme" => "{TAB}",
        "space" | "bosluk" | "boşluk" => " ",
        "backspace" | "geri" => "{BACKSPACE}",
        "delete" | "del" | "sil" => "{DELETE}",
        "up" | "yukari" | "yukarı" => "{UP}",
        "down" | "asagi" | "aşağı" => "{DOWN}",
        "left" | "sol" => "{LEFT}",
        "right" | "sag" | "sağ" => "{RIGHT}",
        "home" => "{HOME}",
        "end" | "son" => "{END}",
        "pageup" | "pgup" => "{PGUP}",
        "pagedown" | "pgdn" => "{PGDN}",
        "f1" => "{F1}",
        "f2" => "{F2}",
        "f3" => "{F3}",
        "f4" => "{F4}",
        "f5" => "{F5}",
        "f11" => "{F11}",
        "f12" => "{F12}",
        // Tek harf/rakam.
        s if s.len() == 1 && s.chars().all(|c| c.is_ascii_alphanumeric()) => {
            return Some(s.to_string())
        }
        _ => return None,
    };
    Some(key.to_string())
}

/// SendKeys için metin kaçırma.
///
/// `+ ^ % ~ ( ) { } [ ]` SendKeys'te özel anlam taşır; kaçırılmazsa
/// metin yerine tuş kombinasyonu olarak yorumlanır.
fn escape_sendkeys(text: &str) -> String {
    let mut out = String::with_capacity(text.len() * 2);
    for c in text.chars() {
        match c {
            '+' | '^' | '%' | '~' | '(' | ')' | '{' | '}' | '[' | ']' => {
                out.push('{');
                out.push(c);
                out.push('}');
            }
            c => out.push(c),
        }
    }
    out
}

#[cfg(windows)]
fn screen_size() -> (i32, i32) {
    #[link(name = "user32")]
    extern "system" {
        fn GetSystemMetrics(index: i32) -> i32;
    }
    const SM_CXSCREEN: i32 = 0;
    const SM_CYSCREEN: i32 = 1;

    // SAFETY: salt okunur sistem sorgusu, parametresi sabit.
    unsafe { (GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN)) }
}

#[cfg(not(windows))]
fn screen_size() -> (i32, i32) {
    (1920, 1080)
}

#[cfg(windows)]
fn click_platform(x: i32, y: i32, button: MouseButton, double: bool) -> ToolOutcome {
    #[link(name = "user32")]
    extern "system" {
        fn SetCursorPos(x: i32, y: i32) -> i32;
        fn mouse_event(flags: u32, dx: u32, dy: u32, data: u32, extra: usize);
    }

    const MOUSEEVENTF_LEFTDOWN: u32 = 0x0002;
    const MOUSEEVENTF_LEFTUP: u32 = 0x0004;
    const MOUSEEVENTF_RIGHTDOWN: u32 = 0x0008;
    const MOUSEEVENTF_RIGHTUP: u32 = 0x0010;
    const MOUSEEVENTF_MIDDLEDOWN: u32 = 0x0020;
    const MOUSEEVENTF_MIDDLEUP: u32 = 0x0040;

    let (down, up) = match button {
        MouseButton::Left => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
        MouseButton::Right => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
        MouseButton::Middle => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
    };

    // SAFETY: koordinatlar doğrulandı; API'ler yan etkisi bilinen sistem çağrıları.
    unsafe {
        SetCursorPos(x, y);
        // İmlecin yerleşmesi için kısa bekleme — bazı uygulamalar
        // anında gelen tıklamayı kaçırıyor.
        std::thread::sleep(std::time::Duration::from_millis(60));

        let clicks = if double { 2 } else { 1 };
        for i in 0..clicks {
            mouse_event(down, 0, 0, 0, 0);
            mouse_event(up, 0, 0, 0, 0);
            if i == 0 && double {
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
        }
    }

    let kind = if double { "çift tıklandı" } else { "tıklandı" };
    ToolOutcome::ok(format!("({x},{y}) noktasına {kind}"))
}

#[cfg(not(windows))]
fn click_platform(_x: i32, _y: i32, _b: MouseButton, _d: bool) -> ToolOutcome {
    ToolOutcome::err("fare kontrolü bu platformda desteklenmiyor")
}

#[cfg(windows)]
fn type_platform(text: &str) -> ToolOutcome {
    use super::system::run_powershell;

    let escaped = escape_sendkeys(text).replace('\'', "''");
    let script = format!(
        "Add-Type -AssemblyName System.Windows.Forms; \
         [System.Windows.Forms.SendKeys]::SendWait('{escaped}')"
    );

    match run_powershell(&script) {
        Ok(_) => ToolOutcome::ok(format!("yazıldı ({} karakter)", text.chars().count())),
        Err(e) => ToolOutcome::err(format!("yazılamadı: {e}")),
    }
}

#[cfg(not(windows))]
fn type_platform(_text: &str) -> ToolOutcome {
    ToolOutcome::err("klavye kontrolü bu platformda desteklenmiyor")
}

#[cfg(windows)]
fn press_platform(sequence: &str, label: &str) -> ToolOutcome {
    use super::system::run_powershell;

    let safe = sequence.replace('\'', "''");
    let script = format!(
        "Add-Type -AssemblyName System.Windows.Forms; \
         [System.Windows.Forms.SendKeys]::SendWait('{safe}')"
    );

    match run_powershell(&script) {
        Ok(_) => ToolOutcome::ok(format!("{label} tuşuna basıldı")),
        Err(e) => ToolOutcome::err(format!("tuşa basılamadı: {e}")),
    }
}

#[cfg(not(windows))]
fn press_platform(_sequence: &str, _label: &str) -> ToolOutcome {
    ToolOutcome::err("klavye kontrolü bu platformda desteklenmiyor")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn click_requires_both_coordinates() {
        assert!(!Click.run(&serde_json::json!({})).ok);
        assert!(!Click.run(&serde_json::json!({"x": 100})).ok);
        assert!(!Click.run(&serde_json::json!({"y": 100})).ok);
    }

    #[test]
    fn click_rejects_off_screen_coordinates() {
        // Ekran dışına tıklamak anlamsız; model halüsinasyon görmüş olabilir.
        for (x, y) in [(-10.0, 100.0), (100.0, -5.0), (99999.0, 100.0)] {
            let args = serde_json::json!({"x": x, "y": y});
            let out = Click.run(&args);
            assert!(!out.ok, "({x},{y}) reddedilmeliydi");
            assert!(out.content.contains("ekran dışında"));
        }
    }

    #[test]
    fn click_accepts_string_coordinates() {
        // Model sayıyı string gönderebilir.
        let args = serde_json::json!({"x": "100", "y": "100"});
        assert_eq!(arg_num(&args, "x"), Some(100.0));
    }

    #[test]
    fn typing_rejects_overly_long_text() {
        let long = "a".repeat(MAX_TYPE_CHARS + 1);
        let args = serde_json::json!({"metin": long});
        let out = TypeText.run(&args);
        assert!(!out.ok);
        assert!(out.content.contains("çok uzun"));
    }

    #[test]
    fn typing_requires_text() {
        assert!(!TypeText.run(&serde_json::json!({})).ok);
    }

    #[test]
    fn all_input_tools_are_destructive() {
        // Model ekranı yanlış yorumlayabilir — kullanıcı her eylemi görmeli.
        assert_eq!(Click.risk(), Risk::Destructive);
        assert_eq!(TypeText.risk(), Risk::Destructive);
        assert_eq!(PressKey.risk(), Risk::Destructive);
        // Boyut sorgusu güvenli.
        assert_eq!(ScreenSize.risk(), Risk::Safe);
    }

    #[test]
    fn screen_size_returns_positive_dimensions() {
        let out = ScreenSize.run(&Value::Null);
        assert!(out.ok);
        assert!(out.content.contains('x'));

        let (w, h) = screen_size();
        assert!(w > 0 && h > 0, "ekran boyutu {w}x{h}");
    }

    // ── Tuş çevirisi ─────────────────────────────────────────────────────

    #[test]
    fn common_keys_translate() {
        assert_eq!(translate_keys("enter").as_deref(), Some("{ENTER}"));
        assert_eq!(translate_keys("ESC").as_deref(), Some("{ESC}"));
        assert_eq!(translate_keys("tab").as_deref(), Some("{TAB}"));
    }

    #[test]
    fn turkish_key_names_work() {
        assert_eq!(translate_keys("yukarı").as_deref(), Some("{UP}"));
        assert_eq!(translate_keys("aşağı").as_deref(), Some("{DOWN}"));
        assert_eq!(translate_keys("sil").as_deref(), Some("{DELETE}"));
    }

    #[test]
    fn modifier_combinations_translate() {
        assert_eq!(translate_keys("ctrl+s").as_deref(), Some("^s"));
        assert_eq!(translate_keys("alt+f4").as_deref(), Some("%{F4}"));
        assert_eq!(translate_keys("ctrl+shift+n").as_deref(), Some("^+n"));
    }

    #[test]
    fn unknown_keys_are_rejected_not_typed_literally() {
        // Tanınmayan tuş adını ekrana yazmak yerine hata dönmeli.
        assert!(translate_keys("bilinmeyen_tus").is_none());
        assert!(translate_keys("").is_none());

        let out = PressKey.run(&serde_json::json!({"tus": "saçmalık"}));
        assert!(!out.ok);
        assert!(out.content.contains("tanınmayan"));
    }

    #[test]
    fn single_letters_and_digits_pass_through() {
        assert_eq!(translate_keys("a").as_deref(), Some("a"));
        assert_eq!(translate_keys("5").as_deref(), Some("5"));
    }

    // ── SendKeys kaçırma ─────────────────────────────────────────────────

    #[test]
    fn sendkeys_special_characters_are_escaped() {
        // Kaçırılmazsa "+" shift, "^" ctrl olarak yorumlanır.
        assert_eq!(escape_sendkeys("a+b"), "a{+}b");
        assert_eq!(escape_sendkeys("100%"), "100{%}");
        assert_eq!(escape_sendkeys("f(x)"), "f{(}x{)}");
        assert_eq!(escape_sendkeys("a^b~c"), "a{^}b{~}c");
    }

    #[test]
    fn ordinary_text_survives_escaping() {
        let text = "merhaba dünya 123";
        assert_eq!(escape_sendkeys(text), text);
    }

    #[test]
    fn turkish_characters_survive_escaping() {
        let text = "çğıöşü ÇĞİÖŞÜ";
        assert_eq!(escape_sendkeys(text), text);
    }

    #[test]
    fn descriptions_tell_the_model_to_look_first() {
        // Koordinat uydurmasın, önce ekrana baksın.
        assert!(Click.description().contains("ekran_goruntusu"));
        assert!(TypeText.description().contains("tıkla"));
    }
}
