//! Concrete search backends.
//!
//! Each provider translates one upstream API into the shared [`SearchResponse`]
//! shape. They are deliberately thin: no retries, no caching, no cleverness.
//! Retry policy belongs to the chain, which has the other providers to fall
//! back to.

use super::{Hit, Provider, ProviderError, SearchResponse};
use serde_json::Value;
use std::time::Duration;

/// Upper bound on a single provider call.
///
/// Kept short: a slow provider must not hold up the whole chain, and there is
/// almost always another one behind it.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(12);

/// Snippets are trimmed per hit so one verbose provider cannot crowd out the
/// rest of the results.
const MAX_SNIPPET_CHARS: usize = 400;

/// A blocking HTTP request.
///
/// Goes through [`run_async`], which is what makes this safe to call from the
/// agent loop: that loop is async, so building a runtime here and blocking on
/// it directly panics with "Cannot start a runtime from within a runtime".
fn request(
    method: reqwest::Method,
    url: &str,
    headers: &[(String, String)],
    body: Option<Value>,
) -> Result<(u16, String), ProviderError> {
    crate::run_async(async {
        let client = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .user_agent("Mozilla/5.0 (compatible; Vavis/0.3)")
            .build()
            .map_err(|e| ProviderError::Failed(e.to_string()))?;

        let mut req = client.request(method, url);
        for (name, value) in headers {
            req = req.header(name.as_str(), value);
        }
        if let Some(json) = body {
            req = req.json(&json);
        }

        let resp = req.send().await.map_err(|e| {
            if e.is_timeout() {
                ProviderError::Failed("timed out".into())
            } else if e.is_connect() {
                ProviderError::Failed("could not connect".into())
            } else {
                ProviderError::Failed(e.to_string())
            }
        })?;

        let status = resp.status().as_u16();
        let text = resp
            .text()
            .await
            .map_err(|e| ProviderError::Failed(e.to_string()))?;
        Ok((status, text))
    })
    // `run_async` reports its own failure separately from the request's, so
    // the two Results are flattened into the one the caller expects.
    .map_err(ProviderError::Failed)?
}

/// Maps an HTTP status onto the chain's failure vocabulary.
///
/// 429 is the obvious rate limit; 402 (payment required) and 403 are how
/// several providers signal an exhausted free tier, and retrying those within
/// the same minute is equally pointless.
fn classify_status(status: u16, body: &str) -> Option<ProviderError> {
    match status {
        200..=299 => None,
        429 => Some(ProviderError::RateLimited),
        401 => Some(ProviderError::Failed("key rejected".into())),
        402 => Some(ProviderError::RateLimited),
        403 if body.to_lowercase().contains("quota")
            || body.to_lowercase().contains("limit")
            || body.to_lowercase().contains("plan") =>
        {
            Some(ProviderError::RateLimited)
        }
        _ => Some(ProviderError::Failed(format!("HTTP {status}"))),
    }
}

fn clip(text: &str) -> String {
    let text = text.trim();
    if text.chars().count() > MAX_SNIPPET_CHARS {
        text.chars().take(MAX_SNIPPET_CHARS).collect()
    } else {
        text.to_string()
    }
}

fn parse_json(body: &str) -> Result<Value, ProviderError> {
    serde_json::from_str(body).map_err(|_| ProviderError::Failed("malformed response".into()))
}

// ---------------------------------------------------------------------------
// Tavily
// ---------------------------------------------------------------------------

/// Tavily — built for LLM consumption, returns a written answer plus sources.
///
/// First in the default order because its answer field usually removes the
/// need for a follow-up page fetch.
pub struct Tavily {
    pub key: String,
}

impl Provider for Tavily {
    fn id(&self) -> &'static str {
        "tavily"
    }

    fn available(&self) -> bool {
        !self.key.trim().is_empty()
    }

    fn search(&self, query: &str, limit: usize) -> Result<SearchResponse, ProviderError> {
        if !self.available() {
            return Err(ProviderError::NotConfigured);
        }

        // The key goes in both the header and the body: Tavily moved to bearer
        // auth but still accepts the original body field, and sending both
        // works against either generation of the API.
        let body = serde_json::json!({
            "api_key": self.key,
            "query": query,
            "max_results": limit,
            "search_depth": "basic",
            "include_answer": true,
        });

        let (status, text) = request(
            reqwest::Method::POST,
            "https://api.tavily.com/search",
            &[("Authorization".to_string(), format!("Bearer {}", self.key))],
            Some(body),
        )?;

        if let Some(err) = classify_status(status, &text) {
            return Err(err);
        }

        let json = parse_json(&text)?;
        let answer = json["answer"]
            .as_str()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);

        let hits: Vec<Hit> = json["results"]
            .as_array()
            .map(|rows| {
                rows.iter()
                    .filter_map(|r| {
                        let url = r["url"].as_str()?;
                        Some(Hit {
                            title: r["title"].as_str().unwrap_or(url).to_string(),
                            url: url.to_string(),
                            snippet: clip(r["content"].as_str().unwrap_or_default()),
                        })
                    })
                    .take(limit)
                    .collect()
            })
            .unwrap_or_default();

        if hits.is_empty() && answer.is_none() {
            return Err(ProviderError::Empty);
        }

        Ok(SearchResponse {
            provider: "tavily".into(),
            answer,
            hits,
        })
    }
}

// ---------------------------------------------------------------------------
// Brave
// ---------------------------------------------------------------------------

/// Brave Search — an independent index, generous free tier.
pub struct Brave {
    pub key: String,
}

impl Provider for Brave {
    fn id(&self) -> &'static str {
        "brave"
    }

    fn available(&self) -> bool {
        !self.key.trim().is_empty()
    }

    fn search(&self, query: &str, limit: usize) -> Result<SearchResponse, ProviderError> {
        if !self.available() {
            return Err(ProviderError::NotConfigured);
        }

        let url = format!(
            "https://api.search.brave.com/res/v1/web/search?q={}&count={}",
            urlencode(query),
            limit
        );

        let (status, text) = request(
            reqwest::Method::GET,
            &url,
            &[
                ("Accept".to_string(), "application/json".to_string()),
                ("X-Subscription-Token".to_string(), self.key.clone()),
            ],
            None,
        )?;

        if let Some(err) = classify_status(status, &text) {
            return Err(err);
        }

        let json = parse_json(&text)?;
        let hits: Vec<Hit> = json["web"]["results"]
            .as_array()
            .map(|rows| {
                rows.iter()
                    .filter_map(|r| {
                        let url = r["url"].as_str()?;
                        Some(Hit {
                            title: r["title"].as_str().unwrap_or(url).to_string(),
                            url: url.to_string(),
                            // Brave marks query terms with <strong> tags.
                            snippet: clip(&strip_tags(
                                r["description"].as_str().unwrap_or_default(),
                            )),
                        })
                    })
                    .take(limit)
                    .collect()
            })
            .unwrap_or_default();

        if hits.is_empty() {
            return Err(ProviderError::Empty);
        }

        Ok(SearchResponse {
            provider: "brave".into(),
            answer: None,
            hits,
        })
    }
}

// ---------------------------------------------------------------------------
// DuckDuckGo
// ---------------------------------------------------------------------------

/// DuckDuckGo Instant Answer — needs no key, so it is the floor of the chain.
///
/// It only answers well-known entities and returns nothing for most real
/// queries, which is exactly why it sits last rather than being the only
/// option.
pub struct DuckDuckGo;

impl Provider for DuckDuckGo {
    fn id(&self) -> &'static str {
        "duckduckgo"
    }

    fn available(&self) -> bool {
        true
    }

    fn search(&self, query: &str, limit: usize) -> Result<SearchResponse, ProviderError> {
        let url = format!(
            "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
            urlencode(query)
        );

        let (status, text) = request(reqwest::Method::GET, &url, &[], None)?;
        if let Some(err) = classify_status(status, &text) {
            return Err(err);
        }

        let json = parse_json(&text)?;

        let answer = json["AbstractText"]
            .as_str()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);

        let mut hits = Vec::new();
        if let Some(src) = json["AbstractURL"].as_str().filter(|s| !s.is_empty()) {
            hits.push(Hit {
                title: json["Heading"].as_str().unwrap_or(src).to_string(),
                url: src.to_string(),
                snippet: String::new(),
            });
        }

        if let Some(topics) = json["RelatedTopics"].as_array() {
            for topic in topics {
                if hits.len() >= limit {
                    break;
                }
                // Grouped topics nest their entries under "Topics".
                let Some(url) = topic["FirstURL"].as_str() else {
                    continue;
                };
                let text = topic["Text"].as_str().unwrap_or_default();
                hits.push(Hit {
                    title: text.split(" - ").next().unwrap_or(url).to_string(),
                    url: url.to_string(),
                    snippet: clip(text),
                });
            }
        }

        if hits.is_empty() && answer.is_none() {
            return Err(ProviderError::Empty);
        }

        Ok(SearchResponse {
            provider: "duckduckgo".into(),
            answer,
            hits,
        })
    }
}

// ---------------------------------------------------------------------------
// Custom
// ---------------------------------------------------------------------------

/// A user-described JSON search endpoint — self-hosted SearxNG, a company
/// search service, anything that answers with JSON.
///
/// The user supplies a URL template and the field names to read, so no code
/// change is needed for a new backend.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct CustomConfig {
    /// URL with a `{query}` placeholder.
    pub url: String,
    /// Optional header for authentication, e.g. `Authorization`.
    pub header_name: String,
    /// Header value template with an optional `{key}` placeholder, filled from
    /// the stored secret.
    pub header_value: String,
    /// Key holding the results array, e.g. `results`. Dots descend into
    /// nested objects: `data.items`.
    pub results_path: String,
    pub title_key: String,
    pub url_key: String,
    pub snippet_key: String,
}

impl CustomConfig {
    /// Whether enough is filled in to attempt a call.
    pub fn is_usable(&self) -> bool {
        !self.url.trim().is_empty() && self.url.contains("{query}")
    }
}

pub struct Custom {
    pub config: CustomConfig,
    pub key: String,
}

/// Walks a dotted path into a JSON value.
fn dig<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = value;
    for segment in path.split('.').filter(|s| !s.is_empty()) {
        current = current.get(segment)?;
    }
    Some(current)
}

impl Provider for Custom {
    fn id(&self) -> &'static str {
        "custom"
    }

    fn available(&self) -> bool {
        self.config.is_usable()
    }

    fn search(&self, query: &str, limit: usize) -> Result<SearchResponse, ProviderError> {
        if !self.available() {
            return Err(ProviderError::NotConfigured);
        }

        let url = self.config.url.replace("{query}", &urlencode(query));

        let mut headers: Vec<(String, String)> =
            vec![("Accept".to_string(), "application/json".to_string())];
        if !self.config.header_name.trim().is_empty() {
            headers.push((
                self.config.header_name.trim().to_string(),
                self.config.header_value.replace("{key}", &self.key),
            ));
        }

        let (status, text) = request(reqwest::Method::GET, &url, &headers, None)?;
        if let Some(err) = classify_status(status, &text) {
            return Err(err);
        }

        let json = parse_json(&text)?;
        let results_path = if self.config.results_path.trim().is_empty() {
            "results"
        } else {
            self.config.results_path.trim()
        };

        let rows = dig(&json, results_path)
            .and_then(Value::as_array)
            .ok_or(ProviderError::Empty)?;

        let title_key = non_empty(&self.config.title_key, "title");
        let url_key = non_empty(&self.config.url_key, "url");
        let snippet_key = non_empty(&self.config.snippet_key, "content");

        let hits: Vec<Hit> = rows
            .iter()
            .filter_map(|r| {
                let url = r.get(url_key)?.as_str()?;
                Some(Hit {
                    title: r
                        .get(title_key)
                        .and_then(Value::as_str)
                        .unwrap_or(url)
                        .to_string(),
                    url: url.to_string(),
                    snippet: clip(
                        r.get(snippet_key)
                            .and_then(Value::as_str)
                            .unwrap_or_default(),
                    ),
                })
            })
            .take(limit)
            .collect();

        if hits.is_empty() {
            return Err(ProviderError::Empty);
        }

        Ok(SearchResponse {
            provider: "custom".into(),
            answer: None,
            hits,
        })
    }
}

fn non_empty<'a>(value: &'a str, fallback: &'a str) -> &'a str {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        fallback
    } else {
        trimmed
    }
}

/// Percent-encoding for query strings.
pub fn urlencode(s: &str) -> String {
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

/// Removes the highlight markup some providers wrap query terms in.
fn strip_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn providers_without_keys_report_unavailable() {
        assert!(!Tavily { key: String::new() }.available());
        assert!(!Brave { key: "   ".into() }.available());
        // DuckDuckGo needs no key, so it is always the working floor.
        assert!(DuckDuckGo.available());
    }

    #[test]
    fn unconfigured_providers_fail_without_network_calls() {
        assert_eq!(
            Tavily { key: String::new() }.search("q", 5).unwrap_err(),
            ProviderError::NotConfigured
        );
        assert_eq!(
            Brave { key: String::new() }.search("q", 5).unwrap_err(),
            ProviderError::NotConfigured
        );
    }

    #[test]
    fn rate_limit_statuses_are_classified_for_cooldown() {
        assert_eq!(classify_status(429, ""), Some(ProviderError::RateLimited));
        assert_eq!(classify_status(402, ""), Some(ProviderError::RateLimited));
        assert_eq!(
            classify_status(403, "monthly quota exceeded"),
            Some(ProviderError::RateLimited)
        );
    }

    #[test]
    fn plain_forbidden_is_not_a_rate_limit() {
        // A bare 403 is usually a bad key, which a cooldown would not fix.
        assert_eq!(
            classify_status(403, "forbidden"),
            Some(ProviderError::Failed("HTTP 403".into()))
        );
    }

    #[test]
    fn success_statuses_are_not_errors() {
        assert_eq!(classify_status(200, ""), None);
        assert_eq!(classify_status(204, ""), None);
    }

    #[test]
    fn bad_key_is_reported_as_failure_not_rate_limit() {
        assert_eq!(
            classify_status(401, ""),
            Some(ProviderError::Failed("key rejected".into()))
        );
    }

    #[test]
    fn urlencoding_escapes_special_characters() {
        assert_eq!(urlencode("hava durumu"), "hava+durumu");
        assert_eq!(urlencode("a&b"), "a%26b");
        assert_eq!(urlencode("abc123-_.~"), "abc123-_.~");
    }

    #[test]
    fn urlencoding_encodes_non_ascii_as_utf8_bytes() {
        let encoded = urlencode("şğü");
        assert!(encoded.starts_with('%'));
        assert!(!encoded.contains('ş'));
    }

    #[test]
    fn highlight_markup_is_stripped_from_snippets() {
        assert_eq!(strip_tags("a <strong>b</strong> c"), "a b c");
        assert_eq!(strip_tags("plain"), "plain");
    }

    #[test]
    fn snippets_are_clipped_to_a_bound() {
        let long = "x".repeat(MAX_SNIPPET_CHARS * 2);
        assert_eq!(clip(&long).chars().count(), MAX_SNIPPET_CHARS);
    }

    #[test]
    fn dotted_paths_descend_into_nested_json() {
        let json = serde_json::json!({"data": {"items": [1, 2]}});
        assert!(dig(&json, "data.items").unwrap().is_array());
        assert!(dig(&json, "data.missing").is_none());
        assert!(dig(&json, "").is_some(), "empty path returns the root");
    }

    #[test]
    fn custom_config_requires_a_query_placeholder() {
        let mut cfg = CustomConfig {
            url: "https://example.com/search".into(),
            ..Default::default()
        };
        assert!(
            !cfg.is_usable(),
            "no placeholder means we cannot substitute"
        );

        cfg.url = "https://example.com/search?q={query}".into();
        assert!(cfg.is_usable());
    }

    #[test]
    fn field_name_fallbacks_apply_when_unset() {
        assert_eq!(non_empty("", "title"), "title");
        assert_eq!(non_empty("  ", "url"), "url");
        assert_eq!(non_empty("headline", "title"), "headline");
    }
}
