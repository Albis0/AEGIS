import {useState, useEffect, useCallback, useRef} from "react";

// Faz 63.3 — Akıllı Ev widget'ı.
// smart_home_devices çıktısını parse edip cihaz sayısı + açık ışık sayısını gösterir,
// hızlı "tümünü aç / kapat" butonları sunar. Home Assistant yapılandırılmamışsa
// (HA_NOT_CONFIGURED / hata) hiç render etmez — boşluk yapmaz.

interface HomeState {
    deviceCount: number;
    lightsOn: number;
}

export function parseHome(raw: string): HomeState | null {
    if (!raw || raw.startsWith("HATA") || raw.includes("yapılandır") ||
        raw.includes("bağlanılamadı") || raw.includes("kurulu değil") || raw.includes("alınamadı")) return null;
    const countMatch = raw.match(/cihazları?\s*\((\d+)\)/);
    if (!countMatch) return null;
    const deviceCount = parseInt(countMatch[1]);
    // "• ad: açık" / "açık (%70)" satırlarını say
    const lightsOn = (raw.match(/:\s*açık/g) ?? []).length;
    return {deviceCount, lightsOn};
}

export default function SmartHomeWidget() {
    const [home, setHome] = useState<HomeState | null>(null);
    const [busy, setBusy] = useState(false);
    const mounted = useRef(true);

    const refresh = useCallback(async () => {
        try {
            const raw = await window.jarvis.runTool("smart_home_devices");
            if (mounted.current) setHome(parseHome(raw));
        } catch {
            if (mounted.current) setHome(null);
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        refresh();
        const id = setInterval(refresh, 10000);
        return () => { mounted.current = false; clearInterval(id); };
    }, [refresh]);

    const all = async (action: "on" | "off") => {
        if (busy) return;
        setBusy(true);
        try {
            await window.jarvis.runTool("smart_home_control", {target: "tüm ışıklar", action});
            setTimeout(refresh, 1200);
        } finally { setBusy(false); }
    };

    if (!home) return null;

    return (
        <div className="rounded-lg px-2.5 py-2 shrink-0"
            style={{border: "1px solid rgba(var(--hud),0.2)", background: "rgba(var(--hud),0.07)"}}>
            <div className="flex items-center gap-1.5 mb-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{color: "rgb(var(--hud))", flexShrink: 0}}>
                    <path d="M12 3 3 10v11h6v-6h6v6h6V10z"/>
                </svg>
                <span className="text-[9px] tracking-[0.2em] glow-text" style={{color: "rgba(var(--hud),0.7)"}}>AKILLI EV</span>
                <span className="ml-auto text-[9px]" style={{color: "rgba(var(--hud),0.5)"}}>{home.lightsOn}/{home.deviceCount} açık</span>
            </div>
            <div className="flex gap-1.5">
                <button onClick={() => all("on")} disabled={busy}
                    className="flex-1 py-1 rounded text-[10px] tracking-wide transition hover:brightness-125 disabled:opacity-30"
                    style={{background: "rgba(var(--hud),0.1)", border: "1px solid rgba(var(--hud),0.25)", color: "rgb(var(--hud))"}}>
                    Tümünü Aç
                </button>
                <button onClick={() => all("off")} disabled={busy}
                    className="flex-1 py-1 rounded text-[10px] tracking-wide transition hover:brightness-125 disabled:opacity-30"
                    style={{background: "rgba(var(--hud),0.04)", border: "1px solid rgba(var(--hud),0.15)", color: "rgba(var(--hud),0.7)"}}>
                    Tümünü Kapat
                </button>
            </div>
        </div>
    );
}
