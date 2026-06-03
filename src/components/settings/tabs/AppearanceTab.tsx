import {useState} from "react";
import type {AppSettings} from "../../../electron.d";
import {SectionLabel, RadioCard, Hint, Toggle} from "../shared";
import {UI_FAMILIES, type UiFamily} from "../../../themes";

const ACCENT_COLORS = [
    {id: "34,211,238",  label: "Cyan",    hex: "#22d3ee"},
    {id: "56,189,248",  label: "Sky",     hex: "#38bdf8"},
    {id: "99,102,241",  label: "Indigo",  hex: "#6366f1"},
    {id: "139,92,246",  label: "Purple",  hex: "#8b5cf6"},
    {id: "232,121,249", label: "Fuchsia", hex: "#e879f9"},
    {id: "251,113,133", label: "Rose",    hex: "#fb7185"},
    {id: "248,113,113", label: "Red",     hex: "#f87171"},
    {id: "251,146,60",  label: "Orange",  hex: "#fb923c"},
    {id: "250,204,21",  label: "Yellow",  hex: "#facc15"},
    {id: "163,230,53",  label: "Lime",    hex: "#a3e635"},
    {id: "110,231,183", label: "Emerald", hex: "#6ee7b7"},
    {id: "45,212,191",  label: "Teal",    hex: "#2dd4bf"},
];

const FONTS = [
    {id: "jetbrains",    label: "JetBrains",     sub: "Mono · varsayılan", family: "'JetBrains Mono', monospace"},
    {id: "sharetech",    label: "Share Tech",    sub: "Mono · retro",      family: "'Share Tech Mono', monospace"},
    {id: "orbitron",     label: "Orbitron",      sub: "Sci-fi · display",  family: "Orbitron"},
    {id: "oxanium",      label: "Oxanium",       sub: "Sci-fi · modern",   family: "Oxanium"},
    {id: "syne",         label: "Syne",          sub: "Geometric · bold",  family: "Syne"},
    {id: "rajdhani",     label: "Rajdhani",      sub: "Sans · sharp",      family: "Rajdhani"},
    {id: "poppins",      label: "Poppins",       sub: "Sans · yuvarlak",   family: "Poppins"},
    {id: "inter",        label: "Inter",         sub: "Sans · okunaklı",   family: "Inter"},
    {id: "spacegrotesk", label: "Space Grotesk", sub: "Grotesque · techy", family: "'Space Grotesk'"},
] as const;

const SKINS = [
    {id: "hologram",  icon: "◎", label: "Hologram",  sub: "3D globe · HUD"},
    {id: "minimal",   icon: "—", label: "Minimal",   sub: "Sade · metin"},
    {id: "terminal",  icon: ">", label: "Terminal",  sub: "CLI emülatörü"},
    {id: "dashboard", icon: "▦", label: "Dashboard", sub: "Widget grid"},
] as const;

interface Props {
    settings: AppSettings;
    accent: string;
    ac: string;
    onApply: (patch: Partial<AppSettings>) => void;
    onAccentChange: (rgb: string) => void;
    onFamilyChange: (familyId: string) => void;
    onSkinChange: (skin: AppSettings["skin"]) => void;
    onFontChange: (font: AppSettings["font"]) => void;
    onLayoutChange: (layout: AppSettings["layout"]) => void;
    onCustomCssChange: (css: string) => void;
}

export default function AppearanceTab({settings, accent, ac, onApply, onAccentChange, onFamilyChange, onSkinChange, onFontChange, onLayoutChange, onCustomCssChange}: Props) {

    function applyWithSideEffect(patch: Partial<AppSettings>) {
        onApply(patch);
        if (patch.accentColor) onAccentChange(patch.accentColor);
        if (patch.skin) onSkinChange(patch.skin);
        if (patch.font) onFontChange(patch.font);
        if (patch.layout) onLayoutChange(patch.layout);
        if (patch.customCss !== undefined) onCustomCssChange(patch.customCss);
    }

    // Aile seçimi = tam preset: arka plan + accent + font hep birlikte.
    function pickFamily(fam: UiFamily) {
        onApply({uiFamily: fam.id, accentColor: fam.accent, font: fam.font as AppSettings["font"]});
        onFamilyChange(fam.id);
        onAccentChange(fam.accent);
        onFontChange(fam.font as AppSettings["font"]);
    }

    return (
        <div className="space-y-7">

            {/* Renk/zemin preset (hızlı tema) — skin "ailesi" ile karıştırma */}
            <div>
                <SectionLabel label="PALET (RENK + ZEMİN)" accent={accent} />
                <div className="grid grid-cols-2 gap-2">
                    {UI_FAMILIES.map((fam) => {
                        const active = (settings.uiFamily ?? "cyber") === fam.id;
                        return (
                            <RadioCard key={fam.id} active={active} accent={accent}
                                onClick={() => pickFamily(fam)}
                                className="flex items-center gap-3 px-3.5 py-3">
                                <span className="w-5 h-5 rounded-full shrink-0"
                                    style={{background: fam.swatch, boxShadow: active ? `0 0 10px ${fam.swatch}` : "none", border: `1px solid ${fam.swatch}66`}} />
                                <span className="flex-1 min-w-0">
                                    <span className="block text-[13px] font-semibold truncate"
                                        style={{color: active ? ac : `rgba(${accent},0.65)`}}>{fam.label}</span>
                                    <span className="block text-[10px] mt-0.5 truncate" style={{color: `rgba(${accent},0.35)`}}>{fam.sub}</span>
                                </span>
                                {active && <span className="w-2 h-2 rounded-full shrink-0" style={{background: ac, boxShadow: `0 0 6px ${ac}`}} />}
                            </RadioCard>
                        );
                    })}
                </div>
                <Hint accent={accent}>Hazır renk + zemin + font preset'i. Skin (layout) ve rengi yine de tek tek değiştirebilirsin.</Hint>
            </div>

            {/* Accent colors */}
            <div>
                <SectionLabel label="TEMA RENGİ" accent={accent} />
                <div className="grid grid-cols-6 gap-3 pt-1">
                    {ACCENT_COLORS.map((c) => {
                        const active = settings.accentColor === c.id;
                        return (
                            <button key={c.id} onClick={() => applyWithSideEffect({accentColor: c.id})} title={c.label}
                                className="group relative w-full aspect-square rounded-full transition-all duration-150 hover:scale-110"
                                style={{
                                    background: c.hex,
                                    boxShadow: active
                                        ? `0 0 0 2px #03060c, 0 0 0 4px ${c.hex}, 0 0 16px ${c.hex}88`
                                        : `inset 0 0 0 1px rgba(255,255,255,0.08)`,
                                }}>
                                {active && (
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                                        style={{color: "rgba(0,0,0,0.6)"}}>✓</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* UI Skin */}
            <div>
                <SectionLabel label="UI SKIN" accent={accent} />
                <div className="grid grid-cols-2 gap-2">
                    {SKINS.map((s) => {
                        const active = settings.skin === s.id;
                        return (
                            <RadioCard key={s.id} active={active} accent={accent}
                                onClick={() => applyWithSideEffect({skin: s.id})}
                                className="flex flex-col gap-0.5 px-4 py-3.5">
                                <span className="text-2xl leading-none" style={{color: active ? ac : `rgba(${accent},0.3)`}}>{s.icon}</span>
                                <span className="text-[13px] font-semibold mt-2"
                                    style={{color: active ? ac : `rgba(${accent},0.6)`}}>{s.label}</span>
                                <span className="text-[11px] mt-0.5" style={{color: `rgba(${accent},0.35)`}}>{s.sub}</span>
                            </RadioCard>
                        );
                    })}
                </div>
            </div>

            {/* Font */}
            <div>
                <SectionLabel label="FONT" accent={accent} />
                <div className="grid grid-cols-3 gap-2">
                    {FONTS.map((f) => {
                        const active = (settings.font ?? "jetbrains") === f.id;
                        return (
                            <RadioCard key={f.id} active={active} accent={accent}
                                onClick={() => applyWithSideEffect({font: f.id})}
                                className="flex flex-col gap-0.5 px-3 py-2.5">
                                <span className="text-[14px] font-semibold leading-tight"
                                    style={{color: active ? ac : `rgba(${accent},0.6)`, fontFamily: f.family}}>{f.label}</span>
                                <span className="text-[10px] mt-0.5 leading-tight"
                                    style={{color: `rgba(${accent},0.35)`}}>{f.sub}</span>
                            </RadioCard>
                        );
                    })}
                </div>
            </div>

            {/* Layout density */}
            <div>
                <SectionLabel label="LAYOUT" accent={accent} />
                <div className="grid grid-cols-2 gap-2">
                    {([
                        {id: "normal",  label: "Normal",  sub: "Standart boşluklar"},
                        {id: "compact", label: "Kompakt", sub: "Daha sık, daha fazla içerik"},
                    ] as const).map((l) => {
                        const active = (settings.layout ?? "normal") === l.id;
                        return (
                            <RadioCard key={l.id} active={active} accent={accent}
                                onClick={() => applyWithSideEffect({layout: l.id})}
                                className="flex flex-col gap-0.5 px-4 py-3">
                                <span className="text-[14px] font-semibold"
                                    style={{color: active ? ac : `rgba(${accent},0.6)`}}>{l.label}</span>
                                <span className="text-[11px] mt-0.5"
                                    style={{color: `rgba(${accent},0.35)`}}>{l.sub}</span>
                            </RadioCard>
                        );
                    })}
                </div>
            </div>

            {/* App toggles */}
            <div>
                <SectionLabel label="UYGULAMA" accent={accent} />
                <div className="space-y-2">
                    {([
                        {key: "minimizeToTray"   as const, label: "Kapatınca tepsiye küçült",       sub: "Pencereyi kapatmak uygulamayı sonlandırmaz"},
                        {key: "autoLaunch"       as const, label: "Windows başlangıcında başlat",   sub: "Oturum açılınca AEGIS arka planda başlar"},
                        {key: "apiServerEnabled" as const, label: "Yerel API sunucusu (port 7331)", sub: "Telefondan /api/ask ile AEGIS'e soru sor"},
                    ]).map(({key, label, sub}) => {
                        const active = !!(settings as unknown as Record<string, unknown>)[key];
                        return (
                            <div key={key}
                                className="flex items-center gap-4 px-4 py-3 rounded-xl transition"
                                style={{
                                    background: active ? `rgba(${accent},0.07)` : "transparent",
                                    border: `1px solid ${active ? `rgba(${accent},0.25)` : `rgba(${accent},0.08)`}`,
                                }}>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-[13px] font-medium"
                                        style={{color: active ? ac : `rgba(${accent},0.6)`}}>{label}</span>
                                    <span className="block text-[11px] mt-0.5"
                                        style={{color: `rgba(${accent},0.3)`}}>{sub}</span>
                                </span>
                                <Toggle active={active} onChange={() => onApply({[key]: !active} as Partial<typeof settings>)} accent={accent} />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Custom CSS */}
            <div>
                <SectionLabel label="ÖZEL CSS" accent={accent} />
                <CustomCssField value={settings.customCss ?? ""} onSave={(v) => applyWithSideEffect({customCss: v})} accent={accent} />
                <Hint accent={accent}>CSS değişkenlerini override et. Örn: <code style={{color: `rgba(${accent},0.55)`}}>{`:root { --hud: 255,100,50; }`}</code></Hint>
            </div>
        </div>
    );
}

function CustomCssField({value, onSave, accent}: {value: string; onSave: (v: string) => void; accent: string}) {
    const [val, setVal] = useState(value);
    const changed = val !== value;
    const ac = `rgb(${accent})`;

    return (
        <div className="space-y-2">
            <textarea
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder=".my-class { color: red; }"
                rows={5}
                className="w-full bg-transparent rounded-xl px-3.5 py-2.5 text-[11px] outline-none border transition resize-none"
                style={{
                    borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.1)`,
                    color: ac, fontFamily: "'JetBrains Mono', monospace",
                    lineHeight: "1.6",
                }}
            />
            {changed && (
                <button onClick={() => onSave(val)}
                    className="px-4 py-2 rounded-lg border text-[10px] tracking-widest transition hover:brightness-125"
                    style={{borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.1)`, color: ac}}>
                    ✓ UYGULA
                </button>
            )}
        </div>
    );
}

