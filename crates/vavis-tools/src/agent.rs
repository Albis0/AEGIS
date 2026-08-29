//! Ajan döngüsü — model ↔ tool gidiş gelişi.
//!
//! Akış:
//!   1. Mesaja göre tool'lar seçilir (en fazla `MAX_TOOLS`).
//!   2. Model çağrılır; tool istemezse cevap biter.
//!   3. Tool istediyse: izin kapısı → çalıştır → sonucu modele ver → 2'ye dön.
//!
//! **Tur sınırı** var: model sonsuza kadar tool çağıramaz.
//!
//! Eski projede bu mantık 247 satırlık `agent-loop.ts` içindeydi ve
//! Electron'a bağlıydı; burada saf mantık, test edilebilir.

use crate::permission::{Decision, PermissionGate};
use crate::selection;
use crate::tool::{Registry, Risk, ToolOutcome};
use vavis_brain::{Message, ToolCall};

/// Bir istekte en fazla kaç model↔tool turu dönülür.
pub const MAX_STEPS: usize = 5;

/// Aynı tool aynı argümanlarla üst üste bu kadar çağrılırsa döngü sayılır.
const REPEAT_LIMIT: usize = 2;

/// Ajanın dış dünyayla konuşma şekli.
///
/// Trait olarak tanımlı ki test sahte bir uygulamayla koşabilsin — Electron'a
/// bağlı olmayan mantığın tamamı böylece doğrulanabiliyor.
pub trait AgentHost {
    /// Kullanıcıya onay sor.
    fn ask_approval(
        &mut self,
        tool: &str,
        args: &str,
        reason: crate::permission::ApprovalReason,
    ) -> Approval;

    /// Bir tool çalıştırıldığını bildir (arayüzde göstermek için).
    fn on_tool_start(&mut self, _tool: &str, _args: &str) {}

    /// Tool sonucu geldi.
    fn on_tool_result(&mut self, _tool: &str, _outcome: &ToolOutcome) {}
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Approval {
    Allow,
    AllowAlways,
    Deny,
}

/// Tekrarlanan tool çağrılarını yakalar.
///
/// Eski projedeki "loop guard" fikri: model aynı hatayı tekrarlayıp duruyorsa
/// döngüyü kes. Tekrarı yakalar; **çeşitliliği** izin kapısındaki yıkıcı bütçe
/// yakalar (ikisi farklı sorunlar).
#[derive(Default)]
struct LoopGuard {
    seen: Vec<(String, String)>,
}

impl LoopGuard {
    fn check(&mut self, tool: &str, args: &str) -> bool {
        let key = (tool.to_string(), args.to_string());
        let count = self.seen.iter().filter(|k| **k == key).count();
        self.seen.push(key);
        count < REPEAT_LIMIT
    }
}

/// Tool çağrısını çalıştırır — izin kapısı ve döngü koruması dahil.
///
/// Modelin çağrısını gerçek etkiye çeviren tek nokta burası.
pub struct Agent {
    pub registry: Registry,
    pub gate: PermissionGate,
    guard: LoopGuard,
}

impl Agent {
    pub fn new(registry: Registry) -> Self {
        Self {
            registry,
            gate: PermissionGate::new(),
            guard: LoopGuard::default(),
        }
    }

    /// Yeni bir kullanıcı isteği başlıyor.
    pub fn start_run(&mut self) {
        self.gate.start_run();
        self.guard = LoopGuard::default();
    }

    /// Bu mesaj için modele sunulacak tool şemaları.
    pub fn tools_for(&self, message: &str) -> Vec<serde_json::Value> {
        selection::select_tools(&self.registry, message)
    }

    /// Modelin istediği tool çağrılarını çalıştırır, modele dönecek
    /// tool sonucu mesajlarını üretir.
    pub fn execute_calls<H: AgentHost>(
        &mut self,
        calls: &[ToolCall],
        host: &mut H,
    ) -> Vec<Message> {
        let mut results = Vec::new();

        for call in calls {
            let name = &call.function.name;
            let args_json = &call.function.arguments;

            let Some(tool) = self.registry.get(name) else {
                // Model olmayan bir tool uydurdu — sessizce yutma, modele söyle.
                results.push(Message::tool_result(
                    &call.id,
                    format!("HATA: '{name}' diye bir araç yok"),
                ));
                continue;
            };
            let risk = tool.risk();

            if !self.guard.check(name, args_json) {
                results.push(Message::tool_result(
                    &call.id,
                    format!(
                        "HATA: '{name}' aynı argümanlarla tekrar tekrar çağrıldı — döngü kesildi"
                    ),
                ));
                continue;
            }

            // İzin kapısı.
            match self.gate.check(name, risk) {
                Decision::Allow => {}
                Decision::Ask(reason) => match host.ask_approval(name, args_json, reason) {
                    Approval::Deny => {
                        results.push(Message::tool_result(
                            &call.id,
                            "Kullanıcı bu işlemi reddetti.".to_string(),
                        ));
                        continue;
                    }
                    Approval::AllowAlways => {
                        self.gate.grant_always(name.clone());
                    }
                    Approval::Allow => {}
                },
            }

            // Argümanları çöz — bozuk JSON'da modele net hata dön.
            let args: serde_json::Value = match serde_json::from_str(args_json) {
                Ok(v) => v,
                Err(_) if args_json.trim().is_empty() => serde_json::json!({}),
                Err(e) => {
                    results.push(Message::tool_result(
                        &call.id,
                        format!("HATA: argümanlar geçerli JSON değil: {e}"),
                    ));
                    continue;
                }
            };

            host.on_tool_start(name, args_json);
            let outcome = tool.run(&args);
            self.gate.record_execution(risk);
            host.on_tool_result(name, &outcome);

            let prefix = if outcome.ok { "" } else { "HATA: " };
            results.push(Message::tool_result(
                &call.id,
                format!("{prefix}{}", outcome.content),
            ));
        }

        results
    }
}

/// Tool çalıştırma sırasında risk bilgisi — arayüz gösterimi için.
pub fn describe_risk(risk: Risk) -> &'static str {
    match risk {
        Risk::Safe => "güvenli",
        Risk::Moderate => "değişiklik yapar",
        Risk::Destructive => "geri alınamaz",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builtin;
    use crate::permission::ApprovalReason;
    use vavis_brain::FunctionCall;

    /// Her şeye izin veren sahte ana bilgisayar.
    #[derive(Default)]
    struct AllowAll {
        approvals_asked: Vec<String>,
        tools_run: Vec<String>,
    }

    impl AgentHost for AllowAll {
        fn ask_approval(&mut self, tool: &str, _args: &str, _r: ApprovalReason) -> Approval {
            self.approvals_asked.push(tool.to_string());
            Approval::Allow
        }
        fn on_tool_start(&mut self, tool: &str, _args: &str) {
            self.tools_run.push(tool.to_string());
        }
    }

    /// Her şeyi reddeden sahte ana bilgisayar.
    #[derive(Default)]
    struct DenyAll;
    impl AgentHost for DenyAll {
        fn ask_approval(&mut self, _t: &str, _a: &str, _r: ApprovalReason) -> Approval {
            Approval::Deny
        }
    }

    fn agent() -> Agent {
        let mut reg = Registry::new();
        builtin::register_all(&mut reg);
        Agent::new(reg)
    }

    fn call(name: &str, args: &str) -> ToolCall {
        ToolCall {
            id: format!("call_{name}"),
            kind: "function".into(),
            function: FunctionCall {
                name: name.into(),
                arguments: args.into(),
            },
        }
    }

    #[test]
    fn safe_tool_runs_without_asking() {
        let mut agent = agent();
        let mut host = AllowAll::default();

        let results = agent.execute_calls(&[call("simdiki_zaman", "{}")], &mut host);

        assert_eq!(results.len(), 1);
        assert!(
            host.approvals_asked.is_empty(),
            "güvenli tool onay sormamalı"
        );
        assert!(host.tools_run.contains(&"simdiki_zaman".to_string()));
    }

    #[test]
    fn destructive_tool_asks_for_approval() {
        let mut agent = agent();
        let mut host = AllowAll::default();

        agent.execute_calls(&[call("unut", r#"{"numara":"1"}"#)], &mut host);

        assert_eq!(
            host.approvals_asked,
            vec!["unut"],
            "yıkıcı tool onay sormalı"
        );
    }

    #[test]
    fn denied_tool_is_not_executed() {
        let mut agent = agent();
        let mut host = DenyAll;

        let results = agent.execute_calls(&[call("unut", r#"{"numara":"1"}"#)], &mut host);

        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("reddetti"));
    }

    #[test]
    fn unknown_tool_returns_error_to_model() {
        let mut agent = agent();
        let mut host = AllowAll::default();

        let results = agent.execute_calls(&[call("uydurma_tool", "{}")], &mut host);

        assert!(
            results[0].content.contains("yok"),
            "model bilgilendirilmeli"
        );
        assert!(host.tools_run.is_empty());
    }

    #[test]
    fn malformed_arguments_produce_clear_error() {
        let mut agent = agent();
        let mut host = AllowAll::default();

        let results = agent.execute_calls(&[call("hesapla", "{bozuk")], &mut host);

        assert!(
            results[0].content.contains("JSON"),
            "içerik: {}",
            results[0].content
        );
    }

    #[test]
    fn empty_arguments_are_treated_as_empty_object() {
        let mut agent = agent();
        let mut host = AllowAll::default();

        let results = agent.execute_calls(&[call("simdiki_zaman", "")], &mut host);
        assert!(
            !results[0].content.starts_with("HATA"),
            "{}",
            results[0].content
        );
    }

    #[test]
    fn repeated_identical_call_is_cut_off() {
        let mut agent = agent();
        let mut host = AllowAll::default();
        let c = call("hesapla", r#"{"ifade":"1+1"}"#);

        // İlk iki çağrı geçer, üçüncüsü döngü sayılır.
        agent.execute_calls(std::slice::from_ref(&c), &mut host);
        agent.execute_calls(std::slice::from_ref(&c), &mut host);
        let third = agent.execute_calls(std::slice::from_ref(&c), &mut host);

        assert!(
            third[0].content.contains("döngü"),
            "içerik: {}",
            third[0].content
        );
    }

    #[test]
    fn different_arguments_are_not_a_loop() {
        let mut agent = agent();
        let mut host = AllowAll::default();

        for expr in ["1+1", "2+2", "3+3", "4+4"] {
            let c = call("hesapla", &format!(r#"{{"ifade":"{expr}"}}"#));
            let r = agent.execute_calls(&[c], &mut host);
            assert!(!r[0].content.contains("döngü"), "{expr} döngü sayılmamalı");
        }
    }

    #[test]
    fn allow_always_stops_further_prompts() {
        let mut agent = agent();
        let mut host = AllowAll::default();

        // İlk çağrıda "hep izin ver" seçilmiş gibi davran.
        struct AlwaysGrant(usize);
        impl AgentHost for AlwaysGrant {
            fn ask_approval(&mut self, _t: &str, _a: &str, _r: ApprovalReason) -> Approval {
                self.0 += 1;
                Approval::AllowAlways
            }
        }
        let mut granting = AlwaysGrant(0);

        agent.execute_calls(&[call("unut", r#"{"numara":"1"}"#)], &mut granting);
        agent.execute_calls(&[call("unut", r#"{"numara":"2"}"#)], &mut granting);

        assert_eq!(granting.0, 1, "ikinci çağrıda tekrar sorulmamalı");
        let _ = &mut host;
    }

    #[test]
    fn tool_selection_stays_within_limit() {
        let agent = agent();
        let tools = agent.tools_for("dosya sistem ses web hatırla cpu disk klasör oku yaz");
        assert!(tools.len() <= selection::MAX_TOOLS);
    }

    #[test]
    fn greeting_offers_no_tools() {
        let agent = agent();
        assert!(agent.tools_for("merhaba").is_empty());
    }

    #[test]
    fn start_run_resets_loop_guard() {
        let mut agent = agent();
        let mut host = AllowAll::default();
        let c = call("hesapla", r#"{"ifade":"1+1"}"#);

        agent.execute_calls(std::slice::from_ref(&c), &mut host);
        agent.execute_calls(std::slice::from_ref(&c), &mut host);

        agent.start_run(); // yeni istek

        let after = agent.execute_calls(std::slice::from_ref(&c), &mut host);
        assert!(
            !after[0].content.contains("döngü"),
            "yeni istekte sayaç sıfırlanmalı"
        );
    }
    /// Tools must survive being called from inside an async runtime.
    ///
    /// This is not hypothetical: the shell runs an agent turn with
    /// `runtime.block_on(run_turn(..))`, and `run_turn` calls `tool.run()`
    /// from inside that. Every network tool used to build its own runtime and
    /// `block_on` it, which panics with "Cannot start a runtime from within a
    /// runtime" -- killing the worker thread, so the request never finished
    /// and the user simply never got a reply.
    ///
    /// A registry tool is driven here through the same path the agent uses.
    /// `hesapla` needs no network, so this stays a unit test; what is being
    /// checked is the calling context, not the tool.
    #[test]
    fn tools_run_from_inside_a_runtime() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime");

        let results = runtime.block_on(async {
            let mut agent = agent();
            let mut host = AllowAll::default();
            let c = call("hesapla", r#"{"ifade":"6*7"}"#);
            agent.execute_calls(std::slice::from_ref(&c), &mut host)
        });

        assert!(
            results[0].content.contains("42"),
            "tool should run inside a runtime, got: {}",
            results[0].content
        );
    }
}
