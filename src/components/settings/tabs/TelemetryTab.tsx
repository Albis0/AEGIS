import {useState} from "react";
import type {AppSettings, TelemetryWidget} from "../../../electron.d";
import {SectionLabel, Hint, PlainField} from "../shared";
import type {SettingsStrings} from "../../../i18n";

const ALL_WIDGETS: TelemetryWidget[] = ["cpu","ram","disk","battery","network","gpu","fans","processes","system","activeWindow"];

function buildWidgetInfo(s: SettingsStrings): Record<TelemetryWidget, {label: string; sub: string; icon: string}> {
    return {
        cpu:          {label: s.telWidgetCpuLabel,          sub: s.telWidgetCpuSub,          icon: "▣"},
        ram:          {label: s.telWidgetRamLabel,          sub: s.telWidgetRamSub,          icon: "▤"},
        disk:         {label: s.telWidgetDiskLabel,         sub: s.telWidgetDiskSub,         icon: "◫"},
        battery:      {label: s.telWidgetBatteryLabel,      sub: s.telWidgetBatterySub,      icon: "▷"},
        network:      {label: s.telWidgetNetworkLabel,      sub: s.telWidgetNetworkSub,      icon: "◈"},
        gpu:          {label: s.telWidgetGpuLabel,          sub: s.telWidgetGpuSub,          icon: "◆"},
        fans:         {label: s.telWidgetFansLabel,         sub: s.telWidgetFansSub,         icon: "✦"},
        processes:    {label: s.telWidgetProcessesLabel,    sub: s.telWidgetProcessesSub,    icon: "▦"},
        system:       {label: s.telWidgetSystemLabel,       sub: s.telWidgetSystemSub,       icon: "◎"},
        activeWindow: {label: s.telWidgetActiveWindowLabel, sub: s.telWidgetActiveWindowSub, icon: "▭"},
    };
}

interface Props {
    settings: AppSettings;
    accent: string;
    ac: string;
    onApply: (patch: Partial<AppSettings>) => void;
    onWidgetsChange: (widgets: TelemetryWidget[]) => void;
    s: SettingsStrings;
}

export default function TelemetryTab({settings, accent, ac, onApply, onWidgetsChange, s}: Props) {
    const [exportDone, setExportDone] = useState(false);
    const active = settings.telemetryWidgets ?? [];
    const WIDGET_INFO = buildWidgetInfo(s);

    function toggle(id: TelemetryWidget) {
        const next = active.includes(id) ? active.filter((x) => x !== id) : [...active, id];
        onApply({telemetryWidgets: next});
        onWidgetsChange(next);
    }

    function selectAll() {
        onApply({telemetryWidgets: ALL_WIDGETS});
        onWidgetsChange(ALL_WIDGETS);
    }

    function clearAll() {
        onApply({telemetryWidgets: []});
        onWidgetsChange([]);
    }

    async function handleExport() {
        try {
            const tel = await (window as any).jarvis.telemetryGet?.();
            const blob = new Blob([JSON.stringify(tel ?? {}, null, 2)], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `aegis-telemetry-${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setExportDone(true);
            setTimeout(() => setExportDone(false), 2000);
        } catch {
            // silently skip if telemetryGet doesn't exist yet
        }
    }

    const notifyChannel = settings.telemetryNotifyChannel ?? "both";
    const tempUnit      = settings.tempUnit ?? "C";
    const historySec    = settings.telemetryHistorySec ?? 60;

    return (
        <div className="space-y-7">

            {/* Weather city */}
            <div>
                <SectionLabel label={s.telWeatherCity} accent={accent} />
                <p className="text-[11px] mb-3 leading-relaxed" style={{color: `rgba(${accent},0.38)`}}>
                    {s.telWeatherCityHint}
                </p>
                <PlainField
                    value={settings.weatherCity ?? ""}
                    placeholder={s.telWeatherCityPlaceholder}
                    onSave={(v) => onApply({weatherCity: v})}
                    accent={accent}
                />
            </div>

            {/* Widget toggles */}
            <div>
                <SectionLabel label={s.telWidgets} accent={accent} />
                <p className="text-[11px] mb-4 leading-relaxed" style={{color: `rgba(${accent},0.38)`}}>
                    {s.telWidgetsHint}
                </p>
                <div className="space-y-1.5">
                    {ALL_WIDGETS.map((id) => {
                        const info = WIDGET_INFO[id];
                        const on = active.includes(id);
                        return (
                            <button key={id} onClick={() => toggle(id)}
                                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-left transition-all"
                                style={{
                                    background: on ? `rgba(${accent},0.09)` : "transparent",
                                    border: `1px solid ${on ? `rgba(${accent},0.3)` : `rgba(${accent},0.07)`}`,
                                }}>
                                <span className="text-base w-5 text-center shrink-0 leading-none"
                                    style={{color: on ? ac : `rgba(${accent},0.25)`}}>{info.icon}</span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-[13px] font-medium"
                                        style={{color: on ? ac : `rgba(${accent},0.55)`}}>{info.label}</span>
                                    <span className="block text-[10px] mt-0.5"
                                        style={{color: `rgba(${accent},0.3)`}}>{info.sub}</span>
                                </span>
                                <span className="w-5 h-5 rounded-md border grid place-items-center shrink-0"
                                    style={{
                                        borderColor: on ? ac : `rgba(${accent},0.2)`,
                                        background: on ? `rgba(${accent},0.18)` : "transparent",
                                        color: ac,
                                    }}>
                                    {on && <span className="text-[10px] font-bold">✓</span>}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex gap-2 mt-3">
                    <button onClick={selectAll}
                        className="flex-1 py-2.5 rounded-xl text-[10px] tracking-widest border transition hover:brightness-125"
                        style={{borderColor: `rgba(${accent},0.2)`, color: `rgba(${accent},0.6)`}}>
                        {s.telSelectAll}
                    </button>
                    <button onClick={clearAll}
                        className="flex-1 py-2.5 rounded-xl text-[10px] tracking-widest border transition hover:brightness-125"
                        style={{borderColor: `rgba(${accent},0.2)`, color: `rgba(${accent},0.6)`}}>
                        {s.telClearAll}
                    </button>
                </div>
            </div>

            {/* Alert thresholds */}
            <div>
                <SectionLabel label={s.telThresholds} accent={accent} />
                <p className="text-[11px] mb-4 leading-relaxed" style={{color: `rgba(${accent},0.38)`}}>
                    {s.telThresholdsHint}
                </p>
                <div className="space-y-2">
                    {([
                        {key: "alertCpuPct"  as const, label: "CPU",              icon: "▣"},
                        {key: "alertRamPct"  as const, label: "RAM",              icon: "▤"},
                        {key: "alertGpuPct"  as const, label: "GPU",              icon: "◆"},
                        {key: "alertDiskPct" as const, label: s.telDiskSingular, icon: "◫"},
                    ]).map(({key, label, icon}) => {
                        const val = settings[key] ?? null;
                        const hasVal = val !== null;
                        return (
                            <div key={key}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl transition"
                                style={{
                                    background: hasVal ? `rgba(${accent},0.07)` : "transparent",
                                    border: `1px solid ${hasVal ? `rgba(${accent},0.25)` : `rgba(${accent},0.08)`}`,
                                }}>
                                <span className="text-base w-5 text-center shrink-0 leading-none"
                                    style={{color: hasVal ? ac : `rgba(${accent},0.25)`}}>{icon}</span>
                                <span className="text-[13px] font-medium w-10 shrink-0"
                                    style={{color: hasVal ? ac : `rgba(${accent},0.4)`}}>{label}</span>
                                <input
                                    type="number" min={1} max={100} placeholder="—"
                                    value={val ?? ""}
                                    onChange={(e) => {
                                        const v = e.target.value === "" ? null : Math.max(1, Math.min(100, parseInt(e.target.value)));
                                        onApply({[key]: v} as Partial<typeof settings>);
                                    }}
                                    className="w-16 bg-transparent outline-none text-center text-[13px] border-b tabular-nums"
                                    style={{color: ac, borderColor: `rgba(${accent},0.25)`}}
                                />
                                <span className="text-[11px] flex-1" style={{color: `rgba(${accent},0.3)`}}>{s.telPctAlertSuffix}</span>
                                {hasVal && (
                                    <button onClick={() => onApply({[key]: null} as Partial<typeof settings>)}
                                        className="text-[11px] opacity-30 hover:opacity-70 transition"
                                        style={{color: ac}}>✕</button>
                                )}
                            </div>
                        );
                    })}
                </div>
                <Hint accent={accent}>{s.telThresholdsHint2}</Hint>
            </div>

            {/* Notification channel */}
            <div>
                <SectionLabel label={s.telNotifyChannelTitle} accent={accent} />
                <p className="text-[11px] mb-3 leading-relaxed" style={{color: `rgba(${accent},0.38)`}}>
                    {s.telNotifyChannelHint}
                </p>
                <div className="flex gap-2">
                    {([
                        {id: "feed"  as const, label: s.telChannelFeed,  icon: "▤"},
                        {id: "toast" as const, label: s.telChannelToast, icon: "◻"},
                        {id: "both"  as const, label: s.telChannelBoth,  icon: "◈"},
                    ]).map(({id, label, icon}) => {
                        const sel = notifyChannel === id;
                        return (
                            <button key={id} onClick={() => onApply({telemetryNotifyChannel: id})}
                                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                                style={{
                                    background: sel ? `rgba(${accent},0.12)` : `rgba(${accent},0.02)`,
                                    border: `1px solid ${sel ? `rgba(${accent},0.35)` : `rgba(${accent},0.08)`}`,
                                    boxShadow: sel ? `inset 0 0 16px rgba(${accent},0.04)` : "none",
                                }}>
                                <span className="text-[16px]" style={{color: sel ? ac : `rgba(${accent},0.3)`}}>{icon}</span>
                                <span className="text-[10px] text-center leading-tight"
                                    style={{color: sel ? ac : `rgba(${accent},0.45)`}}>{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Temperature unit */}
            <div>
                <SectionLabel label={s.telTempUnitTitle} accent={accent} />
                <div className="flex gap-2">
                    {([
                        {id: "C" as const, label: s.telCelsius,    sub: "°C"},
                        {id: "F" as const, label: s.telFahrenheit, sub: "°F"},
                    ]).map(({id, label, sub}) => {
                        const sel = tempUnit === id;
                        return (
                            <button key={id} onClick={() => onApply({tempUnit: id})}
                                className="flex-1 flex items-center gap-3 px-5 py-3 rounded-xl transition-all"
                                style={{
                                    background: sel ? `rgba(${accent},0.12)` : `rgba(${accent},0.02)`,
                                    border: `1px solid ${sel ? `rgba(${accent},0.35)` : `rgba(${accent},0.08)`}`,
                                }}>
                                <span className="text-[22px] font-bold tabular-nums"
                                    style={{color: sel ? ac : `rgba(${accent},0.2)`, fontFamily: "Orbitron, sans-serif"}}>{sub}</span>
                                <span className="text-[12px]"
                                    style={{color: sel ? `rgba(${accent},0.8)` : `rgba(${accent},0.35)`}}>{label}</span>
                                {sel && <span className="ml-auto w-1.5 h-1.5 rounded-full"
                                    style={{background: ac, boxShadow: `0 0 6px ${ac}`}} />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* History duration */}
            <div>
                <SectionLabel label={s.telHistoryTitle} accent={accent} />
                <p className="text-[11px] mb-3 leading-relaxed" style={{color: `rgba(${accent},0.38)`}}>
                    {s.telHistoryHint}
                </p>
                <div className="flex gap-2 flex-wrap">
                    {([
                        {val: 10,  label: "10s"},
                        {val: 30,  label: "30s"},
                        {val: 60,  label: s.telHistory1m},
                        {val: 120, label: s.telHistory2m},
                        {val: 300, label: s.telHistory5m},
                    ]).map(({val, label}) => {
                        const sel = historySec === val;
                        return (
                            <button key={val} onClick={() => onApply({telemetryHistorySec: val})}
                                className="px-4 py-2 rounded-lg text-[11px] transition"
                                style={{
                                    background: sel ? `rgba(${accent},0.15)` : "transparent",
                                    border: `1px solid ${sel ? `rgba(${accent},0.4)` : `rgba(${accent},0.1)`}`,
                                    color: sel ? ac : `rgba(${accent},0.45)`,
                                }}>
                                {label}
                            </button>
                        );
                    })}
                </div>
                <Hint accent={accent}>{s.telHistoryFooterHint}</Hint>
            </div>

            {/* Update interval */}
            <div>
                <SectionLabel label={s.telUpdateSpeedTitle} accent={accent} />
                <div className="flex gap-2 flex-wrap">
                    {[500, 1000, 1500, 2000, 3000, 5000].map((ms) => {
                        const sel = (settings.telemetryUpdateMs ?? 1500) === ms;
                        return (
                            <button key={ms} onClick={() => onApply({telemetryUpdateMs: ms})}
                                className="px-3 py-2 rounded-lg text-[11px] transition"
                                style={{
                                    background: sel ? `rgba(${accent},0.15)` : "transparent",
                                    border: `1px solid ${sel ? `rgba(${accent},0.4)` : `rgba(${accent},0.1)`}`,
                                    color: sel ? ac : `rgba(${accent},0.45)`,
                                }}>
                                {ms < 1000 ? `${ms}ms` : `${ms/1000}s`}
                            </button>
                        );
                    })}
                </div>
                <Hint accent={accent}>{s.telUpdateSpeedHint}</Hint>
            </div>

            {/* JSON Export */}
            <div>
                <SectionLabel label={s.telExportTitle} accent={accent} />
                <p className="text-[11px] mb-3 leading-relaxed" style={{color: `rgba(${accent},0.38)`}}>
                    {s.telExportHint}
                </p>
                <button onClick={handleExport}
                    className="flex items-center gap-3 px-5 py-3 rounded-xl transition-all hover:brightness-125"
                    style={{
                        background: exportDone ? "rgba(74,222,128,0.08)" : `rgba(${accent},0.06)`,
                        border: `1px solid ${exportDone ? "rgba(74,222,128,0.3)" : `rgba(${accent},0.2)`}`,
                        color: exportDone ? "rgba(74,222,128,0.9)" : ac,
                    }}>
                    <span className="text-[14px]">{exportDone ? "✓" : "▤"}</span>
                    <span className="text-[12px] font-medium tracking-wide">
                        {exportDone ? s.telExportDone : s.telExportBtn}
                    </span>
                </button>
            </div>

        </div>
    );
}
