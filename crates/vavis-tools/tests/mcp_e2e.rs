//! End-to-end MCP: a real child process, a real handshake, real tool calls.
//!
//! The mock server in `fixtures/` behaves the way a stdio MCP server does,
//! including printing a non-JSON banner line first — which is exactly the
//! kind of thing that breaks a client that assumes every line is a message.
//!
//! Needs `node` on PATH. Ignored by default so the suite stays hermetic; run
//! with `cargo test -p vavis-tools --test mcp_e2e -- --ignored --nocapture`.

use vavis_tools::mcp::{self, ServerConfig, Transport};
use vavis_tools::Registry;

fn fixture() -> String {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join("mock_mcp_server.js");
    path.to_string_lossy().to_string()
}

fn config(id: &str, disabled: Vec<String>) -> ServerConfig {
    ServerConfig {
        id: id.to_string(),
        transport: Transport::Stdio {
            command: "node".into(),
            args: vec![fixture()],
            env: vec![],
        },
        disabled,
        enabled: true,
    }
}

#[test]
#[ignore = "needs node on PATH"]
fn a_stdio_server_connects_and_publishes_its_tools() {
    let mut registry = Registry::new();
    let status = mcp::connect(&mut registry, &config("mock", vec![]), "");

    assert!(status.connected, "did not connect: {:?}", status.error);
    assert_eq!(status.tools, vec!["echo", "boom"]);

    // Names are prefixed so two servers can both publish `echo`.
    assert!(registry.get("mock_echo").is_some(), "tool not registered");
    assert!(registry.get("echo").is_none(), "must be prefixed");

    mcp::disconnect_all();
}

#[test]
#[ignore = "needs node on PATH"]
fn a_tool_call_reaches_the_server_and_comes_back() {
    let mut registry = Registry::new();
    assert!(mcp::connect(&mut registry, &config("mock", vec![]), "").connected);

    let tool = registry.get("mock_echo").expect("registered");
    let outcome = tool.run(&serde_json::json!({ "text": "merhaba" }));

    assert!(outcome.ok, "{}", outcome.content);
    assert_eq!(outcome.content, "echo: merhaba");

    mcp::disconnect_all();
}

#[test]
#[ignore = "needs node on PATH"]
fn a_server_side_error_is_reported_as_a_failure() {
    let mut registry = Registry::new();
    assert!(mcp::connect(&mut registry, &config("mock", vec![]), "").connected);

    let tool = registry.get("mock_boom").expect("registered");
    let outcome = tool.run(&serde_json::json!({}));

    assert!(!outcome.ok, "isError must surface as a failure");
    assert!(outcome.content.contains("it broke"), "{}", outcome.content);

    mcp::disconnect_all();
}

#[test]
#[ignore = "needs node on PATH"]
fn disabled_tools_are_not_registered() {
    let mut registry = Registry::new();
    let status = mcp::connect(&mut registry, &config("mock", vec!["boom".into()]), "");

    // The server still reports it; Vavis simply does not offer it.
    assert!(status.tools.contains(&"boom".to_string()));
    assert!(registry.get("mock_echo").is_some());
    assert!(
        registry.get("mock_boom").is_none(),
        "a switched-off tool must not reach the model"
    );

    mcp::disconnect_all();
}

#[test]
#[ignore = "needs node on PATH"]
fn mcp_tools_are_destructive_and_use_the_servers_own_schema() {
    let mut registry = Registry::new();
    assert!(mcp::connect(&mut registry, &config("mock", vec![]), "").connected);

    let tool = registry.get("mock_echo").expect("registered");

    // An MCP server runs arbitrary code; its own risk claim is not trusted.
    assert_eq!(tool.risk(), vavis_tools::Risk::Destructive);

    let schema = tool.schema();
    let params = &schema["function"]["parameters"];
    assert_eq!(params["properties"]["text"]["type"], "string");
    assert_eq!(
        params["required"][0], "text",
        "the server's schema should pass through untouched"
    );

    mcp::disconnect_all();
}

#[test]
#[ignore = "needs node on PATH"]
fn naming_a_server_offers_its_tools_and_respects_the_cap() {
    use vavis_tools::{selection, DEFAULT_TOOL_BUDGET};

    let mut registry = vavis_tools::default_registry();
    assert!(mcp::connect(&mut registry, &config("weatherly", vec![]), "").connected);

    let offered = selection::select_named(
        &registry,
        "weatherly ile hava durumuna bak",
        DEFAULT_TOOL_BUDGET,
    );
    assert!(
        offered.contains(&"weatherly_echo"),
        "naming the server should offer its tools: {offered:?}"
    );
    assert!(
        offered.len() <= DEFAULT_TOOL_BUDGET,
        "the cap still applies: {offered:?}"
    );

    // A message about something else must not drag the server in.
    let unrelated = selection::select_named(&registry, "pil yüzde kaç", DEFAULT_TOOL_BUDGET);
    assert!(
        !unrelated.iter().any(|t| t.starts_with("weatherly_")),
        "unrelated request pulled in MCP tools: {unrelated:?}"
    );

    mcp::disconnect_all();
}

#[test]
#[ignore = "needs node on PATH"]
fn each_server_gets_its_own_tool_selection_domain() {
    let mut registry = Registry::new();
    assert!(mcp::connect(&mut registry, &config("alpha", vec![]), "").connected);
    assert!(mcp::connect(&mut registry, &config("beta", vec![]), "").connected);

    let alpha = registry.get("alpha_echo").expect("alpha registered");
    let beta = registry.get("beta_echo").expect("beta registered");
    assert_ne!(
        alpha.domain(),
        beta.domain(),
        "servers must not share a domain, or one server's tools crowd out the other"
    );

    mcp::disconnect_all();
}
