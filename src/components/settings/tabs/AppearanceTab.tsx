import {useState} from "react";
import type {AppSettings} from "../../../electron.d";
import {SectionLabel, RadioCard, Hint, Toggle} from "../shared";
import {UI_FAMILIES, type UiFamily} from "../../../themes";
import {SKIN_FAMILIES} from "../../skins/registry";
import type {SettingsStrings} from "../../../i18n";

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
    {id: "jetbrains",    label: "JetBrains",     sub: "Mono", family: "'JetBrains Mono', monospace"},
    {id: "sharetech",    label: "Share Tech",    sub: "Mono retro", family: "'Share Tech Mono', monospace"},
    {id: "orbitron",     label: "Orbitron",      sub: "Sci-fi", family: "Orbitron"},
    {id: "oxanium",      label: "Oxanium",       sub: "Modern", family: "Oxanium"},
    {id: "syne",         label: "Syne",          sub: "Bold geo", family: "Syne"},
    {id: "rajdhani",     label: "Rajdhani",      sub: "Sharp", family: "Rajdhani"},
    {id: "poppins",      label: "Poppins",       sub: "Yuvarlak", family: "Poppins"},
    {id: "inter",        label: "Inter",         sub: "Okunaklı", family: "Inter"},
    {id: "spacegrotesk", label: "Space Grotesk", sub: "Techy", family: "'Space Grotesk'"},
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
    s: SettingsStrings;
}

export default function AppearanceTab({settings, accent, ac, onApply, onAccentChange, onFamilyChange, onSkinChange, onFontChange, onLayoutChange, onCustomCssChange, s}: Props) {
    const [fineOpen, setFineOpen] = useState(false);

    function applyWithSideEffect(patch: Partial<AppSettings>) {
        onApply(patch);
        if (patch.accentColor) onAccentChange(patch.accentColor);
        if (patch.skin) onSkinChange(patch.skin);
        if (patch.font) onFontChange(patch.font);
        if (patch.layout) onLayoutChange(patch.layout);
        if (patch.customCss !== undefined) onCustomCssChange(patch.customCss);
    }

    function pickPalette(fam: UiFamily) {
        onApply({uiFamily: fam.id, accentColor: fam.accent, font: fam.font as AppSettings["font"]});
        onFamilyChange(fam.id);
        onAccentChange(fam.accent);
        onFontChange(fam.font as AppSettings["font"]);
    }

    // Seçili skin hangi aileye ait?
    const activeFamilyId = SKIN_FAMILIES.find((f) => f.skins.some((sk) => sk.id === settings.skin))?.id ?? "aegis";
    const [expandedFamily, setExpandedFamily] = useState<string>(activeFamilyId);

    return (
        <div className="space-y-6">

            {/* ── 1. AİLE + FERDİ: Tek seçim akışı ── */}
            <div>
                <SectionLabel label={s.apSkin} accent={accent} />

                {/* Aile listesi — yatay chip'ler */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {SKIN_FAMILIES.map((fam) => {
                        const isExpanded = expandedFamily === fam.id;
                        const hasActiveSkin = fam.skins.some((sk) => sk.id === settings.skin);
                        return (
                            <button
                                key={fam.id}
                                onClick={() => setExpandedFamily(isExpanded ? "" : fam.id)}
                                className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[12px] transition-all"
                                style={{
                                    background: isExpanded ? `rgba(${accent},0.15)` : hasActiveSkin ? `rgba(${accent},0.08)` : `rgba(${accent},0.03)`,
                                    border: `1px solid ${isExpanded ? `rgba(${accent},0.5)` : hasActiveSkin ? `rgba(${accent},0.3)` : `rgba(${accent},0.1)`}`,
                                    color: isExpanded ? ac : hasActiveSkin ? `rgba(${accent},0.85)` : `rgba(${accent},0.45)`,
                                    fontWeight: isExpanded || hasActiveSkin ? 600 : 400,
                                }}>
                                {hasActiveSkin && (
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background: ac}} />
                                )}
                                {fam.label}
                                <span className="text-[10px]" style={{color: `rgba(${accent},0.35)`, fontWeight: 400}}>
                                    {isExpanded ? "▴" : "▾"}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Seçili ailenin 4 ferdini göster */}
                {SKIN_FAMILIES.filter((f) => f.id === expandedFamily).map((fam) => (
                    <div key={fam.id} className="rounded-2xl overflow-hidden" style={{border: `1px solid rgba(${accent},0.12)`, background: `rgba(${accent},0.02)`}}>
                        <div className="px-4 py-2.5 border-b" style={{borderColor: `rgba(${accent},0.08)`}}>
                            <span className="text-[10px] tracking-[0.2em] opacity-50">{fam.sub}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-px" style={{background: `rgba(${accent},0.06)`}}>
                            {fam.skins.map((sk) => {
                                const active = settings.skin === sk.id;
                                return (
                                    <button
                                        key={sk.id}
                                        onClick={() => applyWithSideEffect({skin: sk.id})}
                                        className="flex flex-col gap-1 px-4 py-3.5 text-left transition-all"
                                        style={{
                                            background: active ? `rgba(${accent},0.12)` : "var(--bg)",
                                        }}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[16px] leading-none" style={{color: active ? ac : `rgba(${accent},0.35)`}}>{sk.icon}</span>
                                            <span className="text-[13px] font-semibold" style={{color: active ? ac : `rgba(${accent},0.65)`}}>{sk.label}</span>
                                            {active && <span className="ml-auto text-[9px] tracking-widest px-1.5 py-0.5 rounded-full" style={{color: ac, background: `rgba(${accent},0.12)`, border: `1px solid rgba(${accent},0.25)`}}>{s.apActive}</span>}
                                        </div>
                                        <span className="text-[10px] pl-6" style={{color: `rgba(${accent},0.35)`}}>{sk.sub}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── 2. REAKTÖR TİPİ (sadece Hologram skin'de görünür) ── */}
            {settings.skin === "hologram" && (
                <div>
                    <SectionLabel label="Reaktör Tipi" accent={accent} />

                    {/* LITE grup */}
                    <div className="mb-1.5">
                        <span className="text-[9px] tracking-[0.35em] font-semibold px-1"
                            style={{color: `rgba(${accent},0.35)`}}>LITE — SVG</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {([
                            {id: "rings",   label: "Rings",    sub: "Chronos — halka sistemi"},
                            {id: "hexcore", label: "Hex Core", sub: "Tesseract — altıgen çekirdek"},
                            {id: "pulsar",  label: "Pulsar",   sub: "Sonar — yayılan dalgalar"},
                            {id: "vortex",  label: "Vortex",   sub: "Singularity — sarmal akış"},
                        ] as const).map((r) => {
                            const isActive = (settings.reactorStyle ?? "rings") === r.id;
                            return (
                                <RadioCard key={r.id} active={isActive} accent={accent}
                                    onClick={() => applyWithSideEffect({reactorStyle: r.id})}
                                    className="flex flex-col gap-0.5 px-4 py-3">
                                    <span className="text-[13px] font-semibold" style={{color: isActive ? ac : `rgba(${accent},0.6)`}}>{r.label}</span>
                                    <span className="text-[10px]" style={{color: `rgba(${accent},0.35)`}}>{r.sub}</span>
                                </RadioCard>
                            );
                        })}
                    </div>

                    {/* 3D grup */}
                    <div className="mb-1.5">
                        <span className="text-[9px] tracking-[0.35em] font-semibold px-1"
                            style={{color: `rgba(${accent},0.35)`}}>3D — WebGL + Bloom</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {([
                            {id: "orb",     label: "Orb",     sub: "Arc Core — küre + halkalar"},
                            {id: "plasma",  label: "Plasma",   sub: "Fusion — icosahedron + torus"},
                            {id: "helix",   label: "Helix",    sub: "DNA — çift sarmal"},
                            {id: "quantum", label: "Quantum",  sub: "Entanglement — torus knot"},
                        ] as const).map((r) => {
                            const isActive = (settings.reactorStyle ?? "rings") === r.id;
                            return (
                                <RadioCard key={r.id} active={isActive} accent={accent}
                                    onClick={() => applyWithSideEffect({reactorStyle: r.id})}
                                    className="flex flex-col gap-0.5 px-4 py-3">
                                    <span className="text-[13px] font-semibold" style={{color: isActive ? ac : `rgba(${accent},0.6)`}}>{r.label}</span>
                                    <span className="text-[10px]" style={{color: `rgba(${accent},0.35)`}}>{r.sub}</span>
                                </RadioCard>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── 4. LAYOUT yoğunluk ── */}
            <div>
                <SectionLabel label={s.apDensity} accent={accent} />
                <div className="grid grid-cols-2 gap-2">
                    {([
                        {id: "normal",  label: "Normal",  sub: "Standart boşluklar"},
                        {id: "compact", label: "Kompakt", sub: "Daha sık"},
                    ] as const).map((l) => {
                        const active = (settings.layout ?? "normal") === l.id;
                        return (
                            <RadioCard key={l.id} active={active} accent={accent}
                                onClick={() => applyWithSideEffect({layout: l.id})}
                                className="flex flex-col gap-0.5 px-4 py-3">
                                <span className="text-[13px] font-semibold" style={{color: active ? ac : `rgba(${accent},0.6)`}}>{l.label}</span>
                                <span className="text-[10px]" style={{color: `rgba(${accent},0.35)`}}>{l.sub}</span>
                            </RadioCard>
                        );
                    })}
                </div>
            </div>

            {/* ── 5. İNCE AYAR (gizlenebilir) — renk, palet preset, font ── */}
            <div className="rounded-xl overflow-hidden" style={{border: `1px solid rgba(${accent},0.08)`}}>
                <button
                    onClick={() => setFineOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 transition"
                    style={{background: fineOpen ? `rgba(${accent},0.05)` : "transparent"}}>
                    <span className="text-[10px] tracking-[0.3em]" style={{color: `rgba(${accent},0.45)`}}>{s.apFineAdj}</span>
                    <span className="text-[10px] transition-transform duration-200"
                        style={{color: `rgba(${accent},0.35)`, transform: fineOpen ? "rotate(180deg)" : "none"}}>▼</span>
                </button>

                {fineOpen && (
                    <div className="px-4 pb-4 space-y-5" style={{borderTop: `1px solid rgba(${accent},0.08)`}}>

                        {/* Tema rengi */}
                        <div className="pt-4">
                            <span className="text-[10px] tracking-[0.25em] opacity-40 block mb-2" style={{color: ac}}>{s.apAccent}</span>
                            <div className="grid grid-cols-6 gap-2.5">
                                {ACCENT_COLORS.map((c) => {
                                    const active = settings.accentColor === c.id;
                                    return (
                                        <button key={c.id} onClick={() => applyWithSideEffect({accentColor: c.id})} title={c.label}
                                            className="relative w-full aspect-square rounded-full transition-all hover:scale-110"
                                            style={{
                                                background: c.hex,
                                                boxShadow: active ? `0 0 0 2px var(--bg), 0 0 0 4px ${c.hex}` : `inset 0 0 0 1px rgba(255,255,255,0.1)`,
                                            }}>
                                            {active && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{color: "rgba(0,0,0,0.55)"}}>✓</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Hızlı palet preset */}
                        <div>
                            <span className="text-[10px] tracking-[0.25em] opacity-40 block mb-2" style={{color: ac}}>{s.apPalette}</span>
                            <div className="grid grid-cols-2 gap-2">
                                {UI_FAMILIES.map((fam) => {
                                    const active = (settings.uiFamily ?? "cyber") === fam.id;
                                    return (
                                        <button key={fam.id} onClick={() => pickPalette(fam)}
                                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
                                            style={{
                                                background: active ? `rgba(${accent},0.1)` : `rgba(${accent},0.02)`,
                                                border: `1px solid ${active ? `rgba(${accent},0.3)` : `rgba(${accent},0.07)`}`,
                                            }}>
                                            <span className="w-4 h-4 rounded-full shrink-0" style={{background: fam.swatch, boxShadow: active ? `0 0 8px ${fam.swatch}` : "none"}} />
                                            <span className="flex-1 text-left">
                                                <span className="block text-[12px] font-medium" style={{color: active ? ac : `rgba(${accent},0.6)`}}>{fam.label}</span>
                                                <span className="block text-[9px]" style={{color: `rgba(${accent},0.3)`}}>{fam.sub}</span>
                                            </span>
                                            {active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background: ac}} />}
                                        </button>
                                    );
                                })}
                            </div>
                            <Hint accent={accent}>Palet seçince renk + zemin + font birlikte değişir.</Hint>
                        </div>

                        {/* Font */}
                        <div>
                            <span className="text-[10px] tracking-[0.25em] opacity-40 block mb-2" style={{color: ac}}>{s.apFont}</span>
                            <div className="grid grid-cols-3 gap-1.5">
                                {FONTS.map((f) => {
                                    const active = (settings.font ?? "jetbrains") === f.id;
                                    return (
                                        <button key={f.id} onClick={() => applyWithSideEffect({font: f.id})}
                                            className="flex flex-col gap-0.5 px-2.5 py-2 rounded-lg text-left transition-all"
                                            style={{
                                                background: active ? `rgba(${accent},0.1)` : `rgba(${accent},0.02)`,
                                                border: `1px solid ${active ? `rgba(${accent},0.35)` : `rgba(${accent},0.07)`}`,
                                            }}>
                                            <span className="text-[12px] font-semibold leading-tight truncate" style={{color: active ? ac : `rgba(${accent},0.6)`, fontFamily: f.family}}>{f.label}</span>
                                            <span className="text-[9px]" style={{color: `rgba(${accent},0.3)`}}>{f.sub}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── 4. UYGULAMA toggle'ları ── */}
            <div>
                <SectionLabel label={s.apApp} accent={accent} />
                <div className="space-y-2">
                    {([
                        {key: "minimizeToTray"   as const, label: s.apTray,       sub: ""},
                        {key: "autoLaunch"       as const, label: s.apAutoLaunch, sub: ""},
                        {key: "apiServerEnabled" as const, label: s.apApiServer,  sub: ""},
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
                                    <span className="block text-[13px] font-medium" style={{color: active ? ac : `rgba(${accent},0.6)`}}>{label}</span>
                                    <span className="block text-[11px] mt-0.5" style={{color: `rgba(${accent},0.3)`}}>{sub}</span>
                                </span>
                                <Toggle active={active} onChange={() => onApply({[key]: !active} as Partial<typeof settings>)} accent={accent} />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── 5. ÖZEL CSS ── */}
            <div>
                <SectionLabel label={s.apCustomCss} accent={accent} />
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
            <textarea value={val} onChange={(e) => setVal(e.target.value)}
                placeholder=".my-class { color: red; }" rows={4}
                className="w-full bg-transparent rounded-xl px-3.5 py-2.5 text-[11px] outline-none border transition resize-none"
                style={{borderColor: changed ? `rgba(${accent},0.5)` : `rgba(${accent},0.1)`, color: ac, fontFamily: "'JetBrains Mono', monospace", lineHeight: "1.6"}} />
            {changed && (
                <button onClick={() => onSave(val)}
                    className="px-4 py-2 rounded-lg border text-[10px] tracking-widest transition hover:brightness-125"
                    style={{borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.1)`, color: ac}}>
                    UYGULA
                </button>
            )}
        </div>
    );
}
