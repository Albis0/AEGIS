import {useState, useEffect, useCallback, useRef} from "react";

// Phase 63.2 — Steam / running game widget.
// Parses the "Running game(s): X, Y" output and shows a live card.
// Renders nothing if no game is running (like the Spotify widget — no empty space).

export function parseRunning(raw: string): string[] {
    if (!raw || raw.includes("No Steam game is currently running") || raw.includes("çalışan Steam oyunu yok") ||
        raw.startsWith("ERROR") || raw.startsWith("HATA")) return [];
    const idx = raw.indexOf(": ");
    if (idx === -1) return [];
    return raw.slice(idx + 2).split(",").map((s) => s.trim()).filter(Boolean);
}

// "ProcessName.exe" / "hl2" → convert to a readable name (strip extension/underscores, capitalize).
export function prettyName(proc: string): string {
    const base = proc.replace(/\.exe$/i, "").replace(/[_-]+/g, " ").trim();
    return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SteamWidget() {
    const [games, setGames] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const mounted = useRef(true);

    const refresh = useCallback(async () => {
        try {
            const raw = await window.jarvis.runTool("steam_game_running");
            if (mounted.current) setGames(parseRunning(raw));
        } catch {
            if (mounted.current) setGames([]);
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        refresh();
        const id = setInterval(refresh, 8000); // game status changes slowly
        return () => { mounted.current = false; clearInterval(id); };
    }, [refresh]);

    const closeGame = async (proc: string) => {
        if (busy) return;
        setBusy(true);
        try {
            await window.jarvis.runTool("steam_close_game", {game: proc.replace(/\.exe$/i, "")});
            setTimeout(refresh, 1000);
        } finally {
            setBusy(false);
        }
    };

    if (games.length === 0) return null;

    return (
        <div
            className="rounded-lg px-2.5 py-2 shrink-0"
            style={{border: "1px solid rgba(var(--hud),0.2)", background: "rgba(var(--hud),0.07)"}}
        >
            <div className="flex items-center gap-1.5 mb-1.5">
                {/* Generic game-pad SVG instead of the Steam logo (line-icon, currentColor) */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{color: "rgb(var(--hud))", flexShrink: 0}}>
                    <path d="M7 6h10a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4 3 3 0 0 1-2.4-1.2L13 19h-2l-1.6-2.2A3 3 0 0 1 7 18a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4Zm1 4H6.5v1.5H5V13h1.5v1.5H8V13h1.5v-1.5H8V10Zm8.5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-2 2.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>
                </svg>
                <span className="text-[9px] tracking-[0.2em] glow-text" style={{color: "rgba(var(--hud),0.7)"}}>OYUNDA</span>
                <span className="ml-auto flex items-center gap-1 text-[8px]" style={{color: "rgba(var(--hud),0.5)"}}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{background: "rgb(var(--hud))", boxShadow: "0 0 4px rgb(var(--hud))"}} />
                    {games.length}
                </span>
            </div>

            <div className="space-y-1">
                {games.map((g) => (
                    <div key={g} className="flex items-center gap-2 group">
                        <span className="text-[11px] font-medium truncate flex-1 leading-tight glow-text" style={{color: "rgb(var(--hud))"}} title={g}>
                            {prettyName(g)}
                        </span>
                        <button
                            onClick={() => closeGame(g)}
                            disabled={busy}
                            title="Oyunu kapat"
                            className="opacity-0 group-hover:opacity-100 transition disabled:opacity-20 grid place-items-center w-4 h-4 rounded hover:text-red-400"
                            style={{color: "rgba(var(--hud),0.6)"}}
                        >
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
