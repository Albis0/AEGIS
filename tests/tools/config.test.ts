import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const CONFIG_PATH = path.join(os.homedir(), ".aegis", "config.json");

import {loadConfig, loadConfigStrict, saveConfig, applyConfig, type AegisConfig} from "../../electron/config";

const FULL: AegisConfig = {
    groqApiKey: "gsk_test",
    supabaseUrl: "https://test.supabase.co",
    supabaseServiceKey: "service_test",
    tavilyApiKey: "tvly_test",
    homeAssistantUrl: "http://ha.local:8123",
    homeAssistantToken: "ha_token",
};

// env keys written by applyConfig — for post-test cleanup
const ENV_KEYS = [
    "GROQ_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_KEY", "TAVILY_API_KEY",
    "SERPER_API_KEY", "ELEVENLABS_API_KEY", "STEAM_API_KEY", "STEAM_ID64",
    "HOME_ASSISTANT_URL", "HOME_ASSISTANT_TOKEN",
];

function clearEnv(): void {
    for (const k of ENV_KEYS) delete process.env[k];
}

beforeEach(() => {
    fs.mkdirSync(path.dirname(CONFIG_PATH), {recursive: true});
    try { fs.unlinkSync(CONFIG_PATH); } catch { /* none */ }
    clearEnv();
});
afterEach(() => {
    try { fs.unlinkSync(CONFIG_PATH); } catch { /* none */ }
    clearEnv();
});

// ─── load/save ───────────────────────────────────────────────────────────────
describe("loadConfig", () => {
    it("returns null when the file doesn't exist", () => {
        expect(loadConfig()).toBeNull();
    });

    it("reads back what was saved (roundtrip)", () => {
        saveConfig(FULL);
        const c = loadConfig();
        expect(c?.groqApiKey).toBe("gsk_test");
        expect(c?.homeAssistantUrl).toBe("http://ha.local:8123");
    });

    it("returns null for malformed JSON (no crash)", () => {
        fs.writeFileSync(CONFIG_PATH, "{bozuk json", "utf-8");
        expect(loadConfig()).toBeNull();
    });
});

// ─── loadConfigStrict ────────────────────────────────────────────────────────
describe("loadConfigStrict", () => {
    it("valid when config is complete", () => {
        saveConfig(FULL);
        expect(loadConfigStrict()).not.toBeNull();
    });

    it("null when groqApiKey is missing", () => {
        saveConfig({...FULL, groqApiKey: ""});
        expect(loadConfigStrict()).toBeNull();
    });

    it("null when supabaseUrl is missing", () => {
        saveConfig({...FULL, supabaseUrl: ""});
        expect(loadConfigStrict()).toBeNull();
    });

    it("null when supabaseServiceKey is missing", () => {
        saveConfig({...FULL, supabaseServiceKey: ""});
        expect(loadConfigStrict()).toBeNull();
    });
});

// ─── applyConfig ─────────────────────────────────────────────────────────────
describe("applyConfig", () => {
    it("writes populated fields to process.env", () => {
        applyConfig(FULL);
        expect(process.env.GROQ_API_KEY).toBe("gsk_test");
        expect(process.env.SUPABASE_URL).toBe("https://test.supabase.co");
        expect(process.env.TAVILY_API_KEY).toBe("tvly_test");
        expect(process.env.HOME_ASSISTANT_URL).toBe("http://ha.local:8123");
        expect(process.env.HOME_ASSISTANT_TOKEN).toBe("ha_token");
    });

    it("empty/missing optional fields are not written to env", () => {
        applyConfig({groqApiKey: "g", supabaseUrl: "u", supabaseServiceKey: "s"});
        expect(process.env.GROQ_API_KEY).toBe("g");
        expect(process.env.TAVILY_API_KEY).toBeUndefined();
        expect(process.env.HOME_ASSISTANT_URL).toBeUndefined();
    });
});

// ─── masking (audit A2) ──────────────────────────────────────────────────────
import {maskSecret, isMaskedValue, maskedConfig, sanitizeConfigPatch} from "../../electron/config";

describe("maskSecret / isMaskedValue", () => {
    it("empty stays empty, short keys are fully stubbed", () => {
        expect(maskSecret("")).toBe("");
        expect(maskSecret(undefined)).toBe("");
        expect(maskSecret("gsk_short")).toBe("••••••••");
    });

    it("long keys keep only 4+4 chars and are recognized as masked", () => {
        const m = maskSecret("gsk_1234567890abcdefghij");
        expect(m).toBe("gsk_…ghij");
        expect(m).not.toContain("1234567890");
        expect(isMaskedValue(m)).toBe(true);
        expect(isMaskedValue("gsk_freshly_typed_key")).toBe(false);
    });
});

describe("maskedConfig", () => {
    it("contains no raw secret material; service key is fully stubbed", () => {
        const cfg: AegisConfig = {
            groqApiKey: "gsk_1234567890abcdefghij",
            supabaseUrl: "https://test.supabase.co",
            supabaseServiceKey: "eyJservice_role_key_very_secret_value",
            tavilyApiKey: "tvly_1234567890abcdef",
            homeAssistantToken: "ha_long_lived_token_123456",
        };
        const m = maskedConfig(cfg);
        const json = JSON.stringify(m);
        expect(json).not.toContain("1234567890abcdefghij");
        expect(json).not.toContain("service_role_key");
        expect(m.supabaseServiceKey).toBe("••••••••"); // not even a prefix
        expect(m.supabaseUrl).toBe("https://test.supabase.co"); // non-secret untouched
        expect(isMaskedValue(m.groqApiKey)).toBe(true);
    });

    it("does not mutate the input config", () => {
        const cfg: AegisConfig = {groqApiKey: "gsk_1234567890abcdefghij", supabaseUrl: "u", supabaseServiceKey: "s"};
        maskedConfig(cfg);
        expect(cfg.groqApiKey).toBe("gsk_1234567890abcdefghij");
    });
});

describe("sanitizeConfigPatch", () => {
    it("drops masked round-trips, keeps fresh input and non-secrets", () => {
        const patch = sanitizeConfigPatch({
            groqApiKey: "gsk_…ghij",              // masked echo → dropped
            supabaseServiceKey: "••••••••",        // stub echo → dropped
            tavilyApiKey: "tvly_new_real_key_42",  // fresh input → kept
            supabaseUrl: "https://new.supabase.co", // non-secret → kept
        });
        expect(patch.groqApiKey).toBeUndefined();
        expect(patch.supabaseServiceKey).toBeUndefined();
        expect(patch.tavilyApiKey).toBe("tvly_new_real_key_42");
        expect(patch.supabaseUrl).toBe("https://new.supabase.co");
    });

    it("keeps explicit empty-string clears", () => {
        const patch = sanitizeConfigPatch({tavilyApiKey: ""});
        expect(patch.tavilyApiKey).toBe("");
    });
});
