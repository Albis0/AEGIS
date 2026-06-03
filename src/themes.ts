// AEGIS — UI Aileleri (tema)
// =============================================================================
// Bir "aile" = bütün tasarım dili: arka plan (--bg/--bg-deep) + vurgu rengi
// (accent → --hud türevleri) + font. Her ailenin altında mevcut 4 "skin"
// (hologram/minimal/terminal/dashboard) o ailenin tarzında yeniden boyanır.
// Böylece 5 aile × 4 skin = 20 görsel kombinasyon — hepsi "aynı mavi" değil.
//
// Aile seçilince: bg/bg-deep CSS değişkenleri + accent + font hep birlikte
// uygulanır (tam preset). Kullanıcı sonra accent/font'u ailenin içinde
// ince ayar yapabilir.

export interface UiFamily {
    id: string;
    label: string;
    sub: string;
    accent: string;   // "r,g,b" — applyAccent ile --hud türevlerine yayılır
    font: string;     // FONT_FAMILIES anahtarı
    bg: string;       // ana arka plan (CSS rengi)
    bgDeep: string;   // daha koyu varyant (terminal/derin paneller)
    swatch: string;   // önizleme çipi (hex)
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
