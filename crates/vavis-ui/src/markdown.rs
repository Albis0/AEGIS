//! Markdown görüntüleme.
//!
//! # Neden kendi çözümümüz
//!
//! Modellerin cevapları markdown içerir: kod blokları, listeler, kalın metin,
//! başlıklar. Düz metin olarak göstermek okunmaz hâle getiriyor.
//!
//! Hazır bir markdown kütüphanesi bağımlılık ve boyut getirir; bize gereken
//! alt küme küçük. Bu modül **sadece modellerin gerçekten ürettiği** işaretleri
//! işler:
//!
//! - ` ```dil ` kod blokları (sözdizimi renklendirmeli)
//! - `` `satır içi kod` ``
//! - `**kalın**` ve `*eğik*`
//! - `# başlık`
//! - `- madde` ve `1. madde`
//! - `> alıntı`
//! - `| tablo |`
//!
//! Tanımadığı işaret düz metin olarak geçer — bozuk render yerine ham metin
//! göstermek daha iyi.

use crate::theme::Theme;
use egui::{Color32, RichText, Ui};

/// Ayrıştırılmış bir markdown parçası.
#[derive(Debug, Clone, PartialEq)]
pub enum Block {
    /// Düz paragraf (satır içi biçimlendirme içerebilir).
    Paragraph(String),
    /// Başlık: (seviye 1-6, metin)
    Heading(u8, String),
    /// Kod bloğu: (dil, içerik)
    Code(String, String),
    /// Madde listesi: (girinti seviyesi, işaret, metin)
    ListItem(usize, String, String),
    /// Alıntı.
    Quote(String),
    /// Tablo satırı: hücreler. `is_header` başlık satırını işaretler.
    TableRow { cells: Vec<String>, header: bool },
    /// Yatay ayraç.
    Rule,
}

/// Markdown metnini bloklara ayırır.
pub fn parse(text: &str) -> Vec<Block> {
    let mut blocks = Vec::new();
    let mut lines = text.lines().peekable();
    let mut paragraph = String::new();

    // Bir paragraf biriktiriyorsak önce onu kapatan yardımcı.
    macro_rules! flush {
        () => {
            if !paragraph.trim().is_empty() {
                blocks.push(Block::Paragraph(paragraph.trim().to_string()));
            }
            paragraph.clear();
        };
    }

    while let Some(line) = lines.next() {
        let trimmed = line.trim_start();

        // ── Kod bloğu ────────────────────────────────────────────────────
        if let Some(rest) = trimmed.strip_prefix("```") {
            flush!();
            let lang = rest.trim().to_string();
            let mut code = String::new();

            // Kapanış işaretine kadar topla. Kapanış hiç gelmezse metnin
            // sonuna kadar al — yarım kod bloğu yutulmasın.
            for code_line in lines.by_ref() {
                if code_line.trim_start().starts_with("```") {
                    break;
                }
                code.push_str(code_line);
                code.push('\n');
            }
            blocks.push(Block::Code(lang, code.trim_end().to_string()));
            continue;
        }

        // ── Başlık ───────────────────────────────────────────────────────
        if trimmed.starts_with('#') {
            let level = trimmed.chars().take_while(|c| *c == '#').count();
            if (1..=6).contains(&level) {
                let content = trimmed[level..].trim();
                // "#hashtag" başlık değil — boşluk şart.
                if trimmed.chars().nth(level) == Some(' ') && !content.is_empty() {
                    flush!();
                    blocks.push(Block::Heading(level as u8, content.to_string()));
                    continue;
                }
            }
        }

        // ── Yatay ayraç ──────────────────────────────────────────────────
        if trimmed.len() >= 3
            && (trimmed.chars().all(|c| c == '-') || trimmed.chars().all(|c| c == '='))
        {
            flush!();
            blocks.push(Block::Rule);
            continue;
        }

        // ── Tablo ────────────────────────────────────────────────────────
        if trimmed.starts_with('|') && trimmed.matches('|').count() >= 2 {
            // Ayraç satırı (|---|---|) tabloyu tanımlar ama gösterilmez.
            let is_separator = trimmed
                .trim_matches('|')
                .split('|')
                .all(|c| !c.trim().is_empty() && c.trim().chars().all(|ch| ch == '-' || ch == ':'));

            if is_separator {
                // Bir önceki satır başlıktı — işaretle.
                if let Some(Block::TableRow { header, .. }) = blocks.last_mut() {
                    *header = true;
                }
                continue;
            }

            flush!();
            let cells: Vec<String> = trimmed
                .trim_matches('|')
                .split('|')
                .map(|c| c.trim().to_string())
                .collect();
            blocks.push(Block::TableRow {
                cells,
                header: false,
            });
            continue;
        }

        // ── Alıntı ───────────────────────────────────────────────────────
        if let Some(rest) = trimmed.strip_prefix("> ") {
            flush!();
            blocks.push(Block::Quote(rest.to_string()));
            continue;
        }

        // ── Liste ────────────────────────────────────────────────────────
        let indent = line.len() - trimmed.len();
        if let Some(item) = parse_list_item(trimmed) {
            flush!();
            blocks.push(Block::ListItem(indent / 2, item.0, item.1));
            continue;
        }

        // ── Boş satır: paragrafı kapat ───────────────────────────────────
        if trimmed.is_empty() {
            flush!();
            continue;
        }

        // ── Normal metin: paragrafa ekle ─────────────────────────────────
        if !paragraph.is_empty() {
            paragraph.push(' ');
        }
        paragraph.push_str(trimmed);
    }

    flush!();
    blocks
}

/// `- madde` veya `1. madde` ayrıştırır. Dönen: (işaret, metin)
fn parse_list_item(line: &str) -> Option<(String, String)> {
    // Madde işaretli liste.
    for marker in ["- ", "* ", "+ "] {
        if let Some(rest) = line.strip_prefix(marker) {
            return Some(("•".to_string(), rest.to_string()));
        }
    }

    // Numaralı liste: "1. " / "12) "
    let digits: String = line.chars().take_while(char::is_ascii_digit).collect();
    if !digits.is_empty() && digits.len() <= 3 {
        let rest = &line[digits.len()..];
        for sep in [". ", ") "] {
            if let Some(text) = rest.strip_prefix(sep) {
                return Some((format!("{digits}."), text.to_string()));
            }
        }
    }

    None
}

/// Satır içi biçimlendirme parçası.
#[derive(Debug, Clone, PartialEq)]
pub enum Span {
    Text(String),
    Bold(String),
    Italic(String),
    Code(String),
}

/// Bir satırı satır içi biçimlere ayırır.
pub fn parse_inline(text: &str) -> Vec<Span> {
    let mut spans = Vec::new();
    let mut plain = String::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;

    macro_rules! flush {
        () => {
            if !plain.is_empty() {
                spans.push(Span::Text(std::mem::take(&mut plain)));
            }
        };
    }

    while i < chars.len() {
        // ── Satır içi kod ────────────────────────────────────────────────
        if chars[i] == '`' {
            if let Some(end) = find_char(&chars, i + 1, '`') {
                flush!();
                spans.push(Span::Code(chars[i + 1..end].iter().collect()));
                i = end + 1;
                continue;
            }
        }

        // ── Kalın (** veya __) ───────────────────────────────────────────
        if i + 1 < chars.len() && (chars[i] == '*' || chars[i] == '_') && chars[i + 1] == chars[i] {
            let marker = chars[i];
            if let Some(end) = find_double(&chars, i + 2, marker) {
                let content: String = chars[i + 2..end].iter().collect();
                if !content.trim().is_empty() {
                    flush!();
                    spans.push(Span::Bold(content));
                    i = end + 2;
                    continue;
                }
            }
        }

        // ── Eğik (tek * veya _) ──────────────────────────────────────────
        if chars[i] == '*' || chars[i] == '_' {
            if let Some(end) = find_char(&chars, i + 1, chars[i]) {
                let content: String = chars[i + 1..end].iter().collect();
                // Boş veya boşlukla başlayan italik, çarpma işareti olabilir.
                if !content.trim().is_empty() && !content.starts_with(' ') {
                    flush!();
                    spans.push(Span::Italic(content));
                    i = end + 1;
                    continue;
                }
            }
        }

        plain.push(chars[i]);
        i += 1;
    }

    flush!();
    spans
}

fn find_char(chars: &[char], from: usize, target: char) -> Option<usize> {
    (from..chars.len()).find(|&i| chars[i] == target)
}

fn find_double(chars: &[char], from: usize, target: char) -> Option<usize> {
    (from..chars.len().saturating_sub(1)).find(|&i| chars[i] == target && chars[i + 1] == target)
}

/// Blokları ekrana çizer.
pub fn render(ui: &mut Ui, blocks: &[Block], base_colour: Color32) {
    let mut table_rows: Vec<(Vec<String>, bool)> = Vec::new();

    for block in blocks {
        // Tablo satırları biriktirilir, tablo bitince topluca çizilir.
        if let Block::TableRow { cells, header } = block {
            table_rows.push((cells.clone(), *header));
            continue;
        }
        if !table_rows.is_empty() {
            render_table(ui, &table_rows);
            table_rows.clear();
        }

        match block {
            Block::Paragraph(text) => render_inline(ui, text, base_colour),

            Block::Heading(level, text) => {
                ui.add_space(4.0);
                let size = match level {
                    1 => 6.0,
                    2 => 4.0,
                    _ => 2.0,
                };
                ui.label(
                    RichText::new(text)
                        .size(ui.style().text_styles[&egui::TextStyle::Body].size + size)
                        .strong()
                        .color(Theme::CYAN_BRIGHT),
                );
                ui.add_space(2.0);
            }

            Block::Code(lang, code) => render_code(ui, lang, code),

            Block::ListItem(depth, marker, text) => {
                ui.horizontal(|ui| {
                    ui.add_space(12.0 + *depth as f32 * 16.0);
                    ui.label(RichText::new(marker).color(Theme::CYAN));
                    render_inline(ui, text, base_colour);
                });
            }

            Block::Quote(text) => {
                ui.horizontal(|ui| {
                    // Sol kenarda dikey çizgi.
                    let (rect, _) =
                        ui.allocate_exact_size(egui::vec2(3.0, 18.0), egui::Sense::hover());
                    ui.painter().rect_filled(rect, 0.0, Theme::CYAN_DIM);
                    ui.add_space(6.0);
                    ui.label(RichText::new(text).italics().color(Theme::FG_DIM));
                });
            }

            Block::Rule => {
                ui.add_space(4.0);
                let width = ui.available_width();
                let (rect, _) =
                    ui.allocate_exact_size(egui::vec2(width, 1.0), egui::Sense::hover());
                ui.painter()
                    .rect_filled(rect, 0.0, Theme::alpha(Theme::BORDER, 180));
                ui.add_space(4.0);
            }

            Block::TableRow { .. } => unreachable!("yukarıda ele alındı"),
        }
    }

    if !table_rows.is_empty() {
        render_table(ui, &table_rows);
    }
}

/// Satır içi biçimli metni çizer.
fn render_inline(ui: &mut Ui, text: &str, colour: Color32) {
    let spans = parse_inline(text);

    // Tek düz parça ise sarmalama için doğrudan label — horizontal_wrapped
    // uzun metinlerde satır sonlarını bozuyor.
    if spans.len() == 1 {
        if let Span::Text(t) = &spans[0] {
            ui.label(RichText::new(t).color(colour));
            return;
        }
    }

    ui.horizontal_wrapped(|ui| {
        ui.spacing_mut().item_spacing.x = 0.0;
        for span in spans {
            match span {
                Span::Text(t) => {
                    ui.label(RichText::new(t).color(colour));
                }
                Span::Bold(t) => {
                    ui.label(RichText::new(t).strong().color(Theme::FG));
                }
                Span::Italic(t) => {
                    ui.label(RichText::new(t).italics().color(colour));
                }
                Span::Code(t) => {
                    ui.label(
                        RichText::new(format!(" {t} "))
                            .monospace()
                            .background_color(Theme::BG_CODE)
                            .color(Theme::CYAN_BRIGHT),
                    );
                }
            }
        }
    });
}

/// Kod bloğu — çerçeveli, dil etiketli, kopyalanabilir.
fn render_code(ui: &mut Ui, lang: &str, code: &str) {
    ui.add_space(4.0);

    egui::Frame::none()
        .fill(Theme::BG_CODE)
        .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
        .rounding(Theme::RADIUS)
        .inner_margin(8.0)
        .show(ui, |ui| {
            // Üst satır: dil etiketi + kopyala düğmesi.
            ui.horizontal(|ui| {
                if !lang.is_empty() {
                    ui.label(RichText::new(lang).small().color(Theme::FG_DIM));
                }
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui
                        .small_button("copy")
                        .on_hover_text("copy to clipboard")
                        .clicked()
                    {
                        ui.ctx().copy_text(code.to_string());
                    }
                });
            });

            // Kod: yatay kaydırılabilir — uzun satırlar sarmalanmamalı.
            egui::ScrollArea::horizontal()
                .max_height(400.0)
                .show(ui, |ui| {
                    ui.label(RichText::new(code).monospace().color(Theme::FG));
                });
        });

    ui.add_space(4.0);
}

/// Tabloyu ızgara olarak çizer.
fn render_table(ui: &mut Ui, rows: &[(Vec<String>, bool)]) {
    ui.add_space(4.0);

    egui::Frame::none()
        .stroke(egui::Stroke::new(1.0_f32, Theme::BORDER))
        .rounding(Theme::RADIUS)
        .inner_margin(6.0)
        .show(ui, |ui| {
            let columns = rows.iter().map(|(c, _)| c.len()).max().unwrap_or(1);

            egui::Grid::new(ui.next_auto_id())
                .num_columns(columns)
                .spacing([16.0, 4.0])
                .striped(true)
                .show(ui, |ui| {
                    for (cells, header) in rows {
                        for cell in cells {
                            if *header {
                                ui.label(RichText::new(cell).strong().color(Theme::CYAN));
                            } else {
                                ui.label(RichText::new(cell).color(Theme::FG));
                            }
                        }
                        ui.end_row();
                    }
                });
        });

    ui.add_space(4.0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_text_becomes_one_paragraph() {
        let blocks = parse("just some text");
        assert_eq!(blocks, vec![Block::Paragraph("just some text".into())]);
    }

    #[test]
    fn consecutive_lines_join_into_one_paragraph() {
        let blocks = parse("first line\nsecond line");
        assert_eq!(
            blocks,
            vec![Block::Paragraph("first line second line".into())]
        );
    }

    #[test]
    fn blank_line_separates_paragraphs() {
        let blocks = parse("one\n\ntwo");
        assert_eq!(blocks.len(), 2);
    }

    #[test]
    fn code_block_keeps_its_language_and_content() {
        let blocks = parse("```rust\nfn main() {}\n```");
        assert_eq!(
            blocks,
            vec![Block::Code("rust".into(), "fn main() {}".into())]
        );
    }

    #[test]
    fn code_block_preserves_internal_newlines() {
        let blocks = parse("```\nline one\nline two\n```");
        match &blocks[0] {
            Block::Code(_, code) => assert_eq!(code, "line one\nline two"),
            other => panic!("expected code block, got {other:?}"),
        }
    }

    #[test]
    fn unclosed_code_block_still_renders() {
        // A truncated response must not swallow the rest of the text.
        let blocks = parse("```python\nprint('hi')");
        assert_eq!(blocks.len(), 1);
        match &blocks[0] {
            Block::Code(lang, code) => {
                assert_eq!(lang, "python");
                assert!(code.contains("print"));
            }
            other => panic!("expected code block, got {other:?}"),
        }
    }

    #[test]
    fn code_block_without_language_is_fine() {
        let blocks = parse("```\nplain code\n```");
        match &blocks[0] {
            Block::Code(lang, _) => assert!(lang.is_empty()),
            other => panic!("expected code block, got {other:?}"),
        }
    }

    #[test]
    fn headings_carry_their_level() {
        assert_eq!(parse("# Title"), vec![Block::Heading(1, "Title".into())]);
        assert_eq!(parse("### Sub"), vec![Block::Heading(3, "Sub".into())]);
    }

    #[test]
    fn hashtag_without_space_is_not_a_heading() {
        // "#1 problem" is prose, not a heading.
        let blocks = parse("#hashtag not a heading");
        assert!(matches!(blocks[0], Block::Paragraph(_)));
    }

    #[test]
    fn bullet_lists_are_recognised() {
        let blocks = parse("- first\n- second");
        assert_eq!(blocks.len(), 2);
        match &blocks[0] {
            Block::ListItem(_, marker, text) => {
                assert_eq!(marker, "•");
                assert_eq!(text, "first");
            }
            other => panic!("expected list item, got {other:?}"),
        }
    }

    #[test]
    fn numbered_lists_keep_their_numbers() {
        let blocks = parse("1. first\n2. second");
        match &blocks[1] {
            Block::ListItem(_, marker, text) => {
                assert_eq!(marker, "2.");
                assert_eq!(text, "second");
            }
            other => panic!("expected list item, got {other:?}"),
        }
    }

    #[test]
    fn nested_lists_record_their_depth() {
        let blocks = parse("- outer\n  - inner");
        match (&blocks[0], &blocks[1]) {
            (Block::ListItem(a, ..), Block::ListItem(b, ..)) => assert!(b > a),
            other => panic!("expected two list items, got {other:?}"),
        }
    }

    #[test]
    fn quotes_are_recognised() {
        assert_eq!(parse("> quoted"), vec![Block::Quote("quoted".into())]);
    }

    #[test]
    fn horizontal_rules_are_recognised() {
        assert_eq!(parse("---"), vec![Block::Rule]);
        assert_eq!(parse("===="), vec![Block::Rule]);
    }

    #[test]
    fn tables_parse_with_a_header_row() {
        let blocks = parse("| a | b |\n|---|---|\n| 1 | 2 |");
        assert_eq!(blocks.len(), 2, "separator row must not become a block");

        match &blocks[0] {
            Block::TableRow { cells, header } => {
                assert_eq!(cells, &vec!["a".to_string(), "b".to_string()]);
                assert!(header, "the row before the separator is the header");
            }
            other => panic!("expected table row, got {other:?}"),
        }
    }

    // ── Inline formatting ────────────────────────────────────────────────

    #[test]
    fn bold_is_extracted() {
        let spans = parse_inline("hello **world**");
        assert_eq!(
            spans,
            vec![Span::Text("hello ".into()), Span::Bold("world".into())]
        );
    }

    #[test]
    fn italic_is_extracted() {
        let spans = parse_inline("an *emphasis* here");
        assert!(spans.contains(&Span::Italic("emphasis".into())));
    }

    #[test]
    fn inline_code_is_extracted() {
        let spans = parse_inline("run `cargo test` now");
        assert!(spans.contains(&Span::Code("cargo test".into())));
    }

    #[test]
    fn multiplication_is_not_italic() {
        // "2 * 3 * 4" must stay plain text.
        let spans = parse_inline("2 * 3 * 4");
        assert!(
            !spans.iter().any(|s| matches!(s, Span::Italic(_))),
            "spaced asterisks are multiplication, not emphasis: {spans:?}"
        );
    }

    #[test]
    fn unmatched_markers_stay_literal() {
        let spans = parse_inline("this ** is not bold");
        assert_eq!(spans.len(), 1);
        assert!(matches!(&spans[0], Span::Text(t) if t.contains("**")));
    }

    #[test]
    fn empty_input_produces_nothing() {
        assert!(parse("").is_empty());
        assert!(parse_inline("").is_empty());
    }

    #[test]
    fn turkish_text_survives_parsing() {
        let blocks = parse("Merhaba **dünya** — çğıöşü");
        match &blocks[0] {
            Block::Paragraph(text) => {
                assert!(text.contains("çğıöşü"));
                let spans = parse_inline(text);
                assert!(spans.contains(&Span::Bold("dünya".into())));
            }
            other => panic!("expected paragraph, got {other:?}"),
        }
    }

    #[test]
    fn realistic_model_answer_parses_into_expected_blocks() {
        let answer = "Here's how to do it:\n\n\
                      1. Open the file\n\
                      2. Add this line\n\n\
                      ```rust\n\
                      println!(\"hello\");\n\
                      ```\n\n\
                      That's **all** you need.";

        let blocks = parse(answer);

        assert!(blocks.iter().any(|b| matches!(b, Block::Paragraph(_))));
        assert_eq!(
            blocks
                .iter()
                .filter(|b| matches!(b, Block::ListItem(..)))
                .count(),
            2
        );
        assert!(blocks.iter().any(|b| matches!(b, Block::Code(..))));
    }

    #[test]
    fn no_content_is_lost_for_plain_prose() {
        let text = "First sentence. Second sentence. Third one.";
        let blocks = parse(text);
        match &blocks[0] {
            Block::Paragraph(p) => assert_eq!(p, text),
            other => panic!("expected paragraph, got {other:?}"),
        }
    }
}
