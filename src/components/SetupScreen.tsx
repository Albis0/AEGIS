// AEGIS — Setup (API keys) screen — Phase 64 new design
import {useState} from "react";
import {Shell, Body, Heading, Field, PrimaryButton, ErrorBox, LinkButton, C, ac, muted} from "./onboarding/ui";
import type {SetupStrings} from "../i18n";

interface Fields {
    groqApiKey: string;
    supabaseUrl: string;
    supabaseServiceKey: string;
    tavilyApiKey: string;
    serperApiKey: string;
}

interface SetupProps {
    // When called from the onboarding flow: continues the flow after saving.
    // If not provided, the old behavior (setupSave + start app) is preserved.
    onComplete?: () => void;
    onBack?: () => void;
    step?: number;
    totalSteps?: number;
    t: SetupStrings;
}

export default function SetupScreen({onComplete, onBack, step, totalSteps, t}: SetupProps) {
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
        if (!fields.groqApiKey.trim()) { setError(t.suGroqRequired); return; }
        // Supabase optional (Phase 30): if provided, session/message history is saved to the cloud.
        const sbUrl = fields.supabaseUrl.trim();
        const sbKey = fields.supabaseServiceKey.trim();
        if ((sbUrl && !sbKey) || (!sbUrl && sbKey)) {
            setError(t.suSupabaseBothRequired);
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
            setError((e as Error).message ?? t.suUnknownError);
            setSaving(false);
        }
    }

    return (
        <Shell step={step} totalSteps={totalSteps}>
            <Body>
                <Heading
                    title={t.suTitle}
                    subtitle={t.suSubtitle}
                />

                {/* Required: Groq */}
                <Field
                    label={t.suGroqLabel}
                    required
                    type="password"
                    value={fields.groqApiKey}
                    onChange={set("groqApiKey")}
                    placeholder="gsk_…"
                    hint={t.suGroqHint}
                />

                {/* Advanced (Supabase + web search) — collapsed by default, accordion */}
                <div className="rounded-2xl border" style={{borderColor: `rgba(${C.line},0.14)`, background: "rgba(255,255,255,0.015)"}}>
                    <button
                        onClick={() => setShowAdvanced((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3.5 transition hover:bg-white/[0.03] rounded-2xl"
                    >
                        <div className="text-left">
                            <div className="text-[13.5px] font-medium" style={{color: ac}}>{t.suAdvancedTitle}</div>
                            <div className="text-[11.5px]" style={{color: muted}}>{t.suAdvancedSub}</div>
                        </div>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            className="transition-transform duration-200 shrink-0" style={{color: muted, transform: showAdvanced ? "rotate(180deg)" : "none"}}>
                            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>

                    {showAdvanced && (
                        <div className="px-4 pb-4 pt-1 space-y-4 border-t" style={{borderColor: `rgba(${C.line},0.1)`}}>
                            <SectionLabel>{t.suCloudSyncLabel}</SectionLabel>
                            <Field
                                label={t.suSupabaseUrlLabel} optional type="text"
                                value={fields.supabaseUrl} onChange={set("supabaseUrl")}
                                placeholder="https://xxxx.supabase.co"
                                hint={t.suSupabaseUrlHint}
                            />
                            <Field
                                label={t.suSupabaseKeyLabel} optional type="password"
                                value={fields.supabaseServiceKey} onChange={set("supabaseServiceKey")}
                                placeholder="eyJ…"
                                hint={t.suSupabaseKeyHint}
                            />

                            <SectionLabel>{t.suWebSearchLabel}</SectionLabel>
                            <Field
                                label={t.suTavilyLabel} optional type="password"
                                value={fields.tavilyApiKey} onChange={set("tavilyApiKey")}
                                placeholder="tvly-…" hint={t.suTavilyHint}
                            />
                            <Field
                                label={t.suSerperLabel} optional type="password"
                                value={fields.serperApiKey} onChange={set("serperApiKey")}
                                placeholder="" hint={t.suSerperHint}
                            />
                        </div>
                    )}
                </div>

                {error && <ErrorBox>{error}</ErrorBox>}

                <div className="flex flex-col gap-3">
                    <PrimaryButton onClick={handleSave} disabled={saving}>
                        {saving ? t.suSaving : t.suSaveBtn}
                    </PrimaryButton>
                    {onBack && (
                        <div className="flex justify-center">
                            <LinkButton onClick={onBack}>{t.suBackBtn}</LinkButton>
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
