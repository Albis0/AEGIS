//! Web tool'ları — arama ve sayfa okuma.
//!
//! Arama, birden fazla sağlayıcıyı sırayla deneyen zincire devrediyor
//! (bkz. [`crate::websearch`]). Anahtar girilmemişse zincir anahtarsız
//! DuckDuckGo'ya düşer, yani kurulum yapmayan kullanıcı da arama yapabilir.

use crate::tool::{arg_str, Domain, Param, Tool, ToolOutcome};
use crate::websearch;
use serde_json::Value;
use std::time::Duration;

/// Modele verilecek en fazla metin — bağlamı boğmamak için.
const MAX_CONTENT_CHARS: usize = 6_000;

/// Zincirden istenecek sonuç sayısı.
///
/// Beş, bağlam maliyeti ile kapsama arasında dengeli: model genelde ilk
/// iki-üç sonucu kullanıyor, fazlası token yakıyor.
const MAX_RESULTS: usize = 5;

/// Engelleyen HTTP çağrısı yapan yardımcı.
///
/// Tool'lar senkron çalışıyor; ağ işi [`run_async`](crate::run_async)
/// üzerinden yürütülür. Burada doğrudan çalışma zamanı kurup `block_on`
/// çağırmak, ajan döngüsü async olduğu için panikliyor.
fn http_get(url: &str) -> Result<String, String> {
    crate::run_async(async {
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
    })?
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
            let rest: String = lower_chars[i..(i + 8).min(lower_chars.len())]
                .iter()
                .collect();
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
        "web_search"
    }

    fn description(&self) -> &'static str {
        "İnternette arama yapar. Güncel bilgi, haber, hava durumu gibi \
         bilmediğin şeyler için kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Web
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("query", "What to search for")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["ara", "web", "internet", "haber", "güncel", "hava"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(query) = arg_str(args, "query") else {
            return ToolOutcome::err("sorgu parametresi gerekli");
        };

        // Hangi sağlayıcının cevapladığı modeli ilgilendirmez — zincir bir
        // çalışma zamanı detayı. Bkz. `websearch`.
        match websearch::search(query, MAX_RESULTS) {
            Ok((response, _attempts)) => {
                // Result snippets are written by whoever owns the page, so
                // they get the same framing a fetched page does.
                let body = websearch::format_for_model(&response, MAX_CONTENT_CHARS);
                let wrapped = crate::untrusted::wrap("web araması", &body);
                if wrapped.suspicious() {
                    tracing::warn!(
                        %query,
                        patterns = ?wrapped.flags,
                        "search results try to instruct the model"
                    );
                }
                ToolOutcome::ok(wrapped.text)
            }
            Err(attempts) => {
                // Neden sonuç gelmediğini söyle: anahtar eksikse kullanıcı
                // ekleyebilir, kota dolduysa beklemesi gerektiğini bilir.
                let detail = attempts
                    .iter()
                    .map(|a| format!("{}: {}", a.provider, a.error))
                    .collect::<Vec<_>>()
                    .join(", ");
                if detail.is_empty() {
                    ToolOutcome::err("arama sağlayıcısı yapılandırılmamış")
                } else {
                    ToolOutcome::err(format!("'{query}' aranamadı ({detail})"))
                }
            }
        }
    }
}

/// Bir web sayfasının metnini okur.
pub struct FetchUrl;

impl Tool for FetchUrl {
    fn name(&self) -> &'static str {
        "fetch_page"
    }

    fn description(&self) -> &'static str {
        "Fetches the text content of a web page. Use when the user gives a link."
    }

    fn domain(&self) -> Domain {
        Domain::Web
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("url", "URL of the page to read")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["sayfa", "link", "url", "site", "oku", "özetle"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(raw) = arg_str(args, "url") else {
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

                // The page is a stranger's text, not the user's. Frame it so
                // the model can tell the difference -- see `untrusted`.
                let wrapped = crate::untrusted::wrap(&url, &format!("{clipped}{suffix}"));
                if wrapped.suspicious() {
                    tracing::warn!(
                        %url,
                        patterns = ?wrapped.flags,
                        "fetched page tries to instruct the model"
                    );
                }
                ToolOutcome::ok(wrapped.text)
            }
            Err(e) => ToolOutcome::err(format!("{url} okunamadı: {e}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert!(required.contains(&Value::String("query".into())));
    }
}
