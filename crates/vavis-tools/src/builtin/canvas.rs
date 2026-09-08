//! Görsel üretim tool'u.
//!
//! Tek tool, bilinçli olarak. Canvas arayüzü zaten varyasyon, büyütme ve
//! parametre ayarı sunuyor; sohbete aynısının dokuz tool'luk bir kopyasını
//! koymak hem tool bütçesini yer hem de notun asıl derdini geri getirir —
//! görsel üretimi sohbet akışına sığmıyor.
//!
//! Bu yüzden tool üretiyor, kaydediyor ve **modele dosya yolunu söylüyor**.
//! Sonuç galeride duruyor; kullanıcı devamını canvas'ta getiriyor.

use crate::canvas::{self, storage};
use crate::tool::{arg_num, arg_str, Domain, Param, Risk, Tool, ToolOutcome};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use vavis_core::{NewGalleryItem, Store};

/// Where generated files go, and where they get indexed.
///
/// Tools are stateless — the registry shares one instance across threads — so
/// this lives once per process, exactly like the memory store.
struct Sink {
    store: Arc<Mutex<Store>>,
    media_dir: PathBuf,
}

static SINK: OnceLock<Sink> = OnceLock::new();

/// Connects the tool to the gallery at startup. A second call is ignored.
pub fn attach(store: Arc<Mutex<Store>>, media_dir: PathBuf) {
    let _ = SINK.set(Sink { store, media_dir });
}

pub struct Generate;

impl Tool for Generate {
    fn name(&self) -> &'static str {
        "generate_image"
    }

    fn description(&self) -> &'static str {
        "Metinden görsel üretir ve galeriye kaydeder. Kullanıcı bir şeyin \
         resmini/görselini çizmeni veya üretmeni istediğinde kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Canvas
    }

    /// Moderate, not Safe: every call spends the user's money at a paid
    /// provider. Reading a file is free; this is not.
    fn risk(&self) -> Risk {
        Risk::Moderate
    }

    fn params(&self) -> Vec<Param> {
        vec![
            Param::required(
                "description",
                "Description of the image to generate, in English",
            ),
            Param::optional("amount", "square | landscape | portrait. Default: square."),
            Param::optional("count", "How many to generate, 1-4. Default: 1."),
        ]
    }

    fn keywords(&self) -> &'static [&'static str] {
        KEYWORDS
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        // `arg_str` already rejects an empty or whitespace-only value, so a
        // missing description and a blank one land here together.
        let Some(prompt) = arg_str(args, "description").map(str::to_string) else {
            return ToolOutcome::err("aciklama gerekli");
        };

        let Some(sink) = SINK.get() else {
            return ToolOutcome::err("galeri bağlı değil");
        };

        if !canvas::is_ready(canvas::Kind::Image) {
            return ToolOutcome::err(
                "görsel üretimi için ayarlardan bir sağlayıcı anahtarı eklenmeli",
            );
        }

        let (width, height) = match arg_str(args, "amount").map(str::to_lowercase).as_deref() {
            Some("yatay" | "landscape" | "wide") => (1536, 1024),
            Some("dikey" | "portrait" | "tall") => (1024, 1536),
            _ => (1024, 1024),
        };

        let count = arg_num(args, "count").map_or(1, |n| n as u32).clamp(1, 4);

        let request = canvas::Request {
            prompt: prompt.clone(),
            width,
            height,
            count,
            ..canvas::Request::default()
        };

        let generated = match canvas::generate(request.clone()) {
            Ok(generated) => generated,
            Err(attempts) => {
                let why = attempts
                    .iter()
                    .map(|a| format!("{}: {}", a.provider, a.error))
                    .collect::<Vec<_>>()
                    .join(", ");
                return ToolOutcome::err(if why.is_empty() {
                    "hiçbir sağlayıcı bu isteği alamadı".to_string()
                } else {
                    why
                });
            }
        };

        let mut saved = Vec::new();
        for asset in &generated.assets {
            let (name, bytes) = match storage::save(&sink.media_dir, asset, canvas::Kind::Image) {
                Ok(result) => result,
                Err(e) => return ToolOutcome::err(format!("kaydedilemedi: {e}")),
            };

            let row = NewGalleryItem {
                kind: Some(vavis_core::GalleryKind::Image),
                path: name.clone(),
                prompt: prompt.clone(),
                provider: generated.provider.clone(),
                model: generated.model.clone(),
                params: format!(r#"{{"size":"{width}x{height}","count":{count}}}"#),
                seed: asset.seed,
                width: i64::from(if asset.width > 0 { asset.width } else { width }),
                height: i64::from(if asset.height > 0 {
                    asset.height
                } else {
                    height
                }),
                bytes: bytes as i64,
                parent_id: None,
            };

            let store = sink.store.lock().unwrap_or_else(|e| e.into_inner());
            if let Err(e) = store.add_gallery_item(&row) {
                tracing::warn!(%e, "üretilen dosya galeriye eklenemedi");
            }
            saved.push(sink.media_dir.join(&name).display().to_string());
        }

        // The model gets paths, not bytes: the picture belongs in the canvas
        // grid, and a base64 blob in the conversation helps nobody.
        ToolOutcome::ok(format!(
            "{} görsel üretildi ({}). Canvas sekmesinde duruyor.\n{}",
            saved.len(),
            generated.provider,
            saved.join("\n")
        ))
    }
}

/// Domain keywords, kept next to the tool that owns them.
///
/// Deliberately long: matching is substring-based, so a short word like "çiz"
/// would fire on "çizelge" and "çizgi" and drag this whole domain into
/// unrelated requests.
pub const KEYWORDS: &[&str] = &[
    "görsel",
    "gorsel",
    "resim",
    "resmi",
    "çizim",
    "cizim",
    "illüstrasyon",
    "illustrasyon",
    "image",
    "picture",
    "illustration",
    "artwork",
    "wallpaper",
    "duvar kağıdı",
    "logo",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_description_is_refused_before_anything_is_spent() {
        let out = Generate.run(&serde_json::json!({}));
        assert!(!out.ok);
        assert!(out.content.contains("description"));
    }

    #[test]
    fn a_blank_description_is_refused() {
        let out = Generate.run(&serde_json::json!({ "description": "   " }));
        assert!(!out.ok);
    }

    #[test]
    fn generating_costs_money_so_it_is_not_marked_safe() {
        // Safe would mean the permission gate never asks. Every call here
        // spends the user's credit at a paid provider.
        assert_eq!(Generate.risk(), Risk::Moderate);
    }

    #[test]
    fn keywords_are_long_enough_to_survive_substring_matching() {
        // Short keywords are how "md" once matched "durumda" and pulled nine
        // unrelated tools into ordinary requests.
        for word in KEYWORDS {
            assert!(word.chars().count() >= 4, "{word} is too short to be safe");
        }
    }

    #[test]
    fn the_schema_names_the_arguments_the_model_must_send() {
        let schema = Generate.schema();
        let text = schema.to_string();
        assert!(text.contains("description"));
        assert!(text.contains("amount"));
        assert!(text.contains("count"));
    }
}
