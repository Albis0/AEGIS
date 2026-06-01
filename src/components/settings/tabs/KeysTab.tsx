import type {AegisConfig} from "../../../electron.d";
import {SectionLabel, KeyField, Hint} from "../shared";

interface Props {
    config: AegisConfig;
    accent: string;
    ac: string;
    onApplyConfig: (patch: Partial<AegisConfig>) => void;
}

interface KeyRow {
    label: string;
    hint: string;
    value: string;
    onSave: (v: string) => void;
    required?: boolean;
}

export default function KeysTab({config, accent, ac, onApplyConfig}: Props) {
    const rows: KeyRow[] = [
        {
            label: "GROQ",
            hint: "gsk_...",
            value: config.groqApiKey,
            onSave: (v) => onApplyConfig({groqApiKey: v}),
            required: true,
        },
        {
            label: "SUPABASE URL",
            hint: "https://xxxx.supabase.co",
            value: config.supabaseUrl,
            onSave: (v) => onApplyConfig({supabaseUrl: v}),
        },
        {
            label: "SUPABASE SERVICE KEY",
            hint: "eyJ...",
            value: config.supabaseServiceKey,
            onSave: (v) => onApplyConfig({supabaseServiceKey: v}),
        },
        {
            label: "TAVILY",
            hint: "tvly-... (opsiyonel · web arama)",
            value: config.tavilyApiKey ?? "",
            onSave: (v) => onApplyConfig({tavilyApiKey: v || undefined}),
        },
        {
            label: "SERPER",
            hint: "opsiyonel · yedek arama",
            value: config.serperApiKey ?? "",
            onSave: (v) => onApplyConfig({serperApiKey: v || undefined}),
        },
        {
            label: "ELEVENLABS",
            hint: "sk_... (opsiyonel · gelişmiş TTS)",
            value: config.elevenlabsApiKey ?? "",
            onSave: (v) => onApplyConfig({elevenlabsApiKey: v || undefined}),
        },
    ];

    return (
        <div className="space-y-6">
            <p className="text-[12px] leading-relaxed" style={{color: `rgba(${accent},0.4)`}}>
                Groq + Supabase temel servisler için zorunludur. Tavily / Serper web araması, ElevenLabs gelişmiş ses sentezi için opsiyoneldir.
                AI provider key'leri için <span style={{color: ac}}>Model</span> sekmesini kullan.
            </p>

            {rows.map((row) => (
                <div key={row.label}>
                    <SectionLabel label={row.label} accent={accent} />
                    {row.required && (
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                                style={{color: "rgba(74,222,128,0.8)", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)"}}>
                                GEREKLİ
                            </span>
                            {row.value && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full"
                                    style={{color: `rgba(${accent},0.6)`, background: `rgba(${accent},0.07)`, border: `1px solid rgba(${accent},0.15)`}}>
                                    ✓ AYARLI
                                </span>
                            )}
                        </div>
                    )}
                    <KeyField value={row.value} placeholder={row.hint} onSave={row.onSave} accent={accent} />
                </div>
            ))}

            <div className="rounded-xl p-4 space-y-2" style={{background: `rgba(${accent},0.04)`, border: `1px solid rgba(${accent},0.1)`}}>
                <p className="text-[11px] font-medium" style={{color: `rgba(${accent},0.6)`}}>Güvenlik notu</p>
                <p className="text-[11px] leading-relaxed" style={{color: `rgba(${accent},0.35)`}}>
                    Tüm API key'ler şifreli olarak <code style={{color: `rgba(${accent},0.55)`}}>~/.aegis/config.json</code> dosyasında saklanır.
                    Ağ üzerinden iletilmez.
                </p>
            </div>

            <Hint accent={accent}>
                Groq key'ini almak için: <span style={{color: `rgba(${accent},0.6)`}}>console.groq.com</span> — ücretsiz tier mevcut.
            </Hint>
        </div>
    );
}
