// AEGIS — UI Families (theme)
// =============================================================================
// A "family" = the entire design language: background (--bg/--bg-deep) + accent
// color (accent → --hud derivatives) + font. Under each family, the existing 4
// "skins" (hologram/minimal/terminal/dashboard) get repainted in that family's
// style. So 5 families × 4 skins = 20 visual combinations — not all "the same blue."
//
// When a family is selected: bg/bg-deep CSS variables + accent + font are all
// applied together (full preset). The user can then fine-tune accent/font within
// the family afterward.

export interface UiFamily {
    id: string;
    label: string;
    sub: string;
    accent: string;   // "r,g,b" — spread to --hud derivatives via applyAccent
    font: string;     // FONT_FAMILIES key
    bg: string;       // main background (CSS color)
    bgDeep: string;   // darker variant (terminal/deep panels)
    swatch: string;   // preview chip (hex)
}

export const UI_FAMILIES: UiFamily[] = [
    {id: "cyber",     label: "Cyber",     sub: "Cyan HUD · varsayılan",   accent: "34,211,238",  font: "jetbrains", bg: "#03060c", bgDeep: "#010408", swatch: "#22d3ee"},
    {id: "synthwave", label: "Synthwave", sub: "Neon mor/pembe · retro",  accent: "232,121,249", font: "orbitron",  bg: "#160a24", bgDeep: "#0b0414", swatch: "#e879f9"},
    {id: "matrix",    label: "Matrix",    sub: "Yeşil · hacker",          accent: "74,222,128",  font: "sharetech", bg: "#020805", bgDeep: "#000301", swatch: "#4ade80"},
    {id: "aurora",    label: "Aurora",    sub: "Teal · yumuşak",          accent: "45,212,191",  font: "inter",     bg: "#08131c", bgDeep: "#030a12", swatch: "#2dd4bf"},
    {id: "ember",     label: "Ember",     sub: "Amber · sıcak",           accent: "251,146,60",  font: "oxanium",   bg: "#140b06", bgDeep: "#0a0503", swatch: "#fb923c"},
];

export function getFamily(id: string | undefined): UiFamily {
    return UI_FAMILIES.find((f) => f.id === id) ?? UI_FAMILIES[0];
}
