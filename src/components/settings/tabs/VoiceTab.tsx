import {useState, useEffect, useRef} from "react";
import type {AppSettings, AegisConfig} from "../../../electron.d";
import {SectionLabel, RadioCard, Hint, KeyField} from "../shared";
import type {SettingsStrings} from "../../../i18n";

const EDGE_VOICES = [
    {id: "tr-TR-EmelNeural",   label: "Emel",   meta: "TR · Kadın"},
    {id: "tr-TR-AhmetNeural",  label: "Ahmet",  meta: "TR · Erkek"},
    {id: "en-US-AriaNeural",   label: "Aria",   meta: "EN · Kadın"},
    {id: "en-US-GuyNeural",    label: "Guy",    meta: "EN · Erkek"},
    {id: "en-GB-SoniaNeural",  label: "Sonia",  meta: "EN-GB · Kadın"},
    {id: "de-DE-KatjaNeural",  label: "Katja",  meta: "DE · Kadın"},
    {id: "de-DE-ConradNeural", label: "Conrad", meta: "DE · Erkek"},
    {id: "fr-FR-DeniseNeural", label: "Denise", meta: "FR · Kadın"},
    {id: "fr-FR-HenriNeural",  label: "Henri",  meta: "FR · Erkek"},
    {id: "es-ES-ElviraNeural", label: "Elvira", meta: "ES · Kadın"},
    {id: "es-ES-AlvaroNeural", label: "Alvaro", meta: "ES · Erkek"},
];

const KOKORO_VOICES = [
    {id: "af_bella",   label: "Bella",   meta: "EN · Kadın"},
    {id: "af_sarah",   label: "Sarah",   meta: "EN · Kadın"},
    {id: "am_adam",    label: "Adam",    meta: "EN · Erkek"},
    {id: "am_michael", label: "Michael", meta: "EN · Erkek"},
    {id: "bf_emma",    label: "Emma",    meta: "EN-GB · Kadın"},
    {id: "bm_george",  label: "George",  meta: "EN-GB · Erkek"},
];

const EL_VOICES = [
    {id: "el:cgSgspJ2msm6clMCkdW9", label: "Jessica",   meta: "EN · Kadın · varsayılan"},
    {id: "el:9BWtsMINqrJLrRacOk9x", label: "Aria",      meta: "EN · Kadın · doğal"},
    {id: "el:XB0fDUnXU5powFXDhCwa", label: "Charlotte", meta: "EN-GB · Kadın · yumuşak"},
    {id: "el:Xb7hH8MSUJpSbSDYk0k2", label: "Alice",     meta: "EN-GB · Kadın · profesyonel"},
    {id: "el:TX3LPaxmHKxFdv7VOQHJ", label: "Liam",      meta: "EN · Erkek · anlatıcı"},
    {id: "el:nPczCjzI2devNBz1zQrb", label: "Brian",     meta: "EN · Erkek · derin"},
    {id: "el:IKne3meq5aSn9XLyUdCD", label: "Charlie",   meta: "EN-AU · Erkek · rahat"},
    {id: "el:onwK4e9ZLuTAKqWW03F9", label: "Daniel",    meta: "EN-GB · Erkek · haberci"},
    {id: "el:21m00Tcm4TlvDq8ikWAM", label: "Rachel",    meta: "EN · Kadın · klasik"},
    {id: "el:pNInz6obpgDQGcFmaJgB", label: "Adam",      meta: "EN · Erkek · klasik"},
];

const LANGUAGES = [
    {id: "tr", flag: "🇹🇷", label: "Türkçe"},
    {id: "en", flag: "🇬🇧", label: "English"},
    {id: "de", flag: "🇩🇪", label: "Deutsch"},
    {id: "fr", flag: "🇫🇷", label: "Français"},
    {id: "es", flag: "🇪🇸", label: "Español"},
] as const;

interface Props {
    settings: AppSettings;
    config: AegisConfig;
    accent: string;
    ac: string;
    onApply: (patch: Partial<AppSettings>) => void;
    onApplyConfig: (patch: Partial<AegisConfig>) => void;
    s: SettingsStrings;
}

type KokoroPhase = "idle" | "pkg" | "model" | "ready" | "error";
interface KokoroProgress { phase: KokoroPhase; percent: number; label: string; }

export default function VoiceTab({settings, config, accent, ac, onApply, onApplyConfig, s}: Props) {
    const [testing, setTesting] = useState(false);
    const [kokoroInstalled, setKokoroInstalled] = useState<boolean | null>(null);
    const [kokoroProg, setKokoroProg] = useState<KokoroProgress>({phase: "idle", percent: 0, label: ""});
    const [kokoroRemoving, setKokoroRemoving] = useState(false);
    const unsubRef = useRef<(() => void) | null>(null);

    useEffect(() => { window.jarvis.ttsKokoroInstalled().then(setKokoroInstalled).catch(() => setKokoroInstalled(false)); }, []);

    async function removeKokoro() {
        if (kokoroRemoving) return;
        setKokoroRemoving(true);
        try {
            await window.jarvis.kokoroUninstall();
            setKokoroInstalled(false);
            setKokoroProg({phase: "idle", percent: 0, label: ""});
        } catch {}
        finally { setKokoroRemoving(false); }
    }

    function startKokoroInstall() {
        if (kokoroProg.phase !== "idle" && kokoroProg.phase !== "error") return;
        setKokoroProg({phase: "pkg", percent: 0, label: "Paket kuruluyor…"});
        unsubRef.current?.();
        unsubRef.current = window.jarvis.on("kokoro-install-progress", (p: any) => {
            if (p.phase === "ready") {
                setKokoroProg({phase: "ready", percent: 100, label: "Hazır!"});
                setKokoroInstalled(true);
                unsubRef.current?.();
            } else if (p.phase === "error") {
                setKokoroProg({phase: "error", percent: 0, label: p.label ?? "Hata"});
                unsubRef.current?.();
            } else if (p.phase === "pkg") {
                setKokoroProg({phase: "pkg", percent: p.percent ?? 0, label: p.label ?? "Paket kuruluyor…"});
            } else if (p.phase === "model") {
                const pct = p.percent ?? 0;
                const file = (p.file as string ?? "").split("/").pop() ?? "";
                setKokoroProg({phase: "model", percent: pct, label: file});
            }
        });
        window.jarvis.kokoroInstall().catch((e: unknown) => {
            setKokoroProg({phase: "error", percent: 0, label: String(e)});
        });
    }

    const voices = settings.ttsProvider === "elevenlabs" ? EL_VOICES
                 : settings.ttsProvider === "kokoro"     ? KOKORO_VOICES
                 : EDGE_VOICES;

    async function testVoice() {
        if (testing) return;
        setTesting(true);
        try {
            const res = await window.jarvis.tts("Merhaba, ben AEGIS. Sesinizi duyuyorum.");
            if (res.error || !res.buffer) return;
            const ctx = new AudioContext();
            const raw = res.buffer as unknown as {data?: number[]};
            const bytes = raw.data ? new Uint8Array(raw.data) : new Uint8Array(res.buffer as unknown as ArrayBuffer);
            const arrayBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            const decoded = await ctx.decodeAudioData(arrayBuf);
            const src = ctx.createBufferSource();
            src.buffer = decoded;
            src.connect(ctx.destination);
            src.start();
            src.onended = () => ctx.close();
        } catch {}
        finally { setTesting(false); }
    }

    return (
        <div className="space-y-7">

            {/* Language */}
            <div>
                <SectionLabel label={s.voLang} accent={accent} />
                <div className="grid grid-cols-5 gap-1.5">
                    {LANGUAGES.map((l) => {
                        const active = (settings.language ?? "tr") === l.id;
                        return (
                            <RadioCard key={l.id} active={active} accent={accent}
                                onClick={() => onApply({language: l.id})}
                                className="flex flex-col items-center gap-1 px-2 py-3">
                                <span className="text-xl leading-none">{l.flag}</span>
                                <span className="text-[11px] font-medium mt-1 leading-tight"
                                    style={{color: active ? ac : `rgba(${accent},0.45)`}}>{l.label}</span>
                            </RadioCard>
                        );
                    })}
                </div>
                <Hint accent={accent}>{s.voLangHint}</Hint>
            </div>

            {/* TTS engine */}
            <div>
                <SectionLabel label={s.voEngine} accent={accent} />
                <div className="grid grid-cols-3 gap-2">
                    {[
                        {id: "edge",       icon: "◎", label: "Edge TTS",   sub: s.voEdgeSub},
                        {id: "elevenlabs", icon: "♬", label: "ElevenLabs", sub: s.voElSub},
                        {id: "kokoro",     icon: "◈", label: "Kokoro",     sub: s.voKokoroSub},
                    ].map((p) => {
                        const active = settings.ttsProvider === p.id;
                        return (
                            <RadioCard key={p.id} active={active} accent={accent}
                                onClick={() => {
                                    const dv = p.id === "elevenlabs" ? "el:cgSgspJ2msm6clMCkdW9"
                                             : p.id === "kokoro"     ? "af_bella"
                                             : "tr-TR-EmelNeural";
                                    onApply({ttsProvider: p.id as "edge" | "elevenlabs" | "kokoro", ttsVoice: dv});
                                }}
                                className="flex flex-col gap-0.5 px-4 py-3.5">
                                <span className="text-2xl leading-none" style={{color: active ? ac : `rgba(${accent},0.3)`}}>{p.icon}</span>
                                <span className="text-[13px] font-semibold mt-2"
                                    style={{color: active ? ac : `rgba(${accent},0.6)`}}>{p.label}</span>
                                <span className="text-[11px] mt-0.5" style={{color: `rgba(${accent},0.35)`}}>{p.sub}</span>
                            </RadioCard>
                        );
                    })}
                </div>
            </div>

            {/* Kokoro kurulu — bilgi + sil */}
            {settings.ttsProvider === "kokoro" && kokoroInstalled === true && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                    style={{borderColor: `rgba(${accent},0.2)`, background: `rgba(${accent},0.04)`}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round" style={{color: ac, flexShrink: 0}}>
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span className="flex-1 text-[11px]" style={{color: `rgba(${accent},0.7)`}}>Kokoro kurulu — model dosyaları önbellekte.</span>
                    <button
                        onClick={removeKokoro}
                        disabled={kokoroRemoving}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] tracking-[0.12em] transition hover:brightness-125 disabled:opacity-40 shrink-0"
                        style={{color: "rgba(239,68,68,0.85)", borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)"}}>
                        {kokoroRemoving ? "SİLİNİYOR…" : (
                            <>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                                SİL
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Kokoro kurulu değil — indirme paneli */}
            {settings.ttsProvider === "kokoro" && kokoroInstalled === false && (
                <div className="rounded-xl border overflow-hidden"
                    style={{borderColor: `rgba(${accent},0.25)`, background: `rgba(${accent},0.05)`}}>

                    {/* Başlık satırı */}
                    <div className="flex items-center gap-3 px-4 py-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span className="flex-1 text-[11px]" style={{color: `rgba(${accent},0.7)`}}>
                            {s.voKokoroMissing}
                        </span>
                        {(kokoroProg.phase === "idle" || kokoroProg.phase === "error") && (
                            <button
                                onClick={startKokoroInstall}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] tracking-[0.15em] font-medium transition hover:brightness-125 shrink-0"
                                style={{color: ac, borderColor: `rgba(${accent},0.4)`, background: `rgba(${accent},0.1)`}}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                {s.voKokoroInstall}
                            </button>
                        )}
                        {kokoroProg.phase === "ready" && (
                            <span className="text-[10px] tracking-widest px-2 py-1 rounded" style={{color: ac, background: `rgba(${accent},0.15)`}}>
                                {s.voKokoroReady}
                            </span>
                        )}
                    </div>

                    {/* Progress bar — kurulum/indirme sırasında */}
                    {(kokoroProg.phase === "pkg" || kokoroProg.phase === "model") && (
                        <div className="px-4 pb-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] truncate max-w-[240px]" style={{color: `rgba(${accent},0.5)`}}>
                                    {kokoroProg.phase === "pkg" ? "Paket kuruluyor…" : kokoroProg.label}
                                </span>
                                <span className="text-[10px] tabular-nums ml-2 shrink-0" style={{color: `rgba(${accent},0.5)`}}>
                                    {kokoroProg.phase === "pkg" ? "" : `${kokoroProg.percent}%`}
                                </span>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{background: `rgba(${accent},0.1)`}}>
                                {kokoroProg.phase === "pkg" ? (
                                    <div className="h-full rounded-full animate-pulse" style={{width: "100%", background: `rgba(${accent},0.4)`}} />
                                ) : (
                                    <div className="h-full rounded-full transition-all duration-300"
                                        style={{width: `${kokoroProg.percent}%`, background: ac}} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Hata mesajı */}
                    {kokoroProg.phase === "error" && (
                        <div className="px-4 pb-3 text-[10px]" style={{color: "rgba(239,68,68,0.8)"}}>
                            {kokoroProg.label}
                        </div>
                    )}
                </div>
            )}

            {/* ElevenLabs key */}
            {settings.ttsProvider === "elevenlabs" && (
                <div>
                    <SectionLabel label={s.voElKey} accent={accent} />
                    <KeyField value={config?.elevenlabsApiKey ?? ""} placeholder="sk_..."
                        onSave={(v) => onApplyConfig({elevenlabsApiKey: v || undefined})} accent={accent} />
                </div>
            )}

            {/* Voice picker */}
            <div>
                <SectionLabel label={s.voVoice} accent={accent} />
                <div className="grid grid-cols-2 gap-1.5">
                    {voices.map((v) => {
                        const active = settings.ttsVoice === v.id;
                        return (
                            <RadioCard key={v.id} active={active} accent={accent}
                                onClick={() => onApply({ttsVoice: v.id})}
                                className="flex flex-col gap-0.5 px-3.5 py-3">
                                <span className="text-[14px] font-semibold"
                                    style={{color: active ? ac : `rgba(${accent},0.65)`}}>{v.label}</span>
                                <span className="text-[10px] mt-0.5" style={{color: `rgba(${accent},0.35)`}}>{v.meta}</span>
                            </RadioCard>
                        );
                    })}
                </div>
            </div>

            {/* Speed */}
            <div>
                <SectionLabel label={s.voSpeed} accent={accent} />
                <div className="flex items-center gap-4 px-1">
                    <span className="text-[11px] opacity-35 w-8 shrink-0" style={{color: ac}}>0.5×</span>
                    <input type="range" min={0.5} max={2.0} step={0.1}
                        value={settings.ttsRate}
                        onChange={(e) => onApply({ttsRate: parseFloat(e.target.value)})}
                        className="flex-1" style={{accentColor: ac}} />
                    <span className="text-[11px] opacity-35 w-8 text-right shrink-0" style={{color: ac}}>2.0×</span>
                    <span className="text-[14px] w-12 text-right tabular-nums font-medium shrink-0"
                        style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{settings.ttsRate.toFixed(1)}×</span>
                </div>
            </div>

            {/* Test */}
            <div>
                <SectionLabel label={s.voTest} accent={accent} />
                <button onClick={testVoice} disabled={testing}
                    className="flex items-center gap-3 px-5 py-3 rounded-xl border text-[11px] tracking-[0.2em] font-medium transition hover:brightness-125 disabled:opacity-40"
                    style={{color: ac, borderColor: `rgba(${accent},0.3)`, background: `rgba(${accent},0.07)`}}>
                    {testing
                        ? <><span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{background: ac}} />{s.voTestPlaying}</>
                        : <>▶ MERHABA, BEN AEGIS</>}
                </button>
                <Hint accent={accent}>{settings.ttsProvider === "elevenlabs" ? "ElevenLabs" : settings.ttsProvider === "kokoro" ? "Kokoro" : "Edge TTS"}{s.voTestHint}</Hint>
            </div>
        </div>
    );
}
