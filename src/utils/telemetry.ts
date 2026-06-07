export function fmtUptime(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h >= 24) return `${Math.floor(h / 24)}g ${h % 24}s`;
    return `${h}s ${m}d`;
}

export function fmtRate(bps?: number): string {
    if (bps == null) return "0 B/s";
    if (bps > 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`;
    if (bps > 1024) return `${Math.round(bps / 1024)} KB/s`;
    return `${bps} B/s`;
}

export function fmtMHz(mhz: number | null | undefined): string | null {
    if (!mhz) return null;
    return mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : `${mhz} MHz`;
}
