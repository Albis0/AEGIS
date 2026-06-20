// AEGIS — Kurulum (API anahtarları) ekranı — Faz 64 yeni tasarım
import {useState} from "react";
import {Shell, Body, Heading, Field, PrimaryButton, ErrorBox, LinkButton, C, ac, muted} from "./onboarding/ui";

interface Fields {
    groqApiKey: string;
    supabaseUrl: string;
    supabaseServiceKey: string;
    tavilyApiKey: string;
    serperApiKey: string;
}

interface SetupProps {
    // Onboarding akışından çağrıldığında: kaydet sonrası akışı devam ettirir.
    // Verilmezse eski davranış (setupSave + uygulama başlat) korunur.
    onComplete?: () => void;
    onBack?: () => void;
    step?: number;
    totalSteps?: number;
}

export default function SetupScreen({onComplete, onBack, step, totalSteps}: SetupProps = {}) {
    const [fields, setFields] = useState<Fields>({
        groqApiKey: "",
        supabaseUrl: "",
        supabaseServiceKey: "",
        tavilyApiKey: "",
        serperApiKey: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);

    const set = (k: keyof Fields) => (v: string) => setFields((f) => ({...f, [k]: v}));

    async function handleSave() {
        if (!fields.groqApiKey.trim()) { setError("Groq API anahtarı zorunlu."); return; }
        // Supabase opsiyonel (Faz 30): girilirse session/mesaj geçmişi cloud'a kaydedilir.
        const sbUrl = fields.supabaseUrl.trim();
        const sbKey = fields.supabaseServiceKey.trim();
        if ((sbUrl && !sbKey) || (!sbUrl && sbKey)) {
            setError("Supabase için hem URL hem service_role key gerekli (ya ikisini de gir ya da boş bırak).");
            return;
        }
        setError("");
        setSaving(true);
        try {
            await window.jarvis.setupSave({
                groqApiKey: fields.groqApiKey.trim(),
                supabaseUrl: sbUrl,
                supabaseServiceKey: sbKey,
                tavilyApiKey: fields.tavilyApiKey.trim() || undefined,
                serperApiKey: fields.serperApiKey.trim() || undefined,
            });
            onComplete?.();
        } catch (e) {
            setError((e as Error).message ?? "Bilinmeyen hata.");
            setSaving(false);
        }
    }

    return (
        <Shell step={step} totalSteps={totalSteps}>
            <Body>
                <Heading
                    title="Kurulum"
                    subtitle="API anahtarlarını gir. Ayarlar cihazında ~/.aegis/config.json'a kaydedilir."
                />

                {/* Zorunlu: Groq */}
                <Field
                    label="Groq API anahtarı"
                    required
                    type="password"
                    value={fields.groqApiKey}
                    onChange={set("groqApiKey")}
                    placeholder="gsk_…"
                    hint="console.groq.com → API Keys → Create (ücretsiz)"
                />

                {/* Gelişmiş (Supabase + web arama) — varsayılan kapalı, akordeon */}
                <div className="rounded-2xl border" style={{borderColor: `rgba(${C.line},0.14)`, background: "rgba(255,255,255,0.015)"}}>
                    <button
                        onClick={() => setShowAdvanced((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3.5 transition hover:bg-white/[0.03] rounded-2xl"
                    >
                        <div className="text-left">
                            <div className="text-[13.5px] font-medium" style={{color: ac}}>Gelişmiş (opsiyonel)</div>
                            <div className="text-[11.5px]" style={{color: muted}}>Bulut senkronu ve web arama anahtarları</div>
                        </div>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            className="transition-transform duration-200 shrink-0" style={{color: muted, transform: showAdvanced ? "rotate(180deg)" : "none"}}>
                            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>

                    {showAdvanced && (
                        <div className="px-4 pb-4 pt-1 space-y-4 border-t" style={{borderColor: `rgba(${C.line},0.1)`}}>
                            <SectionLabel>Bulut Senkronu — Supabase</SectionLabel>
                            <Field
                                label="Supabase URL" optional type="text"
                                value={fields.supabaseUrl} onChange={set("supabaseUrl")}
                                placeholder="https://xxxx.supabase.co"
                                hint="Konuşma geçmişini bulutta saklamak için. Boş bırakırsan uygulama yine çalışır."
                            />
                            <Field
                                label="Supabase service_role key" optional type="password"
                                value={fields.supabaseServiceKey} onChange={set("supabaseServiceKey")}
                                placeholder="eyJ…"
                                hint="Settings → API → service_role (anon key değil). Girersen supabase/schema.sql'i çalıştırmayı unutma."
                            />

                            <SectionLabel>Web Arama</SectionLabel>
                            <Field
                                label="Tavily API anahtarı" optional type="password"
                                value={fields.tavilyApiKey} onChange={set("tavilyApiKey")}
                                placeholder="tvly-…" hint="app.tavily.com → API Keys (ücretsiz tier)"
                            />
                            <Field
                                label="Serper API anahtarı" optional type="password"
                                value={fields.serperApiKey} onChange={set("serperApiKey")}
                                placeholder="" hint="serper.dev → API Key (ücretsiz tier)"
                            />
                        </div>
                    )}
                </div>

                {error && <ErrorBox>{error}</ErrorBox>}

                <div className="flex flex-col gap-3">
                    <PrimaryButton onClick={handleSave} disabled={saving}>
                        {saving ? "Kaydediliyor…" : "Kaydet ve devam et"}
                    </PrimaryButton>
                    {onBack && (
                        <div className="flex justify-center">
                            <LinkButton onClick={onBack}>‹ Geri</LinkButton>
                        </div>
                    )}
                </div>
            </Body>
        </Shell>
    );
}

function SectionLabel({children}: {children: React.ReactNode}) {
    return (
        <div className="text-[10.5px] font-semibold tracking-[0.18em] uppercase pt-1" style={{color: `rgb(${C.accent})`, opacity: 0.8}}>
            {children}
        </div>
    );
}
