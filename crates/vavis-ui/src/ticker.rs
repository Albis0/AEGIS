//! Otomasyon zamanlayıcısı.
//!
//! Her dakika kurulu otomasyonları kontrol eder; tetiklenmesi gerekeni
//! UI'ya bildirir. UI bunu asistana bir istek olarak gönderir.
//!
//! # Neden ayrı thread
//!
//! UI karesi içinde saat kontrolü yapmak, pencere kapalıyken (minimize)
//! kare üretilmediği için otomasyonu kaçırır. Ayrı thread her koşulda çalışır.
//!
//! # Neden dakikada bir
//!
//! Asistan otomasyonları için saniye hassasiyeti gereksiz. Dakikada bir
//! kontrol hem CPU dostu hem yeterli.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{Arc, Mutex};
use vavis_core::Store;

/// Tetiklenen bir otomasyon.
#[derive(Debug, Clone, PartialEq)]
pub struct Fired {
    pub id: i64,
    /// Asistana gönderilecek istek.
    pub prompt: String,
    /// İnsan okunur tetikleyici açıklaması.
    pub trigger: String,
}

pub struct Ticker {
    running: Arc<AtomicBool>,
    rx: Receiver<Fired>,
}

impl Ticker {
    /// Zamanlayıcıyı başlatır.
    ///
    /// `measure`: koşullu tetikleyiciler için ölçüm sağlayan geri çağırma.
    /// Pil ve CPU değerlerini döner (`(battery, cpu)`), ölçemezse `None`.
    pub fn start(
        store: Arc<Mutex<Store>>,
        ctx: Option<egui::Context>,
        measure: impl Fn() -> (Option<u32>, Option<u32>) + Send + 'static,
    ) -> Self {
        let (tx, rx) = std::sync::mpsc::channel();
        let running = Arc::new(AtomicBool::new(true));
        let thread_running = running.clone();

        std::thread::spawn(move || {
            tracing::info!("otomasyon zamanlayıcısı başladı");

            while thread_running.load(Ordering::Relaxed) {
                // Uykuyu parçalara böl ki kapanış hızlı olsun —
                // 60 saniyelik tek uyku, çıkışta o kadar bekletirdi.
                for _ in 0..60 {
                    if !thread_running.load(Ordering::Relaxed) {
                        return;
                    }
                    std::thread::sleep(std::time::Duration::from_secs(1));
                }

                let (battery, cpu) = measure();
                check_automations(&store, &tx, battery, cpu);

                if let Some(c) = &ctx {
                    c.request_repaint();
                }
            }
            tracing::info!("otomasyon zamanlayıcısı durdu");
        });

        Self { running, rx }
    }

    /// Tetiklenen otomasyonları alır — bloklamaz.
    pub fn poll(&self) -> Vec<Fired> {
        self.rx.try_iter().collect()
    }
}

impl Drop for Ticker {
    fn drop(&mut self) {
        self.running.store(false, Ordering::Relaxed);
    }
}

/// Kurulu otomasyonları kontrol eder, tetiklenenleri bildirir.
///
/// Ayrı fonksiyon: thread olmadan test edilebilsin.
pub fn check_automations(
    store: &Arc<Mutex<Store>>,
    tx: &Sender<Fired>,
    battery: Option<u32>,
    cpu: Option<u32>,
) -> usize {
    use vavis_core::Trigger;

    let now = now_unix();
    let (hour, minute) = local_time();

    let automations = {
        let guard = store.lock().unwrap_or_else(|e| e.into_inner());
        guard.all_automations().unwrap_or_default()
    };

    let mut fired_count = 0;

    for automation in automations {
        // Koşullu tetikleyiciler kendi ölçümlerini alır.
        let condition = match automation.trigger {
            Trigger::BatteryBelow { .. } => battery,
            Trigger::CpuAbove { .. } => cpu,
            _ => None,
        };

        if !automation.should_fire(now, hour, minute, condition) {
            continue;
        }

        tracing::info!(id = automation.id, prompt = %automation.prompt, "otomasyon tetiklendi");

        // Önce tetiklendi işaretle: gönderim başarısız olsa bile
        // aynı otomasyon döngüde tekrar tekrar tetiklenmesin.
        {
            let guard = store.lock().unwrap_or_else(|e| e.into_inner());
            if let Err(e) = guard.mark_automation_fired(automation.id, now) {
                tracing::warn!(%e, "tetiklenme kaydedilemedi");
            }
        }

        let _ = tx.send(Fired {
            id: automation.id,
            prompt: automation.prompt.clone(),
            trigger: automation.trigger.describe(),
        });
        fired_count += 1;
    }

    fired_count
}

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Yerel saat ve dakika.
fn local_time() -> (u32, u32) {
    let now = chrono::Local::now();
    use chrono::Timelike;
    (now.hour(), now.minute())
}

#[cfg(test)]
mod tests {
    use super::*;
    use vavis_core::Trigger;

    fn store() -> Arc<Mutex<Store>> {
        Arc::new(Mutex::new(Store::open_in_memory().unwrap()))
    }

    #[test]
    fn no_automations_means_nothing_fires() {
        let s = store();
        let (tx, rx) = std::sync::mpsc::channel();

        assert_eq!(check_automations(&s, &tx, None, None), 0);
        assert!(rx.try_recv().is_err());
    }

    #[test]
    fn battery_automation_fires_when_low() {
        let s = store();
        {
            let guard = s.lock().unwrap();
            guard
                .add_automation("pili şarj et", &Trigger::BatteryBelow { percent: 20 })
                .unwrap();
        }
        let (tx, rx) = std::sync::mpsc::channel();

        // %15 → eşiğin altında.
        assert_eq!(check_automations(&s, &tx, Some(15), None), 1);

        let fired = rx.try_recv().expect("tetiklenmeliydi");
        assert_eq!(fired.prompt, "pili şarj et");
        assert!(fired.trigger.contains("pil"));
    }

    #[test]
    fn battery_automation_stays_quiet_when_charged() {
        let s = store();
        {
            let guard = s.lock().unwrap();
            guard
                .add_automation("uyar", &Trigger::BatteryBelow { percent: 20 })
                .unwrap();
        }
        let (tx, _rx) = std::sync::mpsc::channel();

        assert_eq!(check_automations(&s, &tx, Some(80), None), 0);
    }

    #[test]
    fn firing_is_recorded_so_it_does_not_repeat() {
        let s = store();
        {
            let guard = s.lock().unwrap();
            guard
                .add_automation("uyar", &Trigger::BatteryBelow { percent: 20 })
                .unwrap();
        }
        let (tx, _rx) = std::sync::mpsc::channel();

        assert_eq!(check_automations(&s, &tx, Some(10), None), 1);
        // Koşul hâlâ geçerli ama az önce tetiklendi.
        assert_eq!(
            check_automations(&s, &tx, Some(10), None),
            0,
            "aynı otomasyon üst üste tetiklenmemeli"
        );
    }

    #[test]
    fn disabled_automations_are_skipped() {
        let s = store();
        let id = {
            let guard = s.lock().unwrap();
            let id = guard
                .add_automation("uyar", &Trigger::BatteryBelow { percent: 20 })
                .unwrap();
            guard.set_automation_enabled(id, false).unwrap();
            id
        };
        let (tx, _rx) = std::sync::mpsc::channel();

        assert_eq!(check_automations(&s, &tx, Some(5), None), 0);
        let _ = id;
    }

    #[test]
    fn cpu_automation_uses_the_cpu_measurement_not_battery() {
        let s = store();
        {
            let guard = s.lock().unwrap();
            guard
                .add_automation("cpu yüksek", &Trigger::CpuAbove { percent: 80 })
                .unwrap();
        }
        let (tx, _rx) = std::sync::mpsc::channel();

        // Pil düşük ama CPU düşük → tetiklenmemeli.
        assert_eq!(check_automations(&s, &tx, Some(5), Some(10)), 0);
        // CPU yüksek → tetiklenmeli.
        assert_eq!(check_automations(&s, &tx, Some(90), Some(95)), 1);
    }

    #[test]
    fn missing_measurement_prevents_conditional_firing() {
        let s = store();
        {
            let guard = s.lock().unwrap();
            guard
                .add_automation("uyar", &Trigger::BatteryBelow { percent: 20 })
                .unwrap();
        }
        let (tx, _rx) = std::sync::mpsc::channel();

        // Masaüstünde pil yok → ölçüm None → tetiklenmez.
        assert_eq!(check_automations(&s, &tx, None, None), 0);
    }

    #[test]
    fn local_time_is_within_valid_ranges() {
        let (h, m) = local_time();
        assert!(h < 24, "saat {h}");
        assert!(m < 60, "dakika {m}");
    }

    #[test]
    fn ticker_stops_when_dropped() {
        let s = store();
        let ticker = Ticker::start(s, None, || (None, None));
        assert!(ticker.poll().is_empty());
        drop(ticker); // panik olmamalı
    }
}
