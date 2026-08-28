//! Tool seçimi — projenin en kritik kararı.
//!
//! # Neden bu dosya var
//!
//! Eski projede 353 tool tanımlıydı ve modele her istekte **64 tanesi**
//! gönderiliyordu. Hiçbir LLM 64 seçenek arasından güvenilir seçim yapamaz;
//! kullanıcının "tool'lar aşırı gidiyor" şikayetinin sebebi buydu.
//!
//! Seçim mantığı da yamalar zinciriydi: kelime kökü eşleştirme → STICKY ESCAPE
//! → STICKY CONTEXT → BM25 kurtarma → CHATTER listesi → priorityCore →
//! `slice(0, 64)`. Her yama bir öncekinin açtığı deliği kapatıyordu.
//!
//! # Buradaki kural
//!
//! **Modele asla `MAX_TOOLS`'tan fazla tool gönderilmez.**
//!
//! İki kademe:
//!   1. Mesajdan **alan** seçilir (dosya mı, sistem mi, web mi…).
//!   2. Sadece o alanın + çekirdeğin tool'ları sunulur.
//!
//! Alan bulunamazsa hiç tool gönderilmez (sohbet mesajı) — bu bilinçli:
//! "merhaba" için tool listesi göndermek modeli boş yere kışkırtıyor.

use crate::tool::{Domain, Registry};

use serde_json::Value;

/// Modele gönderilecek en fazla tool sayısı. **Bu sayı büyütülmemeli.**
pub const MAX_TOOLS: usize = 12;

/// Bir alanın eşleştiği anahtar kelimeler (Türkçe + İngilizce).
///
/// Kök eşleştirme yerine **tam kelime içerme** kullanılıyor: Türkçe sondan
/// eklemeli olduğu için "dosyayı", "dosyada", "dosyalar" hepsi "dosya" içerir.
struct DomainKeywords {
    domain: Domain,
    words: &'static [&'static str],
}

/// Tek başına bir alan tetiklemeye yetmeyen genel fiiller.
///
/// **Neden gerekli:** "bana bir şiir yaz" cümlesindeki "yaz", dosya yazma
/// isteği değil. Eski projede tam olarak bu tür yanlış eşleşmeler modele
/// alakasız tool'lar sunuyordu — kullanıcının "tool'lar aşırı gidiyor"
/// şikayetinin bir kaynağı buydu.
///
/// Bu kelimeler ancak **alana özgü bir kelimeyle birlikte** sayılır:
/// "dosya yaz" → Files ✓ · "şiir yaz" → eşleşme yok ✓
const WEAK_VERBS: &[&str] = &[
    "yaz", "oku", "kaydet", "sil", "listele", "ara", "bul", "ac", "kapat", "goster", "write",
    "read", "save", "delete", "list", "search", "find", "open", "close", "show",
];

const DOMAIN_KEYWORDS: &[DomainKeywords] = &[
    DomainKeywords {
        domain: Domain::Files,
        words: &[
            "dosya",
            "klasör",
            "klasor",
            "dizin",
            "oku",
            "yaz",
            "kaydet",
            "sil",
            "listele",
            "file",
            "folder",
            "directory",
            "read",
            "write",
            "save",
            "delete",
            "list",
            "path",
            "yol",
            "belge",
            "txt",
            "içerik",
            "icerik",
        ],
    },
    // OKUMA — durum sorgulama.
    DomainKeywords {
        domain: Domain::System,
        words: &[
            "cpu",
            "ram",
            "bellek",
            "memory",
            "disk",
            "pil",
            "batarya",
            "battery",
            "sistem",
            "system",
            "işlem",
            "islem",
            "süreç",
            "surec",
            "process",
            "performans",
            "durum",
            "telemetri",
            "sarj",
            "şarj",
            "prize",
            "pencere",
            "window",
            "calisan",
            "çalışan",
            "calisiyor",
            "çalışıyor",
            "acik",
            "açık",
            "kullanan",
            "yiyen",
            "tuketiyor",
            "tüketiyor",
        ],
    },
    // DEĞİŞTİRME — ayar yapma, uygulama, komut, pano.
    //
    // Okumadan ayrı: tek alanda 11 tool birikince çekirdek tool'lar
    // sınırın dışına itiliyordu (eval %95'e düşmüştü).
    DomainKeywords {
        domain: Domain::Control,
        words: &[
            "ses",
            "sesi",
            "volume",
            "sessiz",
            "kis",
            "kıs",
            "parlak",
            "brightness",
            "karart",
            "aydinlat",
            "aydınlat",
            "isik",
            "ışık",
            "uygulama",
            "program",
            "başlat",
            "baslat",
            "kapat",
            "sonlandir",
            "sonlandır",
            "komut",
            "command",
            "powershell",
            "script",
            "pano",
            "clipboard",
            "kopyala",
            "yapistir",
            "yapıştır",
            "notepad",
            "chrome",
            "spotify",
            "explorer",
        ],
    },
    DomainKeywords {
        domain: Domain::Vision,
        words: &[
            // "bak" ve "gör" bilinçli olarak YOK: "şunu oku bakalım" cümlesi
            // ekran görüntüsü isteği değil. Ekrana özgü kelimeler gerekli.
            "ekran",
            "goruntu",
            "görüntü",
            "screenshot",
            "gorunuyor",
            "görünüyor",
            "ekranda",
            "ekranima",
            "ekranıma",
        ],
    },
    DomainKeywords {
        domain: Domain::Web,
        words: &[
            "web",
            "internet",
            "ara",
            "arama",
            "search",
            "google",
            "site",
            "sayfa",
            "page",
            "url",
            "link",
            "haber",
            "news",
            "hava",
            "weather",
            "fiyat",
            "price",
            "güncel",
            "guncel",
            "bul",
            "araştır",
            "arastir",
            "indir",
            "download",
        ],
    },
    DomainKeywords {
        domain: Domain::Media,
        words: &[
            "muzik", "müzik", "sarki", "şarkı", "parca", "parça", "spotify", "cal", "çal", "oynat",
            "duraklat", "sonraki", "onceki", "önceki", "medya", "video", "youtube", "vlc", "album",
            "albüm", "calan", "çalan",
        ],
    },
    DomainKeywords {
        domain: Domain::Automation,
        words: &[
            "otomasyon",
            "zamanla",
            "zamanlanmis",
            "zamanlanmış",
            "otomatik",
            // "gece" YOK: "iyi geceler" selamlaması otomasyon tetikliyordu.
            // Saat ifadeleri zaten "09:00" biçiminde geliyor.
            // "sabah" burada güvenli: "iyi geceler"i bozmuyor, "her sabah X yap"
            // cümlesini yakalıyor. "gece" ise selamlamaya çarptığı için YOK.
            "periyodik",
            "tekrarla",
            "sabah",
            "azalinca",
            "azalınca",
            "olunca",
            "inince",
            "cikinca",
            "çıkınca",
            "hatirlat",
            "hatırlat",
            "uyar",
            "alarm",
            "gorev",
            "görev",
        ],
    },
    DomainKeywords {
        domain: Domain::Memory,
        words: &[
            "hatırla",
            "hatirla",
            "hatırlat",
            "hatirlat",
            "unut",
            "hafıza",
            "hafiza",
            "remember",
            "forget",
            "memory",
            "not",
            "note",
            "kaydettiğim",
            "kaydettigim",
            "biliyor",
            "söylemiştim",
            "soylemistim",
            "bilgi",
        ],
    },
];

/// Sohbet kapatıcıları — bunlara tool sunulmaz.
const CHATTER: &[&str] = &[
    "merhaba",
    "selam",
    "teşekkür",
    "tesekkur",
    "teşekkürler",
    "tesekkurler",
    "sağol",
    "sagol",
    "tamam",
    "ok",
    "okey",
    "peki",
    "evet",
    "hayır",
    "hayir",
    "güzel",
    "guzel",
    "harika",
    "süper",
    "super",
    "hello",
    "hi",
    "thanks",
    "thank",
    "yes",
    "no",
    "cool",
    "nice",
    "great",
    "bye",
    "görüşürüz",
    "gorusuruz",
];

/// Metni karşılaştırma için normalleştirir: küçük harf + Türkçe sadeleştirme.
///
/// Türkçe'de `İ`'nin küçüğü `i` değil `i̇` olabildiği için `to_lowercase()`
/// tek başına yetmiyor; ayrıca kullanıcılar sıklıkla ASCII yazıyor ("dosya"
/// yerine "dosya", "açık" yerine "acik").
fn normalize(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| match c {
            'ı' | 'İ' | 'î' => 'i',
            'ş' => 's',
            'ğ' => 'g',
            'ü' => 'u',
            'ö' => 'o',
            'ç' => 'c',
            'â' => 'a',
            other => other,
        })
        .collect()
}

fn tokenize(text: &str) -> Vec<String> {
    normalize(text)
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(String::from)
        .collect()
}

/// Mesaj sadece nezaket/onay ifadesi mi?
fn is_chatter(words: &[String]) -> bool {
    if words.is_empty() || words.len() > 3 {
        return false;
    }
    let normalized_chatter: Vec<String> = CHATTER.iter().map(|c| normalize(c)).collect();
    words
        .iter()
        .all(|w| normalized_chatter.iter().any(|c| c == w))
}

/// Mesaja uyan alanlar, en çok eşleşenden aza doğru.
pub fn match_domains(message: &str) -> Vec<Domain> {
    let words = tokenize(message);
    if is_chatter(&words) {
        return Vec::new();
    }

    let weak: Vec<String> = WEAK_VERBS.iter().map(|v| normalize(v)).collect();

    let mut scored: Vec<(Domain, usize)> = DOMAIN_KEYWORDS
        .iter()
        .map(|dk| {
            // Güçlü ve zayıf eşleşmeleri ayrı say: zayıf olanlar (genel fiiller)
            // tek başına alan tetikleyemez.
            let (mut strong, mut weak_hits) = (0usize, 0usize);

            for kw in dk.words {
                let kw = normalize(kw);
                // Kelime tam eşleşir ya da bir kelime onu içerir
                // ("dosyayı" ⊃ "dosya") — Türkçe ekler için.
                if words.iter().any(|w| w == &kw || w.contains(&kw)) {
                    if weak.contains(&kw) {
                        weak_hits += 1;
                    } else {
                        strong += 1;
                    }
                }
            }

            // Sadece zayıf fiil eşleşti → bu alan değil ("şiir yaz").
            let mut score = if strong == 0 {
                0
            } else {
                strong * 2 + weak_hits
            };

            // Otomasyon niyeti diğer alanları GÖLGELER.
            //
            // "her sabah 9'da hava durumunu söyle" cümlesinde "hava" (Web) ve
            // "durum" (System) de eşleşiyor — ama kullanıcı bir otomasyon
            // kuruyor, hava durumu sormuyor. İç istek (hava) otomasyon
            // tetiklendiğinde ayrıca çalışacak.
            if dk.domain == Domain::Automation && score > 0 {
                score += 6;
            }

            (dk.domain, score)
        })
        .filter(|(_, score)| *score > 0)
        .collect();

    scored.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    // En fazla 2 alan — üçüncüsü zaten alakasızdır ve tool sayısını şişirir.
    scored.into_iter().take(2).map(|(d, _)| d).collect()
}

/// Bu istek için modele sunulacak tool şemaları.
///
/// Dönen liste **her zaman** `MAX_TOOLS` veya altındadır.
pub fn select_tools(registry: &Registry, message: &str) -> Vec<Value> {
    select_named(registry, message)
        .into_iter()
        .filter_map(|name| registry.get(name).map(|t| t.schema()))
        .collect()
}

/// Seçilen tool adları — testler ve günlük kaydı için.
pub fn select_named<'a>(registry: &'a Registry, message: &str) -> Vec<&'a str> {
    let domains = match_domains(message);
    if domains.is_empty() {
        // Sohbet — tool yok. Modeli boş yere kışkırtma.
        return Vec::new();
    }

    let mut names: Vec<&str> = Vec::new();

    // 1) Eşleşen alanların tool'ları (en alakalı olan önce).
    for domain in &domains {
        for tool in registry.in_domain(*domain) {
            if names.len() >= MAX_TOOLS {
                break;
            }
            if !names.contains(&tool.name()) {
                names.push(tool.name());
            }
        }
    }

    // 2) Çekirdek tool'lar — kalan yere sığdığı kadar.
    for tool in registry.in_domain(Domain::Core) {
        if names.len() >= MAX_TOOLS {
            break;
        }
        if !names.contains(&tool.name()) {
            names.push(tool.name());
        }
    }

    debug_assert!(names.len() <= MAX_TOOLS);
    names
}

/// Seçilen tool'ların yaklaşık token maliyeti — bağlam bütçesi için.
pub fn schema_tokens(schemas: &[Value]) -> usize {
    schemas
        .iter()
        .map(|s| vavis_brain::estimate_tokens(&s.to_string()))
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tool::{Tool, ToolOutcome};

    struct Fake(&'static str, Domain);
    impl Tool for Fake {
        fn name(&self) -> &'static str {
            self.0
        }
        fn description(&self) -> &'static str {
            "sahte tool"
        }
        fn domain(&self) -> Domain {
            self.1
        }
        fn run(&self, _: &Value) -> ToolOutcome {
            ToolOutcome::ok("")
        }
    }

    fn registry_with(tools: Vec<(&'static str, Domain)>) -> Registry {
        let mut reg = Registry::new();
        for (name, domain) in tools {
            reg.register(Box::new(Fake(name, domain)));
        }
        reg
    }

    fn big_registry() -> Registry {
        // 30 tool: gerçekçi bir yük.
        let names: Vec<(&'static str, Domain)> = vec![
            ("read_file", Domain::Files),
            ("write_file", Domain::Files),
            ("list_dir", Domain::Files),
            ("delete_file", Domain::Files),
            ("move_file", Domain::Files),
            ("find_file", Domain::Files),
            ("sys_info", Domain::System),
            ("set_volume", Domain::Control),
            ("set_brightness", Domain::Control),
            ("list_processes", Domain::System),
            ("run_command", Domain::Control),
            ("battery", Domain::System),
            ("web_search", Domain::Web),
            ("fetch_url", Domain::Web),
            ("remember", Domain::Memory),
            ("recall", Domain::Memory),
            ("forget", Domain::Memory),
            ("now", Domain::Core),
            ("remind", Domain::Core),
        ];
        registry_with(names)
    }

    #[test]
    fn never_exceeds_max_tools() {
        let reg = big_registry();
        // Her alandan kelime içeren kötü niyetli mesaj.
        let msg = "dosya sistem ses web ara hatırla cpu disk klasör oku yaz sil";
        let selected = select_named(&reg, msg);
        assert!(
            selected.len() <= MAX_TOOLS,
            "{} tool seçildi, sınır {MAX_TOOLS}",
            selected.len()
        );
    }

    #[test]
    fn greeting_gets_no_tools() {
        let reg = big_registry();
        for msg in ["merhaba", "selam", "teşekkürler", "tamam", "ok"] {
            assert!(
                select_named(&reg, msg).is_empty(),
                "'{msg}' için tool sunulmamalı"
            );
        }
    }

    #[test]
    fn file_request_offers_file_tools() {
        let reg = big_registry();
        let selected = select_named(&reg, "masaüstündeki dosyaları listele");
        assert!(selected.contains(&"list_dir"), "seçilenler: {selected:?}");
    }

    #[test]
    fn system_request_offers_system_tools() {
        let reg = big_registry();
        let selected = select_named(&reg, "cpu kullanımı ne durumda");
        assert!(selected.contains(&"sys_info"), "seçilenler: {selected:?}");
    }

    #[test]
    fn volume_request_offers_volume_tool() {
        let reg = big_registry();
        let selected = select_named(&reg, "sesi %30 yap");
        assert!(selected.contains(&"set_volume"), "seçilenler: {selected:?}");
    }

    #[test]
    fn web_request_offers_web_tools() {
        let reg = big_registry();
        let selected = select_named(&reg, "bugünkü haberleri ara");
        assert!(selected.contains(&"web_search"), "seçilenler: {selected:?}");
    }

    #[test]
    fn memory_request_offers_memory_tools() {
        let reg = big_registry();
        let selected = select_named(&reg, "beni hatırla: kahveyi sade içerim");
        assert!(selected.contains(&"remember"), "seçilenler: {selected:?}");
    }

    #[test]
    fn turkish_suffixes_are_handled() {
        let _reg = big_registry();
        // "dosyayı", "dosyada", "dosyalar" hepsi eşleşmeli.
        for msg in ["dosyayı oku", "dosyada ara", "dosyalarımı listele"] {
            let d = match_domains(msg);
            assert!(d.contains(&Domain::Files), "'{msg}' → {d:?}");
        }
    }

    #[test]
    fn ascii_turkish_also_matches() {
        // Kullanıcılar sıklıkla şapkasız yazıyor.
        let d = match_domains("parlaklik arttir");
        assert!(
            d.contains(&Domain::Control),
            "ASCII yazım da eşleşmeli: {d:?}"
        );
    }

    #[test]
    fn unrelated_text_yields_no_domain() {
        assert!(match_domains("bana bir şiir yaz").is_empty());
        assert!(match_domains("nasılsın bugün").is_empty());
    }

    /// **Regresyon testi.** Zayıf fiil tek başına alan tetiklememeli.
    ///
    /// Bu tam olarak kullanıcının "tool'lar aşırı gidiyor" şikayetinin
    /// kaynağı: "şiir yaz" cümlesindeki "yaz" dosya tool'larını çağırıyordu.
    #[test]
    fn weak_verbs_alone_do_not_trigger_a_domain() {
        for msg in [
            "bana bir şiir yaz",
            "bir hikaye yaz",
            "şunu oku bakalım", // nesne yok
            // ("bir şarkı bul" artık Media alanını tetikliyor — DOĞRU davranış,
            //  medya tool'ları eklendikten sonra. Bu yüzden listeden çıkarıldı.)
            "espri yap ve yaz",
        ] {
            let d = match_domains(msg);
            assert!(d.is_empty(), "'{msg}' alan tetiklememeli, tetikledi: {d:?}");
        }
    }

    /// Zayıf fiil + alan kelimesi **birlikte** çalışmalı.
    #[test]
    fn weak_verb_with_domain_noun_does_trigger() {
        for (msg, expected) in [
            ("dosya yaz", Domain::Files),
            ("bu dosyayı oku", Domain::Files),
            ("klasörü listele", Domain::Files),
            ("internette ara", Domain::Web),
        ] {
            let d = match_domains(msg);
            assert!(
                d.contains(&expected),
                "'{msg}' → {expected:?} bekleniyordu, gelen: {d:?}"
            );
        }
    }

    /// Sohbet mesajlarında hiçbir koşulda tool sunulmamalı.
    #[test]
    fn conversational_requests_stay_tool_free() {
        for msg in [
            "bugün nasılsın",
            "bana kendini tanıt",
            "python nedir",
            "bir fıkra anlat",
            "ne düşünüyorsun bu konuda",
        ] {
            let d = match_domains(msg);
            assert!(d.is_empty(), "'{msg}' → {d:?}");
        }
    }

    #[test]
    fn core_tools_are_included_when_a_domain_matches() {
        let reg = big_registry();
        let selected = select_named(&reg, "cpu durumu");
        assert!(selected.contains(&"now"), "çekirdek tool'lar da sunulmalı");
    }

    #[test]
    fn most_relevant_domain_comes_first() {
        let reg = big_registry();
        // Baskın olarak dosya mesajı.
        let selected = select_named(&reg, "dosya klasör oku yaz listele");
        let first = selected.first().copied().unwrap_or("");
        let file_tools = [
            "read_file",
            "write_file",
            "list_dir",
            "delete_file",
            "move_file",
            "find_file",
        ];
        assert!(
            file_tools.contains(&first),
            "en alakalı alan başta olmalı, ilk: {first}"
        );
    }

    #[test]
    fn schemas_are_valid_json_and_counted() {
        let reg = big_registry();
        let schemas = select_tools(&reg, "dosyaları listele");
        assert!(!schemas.is_empty());
        for s in &schemas {
            assert_eq!(s["type"], "function");
            assert!(s["function"]["name"].is_string());
        }
        assert!(schema_tokens(&schemas) > 0);
    }

    #[test]
    fn empty_message_gets_no_tools() {
        let reg = big_registry();
        assert!(select_named(&reg, "").is_empty());
        assert!(select_named(&reg, "   ").is_empty());
    }
}
