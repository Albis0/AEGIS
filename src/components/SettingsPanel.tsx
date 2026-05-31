import {useEffect, useRef, useState} from "react";
import type {AppSettings} from "../electron.d";

const GROQ_MODELS = [
    {id: "qwen/qwen3-32b",       label: "Qwen3 32B (varsayılan)"},
    {id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B"},
    {id: "llama3-70b-8192",      label: "Llama 3 70B"},
    {id: "mixtral-8x7b-32768",   label: "Mixtral 8x7B"},
    {id: "gemma2-9b-it",         label: "Gemma2 9B"},
];

const TTS_VOICES = [
    {id: "tr-TR-EmelNeural",  label: "Emel (TR, Kadın)"},
    {id: "tr-TR-AhmetNeural", label: "Ahmet (TR, Erkek)"},
    {id: "en-US-AriaNeural",  label: "Aria (EN, Kadın)"},
    {id: "en-US-GuyNeural",   label: "Guy (EN, Erkek)"},
    {id: "en-GB-SoniaNeural", label: "Sonia (EN-GB, Kadın)"},
];

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function SettingsPanel({open, onClose}: Props) {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [saved, setSaved] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            window.jarvis.settingsGet().then(setSettings);
            setSaved(false);
        }
    }, [open]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    async function apply(patch: Partial<AppSettings>) {
        const updated = await window.jarvis.settingsSet(patch);
        setSettings(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
    }

    if (!open || !settings) return null;

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
                    width: "clamp(340px, 38vw, 480px)",
                    maxHeight: "80vh",
                    borderColor: "rgba(34,211,238,0.25)",
                    background: "rgba(4,10,20,0.97)",
                    boxShadow: "0 0 60px rgba(34,211,238,0.08)",
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-3 border-b shrink-0"
                    style={{borderColor: "rgba(34,211,238,0.15)"}}
                >
                    <span
                        className="text-[11px] tracking-[0.4em] glow-text"
                        style={{fontFamily: "Orbitron, sans-serif", color: "rgb(34,211,238)"}}
                    >
                        AYARLAR
                    </span>
                    <div className="flex items-center gap-3">
                        {saved && (
                            <span className="text-[10px] tracking-widest" style={{color: "rgb(110,231,160)"}}>
                                ✓ KAYDEDİLDİ
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="opacity-50 hover:opacity-100 transition text-sm"
                            style={{color: "rgb(34,211,238)"}}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

                    {/* AI Modeli */}
                    <Section title="AI MODELİ">
                        <div className="space-y-1.5">
                            {GROQ_MODELS.map((m) => (
                                <label
                                    key={m.id}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition"
                                    style={{
                                        background: settings.model === m.id ? "rgba(34,211,238,0.08)" : "transparent",
                                        border: `1px solid ${settings.model === m.id ? "rgba(34,211,238,0.3)" : "rgba(34,211,238,0.06)"}`,
                                    }}
                                >
                                    <div
                                        className="w-3 h-3 rounded-full border shrink-0 flex items-center justify-center"
                                        style={{borderColor: settings.model === m.id ? "rgb(34,211,238)" : "rgba(34,211,238,0.3)"}}
                                    >
                                        {settings.model === m.id && (
                                            <div className="w-1.5 h-1.5 rounded-full" style={{background: "rgb(34,211,238)"}} />
                                        )}
                                    </div>
                                    <span className="text-[12px] tracking-wide" style={{color: settings.model === m.id ? "rgb(34,211,238)" : "rgba(34,211,238,0.6)"}}>
                                        {m.label}
                                    </span>
                                    <input
                                        type="radio"
                                        className="sr-only"
                                        checked={settings.model === m.id}
                                        onChange={() => apply({model: m.id})}
                                    />
                                </label>
                            ))}
                        </div>
                        <p className="text-[10px] opacity-40 mt-2 pl-1">Groq API üzerinden çalışır. Değişiklik anında aktif olur.</p>
                    </Section>

                    {/* TTS Sesi */}
                    <Section title="TTS SESİ">
                        <div className="space-y-1.5">
                            {TTS_VOICES.map((v) => (
                                <label
                                    key={v.id}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition"
                                    style={{
                                        background: settings.ttsVoice === v.id ? "rgba(34,211,238,0.08)" : "transparent",
                                        border: `1px solid ${settings.ttsVoice === v.id ? "rgba(34,211,238,0.3)" : "rgba(34,211,238,0.06)"}`,
                                    }}
                                >
                                    <div
                                        className="w-3 h-3 rounded-full border shrink-0 flex items-center justify-center"
                                        style={{borderColor: settings.ttsVoice === v.id ? "rgb(34,211,238)" : "rgba(34,211,238,0.3)"}}
                                    >
                                        {settings.ttsVoice === v.id && (
                                            <div className="w-1.5 h-1.5 rounded-full" style={{background: "rgb(34,211,238)"}} />
                                        )}
                                    </div>
                                    <span className="text-[12px] tracking-wide" style={{color: settings.ttsVoice === v.id ? "rgb(34,211,238)" : "rgba(34,211,238,0.6)"}}>
                                        {v.label}
                                    </span>
                                    <input
                                        type="radio"
                                        className="sr-only"
                                        checked={settings.ttsVoice === v.id}
                                        onChange={() => apply({ttsVoice: v.id})}
                                    />
                                </label>
                            ))}
                        </div>
                    </Section>

                    {/* Konuşma Hızı */}
                    <Section title="KONUŞMA HIZI">
                        <div className="flex items-center gap-4 px-1">
                            <span className="text-[11px] opacity-50 w-8">0.5x</span>
                            <input
                                type="range"
                                min={0.5}
                                max={2.0}
                                step={0.1}
                                value={settings.ttsRate}
                                onChange={(e) => setSettings((s) => s ? {...s, ttsRate: parseFloat(e.target.value)} : s)}
                                onMouseUp={(e) => apply({ttsRate: parseFloat((e.target as HTMLInputElement).value)})}
                                onTouchEnd={(e) => apply({ttsRate: parseFloat((e.target as HTMLInputElement).value)})}
                                className="flex-1 accent-cyan-400"
                            />
                            <span className="text-[11px] opacity-50 w-8 text-right">2.0x</span>
                            <span
                                className="text-[13px] w-10 text-right tabular-nums"
                                style={{color: "rgb(34,211,238)", fontFamily: "Orbitron, sans-serif"}}
                            >
                                {settings.ttsRate.toFixed(1)}x
                            </span>
                        </div>
                        <p className="text-[10px] opacity-40 mt-2 pl-1">TTS hız ayarı şu an Edge TTS tarafında uygulanmaktadır.</p>
                    </Section>
                </div>
            </div>
        </div>
    );
}

function Section({title, children}: {title: string; children: React.ReactNode}) {
    return (
        <div>
            <div
                className="text-[9px] tracking-[0.35em] mb-3 pb-1 border-b"
                style={{color: "rgba(34,211,238,0.5)", borderColor: "rgba(34,211,238,0.1)"}}
            >
                {title}
            </div>
            {children}
        </div>
    );
}
