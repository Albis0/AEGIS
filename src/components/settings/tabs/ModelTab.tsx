import {useState, useEffect} from "react";
import type {AppSettings, AiProvider, ModelCaps} from "../../../electron.d";
import {
    SectionLabel, FieldLabel, Hint, RadioCard, KeyField, PlainField,
    AI_PROVIDERS, PROVIDER_MODELS, DEFAULT_MODEL, TEMP_MAX, MAX_TOKEN_OPTIONS, tagColor,
} from "../shared";
import type {SettingsStrings} from "../../../i18n";

interface Props {
    settings: AppSettings;
    accent: string;
    ac: string;
    onApply: (patch: Partial<AppSettings>) => void;
    s: SettingsStrings;
}

type DisplayModel = {id: string; label: string; tag?: string; ctx?: string; note?: string};

export default function ModelTab({settings, accent, ac, onApply, s}: Props) {
    const [paramsOpen, setParamsOpen] = useState(false);
    const provider = settings.aiProvider as AiProvider;
    const tempMax = TEMP_MAX[provider] ?? 2;
    const needsKey = provider !== "groq" && provider !== "ollama";
    const currentKey = settings.providerKeys?.[provider] ?? "";

    // Live model list — from the provider's official endpoint. On empty/error,
    // falls back to the hardcoded list (solves the made-up ID problem, list won't go stale).
    const fallback = PROVIDER_MODELS[provider] ?? [];
    const [liveModels, setLiveModels] = useState<DisplayModel[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    // Selected model's capabilities — from the single source of truth in the backend (model-capabilities).
    const [caps, setCaps] = useState<ModelCaps | null>(null);
    useEffect(() => {
        let cancelled = false;
        if (!settings.model) { setCaps(null); return; }
        window.jarvis.capsGet(provider, settings.model)
            .then((c) => { if (!cancelled) setCaps(c); })
            .catch(() => { if (!cancelled) setCaps(null); });
        return () => { cancelled = true; };
    }, [provider, settings.model]);

    useEffect(() => {
        if (provider === "ollama") { setLiveModels([]); return; }
        let cancelled = false;
        setLoadingModels(true);
        setLiveModels([]);
        window.jarvis.modelsList(provider, currentKey || undefined)
            .then((list) => {
                if (cancelled) return;
                const models = list.map((m) => ({id: m.id, label: m.label ?? m.id}));
                setLiveModels(models);
                // If the selected model isn't in the live list (made-up/dead ID) → switch to the first one in the list.
                if (models.length > 0 && !models.some((m) => m.id === settings.model)) {
                    onApply({model: models[0].id});
                }
            })
            .catch(() => { if (!cancelled) setLiveModels([]); })
            .finally(() => { if (!cancelled) setLoadingModels(false); });
        return () => { cancelled = true; };
    }, [provider, currentKey]);

    // Show the live list if available, otherwise the hardcoded fallback.
    const modelList: DisplayModel[] = liveModels.length > 0
        ? liveModels
        : fallback.map((m) => ({id: m.id, label: m.label, tag: m.tag, ctx: m.ctx, note: m.note}));

    function saveProviderKey(key: string) {
        onApply({providerKeys: {...(settings.providerKeys ?? {}), [provider]: key}});
    }

    return (
        <div className="space-y-7">

            {/* Provider grid */}
            <div>
                <SectionLabel label={s.mdProvider} accent={accent} />
                <div className="grid grid-cols-2 gap-2">
                    {AI_PROVIDERS.map((p) => {
                        const active = provider === p.id;
                        return (
                            <RadioCard key={p.id} active={active} accent={accent}
                                onClick={() => onApply({aiProvider: p.id as AiProvider, model: DEFAULT_MODEL[p.id] ?? ""})}
                                className="flex items-center gap-3 px-3.5 py-3">
                                <span className="text-xl shrink-0 w-6 text-center leading-none"
                                    style={{color: active ? ac : `rgba(${accent},0.3)`}}>{p.icon}</span>
                                <span className="flex-1 min-w-0">
                                    <span className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[13px] font-semibold truncate"
                                            style={{color: active ? ac : `rgba(${accent},0.65)`}}>{p.label}</span>
                                        {p.badge === "free" && (
                                            <span className="text-[8px] px-1.5 py-0.5 rounded-full shrink-0 font-medium"
                                                style={{color: "rgba(74,222,128,0.9)", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)"}}>FREE</span>
                                        )}
                                        {p.badge === "local" && (
                                            <span className="text-[8px] px-1.5 py-0.5 rounded-full shrink-0"
                                                style={{color: `rgba(${accent},0.7)`, background: `rgba(${accent},0.08)`, border: `1px solid rgba(${accent},0.15)`}}>LOCAL</span>
                                        )}
                                    </span>
                                    <span className="block text-[10px] mt-0.5 truncate" style={{color: `rgba(${accent},0.35)`}}>{p.sub}</span>
                                </span>
                                {active && (
                                    <span className="w-2 h-2 rounded-full shrink-0"
                                        style={{background: ac, boxShadow: `0 0 6px ${ac}`}} />
                                )}
                            </RadioCard>
                        );
                    })}
                </div>
            </div>

            {/* API key */}
            {needsKey && (
                <div>
                    <SectionLabel label={`${provider.toUpperCase()} API KEY`} accent={accent} />
                    <KeyField
                        value={currentKey}
                        placeholder={({openai:"sk-...", anthropic:"sk-ant-...", mistral:"...", gemini:"AIza...", xai:"xai-...", deepseek:"sk-..."} as Record<string,string>)[provider] ?? "..."}
                        onSave={saveProviderKey}
                        accent={accent}
                    />
                    <Hint accent={accent}>{s.mdKeyHint}</Hint>
                </div>
            )}

            {/* Ollama */}
            {provider === "ollama" && (
                <div>
                    <SectionLabel label={s.mdOllama} accent={accent} />
                    <div className="space-y-3">
                        <div>
                            <FieldLabel accent={accent}>{s.mdUrl}</FieldLabel>
                            <PlainField value={settings.ollamaUrl || "http://localhost:11434"} placeholder="http://localhost:11434"
                                onSave={(v) => onApply({ollamaUrl: v})} accent={accent} />
                        </div>
                        <div>
                            <FieldLabel accent={accent}>{s.mdModelName}</FieldLabel>
                            <PlainField value={settings.model} placeholder="llama3.2, mistral, gemma2..."
                                onSave={(v) => onApply({model: v})} accent={accent} />
                        </div>
                        <div>
                            <FieldLabel accent={accent}>{s.mdCtx}</FieldLabel>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {[2048, 4096, 8192, 16384, 32768].map((n) => {
                                    const active = (settings.ollamaNumCtx ?? 4096) === n;
                                    return (
                                        <button key={n} onClick={() => onApply({ollamaNumCtx: n})}
                                            className="px-2.5 py-1.5 rounded-lg text-[11px] transition"
                                            style={{
                                                background: active ? `rgba(${accent},0.15)` : "transparent",
                                                border: `1px solid ${active ? `rgba(${accent},0.4)` : `rgba(${accent},0.1)`}`,
                                                color: active ? ac : `rgba(${accent},0.45)`,
                                            }}>
                                            {n >= 1024 ? `${n / 1024}K` : n}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <Hint accent={accent}>{s.mdOllamaHint}</Hint>
                    </div>
                </div>
            )}

            {/* Model list */}
            {provider !== "ollama" && (
                <div>
                    <SectionLabel label={s.mdModel} accent={accent} />
                    {loadingModels && (
                        <Hint accent={accent}>{s.mdLoadingModels}</Hint>
                    )}
                    {!loadingModels && liveModels.length === 0 && (
                        <Hint accent={accent}>{needsKey && !currentKey ? s.mdNoKey : s.mdNoLive}</Hint>
                    )}
                    <div className="space-y-1">
                        {modelList.map((m) => {
                            const active = settings.model === m.id;
                            const tc = tagColor(m.tag ?? "", accent);
                            return (
                                <button key={m.id} onClick={() => onApply({model: m.id})}
                                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all"
                                    style={{
                                        background: active ? `rgba(${accent},0.1)` : "transparent",
                                        border: `1px solid ${active ? `rgba(${accent},0.3)` : "transparent"}`,
                                    }}>
                                    <span className="w-2 h-2 rounded-full shrink-0 border transition-all"
                                        style={{borderColor: active ? ac : `rgba(${accent},0.2)`, background: active ? ac : "transparent"}} />
                                    <span className="flex-1 text-[13px] font-medium"
                                        style={{color: active ? ac : `rgba(${accent},0.6)`}}>{m.label}</span>
                                    <span className="flex items-center gap-1.5 shrink-0">
                                        {m.ctx && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                                                style={{color: `rgba(${accent},0.4)`, background: `rgba(${accent},0.06)`, border: `1px solid rgba(${accent},0.1)`}}>{m.ctx}</span>
                                        )}
                                        {m.tag && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                                                style={{color: tc, border: `1px solid ${tc.replace(/0\.\d\)/, "0.22)")}`}}>{m.tag}</span>
                                        )}
                                        {m.note && (
                                            <span className="text-[10px] opacity-30" style={{color: ac}}>{m.note}</span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Model capabilities — what can the selected model do? */}
            {caps && (
                <div>
                    <SectionLabel label={s.mdCaps} accent={accent} />
                    <CapsBadges caps={caps} accent={accent} ac={ac} s={s} />
                </div>
            )}

            {/* Advanced params */}
            <div className="rounded-xl overflow-hidden" style={{border: `1px solid rgba(${accent},0.1)`}}>
                <button onClick={() => setParamsOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 transition"
                    style={{background: paramsOpen ? `rgba(${accent},0.06)` : "transparent"}}>
                    <span className="text-[10px] font-medium tracking-[0.3em]" style={{color: `rgba(${accent},0.5)`}}>{s.mdParams}</span>
                    <span className="text-[10px] transition-transform duration-200"
                        style={{color: `rgba(${accent},0.4)`, transform: paramsOpen ? "rotate(180deg)" : "none"}}>▼</span>
                </button>

                {paramsOpen && (
                    <div className="px-4 pb-4 space-y-5" style={{borderTop: `1px solid rgba(${accent},0.08)`}}>

                        <div className="pt-4">
                            <div className="flex items-center justify-between mb-2">
                                <FieldLabel accent={accent}>{s.mdTemp}</FieldLabel>
                                <span className="text-[13px] tabular-nums font-medium"
                                    style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{(settings.temperature ?? 0.7).toFixed(2)}</span>
                            </div>
                            <input type="range" min={0} max={tempMax} step={0.05}
                                value={settings.temperature ?? 0.7}
                                onChange={(e) => onApply({temperature: parseFloat(e.target.value)})}
                                className="w-full" style={{accentColor: ac}} />
                            <div className="flex justify-between mt-1">
                                <span className="text-[10px] opacity-30" style={{color: ac}}>{s.mdTempMin}</span>
                                <span className="text-[10px] opacity-30" style={{color: ac}}>{s.mdTempMax}</span>
                            </div>
                        </div>

                        <div>
                            <FieldLabel accent={accent}>{s.mdMaxTokens}</FieldLabel>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {MAX_TOKEN_OPTIONS.map((n) => {
                                    const active = (settings.maxTokens ?? 8192) === n;
                                    return (
                                        <button key={n} onClick={() => onApply({maxTokens: n})}
                                            className="px-2.5 py-1.5 rounded-lg text-[11px] transition"
                                            style={{
                                                background: active ? `rgba(${accent},0.15)` : "transparent",
                                                border: `1px solid ${active ? `rgba(${accent},0.4)` : `rgba(${accent},0.1)`}`,
                                                color: active ? ac : `rgba(${accent},0.45)`,
                                            }}>
                                            {n >= 1024 ? `${n / 1024}K` : `${n}`}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <FieldLabel accent={accent}>Top-P</FieldLabel>
                                <span className="text-[13px] tabular-nums font-medium"
                                    style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{(settings.topP ?? 1.0).toFixed(2)}</span>
                            </div>
                            <input type="range" min={0} max={1} step={0.01}
                                value={settings.topP ?? 1.0}
                                onChange={(e) => onApply({topP: parseFloat(e.target.value)})}
                                className="w-full" style={{accentColor: ac}} />
                        </div>

                        {provider === "openai" && (
                            <>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <FieldLabel accent={accent}>Presence Penalty</FieldLabel>
                                        <span className="text-[13px] tabular-nums font-medium"
                                            style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{(settings.presencePenalty ?? 0).toFixed(2)}</span>
                                    </div>
                                    <input type="range" min={-2} max={2} step={0.05}
                                        value={settings.presencePenalty ?? 0}
                                        onChange={(e) => onApply({presencePenalty: parseFloat(e.target.value)})}
                                        className="w-full" style={{accentColor: ac}} />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <FieldLabel accent={accent}>Frequency Penalty</FieldLabel>
                                        <span className="text-[13px] tabular-nums font-medium"
                                            style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{(settings.frequencyPenalty ?? 0).toFixed(2)}</span>
                                    </div>
                                    <input type="range" min={-2} max={2} step={0.05}
                                        value={settings.frequencyPenalty ?? 0}
                                        onChange={(e) => onApply({frequencyPenalty: parseFloat(e.target.value)})}
                                        className="w-full" style={{accentColor: ac}} />
                                </div>
                            </>
                        )}

                        {provider === "mistral" && (
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <span className="text-[12px] font-medium" style={{color: `rgba(${accent},0.7)`}}>Safe Mode</span>
                                    <p className="text-[10px] opacity-35 mt-0.5" style={{color: ac}}>{s.mdMistralSafeHint}</p>
                                </div>
                                <button onClick={() => onApply({mistralSafeMode: !(settings.mistralSafeMode ?? false)})}
                                    className="shrink-0 w-11 h-6 rounded-full relative transition-all"
                                    style={{
                                        background: settings.mistralSafeMode ? `rgba(${accent},0.45)` : `rgba(${accent},0.08)`,
                                        border: `1px solid ${settings.mistralSafeMode ? `rgba(${accent},0.6)` : `rgba(${accent},0.2)`}`,
                                    }}>
                                    <span className="absolute top-1 w-4 h-4 rounded-full transition-all"
                                        style={{
                                            background: settings.mistralSafeMode ? `rgb(${accent})` : `rgba(${accent},0.3)`,
                                            left: settings.mistralSafeMode ? "calc(100% - 18px)" : "2px",
                                        }} />
                                </button>
                            </div>
                        )}

                        <button onClick={() => onApply({temperature: 0.7, maxTokens: 8192, topP: 1.0, presencePenalty: 0, frequencyPenalty: 0})}
                            className="text-[10px] tracking-widest opacity-25 hover:opacity-60 transition flex items-center gap-1.5"
                            style={{color: ac}}>
                            {s.mdResetDefaults}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function fmtTok(n: number): string {
    if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))}M`;
    if (n >= 1024) return `${Math.round(n / 1024)}K`;
    return `${n}`;
}

// Shows the selected model's capabilities as badges. Green = supported,
// dim/red = not supported. The user clearly sees the model's limits.
// Stroke (line) icons — they take the badge's color via currentColor. No emoji.
const svgProps = {width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    shapeRendering: "geometricPrecision" as const, style: {display: "block"} as const};
const IconTerminal = () => (<svg {...svgProps}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>);
const IconEye = () => (<svg {...svgProps}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>);
const IconDiamond = () => (<svg {...svgProps}><path d="M12 2 22 12 12 22 2 12Z" /></svg>);
const IconCheck = () => (<svg {...svgProps}><polyline points="20 6 9 17 4 12" /></svg>);
const IconCross = () => (<svg {...svgProps}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>);

function CapsBadges({caps, accent, ac, s}: {caps: ModelCaps; accent: string; ac: string; s: SettingsStrings}) {
    const yes = "74,222,128", no = "248,113,113", purp = "192,132,252";

    // Large supported/not-supported badge
    const Cap = ({on, label, icon}: {on: boolean; label: string; icon: React.ReactNode}) => {
        const col = on ? `rgb(${yes})` : `rgb(${no})`;
        return (
            <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
                style={{
                    background: on ? `rgba(${yes},0.13)` : `rgba(${no},0.11)`,
                    border: `1px solid ${on ? `rgba(${yes},0.35)` : `rgba(${no},0.3)`}`,
                }}>
                <span className="shrink-0" style={{color: col}}>{icon}</span>
                <span className="flex-1 text-[13px] font-medium" style={{color: col}}>{label}</span>
                <span className="shrink-0" style={{color: col}}>{on ? <IconCheck /> : <IconCross />}</span>
            </div>
        );
    };

    // Numeric stat box (context / output)
    const Stat = ({label, value, sub}: {label: string; value: string; sub: string}) => (
        <div className="flex flex-col gap-0.5 px-3.5 py-2.5 rounded-xl"
            style={{background: `rgba(${accent},0.07)`, border: `1px solid rgba(${accent},0.16)`}}>
            <span className="text-[10px] tracking-[0.2em]" style={{color: `rgba(${accent},0.55)`}}>{label}</span>
            <div className="flex items-baseline gap-1">
                <span className="text-[18px] font-bold leading-none" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{value}</span>
                <span className="text-[10px]" style={{color: `rgba(${accent},0.45)`}}>{sub}</span>
            </div>
        </div>
    );

    return (
        <div className="rounded-2xl p-3 space-y-2.5"
            style={{background: `rgba(${accent},0.035)`, border: `1px solid rgba(${accent},0.12)`}}>
            <div className="grid grid-cols-2 gap-2">
                <Cap on={caps.supportsTools} label={s.mdCapTools} icon={<IconTerminal />} />
                <Cap on={caps.supportsVision} label={s.mdCapVision} icon={<IconEye />} />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <Stat label={s.mdCapContext} value={fmtTok(caps.contextWindow)} sub="token" />
                <Stat label={s.mdCapMaxOutput} value={fmtTok(caps.maxOutputTokens)} sub="token" />
            </div>
            {(caps.reasoning || !caps.supportsTemperature) && (
                <div className="flex flex-wrap gap-2 pt-0.5">
                    {caps.reasoning && (
                        <span className="text-[11px] px-3 py-1.5 rounded-full font-semibold inline-flex items-center gap-1.5"
                            style={{color: `rgb(${purp})`, background: `rgba(${purp},0.12)`, border: `1px solid rgba(${purp},0.3)`}}>
                            <IconDiamond /> {s.mdCapReasoning}
                        </span>
                    )}
                    {!caps.supportsTemperature && (
                        <span className="text-[11px] px-3 py-1.5 rounded-full font-medium inline-flex items-center gap-1.5"
                            style={{color: `rgba(${no},0.8)`, background: `rgba(${no},0.07)`, border: `1px solid rgba(${no},0.22)`}}>
                            <IconCross /> {s.mdCapNoTemp}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
