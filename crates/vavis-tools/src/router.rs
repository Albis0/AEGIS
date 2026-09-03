//! Tool yönlendirme — hangi araçların bu isteğe sunulacağına karar verir.
//!
//! # Neden ikinci bir katman
//!
//! [`crate::selection`] anahtar kelimeye bakar. Ucuz, çevrimdışı ve
//! öngörülebilir; ama kelime görmediği şeyi bulamaz. "Şu ekrandakini not
//! defterime geçir" cümlesinde ne "dosya" ne "yaz" geçiyor olabilir.
//!
//! Buradaki fikir: **ucuz bir model neyin gerektiğini seçsin, pahalı model
//! işi yapsın.**
//!
//! ```text
//! Kullanıcı mesajı
//!    │
//!    ├─► 1. UCUZ MODEL (router)
//!    │      Girdi: mesaj + tüm tool'ların adı ve tek satır açıklaması
//!    │      Çıktı: "bu iş için şunlar lazım"
//!    │      Maliyet: tek kısa çağrı, şema yok
//!    │
//!    └─► 2. PAHALI MODEL (işçi)
//!           Girdi: mesaj + sadece seçilen tool'ların şemaları
//! ```
//!
//! Kazanç çift: pahalı modele hiçbir zaman elli şema gitmiyor (fatura), ama
//! seçim anlamsal yapılıyor (kalite).
//!
//! # Yönlendirici asla asistanı durduramaz
//!
//! Ucuz model de bir ağ çağrısı — yavaşlayabilir, düşebilir, saçmalayabilir.
//! Bu yüzden [`Router`] bir trait ve başarısızlık her zaman anahtar kelime
//! yoluna düşüyor. Yönlendirici çalışmıyorsa asistan **eskisi gibi** çalışır,
//! hiç çalışmamış gibi değil.

use crate::selection;
use crate::tool::Registry;

/// Yönlendiriciye sunulan tool özeti.
///
/// Şema değil: şemalar uzun, katalog kısa olmalı. Ucuz modelin gördüğü tek
/// şey ad ve bir cümlelik açıklama.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolBrief {
    pub name: &'static str,
    pub description: &'static str,
}

/// Kayıt defterindeki her tool'un tek satırlık özeti.
pub fn catalog(registry: &Registry) -> Vec<ToolBrief> {
    registry
        .iter()
        .map(|t| ToolBrief {
            name: t.name(),
            description: t.description(),
        })
        .collect()
}

/// Ucuz modele sorulacak metin.
///
/// Ayrı bir fonksiyon çünkü test edilebilir olması gerekiyor: promptun
/// biçimi bozulursa yönlendirici sessizce kötüleşir.
pub fn prompt(message: &str, catalog: &[ToolBrief]) -> String {
    let mut out = String::with_capacity(catalog.len() * 64 + message.len() + 512);

    out.push_str(
        "Bir asistanın hangi araçlara ihtiyacı olduğunu seçiyorsun.\n\
         Aşağıda araçların listesi ve kullanıcının isteği var.\n\n\
         Kurallar:\n\
         - Sadece isteği yerine getirmek için GEREKLİ olanları seç.\n\
         - Emin değilsen ekleme. Fazla araç zarar verir.\n\
         - İstek sohbetse (selam, teşekkür, sohbet) hiçbirini seçme.\n\
         - Yalnızca araç adlarını virgülle ayırıp yaz. Başka hiçbir şey yazma.\n\
         - Hiçbiri gerekmiyorsa YOK yaz.\n\n\
         Araçlar:\n",
    );

    for brief in catalog {
        out.push_str("- ");
        out.push_str(brief.name);
        out.push_str(": ");
        out.push_str(brief.description);
        out.push('\n');
    }

    out.push_str("\nİstek: ");
    out.push_str(message);
    out.push_str("\n\nAraçlar:");
    out
}

/// Ucuz modelin cevabını tool adlarına çevirir.
///
/// Model her zaman istendiği gibi cevap vermez — madde imi, tırnak, numara,
/// açıklama cümlesi ekleyebilir. Bu yüzden ayrıştırma bağışlayıcı: cevaptaki
/// kelimeler **kayıt defterindeki adlarla** eşleştiriliyor, uydurulmuş bir
/// ad sessizce düşüyor.
pub fn parse_reply<'a>(reply: &str, registry: &'a Registry) -> Vec<&'a str> {
    let mut names: Vec<&str> = Vec::new();

    for raw in reply.split([',', '\n', ';']) {
        let token = raw
            .trim()
            .trim_start_matches([
                '-', '*', '•', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            ])
            .trim_matches(|c: char| !c.is_alphanumeric() && c != '_')
            .trim();

        if token.is_empty() || token.eq_ignore_ascii_case("yok") {
            continue;
        }

        // Uydurulmuş adlar burada eleniyor: yalnızca gerçekten var olan
        // tool'lar geçiyor.
        if let Some(tool) = registry.get(token) {
            let name = tool.name();
            if !names.contains(&name) {
                names.push(name);
            }
        }
    }

    names
}

/// Bir isteğe hangi tool'ların sunulacağına karar veren şey.
pub trait Router: Send + Sync {
    /// Seçilen tool adları.
    ///
    /// `budget` bir tavan — dönen liste bundan uzun olmamalı. Uygulamanın
    /// hata döndürme yolu yok: bir yönlendirici karar veremiyorsa boş değil,
    /// **anahtar kelime sonucunu** döndürmeli (bkz. [`LlmRouter`]).
    fn pick<'a>(&self, registry: &'a Registry, message: &str, budget: usize) -> Vec<&'a str>;
}

/// Anahtar kelime yönlendirici — varsayılan ve her zaman çalışan yol.
///
/// Ağ istemiyor, para harcamıyor, gecikmesi sıfır. Yönlendirici
/// yapılandırılmamışsa veya çalışmıyorsa asistan bununla çalışır.
#[derive(Debug, Default, Clone, Copy)]
pub struct KeywordRouter;

impl Router for KeywordRouter {
    fn pick<'a>(&self, registry: &'a Registry, message: &str, budget: usize) -> Vec<&'a str> {
        selection::select_named(registry, message, budget)
    }
}

/// Ucuz bir modele soran yönlendirici.
///
/// Model çağrısının kendisi burada **değil**: bu katman `vavis-brain`'i
/// tanımıyor (mimari kural — bkz. crate belgesi). Çağrıyı yapan kapalı bir
/// fonksiyon dışarıdan veriliyor, böylece hem gerçek sağlayıcı hem test
/// aynı mantığı çalıştırıyor.
pub struct LlmRouter<F> {
    ask: F,
}

impl<F> LlmRouter<F>
where
    F: Fn(&str) -> Result<String, String> + Send + Sync,
{
    /// `ask` promptu alır, modelin ham cevabını döndürür.
    pub fn new(ask: F) -> Self {
        Self { ask }
    }
}

impl<F> Router for LlmRouter<F>
where
    F: Fn(&str) -> Result<String, String> + Send + Sync,
{
    fn pick<'a>(&self, registry: &'a Registry, message: &str, budget: usize) -> Vec<&'a str> {
        let fallback = || selection::select_named(registry, message, budget);

        let catalog = catalog(registry);
        if catalog.is_empty() {
            return Vec::new();
        }

        let reply = match (self.ask)(&prompt(message, &catalog)) {
            Ok(reply) => reply,
            Err(e) => {
                // Yönlendirici asistanı durduramaz.
                tracing::warn!(error = %e, "router unavailable, falling back to keywords");
                return fallback();
            }
        };

        let mut picked = parse_reply(&reply, registry);

        // Model hiçbir geçerli ad üretemediyse cevabı çöp sayıyoruz. Boş
        // dönmek "araç gerekmiyor" demek olurdu — ama bunu söyleyen model
        // değil, ayrıştırıcı olurdu. Sohbet mesajını anahtar kelime yolu
        // zaten boş döndürüyor, yani asıl karar orada güvenle veriliyor.
        if picked.is_empty() {
            let keyword_pick = fallback();
            if !keyword_pick.is_empty() {
                tracing::debug!("router returned nothing usable, falling back to keywords");
            }
            return keyword_pick;
        }

        picked.truncate(budget);
        picked
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tool::{Domain, Risk, Tool, ToolOutcome};
    use serde_json::Value;

    struct Fake(&'static str, Domain);

    impl Tool for Fake {
        fn name(&self) -> &'static str {
            self.0
        }
        fn description(&self) -> &'static str {
            "test aracı"
        }
        fn domain(&self) -> Domain {
            self.1
        }
        fn risk(&self) -> Risk {
            Risk::Safe
        }
        fn run(&self, _args: &Value) -> ToolOutcome {
            ToolOutcome::ok("ok")
        }
        fn keywords(&self) -> &'static [&'static str] {
            &[]
        }
    }

    fn registry() -> Registry {
        let mut reg = Registry::new();
        reg.register(Box::new(Fake("dosya_oku", Domain::Files)));
        reg.register(Box::new(Fake("dosya_yaz", Domain::Files)));
        reg.register(Box::new(Fake("sistem_durumu", Domain::System)));
        reg.register(Box::new(Fake("simdi", Domain::Core)));
        reg
    }

    #[test]
    fn catalog_lists_every_tool() {
        let reg = registry();
        assert_eq!(catalog(&reg).len(), 4);
    }

    #[test]
    fn prompt_carries_the_request_and_every_tool() {
        let reg = registry();
        let p = prompt("dosyaları listele", &catalog(&reg));
        assert!(p.contains("dosyaları listele"));
        assert!(p.contains("dosya_oku"));
        assert!(p.contains("sistem_durumu"));
    }

    #[test]
    fn parses_a_clean_reply() {
        let reg = registry();
        assert_eq!(
            parse_reply("dosya_oku, dosya_yaz", &reg),
            vec!["dosya_oku", "dosya_yaz"]
        );
    }

    /// Model nadiren istendiği gibi cevap verir.
    #[test]
    fn parses_a_messy_reply() {
        let reg = registry();
        assert_eq!(
            parse_reply("- dosya_oku\n- sistem_durumu\n", &reg),
            vec!["dosya_oku", "sistem_durumu"]
        );
        assert_eq!(parse_reply("1. dosya_oku", &reg), vec!["dosya_oku"]);
        assert_eq!(parse_reply("`dosya_oku`", &reg), vec!["dosya_oku"]);
    }

    #[test]
    fn invented_tool_names_are_dropped() {
        let reg = registry();
        assert_eq!(
            parse_reply("dosya_oku, ucan_hali, nukleer_firlat", &reg),
            vec!["dosya_oku"]
        );
    }

    #[test]
    fn no_tools_needed_parses_as_empty() {
        let reg = registry();
        assert!(parse_reply("YOK", &reg).is_empty());
        assert!(parse_reply("yok", &reg).is_empty());
    }

    #[test]
    fn duplicates_collapse() {
        let reg = registry();
        assert_eq!(
            parse_reply("dosya_oku, dosya_oku, dosya_oku", &reg),
            vec!["dosya_oku"]
        );
    }

    #[test]
    fn llm_router_uses_the_reply() {
        let reg = registry();
        let router = LlmRouter::new(|_: &str| Ok("dosya_oku, dosya_yaz".to_string()));
        assert_eq!(
            router.pick(&reg, "şu belgeyi güncelle", 12),
            vec!["dosya_oku", "dosya_yaz"]
        );
    }

    /// En önemli test: yönlendirici çökerse asistan çalışmaya devam eder.
    #[test]
    fn a_failing_router_falls_back_to_keywords() {
        let reg = registry();
        let router = LlmRouter::new(|_: &str| Err("bağlantı yok".to_string()));

        let picked = router.pick(&reg, "dosyaları listele", 12);
        let keywords = KeywordRouter.pick(&reg, "dosyaları listele", 12);
        assert_eq!(picked, keywords);
    }

    #[test]
    fn a_useless_reply_falls_back_to_keywords() {
        let reg = registry();
        let router = LlmRouter::new(|_: &str| Ok("bilmiyorum, belki hiçbiri".to_string()));

        let picked = router.pick(&reg, "dosyaları listele", 12);
        assert_eq!(picked, KeywordRouter.pick(&reg, "dosyaları listele", 12));
    }

    #[test]
    fn the_budget_is_a_ceiling() {
        let reg = registry();
        let router =
            LlmRouter::new(|_: &str| Ok("dosya_oku, dosya_yaz, sistem_durumu, simdi".to_string()));
        assert_eq!(router.pick(&reg, "her şeyi yap", 2).len(), 2);
    }
}
