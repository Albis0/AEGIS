import {useEffect, useRef, useState} from "react";
import type {AppSettings, AegisConfig} from "../electron.d";

const GROQ_MODELS = [
    {id: "qwen/qwen3-32b",           label: "Qwen3 32B (varsayılan)"},
    {id: "llama-3.3-70b-versatile",  label: "Llama 3.3 70B"},
    {id: "llama3-70b-8192",          label: "Llama 3 70B"},
    {id: "mixtral-8x7b-32768",       label: "Mixtral 8x7B"},
    {id: "gemma2-9b-it",             label: "Gemma2 9B"},
];

const OPENAI_MODELS = [
    {id: "gpt-4o",       label: "GPT-4o"},
    {id: "gpt-4o-mini",  label: "GPT-4o Mini"},
    {id: "gpt-4-turbo",  label: "GPT-4 Turbo"},
    {id: "gpt-3.5-turbo",label: "GPT-3.5 Turbo"},
];

const ANTHROPIC_MODELS = [
    {id: "claude-opus-4-8",      label: "Claude Opus 4"},
    {id: "claude-sonnet-4-6",    label: "Claude Sonnet 4"},
    {id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4"},
];

const MISTRAL_MODELS = [
    {id: "mistral-large-latest",  label: "Mistral Large"},
    {id: "mistral-small-latest",  label: "Mistral Small"},
    {id: "codestral-latest",      label: "Codestral"},
];

const AI_PROVIDERS = [
    {id: "groq",      label: "Groq",      desc: "Ücretsiz, hızlı"},
    {id: "openai",    label: "OpenAI",    desc: "GPT-4o vb."},
    {id: "anthropic", label: "Anthropic", desc: "Claude"},
    {id: "mistral",   label: "Mistral",   desc: "Mistral Large vb."},
    {id: "ollama",    label: "Ollama",    desc: "İnternet yok, local"},
] as const;

const EDGE_VOICES = [
    {id: "tr-TR-EmelNeural",  label: "Emel (TR, Kadın)"},
    {id: "tr-TR-AhmetNeural", label: "Ahmet (TR, Erkek)"},
    {id: "en-US-AriaNeural",  label: "Aria (EN, Kadın)"},
    {id: "en-US-GuyNeural",   label: "Guy (EN, Erkek)"},
    {id: "en-GB-SoniaNeural", label: "Sonia (EN-GB, Kadın)"},
];

// ElevenLabs popüler sesler (voice_id → label). "el:" prefix ile saklanır.
const EL_VOICES = [
    {id: "el:21m00Tcm4TlvDq8ikWAM", label: "Rachel (EN, Kadın)"},
    {id: "el:AZnzlk1XvdvUeBnXmlld", label: "Domi (EN, Kadın)"},
    {id: "el:EXAVITQu4vr4xnSDxMaL", label: "Bella (EN, Kadın)"},
    {id: "el:ErXwobaYiN019PkySvjV", label: "Antoni (EN, Erkek)"},
    {id: "el:VR6AewLTigWG4xSOukaG", label: "Arnold (EN, Erkek)"},
    {id: "el:pNInz6obpgDQGcFmaJgB", label: "Adam (EN, Erkek)"},
];

const ACCENT_COLORS = [
    {id: "34,211,238",   label: "Cyan",   hex: "#22d3ee"},
    {id: "139,92,246",   label: "Purple", hex: "#8b5cf6"},
    {id: "110,231,183",  label: "Green",  hex: "#6ee7b7"},
    {id: "251,146,60",   label: "Orange", hex: "#fb923c"},
    {id: "248,113,113",  label: "Red",    hex: "#f87171"},
    {id: "250,204,21",   label: "Yellow", hex: "#facc15"},
];

type Tab = "model" | "voice" | "keys";

interface Props {
    open: boolean;
    onClose: () => void;
    onAccentChange: (rgb: string) => void;
}

export default function SettingsPanel({open, onClose, onAccentChange}: Props) {
    const [tab, setTab] = useState<Tab>("model");
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [config, setConfig] = useState<AegisConfig | null>(null);
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
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

    function flash() {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
    }

    async function applySettings(patch: Partial<AppSettings>) {
        const updated = await window.jarvis.settingsSet(patch);
        setSettings(updated);
        if (patch.accentColor) onAccentChange(patch.accentColor);
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
            if (res.buffer) {
                const ctx = new AudioContext();
                const ab = res.buffer instanceof Buffer ? res.buffer.buffer : res.buffer as unknown as ArrayBuffer;
                const decoded = await ctx.decodeAudioData(ab as ArrayBuffer);
                const source = ctx.createBufferSource();
                source.buffer = decoded;
                source.connect(ctx.destination);
                source.start();
                source.onended = () => ctx.close();
            }
        } finally {
            setTesting(false);
        }
    }

    if (!open || !settings) return null;

    const accent = settings.accentColor;
    const accentRgb = `rgb(${accent})`;

    const modelList =
        settings.aiProvider === "openai" ? OPENAI_MODELS :
        settings.aiProvider === "anthropic" ? ANTHROPIC_MODELS :
        settings.aiProvider === "mistral" ? MISTRAL_MODELS :
        GROQ_MODELS;

    const ttsVoices = settings.ttsProvider === "elevenlabs" ? EL_VOICES : EDGE_VOICES;

    return (
        <div
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{background: "rgba(3,6,12,0.75)", backdropFilter: "blur(4px)"}}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={panelRef}
                className="relative flex flex-col rounded-xl border overflow-hidden"
                style={{
                    width: "clamp(360px,42vw,520px)",
                    maxHeight: "84vh",
                    borderColor: `rgba(${accent},0.25)`,
                    background: "rgba(4,10,20,0.97)",
                    boxShadow: `0 0 60px rgba(${accent},0.08)`,
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{borderColor: `rgba(${accent},0.15)`}}>
                    <span className="text-[11px] tracking-[0.4em]" style={{fontFamily: "Orbitron, sans-serif", color: accentRgb}}>
                        AYARLAR
                    </span>
                    <div className="flex items-center gap-3">
                        {saved && <span className="text-[10px] tracking-widest" style={{color: "rgb(110,231,160)"}}>✓ KAYDEDİLDİ</span>}
                        <button onClick={onClose} className="opacity-50 hover:opacity-100 transition text-sm" style={{color: accentRgb}}>✕</button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b shrink-0" style={{borderColor: `rgba(${accent},0.1)`}}>
                    {(["model", "voice", "keys"] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className="flex-1 py-2 text-[10px] tracking-[0.25em] transition"
                            style={{
                                color: tab === t ? accentRgb : `rgba(${accent},0.4)`,
                                borderBottom: tab === t ? `1px solid ${accentRgb}` : "1px solid transparent",
                            }}
                        >
                            {t === "model" ? "MODEL & TEMA" : t === "voice" ? "SES" : "API KEYS"}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

                    {/* ── TAB: MODEL & TEMA ── */}
                    {tab === "model" && <>
                        <Section title="AI SAĞLAYICI" accent={accent}>
                            <div className="grid grid-cols-2 gap-2">
                                {AI_PROVIDERS.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            const defaultModel =
                                                p.id === "openai" ? "gpt-4o" :
                                                p.id === "anthropic" ? "claude-sonnet-4-6" :
                                                p.id === "mistral" ? "mistral-large-latest" :
                                                p.id === "ollama" ? "llama3.2" :
                                                "qwen/qwen3-32b";
                                            applySettings({aiProvider: p.id as AppSettings["aiProvider"], model: defaultModel});
                                        }}
                                        className="flex flex-col items-start px-3 py-2.5 rounded-lg border transition"
                                        style={{
                                            background: settings.aiProvider === p.id ? `rgba(${accent},0.1)` : "transparent",
                                            borderColor: settings.aiProvider === p.id ? `rgba(${accent},0.4)` : `rgba(${accent},0.1)`,
                                        }}
                                    >
                                        <span className="text-[12px] font-medium" style={{color: settings.aiProvider === p.id ? accentRgb : `rgba(${accent},0.6)`}}>{p.label}</span>
                                        <span className="text-[10px] opacity-40" style={{color: accentRgb}}>{p.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </Section>

                        {settings.aiProvider !== "groq" && (
                            <Section title={`${AI_PROVIDERS.find(p => p.id === settings.aiProvider)?.label?.toUpperCase()} API KEY`} accent={accent}>
                                <KeyField
                                    value={settings.aiApiKey}
                                    placeholder={settings.aiProvider === "openai" ? "sk-..." : settings.aiProvider === "anthropic" ? "sk-ant-..." : "..."}
                                    onSave={(v) => applySettings({aiApiKey: v})}
                                    accent={accent}
                                />
                                <p className="text-[10px] opacity-35 mt-2 pl-1">Bu key settings.json'da saklanır (config.json değil).</p>
                            </Section>
                        )}

                        {settings.aiProvider === "ollama" ? (
                            <>
                                <Section title="OLLAMA SUNUCU URL" accent={accent}>
                                    <OllamaField
                                        label="URL"
                                        value={settings.ollamaUrl || "http://localhost:11434"}
                                        placeholder="http://localhost:11434"
                                        onSave={(v) => applySettings({ollamaUrl: v})}
                                        accent={accent}
                                    />
                                    <p className="text-[10px] opacity-35 mt-2 pl-1">Ollama çalışmıyorsa: <code style={{color: `rgba(${accent},0.6)`}}>ollama serve</code></p>
                                </Section>
                                <Section title="MODEL ADI" accent={accent}>
                                    <OllamaField
                                        label="Model"
                                        value={settings.model}
                                        placeholder="llama3.2, mistral, gemma2..."
                                        onSave={(v) => applySettings({model: v})}
                                        accent={accent}
                                    />
                                    <p className="text-[10px] opacity-35 mt-2 pl-1">Yüklü modeller için: <code style={{color: `rgba(${accent},0.6)`}}>ollama list</code></p>
                                </Section>
                            </>
                        ) : (
                            <Section title="AI MODELİ" accent={accent}>
                                <div className="space-y-1.5">
                                    {modelList.map((m) => (
                                        <RadioRow
                                            key={m.id}
                                            label={m.label}
                                            checked={settings.model === m.id}
                                            accent={accent}
                                            onChange={() => applySettings({model: m.id})}
                                        />
                                    ))}
                                </div>
                                {settings.aiProvider === "groq" && (
                                    <p className="text-[10px] opacity-35 mt-2 pl-1">Groq API üzerinden çalışır. Değişiklik anında aktif olur.</p>
                                )}
                            </Section>
                        )}

                        <Section title="TEMA RENGİ" accent={accent}>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {ACCENT_COLORS.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => applySettings({accentColor: c.id})}
                                        title={c.label}
                                        className="w-8 h-8 rounded-full border-2 transition hover:scale-110"
                                        style={{
                                            background: c.hex,
                                            borderColor: settings.accentColor === c.id ? "white" : "transparent",
                                            boxShadow: settings.accentColor === c.id ? `0 0 10px ${c.hex}` : "none",
                                        }}
                                    />
                                ))}
                            </div>
                        </Section>
                    </>}

                    {/* ── TAB: SES ── */}
                    {tab === "voice" && <>
                        <Section title="TTS MOTORU" accent={accent}>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    {id: "edge",       label: "Edge TTS",    desc: "Ücretsiz, offline"},
                                    {id: "elevenlabs", label: "ElevenLabs",  desc: "API key gerekli"},
                                ].map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            const defaultVoice = p.id === "elevenlabs" ? "el:21m00Tcm4TlvDq8ikWAM" : "tr-TR-EmelNeural";
                                            applySettings({ttsProvider: p.id as "edge" | "elevenlabs", ttsVoice: defaultVoice});
                                        }}
                                        className="flex flex-col items-start px-3 py-2.5 rounded-lg border transition"
                                        style={{
                                            background: settings.ttsProvider === p.id ? `rgba(${accent},0.1)` : "transparent",
                                            borderColor: settings.ttsProvider === p.id ? `rgba(${accent},0.4)` : `rgba(${accent},0.1)`,
                                        }}
                                    >
                                        <span className="text-[12px] font-medium" style={{color: settings.ttsProvider === p.id ? accentRgb : `rgba(${accent},0.6)`}}>{p.label}</span>
                                        <span className="text-[10px] opacity-40" style={{color: accentRgb}}>{p.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </Section>

                        {settings.ttsProvider === "elevenlabs" && (
                            <Section title="ELEVENLABS API KEY" accent={accent}>
                                <KeyField
                                    value={config?.elevenlabsApiKey ?? ""}
                                    placeholder="sk_..."
                                    onSave={(v) => applyConfig({elevenlabsApiKey: v || undefined})}
                                    accent={accent}
                                />
                            </Section>
                        )}

                        <Section title="SES" accent={accent}>
                            <div className="space-y-1.5">
                                {ttsVoices.map((v) => (
                                    <RadioRow
                                        key={v.id}
                                        label={v.label}
                                        checked={settings.ttsVoice === v.id}
                                        accent={accent}
                                        onChange={() => applySettings({ttsVoice: v.id})}
                                    />
                                ))}
                            </div>
                        </Section>

                        <Section title="KONUŞMA HIZI" accent={accent}>
                            <div className="flex items-center gap-4 px-1">
                                <span className="text-[11px] opacity-50 w-8">0.5x</span>
                                <input
                                    type="range" min={0.5} max={2.0} step={0.1}
                                    value={settings.ttsRate}
                                    onChange={(e) => setSettings((s) => s ? {...s, ttsRate: parseFloat(e.target.value)} : s)}
                                    onMouseUp={(e) => applySettings({ttsRate: parseFloat((e.target as HTMLInputElement).value)})}
                                    onTouchEnd={(e) => applySettings({ttsRate: parseFloat((e.target as HTMLInputElement).value)})}
                                    className="flex-1 accent-cyan-400"
                                />
                                <span className="text-[11px] opacity-50 w-8 text-right">2.0x</span>
                                <span className="text-[13px] w-10 text-right tabular-nums" style={{color: accentRgb, fontFamily: "Orbitron, sans-serif"}}>
                                    {settings.ttsRate.toFixed(1)}x
                                </span>
                            </div>
                        </Section>

                        <Section title="SES TESTİ" accent={accent}>
                            <button
                                onClick={testVoice}
                                disabled={testing}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[11px] tracking-widest transition hover:brightness-125 disabled:opacity-40"
                                style={{borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.08)`, color: accentRgb}}
                            >
                                {testing ? (
                                    <>
                                        <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{background: accentRgb}} />
                                        ÇALINIYOR...
                                    </>
                                ) : (
                                    <>
                                        <span>▶</span>
                                        TEST ET
                                    </>
                                )}
                            </button>
                            <p className="text-[10px] opacity-35 mt-2 pl-1">
                                {settings.ttsProvider === "elevenlabs" ? "ElevenLabs" : "Edge TTS"} ile "Merhaba, ben AEGIS" çalar.
                            </p>
                        </Section>
                    </>}

                    {/* ── TAB: API KEYS ── */}
                    {tab === "keys" && config && <>
                        <Section title="GROQ API KEY" accent={accent}>
                            <KeyField
                                value={config.groqApiKey}
                                placeholder="gsk_..."
                                onSave={(v) => applyConfig({groqApiKey: v})}
                                accent={accent}
                            />
                        </Section>
                        <Section title="SUPABASE URL" accent={accent}>
                            <KeyField
                                value={config.supabaseUrl}
                                placeholder="https://xxxx.supabase.co"
                                onSave={(v) => applyConfig({supabaseUrl: v})}
                                accent={accent}
                            />
                        </Section>
                        <Section title="SUPABASE SERVICE_ROLE KEY" accent={accent}>
                            <KeyField
                                value={config.supabaseServiceKey}
                                placeholder="eyJ..."
                                onSave={(v) => applyConfig({supabaseServiceKey: v})}
                                accent={accent}
                            />
                        </Section>
                        <Section title="TAVILY API KEY (opsiyonel)" accent={accent}>
                            <KeyField
                                value={config.tavilyApiKey ?? ""}
                                placeholder="tvly-..."
                                onSave={(v) => applyConfig({tavilyApiKey: v || undefined})}
                                accent={accent}
                            />
                        </Section>
                        <Section title="SERPER API KEY (opsiyonel)" accent={accent}>
                            <KeyField
                                value={config.serperApiKey ?? ""}
                                placeholder=""
                                onSave={(v) => applyConfig({serperApiKey: v || undefined})}
                                accent={accent}
                            />
                        </Section>
                        <Section title="ELEVENLABS API KEY (opsiyonel)" accent={accent}>
                            <KeyField
                                value={config.elevenlabsApiKey ?? ""}
                                placeholder="sk_..."
                                onSave={(v) => applyConfig({elevenlabsApiKey: v || undefined})}
                                accent={accent}
                            />
                        </Section>
                    </>}
                </div>
            </div>
        </div>
    );
}

function Section({title, accent, children}: {title: string; accent: string; children: React.ReactNode}) {
    return (
        <div>
            <div className="text-[9px] tracking-[0.35em] mb-3 pb-1 border-b" style={{color: `rgba(${accent},0.5)`, borderColor: `rgba(${accent},0.1)`}}>
                {title}
            </div>
            {children}
        </div>
    );
}

function RadioRow({label, checked, accent, onChange}: {label: string; checked: boolean; accent: string; onChange: () => void}) {
    return (
        <label
            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition"
            style={{
                background: checked ? `rgba(${accent},0.08)` : "transparent",
                border: `1px solid ${checked ? `rgba(${accent},0.3)` : `rgba(${accent},0.06)`}`,
            }}
        >
            <div className="w-3 h-3 rounded-full border shrink-0 flex items-center justify-center" style={{borderColor: checked ? `rgb(${accent})` : `rgba(${accent},0.3)`}}>
                {checked && <div className="w-1.5 h-1.5 rounded-full" style={{background: `rgb(${accent})`}} />}
            </div>
            <span className="text-[12px] tracking-wide" style={{color: checked ? `rgb(${accent})` : `rgba(${accent},0.6)`}}>
                {label}
            </span>
            <input type="radio" className="sr-only" checked={checked} onChange={onChange} />
        </label>
    );
}

function OllamaField({label, value, placeholder, onSave, accent}: {label: string; value: string; placeholder: string; onSave: (v: string) => void; accent: string}) {
    const [val, setVal] = useState(value);
    const changed = val !== value;
    return (
        <div className="flex gap-2">
            <input
                type="text"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent rounded-lg px-3 py-2 text-[12px] outline-none border transition"
                style={{borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.15)`, color: `rgb(${accent})`}}
                aria-label={label}
            />
            {changed && (
                <button
                    onClick={() => onSave(val)}
                    className="px-3 rounded-lg border text-[10px] tracking-widest transition hover:brightness-125"
                    style={{borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.08)`, color: `rgb(${accent})`}}
                >
                    KAYDET
                </button>
            )}
        </div>
    );
}

function KeyField({value, placeholder, onSave, accent}: {value: string; placeholder: string; onSave: (v: string) => void; accent: string}) {
    const [val, setVal] = useState(value);
    const [show, setShow] = useState(false);
    const changed = val !== value;

    return (
        <div className="flex gap-2">
            <input
                type={show ? "text" : "password"}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent rounded-lg px-3 py-2 text-[12px] outline-none border transition"
                style={{borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.15)`, color: `rgb(${accent})`}}
            />
            <button
                onClick={() => setShow((s) => !s)}
                className="px-2.5 rounded-lg border text-[10px] transition opacity-50 hover:opacity-100"
                style={{borderColor: `rgba(${accent},0.15)`, color: `rgb(${accent})`}}
            >
                {show ? "GİZLE" : "GÖSTER"}
            </button>
            {changed && (
                <button
                    onClick={() => onSave(val)}
                    className="px-3 rounded-lg border text-[10px] tracking-widest transition hover:brightness-125"
                    style={{borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.08)`, color: `rgb(${accent})`}}
                >
                    KAYDET
                </button>
            )}
        </div>
    );
}
