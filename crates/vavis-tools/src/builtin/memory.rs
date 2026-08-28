//! Hafıza tool'ları — kalıcı olgu saklama.
//!
//! Eski projede hafıza 5 ayrı dosyaya dağılmıştı (memory-plus, adaptive-memory,
//! short-term-memory, memory-files, knowledge) ve 12+ tool vardı. Burada
//! **3 tool**: hatırla, hatırlat (ara), unut.
//!
//! Depolama F5'te SQLite'a taşınacak; F3'te dosya tabanlı — basit ve test edilebilir.

use crate::tool::{arg_str, Domain, Param, Risk, Tool, ToolOutcome};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Fact {
    pub id: u64,
    pub text: String,
    /// Unix zaman damgası.
    pub created_at: i64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct FactStore {
    next_id: u64,
    facts: Vec<Fact>,
}

/// Hafıza deposu — dosya tabanlı, süreç içi kilitli.
pub struct Memory {
    path: PathBuf,
    cache: Mutex<FactStore>,
}

impl Memory {
    pub fn open(root: &std::path::Path) -> Self {
        let path = root.join("facts.json");
        let cache = std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Self {
            path,
            cache: Mutex::new(cache),
        }
    }

    fn persist(&self, store: &FactStore) {
        let Ok(json) = serde_json::to_string_pretty(store) else {
            return;
        };
        // Atomik yazma — yarım hafıza dosyası kalmasın.
        let tmp = self.path.with_extension("tmp");
        if std::fs::write(&tmp, json).is_ok() {
            let _ = std::fs::rename(&tmp, &self.path);
        }
    }

    pub fn remember(&self, text: &str) -> Fact {
        let mut store = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        store.next_id += 1;
        let fact = Fact {
            id: store.next_id,
            text: text.to_string(),
            created_at: chrono::Utc::now().timestamp(),
        };
        store.facts.push(fact.clone());
        self.persist(&store);
        fact
    }

    /// Basit alt-dizi araması. F5'te BM25'e yükseltilecek.
    pub fn search(&self, query: &str) -> Vec<Fact> {
        let needle = query.to_lowercase();
        let store = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        store
            .facts
            .iter()
            .filter(|f| f.text.to_lowercase().contains(&needle))
            .cloned()
            .collect()
    }

    pub fn all(&self) -> Vec<Fact> {
        let store = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        store.facts.clone()
    }

    pub fn forget(&self, id: u64) -> bool {
        let mut store = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        let before = store.facts.len();
        store.facts.retain(|f| f.id != id);
        let removed = store.facts.len() < before;
        if removed {
            self.persist(&store);
        }
        removed
    }
}

/// Ortak hafıza — tool'lar bunu paylaşır.
///
/// `OnceLock` yerine `Mutex<Option<_>>`: hafızanın yolu açılışta belli olur.
static MEMORY: Mutex<Option<std::sync::Arc<Memory>>> = Mutex::new(None);

pub fn init_memory(root: &std::path::Path) {
    let mut guard = MEMORY.lock().unwrap_or_else(|e| e.into_inner());
    *guard = Some(std::sync::Arc::new(Memory::open(root)));
}

fn memory() -> Option<std::sync::Arc<Memory>> {
    MEMORY.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

pub struct Remember;

impl Tool for Remember {
    fn name(&self) -> &'static str {
        "hatirla"
    }

    fn description(&self) -> &'static str {
        "Kullanıcı hakkında kalıcı bir bilgi kaydeder. Kullanıcı bir tercihini \
         veya kendisiyle ilgili bir bilgiyi söylediğinde kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Memory
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("bilgi", "Kaydedilecek bilgi, tam cümle")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["hatırla", "kaydet", "unutma", "not al"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(text) = arg_str(args, "bilgi") else {
            return ToolOutcome::err("bilgi parametresi gerekli");
        };
        let Some(mem) = memory() else {
            return ToolOutcome::err("hafıza hazır değil");
        };
        let fact = mem.remember(text);
        ToolOutcome::ok(format!("kaydedildi (#{}) — {}", fact.id, fact.text))
    }
}

pub struct Recall;

impl Tool for Recall {
    fn name(&self) -> &'static str {
        "hafizada_ara"
    }

    fn description(&self) -> &'static str {
        "Daha önce kaydedilmiş bilgileri arar. Kullanıcı geçmiş bir konuya \
         atıfta bulunduğunda kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Memory
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::optional("sorgu", "Aranacak kelime (boşsa hepsi listelenir)")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["hatırlıyor", "biliyor", "kaydettim", "söylemiştim"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(mem) = memory() else {
            return ToolOutcome::err("hafıza hazır değil");
        };

        let facts = match arg_str(args, "sorgu") {
            Some(q) => mem.search(q),
            None => mem.all(),
        };

        if facts.is_empty() {
            return ToolOutcome::ok("kayıtlı bilgi bulunamadı");
        }

        let list = facts
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
        "unut"
    }

    fn description(&self) -> &'static str {
        "Kaydedilmiş bir bilgiyi siler. Önce hafizada_ara ile numarasını bul."
    }

    fn domain(&self) -> Domain {
        Domain::Memory
    }

    /// Silme geri alınamaz.
    fn risk(&self) -> Risk {
        Risk::Destructive
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required("numara", "Silinecek bilginin numarası")]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["unut", "sil", "kaldır"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(id) = crate::tool::arg_num(args, "numara") else {
            return ToolOutcome::err("numara parametresi gerekli");
        };
        let Some(mem) = memory() else {
            return ToolOutcome::err("hafıza hazır değil");
        };

        if mem.forget(id as u64) {
            ToolOutcome::ok(format!("#{} silindi", id as u64))
        } else {
            ToolOutcome::err(format!("#{} bulunamadı", id as u64))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remember_assigns_incrementing_ids() {
        let tmp = tempfile::tempdir().unwrap();
        let mem = Memory::open(tmp.path());

        let a = mem.remember("kahveyi sade içerim");
        let b = mem.remember("sabahları erken kalkarım");
        assert_eq!(a.id, 1);
        assert_eq!(b.id, 2);
    }

    #[test]
    fn facts_survive_reopening() {
        let tmp = tempfile::tempdir().unwrap();
        {
            let mem = Memory::open(tmp.path());
            mem.remember("kalıcı bilgi");
        }
        let mem = Memory::open(tmp.path());
        assert_eq!(mem.all().len(), 1);
        assert_eq!(mem.all()[0].text, "kalıcı bilgi");
    }

    #[test]
    fn ids_do_not_repeat_after_reopen() {
        // next_id kaydedilmezse yeniden açılışta id çakışır.
        let tmp = tempfile::tempdir().unwrap();
        {
            Memory::open(tmp.path()).remember("bir");
        }
        let mem = Memory::open(tmp.path());
        let second = mem.remember("iki");
        assert_eq!(second.id, 2, "id sayacı korunmalı");
    }

    #[test]
    fn search_is_case_insensitive() {
        let tmp = tempfile::tempdir().unwrap();
        let mem = Memory::open(tmp.path());
        mem.remember("Kahveyi Sade içerim");

        assert_eq!(mem.search("kahve").len(), 1);
        assert_eq!(mem.search("KAHVE").len(), 1);
        assert_eq!(mem.search("çay").len(), 0);
    }

    #[test]
    fn forget_removes_only_the_named_fact() {
        let tmp = tempfile::tempdir().unwrap();
        let mem = Memory::open(tmp.path());
        let a = mem.remember("bir");
        mem.remember("iki");

        assert!(mem.forget(a.id));
        assert_eq!(mem.all().len(), 1);
        assert_eq!(mem.all()[0].text, "iki");
    }

    #[test]
    fn forget_reports_missing_id() {
        let tmp = tempfile::tempdir().unwrap();
        let mem = Memory::open(tmp.path());
        assert!(!mem.forget(999));
    }

    #[test]
    fn forget_is_destructive_remember_is_not() {
        assert_eq!(Forget.risk(), Risk::Destructive);
        assert_eq!(Remember.risk(), Risk::Safe);
        assert_eq!(Recall.risk(), Risk::Safe);
    }

    #[test]
    fn corrupt_store_starts_empty_instead_of_crashing() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("facts.json"), "bozuk json {{{").unwrap();
        let mem = Memory::open(tmp.path());
        assert!(mem.all().is_empty());
    }
}
