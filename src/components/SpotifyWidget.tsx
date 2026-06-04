import {useState, useEffect, useCallback} from "react";

interface TrackInfo {
    playing: boolean;
    title: string;
    artist: string;
    progress: number; // 0-100
}

// "Oynuyor: Title — Artist (Album) [0:32/3:21]" formatını parse et
function parseTrack(raw: string): TrackInfo | null {
    if (!raw || raw.includes("hiçbir şey çalmıyor") || raw.includes("bağlı değil")) return null;
    const isPlaying = raw.startsWith("Oynuyor");
    // "Oynuyor: Title — Artist (Album) [prog/dur]"
    const colonIdx = raw.indexOf(": ");
    if (colonIdx === -1) return null;
    const rest = raw.slice(colonIdx + 2);
    // progress: "[0:32/3:21]"
    const timeMatch = rest.match(/\[(\d+):(\d+)\/(\d+):(\d+)\]/);
    let progress = 0;
    if (timeMatch) {
        const progSec = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
        const durSec  = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4]);
        progress = durSec > 0 ? Math.round((progSec / durSec) * 100) : 0;
    }
    // title — artist (album)
    const noTime = rest.replace(/\s*\[.*?\]/, "").trim();
    const dashIdx = noTime.indexOf(" — ");
    const title  = dashIdx !== -1 ? noTime.slice(0, dashIdx).trim() : noTime;
    const afterDash = dashIdx !== -1 ? noTime.slice(dashIdx + 3).trim() : "";
    // "Artist (Album)" → just artist
    const parenIdx = afterDash.lastIndexOf(" (");
    const artist = parenIdx !== -1 ? afterDash.slice(0, parenIdx).trim() : afterDash;
    return {playing: isPlaying, title, artist, progress};
}

export default function SpotifyWidget() {
    const [track, setTrack] = useState<TrackInfo | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const raw = await window.jarvis.spotifyNowPlaying();
            setTrack(parseTrack(raw));
        } catch {
            setTrack(null);
        }
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, 4000);
        return () => clearInterval(id);
    }, [refresh]);

    const ctrl = async (action: string, value?: number) => {
        if (busy) return;
        setBusy(true);
        try {
            await window.jarvis.spotifyControl(action, value);
            setTimeout(refresh, 600);
        } finally {
            setBusy(false);
        }
    };

    if (!track) return null;

    return (
        <div
            className="rounded-lg px-2.5 py-2 shrink-0"
            style={{border: "1px solid rgba(var(--hud),0.2)", background: "rgba(var(--hud),0.07)"}}
        >
            {/* Track info */}
            <div className="flex items-center gap-2 mb-1.5">
                {/* Animated bars when playing */}
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
            <div className="flex items-center justify-center gap-3">
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
