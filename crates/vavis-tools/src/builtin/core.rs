//! Çekirdek tool'lar — her alanla birlikte sunulan temel yetenekler.

use crate::tool::{arg_str, Domain, Param, Tool, ToolOutcome};
use serde_json::Value;

/// Şu anki tarih/saat.
///
/// Neden tool: modeller bugünün tarihini bilmez (eğitim kesme tarihinde
/// takılırlar). "Bugün ayın kaçı" sorusu tool olmadan yanlış cevaplanır.
pub struct Now;

impl Tool for Now {
    fn name(&self) -> &'static str {
        "simdiki_zaman"
    }

    fn description(&self) -> &'static str {
        "Şu anki tarih ve saati verir. Tarih/saat/gün sorulduğunda kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Core
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["saat", "tarih", "gün", "bugün", "zaman", "time", "date"]
    }

    fn run(&self, _args: &Value) -> ToolOutcome {
        let now = chrono::Local::now();
        let gun = match now.format("%w").to_string().as_str() {
            "0" => "Pazar",
            "1" => "Pazartesi",
            "2" => "Salı",
            "3" => "Çarşamba",
            "4" => "Perşembe",
            "5" => "Cuma",
            _ => "Cumartesi",
        };
        ToolOutcome::ok(format!("{} {}", now.format("%Y-%m-%d %H:%M"), gun))
    }
}

/// Basit hesaplama.
///
/// Neden tool: LLM'ler aritmetikte güvenilmez. Küçük bir hesap makinesi
/// büyük modelden daha doğru.
pub struct Calculate;

impl Tool for Calculate {
    fn name(&self) -> &'static str {
        "hesapla"
    }

    fn description(&self) -> &'static str {
        "Aritmetik ifade hesaplar. Örnek: '12 * (3 + 4)'. Sayısal işlemler için kullan."
    }

    fn domain(&self) -> Domain {
        Domain::Core
    }

    fn params(&self) -> Vec<Param> {
        vec![Param::required(
            "ifade",
            "Hesaplanacak ifade, örn: 15 * 3 + 2",
        )]
    }

    fn keywords(&self) -> &'static [&'static str] {
        &["hesapla", "topla", "çarp", "böl", "kaç eder", "calculate"]
    }

    fn run(&self, args: &Value) -> ToolOutcome {
        let Some(expr) = arg_str(args, "ifade") else {
            return ToolOutcome::err("ifade parametresi gerekli");
        };
        match eval_expr(expr) {
            Some(result) => {
                // Tam sayıysa ondalık gösterme.
                if result.fract() == 0.0 && result.abs() < 1e15 {
                    ToolOutcome::ok(format!("{}", result as i64))
                } else {
                    ToolOutcome::ok(format!("{result}"))
                }
            }
            None => ToolOutcome::err(format!("'{expr}' hesaplanamadı")),
        }
    }
}

/// Küçük bir ifade değerlendirici: + - * / % ( ) ve ondalık sayılar.
///
/// Dışarıdan kod çalıştırmıyoruz — sadece aritmetik. Özyinelemeli inişli
/// ayrıştırma, bağımlılık yok.
fn eval_expr(input: &str) -> Option<f64> {
    // Boşlukla ayrılmış iki sayı ("2 3") aritmetik ifade DEĞİLDİR — boşlukları
    // körlemesine silersek "23" olur ve sessizce yanlış cevap döneriz.
    // Sayı-boşluk-sayı örüntüsünü baştan reddet.
    let mut prev_was_digit = false;
    let mut gap_after_digit = false;
    for c in input.chars() {
        if c.is_whitespace() {
            gap_after_digit = prev_was_digit;
        } else {
            if gap_after_digit && (c.is_ascii_digit() || c == '.') {
                return None; // "2 3" gibi — operatör eksik
            }
            prev_was_digit = c.is_ascii_digit() || c == '.';
            gap_after_digit = false;
        }
    }

    let tokens: Vec<char> = input.chars().filter(|c| !c.is_whitespace()).collect();
    let mut pos = 0;
    let value = parse_sum(&tokens, &mut pos)?;
    // Artık karakter kaldıysa ifade bozuktur.
    if pos == tokens.len() {
        Some(value)
    } else {
        None
    }
}

fn parse_sum(t: &[char], pos: &mut usize) -> Option<f64> {
    let mut left = parse_product(t, pos)?;
    while *pos < t.len() {
        match t[*pos] {
            '+' => {
                *pos += 1;
                left += parse_product(t, pos)?;
            }
            '-' => {
                *pos += 1;
                left -= parse_product(t, pos)?;
            }
            _ => break,
        }
    }
    Some(left)
}

fn parse_product(t: &[char], pos: &mut usize) -> Option<f64> {
    let mut left = parse_atom(t, pos)?;
    while *pos < t.len() {
        match t[*pos] {
            '*' => {
                *pos += 1;
                left *= parse_atom(t, pos)?;
            }
            '/' => {
                *pos += 1;
                let d = parse_atom(t, pos)?;
                if d == 0.0 {
                    return None; // sıfıra bölme
                }
                left /= d;
            }
            '%' => {
                *pos += 1;
                let d = parse_atom(t, pos)?;
                if d == 0.0 {
                    return None;
                }
                left %= d;
            }
            _ => break,
        }
    }
    Some(left)
}

fn parse_atom(t: &[char], pos: &mut usize) -> Option<f64> {
    if *pos >= t.len() {
        return None;
    }
    match t[*pos] {
        '(' => {
            *pos += 1;
            let v = parse_sum(t, pos)?;
            if *pos >= t.len() || t[*pos] != ')' {
                return None; // kapanmayan parantez
            }
            *pos += 1;
            Some(v)
        }
        '-' => {
            *pos += 1;
            Some(-parse_atom(t, pos)?)
        }
        '+' => {
            *pos += 1;
            parse_atom(t, pos)
        }
        c if c.is_ascii_digit() || c == '.' => {
            let start = *pos;
            while *pos < t.len() && (t[*pos].is_ascii_digit() || t[*pos] == '.') {
                *pos += 1;
            }
            t[start..*pos].iter().collect::<String>().parse().ok()
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn now_returns_formatted_datetime() {
        let out = Now.run(&Value::Null);
        assert!(out.ok);
        // "2026-08-28 10:30 Cuma" biçimi
        assert!(out.content.contains('-') && out.content.contains(':'));
    }

    #[test]
    fn calculator_handles_basic_arithmetic() {
        for (expr, expected) in [
            ("2+2", "4"),
            ("10-3", "7"),
            ("6*7", "42"),
            ("100/4", "25"),
            ("10%3", "1"),
        ] {
            let args = serde_json::json!({"ifade": expr});
            let out = Calculate.run(&args);
            assert!(out.ok, "{expr} başarısız");
            assert_eq!(out.content, expected, "{expr}");
        }
    }

    #[test]
    fn calculator_respects_precedence_and_parens() {
        let args = serde_json::json!({"ifade": "2+3*4"});
        assert_eq!(Calculate.run(&args).content, "14");

        let args = serde_json::json!({"ifade": "(2+3)*4"});
        assert_eq!(Calculate.run(&args).content, "20");
    }

    #[test]
    fn calculator_handles_negatives_and_decimals() {
        let args = serde_json::json!({"ifade": "-5 + 2.5"});
        assert_eq!(Calculate.run(&args).content, "-2.5");
    }

    #[test]
    fn calculator_rejects_division_by_zero() {
        let args = serde_json::json!({"ifade": "1/0"});
        assert!(!Calculate.run(&args).ok);
    }

    #[test]
    fn calculator_rejects_malformed_input() {
        for bad in ["2+", "(2+3", "abc", "2 3", ""] {
            let args = serde_json::json!({"ifade": bad});
            assert!(!Calculate.run(&args).ok, "'{bad}' reddedilmeliydi");
        }
    }

    #[test]
    fn calculator_does_not_execute_arbitrary_text() {
        // Kod çalıştırma yok — sadece aritmetik.
        let args = serde_json::json!({"ifade": "system('rm -rf /')"});
        assert!(!Calculate.run(&args).ok);
    }
}
