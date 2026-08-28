//! BM25 metin arama.
//!
//! Eski projeden taşınan algoritma (`bm25.ts`). Alt-dizi aramasından farkı:
//! **alaka sırası** verir ve nadir kelimelere ağırlık koyar.
//!
//! Örnek: "kahve" kelimesi 100 notun 2'sinde geçiyorsa çok ayırt edicidir;
//! "bir" hepsinde geçiyorsa hiç ayırt edici değildir. BM25 bunu ölçer.

use std::collections::HashMap;

/// Terim doygunluğu — bir kelimenin tekrarı belli noktadan sonra katkı vermez.
const K1: f64 = 1.5;
/// Belge uzunluğu normalizasyonu — uzun belgeler haksız avantaj kazanmasın.
const B: f64 = 0.75;

/// Aranabilir bir belge.
#[derive(Debug, Clone)]
pub struct Document {
    pub id: i64,
    pub text: String,
}

/// Arama sonucu.
#[derive(Debug, Clone, PartialEq)]
pub struct Hit {
    pub id: i64,
    pub score: f64,
}

/// Metni aranabilir kelimelere böler.
///
/// Türkçe karakterler sadeleştirilir: kullanıcı "kahve" yazıp "kahve"yi
/// bulmalı, şapkalı yazsa da bulmalı.
pub fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .chars()
        .map(|c| match c {
            'ı' | 'î' => 'i',
            'ş' => 's',
            'ğ' => 'g',
            'ü' => 'u',
            'ö' => 'o',
            'ç' => 'c',
            'â' => 'a',
            c => c,
        })
        .collect::<String>()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() > 1) // tek harfler gürültü
        .map(String::from)
        .collect()
}

/// BM25 dizini.
///
/// Küçük koleksiyonlar için tasarlandı (binlerce olgu/not). Milyonlarca belge
/// için ters dizin gerekir; buradaki kullanım o ölçekte değil.
pub struct SearchIndex {
    docs: Vec<Document>,
    /// Belge başına kelime sayıları.
    term_counts: Vec<HashMap<String, usize>>,
    /// Kaç belgede geçtiği.
    doc_freq: HashMap<String, usize>,
    avg_len: f64,
}

impl SearchIndex {
    pub fn build(docs: Vec<Document>) -> Self {
        let mut term_counts = Vec::with_capacity(docs.len());
        let mut doc_freq: HashMap<String, usize> = HashMap::new();
        let mut total_len = 0usize;

        for doc in &docs {
            let terms = tokenize(&doc.text);
            total_len += terms.len();

            let mut counts: HashMap<String, usize> = HashMap::new();
            for t in terms {
                *counts.entry(t).or_insert(0) += 1;
            }
            for term in counts.keys() {
                *doc_freq.entry(term.clone()).or_insert(0) += 1;
            }
            term_counts.push(counts);
        }

        let avg_len = if docs.is_empty() {
            0.0
        } else {
            total_len as f64 / docs.len() as f64
        };

        Self {
            docs,
            term_counts,
            doc_freq,
            avg_len,
        }
    }

    /// Sorguya en uygun belgeler, en alakalıdan aza.
    pub fn search(&self, query: &str, limit: usize) -> Vec<Hit> {
        let terms = tokenize(query);
        if terms.is_empty() || self.docs.is_empty() {
            return Vec::new();
        }

        let n = self.docs.len() as f64;
        let mut hits: Vec<Hit> = Vec::new();

        for (idx, counts) in self.term_counts.iter().enumerate() {
            let doc_len: usize = counts.values().sum();
            let mut score = 0.0;

            for term in &terms {
                // Türkçe sondan eklemeli: "kahve" sorgusu "kahveyi"yi bulmalı.
                // Tam eşleşme tam puan; önek eşleşmesi (kelime sorguyla
                // başlıyorsa) kısmi puan alır.
                let (tf, df) = match counts.get(term) {
                    Some(&tf) => (tf as f64, *self.doc_freq.get(term).unwrap_or(&0) as f64),
                    None => {
                        let mut prefix_tf = 0usize;
                        for (word, &c) in counts {
                            if word.starts_with(term.as_str()) {
                                prefix_tf += c;
                            }
                        }
                        if prefix_tf == 0 {
                            continue;
                        }
                        // Önek eşleşmesi için df'yi de önekle hesapla.
                        let df: usize = self
                            .doc_freq
                            .iter()
                            .filter(|(w, _)| w.starts_with(term.as_str()))
                            .map(|(_, &c)| c)
                            .max()
                            .unwrap_or(1);
                        // Yarım ağırlık — tam eşleşme her zaman önde olsun.
                        (prefix_tf as f64 * 0.5, df as f64)
                    }
                };

                // IDF: nadir terim = yüksek ağırlık. +1 ile negatife düşmez.
                let idf = ((n - df + 0.5) / (df + 0.5) + 1.0).ln();

                let norm = 1.0 - B + B * (doc_len as f64 / self.avg_len.max(1.0));
                score += idf * (tf * (K1 + 1.0)) / (tf + K1 * norm);
            }

            if score > 0.0 {
                hits.push(Hit {
                    id: self.docs[idx].id,
                    score,
                });
            }
        }

        // Yüksek puan önce; eşitlikte id'ye göre kararlı sırala.
        hits.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.id.cmp(&b.id))
        });
        hits.truncate(limit);
        hits
    }

    pub fn len(&self) -> usize {
        self.docs.len()
    }

    pub fn is_empty(&self) -> bool {
        self.docs.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn index() -> SearchIndex {
        SearchIndex::build(vec![
            Document {
                id: 1,
                text: "kahveyi sade içerim şekersiz olsun".into(),
            },
            Document {
                id: 2,
                text: "sabahları erken kalkarım ve koşuya çıkarım".into(),
            },
            Document {
                id: 3,
                text: "kahve makinesi mutfakta duruyor".into(),
            },
            Document {
                id: 4,
                text: "toplantı salı günü saat ondadır".into(),
            },
        ])
    }

    #[test]
    fn finds_documents_containing_the_query() {
        let hits = index().search("kahve", 10);
        let ids: Vec<i64> = hits.iter().map(|h| h.id).collect();
        assert!(ids.contains(&1) && ids.contains(&3), "gelen: {ids:?}");
        assert!(!ids.contains(&4));
    }

    #[test]
    fn results_are_ordered_by_relevance() {
        let hits = index().search("kahve makinesi mutfakta", 10);
        assert_eq!(hits[0].id, 3, "üç kelime de eşleşen belge başta olmalı");
    }

    #[test]
    fn rare_terms_outweigh_common_ones() {
        let idx = SearchIndex::build(vec![
            Document { id: 1, text: "bir bir bir nadir".into() },
            Document { id: 2, text: "bir bir bir bir bir".into() },
            Document { id: 3, text: "bir kelime burada".into() },
        ]);
        let hits = idx.search("nadir", 10);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].id, 1);
    }

    #[test]
    fn turkish_characters_are_normalised() {
        let idx = SearchIndex::build(vec![Document {
            id: 1,
            text: "ışık şığır çöp güneş".into(),
        }]);
        // Şapkasız yazım da bulmalı.
        assert!(!idx.search("isik", 5).is_empty());
        assert!(!idx.search("gunes", 5).is_empty());
        assert!(!idx.search("cop", 5).is_empty());
    }

    #[test]
    fn search_is_case_insensitive() {
        let idx = index();
        assert_eq!(idx.search("KAHVE", 10).len(), idx.search("kahve", 10).len());
    }

    #[test]
    fn empty_query_returns_nothing() {
        assert!(index().search("", 10).is_empty());
        assert!(index().search("   ", 10).is_empty());
    }

    #[test]
    fn unmatched_query_returns_nothing() {
        assert!(index().search("uzayagemisi", 10).is_empty());
    }

    #[test]
    fn empty_index_is_safe() {
        let idx = SearchIndex::build(Vec::new());
        assert!(idx.is_empty());
        assert!(idx.search("herhangi", 10).is_empty());
    }

    #[test]
    fn limit_is_respected() {
        let docs: Vec<Document> = (1..=20)
            .map(|i| Document {
                id: i,
                text: "ortak kelime burada".into(),
            })
            .collect();
        let idx = SearchIndex::build(docs);
        assert_eq!(idx.search("ortak", 5).len(), 5);
    }

    #[test]
    fn single_letter_tokens_are_dropped() {
        // "a", "b" gibi tek harfler gürültüdür.
        assert!(tokenize("a b ce de").contains(&"ce".to_string()));
        assert!(!tokenize("a b ce de").contains(&"a".to_string()));
    }

    #[test]
    fn ordering_is_stable_for_equal_scores() {
        let docs: Vec<Document> = (1..=5)
            .map(|i| Document {
                id: i,
                text: "aynı metin burada".into(),
            })
            .collect();
        let idx = SearchIndex::build(docs);
        let first = idx.search("aynı", 10);
        let second = idx.search("aynı", 10);
        assert_eq!(first, second, "aynı sorgu aynı sırayı vermeli");
    }
}

#[cfg(test)]
mod turkish_suffix_tests {
    use super::*;

    /// **Regresyon testi.** Türkçe sondan eklemeli bir dil: "kahve" araması
    /// "kahveyi", "kahvede", "kahvem" hepsini bulmalı. Tam kelime eşleşmesi
    /// tek başına hafızayı kullanılamaz hâle getirirdi.
    #[test]
    fn query_matches_suffixed_forms() {
        let idx = SearchIndex::build(vec![
            Document { id: 1, text: "kahveyi sade içerim".into() },
            Document { id: 2, text: "kahvede buluşalım".into() },
            Document { id: 3, text: "kitap okumayı severim".into() },
        ]);

        let ids: Vec<i64> = idx.search("kahve", 10).iter().map(|h| h.id).collect();
        assert!(ids.contains(&1), "'kahveyi' bulunmalı");
        assert!(ids.contains(&2), "'kahvede' bulunmalı");
        assert!(!ids.contains(&3), "alakasız belge gelmemeli");
    }

    #[test]
    fn exact_match_outranks_prefix_match() {
        let idx = SearchIndex::build(vec![
            Document { id: 1, text: "kahveyi severim".into() },
            Document { id: 2, text: "kahve severim".into() },
        ]);
        let hits = idx.search("kahve", 10);
        assert_eq!(hits[0].id, 2, "tam eşleşme önde olmalı");
    }

    #[test]
    fn prefix_matching_does_not_create_false_positives() {
        // "kap" araması "kapı"yı bulur (meşru) ama "kitap"ı bulmamalı —
        // önek eşleşmesi, içerme değil.
        let idx = SearchIndex::build(vec![
            Document { id: 1, text: "kapı açık kaldı".into() },
            Document { id: 2, text: "kitap masada duruyor".into() },
        ]);
        let ids: Vec<i64> = idx.search("kap", 10).iter().map(|h| h.id).collect();
        assert!(ids.contains(&1));
        assert!(!ids.contains(&2), "'kitap' önek eşleşmesi olmamalı");
    }
}
