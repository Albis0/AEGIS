import {useState} from "react";

interface Fields {
    groqApiKey: string;
    supabaseUrl: string;
    supabaseServiceKey: string;
    tavilyApiKey: string;
    serperApiKey: string;
}

const CYAN = "34,211,238";
const ac = `rgb(${CYAN})`;
const border = `rgba(${CYAN},0.15)`;

export default function SetupScreen() {
    const [fields, setFields] = useState<Fields>({
        groqApiKey: "",
        supabaseUrl: "",
        supabaseServiceKey: "",
        tavilyApiKey: "",
        serperApiKey: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setFields((f) => ({...f, [k]: e.target.value}));

    async function handleSave() {
        if (!fields.groqApiKey.trim()) { setError("Groq API key zorunlu."); return; }
        if (!fields.supabaseUrl.trim()) { setError("Supabase URL zorunlu."); return; }
        if (!fields.supabaseServiceKey.trim()) { setError("Supabase service_role key zorunlu."); return; }
        setError("");
        setSaving(true);
        try {
            await window.jarvis.setupSave({
                groqApiKey: fields.groqApiKey.trim(),
                supabaseUrl: fields.supabaseUrl.trim(),
                supabaseServiceKey: fields.supabaseServiceKey.trim(),
                tavilyApiKey: fields.tavilyApiKey.trim() || undefined,
                serperApiKey: fields.serperApiKey.trim() || undefined,
            });
        } catch (e) {
            setError((e as Error).message ?? "Bilinmeyen hata.");
            setSaving(false);
        }
    }

    return (
        <div
            className="h-screen w-screen flex flex-col"
            style={{
                background: "#03060c",
                color: ac,
                fontFamily: "'JetBrains Mono', monospace",
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale",
            } as React.CSSProperties}
        >
            {/* Drag bar */}
            <div className="drag h-9 shrink-0 flex items-center justify-between px-5">
                <span
                    className="text-[11px] tracking-[0.45em]"
                    style={{fontFamily: "Orbitron, sans-serif", color: ac, opacity: 0.6}}
                >
                    AEGIS · KURULUM
                </span>
                <button
                    className="no-drag w-7 h-7 grid place-items-center opacity-40 hover:opacity-100 transition text-sm"
                    style={{color: ac}}
                    onClick={() => window.jarvis.close()}
                >
                    ✕
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-4 flex flex-col gap-6">

                {/* Title */}
                <div>
                    <div
                        className="text-2xl"
                        style={{fontFamily: "Orbitron, sans-serif", color: ac}}
                    >
                        İlk Kurulum
                    </div>
                    <p className="text-[12px] mt-1.5 leading-relaxed" style={{color: ac, opacity: 0.5}}>
                        API key'leri gir — ayarlar <code style={{opacity: 0.8}}>~/.aegis/config.json</code>'a kaydedilir.
                    </p>
                </div>

                {/* Zorunlu alanlar */}
                <div className="space-y-5">
                    <Field
                        label="GROQ API KEY"
                        required
                        hint="console.groq.com → API Keys → Create (ücretsiz)"
                        type="password"
                        value={fields.groqApiKey}
                        onChange={set("groqApiKey")}
                        placeholder="gsk_..."
                    />
                    <Field
                        label="SUPABASE URL"
                        required
                        hint="Supabase Dashboard → Settings → API → Project URL"
                        type="text"
                        value={fields.supabaseUrl}
                        onChange={set("supabaseUrl")}
                        placeholder="https://xxxx.supabase.co"
                    />
                    <Field
                        label="SUPABASE SERVICE_ROLE KEY"
                        required
                        hint="Settings → API → service_role (anon key değil)"
                        type="password"
                        value={fields.supabaseServiceKey}
                        onChange={set("supabaseServiceKey")}
                        placeholder="eyJ..."
                    />
                </div>

                {/* Opsiyonel */}
                <div>
                    <div
                        className="text-[10px] tracking-[0.35em] mb-4 pb-2 border-b flex items-center gap-2"
                        style={{color: `rgba(${CYAN},0.4)`, borderColor: `rgba(${CYAN},0.1)`}}
                    >
                        <span className="flex-1 border-t" style={{borderColor: `rgba(${CYAN},0.1)`}} />
                        OPSİYONEL — WEB ARAMA
                        <span className="flex-1 border-t" style={{borderColor: `rgba(${CYAN},0.1)`}} />
                    </div>
                    <div className="space-y-5">
                        <Field
                            label="TAVILY API KEY"
                            hint="app.tavily.com → API Keys (ücretsiz tier)"
                            type="password"
                            value={fields.tavilyApiKey}
                            onChange={set("tavilyApiKey")}
                            placeholder="tvly-..."
                        />
                        <Field
                            label="SERPER API KEY"
                            hint="serper.dev → API Key (ücretsiz tier)"
                            type="password"
                            value={fields.serperApiKey}
                            onChange={set("serperApiKey")}
                            placeholder=""
                        />
                    </div>
                </div>

                {/* Supabase uyarısı */}
                <div
                    className="text-[12px] rounded-lg px-4 py-3 leading-relaxed"
                    style={{
                        borderLeft: "2px solid rgba(245,185,60,0.5)",
                        background: "rgba(245,185,60,0.05)",
                        color: "rgb(245,185,60)",
                    }}
                >
                    ⚠ Supabase tablolarını oluşturdun mu? <code style={{opacity: 0.85}}>supabase/schema.sql</code> dosyasını Supabase SQL Editor'da çalıştır.
                </div>

                {/* Hata */}
                {error && (
                    <div
                        className="text-[12px] px-4 py-2.5 rounded-lg"
                        style={{
                            color: "#f87171",
                            background: "rgba(248,113,113,0.07)",
                            border: "1px solid rgba(248,113,113,0.25)",
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* Kaydet */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3 rounded-xl border text-[13px] tracking-[0.3em] disabled:opacity-40 transition hover:brightness-125"
                    style={{
                        fontFamily: "Orbitron, sans-serif",
                        color: ac,
                        borderColor: `rgba(${CYAN},0.4)`,
                        background: `rgba(${CYAN},0.07)`,
                    }}
                >
                    {saving ? "KAYDEDİLİYOR…" : "KAYDET VE BAŞLAT"}
                </button>

                <div className="pb-2" />
            </div>
        </div>
    );
}

function Field({
    label, required, hint, type, value, onChange, placeholder,
}: {
    label: string;
    required?: boolean;
    hint?: string;
    type: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
                <span
                    className="text-[11px] tracking-[0.25em]"
                    style={{color: `rgba(${CYAN},0.6)`}}
                >
                    {label}
                </span>
                {required && (
                    <span className="text-[11px]" style={{color: "#f87171"}}>*</span>
                )}
            </div>
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full bg-transparent rounded-lg px-3 py-2.5 text-[13px] outline-none border transition"
                style={{
                    borderColor: value ? `rgba(${CYAN},0.4)` : border,
                    color: ac,
                }}
            />
            {hint && (
                <p className="text-[11px] leading-relaxed" style={{color: `rgba(${CYAN},0.4)`}}>
                    {hint}
                </p>
            )}
        </div>
    );
}
