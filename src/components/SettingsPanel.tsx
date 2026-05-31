import {useEffect, useRef, useState} from "react";
import type {AppSettings, AegisConfig} from "../electron.d";

// ── Model catalogs ──────────────────────────────────────────────────────────
const GROQ_MODELS = [
    {id: "qwen/qwen3-32b",          label: "Qwen3 32B",         tag: "varsayılan"},
    {id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B",     tag: ""},
    {id: "llama3-70b-8192",         label: "Llama 3 70B",        tag: ""},
    {id: "mixtral-8x7b-32768",      label: "Mixtral 8×7B",       tag: ""},
    {id: "gemma2-9b-it",            label: "Gemma2 9B",          tag: "hızlı"},
];
const OPENAI_MODELS = [
    {id: "gpt-4o",        label: "GPT-4o",       tag: "önerilen"},
    {id: "gpt-4o-mini",   label: "GPT-4o Mini",  tag: "hızlı"},
    {id: "gpt-4-turbo",   label: "GPT-4 Turbo",  tag: ""},
    {id: "gpt-3.5-turbo", label: "GPT-3.5",       tag: "ucuz"},
];
const ANTHROPIC_MODELS = [
    {id: "claude-opus-4-8",           label: "Claude Opus 4",   tag: "güçlü"},
    {id: "claude-sonnet-4-6",         label: "Claude Sonnet 4", tag: "önerilen"},
    {id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4",  tag: "hızlı"},
];
const MISTRAL_MODELS = [
    {id: "mistral-large-latest", label: "Mistral Large",  tag: "önerilen"},
    {id: "mistral-small-latest", label: "Mistral Small",  tag: "hızlı"},
    {id: "codestral-latest",     label: "Codestral",      tag: "kod"},
];

const AI_PROVIDERS = [
    {id: "groq",      icon: "⚡", label: "Groq",       sub: "Ücretsiz · hızlı"},
    {id: "openai",    icon: "◎",  label: "OpenAI",     sub: "GPT-4o serisi"},
    {id: "anthropic", icon: "◈",  label: "Anthropic",  sub: "Claude serisi"},
    {id: "mistral",   icon: "✦",  label: "Mistral",    sub: "EU tabanlı"},
    {id: "ollama",    icon: "◉",  label: "Ollama",     sub: "Yerel · offline"},
] as const;

const EDGE_VOICES = [
    {id: "tr-TR-EmelNeural",  label: "Emel",   meta: "TR · Kadın"},
    {id: "tr-TR-AhmetNeural", label: "Ahmet",  meta: "TR · Erkek"},
    {id: "en-US-AriaNeural",  label: "Aria",   meta: "EN · Kadın"},
    {id: "en-US-GuyNeural",   label: "Guy",    meta: "EN · Erkek"},
    {id: "en-GB-SoniaNeural", label: "Sonia",  meta: "EN-GB · Kadın"},
    {id: "de-DE-KatjaNeural", label: "Katja",  meta: "DE · Kadın"},
    {id: "de-DE-ConradNeural",label: "Conrad", meta: "DE · Erkek"},
    {id: "fr-FR-DeniseNeural",label: "Denise", meta: "FR · Kadın"},
    {id: "fr-FR-HenriNeural", label: "Henri",  meta: "FR · Erkek"},
    {id: "es-ES-ElviraNeural",label: "Elvira", meta: "ES · Kadın"},
    {id: "es-ES-AlvaroNeural",label: "Alvaro", meta: "ES · Erkek"},
];

const LANGUAGES = [
    {id: "tr", flag: "🇹🇷", label: "Türkçe"},
    {id: "en", flag: "🇬🇧", label: "English"},
    {id: "de", flag: "🇩🇪", label: "Deutsch"},
    {id: "fr", flag: "🇫🇷", label: "Français"},
    {id: "es", flag: "🇪🇸", label: "Español"},
] as const;
const EL_VOICES = [
    {id: "el:21m00Tcm4TlvDq8ikWAM", label: "Rachel", meta: "EN · Kadın"},
    {id: "el:AZnzlk1XvdvUeBnXmlld", label: "Domi",   meta: "EN · Kadın"},
    {id: "el:EXAVITQu4vr4xnSDxMaL", label: "Bella",  meta: "EN · Kadın"},
    {id: "el:ErXwobaYiN019PkySvjV",  label: "Antoni", meta: "EN · Erkek"},
    {id: "el:VR6AewLTigWG4xSOukaG",  label: "Arnold", meta: "EN · Erkek"},
    {id: "el:pNInz6obpgDQGcFmaJgB",  label: "Adam",   meta: "EN · Erkek"},
];

const ACCENT_COLORS = [
    {id: "34,211,238",   label: "Cyan",        hex: "#22d3ee"},
    {id: "56,189,248",   label: "Sky",         hex: "#38bdf8"},
    {id: "99,102,241",   label: "Indigo",      hex: "#6366f1"},
    {id: "139,92,246",   label: "Purple",      hex: "#8b5cf6"},
    {id: "232,121,249",  label: "Fuchsia",     hex: "#e879f9"},
    {id: "251,113,133",  label: "Rose",        hex: "#fb7185"},
    {id: "248,113,113",  label: "Red",         hex: "#f87171"},
    {id: "251,146,60",   label: "Orange",      hex: "#fb923c"},
    {id: "250,204,21",   label: "Yellow",      hex: "#facc15"},
    {id: "163,230,53",   label: "Lime",        hex: "#a3e635"},
    {id: "110,231,183",  label: "Emerald",     hex: "#6ee7b7"},
    {id: "45,212,191",   label: "Teal",        hex: "#2dd4bf"},
];

type Tab = "model" | "voice" | "appearance" | "keys";

interface Props {
    open: boolean;
    onClose: () => void;
    onAccentChange: (rgb: string) => void;
    onSkinChange: (skin: AppSettings["skin"]) => void;
    onFontChange: (font: AppSettings["font"]) => void;
    onLayoutChange: (layout: AppSettings["layout"]) => void;
    onCustomCssChange: (css: string) => void;
}

export default function SettingsPanel({open, onClose, onAccentChange, onSkinChange, onFontChange, onLayoutChange, onCustomCssChange}: Props) {
    const [tab, setTab] = useState<Tab>("model");
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [config, setConfig]     = useState<AegisConfig | null>(null);
    const [saved, setSaved]       = useState(false);
    const [testing, setTesting]   = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            Promise.all([window.jarvis.settingsGet(), window.jarvis.configGet()])
                .then(([s, c]) => { setSettings(s); setConfig(c); });
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
            if (res.error || !res.buffer) {
                console.error("TTS error:", res.error ?? "no buffer");
                return;
            }
            const ctx = new AudioContext();
            // IPC serialises Node Buffer as {type:"Buffer", data:[...]}
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
    const modelList =
        settings.aiProvider === "openai"    ? OPENAI_MODELS    :
        settings.aiProvider === "anthropic" ? ANTHROPIC_MODELS :
        settings.aiProvider === "mistral"   ? MISTRAL_MODELS   :
        GROQ_MODELS;
    const voices = settings.ttsProvider === "elevenlabs" ? EL_VOICES : EDGE_VOICES;
    const currentProvider = AI_PROVIDERS.find((p) => p.id === settings.aiProvider);

    return (
        <div
            className="absolute inset-0 z-50 flex items-end justify-end"
            style={{background: "rgba(3,6,12,0.6)", backdropFilter: "blur(6px)"}}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={panelRef}
                className="relative flex flex-col h-full"
                style={{
                    width: "clamp(300px, 36vw, 440px)",
                    background: "rgba(4,8,18,0.98)",
                    borderLeft: `1px solid rgba(${a},0.18)`,
                    boxShadow: `-20px 0 60px rgba(${a},0.06)`,
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                }}
            >
                {/* ── Header ── */}
                <div
                    className="shrink-0 flex items-center justify-between px-5 py-4 border-b"
                    style={{borderColor: `rgba(${a},0.12)`}}
                >
                    <div>
                        <div
                            className="text-[13px] tracking-[0.45em] font-medium"
                            style={{fontFamily: "Orbitron, sans-serif", color: ac}}
                        >
                            AYARLAR
                        </div>
                        <div className="text-[11px] mt-0.5 opacity-50" style={{color: ac}}>
                            AEGIS yapılandırması
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {saved && (
                            <span
                                className="text-[10px] tracking-widest px-2 py-0.5 rounded"
                                style={{color: "#4ade80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)"}}
                            >
                                ✓ KAYDEDİLDİ
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="w-7 h-7 grid place-items-center rounded opacity-40 hover:opacity-100 transition text-sm"
                            style={{color: ac, border: `1px solid rgba(${a},0.2)`}}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div className="shrink-0 flex border-b" style={{borderColor: `rgba(${a},0.1)`}}>
                    {(["model", "voice", "appearance", "keys"] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className="flex-1 py-3 text-[10px] font-medium tracking-[0.2em] transition relative"
                            style={{color: tab === t ? ac : `rgba(${a},0.4)`}}
                        >
                            {t === "model" ? "MODEL" : t === "voice" ? "SES" : t === "appearance" ? "GÖRÜNÜM" : "API KEYS"}
                            {tab === t && (
                                <span
                                    className="absolute bottom-0 left-0 right-0 h-px"
                                    style={{background: `linear-gradient(90deg, transparent, ${ac}, transparent)`}}
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto">

                    {/* ════ MODEL TAB ════ */}
                    {tab === "model" && (
                        <div className="p-5 space-y-7">

                            {/* AI Provider */}
                            <Group label="AI SAĞLAYICI" accent={a}>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {AI_PROVIDERS.map((p) => {
                                        const active = settings.aiProvider === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    const defaultModel =
                                                        p.id === "openai"    ? "gpt-4o" :
                                                        p.id === "anthropic" ? "claude-sonnet-4-6" :
                                                        p.id === "mistral"   ? "mistral-large-latest" :
                                                        p.id === "ollama"    ? "llama3.2" :
                                                        "qwen/qwen3-32b";
                                                    applySettings({aiProvider: p.id as AppSettings["aiProvider"], model: defaultModel});
                                                }}
                                                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition"
                                                style={{
                                                    background: active ? `rgba(${a},0.1)` : "transparent",
                                                    border: `1px solid ${active ? `rgba(${a},0.35)` : `rgba(${a},0.08)`}`,
                                                }}
                                            >
                                                <span className="text-base w-5 text-center shrink-0" style={{color: active ? ac : `rgba(${a},0.4)`}}>
                                                    {p.icon}
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[13px] font-medium" style={{color: active ? ac : `rgba(${a},0.7)`}}>
                                                        {p.label}
                                                    </span>
                                                    <span className="block text-[11px] opacity-50 mt-0.5" style={{color: ac}}>
                                                        {p.sub}
                                                    </span>
                                                </span>
                                                {active && (
                                                    <span className="text-[10px] shrink-0" style={{color: ac}}>●</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Group>

                            {/* API Key for non-Groq */}
                            {settings.aiProvider !== "groq" && settings.aiProvider !== "ollama" && (
                                <Group label={`${currentProvider?.label?.toUpperCase()} API KEY`} accent={a}>
                                    <KeyField
                                        value={settings.aiApiKey}
                                        placeholder={
                                            settings.aiProvider === "openai" ? "sk-..." :
                                            settings.aiProvider === "anthropic" ? "sk-ant-..." : "..."}
                                        onSave={(v) => applySettings({aiApiKey: v})}
                                        accent={a}
                                    />
                                    <Hint accent={a}>settings.json içinde saklanır.</Hint>
                                </Group>
                            )}

                            {/* Ollama config */}
                            {settings.aiProvider === "ollama" && (
                                <Group label="OLLAMA" accent={a}>
                                    <div className="space-y-3">
                                        <div>
                                            <Label accent={a}>Sunucu URL</Label>
                                            <PlainField
                                                value={settings.ollamaUrl || "http://localhost:11434"}
                                                placeholder="http://localhost:11434"
                                                onSave={(v) => applySettings({ollamaUrl: v})}
                                                accent={a}
                                            />
                                        </div>
                                        <div>
                                            <Label accent={a}>Model adı</Label>
                                            <PlainField
                                                value={settings.model}
                                                placeholder="llama3.2, mistral, gemma2..."
                                                onSave={(v) => applySettings({model: v})}
                                                accent={a}
                                            />
                                        </div>
                                    </div>
                                    <Hint accent={a}>Ollama kapalıysa terminalde <code style={{color: `rgba(${a},0.7)`}}>ollama serve</code> çalıştır.</Hint>
                                </Group>
                            )}

                            {/* Model list for non-Ollama */}
                            {settings.aiProvider !== "ollama" && (
                                <Group label="MODEL" accent={a}>
                                    <div className="space-y-1">
                                        {modelList.map((m) => {
                                            const active = settings.model === m.id;
                                            return (
                                                <button
                                                    key={m.id}
                                                    onClick={() => applySettings({model: m.id})}
                                                    className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-left transition"
                                                    style={{
                                                        background: active ? `rgba(${a},0.08)` : "transparent",
                                                        border: `1px solid ${active ? `rgba(${a},0.25)` : "transparent"}`,
                                                    }}
                                                >
                                                    <span
                                                        className="w-2 h-2 rounded-full shrink-0 border"
                                                        style={{
                                                            borderColor: active ? `rgb(${a})` : `rgba(${a},0.3)`,
                                                            background: active ? `rgb(${a})` : "transparent",
                                                        }}
                                                    />
                                                    <span className="flex-1 text-[13px] font-medium" style={{color: active ? ac : `rgba(${a},0.65)`}}>
                                                        {m.label}
                                                    </span>
                                                    {"tag" in m && m.tag && (
                                                        <span
                                                            className="text-[10px] px-1.5 py-0.5 rounded tracking-wider shrink-0"
                                                            style={{
                                                                color: active ? ac : `rgba(${a},0.5)`,
                                                                background: active ? `rgba(${a},0.15)` : `rgba(${a},0.06)`,
                                                            }}
                                                        >
                                                            {m.tag}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </Group>
                            )}

                            {/* UI Skin */}
                            <Group label="UI SKIN" accent={a}>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        {id: "hologram",  icon: "◎", label: "Hologram",  sub: "3D globe · HUD panels"},
                                        {id: "minimal",   icon: "—", label: "Minimal",   sub: "Clean · text-only"},
                                        {id: "terminal",  icon: ">", label: "Terminal",  sub: "CLI emülatörü"},
                                        {id: "dashboard", icon: "▦", label: "Dashboard", sub: "Widget grid"},
                                    ] as const).map((s) => {
                                        const isActive = settings.skin === s.id;
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => applySettings({skin: s.id})}
                                                className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-left transition"
                                                style={{
                                                    background: isActive ? `rgba(${a},0.1)` : "transparent",
                                                    border: `1px solid ${isActive ? `rgba(${a},0.35)` : `rgba(${a},0.08)`}`,
                                                }}
                                            >
                                                <span className="text-base w-5" style={{color: isActive ? ac : `rgba(${a},0.35)`}}>{s.icon}</span>
                                                <span className="text-[13px] font-medium mt-1" style={{color: isActive ? ac : `rgba(${a},0.65)`}}>{s.label}</span>
                                                <span className="text-[11px] opacity-50 mt-0.5" style={{color: ac}}>{s.sub}</span>
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
                                            <button
                                                key={c.id}
                                                onClick={() => applySettings({accentColor: c.id})}
                                                title={c.label}
                                                className="w-full aspect-square rounded-full transition hover:scale-110"
                                                style={{
                                                    background: c.hex,
                                                    boxShadow: active
                                                        ? `0 0 0 2px #0a0f1e, 0 0 0 3.5px ${c.hex}, 0 0 14px ${c.hex}99`
                                                        : `inset 0 0 0 1px rgba(255,255,255,0.1)`,
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            </Group>
                        </div>
                    )}

                    {/* ════ VOICE TAB ════ */}
                    {tab === "voice" && (
                        <div className="p-5 space-y-7">

                            {/* Language */}
                            <Group label="DİL / LANGUAGE" accent={a}>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {LANGUAGES.map((l) => {
                                        const active = (settings.language ?? "tr") === l.id;
                                        return (
                                            <button
                                                key={l.id}
                                                onClick={() => applySettings({language: l.id})}
                                                className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg transition"
                                                style={{
                                                    background: active ? `rgba(${a},0.12)` : "transparent",
                                                    border: `1px solid ${active ? `rgba(${a},0.4)` : `rgba(${a},0.08)`}`,
                                                }}
                                            >
                                                <span className="text-base leading-none">{l.flag}</span>
                                                <span className="text-[10px] font-medium leading-tight" style={{color: active ? ac : `rgba(${a},0.5)`}}>{l.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <Hint accent={a}>Dil değişince sistem prompt, Whisper ve TTS sesi otomatik güncellenir. Sesli: "Switch to English" veya "Türkçeye geç".</Hint>
                            </Group>

                            {/* TTS Motor */}
                            <Group label="TTS MOTORU" accent={a}>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        {id: "edge",       icon: "◎", label: "Edge TTS",   sub: "Ücretsiz · offline"},
                                        {id: "elevenlabs", icon: "♬", label: "ElevenLabs", sub: "API key gerekli"},
                                    ].map((p) => {
                                        const active = settings.ttsProvider === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    const dv = p.id === "elevenlabs" ? "el:21m00Tcm4TlvDq8ikWAM" : "tr-TR-EmelNeural";
                                                    applySettings({ttsProvider: p.id as "edge" | "elevenlabs", ttsVoice: dv});
                                                }}
                                                className="flex flex-col gap-0.5 px-3.5 py-3 rounded-lg text-left transition"
                                                style={{
                                                    background: active ? `rgba(${a},0.1)` : "transparent",
                                                    border: `1px solid ${active ? `rgba(${a},0.35)` : `rgba(${a},0.1)`}`,
                                                }}
                                            >
                                                <span className="text-xl" style={{color: active ? ac : `rgba(${a},0.35)`}}>{p.icon}</span>
                                                <span className="text-[13px] font-medium mt-1" style={{color: active ? ac : `rgba(${a},0.65)`}}>{p.label}</span>
                                                <span className="text-[11px] opacity-50 mt-0.5" style={{color: ac}}>{p.sub}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Group>

                            {/* ElevenLabs key */}
                            {settings.ttsProvider === "elevenlabs" && (
                                <Group label="ELEVENLABS API KEY" accent={a}>
                                    <KeyField
                                        value={config?.elevenlabsApiKey ?? ""}
                                        placeholder="sk_..."
                                        onSave={(v) => applyConfig({elevenlabsApiKey: v || undefined})}
                                        accent={a}
                                    />
                                </Group>
                            )}

                            {/* Voice picker */}
                            <Group label="SES" accent={a}>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {voices.map((v) => {
                                        const active = settings.ttsVoice === v.id;
                                        return (
                                            <button
                                                key={v.id}
                                                onClick={() => applySettings({ttsVoice: v.id})}
                                                className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-left transition"
                                                style={{
                                                    background: active ? `rgba(${a},0.1)` : "transparent",
                                                    border: `1px solid ${active ? `rgba(${a},0.3)` : `rgba(${a},0.08)`}`,
                                                }}
                                            >
                                                <span className="text-[13px] font-medium" style={{color: active ? ac : `rgba(${a},0.7)`}}>{v.label}</span>
                                                <span className="text-[11px] opacity-50 mt-0.5" style={{color: ac}}>{v.meta}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Group>

                            {/* Speed */}
                            <Group label="KONUŞMA HIZI" accent={a}>
                                <div className="flex items-center gap-3 px-1">
                                    <span className="text-[10px] opacity-40 w-7" style={{color: ac}}>0.5x</span>
                                    <input
                                        type="range" min={0.5} max={2.0} step={0.1}
                                        value={settings.ttsRate}
                                        onChange={(e) => setSettings((s) => s ? {...s, ttsRate: parseFloat(e.target.value)} : s)}
                                        onMouseUp={(e) => applySettings({ttsRate: parseFloat((e.target as HTMLInputElement).value)})}
                                        onTouchEnd={(e) => applySettings({ttsRate: parseFloat((e.target as HTMLInputElement).value)})}
                                        className="flex-1"
                                        style={{accentColor: ac}}
                                    />
                                    <span className="text-[10px] opacity-40 w-7 text-right" style={{color: ac}}>2.0x</span>
                                    <span
                                        className="text-[13px] w-10 text-right tabular-nums"
                                        style={{fontFamily: "Orbitron, sans-serif", color: ac}}
                                    >
                                        {settings.ttsRate.toFixed(1)}x
                                    </span>
                                </div>
                            </Group>

                            {/* Test button */}
                            <Group label="SES TESTİ" accent={a}>
                                <button
                                    onClick={testVoice}
                                    disabled={testing}
                                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-[11px] tracking-widest transition hover:brightness-125 disabled:opacity-40"
                                    style={{
                                        color: ac,
                                        borderColor: `rgba(${a},0.3)`,
                                        background: `rgba(${a},0.07)`,
                                    }}
                                >
                                    {testing ? (
                                        <>
                                            <span className="w-2 h-2 rounded-full animate-pulse" style={{background: ac}} />
                                            ÇALINIYOR…
                                        </>
                                    ) : (
                                        <>▶ MERHABA, BEN AEGIS</>
                                    )}
                                </button>
                                <Hint accent={a}>{settings.ttsProvider === "elevenlabs" ? "ElevenLabs" : "Edge TTS"} motoru kullanılır.</Hint>
                            </Group>
                        </div>
                    )}

                    {/* ════ APPEARANCE TAB ════ */}
                    {tab === "appearance" && (
                        <div className="p-5 space-y-7">

                            {/* Font */}
                            <Group label="FONT" accent={a}>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        {id: "jetbrains",    label: "JetBrains",    sub: "Mono · varsayılan",  family: "'JetBrains Mono', monospace"},
                                        {id: "sharetech",    label: "Share Tech",   sub: "Mono · retro",       family: "'Share Tech Mono', monospace"},
                                        {id: "orbitron",     label: "Orbitron",     sub: "Sci-fi · display",   family: "Orbitron"},
                                        {id: "oxanium",      label: "Oxanium",      sub: "Sci-fi · modern",    family: "Oxanium"},
                                        {id: "syne",         label: "Syne",         sub: "Geometric · bold",   family: "Syne"},
                                        {id: "rajdhani",     label: "Rajdhani",     sub: "Sans · sharp",       family: "Rajdhani"},
                                        {id: "poppins",      label: "Poppins",      sub: "Sans · yuvarlak",    family: "Poppins"},
                                        {id: "inter",        label: "Inter",        sub: "Sans · okunaklı",    family: "Inter"},
                                        {id: "spacegrotesk", label: "Space Grotesk",sub: "Grotesque · techy",  family: "'Space Grotesk'"},
                                    ] as const).map((f) => {
                                        const active = (settings.font ?? "jetbrains") === f.id;
                                        return (
                                            <button
                                                key={f.id}
                                                onClick={() => applySettings({font: f.id})}
                                                className="flex flex-col gap-0.5 px-2.5 py-2 rounded-lg text-left transition"
                                                style={{
                                                    background: active ? `rgba(${a},0.1)` : "transparent",
                                                    border: `1px solid ${active ? `rgba(${a},0.35)` : `rgba(${a},0.08)`}`,
                                                }}
                                            >
                                                <span className="text-[13px] font-medium leading-tight" style={{color: active ? ac : `rgba(${a},0.65)`, fontFamily: f.family}}>{f.label}</span>
                                                <span className="text-[10px] opacity-50 mt-0.5 leading-tight" style={{color: ac}}>{f.sub}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Group>

                            {/* Layout */}
                            <Group label="LAYOUT" accent={a}>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        {id: "normal",  label: "Normal",   sub: "Standart boşluklar"},
                                        {id: "compact", label: "Kompakt",  sub: "Daha sık, daha fazla içerik"},
                                    ] as const).map((l) => {
                                        const active = (settings.layout ?? "normal") === l.id;
                                        return (
                                            <button
                                                key={l.id}
                                                onClick={() => applySettings({layout: l.id})}
                                                className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-left transition"
                                                style={{
                                                    background: active ? `rgba(${a},0.1)` : "transparent",
                                                    border: `1px solid ${active ? `rgba(${a},0.35)` : `rgba(${a},0.08)`}`,
                                                }}
                                            >
                                                <span className="text-[13px] font-medium" style={{color: active ? ac : `rgba(${a},0.65)`}}>{l.label}</span>
                                                <span className="text-[11px] opacity-50 mt-0.5" style={{color: ac}}>{l.sub}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Group>

                            {/* Custom CSS */}
                            <Group label="ÖZEL CSS" accent={a}>
                                <CustomCssField
                                    value={settings.customCss ?? ""}
                                    onSave={(v) => applySettings({customCss: v})}
                                    accent={a}
                                />
                                <Hint accent={a}>CSS değişkenlerini ve class'ları override edebilirsin. Örn: :root {"{ --hud: 255,100,50; }"}</Hint>
                            </Group>
                        </div>
                    )}

                    {/* ════ KEYS TAB ════ */}
                    {tab === "keys" && config && (
                        <div className="p-5 space-y-5">
                            <KeyGroup label="GROQ" hint="gsk_..." value={config.groqApiKey} onSave={(v) => applyConfig({groqApiKey: v})} accent={a} />
                            <KeyGroup label="SUPABASE URL" hint="https://xxxx.supabase.co" value={config.supabaseUrl} onSave={(v) => applyConfig({supabaseUrl: v})} accent={a} />
                            <KeyGroup label="SUPABASE SERVICE ROLE KEY" hint="eyJ..." value={config.supabaseServiceKey} onSave={(v) => applyConfig({supabaseServiceKey: v})} accent={a} />
                            <KeyGroup label="TAVILY" hint="tvly-... (opsiyonel)" value={config.tavilyApiKey ?? ""} onSave={(v) => applyConfig({tavilyApiKey: v || undefined})} accent={a} />
                            <KeyGroup label="SERPER" hint="opsiyonel" value={config.serperApiKey ?? ""} onSave={(v) => applyConfig({serperApiKey: v || undefined})} accent={a} />
                            <KeyGroup label="ELEVENLABS" hint="sk_... (opsiyonel)" value={config.elevenlabsApiKey ?? ""} onSave={(v) => applyConfig({elevenlabsApiKey: v || undefined})} accent={a} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Primitive helpers ────────────────────────────────────────────────────────

function Group({label, accent, children}: {label: string; accent: string; children: React.ReactNode}) {
    return (
        <div className="space-y-3">
            <div
                className="text-[10px] font-medium tracking-[0.35em] flex items-center gap-2"
                style={{color: `rgba(${accent},0.55)`}}
            >
                <span className="flex-1 border-t" style={{borderColor: `rgba(${accent},0.1)`}} />
                {label}
                <span className="flex-1 border-t" style={{borderColor: `rgba(${accent},0.1)`}} />
            </div>
            {children}
        </div>
    );
}

function Label({accent, children}: {accent: string; children: React.ReactNode}) {
    return (
        <div className="text-[11px] mb-1.5 opacity-50" style={{color: `rgb(${accent})`}}>
            {children}
        </div>
    );
}

function Hint({accent, children}: {accent: string; children: React.ReactNode}) {
    return (
        <p className="text-[11px] mt-2 opacity-40 leading-relaxed" style={{color: `rgb(${accent})`}}>
            {children}
        </p>
    );
}

function KeyGroup({label, hint, value, onSave, accent}: {label: string; hint: string; value: string; onSave: (v: string) => void; accent: string}) {
    return (
        <div className="space-y-2">
            <div className="text-[11px] font-medium tracking-[0.2em] opacity-55" style={{color: `rgb(${accent})`}}>
                {label}
            </div>
            <KeyField value={value} placeholder={hint} onSave={onSave} accent={accent} />
        </div>
    );
}

function KeyField({value, placeholder, onSave, accent}: {value: string; placeholder: string; onSave: (v: string) => void; accent: string}) {
    const [val, setVal] = useState(value);
    const [show, setShow] = useState(false);
    const changed = val !== value;
    const ac = `rgb(${accent})`;

    return (
        <div className="flex gap-2">
            <input
                type={show ? "text" : "password"}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder={placeholder}
                className="flex-1 min-w-0 bg-transparent rounded-lg px-3 py-2 text-[12px] outline-none border transition"
                style={{
                    borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.12)`,
                    color: ac,
                }}
            />
            <button
                onClick={() => setShow((s) => !s)}
                className="px-2.5 rounded-lg border text-[9px] tracking-wider transition opacity-35 hover:opacity-80 shrink-0"
                style={{borderColor: `rgba(${accent},0.15)`, color: ac}}
            >
                {show ? "GİZLE" : "GÖR"}
            </button>
            {changed && (
                <button
                    onClick={() => onSave(val)}
                    className="px-3 rounded-lg border text-[9px] tracking-widest transition hover:brightness-125 shrink-0"
                    style={{borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.1)`, color: ac}}
                >
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
                style={{
                    borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.12)`,
                    color: ac,
                    fontFamily: "'JetBrains Mono', monospace",
                }}
            />
            {changed && (
                <button
                    onClick={() => onSave(val)}
                    className="px-3 py-1.5 rounded-lg border text-[9px] tracking-widest transition hover:brightness-125"
                    style={{borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.1)`, color: ac}}
                >
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

    return (
        <div className="flex gap-2">
            <input
                type="text"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder={placeholder}
                className="flex-1 min-w-0 bg-transparent rounded-lg px-3 py-2 text-[12px] outline-none border transition"
                style={{
                    borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.12)`,
                    color: ac,
                }}
            />
            {changed && (
                <button
                    onClick={() => onSave(val)}
                    className="px-3 rounded-lg border text-[9px] tracking-widest transition hover:brightness-125 shrink-0"
                    style={{borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.1)`, color: ac}}
                >
                    ✓
                </button>
            )}
        </div>
    );
}
