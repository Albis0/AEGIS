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
    {id: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick",   tag: "yeni",       ctx: "1M"},
    {id: "meta-llama/llama-4-scout-17b-16e-instruct",    label: "Llama 4 Scout",       tag: "hızlı",      ctx: "128K"},
    {id: "qwen/qwen3-32b",                               label: "Qwen3 32B",            tag: "varsayılan", ctx: "128K"},
    {id: "qwen/qwen3-70b",                               label: "Qwen3 70B",            tag: "güçlü",      ctx: "128K"},
    {id: "deepseek-r1-distill-llama-70b",                label: "DeepSeek-R1 Distill",  tag: "reasoning",  ctx: "128K"},
    {id: "llama-3.3-70b-versatile",                      label: "Llama 3.3 70B",        tag: "",           ctx: "128K"},
    {id: "llama-3.1-70b-versatile",                      label: "Llama 3.1 70B",        tag: "",           ctx: "128K"},
    {id: "llama3-70b-8192",                              label: "Llama 3 70B",           tag: "",           ctx: "8K"},
    {id: "llama-3.1-8b-instant",                         label: "Llama 3.1 8B",         tag: "hızlı",      ctx: "128K"},
    {id: "gemma2-9b-it",                                 label: "Gemma2 9B",            tag: "",           ctx: "8K"},
    {id: "mixtral-8x7b-32768",                           label: "Mixtral 8×7B",         tag: "klasik",     ctx: "32K"},
];

const OPENAI_MODELS: ModelEntry[] = [
    {id: "gpt-4.1",          label: "GPT-4.1",          tag: "yeni",      ctx: "1M",   note: "Flagship"},
    {id: "gpt-4.1-mini",     label: "GPT-4.1 Mini",     tag: "hızlı",     ctx: "1M"},
    {id: "gpt-4.1-nano",     label: "GPT-4.1 Nano",     tag: "ekonomik",  ctx: "1M"},
    {id: "o4-mini",          label: "o4-mini",          tag: "reasoning", ctx: "200K"},
    {id: "o3",               label: "o3",               tag: "güçlü",     ctx: "200K", note: "Yavaş"},
    {id: "gpt-4o",           label: "GPT-4o",           tag: "önerilen",  ctx: "128K"},
    {id: "gpt-4o-mini",      label: "GPT-4o Mini",      tag: "",          ctx: "128K"},
    {id: "o1",               label: "o1",               tag: "reasoning", ctx: "200K"},
    {id: "o1-mini",          label: "o1-mini",          tag: "hızlı",     ctx: "128K"},
    {id: "gpt-4-turbo",      label: "GPT-4 Turbo",      tag: "eski",      ctx: "128K"},
    {id: "gpt-3.5-turbo",    label: "GPT-3.5 Turbo",    tag: "ucuz",      ctx: "16K"},
];

const ANTHROPIC_MODELS: ModelEntry[] = [
    {id: "claude-opus-4-8",           label: "Claude Opus 4",      tag: "güçlü",     ctx: "200K"},
    {id: "claude-sonnet-4-6",         label: "Claude Sonnet 4",    tag: "varsayılan",ctx: "200K"},
    {id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4",     tag: "hızlı",     ctx: "200K"},
    {id: "claude-3-7-sonnet-20250219",label: "Claude 3.7 Sonnet",  tag: "thinking",  ctx: "200K"},
    {id: "claude-3-5-sonnet-20241022",label: "Claude 3.5 Sonnet",  tag: "",          ctx: "200K"},
    {id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku",   tag: "hızlı",     ctx: "200K"},
    {id: "claude-3-opus-20240229",    label: "Claude 3 Opus",      tag: "eski",      ctx: "200K"},
];

const GEMINI_MODELS: ModelEntry[] = [
    {id: "gemini-2.5-pro",           label: "Gemini 2.5 Pro",       tag: "güçlü",     ctx: "1M",  note: "Düşünen"},
    {id: "gemini-2.5-flash",         label: "Gemini 2.5 Flash",     tag: "varsayılan",ctx: "1M",  note: "Hızlı+Düşünen"},
    {id: "gemini-2.5-flash-lite",    label: "Gemini 2.5 Flash Lite",tag: "ekonomik",  ctx: "1M"},
    {id: "gemini-2.0-flash",         label: "Gemini 2.0 Flash",     tag: "stabil",    ctx: "1M"},
    {id: "gemini-2.0-flash-lite",    label: "Gemini 2.0 Flash Lite",tag: "hızlı",     ctx: "1M"},
    {id: "gemini-1.5-pro",           label: "Gemini 1.5 Pro",       tag: "",          ctx: "2M"},
    {id: "gemini-1.5-flash",         label: "Gemini 1.5 Flash",     tag: "",          ctx: "1M"},
];

const MISTRAL_MODELS: ModelEntry[] = [
    {id: "mistral-large-latest",  label: "Mistral Large",    tag: "varsayılan", ctx: "128K"},
    {id: "mistral-medium-3",      label: "Mistral Medium 3", tag: "",           ctx: "128K"},
    {id: "mistral-small-latest",  label: "Mistral Small",    tag: "hızlı",      ctx: "32K"},
    {id: "mistral-saba-latest",   label: "Mistral Saba",     tag: "çok dilli",  ctx: "32K"},
    {id: "codestral-latest",      label: "Codestral",        tag: "kod",        ctx: "256K"},
    {id: "pixtral-large-latest",  label: "Pixtral Large",    tag: "vizyon",     ctx: "128K"},
    {id: "mistral-nemo",          label: "Mistral Nemo",     tag: "açık",       ctx: "128K"},
    {id: "open-mixtral-8x22b",    label: "Mixtral 8×22B",    tag: "açık",       ctx: "64K"},
    {id: "open-mixtral-8x7b",     label: "Mixtral 8×7B",     tag: "açık",       ctx: "32K"},
    {id: "open-mistral-7b",       label: "Mistral 7B",       tag: "açık",       ctx: "32K"},
];

const XAI_MODELS: ModelEntry[] = [
    {id: "grok-3",              label: "Grok 3",              tag: "güçlü",     ctx: "131K"},
    {id: "grok-3-mini",         label: "Grok 3 Mini",         tag: "varsayılan",ctx: "131K", note: "Reasoning"},
    {id: "grok-3-fast",         label: "Grok 3 Fast",         tag: "hızlı",     ctx: "131K"},
    {id: "grok-2-1212",         label: "Grok 2",              tag: "stabil",    ctx: "131K"},
    {id: "grok-2-vision-1212",  label: "Grok 2 Vision",       tag: "vizyon",    ctx: "32K"},
];

const DEEPSEEK_MODELS: ModelEntry[] = [
    {id: "deepseek-chat",     label: "DeepSeek V3",     tag: "varsayılan", ctx: "64K",  note: "Çok güçlü"},
    {id: "deepseek-reasoner", label: "DeepSeek R1",     tag: "reasoning",  ctx: "64K",  note: "Adım adım"},
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
    groq:      "qwen/qwen3-32b",
    openai:    "gpt-4.1",
    anthropic: "claude-sonnet-4-6",
    gemini:    "gemini-2.5-flash",
    mistral:   "mistral-large-latest",
    xai:       "grok-3-mini",
    deepseek:  "deepseek-chat",
    ollama:    "llama3.2",
};

// ── Provider definitions ───────────────────────────────────────────────────
const AI_PROVIDERS = [
    {id: "groq",      icon: "⚡", label: "Groq",       sub: "Ultra hızlı · ücretsiz",  badge: "free"},
    {id: "openai",    icon: "◎",  label: "OpenAI",     sub: "GPT-4.1 · o4 serisi",     badge: ""},
    {id: "anthropic", icon: "◈",  label: "Anthropic",  sub: "Claude 4 serisi",         badge: ""},
    {id: "gemini",    icon: "◇",  label: "Gemini",     sub: "Google · 1M context",     badge: "free"},
    {id: "mistral",   icon: "✦",  label: "Mistral",    sub: "EU · açık kaynak",        badge: ""},
    {id: "xai",       icon: "✧",  label: "xAI / Grok", sub: "Gerçek zamanlı web",     badge: ""},
    {id: "deepseek",  icon: "◆",  label: "DeepSeek",   sub: "Güçlü · ekonomik",       badge: ""},
    {id: "ollama",    icon: "◉",  label: "Ollama",     sub: "Yerel · tam offline",     badge: "local"},
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
    {id: "el:21m00Tcm4TlvDq8ikWAM", label: "Rachel", meta: "EN · Kadın"},
    {id: "el:AZnzlk1XvdvUeBnXmlld", label: "Domi",   meta: "EN · Kadın"},
    {id: "el:EXAVITQu4vr4xnSDxMaL", label: "Bella",  meta: "EN · Kadın"},
    {id: "el:ErXwobaYiN019PkySvjV",  label: "Antoni", meta: "EN · Erkek"},
    {id: "el:VR6AewLTigWG4xSOukaG",  label: "Arnold", meta: "EN · Erkek"},
    {id: "el:pNInz6obpgDQGcFmaJgB",  label: "Adam",   meta: "EN · Erkek"},
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
        if (tag === "reasoning") return "rgba(192,132,252,0.9)";
        if (tag === "thinking") return "rgba(192,132,252,0.9)";
        if (tag === "ekonomik") return "rgba(74,222,128,0.7)";
        if (tag === "vizyon") return "rgba(56,189,248,0.9)";
        if (tag === "kod") return "rgba(56,189,248,0.9)";
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
                                                const dv = p.id === "elevenlabs" ? "el:21m00Tcm4TlvDq8ikWAM" : "tr-TR-EmelNeural";
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
