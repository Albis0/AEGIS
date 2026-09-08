//! Güncelleme kontrolü.
//!
//! # Ne yapıyor, ne yapmıyor
//!
//! GitHub'ın yayın listesine bakıyor, en son etiketi çalışan sürümle
//! karşılaştırıyor, ve yenisi varsa kullanıcıya **söylüyor**. İndirmeyi
//! kullanıcı yapıyor: tarayıcıda yayın sayfası açılıyor, `.exe` oradan
//! iniyor.
//!
//! ## Neden kendi kendine indirip kurmuyor
//!
//! Sessizce indirip çalıştıran bir güncelleyici, çalışan uygulamanın kendi
//! üstüne yazması demek — ve yarıda kaldığında geriye ne eski ne yeni sürüm
//! kalıyor. Doğrusu Tauri'nin imzalı güncelleyicisi, o da bir imzalama
//! anahtarı istiyor; bu ikili bilinçli olarak imzasız yayınlanıyor
//! (bkz. `SECURITY.md`). İmzasız bir ikiliyi arka planda indirip çalıştırmak,
//! güncelleme kanalını olduğu gibi saldırı yüzeyine çevirirdi.
//!
//! Bu yüzden buradaki iş dürüst olanı: haber vermek ve sayfayı açmak.
//!
//! ## Gizlilik
//!
//! Giden istekte kullanıcıya ait hiçbir şey yok — ne kimlik, ne ayar, ne
//! makine bilgisi. Yalnızca deponun genel yayın listesi okunuyor, kimlik
//! doğrulaması olmadan.

use vavis_core::version::{self, UpdateCheck};

/// Yayınların okunduğu adres.
///
/// Sabit: deponun adresi kullanıcının değiştirebileceği bir ayar olsaydı,
/// ayarı değiştiren biri güncellemeleri istediği yere yönlendirebilirdi.
const RELEASES_API: &str = "https://api.github.com/repos/Albis0/Vavis/releases/latest";

/// Kullanıcının indireceği sayfa — API yanıt vermezse de bu adres geçerli.
pub const RELEASES_PAGE: &str = "https://github.com/Albis0/Vavis/releases/latest";

/// GitHub'ın yanıtından yalnızca ihtiyacımız olan alanlar.
#[derive(serde::Deserialize)]
struct Release {
    tag_name: String,
    #[serde(default)]
    html_url: String,
    #[serde(default)]
    body: String,
    /// Taslak ve ön sürümler atlanıyor: yayınlanmamış bir sürüm kullanıcıya
    /// önerilmemeli.
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
}

/// En son yayını sorar ve bir karar döner.
///
/// Hata **yutulmuyor**: ağ yoksa kullanıcı bunu görüyor. Sessizce "güncelsin"
/// demek, eski sürümde kalmış birini güncel olduğuna inandırırdı.
pub async fn check() -> UpdateCheck {
    let current = version::CURRENT;

    let client = match reqwest::Client::builder()
        // Açılışta yapılan bir kontrol uygulamayı bekletmemeli.
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => return failed(current, e.to_string()),
    };

    let response = client
        .get(RELEASES_API)
        // GitHub API'si User-Agent olmadan 403 dönüyor.
        .header("User-Agent", "VAVIS")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await;

    let response = match response {
        Ok(r) => r,
        Err(e) => return failed(current, network_error(&e)),
    };

    if !response.status().is_success() {
        return failed(
            current,
            format!("güncelleme sunucusu {} döndü", response.status().as_u16()),
        );
    }

    let release: Release = match response.json().await {
        Ok(r) => r,
        Err(e) => return failed(current, format!("yanıt okunamadı: {e}")),
    };

    if release.draft || release.prerelease {
        // Yayınlanmamış sürüm önerilmiyor, ama bu bir hata da değil.
        return UpdateCheck::UpToDate {
            current: current.to_string(),
        };
    }

    let url = if release.html_url.is_empty() {
        RELEASES_PAGE
    } else {
        &release.html_url
    };

    version::decide(current, &release.tag_name, url, &trim_notes(&release.body))
}

/// Yayın notlarını kısaltır.
///
/// Tam notlar bazen yüzlerce satır oluyor; bir bildirim kutusunda okunacak
/// şey ilk birkaç satır. Kesildiğinde bunu söylüyor, yoksa notlar yarım
/// kalmış gibi görünürdü.
fn trim_notes(body: &str) -> String {
    const MAX_LINES: usize = 12;
    const MAX_CHARS: usize = 800;

    let mut out = String::new();
    let mut truncated = false;

    for (i, line) in body.lines().enumerate() {
        if i >= MAX_LINES || out.chars().count() + line.chars().count() > MAX_CHARS {
            truncated = true;
            break;
        }
        if !out.is_empty() {
            out.push('\n');
        }
        out.push_str(line);
    }

    if truncated {
        out.push_str("\n…");
    }
    out.trim().to_string()
}

/// Ağ hatasını kullanıcının anlayacağı hâle getirir.
fn network_error(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "güncelleme sunucusuna ulaşılamadı (zaman aşımı)".to_string()
    } else if e.is_connect() {
        "internet bağlantısı yok gibi görünüyor".to_string()
    } else {
        format!("güncelleme kontrol edilemedi: {e}")
    }
}

fn failed(current: &str, error: String) -> UpdateCheck {
    tracing::warn!(%error, "güncelleme kontrolü başarısız");
    UpdateCheck::Failed {
        current: current.to_string(),
        error,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn long_release_notes_are_trimmed_and_say_so() {
        let body = (1..=40)
            .map(|i| format!("satır {i}"))
            .collect::<Vec<_>>()
            .join("\n");
        let out = trim_notes(&body);
        assert!(out.contains("satır 1"));
        assert!(!out.contains("satır 40"), "uzun notlar kesilmeli");
        assert!(out.ends_with('…'), "kesildiği belli olmalı: {out}");
    }

    #[test]
    fn short_release_notes_are_left_alone() {
        let out = trim_notes("tek satır");
        assert_eq!(out, "tek satır");
        assert!(!out.contains('…'));
    }

    #[test]
    fn empty_notes_stay_empty() {
        assert_eq!(trim_notes(""), "");
        assert_eq!(trim_notes("   \n  "), "");
    }

    /// Yanıt yalnızca ihtiyacımız olan alanları içermeli, ve eksik alanlar
    /// çökmemeli — GitHub yanıtına alan ekleyip çıkarabiliyor.
    #[test]
    fn a_release_parses_from_a_partial_payload() {
        let json = r#"{"tag_name":"v1.2.3"}"#;
        let r: Release = serde_json::from_str(json).unwrap();
        assert_eq!(r.tag_name, "v1.2.3");
        assert!(!r.draft && !r.prerelease);
        assert!(r.html_url.is_empty());
    }

    #[test]
    fn drafts_and_prereleases_are_recognised() {
        let json = r#"{"tag_name":"v9.9.9","draft":true,"prerelease":false}"#;
        let r: Release = serde_json::from_str(json).unwrap();
        assert!(r.draft);
    }

    /// Adres sabit olmalı: ayardan gelseydi, ayarı değiştiren biri
    /// güncellemeleri başka bir yere yönlendirebilirdi.
    #[test]
    fn the_update_source_is_the_projects_own_repository() {
        assert!(RELEASES_API.starts_with("https://api.github.com/repos/Albis0/Vavis/"));
        assert!(RELEASES_PAGE.starts_with("https://github.com/Albis0/Vavis/"));
    }
}
