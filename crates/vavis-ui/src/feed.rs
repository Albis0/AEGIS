//! Feed — ekranda akan satırlar.
//!
//! Bilinçli olarak **arayüzden bağımsız veri yapısı**: F2'de LLM'den akan
//! cevap buraya `push_delta` ile harf harf eklenecek. UI değişse de bu kalır.

use std::collections::VecDeque;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Speaker {
    User,
    Assistant,
    System,
    Error,
    /// Bir tool çalıştırıldı — kullanıcı ne olduğunu görsün.
    Tool,
}

impl Speaker {
    /// Satır başındaki işaret — terminal görünümünün ana öğesi.
    pub fn prefix(self) -> &'static str {
        match self {
            Self::User => "›",
            Self::Assistant => "◆",
            Self::System => "·",
            Self::Error => "✗",
            Self::Tool => "⚙",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Line {
    pub speaker: Speaker,
    pub text: String,
}

/// Sabit kapasiteli feed — sınırsız büyüyüp RAM yemez.
pub struct Feed {
    lines: VecDeque<Line>,
    capacity: usize,
    /// Yeni içerik geldi mi? UI bunu görüp aşağı kaydırır.
    dirty: bool,
}

impl Feed {
    pub fn new(capacity: usize) -> Self {
        Self {
            lines: VecDeque::with_capacity(capacity.min(256)),
            capacity: capacity.max(1),
            dirty: false,
        }
    }

    pub fn push(&mut self, speaker: Speaker, text: impl Into<String>) {
        if self.lines.len() >= self.capacity {
            self.lines.pop_front();
        }
        self.lines.push_back(Line {
            speaker,
            text: text.into(),
        });
        self.dirty = true;
    }

    /// Akan cevap için: son satır aynı konuşmacıya aitse ona ekle, değilse yeni aç.
    /// F2'de token akışı bunu kullanacak.
    pub fn push_delta(&mut self, speaker: Speaker, chunk: &str) {
        match self.lines.back_mut() {
            Some(last) if last.speaker == speaker => last.text.push_str(chunk),
            _ => self.push(speaker, chunk.to_string()),
        }
        self.dirty = true;
    }

    pub fn iter(&self) -> impl Iterator<Item = &Line> {
        self.lines.iter()
    }

    pub fn len(&self) -> usize {
        self.lines.len()
    }

    pub fn is_empty(&self) -> bool {
        self.lines.is_empty()
    }

    pub fn clear(&mut self) {
        self.lines.clear();
        self.dirty = true;
    }

    /// Kirli bayrağını okuyup sıfırlar — UI her karede bir kez çağırır.
    pub fn take_dirty(&mut self) -> bool {
        std::mem::take(&mut self.dirty)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_appends_lines() {
        let mut feed = Feed::new(10);
        feed.push(Speaker::User, "selam");
        feed.push(Speaker::Assistant, "merhaba");
        assert_eq!(feed.len(), 2);
    }

    #[test]
    fn capacity_drops_oldest() {
        let mut feed = Feed::new(3);
        for i in 0..5 {
            feed.push(Speaker::System, format!("satır {i}"));
        }
        assert_eq!(feed.len(), 3);
        assert_eq!(feed.iter().next().unwrap().text, "satır 2"); // 0 ve 1 düştü
    }

    #[test]
    fn delta_merges_into_same_speaker() {
        let mut feed = Feed::new(10);
        feed.push_delta(Speaker::Assistant, "mer");
        feed.push_delta(Speaker::Assistant, "haba");
        assert_eq!(feed.len(), 1);
        assert_eq!(feed.iter().next().unwrap().text, "merhaba");
    }

    #[test]
    fn delta_starts_new_line_on_speaker_change() {
        let mut feed = Feed::new(10);
        feed.push_delta(Speaker::Assistant, "cevap");
        feed.push_delta(Speaker::User, "soru");
        assert_eq!(feed.len(), 2);
    }

    #[test]
    fn dirty_flag_is_consumed_once() {
        let mut feed = Feed::new(10);
        feed.push(Speaker::System, "x");
        assert!(feed.take_dirty());
        assert!(!feed.take_dirty()); // ikinci okuyuşta temiz
    }
}
