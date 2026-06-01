import React, {type ReactNode, useState, useEffect} from "react";
import type {CoreState} from "../ArcReactor";
import type {Telemetry, Weather, TelemetryWidget} from "../../electron.d";
import type {VoiceMode} from "../../hooks/useVoice";
import ArcReactor from "../ArcReactor";
import VoiceModeToggle from "../VoiceModeToggle";
import FeedItem from "../FeedItem";
import type {FeedItemType} from "../FeedItem";

type ToolLine = {name: string; status: "running" | "done"; detail?: string};
type Attachment = {name: string; url: string; mime: string; data: string};
type FeedItemLocal = {id: string; kind: "user"; text: string; attachments?: Attachment[]} | {id: string; kind: "assistant"; text: string; tools: ToolLine[]};

const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h >= 24) return `${Math.floor(h / 24)}g ${h % 24}s`;
    return `${h}s ${m}d`;
};
const fmtRate = (bps?: number) => {
    if (bps == null) return "0 B/s";
    if (bps > 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`;
    if (bps > 1024) return `${Math.round(bps / 1024)} KB/s`;
    return `${bps} B/s`;
};
const fmtMHz = (mhz: number | null | undefined) => {
    if (!mhz) return null;
    return mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : `${mhz} MHz`;
};

export interface SkinProps {
    feed: FeedItemLocal[];
    input: string;
    setInput: (v: string) => void;
    attachments: Attachment[];
    setAttachments: (v: Attachment[]) => void;
    state: CoreState;
    streaming: boolean;
    tel: Telemetry | null;
    weather: Weather | null;
    mode: VoiceMode;
    setMode: (m: VoiceMode) => void;
    listening: boolean;
    activated: boolean;
    capturing: boolean;
    placeholder: string;
    onSend: () => void;
    onStop: () => void;
    onSettingsOpen: () => void;
    onHistoryOpen?: () => void;
    feedRef: React.RefObject<HTMLDivElement>;
    layout: "normal" | "compact";
    telemetryWidgets?: TelemetryWidget[];
}

const ALL_WIDGETS: TelemetryWidget[] = ["cpu", "ram", "disk", "battery", "network", "gpu", "fans", "processes", "system", "activeWindow"];

export default function HologramSkin({
    feed, input, setInput, attachments, setAttachments, state, streaming, tel, weather,
    mode, setMode, listening, activated, capturing, placeholder,
    onSend, onStop, onSettingsOpen, onHistoryOpen, feedRef, layout,
    telemetryWidgets,
}: SkinProps) {
    const compact = layout === "compact";
    const active = (s: CoreState) => s !== "idle";
    const widgets = telemetryWidgets ?? ALL_WIDGETS;
    const show = (w: TelemetryWidget) => widgets.includes(w);

    // Clock lives here — ticking every second must not bust the parent memo
    const [clock, setClock] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className={`hud backdrop state-${state} relative h-screen w-screen overflow-hidden flex flex-col${compact ? " compact" : ""}`}>
            <div className="absolute inset-0 grid-overlay pointer-events-none" />

            {/* Title bar */}
            <div className="drag shrink-0 flex items-center justify-between z-30" style={{height: "var(--title-h)", paddingLeft: "var(--pad-x)", paddingRight: "var(--pad-x)"}}>
                <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full glow-text flick" style={{background: "rgb(var(--hud))", boxShadow: "0 0 8px rgb(var(--hud))"}} />
                    <span className="text-[11px] tracking-[0.45em] glow-text" style={{fontFamily: "Orbitron, sans-serif"}}>
                        J.A.R.V.I.S.
                    </span>
                </div>
                <div className="no-drag flex gap-1">
                    {onHistoryOpen && (
                        <button onClick={onHistoryOpen} title="Konuşma geçmişi" className="w-8 h-8 grid place-items-center opacity-50 hover:opacity-100 transition text-xs" style={{color: "rgb(var(--hud))"}}>◷</button>
                    )}
                    <button onClick={onSettingsOpen} title="Ayarlar" className="w-8 h-8 grid place-items-center opacity-50 hover:opacity-100 transition text-sm" style={{color: "rgb(var(--hud))"}}>⚙</button>
                    <button onClick={() => window.jarvis.minimize()} title="Küçült" className="w-8 h-8 grid place-items-center opacity-50 hover:opacity-100 transition" style={{color: "rgb(var(--hud))"}}>─</button>
                    <button onClick={() => window.jarvis.maximize()} title="Büyüt" className="w-8 h-8 grid place-items-center opacity-50 hover:opacity-100 transition text-xs" style={{color: "rgb(var(--hud))"}}>▢</button>
                    <button onClick={() => window.jarvis.fullscreen()} title="Tam ekran (F11)" className="w-8 h-8 grid place-items-center opacity-50 hover:opacity-100 transition text-xs" style={{color: "rgb(var(--hud))"}}>⛶</button>
                    <button onClick={() => window.jarvis.close()} title="Kapat" className="w-8 h-8 grid place-items-center opacity-50 hover:opacity-100 hover:text-red-400 transition" style={{color: "rgb(var(--hud))"}}>✕</button>
                </div>
            </div>

            {/* Main */}
            <div className="flex-1 flex min-h-0 z-10 pb-2" style={{gap: "var(--gap)", paddingLeft: "var(--pad-x)", paddingRight: "var(--pad-x)"}}>
                {/* LEFT */}
                <div className="shrink-0 w-[clamp(190px,17vw,230px)] flex flex-col overflow-y-auto hud" style={{gap: "var(--gap)", paddingTop: "var(--pad-y)", color: "rgb(var(--hud))"}}>
                    <Section title="TIME">
                        <div className="text-3xl tabular-nums glow-text leading-none" style={{fontFamily: "Orbitron, sans-serif"}}>
                            {clock.toLocaleTimeString("tr-TR", {hour: "2-digit", minute: "2-digit"})}
                            <span className="text-base opacity-60">:{clock.toLocaleTimeString("tr-TR", {second: "2-digit"}).slice(-2)}</span>
                        </div>
                        <div className="text-[11px] tracking-[0.2em] mt-1.5 glow-text">{clock.toLocaleDateString("tr-TR", {day: "2-digit", month: "short", year: "numeric"}).toUpperCase()}</div>
                        <div className="text-[10px] tracking-widest opacity-60">{clock.toLocaleDateString("tr-TR", {weekday: "long"}).toUpperCase()}</div>
                    </Section>

                    <Section title={weather?.city ? `HAVA · ${weather.city.toUpperCase()}` : "HAVA DURUMU"}>
                        {weather && !weather.error ?
                            <>
                                <div className="text-3xl glow-text" style={{fontFamily: "Orbitron, sans-serif"}}>{weather.temp}°C</div>
                                <ul className="text-[11px] mt-1.5 space-y-0.5 opacity-80">
                                    <li>• {weather.desc}</li>
                                    <li>• hissedilen {weather.feels}°</li>
                                    <li>• nem %{weather.humidity}</li>
                                </ul>
                            </>
                        :   <div className="text-[11px] opacity-50">{weather?.error ? "bağlanılamadı" : "yükleniyor…"}</div>}
                    </Section>

                    <Section title="SİSTEM DURUMU">
                        <div className="text-[9px] tracking-widest opacity-60 mb-1.5">
                            UPTIME · {tel ? fmtUptime(tel.uptime) : "—"}
                        </div>
                        <div className="space-y-1.5 text-[10px] tracking-widest">
                            {show("cpu") && (
                                <CpuRow
                                    cpu={tel?.cpu ?? 0}
                                    temp={tel?.cpuTemp ?? null}
                                    freq={tel?.cpuFreqMHz ?? null}
                                    model={tel?.cpuModel ?? ""}
                                    cores={tel?.cpuCores ?? []}
                                    coreCount={tel?.cpuCoreCount ?? 0}
                                />
                            )}
                            {show("ram") && (
                                <RamRow
                                    pct={tel?.ram ?? 0}
                                    usedMB={tel?.ramUsedMB ?? 0}
                                    totalMB={tel?.ramTotalMB ?? 0}
                                    freeMB={tel?.ramFreeMB ?? 0}
                                />
                            )}
                            {show("disk") && (tel?.disks ?? []).length > 0 && (
                                <DiskRows disks={tel!.disks} />
                            )}
                            {show("battery") && tel?.battery != null && (
                                <TelRow
                                    label="BAT"
                                    value={`${tel.battery}%${tel.batteryCharging ? " ⚡" : ""}`}
                                    bar={tel.battery}
                                    warn={20}
                                    danger={10}
                                    invertColor
                                />
                            )}
                        </div>
                        {show("gpu") && (tel?.gpu ?? []).length > 0 && (
                            <div className="mt-2 space-y-1.5 text-[10px] tracking-widest">
                                {(tel?.gpu ?? []).map((g, i) => <GpuRow key={i} gpu={g} />)}
                            </div>
                        )}
                        {show("fans") && (tel?.fanSpeeds ?? []).length > 0 && (
                            <div className="pt-1 text-[9px] opacity-60 space-y-0.5">
                                {tel!.fanSpeeds.map((rpm, i) => (
                                    <div key={i} className="flex justify-between">
                                        <span>FAN {i + 1}</span>
                                        <span className="tabular-nums">{rpm} RPM</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {show("network") && (
                            <div className="pt-2 space-y-0.5">
                                <div className="flex justify-between gap-2 text-[10px] opacity-70">
                                    <span>▲ {fmtRate(tel?.netUp)}</span>
                                    <span>▼ {fmtRate(tel?.netDown)}</span>
                                </div>
                                {(tel?.netAdapters ?? []).filter((a) => a.up > 0 || a.down > 0).slice(0, 2).map((a, i) => (
                                    <div key={i} className="text-[8px] opacity-40 truncate" title={a.name}>{a.name}</div>
                                ))}
                            </div>
                        )}
                        {show("activeWindow") && tel?.activeWindow && (
                            <div className="pt-1 text-[9px] opacity-50 truncate" title={tel.activeWindow}>◈ {tel.activeWindow}</div>
                        )}
                        {show("system") && (
                            <div className="pt-1 space-y-0.5 text-[9px] opacity-50">
                                <div className="truncate" title={tel?.host}>HOST · {tel?.host ?? "—"}</div>
                                {tel?.sysModel && <div className="truncate" title={tel.sysModel}>{tel.sysModel}</div>}
                            </div>
                        )}
                    </Section>

                    {show("processes") && (tel?.topProcs ?? []).length > 0 && (
                        <Section title="TOP PROCESS">
                            <div className="space-y-1 text-[9px] tracking-widest">
                                {(tel?.topProcs ?? []).map((p, i) => (
                                    <div key={i} className="flex justify-between gap-1 opacity-80">
                                        <span className="truncate flex-1" title={`${p.name} [${p.pid}]`}>{p.name}</span>
                                        <span className="tabular-nums opacity-60 shrink-0">{p.ram}MB</span>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
                </div>

                {/* CENTER */}
                <div className="flex-1 min-w-0 grid place-items-center relative">
                    <div className="aspect-square h-full max-h-[72vh] max-w-full">
                        <ArcReactor state={state} capturing={capturing} />
                    </div>
                </div>

                {/* RIGHT — conversation */}
                <div
                    className="shrink-0 w-[clamp(260px,28vw,400px)] flex flex-col rounded-lg border overflow-hidden"
                    style={{borderColor: "rgba(var(--hud),0.2)", background: "rgba(var(--hud),0.02)"}}
                >
                    <div className="flex items-center justify-between px-3 py-2 border-b text-[10px] tracking-[0.25em]" style={{borderColor: "rgba(var(--hud),0.15)", color: "rgb(var(--hud))"}}>
                        <span className="glow-text">KONUŞMA</span>
                        <span className="opacity-70" style={{color: state === "error" ? "rgb(var(--status-danger))" : "rgb(var(--hud))"}}>
                            {state.toUpperCase()}
                        </span>
                    </div>
                    <div ref={feedRef} className="flex-1 min-h-0 overflow-y-auto space-y-3" style={{padding: "var(--feed-p)"}}>
                        {feed.length === 0 && (
                            <div className="text-[12px] opacity-50 space-y-1 hud" style={{color: "rgb(var(--hud))"}}>
                                <div>SYS: JARVIS çevrimiçi.</div>
                                <div>SYS: Sistemler nominal.</div>
                                <div>SYS: Emrinizi bekliyorum, efendim…</div>
                            </div>
                        )}
                        {feed.map((item) => (
                            <FeedItem
                                key={item.id}
                                item={item as FeedItemType}
                                streaming={streaming}
                                isLast={item.id === feed[feed.length - 1]?.id}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Control bar */}
            <div className="shrink-0 flex items-center justify-center gap-6 pb-1 z-20 text-[11px] tracking-[0.2em]">
                <span className="flex items-center gap-1.5" style={{color: active(state) ? "rgb(var(--status-ok))" : "rgb(var(--status-ok) / 0.5)"}}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{background: "rgb(var(--status-ok))", boxShadow: "0 0 6px rgb(var(--status-ok))"}} /> CANLI
                </span>
                <span className="opacity-40">·</span>
                <span style={{color: "rgb(var(--hud))"}}>
                    {state === "thinking" ? "İŞLENİYOR" : state === "speaking" ? "YANIT VERİYOR" : state === "listening" ? "DİNLİYOR" : state === "error" ? "HATA" : "HAZIR"}
                </span>
                <span className="opacity-40">·</span>
                <VoiceModeToggle mode={mode} listening={listening} activated={activated} onToggle={() => {
                    const next: VoiceMode = mode === "off" ? "always-on" : mode === "always-on" ? "wake-word" : "off";
                    setMode(next);
                }} />
                <span className="opacity-40">·</span>
                <button onClick={() => window.jarvis.close()} className="flex items-center gap-1.5 hover:brightness-125 transition" style={{color: "rgb(var(--status-danger))"}}>⏻ KAPAT</button>
            </div>

            {/* Input */}
            <div className="shrink-0 z-30" style={{paddingLeft: "var(--pad-x)", paddingRight: "var(--pad-x)", paddingBottom: "var(--gap)"}}>
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px]"
                                style={{background: "rgba(var(--hud),0.08)", border: "1px solid rgba(var(--hud),0.2)", color: "rgba(var(--hud-soft),0.9)"}}>
                                {att.mime.startsWith("image/")
                                    ? <img src={att.url} alt={att.name} className="w-8 h-8 object-cover rounded" />
                                    : <span style={{color: "rgba(var(--hud),0.7)"}}>📄</span>}
                                <span className="max-w-[100px] truncate">{att.name}</span>
                                <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                                    className="ml-1 hover:brightness-125" style={{color: "rgba(var(--hud),0.5)"}}>✕</button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex items-center gap-3 rounded-xl border transition-colors" style={{padding: "var(--feed-p) calc(var(--feed-p) * 2)", borderColor: "rgba(var(--hud),0.3)", background: "rgba(3,6,12,0.85)", boxShadow: "0 0 24px rgba(var(--hud),0.12)"}}>
                    <span className="text-sm" style={{color: "rgba(var(--hud),0.6)"}}>›</span>
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && onSend()}
                        placeholder={placeholder}
                        disabled={streaming}
                        autoFocus
                        className="flex-1 bg-transparent outline-none text-sm font-mono disabled:opacity-50"
                        style={{color: "rgb(var(--hud-soft))"}}
                    />
                    <label className="cursor-pointer hover:brightness-125 transition" title="Dosya ekle" style={{color: "rgba(var(--hud),0.5)"}}>
                        <span className="text-[14px]">⊕</span>
                        <input type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py" className="hidden"
                            onChange={(e) => {
                                const files = Array.from(e.target.files ?? []);
                                Promise.all(files.map((f) => new Promise<Attachment>((res) => {
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                        const result = reader.result as string;
                                        res({name: f.name, url: result, mime: f.type || "application/octet-stream", data: result.split(",")[1] ?? ""});
                                    };
                                    reader.readAsDataURL(f);
                                }))).then((atts) => setAttachments([...attachments, ...atts]));
                                e.target.value = "";
                            }}
                        />
                    </label>
                    {state === "speaking" && (
                        <button onClick={onStop} className="px-4 py-1.5 rounded-lg text-[11px] tracking-widest border transition hover:brightness-125 flick" style={{fontFamily: "Orbitron, sans-serif", color: "rgb(var(--status-danger))", borderColor: "rgb(var(--status-danger) / 0.4)", background: "rgb(var(--status-danger) / 0.08)"}}>
                            ⏹ DURDUR
                        </button>
                    )}
                    <button onClick={onSend} disabled={streaming || (!input.trim() && attachments.length === 0)} className="px-4 py-1.5 rounded-lg text-[11px] tracking-widest border disabled:opacity-30 transition hover:brightness-125" style={{fontFamily: "Orbitron, sans-serif", color: "rgb(var(--hud))", borderColor: "rgba(var(--hud),0.3)"}}>
                        GÖNDER
                    </button>
                </div>
            </div>
        </div>
    );
}

function Section({title, children}: {title: string; children: ReactNode}) {
    return (
        <div className="relative px-3 py-3 hud" style={{color: "rgb(var(--hud))"}}>
            <span className="absolute top-0 left-0 w-3 h-3 border-t border-l" style={{borderColor: "rgba(var(--hud),0.5)"}} />
            <span className="absolute top-0 right-0 w-3 h-3 border-t border-r" style={{borderColor: "rgba(var(--hud),0.5)"}} />
            <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l" style={{borderColor: "rgba(var(--hud),0.5)"}} />
            <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r" style={{borderColor: "rgba(var(--hud),0.5)"}} />
            <div className="text-[9px] tracking-[0.3em] opacity-60 mb-2 glow-text">{title}</div>
            {children}
        </div>
    );
}

const CpuRow = React.memo(function CpuRow({
    cpu, temp, freq, model, cores, coreCount,
}: {cpu: number; temp: number | null; freq: number | null; model: string; cores: number[]; coreCount: number}) {
    const [open, setOpen] = React.useState(false);
    const color = cpu >= 90 ? "248,80,80" : cpu >= 70 ? "245,150,40" : "var(--hud)";
    const fill = color === "var(--hud)" ? "rgb(var(--hud))" : `rgb(${color})`;
    return (
        <div>
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
                <span className="w-9">CPU</span>
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background: "rgba(var(--hud),0.15)"}}>
                    <div className="h-full rounded-full transition-[width] duration-700" style={{width: `${cpu}%`, background: fill, boxShadow: `0 0 4px ${fill}`}} />
                </div>
                <span className="tabular-nums w-12 text-right" style={{color: fill}}>{cpu}%</span>
                <span className="opacity-40 text-[9px]">{open ? "▴" : "▾"}</span>
            </div>
            {open && (
                <div className="mt-1.5 pl-2 space-y-1 text-[9px] opacity-80">
                    {model && <div className="opacity-50 truncate text-[8px]" title={model}>{model}</div>}
                    <div className="flex gap-2 flex-wrap">
                        {temp != null && (
                            <span style={{color: temp >= 90 ? "rgb(var(--status-danger))" : temp >= 75 ? "rgb(var(--status-warn))" : "rgb(var(--hud))"}}>
                                TEMP {temp}°C
                            </span>
                        )}
                        {freq != null && <span className="opacity-60">{fmtMHz(freq)}</span>}
                        <span className="opacity-50">CORES {coreCount || (cores.length || "—")}</span>
                    </div>
                    {cores.length > 0 && (
                        <div className="grid gap-0.5" style={{gridTemplateColumns: `repeat(${Math.min(cores.length, 8)}, 1fr)`}}>
                            {cores.map((c, i) => {
                                const cc = c >= 90 ? "248,80,80" : c >= 70 ? "245,150,40" : null;
                                return (
                                    <div key={i} className="flex flex-col items-center gap-0.5" title={`Core ${i}: ${c}%`}>
                                        <div className="w-full rounded-sm overflow-hidden" style={{height: "20px", background: "rgba(var(--hud),0.12)"}}>
                                            <div
                                                className="w-full rounded-sm transition-[height] duration-500"
                                                style={{
                                                    height: `${c}%`,
                                                    marginTop: `${100 - c}%`,
                                                    background: cc ? `rgb(${cc})` : "rgb(var(--hud))",
                                                    boxShadow: `0 0 3px ${cc ? `rgb(${cc})` : "rgb(var(--hud))"}`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-[7px] opacity-40">{i}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

const RamRow = React.memo(function RamRow({pct, usedMB, totalMB, freeMB}: {pct: number; usedMB: number; totalMB: number; freeMB: number}) {
    const [open, setOpen] = React.useState(false);
    const color = pct >= 90 ? "248,80,80" : pct >= 75 ? "245,150,40" : "var(--hud)";
    const fill = color === "var(--hud)" ? "rgb(var(--hud))" : `rgb(${color})`;
    const fmtGB = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
    return (
        <div>
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
                <span className="w-9">RAM</span>
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background: "rgba(var(--hud),0.15)"}}>
                    <div className="h-full rounded-full transition-[width] duration-700" style={{width: `${pct}%`, background: fill, boxShadow: `0 0 4px ${fill}`}} />
                </div>
                <span className="tabular-nums w-12 text-right" style={{color: fill}}>{pct}%</span>
                <span className="opacity-40 text-[9px]">{open ? "▴" : "▾"}</span>
            </div>
            {open && (
                <div className="mt-1 pl-2 space-y-0.5 text-[9px] opacity-70">
                    <div className="flex justify-between">
                        <span>KULLANILAN</span>
                        <span className="tabular-nums" style={{color: fill}}>{fmtGB(usedMB)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>BOŞ</span>
                        <span className="tabular-nums opacity-60">{fmtGB(freeMB)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>TOPLAM</span>
                        <span className="tabular-nums opacity-60">{fmtGB(totalMB)}</span>
                    </div>
                </div>
            )}
        </div>
    );
});

const DiskRows = React.memo(function DiskRows({disks}: {disks: {drive: string; usedPct: number; usedGB: number; totalGB: number}[]}) {
    return (
        <>
            {disks.map((d) => {
                const color = d.usedPct >= 90 ? "248,80,80" : d.usedPct >= 70 ? "245,150,40" : "var(--hud)";
                const fill = color === "var(--hud)" ? "rgb(var(--hud))" : `rgb(${color})`;
                return (
                    <div key={d.drive} className="flex items-center gap-2" title={`${d.usedGB} / ${d.totalGB} GB`}>
                        <span className="w-9 shrink-0">{d.drive}</span>
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background: "rgba(var(--hud),0.15)"}}>
                            <div className="h-full rounded-full transition-[width] duration-700" style={{width: `${d.usedPct}%`, background: fill, boxShadow: `0 0 4px ${fill}`}} />
                        </div>
                        <span className="tabular-nums text-right opacity-70 text-[9px]" style={{minWidth: "52px"}}>{d.usedGB}/{d.totalGB}G</span>
                    </div>
                );
            })}
        </>
    );
});

const GpuRow = React.memo(function GpuRow({gpu}: {gpu: {name: string; load: number; vramUsed: number; vramTotal: number; temp: number | null}}) {
    const [open, setOpen] = React.useState(false);
    const color = gpu.load >= 90 ? "248,80,80" : gpu.load >= 70 ? "245,150,40" : "var(--hud)";
    const fill = color === "var(--hud)" ? "rgb(var(--hud))" : `rgb(${color})`;
    const vramPct = gpu.vramTotal > 0 ? Math.round((gpu.vramUsed / gpu.vramTotal) * 100) : 0;
    return (
        <div className="space-y-1">
            <div className="text-[9px] opacity-50 truncate cursor-pointer select-none" title={gpu.name} onClick={() => setOpen((o) => !o)}>
                {gpu.name.toUpperCase()} {open ? "▴" : "▾"}
            </div>
            <div className="flex items-center gap-2">
                <span className="w-9">GPU</span>
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background: "rgba(var(--hud),0.15)"}}>
                    <div className="h-full rounded-full transition-[width] duration-700" style={{width: `${gpu.load}%`, background: fill, boxShadow: `0 0 4px ${fill}`}} />
                </div>
                <span className="tabular-nums w-12 text-right" style={{color: fill}}>{gpu.load}%</span>
            </div>
            {gpu.vramTotal > 0 && (
                <div className="flex items-center gap-2">
                    <span className="w-9">VRAM</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background: "rgba(var(--hud),0.15)"}}>
                        <div className="h-full rounded-full transition-[width] duration-700" style={{width: `${vramPct}%`, background: "rgb(var(--hud))", boxShadow: "0 0 6px rgb(var(--hud))"}} />
                    </div>
                    <span className="tabular-nums w-12 text-right opacity-80 text-[9px]">{gpu.vramUsed}/{gpu.vramTotal}M</span>
                </div>
            )}
            {open && gpu.temp != null && (
                <div className="text-[9px] opacity-60 pl-2">
                    TEMP · <span style={{color: gpu.temp >= 85 ? "rgb(var(--status-danger))" : gpu.temp >= 70 ? "rgb(var(--status-warn))" : "rgb(var(--hud))"}}>{gpu.temp}°C</span>
                </div>
            )}
        </div>
    );
});

const TelRow = React.memo(function TelRow({label, value, bar, danger, warn, invertColor}: {label: string; value: string; bar: number; danger?: number; warn?: number; invertColor?: boolean}) {
    let color: string;
    if (invertColor) {
        // battery: low is bad
        color = danger != null && bar <= danger ? "248,80,80" : warn != null && bar <= warn ? "245,150,40" : "var(--hud)";
    } else {
        color = danger != null && bar >= danger ? "248,80,80" : warn != null && bar >= warn ? "245,150,40" : "var(--hud)";
    }
    const fill = color === "var(--hud)" ? "rgb(var(--hud))" : `rgb(${color})`;
    return (
        <div className="flex items-center gap-2">
            <span className="w-9 shrink-0">{label}</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background: "rgba(var(--hud),0.15)"}}>
                <div className="h-full rounded-full transition-[width] duration-700" style={{width: `${bar}%`, background: fill, boxShadow: `0 0 6px ${fill}`}} />
            </div>
            <span className="tabular-nums w-14 text-right" style={{color: fill}}>{value}</span>
        </div>
    );
});

