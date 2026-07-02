import {useState, useEffect, useCallback, useRef} from "react";

interface TrackInfo {
    playing: boolean;
    title: string;
    artist: string;
    progress: number; // 0-100
    volume: number;   // 0-100, -1 = unknown
}

// Parse the "Playing: Title — Artist (Album) [0:32/3:21] {vol:72}" format
function parseTrack(raw: string): TrackInfo | null {
    if (!raw || raw.includes("Nothing is playing") || raw.includes("not connected") ||
        raw.includes("hiçbir şey çalmıyor") || raw.includes("bağlı değil")) return null;
    const isPlaying = raw.startsWith("Playing") || raw.startsWith("Oynuyor");
    const colonIdx = raw.indexOf(": ");
    if (colonIdx === -1) return null;
    const rest = raw.slice(colonIdx + 2);

    const volMatch = rest.match(/\{vol:(-?\d+)\}/);
    const volume = volMatch ? parseInt(volMatch[1]) : -1;

    const timeMatch = rest.match(/\[(\d+):(\d+)\/(\d+):(\d+)\]/);
    let progress = 0;
    if (timeMatch) {
        const progSec = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
        const durSec  = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4]);
        progress = durSec > 0 ? Math.round((progSec / durSec) * 100) : 0;
    }

    const noExtra = rest.replace(/\s*\[.*?\]/, "").replace(/\s*\{.*?\}/, "").trim();
    const dashIdx = noExtra.indexOf(" — ");
    const title  = dashIdx !== -1 ? noExtra.slice(0, dashIdx).trim() : noExtra;
    const afterDash = dashIdx !== -1 ? noExtra.slice(dashIdx + 3).trim() : "";
    const parenIdx = afterDash.lastIndexOf(" (");
    const artist = parenIdx !== -1 ? afterDash.slice(0, parenIdx).trim() : afterDash;

    return {playing: isPlaying, title, artist, progress, volume};
}

export default function SpotifyWidget() {
    const [track, setTrack] = useState<TrackInfo | null>(null);
    const [busy, setBusy] = useState(false);
    const [localVol, setLocalVol] = useState<number | null>(null);
    const volDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dragging = useRef(false);

    const refresh = useCallback(async () => {
        if (dragging.current) return;
        try {
            const raw = await window.jarvis.spotifyNowPlaying();
            const parsed = parseTrack(raw);
            setTrack(parsed);
            if (parsed && !dragging.current) setLocalVol(parsed.volume);
        } catch {
            setTrack(null);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const id = setInterval(refresh, 4000);
        return () => clearInterval(id);
    }, [refresh]);

    const ctrl = async (action: string, value?: number) => {
        if (busy) return;
        setBusy(true);
        try {
            const result = await window.jarvis.spotifyControl(action, value);
            if (action === "next" || action === "prev") {
                const parsed = parseTrack(result);
                if (parsed) { setTrack(parsed); setLocalVol(parsed.volume); return; }
            }
            setTimeout(refresh, 800);
        } finally {
            setBusy(false);
        }
    };

    const handleVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseInt(e.target.value);
        setLocalVol(v);
        dragging.current = true;
        if (volDebounce.current) clearTimeout(volDebounce.current);
        volDebounce.current = setTimeout(async () => {
            await window.jarvis.spotifyControl("volume", v);
            dragging.current = false;
        }, 300);
    };

    if (!track) return null;

    const vol = localVol ?? track.volume;

    return (
        <div
            className="rounded-lg px-2.5 py-2 shrink-0"
            style={{border: "1px solid rgba(var(--hud),0.2)", background: "rgba(var(--hud),0.07)"}}
        >
            {/* Track info */}
            <div className="flex items-center gap-2 mb-1.5">
                <div className="flex items-end gap-[2px] shrink-0" style={{height: 14}}>
                    {[0.6, 1, 0.7, 0.9, 0.5].map((h, i) => (
                        <div
                            key={i}
                            className={track.playing ? "spotify-bar" : ""}
                            style={{
                                width: 2,
                                height: track.playing ? undefined : `${h * 8}px`,
                                background: "rgb(var(--hud))",
                                borderRadius: 1,
                                opacity: 0.85,
                                ["--bar-h" as string]: `${h * 14}px`,
                                animationDelay: track.playing ? `${i * 0.12}s` : undefined,
                            }}
                        />
                    ))}
                </div>
                <div className="min-w-0 flex-1">
                    <div
                        className="text-[11px] font-medium truncate leading-tight glow-text"
                        style={{color: "rgb(var(--hud))"}}
                        title={track.title}
                    >
                        {track.title}
                    </div>
                    <div
                        className="text-[10px] truncate leading-tight mt-0.5"
                        style={{color: "rgba(var(--hud),0.6)"}}
                        title={track.artist}
                    >
                        {track.artist}
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-px rounded-full mb-2" style={{background: "rgba(var(--hud),0.15)"}}>
                <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{width: `${track.progress}%`, background: "rgb(var(--hud))"}}
                />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 mb-2">
                <CtrlBtn onClick={() => ctrl("prev")} disabled={busy}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
                    </svg>
                </CtrlBtn>
                <CtrlBtn onClick={() => ctrl(track.playing ? "pause" : "play")} disabled={busy} large>
                    {track.playing ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19h4V5H6zm8-14v14h4V5z"/>
                        </svg>
                    ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    )}
                </CtrlBtn>
                <CtrlBtn onClick={() => ctrl("next")} disabled={busy}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 18l8.5-6L6 6zm8.5 0H17V6h-2.5z"/>
                    </svg>
                </CtrlBtn>
            </div>

            {/* Volume slider */}
            {vol >= 0 && (
                <div className="flex items-center gap-2">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{color: "rgba(var(--hud),0.5)", flexShrink: 0}}>
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                    </svg>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={vol}
                        onChange={handleVolChange}
                        className="spotify-vol-slider flex-1"
                        style={{"--vol": `${vol}%`} as React.CSSProperties}
                    />
                    <span className="text-[9px] w-5 text-right" style={{color: "rgba(var(--hud),0.5)"}}>{vol}</span>
                </div>
            )}
        </div>
    );
}

function CtrlBtn({onClick, disabled, large, children}: {
    onClick: () => void; disabled: boolean; large?: boolean; children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`grid place-items-center rounded-full transition hover:brightness-125 disabled:opacity-30 ${large ? "w-7 h-7" : "w-6 h-6"}`}
            style={{color: "rgb(var(--hud))", border: "1px solid rgba(var(--hud),0.25)"}}
        >
            {children}
        </button>
    );
}
