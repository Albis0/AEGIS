//! Hafıza tool'ları — kalıcı olgu saklama.
//!
//! Eski projede hafıza 5 ayrı dosyaya dağılmıştı (memory-plus, adaptive-memory,
//! short-term-memory, memory-files, knowledge) ve 12+ tool vardı. Burada
//! **3 tool**: hatırla, hafızada ara, unut.
//!
//! Depolama SQLite (`vavis-core::Store`), arama BM25 (`vavis-core::search`) —
//! her ikisi de tek kaynak, kopya yok.

use crate::tool::{arg_num, arg_str, Domain, Param, Risk, Tool, ToolOutcome};
use serde_json::Value;
use std::sync::{Arc, Mutex, OnceLock};
use vavis_core::{Document, SearchIndex, Store};

/// Hafızanın bağlı olduğu depo.
///
/// Tool'lar durumsuzdur (kayıt defterinde paylaşılır), bu yüzden depo
/// süreç genelinde tek bir yerde tutulur.
static STORE: OnceLock<Arc<Mutex<Store>>> = OnceLock::new();

/// Hafızayı açılışta bağlar. İkinci çağrı yok sayılır.
pub fn attach_store(store: Arc<Mutex<Store>>) {
    let _ = STORE.set(store);
}

fn with_store<T>(f: impl FnOnce(&Store) -> T) -> Option<T> {
    let store = STORE.get()?;
    let guard = store.lock().unwrap_or_else(|e| e.into_inner());
    Some(f(&guard))
}

pub struct Remember;

impl Tool for Remember {
    fn name(&self) -> &'static str {
        "remember"
    }

    fn description(&self) -> &'static str {
        "Kullanıcı hakkında kalıcı bir bilgi kaydeder. Kullanıcı bir tercihini \
         veya kendisiyle ilgili bir bilgiyi söylediğinde kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Memory
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required(
            "fact",
            "The fact to store, as a full sentence",
        )]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["hatırla", "kaydet", "unutma", "not al"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(text) = arg_str(args, "fact") else {
            return ToolOutcome::err("bilgi parametresi gerekli");
        };

        match with_store(|s| s.add_fact(text)) {
            Some(Ok(id)) => ToolOutcome::ok(format!("kaydedildi (#{id}) — {text}")),
            Some(Err(e)) => ToolOutcome::err(format!("kaydedilemedi: {e}")),
            None => ToolOutcome::err("hafıza hazır değil"),
        }
    }
}

pub struct Recall;

impl Tool for Recall {
    fn name(&self) -> &'static str {
        "search_memory"
    }

    fn description(&self) -> &'static str {
        "Daha önce kaydedilmiş bilgileri arar. Kullanıcı geçmiş bir konuya \
         atıfta bulunduğunda veya 'ne biliyorsun' diye sorduğunda kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Memory
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::optional(
            "query",
            "Word to search for (lists everything when empty)",
        )]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["hatırlıyor", "biliyor", "kaydettim", "söylemiştim"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(result) = with_store(|s| s.all_facts()) else {
            return ToolOutcome::err("hafıza hazır değil");
        };
        let facts = match result {
            Ok(f) => f,
            Err(e) => return ToolOutcome::err(format!("hafıza okunamadı: {e}")),
        };

        if facts.is_empty() {
            return ToolOutcome::ok("kayıtlı bilgi yok");
        }

        let selected = match arg_str(args, "query") {
            None => facts,
            Some(query) => {
                // BM25: alaka sırası + Türkçe ek eşleşmesi.
                let docs: Vec<Document> = facts
                    .iter()
                    .map(|f| Document {
                        id: f.id,
                        text: f.text.clone(),
                    })
                    .collect();
                let index = SearchIndex::build(docs);
                let hits = index.search(query, 10);

                if hits.is_empty() {
                    return ToolOutcome::ok(format!("'{query}' ile ilgili bilgi bulunamadı"));
                }
                // Alaka sırasını koru.
                hits.iter()
                    .filter_map(|h| facts.iter().find(|f| f.id == h.id).cloned())
                    .collect()
            }
        };

        let list = selected
            .iter()
            .take(20)
            .map(|f| format!("#{} {}", f.id, f.text))
            .collect::<Vec<_>>()
            .join("\n");
        ToolOutcome::ok(list)
    }
}

pub struct Forget;

impl Tool for Forget {
    fn name(&self) -> &'static str {
        "forget"
    }

    fn description(&self) -> &'static str {
        "Deletes a stored fact. Use search_memory first to find its number."
    }

    fn domain(&self) -> Domain {
        Domain::Memory
    }

    /// Silme geri alınamaz.
    fn risk(&self) -> Risk {
        Risk::Destructive
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("number", "Number of the fact to delete")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["unut", "sil", "kaldır"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(id) = arg_num(args, "number") else {
            return ToolOutcome::err("numara parametresi gerekli");
        };
        let id = id as i64;

        match with_store(|s| s.delete_fact(id)) {
            Some(Ok(true)) => ToolOutcome::ok(format!("#{id} silindi")),
            Some(Ok(false)) => ToolOutcome::err(format!("#{id} bulunamadı")),
            Some(Err(e)) => ToolOutcome::err(format!("silinemedi: {e}")),
            None => ToolOutcome::err("hafıza hazır değil"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Testler süreç genelindeki `STORE`'u paylaşır; her test kendi
    /// deposunu kuramaz. Bu yüzden bir kez bağlanır ve testler
    /// birbirinden bağımsız veriyle çalışır.
    fn ensure_store() {
        static INIT: std::sync::Once = std::sync::Once::new();
        INIT.call_once(|| {
            let store = Store::open_in_memory().expect("bellek içi depo");
            attach_store(Arc::new(Mutex::new(store)));
        });
    }

    fn remember(text: &str) -> ToolOutcome {
        Remember.run(&serde_json::json!({ "fact": text }))
    }

    #[test]
    fn remember_persists_and_reports_id() {
        ensure_store();
        let out = remember("test-olgusu-benzersiz-aaa");
        assert!(out.ok, "{}", out.content);
        assert!(out.content.contains('#'), "numara bildirilmeli");
    }

    #[test]
    fn remember_requires_the_parameter() {
        ensure_store();
        assert!(!Remember.run(&serde_json::json!({})).ok);
        assert!(!Remember.run(&serde_json::json!({"fact": "  "})).ok);
    }

    #[test]
    fn recall_finds_what_was_remembered() {
        ensure_store();
        remember("kırmızı-bisiklet-benzersiz-bbb kullanıyorum");

        let out = Recall.run(&serde_json::json!({"query": "bisiklet"}));
        assert!(out.ok);
        assert!(
            out.content.contains("kırmızı-bisiklet-benzersiz-bbb"),
            "içerik: {}",
            out.content
        );
    }

    #[test]
    fn recall_with_no_query_lists_everything() {
        ensure_store();
        remember("liste-testi-benzersiz-ccc");

        let out = Recall.run(&serde_json::json!({}));
        assert!(out.ok);
        assert!(out.content.contains("liste-testi-benzersiz-ccc"));
    }

    #[test]
    fn recall_reports_no_match_gracefully() {
        ensure_store();
        // En az bir olgu olsun ki "hiç kayıt yok" yoluna değil,
        // "eşleşme yok" yoluna girelim.
        remember("alakasiz-olgu-benzersiz-fff");

        let out = Recall.run(&serde_json::json!({"query": "kesinlikleyokboylebirsey"}));
        assert!(out.ok, "sonuç bulunamaması hata değil");
        assert!(
            out.content.contains("bulunamadı"),
            "içerik: {}",
            out.content
        );
    }

    #[test]
    fn forget_removes_the_fact() {
        ensure_store();
        let out = remember("silinecek-olgu-benzersiz-ddd");

        // "kaydedildi (#12) — ..." biçiminden numarayı çıkar.
        let id: i64 = out
            .content
            .split('#')
            .nth(1)
            .and_then(|s| s.split(')').next())
            .and_then(|s| s.trim().parse().ok())
            .expect("numara ayrıştırılmalı");

        let deleted = Forget.run(&serde_json::json!({"number": id.to_string()}));
        assert!(deleted.ok, "{}", deleted.content);

        let after = Recall.run(&serde_json::json!({"query": "silinecek-olgu-benzersiz-ddd"}));
        assert!(
            !after.content.contains("silinecek-olgu-benzersiz-ddd"),
            "silinen olgu hâlâ görünüyor"
        );
    }

    #[test]
    fn forget_reports_missing_id() {
        ensure_store();
        let out = Forget.run(&serde_json::json!({"number": "999999"}));
        assert!(!out.ok);
        assert!(out.content.contains("bulunamadı"));
    }

    #[test]
    fn forget_requires_a_number() {
        ensure_store();
        assert!(!Forget.run(&serde_json::json!({})).ok);
    }

    #[test]
    fn risk_levels_are_correct() {
        assert_eq!(Forget.risk(), Risk::Destructive, "silme onay istemeli");
        assert_eq!(Remember.risk(), Risk::Safe);
        assert_eq!(Recall.risk(), Risk::Safe);
    }

    #[test]
    fn turkish_suffix_search_works_end_to_end() {
        ensure_store();
        remember("kahveyi-benzersiz-eee sade içerim");

        // "kahveyi" kaydedildi, "kahveyi-benzersiz" ile aranıyor.
        let out = Recall.run(&serde_json::json!({"query": "kahveyi-benzersiz-eee"}));
        assert!(
            out.content.contains("sade içerim"),
            "Türkçe ek eşleşmesi çalışmalı: {}",
            out.content
        );
    }
}
