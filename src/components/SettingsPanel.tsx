import {useEffect, useRef, useState} from "react";
import type {AppSettings, AegisConfig, AiProvider, TelemetryWidget} from "../electron.d";

// ── Model catalog ──────────────────────────────────────────────────────────
interface ModelEntry {
    id: string;
    label: string;
    tag: string;
    ctx?: string;
    note?: string;
}

const GROQ_MODELS: ModelEntry[] = [
    {id: "meta-llama/llama-4-scout-17b-16e-instruct",    label: "Llama 4 Scout",         tag: "varsayılan", ctx: "128K", note: "MoE·Vizyon"},
    {id: "qwen/qwen3-32b",                               label: "Qwen3 32B",              tag: "güçlü",      ctx: "128K"},
    {id: "openai/gpt-oss-120b",                          label: "GPT OSS 120B",           tag: "yeni",       ctx: "131K", note: "OpenAI open-weight"},
    {id: "openai/gpt-oss-20b",                           label: "GPT OSS 20B",            tag: "hızlı",      ctx: "131K", note: "~1000 tok/s"},
    {id: "deepseek-r1-distill-llama-70b",                label: "DeepSeek-R1 Distill 70B",tag: "reasoning",  ctx: "128K"},
    {id: "llama-3.3-70b-versatile",                      label: "Llama 3.3 70B",          tag: "",           ctx: "128K"},
    {id: "llama-3.1-8b-instant",                         label: "Llama 3.1 8B",           tag: "hızlı",      ctx: "128K", note: "~560 tok/s"},
    {id: "groq/compound",                                label: "Groq Compound",          tag: "agentic",    ctx: "131K", note: "Web+Kod dahil"},
    {id: "groq/compound-mini",                           label: "Groq Compound Mini",     tag: "agentic",    ctx: "131K"},
    {id: "gemma2-9b-it",                                 label: "Gemma2 9B",              tag: "",           ctx: "8K"},
    {id: "mixtral-8x7b-32768",                           label: "Mixtral 8×7B",           tag: "klasik",     ctx: "32K"},
];

const OPENAI_MODELS: ModelEntry[] = [
    {id: "gpt-5.5",          label: "GPT-5.5",          tag: "yeni",      ctx: "1M",   note: "Flagship · ChatGPT varsayılan"},
    {id: "gpt-5.5-pro",      label: "GPT-5.5 Pro",      tag: "güçlü",     ctx: "1M",   note: "Yüksek doğruluk"},
    {id: "gpt-5.4",          label: "GPT-5.4",          tag: "",          ctx: "1M"},
    {id: "gpt-5.4-mini",     label: "GPT-5.4 Mini",     tag: "hızlı",     ctx: "400K"},
    {id: "gpt-5.4-nano",     label: "GPT-5.4 Nano",     tag: "ekonomik",  ctx: "400K"},
    {id: "gpt-5",            label: "GPT-5",            tag: "",          ctx: "1M"},
    {id: "gpt-5-mini",       label: "GPT-5 Mini",       tag: "",          ctx: "200K"},
    {id: "o3",               label: "o3",               tag: "reasoning", ctx: "200K", note: "o3-2025-04-16"},
    {id: "gpt-4.1",          label: "GPT-4.1",          tag: "eski",      ctx: "1M"},
    {id: "gpt-4o",           label: "GPT-4o",           tag: "eski",      ctx: "128K"},
    {id: "gpt-3.5-turbo",    label: "GPT-3.5 Turbo",    tag: "ucuz",      ctx: "16K"},
];

const ANTHROPIC_MODELS: ModelEntry[] = [
    {id: "claude-opus-4-8",              label: "Claude Opus 4.8",    tag: "yeni",      ctx: "1M",   note: "Flagship · Adaptive thinking"},
    {id: "claude-opus-4-7",              label: "Claude Opus 4.7",    tag: "güçlü",     ctx: "1M"},
    {id: "claude-sonnet-4-6",            label: "Claude Sonnet 4.6",  tag: "varsayılan",ctx: "1M",   note: "Önerilen"},
    {id: "claude-haiku-4-5-20251001",    label: "Claude Haiku 4.5",   tag: "hızlı",     ctx: "200K", note: "En ucuz"},
    {id: "claude-sonnet-4-5-20250929",   label: "Claude Sonnet 4.5",  tag: "",          ctx: "200K"},
    {id: "claude-opus-4-5-20251101",     label: "Claude Opus 4.5",    tag: "",          ctx: "200K"},
    {id: "claude-opus-4-1-20250805",     label: "Claude Opus 4.1",    tag: "eski",      ctx: "200K"},
    {id: "claude-3-7-sonnet-20250219",   label: "Claude 3.7 Sonnet",  tag: "thinking",  ctx: "200K"},
    {id: "claude-3-5-sonnet-20241022",   label: "Claude 3.5 Sonnet",  tag: "eski",      ctx: "200K"},
    {id: "claude-3-5-haiku-20241022",    label: "Claude 3.5 Haiku",   tag: "eski",      ctx: "200K"},
];

const GEMINI_MODELS: ModelEntry[] = [
    {id: "gemini-3.5-flash",            label: "Gemini 3.5 Flash",      tag: "yeni",      ctx: "1M",  note: "Flagship · Mayıs 2026"},
    {id: "gemini-3.1-pro-preview",      label: "Gemini 3.1 Pro",        tag: "güçlü",     ctx: "1M",  note: "Preview"},
    {id: "gemini-3.1-flash-lite",       label: "Gemini 3.1 Flash Lite", tag: "ekonomik",  ctx: "1M"},
    {id: "gemini-2.5-pro",              label: "Gemini 2.5 Pro",        tag: "varsayılan",ctx: "1M",  note: "En iyi 2.x reasoning"},
    {id: "gemini-2.5-flash",            label: "Gemini 2.5 Flash",      tag: "hızlı",     ctx: "1M",  note: "Fiyat/performans"},
    {id: "gemini-2.5-flash-lite",       label: "Gemini 2.5 Flash Lite", tag: "",          ctx: "1M"},
    {id: "gemini-1.5-pro",              label: "Gemini 1.5 Pro",        tag: "eski",      ctx: "2M"},
];

const MISTRAL_MODELS: ModelEntry[] = [
    {id: "mistral-medium-3.5",        label: "Mistral Medium 3.5",   tag: "yeni",      ctx: "256K", note: "128B · MIT açık"},
    {id: "mistral-small-2603",        label: "Mistral Small 4",      tag: "varsayılan",ctx: "256K", note: "Reasoning+Vizyon+Kod"},
    {id: "mistral-large-latest",      label: "Mistral Large",        tag: "güçlü",     ctx: "256K"},
    {id: "mistral-large-2512",        label: "Mistral Large 3",      tag: "",          ctx: "256K"},
    {id: "mistral-medium-latest",     label: "Mistral Medium",       tag: "",          ctx: "128K"},
    {id: "magistral-medium-latest",   label: "Magistral Medium",     tag: "reasoning", ctx: "128K"},
    {id: "magistral-medium-2506",     label: "Magistral Medium 2506",tag: "reasoning", ctx: "128K"},
    {id: "magistral-small-2506",      label: "Magistral Small",      tag: "reasoning", ctx: "128K"},
    {id: "codestral-latest",          label: "Codestral",            tag: "kod",       ctx: "128K", note: "FIM+kod"},
    {id: "ministral-14b-latest",      label: "Ministral 14B",        tag: "hızlı",     ctx: "256K", note: "Edge/compact"},
    {id: "open-mistral-nemo-2407",    label: "Mistral Nemo",         tag: "açık",      ctx: "128K"},
    {id: "open-mixtral-8x7b",         label: "Mixtral 8×7B",         tag: "açık",      ctx: "32K"},
];

const XAI_MODELS: ModelEntry[] = [
    {id: "grok-4.3",                      label: "Grok 4.3",              tag: "yeni",      ctx: "1M",   note: "Flagship · Mayıs 2026"},
    {id: "grok-4.20-0309-reasoning",      label: "Grok 4.20 Reasoning",   tag: "reasoning", ctx: "1M"},
    {id: "grok-4.20-0309-non-reasoning",  label: "Grok 4.20",             tag: "güçlü",     ctx: "1M"},
    {id: "grok-4.20-multi-agent-0309",    label: "Grok 4.20 Multi-Agent", tag: "agentic",   ctx: "1M"},
    {id: "grok-build-0.1",                label: "Grok Build",            tag: "kod",       ctx: "256K", note: "Agentic kod · early access"},
    {id: "grok-2-vision-1212",            label: "Grok 2 Vision",         tag: "vizyon",    ctx: "32K",  note: "Eski nesil"},
];

const DEEPSEEK_MODELS: ModelEntry[] = [
    {id: "deepseek-v4-pro",    label: "DeepSeek V4 Pro",   tag: "yeni",      ctx: "1M",  note: "1.6T params · 49B aktif"},
    {id: "deepseek-v4-flash",  label: "DeepSeek V4 Flash", tag: "varsayılan",ctx: "1M",  note: "Fiyat/performans"},
    {id: "deepseek-chat",      label: "DeepSeek Chat",     tag: "eski",      ctx: "64K", note: "→ V4 Flash alias"},
    {id: "deepseek-reasoner",  label: "DeepSeek Reasoner", tag: "eski",      ctx: "64K", note: "→ V4 Flash (thinking)"},
];

const PROVIDER_MODELS: Record<string, ModelEntry[]> = {
    groq:      GROQ_MODELS,
    openai:    OPENAI_MODELS,
    anthropic: ANTHROPIC_MODELS,
    gemini:    GEMINI_MODELS,
    mistral:   MISTRAL_MODELS,
    xai:       XAI_MODELS,
    deepseek:  DEEPSEEK_MODELS,
};

const DEFAULT_MODEL: Record<string, string> = {
    groq:      "meta-llama/llama-4-scout-17b-16e-instruct",
    openai:    "gpt-5.5",
    anthropic: "claude-sonnet-4-6",
    gemini:    "gemini-2.5-pro",
    mistral:   "mistral-medium-3.5",
    xai:       "grok-4.3",
    deepseek:  "deepseek-v4-flash",
    ollama:    "qwen3:8b",
};

// ── Provider definitions ───────────────────────────────────────────────────
const AI_PROVIDERS = [
    {id: "groq",      icon: "⚡", label: "Groq",       sub: "Ultra hızlı · Llama 4",    badge: "free"},
    {id: "openai",    icon: "◎",  label: "OpenAI",     sub: "GPT-5.5 · o3 serisi",      badge: ""},
    {id: "anthropic", icon: "◈",  label: "Anthropic",  sub: "Claude Opus 4.8",          badge: ""},
    {id: "gemini",    icon: "◇",  label: "Gemini",     sub: "Gemini 3.5 Flash · 1M ctx",badge: "free"},
    {id: "mistral",   icon: "✦",  label: "Mistral",    sub: "Medium 3.5 · EU · MIT",    badge: ""},
    {id: "xai",       icon: "✧",  label: "xAI / Grok", sub: "Grok 4.3 · gerçek zamanlı",badge: ""},
    {id: "deepseek",  icon: "◆",  label: "DeepSeek",   sub: "V4 Pro · 1M ctx",          badge: ""},
    {id: "ollama",    icon: "◉",  label: "Ollama",     sub: "Yerel · tam offline",       badge: "local"},
] as const;

// Temperature max by provider
const TEMP_MAX: Record<string, number> = {
    groq: 2, openai: 2, anthropic: 1, gemini: 2,
    mistral: 1, xai: 2, deepseek: 1.5, ollama: 2,
};

const MAX_TOKEN_OPTIONS = [512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];

// ── Voice & appearance data ────────────────────────────────────────────────
const EDGE_VOICES = [
    {id: "tr-TR-EmelNeural",   label: "Emel",   meta: "TR · Kadın"},
    {id: "tr-TR-AhmetNeural",  label: "Ahmet",  meta: "TR · Erkek"},
    {id: "en-US-AriaNeural",   label: "Aria",   meta: "EN · Kadın"},
    {id: "en-US-GuyNeural",    label: "Guy",    meta: "EN · Erkek"},
    {id: "en-GB-SoniaNeural",  label: "Sonia",  meta: "EN-GB · Kadın"},
    {id: "de-DE-KatjaNeural",  label: "Katja",  meta: "DE · Kadın"},
    {id: "de-DE-ConradNeural", label: "Conrad", meta: "DE · Erkek"},
    {id: "fr-FR-DeniseNeural", label: "Denise", meta: "FR · Kadın"},
    {id: "fr-FR-HenriNeural",  label: "Henri",  meta: "FR · Erkek"},
    {id: "es-ES-ElviraNeural", label: "Elvira", meta: "ES · Kadın"},
    {id: "es-ES-AlvaroNeural", label: "Alvaro", meta: "ES · Erkek"},
];

const EL_VOICES = [
    {id: "el:cgSgspJ2msm6clMCkdW9", label: "Jessica",   meta: "EN · Kadın · varsayılan"},
    {id: "el:9BWtsMINqrJLrRacOk9x", label: "Aria",      meta: "EN · Kadın · doğal"},
    {id: "el:XB0fDUnXU5powFXDhCwa", label: "Charlotte", meta: "EN-GB · Kadın · yumuşak"},
    {id: "el:Xb7hH8MSUJpSbSDYk0k2", label: "Alice",     meta: "EN-GB · Kadın · profesyonel"},
    {id: "el:TX3LPaxmHKxFdv7VOQHJ", label: "Liam",      meta: "EN · Erkek · anlatıcı"},
    {id: "el:nPczCjzI2devNBz1zQrb", label: "Brian",     meta: "EN · Erkek · derin"},
    {id: "el:IKne3meq5aSn9XLyUdCD", label: "Charlie",   meta: "EN-AU · Erkek · rahat"},
    {id: "el:onwK4e9ZLuTAKqWW03F9", label: "Daniel",    meta: "EN-GB · Erkek · haberci"},
    {id: "el:21m00Tcm4TlvDq8ikWAM", label: "Rachel",    meta: "EN · Kadın · klasik"},
    {id: "el:pNInz6obpgDQGcFmaJgB", label: "Adam",      meta: "EN · Erkek · klasik"},
];

const LANGUAGES = [
    {id: "tr", flag: "🇹🇷", label: "Türkçe"},
    {id: "en", flag: "🇬🇧", label: "English"},
    {id: "de", flag: "🇩🇪", label: "Deutsch"},
    {id: "fr", flag: "🇫🇷", label: "Français"},
    {id: "es", flag: "🇪🇸", label: "Español"},
] as const;

const ACCENT_COLORS = [
    {id: "34,211,238",  label: "Cyan",    hex: "#22d3ee"},
    {id: "56,189,248",  label: "Sky",     hex: "#38bdf8"},
    {id: "99,102,241",  label: "Indigo",  hex: "#6366f1"},
    {id: "139,92,246",  label: "Purple",  hex: "#8b5cf6"},
    {id: "232,121,249", label: "Fuchsia", hex: "#e879f9"},
    {id: "251,113,133", label: "Rose",    hex: "#fb7185"},
    {id: "248,113,113", label: "Red",     hex: "#f87171"},
    {id: "251,146,60",  label: "Orange",  hex: "#fb923c"},
    {id: "250,204,21",  label: "Yellow",  hex: "#facc15"},
    {id: "163,230,53",  label: "Lime",    hex: "#a3e635"},
    {id: "110,231,183", label: "Emerald", hex: "#6ee7b7"},
    {id: "45,212,191",  label: "Teal",    hex: "#2dd4bf"},
];

// ── Types ──────────────────────────────────────────────────────────────────
type Tab = "model" | "voice" | "appearance" | "keys" | "telemetry";

interface Props {
    open: boolean;
    onClose: () => void;
    onAccentChange: (rgb: string) => void;
    onSkinChange: (skin: AppSettings["skin"]) => void;
    onFontChange: (font: AppSettings["font"]) => void;
    onLayoutChange: (layout: AppSettings["layout"]) => void;
    onCustomCssChange: (css: string) => void;
    onTelemetryWidgetsChange: (widgets: TelemetryWidget[]) => void;
}

export default function SettingsPanel({open, onClose, onAccentChange, onSkinChange, onFontChange, onLayoutChange, onCustomCssChange, onTelemetryWidgetsChange}: Props) {
    const [tab, setTab] = useState<Tab>("model");
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [config, setConfig]     = useState<AegisConfig | null>(null);
    const [saved, setSaved]       = useState(false);
    const [testing, setTesting]   = useState(false);
    const [paramsOpen, setParamsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            Promise.all([window.jarvis.settingsGet(), window.jarvis.configGet()])
                .then(([s, c]) => { setSettings(s); setConfig(c); setParamsOpen(false); });
            setSaved(false);
        }
    }, [open]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    function flash() { setSaved(true); setTimeout(() => setSaved(false), 1800); }

    async function applySettings(patch: Partial<AppSettings>) {
        const updated = await window.jarvis.settingsSet(patch);
        setSettings(updated);
        if (patch.accentColor) onAccentChange(patch.accentColor);
        if (patch.skin) onSkinChange(patch.skin);
        if (patch.font) onFontChange(patch.font);
        if (patch.layout) onLayoutChange(patch.layout);
        if (patch.customCss !== undefined) onCustomCssChange(patch.customCss);
        flash();
    }

    function saveProviderKey(provider: string, key: string) {
        const merged = {...(settings?.providerKeys ?? {}), [provider]: key};
        applySettings({providerKeys: merged});
    }

    async function applyConfig(patch: Partial<AegisConfig>) {
        await window.jarvis.configSet(patch);
        setConfig((c) => c ? {...c, ...patch} : c);
        flash();
    }

    async function testVoice() {
        if (!settings || testing) return;
        setTesting(true);
        try {
            const res = await window.jarvis.tts("Merhaba, ben AEGIS. Sesinizi duyuyorum.");
            if (res.error || !res.buffer) return;
            const ctx = new AudioContext();
            const raw = res.buffer as unknown as {data?: number[]};
            const bytes = raw.data ? new Uint8Array(raw.data) : new Uint8Array(res.buffer as unknown as ArrayBuffer);
            const decoded = await ctx.decodeAudioData(bytes.buffer);
            const src = ctx.createBufferSource();
            src.buffer = decoded;
            src.connect(ctx.destination);
            src.start();
            src.onended = () => ctx.close();
        } catch (err) {
            console.error("testVoice:", err);
        } finally {
            setTesting(false);
        }
    }

    if (!open || !settings) return null;

    const a = settings.accentColor;
    const ac = `rgb(${a})`;
    const provider = settings.aiProvider as AiProvider;
    const modelList = PROVIDER_MODELS[provider] ?? [];
    const voices = settings.ttsProvider === "elevenlabs" ? EL_VOICES : EDGE_VOICES;
    const tempMax = TEMP_MAX[provider] ?? 2;
    const currentKey = settings.providerKeys?.[provider] ?? "";
    const needsKey = provider !== "groq" && provider !== "ollama";

    // Tag color helper
    function tagColor(tag: string): string {
        if (tag === "yeni" || tag === "varsayılan") return `rgba(${a},0.9)`;
        if (tag === "hızlı") return "rgba(74,222,128,0.9)";
        if (tag === "güçlü") return "rgba(251,146,60,0.9)";
        if (tag === "reasoning" || tag === "thinking") return "rgba(192,132,252,0.9)";
        if (tag === "ekonomik") return "rgba(74,222,128,0.7)";
        if (tag === "vizyon" || tag === "kod") return "rgba(56,189,248,0.9)";
        if (tag === "agentic") return "rgba(251,191,36,0.9)";
        if (tag === "eski") return `rgba(${a},0.3)`;
        if (tag === "açık" || tag === "klasik") return `rgba(${a},0.45)`;
        return `rgba(${a},0.5)`;
    }

    return (
        <div
            className="absolute inset-0 z-50 flex items-end justify-end"
            style={{background: "rgba(3,6,12,0.82)"}}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={panelRef}
                className="relative flex flex-col h-full"
                style={{
                    width: "clamp(320px, 38vw, 480px)",
                    background: "rgba(4,8,18,0.98)",
                    borderLeft: `1px solid rgba(${a},0.18)`,
                    boxShadow: `-20px 0 60px rgba(${a},0.06)`,
                    WebkitFontSmoothing: "antialiased",
                }}
            >
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b" style={{borderColor: `rgba(${a},0.12)`}}>
                    <div>
                        <div className="text-[13px] tracking-[0.45em] font-medium" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>AYARLAR</div>
                        <div className="text-[11px] mt-0.5 opacity-50" style={{color: ac}}>AEGIS yapılandırması</div>
                    </div>
                    <div className="flex items-center gap-3">
                        {saved && (
                            <span className="text-[10px] tracking-widest px-2 py-0.5 rounded" style={{color: "#4ade80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)"}}>
                                ✓ KAYDEDİLDİ
                            </span>
                        )}
                        <button onClick={onClose} className="w-7 h-7 grid place-items-center rounded opacity-40 hover:opacity-100 transition text-sm" style={{color: ac, border: `1px solid rgba(${a},0.2)`}}>✕</button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="shrink-0 flex flex-wrap border-b" style={{borderColor: `rgba(${a},0.1)`}}>
                    {(["model", "voice", "appearance", "keys", "telemetry"] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className="flex-1 py-3 text-[10px] font-medium tracking-[0.2em] transition relative"
                            style={{color: tab === t ? ac : `rgba(${a},0.4)`}}
                        >
                            {t === "model" ? "MODEL" : t === "voice" ? "SES" : t === "appearance" ? "GÖRÜNÜM" : t === "keys" ? "API KEYS" : "TELEMETRİ"}
                            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-px" style={{background: `linear-gradient(90deg, transparent, ${ac}, transparent)`}} />}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">

                    {/* ════ MODEL TAB ════ */}
                    {tab === "model" && (
                        <div className="p-5 space-y-6">

                            {/* Provider grid */}
                            <Group label="AI SAĞLAYICI" accent={a}>
                                <div className="grid grid-cols-2 gap-2">
                                    {AI_PROVIDERS.map((p) => {
                                        const active = provider === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => applySettings({
                                                    aiProvider: p.id as AiProvider,
                                                    model: DEFAULT_MODEL[p.id] ?? "",
                                                })}
                                                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition"
                                                style={{
                                                    background: active ? `rgba(${a},0.12)` : "transparent",
                                                    border: `1px solid ${active ? `rgba(${a},0.4)` : `rgba(${a},0.08)`}`,
                                                }}
                                            >
                                                <span className="text-base shrink-0 w-5 text-center" style={{color: active ? ac : `rgba(${a},0.35)`}}>{p.icon}</span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="block text-[12px] font-medium truncate" style={{color: active ? ac : `rgba(${a},0.7)`}}>{p.label}</span>
                                                        {p.badge === "free" && (
                                                            <span className="text-[8px] px-1 py-0.5 rounded shrink-0" style={{color: "rgba(74,222,128,0.9)", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)"}}>FREE</span>
                                                        )}
                                                        {p.badge === "local" && (
                                                            <span className="text-[8px] px-1 py-0.5 rounded shrink-0" style={{color: `rgba(${a},0.7)`, background: `rgba(${a},0.08)`, border: `1px solid rgba(${a},0.15)`}}>LOCAL</span>
                                                        )}
                                                    </span>
                                                    <span className="block text-[10px] opacity-40 mt-0.5 truncate" style={{color: ac}}>{p.sub}</span>
                                                </span>
                                                {active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background: ac}} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Group>

                            {/* API key (non-Groq, non-Ollama) */}
                            {needsKey && (
                                <Group label={`${provider.toUpperCase()} API KEY`} accent={a}>
                                    <ProviderKeyField
                                        value={currentKey}
                                        provider={provider}
                                        onSave={(v) => saveProviderKey(provider, v)}
                                        accent={a}
                                    />
                                    <Hint accent={a}>settings.json içinde saklanır · diğer provider'lar etkilenmez.</Hint>
                                </Group>
                            )}

                            {/* Ollama config */}
                            {provider === "ollama" && (
                                <Group label="OLLAMA AYARLARI" accent={a}>
                                    <div className="space-y-3">
                                        <div>
                                            <Label accent={a}>Sunucu URL</Label>
                                            <PlainField value={settings.ollamaUrl || "http://localhost:11434"} placeholder="http://localhost:11434" onSave={(v) => applySettings({ollamaUrl: v})} accent={a} />
                                        </div>
                                        <div>
                                            <Label accent={a}>Model adı</Label>
                                            <PlainField value={settings.model} placeholder="llama3.2, mistral, gemma2..." onSave={(v) => applySettings({model: v})} accent={a} />
                                        </div>
                                        <div>
                                            <Label accent={a}>Context penceresi</Label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {[2048, 4096, 8192, 16384, 32768].map((n) => {
                                                    const active = (settings.ollamaNumCtx ?? 4096) === n;
                                                    return (
                                                        <button key={n} onClick={() => applySettings({ollamaNumCtx: n})}
                                                            className="px-2.5 py-1.5 rounded text-[11px] transition"
                                                            style={{background: active ? `rgba(${a},0.15)` : "transparent", border: `1px solid ${active ? `rgba(${a},0.4)` : `rgba(${a},0.12)`}`, color: active ? ac : `rgba(${a},0.5)`}}>
                                                            {n >= 1024 ? `${n / 1024}K` : n}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <Hint accent={a}>Ollama kapalıysa: <code style={{color: `rgba(${a},0.7)`}}>ollama serve</code></Hint>
                                </Group>
                            )}

                            {/* Model list (non-Ollama) */}
                            {provider !== "ollama" && modelList.length > 0 && (
                                <Group label="MODEL" accent={a}>
                                    <div className="space-y-1">
                                        {modelList.map((m) => {
                                            const active = settings.model === m.id;
                                            return (
                                                <button
                                                    key={m.id}
                                                    onClick={() => applySettings({model: m.id})}
                                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition"
                                                    style={{
                                                        background: active ? `rgba(${a},0.1)` : "transparent",
                                                        border: `1px solid ${active ? `rgba(${a},0.3)` : "transparent"}`,
                                                    }}
                                                >
                                                    <span className="w-2 h-2 rounded-full shrink-0 border" style={{borderColor: active ? ac : `rgba(${a},0.25)`, background: active ? ac : "transparent"}} />
                                                    <span className="flex-1 text-[12px] font-medium" style={{color: active ? ac : `rgba(${a},0.65)`}}>{m.label}</span>
                                                    <span className="flex items-center gap-1.5 shrink-0">
                                                        {m.ctx && <span className="text-[9px] px-1 py-0.5 rounded" style={{color: `rgba(${a},0.45)`, background: `rgba(${a},0.06)`, border: `1px solid rgba(${a},0.1)`}}>{m.ctx}</span>}
                                                        {m.tag && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{color: tagColor(m.tag), background: "transparent", border: `1px solid ${tagColor(m.tag).replace("0.9", "0.25").replace("0.7", "0.2")}`}}>{m.tag}</span>}
                                                        {m.note && <span className="text-[9px] opacity-35" style={{color: ac}}>{m.note}</span>}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </Group>
                            )}

                            {/* Advanced params — collapsible */}
                            <div className="rounded-lg overflow-hidden" style={{border: `1px solid rgba(${a},0.1)`}}>
                                <button
                                    onClick={() => setParamsOpen((o) => !o)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 transition hover:brightness-125"
                                    style={{background: paramsOpen ? `rgba(${a},0.07)` : "transparent"}}
                                >
                                    <span className="text-[10px] font-medium tracking-[0.3em]" style={{color: `rgba(${a},0.6)`}}>GELİŞMİŞ PARAMETRELER</span>
                                    <span className="text-[11px] transition-transform" style={{color: `rgba(${a},0.4)`, transform: paramsOpen ? "rotate(90deg)" : "none"}}>▶</span>
                                </button>

                                {paramsOpen && (
                                    <div className="px-4 pb-4 space-y-4" style={{borderTop: `1px solid rgba(${a},0.08)`}}>

                                        {/* Temperature */}
                                        <div className="pt-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <Label accent={a}>Sıcaklık (Temperature)</Label>
                                                <span className="text-[12px] tabular-nums" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{(settings.temperature ?? 0.7).toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] opacity-35 w-5" style={{color: ac}}>0</span>
                                                <input
                                                    type="range" min={0} max={tempMax} step={0.05}
                                                    value={settings.temperature ?? 0.7}
                                                    onChange={(e) => setSettings((s) => s ? {...s, temperature: parseFloat(e.target.value)} : s)}
                                                    onMouseUp={(e) => applySettings({temperature: parseFloat((e.target as HTMLInputElement).value)})}
                                                    onTouchEnd={(e) => applySettings({temperature: parseFloat((e.target as HTMLInputElement).value)})}
                                                    className="flex-1"
                                                    style={{accentColor: ac}}
                                                />
                                                <span className="text-[9px] opacity-35 w-6 text-right" style={{color: ac}}>{tempMax}</span>
                                            </div>
                                            <p className="text-[10px] opacity-30 mt-1 leading-relaxed" style={{color: ac}}>Düşük = deterministik · Yüksek = yaratıcı</p>
                                        </div>

                                        {/* Max tokens */}
                                        <div>
                                            <Label accent={a}>Maksimum token (yanıt uzunluğu)</Label>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {MAX_TOKEN_OPTIONS.map((n) => {
                                                    const active = (settings.maxTokens ?? 8192) === n;
                                                    const label = n >= 1024 ? `${n / 1024}K` : `${n}`;
                                                    return (
                                                        <button key={n} onClick={() => applySettings({maxTokens: n})}
                                                            className="px-2.5 py-1.5 rounded text-[11px] transition"
                                                            style={{background: active ? `rgba(${a},0.15)` : "transparent", border: `1px solid ${active ? `rgba(${a},0.4)` : `rgba(${a},0.12)`}`, color: active ? ac : `rgba(${a},0.5)`}}>
                                                            {label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Top P */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <Label accent={a}>Top-P (nucleus sampling)</Label>
                                                <span className="text-[12px] tabular-nums" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{(settings.topP ?? 1.0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] opacity-35 w-5" style={{color: ac}}>0</span>
                                                <input
                                                    type="range" min={0} max={1} step={0.01}
                                                    value={settings.topP ?? 1.0}
                                                    onChange={(e) => setSettings((s) => s ? {...s, topP: parseFloat(e.target.value)} : s)}
                                                    onMouseUp={(e) => applySettings({topP: parseFloat((e.target as HTMLInputElement).value)})}
                                                    onTouchEnd={(e) => applySettings({topP: parseFloat((e.target as HTMLInputElement).value)})}
                                                    className="flex-1"
                                                    style={{accentColor: ac}}
                                                />
                                                <span className="text-[9px] opacity-35 w-5 text-right" style={{color: ac}}>1</span>
                                            </div>
                                        </div>

                                        {/* OpenAI-specific: presence / frequency penalty */}
                                        {provider === "openai" && (
                                            <>
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Label accent={a}>Presence Penalty</Label>
                                                        <span className="text-[12px] tabular-nums" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{(settings.presencePenalty ?? 0).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] opacity-35 w-6" style={{color: ac}}>-2</span>
                                                        <input
                                                            type="range" min={-2} max={2} step={0.05}
                                                            value={settings.presencePenalty ?? 0}
                                                            onChange={(e) => setSettings((s) => s ? {...s, presencePenalty: parseFloat(e.target.value)} : s)}
                                                            onMouseUp={(e) => applySettings({presencePenalty: parseFloat((e.target as HTMLInputElement).value)})}
                                                            onTouchEnd={(e) => applySettings({presencePenalty: parseFloat((e.target as HTMLInputElement).value)})}
                                                            className="flex-1"
                                                            style={{accentColor: ac}}
                                                        />
                                                        <span className="text-[9px] opacity-35 w-6 text-right" style={{color: ac}}>+2</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Label accent={a}>Frequency Penalty</Label>
                                                        <span className="text-[12px] tabular-nums" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{(settings.frequencyPenalty ?? 0).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] opacity-35 w-6" style={{color: ac}}>-2</span>
                                                        <input
                                                            type="range" min={-2} max={2} step={0.05}
                                                            value={settings.frequencyPenalty ?? 0}
                                                            onChange={(e) => setSettings((s) => s ? {...s, frequencyPenalty: parseFloat(e.target.value)} : s)}
                                                            onMouseUp={(e) => applySettings({frequencyPenalty: parseFloat((e.target as HTMLInputElement).value)})}
                                                            onTouchEnd={(e) => applySettings({frequencyPenalty: parseFloat((e.target as HTMLInputElement).value)})}
                                                            className="flex-1"
                                                            style={{accentColor: ac}}
                                                        />
                                                        <span className="text-[9px] opacity-35 w-6 text-right" style={{color: ac}}>+2</span>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Mistral-specific: safe mode */}
                                        {provider === "mistral" && (
                                            <div className="flex items-center justify-between py-1">
                                                <div>
                                                    <Label accent={a}>Safe Mode (safe_prompt)</Label>
                                                    <p className="text-[10px] opacity-30 leading-relaxed" style={{color: ac}}>Otomatik güvenlik system prompt'u ekler</p>
                                                </div>
                                                <button
                                                    onClick={() => applySettings({mistralSafeMode: !(settings.mistralSafeMode ?? false)})}
                                                    className="shrink-0 w-10 h-5 rounded-full relative transition"
                                                    style={{background: settings.mistralSafeMode ? `rgba(${a},0.5)` : `rgba(${a},0.1)`, border: `1px solid rgba(${a},0.3)`}}
                                                >
                                                    <span className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all" style={{background: ac, left: settings.mistralSafeMode ? "calc(100% - 18px)" : "2px"}} />
                                                </button>
                                            </div>
                                        )}

                                        {/* Reset params */}
                                        <button
                                            onClick={() => applySettings({temperature: 0.7, maxTokens: 8192, topP: 1.0, presencePenalty: 0, frequencyPenalty: 0})}
                                            className="text-[10px] tracking-widest opacity-30 hover:opacity-70 transition"
                                            style={{color: ac}}
                                        >
                                            ↺ VARSAYILANA SIFIRLA
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* UI Skin */}
                            <Group label="UI SKIN" accent={a}>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        {id: "hologram",  icon: "◎", label: "Hologram",  sub: "3D globe · HUD"},
                                        {id: "minimal",   icon: "—", label: "Minimal",   sub: "Sade · metin"},
                                        {id: "terminal",  icon: ">", label: "Terminal",  sub: "CLI emülatörü"},
                                        {id: "dashboard", icon: "▦", label: "Dashboard", sub: "Widget grid"},
                                    ] as const).map((s) => {
                                        const isActive = settings.skin === s.id;
                                        return (
                                            <button key={s.id} onClick={() => applySettings({skin: s.id})}
                                                className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-left transition"
                                                style={{background: isActive ? `rgba(${a},0.1)` : "transparent", border: `1px solid ${isActive ? `rgba(${a},0.35)` : `rgba(${a},0.08)`}`}}>
                                                <span className="text-base w-5" style={{color: isActive ? ac : `rgba(${a},0.35)`}}>{s.icon}</span>
                                                <span className="text-[12px] font-medium mt-1" style={{color: isActive ? ac : `rgba(${a},0.65)`}}>{s.label}</span>
                                                <span className="text-[10px] opacity-50 mt-0.5" style={{color: ac}}>{s.sub}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Group>

                            {/* Accent color */}
                            <Group label="TEMA RENGİ" accent={a}>
                                <div className="grid grid-cols-6 gap-2.5 pt-1">
                                    {ACCENT_COLORS.map((c) => {
                                        const active = settings.accentColor === c.id;
                                        return (
                                            <button key={c.id} onClick={() => applySettings({accentColor: c.id})} title={c.label}
                                                className="w-full aspect-square rounded-full transition hover:scale-110"
                                                style={{background: c.hex, boxShadow: active ? `0 0 0 2px #0a0f1e, 0 0 0 3.5px ${c.hex}, 0 0 14px ${c.hex}99` : `inset 0 0 0 1px rgba(255,255,255,0.1)`}} />
                                        );
                                    })}
                                </div>
                            </Group>
                        </div>
                    )}

                    {/* ════ VOICE TAB ════ */}
                    {tab === "voice" && (
                        <div className="p-5 space-y-7">
                            <Group label="DİL / LANGUAGE" accent={a}>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {LANGUAGES.map((l) => {
                                        const active = (settings.language ?? "tr") === l.id;
                                        return (
                                            <button key={l.id} onClick={() => applySettings({language: l.id})}
                                                className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg transition"
                                                style={{background: active ? `rgba(${a},0.12)` : "transparent", border: `1px solid ${active ? `rgba(${a},0.4)` : `rgba(${a},0.08)`}`}}>
                                                <span className="text-base leading-none">{l.flag}</span>
                                                <span className="text-[10px] font-medium leading-tight" style={{color: active ? ac : `rgba(${a},0.5)`}}>{l.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <Hint accent={a}>Dil değişince sistem prompt, Whisper ve TTS sesi otomatik güncellenir.</Hint>
                            </Group>

                            <Group label="TTS MOTORU" accent={a}>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        {id: "edge",       icon: "◎", label: "Edge TTS",   sub: "Ücretsiz · offline"},
                                        {id: "elevenlabs", icon: "♬", label: "ElevenLabs", sub: "API key gerekli"},
                                    ].map((p) => {
                                        const active = settings.ttsProvider === p.id;
                                        return (
                                            <button key={p.id} onClick={() => {
                                                const dv = p.id === "elevenlabs" ? "el:cgSgspJ2msm6clMCkdW9" : "tr-TR-EmelNeural";
                                                applySettings({ttsProvider: p.id as "edge" | "elevenlabs", ttsVoice: dv});
                                            }}
                                                className="flex flex-col gap-0.5 px-3.5 py-3 rounded-lg text-left transition"
                                                style={{background: active ? `rgba(${a},0.1)` : "transparent", border: `1px solid ${active ? `rgba(${a},0.35)` : `rgba(${a},0.1)`}`}}>
                                                <span className="text-xl" style={{color: active ? ac : `rgba(${a},0.35)`}}>{p.icon}</span>
                                                <span className="text-[13px] font-medium mt-1" style={{color: active ? ac : `rgba(${a},0.65)`}}>{p.label}</span>
                                                <span className="text-[11px] opacity-50 mt-0.5" style={{color: ac}}>{p.sub}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Group>

                            {settings.ttsProvider === "elevenlabs" && (
                                <Group label="ELEVENLABS API KEY" accent={a}>
                                    <KeyField value={config?.elevenlabsApiKey ?? ""} placeholder="sk_..." onSave={(v) => applyConfig({elevenlabsApiKey: v || undefined})} accent={a} />
                                </Group>
                            )}

                            <Group label="SES" accent={a}>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {voices.map((v) => {
                                        const active = settings.ttsVoice === v.id;
                                        return (
                                            <button key={v.id} onClick={() => applySettings({ttsVoice: v.id})}
                                                className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-left transition"
                                                style={{background: active ? `rgba(${a},0.1)` : "transparent", border: `1px solid ${active ? `rgba(${a},0.3)` : `rgba(${a},0.08)`}`}}>
                                                <span className="text-[13px] font-medium" style={{color: active ? ac : `rgba(${a},0.7)`}}>{v.label}</span>
                                                <span className="text-[11px] opacity-50 mt-0.5" style={{color: ac}}>{v.meta}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Group>

                            <Group label="KONUŞMA HIZI" accent={a}>
                                <div className="flex items-center gap-3 px-1">
                                    <span className="text-[10px] opacity-40 w-7" style={{color: ac}}>0.5x</span>
                                    <input type="range" min={0.5} max={2.0} step={0.1}
                                        value={settings.ttsRate}
                                        onChange={(e) => setSettings((s) => s ? {...s, ttsRate: parseFloat(e.target.value)} : s)}
                                        onMouseUp={(e) => applySettings({ttsRate: parseFloat((e.target as HTMLInputElement).value)})}
                                        onTouchEnd={(e) => applySettings({ttsRate: parseFloat((e.target as HTMLInputElement).value)})}
                                        className="flex-1" style={{accentColor: ac}} />
                                    <span className="text-[10px] opacity-40 w-7 text-right" style={{color: ac}}>2.0x</span>
                                    <span className="text-[13px] w-10 text-right tabular-nums" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{settings.ttsRate.toFixed(1)}x</span>
                                </div>
                            </Group>

                            <Group label="SES TESTİ" accent={a}>
                                <button onClick={testVoice} disabled={testing}
                                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-[11px] tracking-widest transition hover:brightness-125 disabled:opacity-40"
                                    style={{color: ac, borderColor: `rgba(${a},0.3)`, background: `rgba(${a},0.07)`}}>
                                    {testing ? <><span className="w-2 h-2 rounded-full animate-pulse" style={{background: ac}} />ÇALINIYOR…</> : <>▶ MERHABA, BEN AEGIS</>}
                                </button>
                                <Hint accent={a}>{settings.ttsProvider === "elevenlabs" ? "ElevenLabs" : "Edge TTS"} motoru kullanılır.</Hint>
                            </Group>
                        </div>
                    )}

                    {/* ════ APPEARANCE TAB ════ */}
                    {tab === "appearance" && (
                        <div className="p-5 space-y-7">
                            <Group label="FONT" accent={a}>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        {id: "jetbrains",    label: "JetBrains",     sub: "Mono · varsayılan", family: "'JetBrains Mono', monospace"},
                                        {id: "sharetech",    label: "Share Tech",    sub: "Mono · retro",      family: "'Share Tech Mono', monospace"},
                                        {id: "orbitron",     label: "Orbitron",      sub: "Sci-fi · display",  family: "Orbitron"},
                                        {id: "oxanium",      label: "Oxanium",       sub: "Sci-fi · modern",   family: "Oxanium"},
                                        {id: "syne",         label: "Syne",          sub: "Geometric · bold",  family: "Syne"},
                                        {id: "rajdhani",     label: "Rajdhani",      sub: "Sans · sharp",      family: "Rajdhani"},
                                        {id: "poppins",      label: "Poppins",       sub: "Sans · yuvarlak",   family: "Poppins"},
                                        {id: "inter",        label: "Inter",         sub: "Sans · okunaklı",   family: "Inter"},
                                        {id: "spacegrotesk", label: "Space Grotesk", sub: "Grotesque · techy", family: "'Space Grotesk'"},
                                    ] as const).map((f) => {
                                        const active = (settings.font ?? "jetbrains") === f.id;
                                        return (
                                            <button key={f.id} onClick={() => applySettings({font: f.id})}
                                                className="flex flex-col gap-0.5 px-2.5 py-2 rounded-lg text-left transition"
                                                style={{background: active ? `rgba(${a},0.1)` : "transparent", border: `1px solid ${active ? `rgba(${a},0.35)` : `rgba(${a},0.08)`}`}}>
                                                <span className="text-[13px] font-medium leading-tight" style={{color: active ? ac : `rgba(${a},0.65)`, fontFamily: f.family}}>{f.label}</span>
                                                <span className="text-[10px] opacity-50 mt-0.5 leading-tight" style={{color: ac}}>{f.sub}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Group>

                            <Group label="LAYOUT" accent={a}>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        {id: "normal",  label: "Normal",  sub: "Standart boşluklar"},
                                        {id: "compact", label: "Kompakt", sub: "Daha sık, daha fazla içerik"},
                                    ] as const).map((l) => {
                                        const active = (settings.layout ?? "normal") === l.id;
                                        return (
                                            <button key={l.id} onClick={() => applySettings({layout: l.id})}
                                                className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-left transition"
                                                style={{background: active ? `rgba(${a},0.1)` : "transparent", border: `1px solid ${active ? `rgba(${a},0.35)` : `rgba(${a},0.08)`}`}}>
                                                <span className="text-[13px] font-medium" style={{color: active ? ac : `rgba(${a},0.65)`}}>{l.label}</span>
                                                <span className="text-[11px] opacity-50 mt-0.5" style={{color: ac}}>{l.sub}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Group>

                            <Group label="ÖZEL CSS" accent={a}>
                                <CustomCssField value={settings.customCss ?? ""} onSave={(v) => applySettings({customCss: v})} accent={a} />
                                <Hint accent={a}>CSS değişkenlerini ve class'ları override edebilirsin. Örn: :root {"{ --hud: 255,100,50; }"}</Hint>
                            </Group>

                            <Group label="UYGULAMA" accent={a}>
                                {([
                                    {key: "minimizeToTray" as const, label: "Kapatınca sistem tepsisine küçült", sub: "Pencereyi kapatmak uygulamayı sonlandırmaz"},
                                    {key: "autoLaunch"     as const, label: "Windows başlangıcında otomatik başlat", sub: "Oturum açılınca AEGIS arka planda başlar"},
                                ] as const).map(({key, label, sub}) => {
                                    const active = !!(settings as unknown as Record<string, unknown>)[key];
                                    return (
                                        <button key={key} onClick={() => applySettings({[key]: !active} as Partial<typeof settings>)}
                                            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-left transition"
                                            style={{background: active ? `rgba(${a},0.08)` : "transparent", border: `1px solid ${active ? `rgba(${a},0.3)` : `rgba(${a},0.08)`}`}}>
                                            <span className="w-8 h-5 rounded-full shrink-0 relative transition-all duration-200"
                                                style={{background: active ? `rgba(${a},0.55)` : `rgba(${a},0.1)`, border: `1px solid ${active ? `rgba(${a},0.7)` : `rgba(${a},0.2)`}`}}>
                                                <span className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all duration-200"
                                                    style={{background: active ? ac : `rgba(${a},0.35)`, left: active ? "calc(100% - 15px)" : "2px"}} />
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-[13px] font-medium" style={{color: active ? ac : `rgba(${a},0.65)`}}>{label}</span>
                                                <span className="block text-[10px] opacity-45 mt-0.5" style={{color: ac}}>{sub}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </Group>
                        </div>
                    )}

                    {/* ════ KEYS TAB ════ */}
                    {tab === "keys" && config && (
                        <div className="p-5 space-y-5">
                            <div className="text-[11px] opacity-35 leading-relaxed pb-1" style={{color: ac}}>
                                Groq + Supabase + arama servisleri buradan yapılandırılır. AI provider API key'leri için MODEL sekmesini kullan.
                            </div>
                            <KeyGroup label="GROQ" hint="gsk_..." value={config.groqApiKey} onSave={(v) => applyConfig({groqApiKey: v})} accent={a} />
                            <KeyGroup label="SUPABASE URL" hint="https://xxxx.supabase.co" value={config.supabaseUrl} onSave={(v) => applyConfig({supabaseUrl: v})} accent={a} />
                            <KeyGroup label="SUPABASE SERVICE ROLE KEY" hint="eyJ..." value={config.supabaseServiceKey} onSave={(v) => applyConfig({supabaseServiceKey: v})} accent={a} />
                            <KeyGroup label="TAVILY" hint="tvly-... (opsiyonel)" value={config.tavilyApiKey ?? ""} onSave={(v) => applyConfig({tavilyApiKey: v || undefined})} accent={a} />
                            <KeyGroup label="SERPER" hint="opsiyonel" value={config.serperApiKey ?? ""} onSave={(v) => applyConfig({serperApiKey: v || undefined})} accent={a} />
                            <KeyGroup label="ELEVENLABS" hint="sk_... (opsiyonel)" value={config.elevenlabsApiKey ?? ""} onSave={(v) => applyConfig({elevenlabsApiKey: v || undefined})} accent={a} />
                        </div>
                    )}

                    {/* ════ TELEMETRY TAB ════ */}
                    {tab === "telemetry" && (
                        <div className="p-5 space-y-7">
                            <Group label="GÖRÜNTÜLENECEK WIDGET'LAR" accent={a}>
                                <p className="text-[11px] opacity-40 mb-3 leading-relaxed" style={{color: ac}}>Sol panelde hangi telemetri bloklarının görüneceğini seç.</p>
                                <div className="space-y-2">
                                    {([
                                        {id: "cpu",          label: "CPU",             sub: "Kullanım, sıcaklık, çekirdekler, frekans"},
                                        {id: "ram",          label: "RAM",             sub: "Kullanım %, MB cinsinden detay"},
                                        {id: "disk",         label: "Diskler",         sub: "Tüm sürücüler — kullanım + GB"},
                                        {id: "battery",      label: "Batarya",         sub: "Şarj seviyesi ve şarj durumu"},
                                        {id: "network",      label: "Ağ",              sub: "Upload / download hızı + adapter"},
                                        {id: "gpu",          label: "GPU",             sub: "Yük %, VRAM, sıcaklık"},
                                        {id: "fans",         label: "Fanlar",          sub: "Fan hızları RPM (destekleniyorsa)"},
                                        {id: "processes",    label: "Top Process",     sub: "En çok RAM kullanan 8 process"},
                                        {id: "system",       label: "Sistem Bilgisi",  sub: "Hostname, makine modeli"},
                                        {id: "activeWindow", label: "Aktif Pencere",   sub: "Şu an odakta olan uygulama"},
                                    ] as {id: TelemetryWidget; label: string; sub: string}[]).map((w) => {
                                        const active = (settings.telemetryWidgets ?? []).includes(w.id);
                                        return (
                                            <button key={w.id} onClick={() => {
                                                const current = settings.telemetryWidgets ?? [];
                                                const next = active ? current.filter((x) => x !== w.id) : [...current, w.id];
                                                applySettings({telemetryWidgets: next});
                                                onTelemetryWidgetsChange(next);
                                            }}
                                                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition"
                                                style={{background: active ? `rgba(${a},0.1)` : "transparent", border: `1px solid ${active ? `rgba(${a},0.35)` : `rgba(${a},0.08)`}`}}>
                                                <span className="w-4 h-4 rounded shrink-0 border grid place-items-center text-[10px]"
                                                    style={{borderColor: active ? ac : `rgba(${a},0.3)`, background: active ? `rgba(${a},0.2)` : "transparent", color: ac}}>
                                                    {active ? "✓" : ""}
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[13px] font-medium" style={{color: active ? ac : `rgba(${a},0.65)`}}>{w.label}</span>
                                                    <span className="block text-[10px] opacity-45 mt-0.5" style={{color: ac}}>{w.sub}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => {
                                        const all: TelemetryWidget[] = ["cpu","ram","disk","battery","network","gpu","fans","processes","system","activeWindow"];
                                        applySettings({telemetryWidgets: all});
                                        onTelemetryWidgetsChange(all);
                                    }} className="flex-1 py-2 rounded-lg text-[11px] tracking-widest border transition hover:brightness-125"
                                        style={{borderColor: `rgba(${a},0.25)`, color: `rgba(${a},0.7)`}}>
                                        TÜMÜNÜ SEÇ
                                    </button>
                                    <button onClick={() => {
                                        applySettings({telemetryWidgets: []});
                                        onTelemetryWidgetsChange([]);
                                    }} className="flex-1 py-2 rounded-lg text-[11px] tracking-widest border transition hover:brightness-125"
                                        style={{borderColor: `rgba(${a},0.25)`, color: `rgba(${a},0.7)`}}>
                                        TEMİZLE
                                    </button>
                                </div>
                            </Group>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Primitive helpers ─────────────────────────────────────────────────────

function Group({label, accent, children}: {label: string; accent: string; children: React.ReactNode}) {
    return (
        <div className="space-y-3">
            <div className="text-[10px] font-medium tracking-[0.35em] flex items-center gap-2" style={{color: `rgba(${accent},0.55)`}}>
                <span className="flex-1 border-t" style={{borderColor: `rgba(${accent},0.1)`}} />
                {label}
                <span className="flex-1 border-t" style={{borderColor: `rgba(${accent},0.1)`}} />
            </div>
            {children}
        </div>
    );
}

function Label({accent, children}: {accent: string; children: React.ReactNode}) {
    return <div className="text-[11px] mb-1.5 opacity-50" style={{color: `rgb(${accent})`}}>{children}</div>;
}

function Hint({accent, children}: {accent: string; children: React.ReactNode}) {
    return <p className="text-[11px] mt-2 opacity-40 leading-relaxed" style={{color: `rgb(${accent})`}}>{children}</p>;
}

function KeyGroup({label, hint, value, onSave, accent}: {label: string; hint: string; value: string; onSave: (v: string) => void; accent: string}) {
    return (
        <div className="space-y-2">
            <div className="text-[11px] font-medium tracking-[0.2em] opacity-55" style={{color: `rgb(${accent})`}}>{label}</div>
            <KeyField value={value} placeholder={hint} onSave={onSave} accent={accent} />
        </div>
    );
}

// Key field with provider-specific placeholder
function ProviderKeyField({value, provider, onSave, accent}: {value: string; provider: string; onSave: (v: string) => void; accent: string}) {
    const placeholder: Record<string, string> = {
        openai:    "sk-...",
        anthropic: "sk-ant-...",
        mistral:   "...",
        gemini:    "AIza...",
        xai:       "xai-...",
        deepseek:  "sk-...",
    };
    return <KeyField value={value} placeholder={placeholder[provider] ?? "..."} onSave={onSave} accent={accent} />;
}

function KeyField({value, placeholder, onSave, accent}: {value: string; placeholder: string; onSave: (v: string) => void; accent: string}) {
    const [val, setVal] = useState(value);
    const [show, setShow] = useState(false);
    const changed = val !== value;
    const ac = `rgb(${accent})`;

    // Sync if parent value changes (provider switch)
    useEffect(() => { setVal(value); }, [value]);

    return (
        <div className="flex gap-2">
            <input
                type={show ? "text" : "password"}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder={placeholder}
                className="flex-1 min-w-0 bg-transparent rounded-lg px-3 py-2 text-[12px] outline-none border transition"
                style={{borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.12)`, color: ac}}
            />
            <button onClick={() => setShow((s) => !s)}
                className="px-2.5 rounded-lg border text-[9px] tracking-wider transition opacity-35 hover:opacity-80 shrink-0"
                style={{borderColor: `rgba(${accent},0.15)`, color: ac}}>
                {show ? "GİZLE" : "GÖR"}
            </button>
            {changed && (
                <button onClick={() => onSave(val)}
                    className="px-3 rounded-lg border text-[9px] tracking-widest transition hover:brightness-125 shrink-0"
                    style={{borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.1)`, color: ac}}>
                    ✓
                </button>
            )}
        </div>
    );
}

function CustomCssField({value, onSave, accent}: {value: string; onSave: (v: string) => void; accent: string}) {
    const [val, setVal] = useState(value);
    const changed = val !== value;
    const ac = `rgb(${accent})`;

    return (
        <div className="space-y-2">
            <textarea
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder={".my-class { color: red; }"}
                rows={6}
                className="w-full bg-transparent rounded-lg px-3 py-2 text-[11px] outline-none border transition resize-none"
                style={{borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.12)`, color: ac, fontFamily: "'JetBrains Mono', monospace"}}
            />
            {changed && (
                <button onClick={() => onSave(val)}
                    className="px-3 py-1.5 rounded-lg border text-[9px] tracking-widest transition hover:brightness-125"
                    style={{borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.1)`, color: ac}}>
                    ✓ UYGULA
                </button>
            )}
        </div>
    );
}

function PlainField({value, placeholder, onSave, accent}: {value: string; placeholder: string; onSave: (v: string) => void; accent: string}) {
    const [val, setVal] = useState(value);
    const changed = val !== value;
    const ac = `rgb(${accent})`;

    useEffect(() => { setVal(value); }, [value]);

    return (
        <div className="flex gap-2">
            <input
                type="text"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder={placeholder}
                className="flex-1 min-w-0 bg-transparent rounded-lg px-3 py-2 text-[12px] outline-none border transition"
                style={{borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.12)`, color: ac}}
            />
            {changed && (
                <button onClick={() => onSave(val)}
                    className="px-3 rounded-lg border text-[9px] tracking-widest transition hover:brightness-125 shrink-0"
                    style={{borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.1)`, color: ac}}>
                    ✓
                </button>
            )}
        </div>
    );
}
