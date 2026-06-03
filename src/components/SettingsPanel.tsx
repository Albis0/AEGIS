import {useCallback, useEffect, useState} from "react";
import type {AppSettings, AegisConfig, TelemetryWidget} from "../electron.d";
import ModelTab      from "./settings/tabs/ModelTab";
import VoiceTab      from "./settings/tabs/VoiceTab";
import AppearanceTab from "./settings/tabs/AppearanceTab";
import KeysTab       from "./settings/tabs/KeysTab";
import TelemetryTab  from "./settings/tabs/TelemetryTab";
import ShortcutsTab  from "./settings/tabs/ShortcutsTab";
import ToolsTab      from "./settings/tabs/ToolsTab";
import AccountTab    from "./settings/tabs/AccountTab";

type Tab = "account" | "model" | "voice" | "appearance" | "keys" | "telemetry" | "shortcuts" | "tools";

const NAV_ITEMS: {id: Tab; icon: string; label: string; sub: string}[] = [
    {id: "account",    icon: "◉",  label: "Hesap",      sub: "Mod, oturum & kota"},
    {id: "model",      icon: "◈",  label: "Model",      sub: "AI sağlayıcı & parametreler"},
    {id: "voice",      icon: "◎",  label: "Ses",        sub: "TTS motoru & dil"},
    {id: "appearance", icon: "▦",  label: "Görünüm",    sub: "Tema, skin, font"},
    {id: "keys",       icon: "◆",  label: "API Keys",   sub: "Servis anahtarları"},
    {id: "telemetry",  icon: "▣",  label: "Telemetri",  sub: "Widget & uyarılar"},
    {id: "shortcuts",  icon: "⌨",  label: "Kısayollar", sub: "Klavye kısayolları"},
    {id: "tools",      icon: "✦",  label: "Araçlar",    sub: "Mevcut tool listesi"},
];

interface Props {
    open: boolean;
    onClose: () => void;
    onAccentChange: (rgb: string) => void;
    onSkinChange: (skin: AppSettings["skin"]) => void;
    onFontChange: (font: AppSettings["font"]) => void;
    onLayoutChange: (layout: AppSettings["layout"]) => void;
    onCustomCssChange: (css: string) => void;
    onTelemetryWidgetsChange: (widgets: TelemetryWidget[]) => void;
}

export default function SettingsPanel({
    open, onClose, onAccentChange, onSkinChange, onFontChange,
    onLayoutChange, onCustomCssChange, onTelemetryWidgetsChange,
}: Props) {
    const [tab, setTab]         = useState<Tab>("model");
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [config, setConfig]   = useState<AegisConfig | null>(null);
    const [saved, setSaved]     = useState(false);

    useEffect(() => {
        if (open) {
            Promise.all([window.jarvis.settingsGet(), window.jarvis.configGet()])
                .then(([s, c]) => { setSettings(s); setConfig(c); });
            setSaved(false);
        }
    }, [open]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const applySettings = useCallback(async (patch: Partial<AppSettings>) => {
        const updated = await window.jarvis.settingsSet(patch);
        setSettings(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
    }, []);

    const applyConfig = useCallback(async (patch: Partial<AegisConfig>) => {
        await window.jarvis.configSet(patch);
        setConfig((c) => c ? {...c, ...patch} : c);
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
    }, []);

    if (!open || !settings || !config) return null;

    const a = settings.accentColor;
    const ac = `rgb(${a})`;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
            {/* Bulanık zemin AYRI katman — panel içeriğinin atası DEĞİL. backdrop-filter
               uygulanan elemanın içindeki yazı subpixel-AA'i kaybedip bulanıklaşır; bu yüzden
               blur'u sadece bu arka katmana koyuyoruz, metin net kalsın. */}
            <div className="absolute inset-0" onClick={onClose}
                style={{background: "rgba(2,4,10,0.88)", backdropFilter: "blur(12px) saturate(0.7)"}} />
            <div
                className="relative flex overflow-hidden"
                style={{
                    width: "min(900px, 94vw)",
                    height: "min(680px, 92vh)",
                    background: "rgba(4,8,18,0.98)",
                    border: `1px solid rgba(${a},0.15)`,
                    borderRadius: "20px",
                    boxShadow: `0 0 80px rgba(${a},0.08), 0 40px 120px rgba(0,0,0,0.6)`,
                }}
            >
                {/* ── Left sidebar ── */}
                <aside
                    className="shrink-0 flex flex-col py-5"
                    style={{
                        width: "200px",
                        borderRight: `1px solid rgba(${a},0.1)`,
                        background: `rgba(${a},0.02)`,
                    }}
                >
                    {/* Branding */}
                    <div className="px-5 mb-6">
                        <div className="text-[11px] tracking-[0.5em] font-semibold"
                            style={{fontFamily: "Orbitron, sans-serif", color: `rgba(${a},0.5)`}}>AEGIS</div>
                        <div className="text-[10px] mt-0.5" style={{color: `rgba(${a},0.28)`}}>yapılandırma</div>
                    </div>

                    {/* Nav items */}
                    <nav className="flex-1 space-y-0.5 px-2">
                        {NAV_ITEMS.map((item) => {
                            const active = tab === item.id;
                            return (
                                <button key={item.id} onClick={() => setTab(item.id)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group"
                                    style={{
                                        background: active ? `rgba(${a},0.12)` : "transparent",
                                        border: `1px solid ${active ? `rgba(${a},0.25)` : "transparent"}`,
                                    }}>
                                    <span className="text-base w-5 text-center leading-none shrink-0 transition-all"
                                        style={{
                                            color: active ? ac : `rgba(${a},0.3)`,
                                            filter: active ? `drop-shadow(0 0 4px ${ac})` : "none",
                                        }}>{item.icon}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[12px] font-medium truncate"
                                            style={{color: active ? ac : `rgba(${a},0.55)`}}>{item.label}</span>
                                    </span>
                                    {active && (
                                        <span className="w-1 h-1 rounded-full shrink-0"
                                            style={{background: ac, boxShadow: `0 0 5px ${ac}`}} />
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Save indicator + close */}
                    <div className="px-3 pt-4 space-y-2" style={{borderTop: `1px solid rgba(${a},0.08)`}}>
                        {saved && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                style={{background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)"}}>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-[10px] tracking-widest font-medium" style={{color: "rgba(74,222,128,0.9)"}}>KAYDEDİLDİ</span>
                            </div>
                        )}
                        <button onClick={onClose}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition hover:brightness-125"
                            style={{color: `rgba(${a},0.4)`, border: `1px solid rgba(${a},0.1)`}}>
                            <span className="text-[11px]">✕</span>
                            <span className="text-[11px] tracking-widest">KAPAT</span>
                            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded"
                                style={{color: `rgba(${a},0.3)`, background: `rgba(${a},0.06)`, border: `1px solid rgba(${a},0.1)`}}>ESC</span>
                        </button>
                    </div>
                </aside>

                {/* ── Right content ── */}
                <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Tab header */}
                    <div className="shrink-0 flex items-center gap-4 px-8 py-5"
                        style={{borderBottom: `1px solid rgba(${a},0.08)`}}>
                        <span className="text-2xl leading-none"
                            style={{color: ac, filter: `drop-shadow(0 0 8px ${ac})`}}>
                            {NAV_ITEMS.find((n) => n.id === tab)?.icon}
                        </span>
                        <div>
                            <h2 className="text-[15px] font-semibold"
                                style={{fontFamily: "Orbitron, sans-serif", color: ac}}>
                                {NAV_ITEMS.find((n) => n.id === tab)?.label}
                            </h2>
                            <p className="text-[11px] mt-0.5" style={{color: `rgba(${a},0.35)`}}>
                                {NAV_ITEMS.find((n) => n.id === tab)?.sub}
                            </p>
                        </div>
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-y-auto px-8 py-6">
                        {tab === "account" && (
                            <AccountTab settings={settings} accent={a} ac={ac} onApply={applySettings} />
                        )}
                        {tab === "model" && (
                            <ModelTab settings={settings} accent={a} ac={ac} onApply={applySettings} />
                        )}
                        {tab === "voice" && (
                            <VoiceTab settings={settings} config={config} accent={a} ac={ac}
                                onApply={applySettings} onApplyConfig={applyConfig} />
                        )}
                        {tab === "appearance" && (
                            <AppearanceTab settings={settings} accent={a} ac={ac}
                                onApply={applySettings}
                                onAccentChange={onAccentChange}
                                onSkinChange={onSkinChange}
                                onFontChange={onFontChange}
                                onLayoutChange={onLayoutChange}
                                onCustomCssChange={onCustomCssChange}
                            />
                        )}
                        {tab === "keys" && (
                            <KeysTab config={config} accent={a} ac={ac} onApplyConfig={applyConfig} />
                        )}
                        {tab === "telemetry" && (
                            <TelemetryTab settings={settings} accent={a} ac={ac}
                                onApply={applySettings} onWidgetsChange={onTelemetryWidgetsChange} />
                        )}
                        {tab === "shortcuts" && (
                            <ShortcutsTab accent={a} ac={ac} />
                        )}
                        {tab === "tools" && (
                            <ToolsTab settings={settings} accent={a} ac={ac} onApply={applySettings} />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
