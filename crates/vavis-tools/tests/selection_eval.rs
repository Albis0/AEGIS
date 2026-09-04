//! Tool seçimi değerlendirmesi.
//!
//! Eski projede `tool-selection-eval.mjs` vardı ve %100 skoru korunuyordu.
//! Buradaki karşılığı: gerçekçi kullanıcı cümleleri → doğru tool sunuldu mu?
//!
//! **Bu testin amacı birim testten farklı:** birim testler tek tek davranışı
//! doğrular, bu ise seçim kalitesini bir bütün olarak ölçer. Skor düşerse
//! seçim mantığında bir gerileme var demektir.

use vavis_tools::{default_registry, selection, DEFAULT_TOOL_BUDGET};

/// (kullanıcı cümlesi, sunulması BEKLENEN tool)
const EXPECT_OFFERED: &[(&str, &str)] = &[
    // Sistem
    ("cpu kullanımı ne durumda", "sistem_durumu"),
    ("ram ne kadar dolu", "sistem_durumu"),
    ("bilgisayarın performansı nasıl", "sistem_durumu"),
    ("pil yüzde kaç", "pil_durumu"),
    ("şarj var mı", "pil_durumu"),
    ("sesi 30 yap", "ses_ayarla"),
    ("ses seviyesini kıs", "ses_ayarla"),
    ("hangi uygulamalar çalışıyor", "calisan_uygulamalar"),
    ("en çok ram yiyen program hangisi", "calisan_uygulamalar"),
    // Dosya
    ("masaüstündeki dosyaları listele", "dosya_listele"),
    ("indirilenler klasöründe neler var", "dosya_listele"),
    ("şu dosyayı oku", "dosya_oku"),
    ("belgenin içeriğini göster", "dosya_oku"),
    ("bir dosyaya not kaydet", "dosya_yaz"),
    ("rapor geçen dosyaları bul", "dosya_ara"),
    // Hafıza
    ("beni hatırla: kahveyi sade içerim", "hatirla"),
    ("şunu unutma: toplantı salı günü", "hatirla"),
    ("hakkımda ne biliyorsun", "hafizada_ara"),
    ("sana ne söylemiştim", "hafizada_ara"),
    // Kontrol (sistem degistirme)
    ("parlaklığı azalt", "parlaklik_ayarla"),
    ("ekranı karart", "parlaklik_ayarla"),
    ("notepad aç", "uygulama_ac"),
    ("chrome başlat", "uygulama_ac"),
    ("spotify uygulamasını kapat", "uygulama_kapat"),
    ("panodaki metni oku", "pano_oku"),
    ("şunu panoya kopyala", "pano_yaz"),
    ("bir powershell komutu çalıştır", "komut_calistir"),
    // Medya
    ("müziği duraklat", "medya_kontrol"),
    ("sonraki şarkıya geç", "medya_kontrol"),
    ("spotify'da ne çalıyor", "calan_parca"),
    // Otomasyon
    ("her sabah 9da hava durumunu söyle", "otomasyon_kur"),
    ("pil azalınca beni uyar", "otomasyon_kur"),
    ("kurulu otomasyonları listele", "otomasyonlari_listele"),
    // Görü
    ("ekranımda ne var", "ekran_goruntusu"),
    ("ekran görüntüsü al", "ekran_goruntusu"),
    // Cekirdek (alan tetiklendiginde birlikte gelir)
    ("cpu durumu ve saat", "simdiki_zaman"),
    // Cekirdek TEK BASINA — bir zamanlar hicbiri sunulmuyordu ve model
    // saati uyduruyordu. Bu satirlar o hatanin geri gelmemesi icin.
    ("saat kaç", "simdiki_zaman"),
    ("saat", "simdiki_zaman"),
    ("bugün ayın kaçı", "simdiki_zaman"),
    ("bugün günlerden ne", "simdiki_zaman"),
    ("tarih ne", "simdiki_zaman"),
    ("what time is it", "simdiki_zaman"),
    ("15 * 3 kaç eder", "hesapla"),
    ("şunu hesapla: 120 / 4", "hesapla"),
    ("240 ın yüzde 18 i ne kadar", "hesapla"),
];

/// Bu cümlelerde **hiç** tool sunulmamalı — sohbet.
const EXPECT_NO_TOOLS: &[&str] = &[
    "merhaba",
    "selam nasılsın",
    "teşekkürler",
    "tamam",
    "bana bir şiir yaz",
    "bir fıkra anlat",
    "python nedir",
    "ne düşünüyorsun",
    "kendini tanıt",
    "iyi geceler",
];

#[test]
fn offered_tool_eval_scores_100_percent() {
    let reg = default_registry();
    let mut failures = Vec::new();

    for (msg, expected) in EXPECT_OFFERED {
        let offered = selection::select_named(&reg, msg, DEFAULT_TOOL_BUDGET);
        if !offered.contains(expected) {
            failures.push(format!(
                "  '{msg}' → {expected} bekleniyordu, sunulan: {offered:?}"
            ));
        }
    }

    let total = EXPECT_OFFERED.len();
    let passed = total - failures.len();
    let score = passed as f64 / total as f64 * 100.0;

    assert!(
        failures.is_empty(),
        "\nTool sunum skoru: {score:.0}% ({passed}/{total})\nBaşarısızlar:\n{}",
        failures.join("\n")
    );
}

#[test]
fn conversational_messages_get_zero_tools() {
    let reg = default_registry();
    let mut failures = Vec::new();

    for msg in EXPECT_NO_TOOLS {
        let offered = selection::select_named(&reg, msg, DEFAULT_TOOL_BUDGET);
        if !offered.is_empty() {
            failures.push(format!("  '{msg}' → tool sunulmamalıydı: {offered:?}"));
        }
    }

    assert!(
        failures.is_empty(),
        "\n{} sohbet mesajında tool sunuldu:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

/// **Asıl garanti.** Hiçbir girdi sınırı aşamamalı.
#[test]
fn tool_count_never_exceeds_limit_on_any_input() {
    let reg = default_registry();

    let adversarial = [
        "dosya klasör sistem ses cpu ram disk web ara hatırla oku yaz sil listele bul",
        "dosya dosya dosya sistem sistem web web hafıza hafıza",
        &"dosya sistem web hatırla ".repeat(50),
    ];

    for msg in adversarial {
        let offered = selection::select_named(&reg, msg, DEFAULT_TOOL_BUDGET);
        assert!(
            offered.len() <= DEFAULT_TOOL_BUDGET,
            "'{}' için {} tool sunuldu (sınır {DEFAULT_TOOL_BUDGET})",
            &msg[..msg.len().min(40)],
            offered.len()
        );
    }

    // Tüm eval cümleleri için de geçerli olmalı.
    for (msg, _) in EXPECT_OFFERED {
        assert!(
            selection::select_named(&reg, msg, DEFAULT_TOOL_BUDGET).len() <= DEFAULT_TOOL_BUDGET
        );
    }
}

/// Sunulan tool sayısı gerçekte ne kadar? Ortalama düşük olmalı.
///
/// Eski projede model 64 tool görüyordu. Buradaki ortalama bunu somut kılar.
#[test]
fn average_offered_tool_count_stays_small() {
    let reg = default_registry();
    let counts: Vec<usize> = EXPECT_OFFERED
        .iter()
        .map(|(msg, _)| selection::select_named(&reg, msg, DEFAULT_TOOL_BUDGET).len())
        .collect();

    let avg = counts.iter().sum::<usize>() as f64 / counts.len() as f64;
    let max = counts.iter().copied().max().unwrap_or(0);

    println!("ortalama sunulan tool: {avg:.1} · en fazla: {max}");
    assert!(
        avg <= 8.0,
        "ortalama {avg:.1} tool sunuluyor — model şaşırabilir"
    );
}

/// Şemalar sağlayıcıya gönderilebilir biçimde olmalı.
#[test]
fn generated_schemas_are_provider_compatible() {
    let reg = default_registry();
    let schemas =
        selection::select_tools(&reg, "masaüstündeki dosyaları listele", DEFAULT_TOOL_BUDGET);
    assert!(!schemas.is_empty());

    for s in &schemas {
        assert_eq!(s["type"], "function", "tip 'function' olmalı");

        let f = &s["function"];
        assert!(f["name"].is_string(), "ad zorunlu");
        assert!(
            !f["description"].as_str().unwrap_or_default().is_empty(),
            "açıklama boş olmamalı — model neye yaradığını bilemez"
        );

        let params = &f["parameters"];
        assert_eq!(params["type"], "object");
        assert!(params["required"].is_array());

        // Sayısal parametreler dahil HER ŞEY string olmalı — sağlayıcılar
        // sayı beklerken string alınca tool_use_failed veriyor.
        if let Some(props) = params["properties"].as_object() {
            for (name, spec) in props {
                assert_eq!(spec["type"], "string", "{name} string olmalı");
            }
        }
    }
}

/// Aynı tool iki kez sunulmamalı — model kafası karışır.
#[test]
fn no_duplicate_tools_are_offered() {
    let reg = default_registry();
    for (msg, _) in EXPECT_OFFERED {
        let offered = selection::select_named(&reg, msg, DEFAULT_TOOL_BUDGET);
        let mut sorted = offered.clone();
        sorted.sort_unstable();
        let before = sorted.len();
        sorted.dedup();
        assert_eq!(
            before,
            sorted.len(),
            "'{msg}' tekrarlı tool içeriyor: {offered:?}"
        );
    }
}

/// What a two-word message actually costs before any history exists.
///
/// Reported, not asserted: this exists to answer "why was a request with two
/// letters in it refused for being too long", where the answer has to be a
/// number rather than a guess.
#[test]
#[ignore = "measurement only — run with --ignored"]
fn measure_fixed_overhead_of_a_trivial_message() {
    let reg = default_registry();

    for msg in ["sa", "merhaba", "su projeyi devam ettir"] {
        let schemas = selection::select_tools(&reg, msg, DEFAULT_TOOL_BUDGET);
        let tool_tokens: usize = schemas
            .iter()
            .map(|s| vavis_brain::estimate_tokens(&s.to_string()))
            .sum();

        println!("\n=== {msg:?} ===");
        println!("tools offered : {}", schemas.len());
        println!("tool tokens   : {tool_tokens}");

        let mut named: Vec<(String, usize)> = schemas
            .iter()
            .map(|s| {
                (
                    s["function"]["name"].as_str().unwrap_or("?").to_string(),
                    vavis_brain::estimate_tokens(&s.to_string()),
                )
            })
            .collect();
        named.sort_by_key(|(_, n)| std::cmp::Reverse(*n));
        for (name, n) in named {
            println!("  {name:<34} {n:>6}");
        }
    }
}
