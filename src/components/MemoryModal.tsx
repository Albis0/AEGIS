import {useState, useEffect, useCallback} from "react";

// Faz 63.6 — Hafıza & Gerçekler modal'ı.
// AEGIS'in öğrendiği kalıcı gerçekleri (Faz 16 + 57) görsel olarak gösterir:
// listeleme (list_facts), anlamca arama (search_memory), silme (forget_fact).
// Tüm veri mevcut tool'lardan runTool ile gelir — yeni IPC/şema yok.

export interface Fact {
    id: string;
    content: string;
    tags: string[];
}

// "• [abc] içerik (tag1, tag2)" satırlarını parse et.
export function parseFacts(raw: string): Fact[] {
    if (!raw || raw.includes("Kayıtlı gerçek yok")) return [];
    return raw.split("\n").map((line) => {
        const m = line.match(/^•\s*\[([^\]]+)\]\s*(.+?)(?:\s*\(([^)]*)\))?\s*$/);
        if (!m) return null;
        return {id: m[1], content: m[2].trim(), tags: m[3] ? m[3].split(",").map((s) => s.trim()) : []};
    }).filter(Boolean) as Fact[];
}

export default function MemoryModal({open, onClose, accent}: {open: boolean; onClose: () => void; accent: string}) {
    const [facts, setFacts] = useState<Fact[]>([]);
    const [query, setQuery] = useState("");
    const [searchResult, setSearchResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const raw = await window.jarvis.runTool("list_facts");
            setFacts(parseFacts(raw));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (open) { load(); setQuery(""); setSearchResult(null); } }, [open, load]);

    // Esc ile kapat
    useEffect(() => {
        if (!open) return;
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [open, onClose]);

    const runSearch = async () => {
        if (!query.trim()) { setSearchResult(null); return; }
        const raw = await window.jarvis.runTool("search_memory", {query: query.trim()});
        setSearchResult(raw);
    };

    const forget = async (id: string) => {
        await window.jarvis.runTool("forget_fact", {id_or_content: id});
        load();
    };

    if (!open) return null;
    const ac = `rgb(${accent})`;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)"}}
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg max-h-[80vh] rounded-2xl flex flex-col overflow-hidden"
                style={{background: "var(--bg-deep, #060a12)", border: `1px solid rgba(${accent},0.3)`, boxShadow: `0 0 40px rgba(${accent},0.15)`}}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Başlık */}
                <div className="flex items-center gap-2 px-5 py-3.5" style={{borderBottom: `1px solid rgba(${accent},0.15)`}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3v1a3 3 0 0 0 6 0v-1a3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3V5a3 3 0 0 0-3-3Z"/>
                    </svg>
                    <span className="text-[13px] font-semibold tracking-wide" style={{color: ac}}>HAFIZA · ÖĞRENİLEN GERÇEKLER</span>
                    <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100 transition" style={{color: ac}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>
                    </button>
                </div>

                {/* Arama */}
                <div className="px-5 pt-3.5 pb-2">
                    <div className="flex gap-2">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                            placeholder="Hafızada ara — 'geçen ay X hakkında ne demiştim?'"
                            className="flex-1 px-3 py-2 rounded-lg text-[12px] outline-none"
                            style={{background: `rgba(${accent},0.06)`, border: `1px solid rgba(${accent},0.2)`, color: ac}}
                        />
                        <button
                            onClick={runSearch}
                            className="px-3 rounded-lg text-[11px] font-medium transition hover:brightness-125"
                            style={{background: `rgba(${accent},0.15)`, border: `1px solid rgba(${accent},0.3)`, color: ac}}
                        >ARA</button>
                    </div>
                    {searchResult && (
                        <div className="mt-2 px-3 py-2 rounded-lg text-[11px] whitespace-pre-wrap leading-relaxed"
                            style={{background: `rgba(${accent},0.04)`, border: `1px solid rgba(${accent},0.12)`, color: `rgba(${accent},0.85)`}}>
                            {searchResult}
                        </div>
                    )}
                </div>

                {/* Liste */}
                <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1.5">
                    <div className="text-[9px] tracking-[0.2em] py-1 sticky top-0" style={{color: `rgba(${accent},0.45)`, background: "var(--bg-deep, #060a12)"}}>
                        TÜM GERÇEKLER · {facts.length}
                    </div>
                    {loading ? (
                        <div className="text-[11px] py-4 text-center" style={{color: `rgba(${accent},0.4)`}}>Yükleniyor…</div>
                    ) : facts.length === 0 ? (
                        <div className="text-[11px] py-6 text-center" style={{color: `rgba(${accent},0.4)`}}>
                            Henüz öğrenilmiş gerçek yok. Konuşurken otomatik öğrenir,<br/>ya da "Bunu bil: …" diyebilirsin.
                        </div>
                    ) : facts.map((f) => (
                        <div key={f.id} className="flex items-start gap-2 px-3 py-2 rounded-lg group"
                            style={{background: `rgba(${accent},0.04)`, border: `1px solid rgba(${accent},0.1)`}}>
                            <span className="flex-1 text-[12px] leading-snug" style={{color: `rgba(${accent},0.9)`}}>
                                {f.content}
                                {f.tags.length > 0 && (
                                    <span className="ml-1.5 text-[9px]" style={{color: `rgba(${accent},0.45)`}}>
                                        {f.tags.map((t) => `#${t}`).join(" ")}
                                    </span>
                                )}
                            </span>
                            <button
                                onClick={() => forget(f.id)}
                                title="Bu gerçeği unut"
                                className="opacity-0 group-hover:opacity-100 transition grid place-items-center w-4 h-4 rounded hover:text-red-400 shrink-0 mt-0.5"
                                style={{color: `rgba(${accent},0.5)`}}
                            >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Zm3-3h6l1 2H8l1-2Z" opacity="0.9"/></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
