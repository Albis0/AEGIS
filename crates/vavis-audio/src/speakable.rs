//! Modelin cevabını **okunabilir** metne çevirir.
//!
//! # Sorun
//!
//! Model markdown yazıyor: `**kalın**`, `` `kod` ``, `- madde`, `## başlık`,
//! `[bağlantı](https://...)`. Ekranda bunlar biçim; hoparlörde ise
//! okunuyorlar. Kullanıcının duyduğu şey şuna dönüşüyordu:
//!
//! ```text
//! yıldız yıldız önemli yıldız yıldız ... h t t p s iki nokta bölü bölü ...
//! ```
//!
//! Bu, "bazen kelimeleri söylüyor, bazen tuhaf şeyler söylüyor" şikâyetinin
//! büyük kısmı. Ses motorunun suçu değil: ona zaten o karakterler veriliyordu.
//!
//! # Yaklaşım
//!
//! Metni **atmıyoruz**, işaretlemeyi atıyoruz. `**kalın**` → `kalın`. Kod
//! bloğu ise okunmuyor: otuz satırlık bir betiği yüksek sesle dinlemek
//! kimsenin işine yaramıyor, onun yeri ekran. Yerine tek bir cümle geçiyor,
//! çünkü sessizce atlamak "cevabın yarısı kayboldu" hissi veriyor.
//!
//! Ekrandaki metne dokunulmuyor — bu dönüşüm yalnızca hoparlöre giden
//! kopyada oluyor.

/// Kod bloğu yerine okunan cümle.
fn code_block_notice(language: &str) -> &'static str {
    match language {
        "en" => "There is a code block here; it is on the screen.",
        _ => "Burada bir kod bloğu var, ekranda duruyor.",
    }
}

/// Markdown'ı seslendirilecek düz metne çevirir.
///
/// `language` yalnızca kod bloğu yerine konan cümle için gerekiyor.
pub fn to_speech(markdown: &str, language: &str) -> String {
    let mut out = String::with_capacity(markdown.len());
    let mut in_code_block = false;

    for line in markdown.lines() {
        let trimmed = line.trim_start();

        // ``` çitleri: aradaki her şey atlanıyor, yerine tek cümle.
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            if !in_code_block {
                push_line(&mut out, code_block_notice(language));
            }
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }

        // Yatay çizgi görsel bir ayraç; sesi yok.
        if is_horizontal_rule(trimmed) {
            continue;
        }

        // Tablo satırı: hücreler arasındaki borular "boru" diye okunmasın.
        // Ayraç satırı (|---|---|) tamamen atlanıyor.
        let line = if trimmed.starts_with('|') {
            if is_table_separator(trimmed) {
                continue;
            }
            &table_row(trimmed)
        } else {
            strip_leading_markers(trimmed)
        };

        let cleaned = strip_inline(line);
        if !cleaned.trim().is_empty() {
            push_line(&mut out, cleaned.trim());
        }
    }

    out.trim().to_string()
}

/// Satırı ekler; cümle sonu yoksa nokta koyar.
///
/// Bölücü cümle sınırlarına bakıyor: nokta koymazsak bir başlık ile onu
/// izleyen paragraf tek nefeste, duraksız okunuyor.
fn push_line(out: &mut String, line: &str) {
    if !out.is_empty() {
        out.push('\n');
    }
    out.push_str(line);
    if !line.ends_with(['.', '!', '?', ':', ';', ',']) {
        out.push('.');
    }
}

fn is_horizontal_rule(line: &str) -> bool {
    let t = line.trim();
    t.len() >= 3
        && (t.chars().all(|c| c == '-')
            || t.chars().all(|c| c == '*')
            || t.chars().all(|c| c == '_'))
}

fn is_table_separator(line: &str) -> bool {
    line.chars()
        .all(|c| matches!(c, '|' | '-' | ':' | ' ' | '\t'))
}

/// Tablo satırını virgülle ayrılmış hücrelere çevirir.
fn table_row(line: &str) -> String {
    line.trim_matches('|')
        .split('|')
        .map(str::trim)
        .filter(|c| !c.is_empty())
        .collect::<Vec<_>>()
        .join(", ")
}

/// Satır başındaki işaretleri atar: `#`, `-`, `*`, `>`, `1.`.
///
/// Madde işareti atılıyor ama madde **korunuyor**: her madde kendi satırında
/// kalıyor, dolayısıyla bölücü onları ayrı cümleler olarak veriyor ve
/// aralarında duraklama oluyor.
fn strip_leading_markers(line: &str) -> &str {
    let line = line.trim_start();

    // Başlık: ### Başlık
    if let Some(rest) = line
        .strip_prefix("######")
        .or_else(|| line.strip_prefix("#####"))
        .or_else(|| line.strip_prefix("####"))
        .or_else(|| line.strip_prefix("###"))
        .or_else(|| line.strip_prefix("##"))
        .or_else(|| line.strip_prefix('#'))
    {
        return rest.trim_start();
    }

    // Alıntı: > metin
    if let Some(rest) = line.strip_prefix('>') {
        return rest.trim_start();
    }

    // Madde: "- ", "* ", "+ " (yıldızın tek başına vurgu olmadığından emin
    // olmak için ardından boşluk aranıyor).
    for marker in ["- ", "* ", "+ "] {
        if let Some(rest) = line.strip_prefix(marker) {
            return rest.trim_start();
        }
    }

    // Numaralı madde: "1. ", "12) "
    let digits: String = line.chars().take_while(char::is_ascii_digit).collect();
    if !digits.is_empty() {
        let rest = &line[digits.len()..];
        for marker in [". ", ") "] {
            if let Some(rest) = rest.strip_prefix(marker) {
                return rest.trim_start();
            }
        }
    }

    line
}

/// Satır içi işaretlemeyi atar.
fn strip_inline(line: &str) -> String {
    let without_links = strip_links(line);
    let mut out = String::with_capacity(without_links.len());
    let mut chars = without_links.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            // Vurgu ve kod imleri: metin kalıyor, imler gidiyor.
            '*' | '_' | '`' | '~' => {
                // Kelime içindeki alt çizgi (dosya_adi) korunuyor: onu atmak
                // "dosyaadi" yapardı, ki bu okununca daha da tuhaf.
                if c == '_' && !out.ends_with(' ') && !out.is_empty() {
                    let next_is_word = chars.peek().is_some_and(|n| n.is_alphanumeric());
                    if next_is_word {
                        out.push('_');
                        continue;
                    }
                }
            }
            _ => out.push(c),
        }
    }

    collapse_spaces(&out)
}

/// `[metin](url)` → `metin`, ve çıplak URL'leri atar.
///
/// Bir adresin harf harf okunması dinleyene hiçbir şey vermiyor; bağlantının
/// **metni** ise cümlenin parçası, o kalıyor.
fn strip_links(line: &str) -> String {
    let mut out = String::with_capacity(line.len());
    let mut rest = line;

    while let Some(open) = rest.find('[') {
        // Yalnızca `](` kalıbı bir bağlantı; tek başına köşeli parantez değil.
        let after = &rest[open..];
        let Some(close) = after.find("](") else {
            out.push_str(&rest[..open + 1]);
            rest = &rest[open + 1..];
            continue;
        };
        let Some(end) = after[close..].find(')') else {
            out.push_str(&rest[..open + 1]);
            rest = &rest[open + 1..];
            continue;
        };

        out.push_str(&rest[..open]);
        out.push_str(&after[1..close]); // bağlantı metni
        rest = &after[close + end + 1..];
    }
    out.push_str(rest);

    // Kalan çıplak adresler.
    out.split_whitespace()
        .filter(|w| !is_bare_url(w))
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_bare_url(word: &str) -> bool {
    let w = word.trim_matches(|c: char| !c.is_alphanumeric());
    w.starts_with("http://") || w.starts_with("https://") || w.starts_with("www.")
}

fn collapse_spaces(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut last_space = false;
    for c in s.chars() {
        let is_space = c == ' ' || c == '\t';
        if is_space && last_space {
            continue;
        }
        out.push(if is_space { ' ' } else { c });
        last_space = is_space;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emphasis_markers_are_not_read_aloud() {
        assert_eq!(to_speech("**önemli** bir *şey*", "tr"), "önemli bir şey.");
    }

    #[test]
    fn inline_code_keeps_its_content() {
        // `dosya.txt` okunmalı, ters tırnak okunmamalı.
        let out = to_speech("`dosya.txt` dosyasını açtım", "tr");
        assert!(!out.contains('`'), "{out}");
        assert!(out.contains("dosya.txt"));
    }

    #[test]
    fn a_code_block_is_summarised_not_recited() {
        let md = "İşte:\n```rust\nfn main() { println!(\"x\"); }\n```\nBitti.";
        let out = to_speech(md, "tr");
        assert!(!out.contains("println"), "kod okunmamalı: {out}");
        assert!(out.contains("kod bloğu"), "yerine cümle geçmeli: {out}");
        // Blok sonrası metin kaybolmamalı.
        assert!(out.contains("Bitti"), "{out}");
    }

    #[test]
    fn an_unclosed_code_block_does_not_swallow_the_rest_silently() {
        // Model bazen çiti kapatmayı unutuyor; o zaman kalan atlanıyor ama
        // kullanıcı en azından bir kod bloğu olduğunu duyuyor.
        let out = to_speech("Bak:\n```\nkod", "tr");
        assert!(out.contains("kod bloğu"));
    }

    #[test]
    fn headings_lose_their_hashes() {
        let out = to_speech("## Başlık\nmetin", "tr");
        assert!(!out.contains('#'), "{out}");
        assert!(out.contains("Başlık") && out.contains("metin"));
    }

    #[test]
    fn list_items_become_separate_sentences() {
        // Ayrı cümle olmaları önemli: bölücü aralarında duraklama koyuyor,
        // yoksa üç madde tek nefeste okunuyor.
        let out = to_speech("- bir\n- iki\n- üç", "tr");
        assert_eq!(out, "bir.\niki.\nüç.");
    }

    #[test]
    fn numbered_lists_lose_only_the_marker() {
        let out = to_speech("1. birinci\n2. ikinci", "tr");
        assert!(out.starts_with("birinci"), "{out}");
        assert!(out.contains("ikinci"));
    }

    #[test]
    fn a_link_is_read_by_its_text_not_its_address() {
        let out = to_speech("[belgelere](https://example.com/a/b) bak", "tr");
        assert!(out.contains("belgelere"), "{out}");
        assert!(!out.contains("example.com"), "adres okunmamalı: {out}");
    }

    #[test]
    fn a_bare_address_is_dropped() {
        let out = to_speech("Adres https://example.com/x burada", "tr");
        assert!(!out.contains("https"), "{out}");
        assert!(out.contains("Adres") && out.contains("burada"));
    }

    #[test]
    fn a_lone_bracket_is_not_mistaken_for_a_link() {
        let out = to_speech("dizi [1] elemanı", "tr");
        assert!(out.contains("1"), "{out}");
    }

    #[test]
    fn underscores_inside_words_survive() {
        // "dosya_adi" → "dosyaadi" olsaydı okunuşu daha da bozulurdu.
        let out = to_speech("dosya_adi değişkeni", "tr");
        assert!(out.contains("dosya_adi"), "{out}");
    }

    #[test]
    fn a_table_is_read_as_rows_not_pipes() {
        let md = "| Ad | Değer |\n|---|---|\n| bir | 1 |";
        let out = to_speech(md, "tr");
        assert!(!out.contains('|'), "boru okunmamalı: {out}");
        assert!(out.contains("Ad, Değer"), "{out}");
        assert!(!out.contains("---"));
    }

    #[test]
    fn horizontal_rules_are_silent() {
        let out = to_speech("bir\n---\niki", "tr");
        assert!(!out.contains("---"), "{out}");
        assert!(out.contains("bir") && out.contains("iki"));
    }

    #[test]
    fn plain_text_survives_untouched_apart_from_a_final_stop() {
        let out = to_speech("Bugün hava güzel.", "tr");
        assert_eq!(out, "Bugün hava güzel.");
    }

    #[test]
    fn empty_input_yields_empty_output() {
        assert_eq!(to_speech("", "tr"), "");
        assert_eq!(to_speech("   \n\n  ", "tr"), "");
    }

    #[test]
    fn a_reply_that_is_only_a_code_block_still_says_something() {
        // Sessizce hiçbir şey söylememek "ses bozuldu" gibi duyuluyor.
        let out = to_speech("```\nx = 1\n```", "tr");
        assert!(!out.is_empty(), "tamamen susmamalı");
    }

    #[test]
    fn the_code_block_notice_follows_the_language() {
        assert!(to_speech("```\nx\n```", "en").contains("code block"));
        assert!(to_speech("```\nx\n```", "tr").contains("kod bloğu"));
    }

    #[test]
    fn turkish_characters_are_untouched() {
        let out = to_speech("Çğıöşü ĞİÖŞÜ", "tr");
        assert!(out.starts_with("Çğıöşü ĞİÖŞÜ"), "{out}");
    }

    #[test]
    fn blockquotes_lose_their_marker() {
        let out = to_speech("> alıntı", "tr");
        assert_eq!(out, "alıntı.");
    }
}
