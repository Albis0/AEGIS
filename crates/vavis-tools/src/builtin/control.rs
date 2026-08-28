//! Sistem kontrol tool'ları — parlaklık, uygulama, pano, komut.
//!
//! **Güvenlik notu:** Bu modüldeki bazı tool'lar gerçekten tehlikeli
//! (`komut_calistir` her şeyi yapabilir). Risk seviyeleri buna göre ayarlı;
//! izin kapısı onay istemeden çalışmazlar.

use crate::tool::{arg_num, arg_str, Domain, Param, Risk, Tool, ToolOutcome};
use serde_json::Value;

#[cfg(windows)]
use super::system::run_powershell;

/// Ekran parlaklığı.
pub struct SetBrightness;

impl Tool for SetBrightness {
    fn name(&self) -> &'static str {
        "parlaklik_ayarla"
    }

    fn description(&self) -> &'static str {
        "Ekran parlaklığını 0-100 arasına ayarlar. Dizüstü ekranlarda çalışır."
    }

    fn domain(&self) -> Domain {
        Domain::Control
    }

    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("seviye", "0 ile 100 arası parlaklık")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["parlaklık", "ekran", "brightness", "karart", "aydınlat"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(level) = arg_num(args, "seviye") else {
            return ToolOutcome::err("seviye parametresi gerekli (0-100)");
        };
        if !(0.0..=100.0).contains(&level) {
            return ToolOutcome::err("seviye 0-100 arasında olmalı");
        }
        set_brightness_platform(level as u32)
    }
}

#[cfg(windows)]
fn set_brightness_platform(level: u32) -> ToolOutcome {
    // WMI arayüzü — harici monitörlerde çalışmaz, sadece dizüstü panelinde.
    let script = format!(
        "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods)\
         .WmiSetBrightness(1,{level})"
    );
    match run_powershell(&script) {
        Ok(_) => ToolOutcome::ok(format!("Parlaklık %{level} yapıldı")),
        Err(e) => ToolOutcome::err(format!(
            "parlaklık ayarlanamadı ({e}) — harici monitörde desteklenmiyor olabilir"
        )),
    }
}

#[cfg(not(windows))]
fn set_brightness_platform(_level: u32) -> ToolOutcome {
    ToolOutcome::err("parlaklık ayarı bu platformda desteklenmiyor")
}

/// Uygulama başlatma.
pub struct LaunchApp;

impl Tool for LaunchApp {
    fn name(&self) -> &'static str {
        "uygulama_ac"
    }

    fn description(&self) -> &'static str {
        "Bir uygulamayı başlatır. Örnek: notepad, chrome, spotify, calc, explorer."
    }

    fn domain(&self) -> Domain {
        Domain::Control
    }

    /// Program başlatmak geri alınabilir ama kullanıcı bilmeli.
    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::required("ad", "Uygulama adı veya tam yolu"),
            Param::optional("argumanlar", "Uygulamaya geçirilecek argümanlar"),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["aç", "başlat", "çalıştır", "uygulama", "program"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(name) = arg_str(args, "ad") else {
            return ToolOutcome::err("ad parametresi gerekli");
        };
        // Boşluk/tırnak içeren adları reddet — komut enjeksiyonu vektörü.
        if name.contains('"') || name.contains(';') || name.contains('|') || name.contains('&') {
            return ToolOutcome::err("uygulama adında geçersiz karakter var");
        }
        launch_platform(name, arg_str(args, "argumanlar"))
    }
}

#[cfg(windows)]
fn launch_platform(name: &str, arguments: Option<&str>) -> ToolOutcome {
    use std::process::Command;

    // `cmd /C start` kabuk kısayollarını (chrome, spotify…) da çözer.
    let mut cmd = Command::new("cmd");
    cmd.args(["/C", "start", ""]);
    cmd.arg(name);
    if let Some(a) = arguments {
        for part in a.split_whitespace() {
            cmd.arg(part);
        }
    }

    match cmd.spawn() {
        Ok(_) => ToolOutcome::ok(format!("{name} başlatıldı")),
        Err(e) => ToolOutcome::err(format!("{name} başlatılamadı: {e}")),
    }
}

#[cfg(not(windows))]
fn launch_platform(_name: &str, _arguments: Option<&str>) -> ToolOutcome {
    ToolOutcome::err("uygulama başlatma bu platformda desteklenmiyor")
}

/// Uygulama kapatma.
pub struct CloseApp;

impl Tool for CloseApp {
    fn name(&self) -> &'static str {
        "uygulama_kapat"
    }

    fn description(&self) -> &'static str {
        "Çalışan bir uygulamayı kapatır. Kaydedilmemiş veri kaybolabilir."
    }

    fn domain(&self) -> Domain {
        Domain::Control
    }

    /// Kaydedilmemiş veri kaybına yol açabilir.
    fn risk(&self) -> Risk {
        Risk::Destructive
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("ad", "Kapatılacak uygulamanın süreç adı")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["kapat", "sonlandır", "durdur", "uygulama"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(name) = arg_str(args, "ad") else {
            return ToolOutcome::err("ad parametresi gerekli");
        };

        // Kendimizi kapatmak anlamsız; sistem süreçlerini kapatmak tehlikeli.
        let lower = name.to_lowercase();
        const PROTECTED: [&str; 6] = [
            "vavis", "system", "csrss", "winlogon", "services", "svchost",
        ];
        if PROTECTED.iter().any(|p| lower.contains(p)) {
            return ToolOutcome::err(format!("{name} korumalı bir süreç — kapatılamaz"));
        }

        close_platform(name)
    }
}

#[cfg(windows)]
fn close_platform(name: &str) -> ToolOutcome {
    // Ad tırnak içinde geçiyor; tırnak/noktalı virgül reddedilmeli.
    if name.contains('\'') || name.contains(';') {
        return ToolOutcome::err("geçersiz süreç adı");
    }
    let stem = name.trim_end_matches(".exe");
    let script = format!("Stop-Process -Name '{stem}' -Force -ErrorAction Stop");

    match run_powershell(&script) {
        Ok(_) => ToolOutcome::ok(format!("{name} kapatıldı")),
        Err(e) => ToolOutcome::err(format!("{name} kapatılamadı: {e}")),
    }
}

#[cfg(not(windows))]
fn close_platform(_name: &str) -> ToolOutcome {
    ToolOutcome::err("uygulama kapatma bu platformda desteklenmiyor")
}

/// Rastgele komut çalıştırma — en tehlikeli tool.
pub struct RunCommand;

impl Tool for RunCommand {
    fn name(&self) -> &'static str {
        "komut_calistir"
    }

    fn description(&self) -> &'static str {
        "Bir PowerShell komutu çalıştırır. Sadece başka bir aracın \
         yapamadığı işler için kullan — dosya, ses, uygulama için özel araçlar var."
    }

    fn domain(&self) -> Domain {
        Domain::Control
    }

    /// Her şeyi yapabilir — her zaman onay.
    fn risk(&self) -> Risk {
        Risk::Destructive
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("komut", "Çalıştırılacak PowerShell komutu")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["komut", "powershell", "çalıştır", "script"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(command) = arg_str(args, "komut") else {
            return ToolOutcome::err("komut parametresi gerekli");
        };
        run_command_platform(command)
    }
}

#[cfg(windows)]
fn run_command_platform(command: &str) -> ToolOutcome {
    match run_powershell(command) {
        Ok(output) => {
            if output.trim().is_empty() {
                ToolOutcome::ok("komut çalıştı (çıktı yok)")
            } else {
                // Uzun çıktı modelin bağlamını boğar.
                let clipped: String = output.chars().take(4000).collect();
                let suffix = if output.chars().count() > 4000 {
                    "\n…(kırpıldı)"
                } else {
                    ""
                };
                ToolOutcome::ok(format!("{clipped}{suffix}"))
            }
        }
        Err(e) => ToolOutcome::err(format!("komut başarısız: {e}")),
    }
}

#[cfg(not(windows))]
fn run_command_platform(_command: &str) -> ToolOutcome {
    ToolOutcome::err("komut çalıştırma bu platformda desteklenmiyor")
}

/// Panoyu oku.
pub struct ReadClipboard;

impl Tool for ReadClipboard {
    fn name(&self) -> &'static str {
        "pano_oku"
    }

    fn description(&self) -> &'static str {
        "Panodaki metni okur. Kullanıcı 'kopyaladığım şey' dediğinde kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Control
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["pano", "kopyala", "clipboard", "yapıştır"]
    }

    fn run(&self, _args: &Value) -> ToolOutcome {
        read_clipboard_platform()
    }
}

#[cfg(windows)]
fn read_clipboard_platform() -> ToolOutcome {
    match run_powershell("Get-Clipboard -Raw") {
        Ok(text) if text.trim().is_empty() => ToolOutcome::ok("pano boş"),
        Ok(text) => {
            let clipped: String = text.chars().take(4000).collect();
            ToolOutcome::ok(clipped)
        }
        Err(e) => ToolOutcome::err(format!("pano okunamadı: {e}")),
    }
}

#[cfg(not(windows))]
fn read_clipboard_platform() -> ToolOutcome {
    ToolOutcome::err("pano bu platformda desteklenmiyor")
}

/// Panoya yaz.
pub struct WriteClipboard;

impl Tool for WriteClipboard {
    fn name(&self) -> &'static str {
        "pano_yaz"
    }

    fn description(&self) -> &'static str {
        "Panoya metin kopyalar."
    }

    fn domain(&self) -> Domain {
        Domain::Control
    }

    /// Panonun içeriğini değiştirir — kullanıcının kopyaladığı şey kaybolur.
    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("metin", "Panoya kopyalanacak metin")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["pano", "kopyala", "clipboard"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(text) = arg_str(args, "metin") else {
            return ToolOutcome::err("metin parametresi gerekli");
        };
        write_clipboard_platform(text)
    }
}

#[cfg(windows)]
fn write_clipboard_platform(text: &str) -> ToolOutcome {
    let safe = text.replace('\'', "''");
    match run_powershell(&format!("Set-Clipboard -Value '{safe}'")) {
        Ok(_) => ToolOutcome::ok(format!("panoya kopyalandı ({} karakter)", text.chars().count())),
        Err(e) => ToolOutcome::err(format!("panoya yazılamadı: {e}")),
    }
}

#[cfg(not(windows))]
fn write_clipboard_platform(_text: &str) -> ToolOutcome {
    ToolOutcome::err("pano bu platformda desteklenmiyor")
}

/// Açık pencereleri listele.
pub struct ListWindows;

impl Tool for ListWindows {
    fn name(&self) -> &'static str {
        "pencereleri_listele"
    }

    fn description(&self) -> &'static str {
        "Açık pencereleri ve başlıklarını listeler."
    }

    fn domain(&self) -> Domain {
        Domain::Control
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["pencere", "açık", "window", "uygulama"]
    }

    fn run(&self, _args: &Value) -> ToolOutcome {
        list_windows_platform()
    }
}

#[cfg(windows)]
fn list_windows_platform() -> ToolOutcome {
    let script = "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | \
                  Select-Object -First 20 -Property ProcessName, MainWindowTitle | \
                  ForEach-Object { \"$($_.ProcessName) — $($_.MainWindowTitle)\" }";

    match run_powershell(script) {
        Ok(out) if out.trim().is_empty() => ToolOutcome::ok("açık pencere bulunamadı"),
        Ok(out) => ToolOutcome::ok(out),
        Err(e) => ToolOutcome::err(format!("pencereler listelenemedi: {e}")),
    }
}

#[cfg(not(windows))]
fn list_windows_platform() -> ToolOutcome {
    ToolOutcome::err("pencere listeleme bu platformda desteklenmiyor")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn brightness_rejects_out_of_range() {
        for bad in [-1.0, 101.0, 500.0] {
            let args = serde_json::json!({"seviye": bad});
            assert!(!SetBrightness.run(&args).ok, "{bad} reddedilmeliydi");
        }
    }

    #[test]
    fn brightness_requires_the_parameter() {
        assert!(!SetBrightness.run(&serde_json::json!({})).ok);
    }

    #[test]
    fn launch_rejects_shell_metacharacters() {
        // Komut enjeksiyonu vektörü — reddedilmeli.
        for evil in [
            "notepad; rm -rf /",
            "notepad | del",
            "notepad & format c:",
            "notepad\"quoted",
        ] {
            let args = serde_json::json!({"ad": evil});
            let out = LaunchApp.run(&args);
            assert!(!out.ok, "'{evil}' reddedilmeliydi");
            assert!(out.content.contains("geçersiz"));
        }
    }

    #[test]
    fn launch_requires_a_name() {
        assert!(!LaunchApp.run(&serde_json::json!({})).ok);
        assert!(!LaunchApp.run(&serde_json::json!({"ad": "  "})).ok);
    }

    #[test]
    fn close_refuses_to_kill_protected_processes() {
        // Kendini veya sistemi kapatmak felaket olur.
        for protected in ["vavis", "vavis.exe", "System", "csrss", "winlogon"] {
            let args = serde_json::json!({"ad": protected});
            let out = CloseApp.run(&args);
            assert!(!out.ok, "'{protected}' korunmalıydı");
            assert!(out.content.contains("korumalı"));
        }
    }

    #[test]
    fn close_rejects_quote_injection() {
        let args = serde_json::json!({"ad": "notepad'; Stop-Process -Name explorer; '"});
        assert!(!CloseApp.run(&args).ok);
    }

    #[test]
    fn dangerous_tools_are_marked_destructive() {
        // İzin kapısı bunlara güvenir.
        assert_eq!(RunCommand.risk(), Risk::Destructive);
        assert_eq!(CloseApp.risk(), Risk::Destructive);
        assert_eq!(SetBrightness.risk(), Risk::Moderate);
        assert_eq!(LaunchApp.risk(), Risk::Moderate);
        assert_eq!(WriteClipboard.risk(), Risk::Moderate);
        // Okuma güvenli.
        assert_eq!(ReadClipboard.risk(), Risk::Safe);
        assert_eq!(ListWindows.risk(), Risk::Safe);
    }

    #[test]
    fn command_requires_the_parameter() {
        assert!(!RunCommand.run(&serde_json::json!({})).ok);
    }

    #[test]
    fn clipboard_write_requires_text() {
        assert!(!WriteClipboard.run(&serde_json::json!({})).ok);
    }

    #[test]
    fn clipboard_read_works_or_reports_clearly() {
        let out = ReadClipboard.run(&Value::Null);
        if cfg!(windows) {
            // Boş pano da geçerli sonuç.
            assert!(out.ok || out.content.contains("okunamadı"));
        }
    }

    #[test]
    fn window_listing_returns_something_on_windows() {
        let out = ListWindows.run(&Value::Null);
        if cfg!(windows) {
            assert!(out.ok, "{}", out.content);
        }
    }

    #[test]
    fn all_descriptions_guide_the_model() {
        // Model ne zaman çağıracağını anlamalı.
        for (name, desc) in [
            (RunCommand.name(), RunCommand.description()),
            (LaunchApp.name(), LaunchApp.description()),
            (SetBrightness.name(), SetBrightness.description()),
        ] {
            assert!(desc.len() > 20, "{name}: açıklama çok kısa");
        }
        // Tehlikeli tool kendini son çare olarak tanıtmalı.
        assert!(
            RunCommand.description().contains("özel araçlar"),
            "komut_calistir, diğer araçları tercih ettirmeli"
        );
    }
}
