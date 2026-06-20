export function hslToRgbStr(h: number, s: number, l: number): string {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
    return `${f(0)}, ${f(8)}, ${f(4)}`;
}

export function applyAccent(rgb: string): void {
    let [r, g, b] = (rgb ?? "").split(",").map((x) => parseInt(x.trim(), 10));
    // Geçersiz/eksik accent (ilk açılışta settings henüz dönmemiş olabilir) →
    // sessizce cyan'a düş. Aksi halde --hud "NaN,NaN,NaN" olur ve renkler bozulur.
    if (![r, g, b].every((n) => Number.isFinite(n))) { r = 34; g = 211; b = 238; }
    rgb = `${r}, ${g}, ${b}`;
    const deep = `${Math.round(r * 0.35)}, ${Math.round(g * 0.35)}, ${Math.round(b * 0.35)}`;
    const soft = `${Math.min(255, Math.round(r * 1.2))}, ${Math.min(255, Math.round(g * 1.1))}, ${Math.min(255, Math.round(b * 1.05))}`;
    document.documentElement.style.setProperty("--hud", rgb);
    document.documentElement.style.setProperty("--hud-deep", deep);
    document.documentElement.style.setProperty("--hud-soft", soft);
    document.documentElement.style.setProperty("--status-ok",      hslToRgbStr(140, 70, 55));
    document.documentElement.style.setProperty("--status-warn",    hslToRgbStr(45, 90, 60));
    document.documentElement.style.setProperty("--status-danger",  hslToRgbStr(0, 85, 60));
    document.documentElement.style.setProperty("--status-pending", rgb);
}
