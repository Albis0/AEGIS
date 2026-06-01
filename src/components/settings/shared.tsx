import React from "react";

// ── Primitive UI helpers ───────────────────────────────────────────────────

export function SectionLabel({label, accent}: {label: string; accent: string}) {
    return (
        <div className="text-[10px] font-medium tracking-[0.35em] flex items-center gap-2 mb-3"
            style={{color: `rgba(${accent},0.5)`}}>
            <span className="flex-1 border-t" style={{borderColor: `rgba(${accent},0.08)`}} />
            {label}
            <span className="flex-1 border-t" style={{borderColor: `rgba(${accent},0.08)`}} />
        </div>
    );
}

export function FieldLabel({accent, children}: {accent: string; children: React.ReactNode}) {
    return <div className="text-[11px] mb-1.5 opacity-50" style={{color: `rgb(${accent})`}}>{children}</div>;
}

export function Hint({accent, children}: {accent: string; children: React.ReactNode}) {
    return <p className="text-[11px] mt-2 opacity-35 leading-relaxed" style={{color: `rgb(${accent})`}}>{children}</p>;
}

export function Toggle({active, onChange, accent}: {active: boolean; onChange: () => void; accent: string}) {
    return (
        <button onClick={onChange}
            className="shrink-0 w-11 h-6 rounded-full relative transition-all duration-200"
            style={{
                background: active ? `rgba(${accent},0.45)` : `rgba(${accent},0.08)`,
                border: `1px solid ${active ? `rgba(${accent},0.6)` : `rgba(${accent},0.2)`}`,
            }}>
            <span className="absolute top-1 w-4 h-4 rounded-full transition-all duration-200"
                style={{
                    background: active ? `rgb(${accent})` : `rgba(${accent},0.3)`,
                    left: active ? "calc(100% - 18px)" : "2px",
                    boxShadow: active ? `0 0 8px rgba(${accent},0.5)` : "none",
                }} />
        </button>
    );
}

export function RadioCard({
    active, onClick, accent, children, className = "",
}: {active: boolean; onClick: () => void; accent: string; children: React.ReactNode; className?: string}) {
    return (
        <button onClick={onClick}
            className={`text-left transition-all duration-150 rounded-xl ${className}`}
            style={{
                background: active ? `rgba(${accent},0.1)` : `rgba(${accent},0.02)`,
                border: `1px solid ${active ? `rgba(${accent},0.4)` : `rgba(${accent},0.08)`}`,
                boxShadow: active ? `inset 0 0 20px rgba(${accent},0.04), 0 0 0 1px rgba(${accent},0.1)` : "none",
            }}>
            {children}
        </button>
    );
}

export function KeyField({
    value, placeholder, onSave, accent, type = "password",
}: {value: string; placeholder: string; onSave: (v: string) => void; accent: string; type?: "password" | "text"}) {
    const [val, setVal] = React.useState(value);
    const [show, setShow] = React.useState(false);
    const changed = val !== value;
    const ac = `rgb(${accent})`;

    React.useEffect(() => { setVal(value); }, [value]);

    return (
        <div className="flex gap-2">
            <input
                type={show || type === "text" ? "text" : "password"}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && changed) onSave(val); }}
                placeholder={placeholder}
                className="flex-1 min-w-0 bg-transparent rounded-lg px-3 py-2 text-[12px] outline-none border transition"
                style={{borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.1)`, color: ac}}
            />
            {type === "password" && (
                <button onClick={() => setShow((s) => !s)}
                    className="px-2.5 rounded-lg border text-[9px] tracking-wider transition opacity-30 hover:opacity-70 shrink-0"
                    style={{borderColor: `rgba(${accent},0.15)`, color: ac}}>
                    {show ? "GİZLE" : "GÖR"}
                </button>
            )}
            {changed && (
                <button onClick={() => onSave(val)}
                    className="px-3 rounded-lg border text-[9px] tracking-widest transition hover:brightness-125 shrink-0"
                    style={{borderColor: `rgba(${accent},0.4)`, background: `rgba(${accent},0.12)`, color: ac}}>
                    ✓
                </button>
            )}
        </div>
    );
}

export function PlainField({value, placeholder, onSave, accent}: {value: string; placeholder: string; onSave: (v: string) => void; accent: string}) {
    const [val, setVal] = React.useState(value);
    const changed = val !== value;
    const ac = `rgb(${accent})`;
    React.useEffect(() => { setVal(value); }, [value]);
    return (
        <div className="flex gap-2">
            <input
                type="text" value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && changed) onSave(val); }}
                placeholder={placeholder}
                className="flex-1 min-w-0 bg-transparent rounded-lg px-3 py-2 text-[12px] outline-none border transition"
                style={{borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.1)`, color: ac}}
            />
            {changed && (
                <button onClick={() => onSave(val)}
                    className="px-3 rounded-lg border text-[9px] tracking-widest transition hover:brightness-125 shrink-0"
                    style={{borderColor: `rgba(${accent},0.4)`, background: `rgba(${accent},0.12)`, color: ac}}>
                    ✓
                </button>
            )}
        </div>
    );
}

// ── Model / provider catalog ──────────────────────────────────────────────

export interface ModelEntry {
    id: string;
    label: string;
    tag: string;
    ctx?: string;
    note?: string;
}

export const GROQ_MODELS: ModelEntry[] = [
    {id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout",          tag: "varsayılan", ctx: "128K", note: "MoE·Vizyon"},
    {id: "qwen/qwen3-32b",                            label: "Qwen3 32B",              tag: "güçlü",      ctx: "128K"},
    {id: "openai/gpt-oss-120b",                       label: "GPT OSS 120B",           tag: "yeni",       ctx: "131K", note: "OpenAI open-weight"},
    {id: "openai/gpt-oss-20b",                        label: "GPT OSS 20B",            tag: "hızlı",      ctx: "131K", note: "~1000 tok/s"},
    {id: "deepseek-r1-distill-llama-70b",             label: "DeepSeek-R1 Distill 70B",tag: "reasoning",  ctx: "128K"},
    {id: "llama-3.3-70b-versatile",                   label: "Llama 3.3 70B",          tag: "",           ctx: "128K"},
    {id: "llama-3.1-8b-instant",                      label: "Llama 3.1 8B",           tag: "hızlı",      ctx: "128K", note: "~560 tok/s"},
    {id: "groq/compound",                             label: "Groq Compound",          tag: "agentic",    ctx: "131K", note: "Web+Kod dahil"},
    {id: "groq/compound-mini",                        label: "Groq Compound Mini",     tag: "agentic",    ctx: "131K"},
    {id: "gemma2-9b-it",                              label: "Gemma2 9B",              tag: "",           ctx: "8K"},
    {id: "mixtral-8x7b-32768",                        label: "Mixtral 8×7B",           tag: "klasik",     ctx: "32K"},
];

export const OPENAI_MODELS: ModelEntry[] = [
    {id: "gpt-5.5",       label: "GPT-5.5",       tag: "yeni",      ctx: "1M",   note: "Flagship"},
    {id: "gpt-5.5-pro",   label: "GPT-5.5 Pro",   tag: "güçlü",     ctx: "1M"},
    {id: "gpt-5.4",       label: "GPT-5.4",        tag: "",          ctx: "1M"},
    {id: "gpt-5.4-mini",  label: "GPT-5.4 Mini",   tag: "hızlı",     ctx: "400K"},
    {id: "gpt-5.4-nano",  label: "GPT-5.4 Nano",   tag: "ekonomik",  ctx: "400K"},
    {id: "gpt-5",         label: "GPT-5",           tag: "",          ctx: "1M"},
    {id: "gpt-5-mini",    label: "GPT-5 Mini",      tag: "",          ctx: "200K"},
    {id: "o3",            label: "o3",              tag: "reasoning", ctx: "200K", note: "o3-2025-04-16"},
    {id: "gpt-4.1",       label: "GPT-4.1",         tag: "eski",      ctx: "1M"},
    {id: "gpt-4o",        label: "GPT-4o",          tag: "eski",      ctx: "128K"},
    {id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo",  tag: "ucuz",      ctx: "16K"},
];

export const ANTHROPIC_MODELS: ModelEntry[] = [
    {id: "claude-opus-4-8",            label: "Claude Opus 4.8",   tag: "yeni",       ctx: "1M",   note: "Adaptive thinking"},
    {id: "claude-opus-4-7",            label: "Claude Opus 4.7",   tag: "güçlü",      ctx: "1M"},
    {id: "claude-sonnet-4-6",          label: "Claude Sonnet 4.6", tag: "varsayılan", ctx: "1M",   note: "Önerilen"},
    {id: "claude-haiku-4-5-20251001",  label: "Claude Haiku 4.5",  tag: "hızlı",      ctx: "200K", note: "En ucuz"},
    {id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", tag: "",           ctx: "200K"},
    {id: "claude-opus-4-5-20251101",   label: "Claude Opus 4.5",   tag: "",           ctx: "200K"},
    {id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet", tag: "thinking",   ctx: "200K"},
    {id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", tag: "eski",       ctx: "200K"},
    {id: "claude-3-5-haiku-20241022",  label: "Claude 3.5 Haiku",  tag: "eski",       ctx: "200K"},
];

export const GEMINI_MODELS: ModelEntry[] = [
    {id: "gemini-3.5-flash",            label: "Gemini 3.5 Flash",      tag: "yeni",      ctx: "1M",  note: "Flagship"},
    {id: "gemini-3.1-pro-preview",      label: "Gemini 3.1 Pro",        tag: "güçlü",     ctx: "1M",  note: "Preview"},
    {id: "gemini-3.1-flash-lite",       label: "Gemini 3.1 Flash Lite", tag: "ekonomik",  ctx: "1M"},
    {id: "gemini-2.5-pro",              label: "Gemini 2.5 Pro",        tag: "varsayılan",ctx: "1M",  note: "En iyi reasoning"},
    {id: "gemini-2.5-flash",            label: "Gemini 2.5 Flash",      tag: "hızlı",     ctx: "1M",  note: "Fiyat/performans"},
    {id: "gemini-2.5-flash-lite",       label: "Gemini 2.5 Flash Lite", tag: "",          ctx: "1M"},
    {id: "gemini-1.5-pro",              label: "Gemini 1.5 Pro",        tag: "eski",      ctx: "2M"},
];

export const MISTRAL_MODELS: ModelEntry[] = [
    {id: "mistral-medium-3.5",      label: "Mistral Medium 3.5",   tag: "yeni",      ctx: "256K", note: "128B · MIT"},
    {id: "mistral-small-2603",      label: "Mistral Small 4",      tag: "varsayılan",ctx: "256K", note: "Reasoning+Vizyon"},
    {id: "mistral-large-latest",    label: "Mistral Large",        tag: "güçlü",     ctx: "256K"},
    {id: "magistral-medium-latest", label: "Magistral Medium",     tag: "reasoning", ctx: "128K"},
    {id: "magistral-small-2506",    label: "Magistral Small",      tag: "reasoning", ctx: "128K"},
    {id: "codestral-latest",        label: "Codestral",            tag: "kod",       ctx: "128K", note: "FIM+kod"},
    {id: "ministral-14b-latest",    label: "Ministral 14B",        tag: "hızlı",     ctx: "256K", note: "Edge"},
    {id: "open-mistral-nemo-2407",  label: "Mistral Nemo",         tag: "açık",      ctx: "128K"},
];

export const XAI_MODELS: ModelEntry[] = [
    {id: "grok-4.3",                     label: "Grok 4.3",             tag: "yeni",      ctx: "1M",   note: "Flagship"},
    {id: "grok-4.20-0309-reasoning",     label: "Grok 4.20 Reasoning",  tag: "reasoning", ctx: "1M"},
    {id: "grok-4.20-0309-non-reasoning", label: "Grok 4.20",            tag: "güçlü",     ctx: "1M"},
    {id: "grok-4.20-multi-agent-0309",   label: "Grok 4.20 Multi-Agent",tag: "agentic",   ctx: "1M"},
    {id: "grok-build-0.1",               label: "Grok Build",           tag: "kod",       ctx: "256K", note: "Agentic kod"},
    {id: "grok-2-vision-1212",           label: "Grok 2 Vision",        tag: "vizyon",    ctx: "32K"},
];

export const DEEPSEEK_MODELS: ModelEntry[] = [
    {id: "deepseek-v4-pro",   label: "DeepSeek V4 Pro",   tag: "yeni",       ctx: "1M",  note: "1.6T params"},
    {id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", tag: "varsayılan", ctx: "1M",  note: "Fiyat/performans"},
    {id: "deepseek-chat",     label: "DeepSeek Chat",     tag: "eski",       ctx: "64K"},
    {id: "deepseek-reasoner", label: "DeepSeek Reasoner", tag: "eski",       ctx: "64K"},
];

export const PROVIDER_MODELS: Record<string, ModelEntry[]> = {
    groq: GROQ_MODELS, openai: OPENAI_MODELS, anthropic: ANTHROPIC_MODELS,
    gemini: GEMINI_MODELS, mistral: MISTRAL_MODELS, xai: XAI_MODELS, deepseek: DEEPSEEK_MODELS,
};

export const DEFAULT_MODEL: Record<string, string> = {
    groq: "meta-llama/llama-4-scout-17b-16e-instruct",
    openai: "gpt-5.5", anthropic: "claude-sonnet-4-6",
    gemini: "gemini-2.5-pro", mistral: "mistral-medium-3.5",
    xai: "grok-4.3", deepseek: "deepseek-v4-flash", ollama: "qwen3:8b",
};

export const TEMP_MAX: Record<string, number> = {
    groq: 2, openai: 2, anthropic: 1, gemini: 2,
    mistral: 1, xai: 2, deepseek: 1.5, ollama: 2,
};

export const MAX_TOKEN_OPTIONS = [512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];

export const AI_PROVIDERS = [
    {id: "groq",      icon: "⚡", label: "Groq",       sub: "Ultra hızlı · Llama 4",     badge: "free"  },
    {id: "openai",    icon: "◎",  label: "OpenAI",     sub: "GPT-5.5 · o3 serisi",       badge: ""      },
    {id: "anthropic", icon: "◈",  label: "Anthropic",  sub: "Claude Opus 4.8",           badge: ""      },
    {id: "gemini",    icon: "◇",  label: "Gemini",     sub: "3.5 Flash · 1M ctx",        badge: "free"  },
    {id: "mistral",   icon: "✦",  label: "Mistral",    sub: "Medium 3.5 · EU · MIT",     badge: ""      },
    {id: "xai",       icon: "✧",  label: "xAI / Grok", sub: "Grok 4.3 · gerçek zamanlı",badge: ""      },
    {id: "deepseek",  icon: "◆",  label: "DeepSeek",   sub: "V4 Pro · 1M ctx",           badge: ""      },
    {id: "ollama",    icon: "◉",  label: "Ollama",     sub: "Yerel · tam offline",        badge: "local" },
] as const;

export function tagColor(tag: string, accent: string): string {
    if (tag === "yeni" || tag === "varsayılan") return `rgba(${accent},0.9)`;
    if (tag === "hızlı") return "rgba(74,222,128,0.9)";
    if (tag === "güçlü") return "rgba(251,146,60,0.9)";
    if (tag === "reasoning" || tag === "thinking") return "rgba(192,132,252,0.9)";
    if (tag === "ekonomik") return "rgba(74,222,128,0.7)";
    if (tag === "vizyon" || tag === "kod") return "rgba(56,189,248,0.9)";
    if (tag === "agentic") return "rgba(251,191,36,0.9)";
    if (tag === "eski") return `rgba(${accent},0.3)`;
    if (tag === "açık" || tag === "klasik" || tag === "ucuz") return `rgba(${accent},0.45)`;
    return `rgba(${accent},0.5)`;
}
