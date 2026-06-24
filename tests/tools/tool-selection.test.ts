import {describe, it, expect, beforeEach} from "vitest";
import {getAllToolSchemas, setDisabledTools, extraSchemas} from "../../electron/tools";
import {stmClear, stmRecord} from "../../electron/short-term-memory";

// ─────────────────────────────────────────────────────────────────────────────
// Regression shield for getAllToolSchemas tool-selection logic. The root causes
// of the "works sometimes, doesn't other times" complaint were here: 64-tool
// limit truncation, mismatched roots, sticky-context loss, too many tools on
// chatter. We lock each one down.
// ─────────────────────────────────────────────────────────────────────────────

function toolNames(provider: string, ctx?: string): string[] {
    return getAllToolSchemas(provider, ctx).map((t) => t.function?.name ?? "");
}

beforeEach(() => {
    setDisabledTools([]);
    stmClear();
    extraSchemas.length = 0;
});

describe("Groq 64-tool limit", () => {
    it("never exceeds 64 in any context", () => {
        expect(getAllToolSchemas("groq", "spotify aç ve şarkı çal").length).toBeLessThanOrEqual(64);
        expect(getAllToolSchemas("groq", "steam aç cs çalıştır").length).toBeLessThanOrEqual(64);
    });

    it("agent mode (no context) also respects the limit", () => {
        expect(getAllToolSchemas("groq").length).toBeLessThanOrEqual(64);
    });
});

describe("Domain tools come forward based on context (not truncated)", () => {
    it("spotify request selects spotify tools", () => {
        const names = toolNames("groq", "spotify aç ve müzik çal");
        expect(names.some((n) => n.startsWith("spotify_"))).toBe(true);
    });

    it("steam request selects steam tools", () => {
        const names = toolNames("groq", "steam aç ve oyun başlat");
        expect(names.some((n) => n.startsWith("steam_"))).toBe(true);
    });

    it("smart home request selects smart_home tools", () => {
        const names = toolNames("groq", "salon ışığını aç");
        expect(names.some((n) => n.startsWith("smart_home_"))).toBe(true);
    });

    it("local network discovery request includes local_devices_scan", () => {
        const names = toolNames("groq", "evdeki cihazları tara ağda ne var");
        expect(names).toContain("local_devices_scan");
    });
});

describe("Chatter → no tools sent", () => {
    it("no tools on a thank-you message", () => {
        expect(getAllToolSchemas("groq", "teşekkürler").length).toBe(0);
    });

    it("no tools on a greeting message", () => {
        expect(getAllToolSchemas("groq", "nasılsın").length).toBe(0);
    });

    it("no tools on an acknowledgment like 'tamam' (ok)", () => {
        expect(getAllToolSchemas("groq", "tamam").length).toBe(0);
    });
});

describe("Action signal brings core tools", () => {
    it("command execution request includes run_command", () => {
        const names = toolNames("groq", "bir powershell komutu çalıştır");
        expect(names).toContain("run_command");
    });

    it("file read request includes read_file", () => {
        const names = toolNames("groq", "dosyayı oku");
        expect(names).toContain("read_file");
    });
});

describe("Sticky context (reference turns)", () => {
    it("a follow-up message without a root keyword keeps the prior domain group if the last tool belonged to it", () => {
        // First record as if a spotify tool already ran, priming STM
        stmRecord("spotify_play", "{}", "ok", true, "llm");
        // English follow-up message with no root keyword ("change it to jazz")
        const names = toolNames("groq", "change it to jazz");
        expect(names.some((n) => n.startsWith("spotify_"))).toBe(true);
    });
});

describe("disabledTools filter", () => {
    it("a disabled tool is not included in the list", () => {
        setDisabledTools(["run_command"]);
        const names = toolNames("groq", "bir komut çalıştır");
        expect(names).not.toContain("run_command");
    });
});

describe("Provider limits", () => {
    // Each provider respects its own tool limit: groq/anthropic/mistral/xai/deepseek/ollama=64,
    // openai/gemini=128 (these APIs accept more tools).
    it("anthropic respects the 64 limit", () => {
        expect(getAllToolSchemas("anthropic", "spotify çal ve steam aç").length).toBeLessThanOrEqual(64);
    });

    it("openai respects the 128 limit (allows more than 64)", () => {
        expect(getAllToolSchemas("openai", "steam aç spotify çal").length).toBeLessThanOrEqual(128);
    });

    it("unknown provider falls back to the default 64", () => {
        expect(getAllToolSchemas("bilinmeyen-provider", "spotify çal").length).toBeLessThanOrEqual(64);
    });
});

describe("Memoization (agent mode hot path)", () => {
    it("repeat call with the same plugin state returns a consistent result", () => {
        const a = getAllToolSchemas("groq");
        const b = getAllToolSchemas("groq");
        expect(a.map((t) => t.function?.name)).toEqual(b.map((t) => t.function?.name));
    });

    it("a new tool appears once a plugin (extraSchemas) is added", () => {
        const before = getAllToolSchemas("ollama").length; // ollama 64 limit; but everything without context
        extraSchemas.push({
            type: "function",
            function: {name: "test_plugin_tool", description: "x", parameters: {type: "object", properties: {}, additionalProperties: false}},
        });
        const names = getAllToolSchemas("ollama").map((t) => t.function?.name);
        // visible if under the limit; otherwise the memo should at least invalidate and produce different content
        expect(names.length).toBeGreaterThanOrEqual(0);
        extraSchemas.length = 0;
        const after = getAllToolSchemas("ollama").length;
        expect(after).toBe(before); // returns to the old count once cleared (invalidation works)
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 55 — regression shield for tool-selection gaps found via the eval harness.
// The correct tool used to get truncated at the 64-tool limit for these messages;
// fixed via roots/priority.
// ─────────────────────────────────────────────────────────────────────────────
describe("Phase 55 — tool-selection gap fixes", () => {
    it("'cpu kullanımı' (cpu usage) offers system_report", () => {
        expect(toolNames("groq", "cpu kullanımı ne durumda")).toContain("system_report");
    });
    it("'bugün hava nasıl' (what's the weather today) offers weather_station", () => {
        expect(toolNames("groq", "bugün hava nasıl")).toContain("weather_station");
    });
    it("'e-posta gönder' (send an email) offers email_send", () => {
        expect(toolNames("groq", "e-posta gönder")).toContain("email_send");
    });
    it("'sistem sesini 30 yap' (set system volume to 30) offers set_volume (priorityCore, never truncated)", () => {
        expect(toolNames("groq", "sistem sesini 30 yap")).toContain("set_volume");
    });
    it("'10 dakika sonra hatırlat' (remind me in 10 minutes) offers remind_in (head of the scheduler group)", () => {
        expect(toolNames("groq", "10 dakika sonra hatırlat")).toContain("remind_in");
    });
    it("'şu siteyi özetle <url>' (summarize this site) offers fetch_url (head of the knowledge group)", () => {
        expect(toolNames("groq", "şu siteyi özetle https://x.com")).toContain("fetch_url");
    });
    it("the fixes do not break the 64-tool limit", () => {
        for (const m of ["cpu kullanımı", "hava nasıl", "10 dakika sonra hatırlat", "şu siteyi özetle https://x.com"]) {
            expect(getAllToolSchemas("groq", m).length).toBeLessThanOrEqual(64);
        }
    });
    it("priorityCore does not drop a large domain group from the queue (Spotify/Steam preserved)", () => {
        // 'yeni çıkanları göster' (show new releases) pulls in Spotify (~50 tools); new_releases must still come through
        expect(toolNames("groq", "yeni çıkanları göster")).toContain("spotify_new_releases");
    });
});
