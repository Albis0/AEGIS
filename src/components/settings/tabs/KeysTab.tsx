import type {AegisConfig} from "../../../electron.d";
import {SectionLabel, KeyField, Hint} from "../shared";
import type {SettingsStrings} from "../../../i18n";

interface Props {
    config: AegisConfig;
    accent: string;
    ac: string;
    onApplyConfig: (patch: Partial<AegisConfig>) => void;
    s: SettingsStrings;
}

interface KeyRow {
    label: string;
    hint: string;
    value: string;
    onSave: (v: string) => void;
    required?: boolean;
}

export default function KeysTab({config, accent, onApplyConfig, s}: Props) {
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
            hint: s.keysTavilyHint,
            value: config.tavilyApiKey ?? "",
            onSave: (v) => onApplyConfig({tavilyApiKey: v || undefined}),
        },
        {
            label: "SERPER",
            hint: s.keysSerperHint,
            value: config.serperApiKey ?? "",
            onSave: (v) => onApplyConfig({serperApiKey: v || undefined}),
        },
        {
            label: "ELEVENLABS",
            hint: s.keysElevenHint,
            value: config.elevenlabsApiKey ?? "",
            onSave: (v) => onApplyConfig({elevenlabsApiKey: v || undefined}),
        },
        {
            label: "STEAM API KEY",
            hint: s.keysSteamKeyHint,
            value: config.steamApiKey ?? "",
            onSave: (v) => onApplyConfig({steamApiKey: v || undefined}),
        },
        {
            label: "STEAMID64",
            hint: s.keysSteamIdHint,
            value: config.steamId64 ?? "",
            onSave: (v) => onApplyConfig({steamId64: v || undefined}),
        },
        {
            label: s.keysHaUrlLabel,
            hint: s.keysHaUrlHint,
            value: config.homeAssistantUrl ?? "",
            onSave: (v) => onApplyConfig({homeAssistantUrl: v || undefined}),
        },
        {
            label: s.keysHaTokenLabel,
            hint: s.keysHaTokenHint,
            value: config.homeAssistantToken ?? "",
            onSave: (v) => onApplyConfig({homeAssistantToken: v || undefined}),
        },
    ];

    return (
        <div className="space-y-6">
            <p className="text-[12px] leading-relaxed" style={{color: `rgba(${accent},0.4)`}}>
                {s.keysHint}
            </p>

            {rows.map((row) => (
                <div key={row.label}>
                    <SectionLabel label={row.label} accent={accent} />
                    {row.required && (
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                                style={{color: "rgba(74,222,128,0.8)", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)"}}>
                                {s.keysRequiredBadge}
                            </span>
                            {row.value && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full"
                                    style={{color: `rgba(${accent},0.6)`, background: `rgba(${accent},0.07)`, border: `1px solid rgba(${accent},0.15)`}}>
                                    {s.keysSetBadge}
                                </span>
                            )}
                        </div>
                    )}
                    <KeyField value={row.value} placeholder={row.hint} onSave={row.onSave} accent={accent} s={s} />
                </div>
            ))}

            <div className="rounded-xl p-4 space-y-2" style={{background: `rgba(${accent},0.04)`, border: `1px solid rgba(${accent},0.1)`}}>
                <p className="text-[11px] font-medium" style={{color: `rgba(${accent},0.6)`}}>{s.keysSecurityNoteTitle}</p>
                <p className="text-[11px] leading-relaxed" style={{color: `rgba(${accent},0.35)`}}>
                    {s.keysSecurityNoteBodyPrefix}<code style={{color: `rgba(${accent},0.55)`}}>~/.aegis/</code>{s.keysSecurityNoteBodySuffix}
                </p>
            </div>

            <Hint accent={accent}>
                {s.keysGroqHintPrefix}<span style={{color: `rgba(${accent},0.6)`}}>console.groq.com</span>{s.keysGroqHintSuffix}
            </Hint>
        </div>
    );
}
