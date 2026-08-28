//! Web tool'ları — arama ve sayfa okuma.
//!
//! Anahtar gerektirmeyen kaynaklar kullanılıyor (DuckDuckGo, doğrudan HTTP).
//! Kullanıcı ek servis hesabı açmak zorunda kalmamalı.

use crate::tool::{arg_str, Domain, Param, Tool, ToolOutcome};
use serde_json::Value;
use std::time::Duration;

/// Modele verilecek en fazla metin — bağlamı boğmamak için.
const MAX_CONTENT_CHARS: usize = 6_000;

/// Engelleyen HTTP çağrısı yapan yardımcı.
///
/// Tool'lar senkron çalışıyor; ağ işi için kısa ömürlü bir çalışma zamanı
/// kurulur. Basit ve öngörülebilir — tool başına bir istek yapılıyor.
fn http_get(url: &str) -> Result<String, String> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| e.to_string())?;

    runtime.block_on(async {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            // Bazı siteler tarayıcı olmayan istekleri reddediyor.
            .user_agent("Mozilla/5.0 (compatible; Vavis/0.1)")
            .build()
            .map_err(|e| e.to_string())?;

        let resp = client.get(url).send().await.map_err(|e| {
            if e.is_timeout() {
                "zaman aşımı".to_string()
            } else if e.is_connect() {
                "bağlanılamadı".to_string()
            } else {
                e.to_string()
            }
        })?;

        let status = resp.status();
        if !status.is_success() {
            return Err(format!("sunucu {status} döndü"));
        }
        resp.text().await.map_err(|e| e.to_string())
    })
}

/// HTML'den okunabilir metin çıkarır.
///
/// Tam bir ayrıştırıcı değil — script/style atılır, etiketler soyulur,
/// boşluklar sadeleştirilir. Modelin okuması için yeterli.
fn html_to_text(html: &str) -> String {
    let mut out = String::with_capacity(html.len() / 3);
    let mut in_tag = false;
    let mut skip_depth = 0usize;
    let lower = html.to_lowercase();
    let bytes: Vec<char> = html.chars().collect();
    let lower_chars: Vec<char> = lower.chars().collect();

    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i];

        if c == '<' {
            // script/style bloklarını tamamen atla.
            let rest: String = lower_chars[i..(i + 8).min(lower_chars.len())].iter().collect();
            if rest.starts_with("<script") || rest.starts_with("<style") {
                skip_depth += 1;
            } else if rest.starts_with("</script") || rest.starts_with("</style") {
                skip_depth = skip_depth.saturating_sub(1);
            }
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
            // Blok etiketlerinden sonra satır sonu koy ki metin yapışmasın.
            if skip_depth == 0 && !out.ends_with('\n') {
                out.push('\n');
            }
        } else if !in_tag && skip_depth == 0 {
            out.push(c);
        }
        i += 1;
    }

    // HTML varlıklarını çöz (en yaygın olanlar).
    let out = out
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");

    // Boş satırları ve fazla boşlukları sadeleştir.
    out.lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

/// Web araması.
pub struct WebSearch;

impl Tool for WebSearch {
    fn name(&self) -> &'static str {
        "web_ara"
    }

    fn description(&self) -> &'static str {
        "İnternette arama yapar. Güncel bilgi, haber, hava durumu gibi \
         bilmediğin şeyler için kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Web
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("sorgu", "Aranacak metin")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["ara", "web", "internet", "haber", "güncel", "hava"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(query) = arg_str(args, "sorgu") else {
            return ToolOutcome::err("sorgu parametresi gerekli");
        };

        // DuckDuckGo Anlık Cevap API'si — anahtarsız.
        let url = format!(
            "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
            urlencode(query)
        );

        let body = match http_get(&url) {
            Ok(b) => b,
            Err(e) => return ToolOutcome::err(format!("arama başarısız: {e}")),
        };

        let Ok(json) = serde_json::from_str::<Value>(&body) else {
            return ToolOutcome::err("arama sonucu çözümlenemedi");
        };

        let mut parts: Vec<String> = Vec::new();

        if let Some(abstract_text) = json["AbstractText"].as_str() {
            if !abstract_text.is_empty() {
                parts.push(abstract_text.to_string());
                if let Some(src) = json["AbstractURL"].as_str() {
                    if !src.is_empty() {
                        parts.push(format!("kaynak: {src}"));
                    }
                }
            }
        }

        if let Some(topics) = json["RelatedTopics"].as_array() {
            for t in topics.iter().take(5) {
                if let Some(text) = t["Text"].as_str() {
                    if !text.is_empty() {
                        parts.push(format!("• {text}"));
                    }
                }
            }
        }

        if parts.is_empty() {
            ToolOutcome::ok(format!(
                "'{query}' için doğrudan sonuç bulunamadı. \
                 Bir sayfa adresi verilirse sayfa_oku ile içeriği okunabilir."
            ))
        } else {
            let joined = parts.join("\n");
            ToolOutcome::ok(joined.chars().take(MAX_CONTENT_CHARS).collect::<String>())
        }
    }
}

/// Bir web sayfasının metnini okur.
pub struct FetchUrl;

impl Tool for FetchUrl {
    fn name(&self) -> &'static str {
        "sayfa_oku"
    }

    fn description(&self) -> &'static str {
        "Bir web sayfasının metin içeriğini getirir. Kullanıcı link verdiğinde kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Web
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("adres", "Okunacak sayfanın adresi (URL)")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["sayfa", "link", "url", "site", "oku", "özetle"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(raw) = arg_str(args, "adres") else {
            return ToolOutcome::err("adres parametresi gerekli");
        };

        // Şema eksikse https varsay — kullanıcı "example.com" yazabilir.
        let url = if raw.starts_with("http://") || raw.starts_with("https://") {
            raw.to_string()
        } else {
            format!("https://{raw}")
        };

        // Yalnızca http(s): dosya sistemine veya yerel servislere erişim yok.
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return ToolOutcome::err("sadece http/https adresleri okunabilir");
        }

        match http_get(&url) {
            Ok(body) => {
                let text = html_to_text(&body);
                if text.trim().is_empty() {
                    return ToolOutcome::err("sayfada okunabilir metin bulunamadı");
                }
                let clipped: String = text.chars().take(MAX_CONTENT_CHARS).collect();
                let suffix = if text.chars().count() > MAX_CONTENT_CHARS {
                    "\n…(kırpıldı)"
                } else {
                    ""
                };
                ToolOutcome::ok(format!("{clipped}{suffix}"))
            }
            Err(e) => ToolOutcome::err(format!("{url} okunamadı: {e}")),
        }
    }
}

/// Basit URL kodlama — sorgu dizesi için.
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urlencoding_escapes_special_characters() {
        assert_eq!(urlencode("hava durumu"), "hava+durumu");
        assert_eq!(urlencode("a&b"), "a%26b");
        assert_eq!(urlencode("abc123-_.~"), "abc123-_.~");
    }

    #[test]
    fn urlencoding_handles_turkish() {
        // Türkçe karakterler UTF-8 baytları olarak kodlanmalı.
        let encoded = urlencode("şğü");
        assert!(encoded.starts_with('%'));
        assert!(!encoded.contains('ş'));
    }

    #[test]
    fn html_tags_are_stripped() {
        let html = "<html><body><p>Merhaba</p><div>dünya</div></body></html>";
        let text = html_to_text(html);
        assert!(text.contains("Merhaba"));
        assert!(text.contains("dünya"));
        assert!(!text.contains('<'), "etiket kalmamalı: {text}");
    }

    #[test]
    fn script_and_style_content_is_removed() {
        let html = "<p>görünür</p><script>var gizli = 1;</script><style>.x{color:red}</style>";
        let text = html_to_text(html);
        assert!(text.contains("görünür"));
        assert!(!text.contains("gizli"), "script içeriği sızdı: {text}");
        assert!(!text.contains("color"), "style içeriği sızdı: {text}");
    }

    #[test]
    fn html_entities_are_decoded() {
        let text = html_to_text("<p>a &amp; b &lt;c&gt; &quot;d&quot;</p>");
        assert!(text.contains("a & b"));
        assert!(text.contains("<c>"));
        assert!(text.contains("\"d\""));
    }

    #[test]
    fn blank_lines_are_collapsed() {
        let html = "<div>bir</div><div></div><div>iki</div>";
        let text = html_to_text(html);
        assert!(!text.contains("\n\n"), "boş satır kalmamalı: {text:?}");
    }

    #[test]
    fn empty_html_yields_empty_text() {
        assert!(html_to_text("").is_empty());
        assert!(html_to_text("<html><body></body></html>").trim().is_empty());
    }

    #[test]
    fn missing_parameters_are_rejected_without_network_calls() {
        assert!(!WebSearch.run(&serde_json::json!({})).ok);
        assert!(!FetchUrl.run(&serde_json::json!({})).ok);
    }

    #[test]
    fn web_tools_are_safe_risk() {
        // Okuma işlemleri — onay gerektirmez.
        assert_eq!(WebSearch.risk(), crate::tool::Risk::Safe);
        assert_eq!(FetchUrl.risk(), crate::tool::Risk::Safe);
    }

    #[test]
    fn schemas_declare_required_parameters() {
        let s = WebSearch.schema();
        let required = s["function"]["parameters"]["required"].as_array().unwrap();
        assert!(required.contains(&Value::String("sorgu".into())));
    }
}
