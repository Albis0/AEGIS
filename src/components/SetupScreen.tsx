import {useState} from "react";

interface Fields {
    groqApiKey: string;
    supabaseUrl: string;
    supabaseServiceKey: string;
    tavilyApiKey: string;
    serperApiKey: string;
}

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
        <div className="h-screen w-screen flex flex-col" style={{background: "#03060c", color: "rgb(34,211,238)", fontFamily: "'JetBrains Mono', monospace"}}>
            {/* Drag bar */}
            <div className="drag h-8 shrink-0 flex items-center justify-between px-4">
                <span className="text-[10px] tracking-[0.4em] opacity-50" style={{fontFamily: "Orbitron, sans-serif"}}>AEGIS SETUP</span>
                <button className="no-drag opacity-40 hover:opacity-100 transition text-xs" style={{color: "rgb(248,120,120)"}} onClick={() => window.jarvis.close()}>✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-2 flex flex-col gap-5">
                {/* Header */}
                <div>
                    <div className="text-[22px] glow-text" style={{fontFamily: "Orbitron, sans-serif"}}>İlk Kurulum</div>
                    <p className="text-[11px] opacity-50 mt-1">API key'leri gir, ayarlar <code>~/.aegis/config.json</code>'a kaydedilir.</p>
                </div>

                {/* Groq */}
                <Section title="GROQ API KEY" required hint="console.groq.com → API Keys → Create API Key (ücretsiz)">
                    <Field type="password" value={fields.groqApiKey} onChange={set("groqApiKey")} placeholder="gsk_..." />
                </Section>

                {/* Supabase */}
                <Section title="SUPABASE URL" required hint="Supabase Dashboard → Settings → API → Project URL">
                    <Field type="text" value={fields.supabaseUrl} onChange={set("supabaseUrl")} placeholder="https://xxxx.supabase.co" />
                </Section>

                <Section title="SUPABASE SERVICE_ROLE KEY" required hint="Settings → API → service_role (anon key değil)">
                    <Field type="password" value={fields.supabaseServiceKey} onChange={set("supabaseServiceKey")} placeholder="eyJ..." />
                </Section>

                {/* Opsiyonel */}
                <div>
                    <div className="text-[9px] tracking-[0.3em] opacity-40 mb-3 border-b pb-1" style={{borderColor: "rgba(34,211,238,0.1)"}}>
                        OPSİYONEL — Web Arama (yoksa DuckDuckGo kullanılır)
                    </div>
                    <div className="space-y-3">
                        <Section title="TAVILY API KEY" hint="app.tavily.com → API Keys (ücretsiz tier var)">
                            <Field type="password" value={fields.tavilyApiKey} onChange={set("tavilyApiKey")} placeholder="tvly-..." />
                        </Section>
                        <Section title="SERPER API KEY (Google arama)" hint="serper.dev → API Key (ücretsiz tier var)">
                            <Field type="password" value={fields.serperApiKey} onChange={set("serperApiKey")} placeholder="" />
                        </Section>
                    </div>
                </div>

                {/* Supabase schema reminder */}
                <div className="text-[10px] rounded-lg px-3 py-2.5 border" style={{borderColor: "rgba(245,185,60,0.25)", background: "rgba(245,185,60,0.04)", color: "rgb(245,185,60)"}}>
                    ⚠ Supabase tablolarını oluşturdun mu? Repodan <code>supabase/schema.sql</code> dosyasını Supabase SQL Editor'da çalıştır.
                </div>

                {error && (
                    <div className="text-[11px] px-3 py-2 rounded border" style={{color: "rgb(248,120,120)", borderColor: "rgba(248,120,120,0.3)", background: "rgba(248,120,120,0.06)"}}>
                        {error}
                    </div>
                )}

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3 rounded-xl border text-[12px] tracking-[0.3em] disabled:opacity-40 transition hover:brightness-125"
                    style={{fontFamily: "Orbitron, sans-serif", color: "rgb(34,211,238)", borderColor: "rgba(34,211,238,0.4)", background: "rgba(34,211,238,0.06)"}}
                >
                    {saving ? "KAYDEDİLİYOR…" : "KAYDET VE BAŞLAT"}
                </button>

                <div className="pb-4" />
            </div>
        </div>
    );
}

function Section({title, required, hint, children}: {title: string; required?: boolean; hint?: string; children: React.ReactNode}) {
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[9px] tracking-[0.25em] opacity-60">{title}</span>
                {required && <span className="text-[9px]" style={{color: "rgb(248,120,120)"}}>*</span>}
            </div>
            {children}
            {hint && <p className="text-[9px] opacity-35 mt-1 pl-0.5">{hint}</p>}
        </div>
    );
}

function Field({type, value, onChange, placeholder}: {type: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string}) {
    return (
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-transparent rounded-lg px-3 py-2 text-[12px] outline-none border transition"
            style={{
                borderColor: value ? "rgba(34,211,238,0.35)" : "rgba(34,211,238,0.12)",
                color: "rgb(34,211,238)",
            }}
        />
    );
}
