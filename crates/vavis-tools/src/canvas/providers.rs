//! Concrete generation backends.
//!
//! Each provider translates one upstream API into [`Asset`]s. Response parsing
//! is split into free functions so it can be tested against recorded payloads
//! without a network or a key — the part most likely to break when a provider
//! changes its shape is the part that is covered.

use super::{Asset, GenError, Kind, Provider, Request};
use crate::builtin::vision::{base64_decode, base64_encode};
use serde_json::{json, Value};
use std::time::Duration;

/// Upper bound on one call.
///
/// Far longer than a web search: a video model can legitimately think for
/// minutes, and cutting it off at twelve seconds would make video generation
/// impossible rather than slow.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);

/// Refuses to hold an absurd file in memory. A minute of video is tens of
/// megabytes; anything past this is a provider misbehaving.
const MAX_ASSET_BYTES: usize = 256 * 1024 * 1024;

/// A blocking HTTP request returning the raw body.
///
/// Bytes rather than text, because most of these responses are images.
fn request(
    method: reqwest::Method,
    url: &str,
    headers: &[(&str, String)],
    body: Option<Value>,
) -> Result<(u16, Vec<u8>), GenError> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| GenError::Failed(e.to_string()))?;

    runtime.block_on(async {
        let client = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .user_agent("Vavis/0.3")
            .build()
            .map_err(|e| GenError::Failed(e.to_string()))?;

        let mut req = client.request(method, url);
        for (name, value) in headers {
            req = req.header(*name, value);
        }
        if let Some(json) = body {
            req = req.json(&json);
        }

        let resp = req.send().await.map_err(|e| {
            if e.is_timeout() {
                GenError::Failed("timed out".into())
            } else if e.is_connect() {
                GenError::Failed("could not connect".into())
            } else {
                GenError::Failed(e.to_string())
            }
        })?;

        let status = resp.status().as_u16();
        let bytes = resp
            .bytes()
            .await
            .map_err(|e| GenError::Failed(e.to_string()))?;

        if bytes.len() > MAX_ASSET_BYTES {
            return Err(GenError::Failed("response too large".into()));
        }
        Ok((status, bytes.to_vec()))
    })
}

/// Downloads a result the provider only gave us a link to.
///
/// Provider links expire — Replicate's within the hour — so the bytes are
/// fetched now rather than stored as a URL that breaks tomorrow.
fn fetch(url: &str) -> Result<Vec<u8>, GenError> {
    let (status, bytes) = request(reqwest::Method::GET, url, &[], None)?;
    if !(200..300).contains(&status) {
        return Err(GenError::Failed(format!("download failed: HTTP {status}")));
    }
    Ok(bytes)
}

/// Maps an HTTP status onto the chain's failure vocabulary.
///
/// The interesting case is 400: for image services that is almost always a
/// content refusal, and failing over to the next provider would just get the
/// same refusal after spending more of the user's money.
fn classify(status: u16, body: &str) -> Option<GenError> {
    let lower = body.to_lowercase();
    let looks_like_refusal = lower.contains("safety")
        || lower.contains("content_policy")
        || lower.contains("content policy")
        || lower.contains("moderation")
        || lower.contains("nsfw")
        || lower.contains("flagged");

    match status {
        200..=299 => None,
        400 | 422 if looks_like_refusal => Some(GenError::Refused(short_error(body))),
        401 | 403 if !looks_like_refusal => Some(GenError::Failed("key rejected".into())),
        402 | 429 => Some(GenError::RateLimited),
        _ if looks_like_refusal => Some(GenError::Refused(short_error(body))),
        _ => Some(GenError::Failed(format!(
            "HTTP {status}: {}",
            short_error(body)
        ))),
    }
}

/// Pulls a readable message out of an error body.
///
/// Providers bury it at different depths; a wall of raw JSON in the interface
/// helps nobody.
fn short_error(body: &str) -> String {
    let text = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| {
            for path in [
                "/error/message",
                "/error",
                "/message",
                "/detail",
                "/errors/0",
            ] {
                if let Some(found) = v.pointer(path).map(|x| match x {
                    Value::String(s) => s.clone(),
                    other => other.to_string(),
                }) {
                    return Some(found);
                }
            }
            None
        })
        .unwrap_or_else(|| body.to_string());

    let trimmed = text.trim();
    if trimmed.chars().count() > 200 {
        format!("{}…", trimmed.chars().take(200).collect::<String>())
    } else {
        trimmed.to_string()
    }
}

/// A user-defined, OpenAI-compatible image endpoint.
///
/// One shape rather than a bespoke request builder: an OpenAI-compatible
/// `/images/generations` route is what self-hosted stacks and aggregators all
/// expose, so this covers them without asking the user to describe a request
/// body in settings.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CustomConfig {
    /// Full endpoint address, e.g. `http://localhost:8080/v1/images/generations`.
    pub url: String,
    /// Authentication header, e.g. `Authorization`.
    pub header_name: String,
    /// Header value; a `{key}` placeholder is filled from the key store.
    pub header_value: String,
    pub model: String,
}

// ── OpenAI ──────────────────────────────────────────────────────────────

pub struct OpenAi {
    pub key: String,
}

impl Provider for OpenAi {
    fn id(&self) -> &'static str {
        "openai"
    }

    fn available(&self) -> bool {
        !self.key.trim().is_empty()
    }

    fn supports(&self, kind: Kind) -> bool {
        kind == Kind::Image
    }

    fn generate(&self, req: &Request) -> Result<Vec<Asset>, GenError> {
        if req.upscale {
            // No upscale route here. Saying so lets the chain reach one that
            // has it, instead of returning a different picture.
            return Err(GenError::Unsupported);
        }

        let model = if req.model.is_empty() {
            "gpt-image-1"
        } else {
            req.model.as_str()
        };

        let mut body = json!({
            "model": model,
            "prompt": req.prompt,
            "n": req.count.clamp(1, 10),
            "size": openai_size(req.width, req.height),
        });

        // gpt-image-1 always returns base64 and rejects the parameter
        // outright; the dall-e models need it or they return links only.
        if model != "gpt-image-1" {
            body["response_format"] = json!("b64_json");
        }

        let (status, bytes) = request(
            reqwest::Method::POST,
            "https://api.openai.com/v1/images/generations",
            &[("Authorization", format!("Bearer {}", self.key))],
            Some(body),
        )?;

        let text = String::from_utf8_lossy(&bytes);
        if let Some(err) = classify(status, &text) {
            return Err(err);
        }
        parse_openai(&text)
    }
}

/// Snaps a size onto what OpenAI accepts.
///
/// The API takes a fixed set of strings, not arbitrary pixels, and rejects
/// anything else — so a request for 1000x1400 has to become the nearest
/// portrait rather than an error.
fn openai_size(width: u32, height: u32) -> &'static str {
    if width == 0 || height == 0 {
        return "1024x1024";
    }
    let ratio = f64::from(width) / f64::from(height);
    if ratio > 1.2 {
        "1536x1024"
    } else if ratio < 0.83 {
        "1024x1536"
    } else {
        "1024x1024"
    }
}

/// Parses `{"data":[{"b64_json":…}]}`, or the link form for the dall-e models.
fn parse_openai(text: &str) -> Result<Vec<Asset>, GenError> {
    let value: Value =
        serde_json::from_str(text).map_err(|e| GenError::Failed(format!("bad JSON: {e}")))?;

    let items = value
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| GenError::Failed("no data in response".into()))?;

    let mut assets = Vec::new();
    for item in items {
        if let Some(b64) = item.get("b64_json").and_then(Value::as_str) {
            let bytes = base64_decode(b64).ok_or_else(|| GenError::Failed("bad base64".into()))?;
            assets.push(Asset::from_bytes(bytes, "png", None));
        } else if let Some(url) = item.get("url").and_then(Value::as_str) {
            assets.push(Asset::from_bytes(fetch(url)?, "png", None));
        }
    }

    if assets.is_empty() {
        return Err(GenError::Failed("no images in response".into()));
    }
    Ok(assets)
}

// ── Stability ───────────────────────────────────────────────────────────

pub struct Stability {
    pub key: String,
}

impl Provider for Stability {
    fn id(&self) -> &'static str {
        "stability"
    }

    fn available(&self) -> bool {
        !self.key.trim().is_empty()
    }

    fn supports(&self, kind: Kind) -> bool {
        kind == Kind::Image
    }

    fn generate(&self, req: &Request) -> Result<Vec<Asset>, GenError> {
        // Stability takes multipart, not JSON, and it wants the ratio rather
        // than a pixel size.
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|e| GenError::Failed(e.to_string()))?;

        let upscaling = req.upscale;
        if upscaling && req.init.is_none() {
            return Err(GenError::Failed("nothing to enlarge".into()));
        }

        let endpoint = if upscaling {
            // A real endpoint, not a redraw: the same picture comes back at
            // four times the size.
            "https://api.stability.ai/v2beta/stable-image/upscale/fast".to_string()
        } else if req.model.is_empty() {
            "https://api.stability.ai/v2beta/stable-image/generate/core".to_string()
        } else {
            format!(
                "https://api.stability.ai/v2beta/stable-image/generate/{}",
                req.model
            )
        };

        let key = self.key.clone();
        let prompt = req.prompt.clone();
        let negative = req.negative.clone();
        let ratio = req.aspect_ratio().to_string();
        let seed = req.seed;
        let init = req.init.clone();

        let (status, bytes) = runtime.block_on(async move {
            let client = reqwest::Client::builder()
                .timeout(REQUEST_TIMEOUT)
                .build()
                .map_err(|e| GenError::Failed(e.to_string()))?;

            let mut form = reqwest::multipart::Form::new().text("output_format", "png");

            if upscaling {
                let part = reqwest::multipart::Part::bytes(init.unwrap_or_default())
                    .file_name("source.png")
                    .mime_str("image/png")
                    .map_err(|e| GenError::Failed(e.to_string()))?;
                form = form.part("image", part);
            } else {
                form = form.text("prompt", prompt).text("aspect_ratio", ratio);
                if !negative.is_empty() {
                    form = form.text("negative_prompt", negative);
                }
                if let Some(seed) = seed {
                    form = form.text("seed", seed.to_string());
                }
            }

            let resp = client
                .post(&endpoint)
                .header("Authorization", format!("Bearer {key}"))
                // JSON rather than raw bytes: the seed comes back with it, and
                // without the seed the result cannot be reproduced.
                .header("Accept", "application/json")
                .multipart(form)
                .send()
                .await
                .map_err(|e| GenError::Failed(e.to_string()))?;

            let status = resp.status().as_u16();
            let bytes = resp
                .bytes()
                .await
                .map_err(|e| GenError::Failed(e.to_string()))?;
            Ok::<_, GenError>((status, bytes.to_vec()))
        })?;

        let text = String::from_utf8_lossy(&bytes);
        if let Some(err) = classify(status, &text) {
            return Err(err);
        }
        parse_stability(&text)
    }
}

/// Parses `{"image": "<base64>", "seed": 123, "finish_reason": "SUCCESS"}`.
fn parse_stability(text: &str) -> Result<Vec<Asset>, GenError> {
    let value: Value =
        serde_json::from_str(text).map_err(|e| GenError::Failed(format!("bad JSON: {e}")))?;

    // A filtered result comes back as HTTP 200 with an image of noise; without
    // this check the gallery fills with grey squares.
    if value
        .get("finish_reason")
        .and_then(Value::as_str)
        .is_some_and(|r| r == "CONTENT_FILTERED")
    {
        return Err(GenError::Refused("filtered by the provider".into()));
    }

    let b64 = value
        .get("image")
        .and_then(Value::as_str)
        .ok_or_else(|| GenError::Failed("no image in response".into()))?;
    let bytes = base64_decode(b64).ok_or_else(|| GenError::Failed("bad base64".into()))?;
    let seed = value.get("seed").and_then(Value::as_i64);

    Ok(vec![Asset::from_bytes(bytes, "png", seed)])
}

// ── Replicate ───────────────────────────────────────────────────────────

pub struct Replicate {
    pub key: String,
}

impl Provider for Replicate {
    fn id(&self) -> &'static str {
        "replicate"
    }

    fn available(&self) -> bool {
        !self.key.trim().is_empty()
    }

    /// The only provider here that does both — which is why the default video
    /// order starts with it.
    fn supports(&self, _kind: Kind) -> bool {
        true
    }

    fn generate(&self, req: &Request) -> Result<Vec<Asset>, GenError> {
        if req.upscale && req.init.is_none() {
            return Err(GenError::Failed("nothing to enlarge".into()));
        }

        let model = if !req.model.is_empty() && !req.upscale {
            req.model.clone()
        } else if req.upscale {
            "nightmareai/real-esrgan".to_string()
        } else if req.kind == Kind::Video {
            "wan-video/wan-2.5-t2v-fast".to_string()
        } else {
            "black-forest-labs/flux-schnell".to_string()
        };

        let mut input = json!({ "prompt": req.prompt });
        if req.upscale {
            input = json!({
                "image": data_uri(req.init.as_deref().unwrap_or_default()),
                "scale": 4,
            });
        } else if req.kind == Kind::Video {
            input["duration"] = json!(req.duration_secs.clamp(1, 60));
            input["aspect_ratio"] = json!(req.aspect_ratio());
            if let Some(init) = &req.init {
                // A first frame goes as a data URI: Replicate has no upload
                // step, and a local path means nothing on their side.
                input["image"] = json!(data_uri(init));
            }
        } else {
            input["aspect_ratio"] = json!(req.aspect_ratio());
            input["num_outputs"] = json!(req.count.clamp(1, 4));
            if let Some(seed) = req.seed {
                input["seed"] = json!(seed);
            }
            if !req.negative.is_empty() {
                input["negative_prompt"] = json!(req.negative);
            }
            if let Some(init) = &req.init {
                input["image"] = json!(data_uri(init));
                input["prompt_strength"] = json!(req.strength.clamp(0.0, 1.0));
            }
        }

        let (status, bytes) = request(
            reqwest::Method::POST,
            &format!("https://api.replicate.com/v1/models/{model}/predictions"),
            &[
                ("Authorization", format!("Bearer {}", self.key)),
                // Ask Replicate to hold the connection open until the
                // prediction finishes, so there is no poll loop here.
                ("Prefer", "wait".to_string()),
            ],
            Some(json!({ "input": input })),
        )?;

        let text = String::from_utf8_lossy(&bytes);
        if let Some(err) = classify(status, &text) {
            return Err(err);
        }

        let fallback = if req.kind == Kind::Video {
            "mp4"
        } else {
            "png"
        };
        let (urls, seed) = parse_replicate(&text)?;

        let mut assets = Vec::new();
        for url in urls {
            assets.push(Asset::from_bytes(fetch(&url)?, fallback, seed));
        }
        Ok(assets)
    }
}

/// Pulls output links and the seed out of a finished prediction.
///
/// `output` is a string for one result and an array for several, and a
/// prediction can come back still running if `Prefer: wait` timed out.
fn parse_replicate(text: &str) -> Result<(Vec<String>, Option<i64>), GenError> {
    let value: Value =
        serde_json::from_str(text).map_err(|e| GenError::Failed(format!("bad JSON: {e}")))?;

    match value.get("status").and_then(Value::as_str) {
        Some("failed" | "canceled") => {
            let why = value
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("prediction failed");
            let lower = why.to_lowercase();
            return Err(if lower.contains("nsfw") || lower.contains("flagged") {
                GenError::Refused(why.to_string())
            } else {
                GenError::Failed(why.to_string())
            });
        }
        Some("starting" | "processing") => {
            return Err(GenError::Failed("still running after the wait".into()))
        }
        _ => {}
    }

    let urls = match value.get("output") {
        Some(Value::String(url)) => vec![url.clone()],
        Some(Value::Array(list)) => list
            .iter()
            .filter_map(|v| v.as_str().map(str::to_string))
            .collect(),
        // Some models wrap it, e.g. `{"output": {"video": "https://…"}}`.
        Some(Value::Object(map)) => map
            .values()
            .filter_map(|v| v.as_str())
            .filter(|s| s.starts_with("http"))
            .map(str::to_string)
            .collect(),
        _ => Vec::new(),
    };

    if urls.is_empty() {
        return Err(GenError::Failed("no output in prediction".into()));
    }

    let seed = value
        .pointer("/input/seed")
        .and_then(Value::as_i64)
        .or_else(|| value.pointer("/metrics/seed").and_then(Value::as_i64));

    Ok((urls, seed))
}

fn data_uri(bytes: &[u8]) -> String {
    let mime = match super::sniff_format(bytes) {
        Some("jpg") => "image/jpeg",
        Some("webp") => "image/webp",
        _ => "image/png",
    };
    format!("data:{mime};base64,{}", base64_encode(bytes))
}

// ── Custom ──────────────────────────────────────────────────────────────

pub struct Custom {
    pub config: CustomConfig,
    pub key: String,
}

impl Provider for Custom {
    fn id(&self) -> &'static str {
        "custom"
    }

    fn available(&self) -> bool {
        !self.config.url.trim().is_empty()
    }

    /// Images only. An OpenAI-compatible endpoint has no video route, and
    /// pretending otherwise would just produce confusing failures.
    fn supports(&self, kind: Kind) -> bool {
        kind == Kind::Image
    }

    fn generate(&self, req: &Request) -> Result<Vec<Asset>, GenError> {
        if req.upscale {
            return Err(GenError::Unsupported);
        }

        let model = if !req.model.is_empty() {
            req.model.clone()
        } else {
            self.config.model.clone()
        };

        let mut body = json!({
            "prompt": req.prompt,
            "n": req.count.clamp(1, 10),
            "size": req.size_label(),
            "response_format": "b64_json",
        });
        if !model.is_empty() {
            body["model"] = json!(model);
        }

        let mut headers = Vec::new();
        if !self.config.header_name.is_empty() {
            headers.push((
                self.config.header_name.as_str(),
                self.config.header_value.replace("{key}", &self.key),
            ));
        }

        let (status, bytes) = request(
            reqwest::Method::POST,
            &self.config.url,
            &headers,
            Some(body),
        )?;

        let text = String::from_utf8_lossy(&bytes);
        if let Some(err) = classify(status, &text) {
            return Err(err);
        }
        parse_openai(&text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tiny_png() -> Vec<u8> {
        let mut png = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        png.extend_from_slice(&[0, 0, 0, 13]);
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&32u32.to_be_bytes());
        png.extend_from_slice(&64u32.to_be_bytes());
        png
    }

    #[test]
    fn openai_base64_results_are_decoded() {
        let body = json!({ "data": [{ "b64_json": base64_encode(&tiny_png()) }] });
        let assets = parse_openai(&body.to_string()).unwrap();

        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].ext, "png");
        assert_eq!((assets[0].width, assets[0].height), (32, 64));
    }

    #[test]
    fn openai_reports_an_empty_data_array() {
        let assets = parse_openai(&json!({ "data": [] }).to_string());
        assert!(matches!(assets, Err(GenError::Failed(_))));
    }

    #[test]
    fn openai_sizes_snap_to_what_the_api_accepts() {
        assert_eq!(openai_size(1024, 1024), "1024x1024");
        assert_eq!(openai_size(1920, 1080), "1536x1024");
        assert_eq!(openai_size(1080, 1920), "1024x1536");
        // Not one of the three, and close enough to square to stay square.
        assert_eq!(openai_size(1000, 1000), "1024x1024");
        assert_eq!(openai_size(0, 0), "1024x1024");
    }

    #[test]
    fn stability_keeps_the_seed_it_actually_used() {
        let body = json!({
            "image": base64_encode(&tiny_png()),
            "seed": 123_456,
            "finish_reason": "SUCCESS",
        });
        let assets = parse_stability(&body.to_string()).unwrap();

        // Without this the result cannot be reproduced, which is the whole
        // point of storing parameters.
        assert_eq!(assets[0].seed, Some(123_456));
    }

    #[test]
    fn stability_filtered_results_are_a_refusal_not_an_image() {
        let body = json!({
            "image": base64_encode(&tiny_png()),
            "seed": 1,
            "finish_reason": "CONTENT_FILTERED",
        });
        // HTTP 200 with a grey square is still a refusal; saving it would fill
        // the gallery with noise.
        assert!(matches!(
            parse_stability(&body.to_string()),
            Err(GenError::Refused(_))
        ));
    }

    #[test]
    fn replicate_output_is_read_in_all_three_shapes() {
        let one = json!({ "status": "succeeded", "output": "https://x/a.png" });
        assert_eq!(parse_replicate(&one.to_string()).unwrap().0.len(), 1);

        let many =
            json!({ "status": "succeeded", "output": ["https://x/a.png", "https://x/b.png"] });
        assert_eq!(parse_replicate(&many.to_string()).unwrap().0.len(), 2);

        let wrapped = json!({ "status": "succeeded", "output": { "video": "https://x/a.mp4" } });
        assert_eq!(
            parse_replicate(&wrapped.to_string()).unwrap().0,
            vec!["https://x/a.mp4"]
        );
    }

    #[test]
    fn replicate_echoes_back_the_seed_it_chose() {
        let body = json!({
            "status": "succeeded",
            "input": { "prompt": "a cat", "seed": 99 },
            "output": ["https://x/a.png"],
        });
        assert_eq!(parse_replicate(&body.to_string()).unwrap().1, Some(99));
    }

    #[test]
    fn replicate_still_running_is_a_failure_not_an_empty_result() {
        // `Prefer: wait` has a ceiling; past it the prediction is unfinished
        // rather than empty, and reporting "returned nothing" would be a lie.
        let body = json!({ "status": "processing", "output": null });
        assert!(matches!(
            parse_replicate(&body.to_string()),
            Err(GenError::Failed(_))
        ));
    }

    #[test]
    fn replicate_nsfw_failures_are_refusals() {
        let body = json!({ "status": "failed", "error": "NSFW content detected" });
        assert!(matches!(
            parse_replicate(&body.to_string()),
            Err(GenError::Refused(_))
        ));
    }

    #[test]
    fn a_content_refusal_does_not_look_like_a_rate_limit() {
        let body = r#"{"error":{"message":"Your request was rejected by our safety system"}}"#;
        assert!(matches!(classify(400, body), Some(GenError::Refused(_))));
    }

    #[test]
    fn quota_and_rate_limits_are_the_same_thing_to_the_chain() {
        assert_eq!(classify(429, "{}"), Some(GenError::RateLimited));
        assert_eq!(classify(402, "{}"), Some(GenError::RateLimited));
    }

    #[test]
    fn a_bad_key_is_reported_as_a_bad_key() {
        assert_eq!(
            classify(401, r#"{"error":"invalid api key"}"#),
            Some(GenError::Failed("key rejected".into()))
        );
    }

    #[test]
    fn success_is_not_an_error() {
        assert_eq!(classify(200, "{}"), None);
    }

    #[test]
    fn error_messages_are_dug_out_of_the_json() {
        assert_eq!(
            short_error(r#"{"error":{"message":"prompt too long"}}"#),
            "prompt too long"
        );
        assert_eq!(short_error(r#"{"detail":"nope"}"#), "nope");
        // Not JSON at all — an HTML error page, say.
        assert_eq!(short_error("bad gateway"), "bad gateway");
    }

    #[test]
    fn error_messages_are_trimmed_so_they_fit_the_interface() {
        let long = "x".repeat(500);
        assert!(short_error(&long).chars().count() <= 201);
    }

    #[test]
    fn a_first_frame_goes_as_a_data_uri_with_the_right_mime() {
        let uri = data_uri(&tiny_png());
        assert!(uri.starts_with("data:image/png;base64,"));

        let jpg = vec![0xFF, 0xD8, 0xFF, 0xE0];
        assert!(data_uri(&jpg).starts_with("data:image/jpeg;base64,"));
    }

    #[test]
    fn a_custom_endpoint_is_unavailable_until_a_url_is_set() {
        let empty = Custom {
            config: CustomConfig::default(),
            key: "k".into(),
        };
        assert!(!empty.available());

        let configured = Custom {
            config: CustomConfig {
                url: "http://localhost:8080/v1/images/generations".into(),
                ..CustomConfig::default()
            },
            key: String::new(),
        };
        // A local endpoint needs no key, so a URL alone is enough.
        assert!(configured.available());
    }

    #[test]
    fn providers_declare_what_they_can_do() {
        let openai = OpenAi { key: "k".into() };
        assert!(openai.supports(Kind::Image));
        assert!(!openai.supports(Kind::Video));

        let replicate = Replicate { key: "k".into() };
        assert!(replicate.supports(Kind::Video));
    }

    #[test]
    fn providers_without_an_upscale_endpoint_say_so() {
        let request = Request {
            upscale: true,
            init: Some(tiny_png()),
            ..Request::default()
        };

        // Not a failure to report — a signal to the chain that someone else
        // should take this. Redrawing at a larger size would hand the user a
        // different picture under a button that promised the same one.
        assert_eq!(
            OpenAi { key: "k".into() }.generate(&request),
            Err(GenError::Unsupported)
        );
        assert_eq!(
            Custom {
                config: CustomConfig {
                    url: "http://localhost/v1/images/generations".into(),
                    ..CustomConfig::default()
                },
                key: String::new(),
            }
            .generate(&request),
            Err(GenError::Unsupported)
        );
    }

    #[test]
    fn enlarging_nothing_fails_before_any_request_goes_out() {
        let request = Request {
            upscale: true,
            init: None,
            ..Request::default()
        };
        // No network call is made: both return before building a request.
        assert!(matches!(
            Stability { key: "k".into() }.generate(&request),
            Err(GenError::Failed(_))
        ));
        assert!(matches!(
            Replicate { key: "k".into() }.generate(&request),
            Err(GenError::Failed(_))
        ));
    }

    #[test]
    fn a_blank_key_is_not_a_key() {
        assert!(!OpenAi { key: "   ".into() }.available());
        assert!(OpenAi { key: "sk-x".into() }.available());
    }
}
