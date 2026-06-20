import {useState, useEffect, useCallback, type ReactNode} from "react";

// Faz 63 — Sekmeli Domain Paneli (Komut Merkezi).
// Tek modal altında, görsel yüzü olmayan domain'leri toplar. Her sekme mevcut
// list-tool'unu runTool ile çağırır, çıktıyı okunur şekilde gösterir + ilgili
// satır aksiyonu (sil/aç-kapat). Çoğu tool zaten okunur metin döndürdüğü için
// kırılgan parse yerine "ham bloklar" gösterilir (parse hatası riski yok).
//
// Kapsadığı ROADMAP maddeleri:
//   63.5 Görevler & Hatırlatıcılar   63.7 Bilgi Tabanı / RAG   63.8 Öğrenme
//   63.9 Plugin Marketplace          63.10 Otomasyon/Makro/Routine  63.11 Persona

type TabId = "tasks" | "knowledge" | "automation" | "learning" | "persona" | "plugins";

interface TabDef {
    id: TabId;
    label: string;
    icon: ReactNode;
    // çıktıyı çeken tool(lar) — birden fazlaysa başlıklı bloklar
    sources: {title?: string; tool: string; args?: Record<string, unknown>}[];
    // boş durum mesajı
    empty: string;
    // opsiyonel: bir satırdan silinecek/aksiyon alınacak öğeyi tanı (regex grup 1 = anahtar)
    action?: {label: string; tool: string; argKey: string; match: RegExp; danger?: boolean};
    // opsiyonel arama tool'u
    search?: {tool: string; placeholder: string};
}

const ic = (d: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);

const TABS: TabDef[] = [
    {
        id: "tasks", label: "GÖREVLER",
        icon: ic("M3 5h13M3 12h13M3 19h13M19 5l2 2-2 2M19 12l2 2-2 2"),
        sources: [
            {title: "Zamanlanmış Görevler", tool: "list_scheduled_tasks"},
            {title: "İzleme Koşulları", tool: "list_watch_conditions"},
        ],
        empty: "Zamanlanmış görev veya izleme koşulu yok.",
        action: {label: "Sil", tool: "cancel_scheduled_task", argKey: "id_or_name", match: /ID:\s*([^)\s]+)/, danger: true},
    },
    {
        id: "knowledge", label: "BİLGİ",
        icon: ic("M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z"),
        sources: [{tool: "list_indexed_files"}],
        empty: "İndekslenmiş dosya yok. 'index_folder' ile belge ekleyebilirsin.",
        search: {tool: "search_knowledge", placeholder: "Belgelerinde ara…"},
    },
    {
        id: "automation", label: "OTOMASYON",
        icon: ic("M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"),
        sources: [
            {title: "Koşullu Otomasyonlar", tool: "list_automations"},
            {title: "Makrolar", tool: "list_macros"},
            {title: "Rutinler", tool: "routine_list"},
        ],
        empty: "Tanımlı otomasyon, makro veya rutin yok.",
    },
    {
        id: "learning", label: "ÖĞRENME",
        icon: ic("M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5"),
        sources: [
            {title: "Hedefler", tool: "goal_list", args: {status: "all"}},
            {title: "Okuma Listesi", tool: "reading_list", args: {status: "all"}},
        ],
        empty: "Hedef veya okuma öğesi yok.",
    },
    {
        id: "persona", label: "KİŞİLİK",
        icon: ic("M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"),
        sources: [{tool: "get_persona"}, {title: "Mevcut Kişilikler", tool: "list_personas"}],
        empty: "Kişilik bilgisi yok.",
    },
    {
        id: "plugins", label: "PLUGİNLER",
        icon: ic("M6 3v6M18 3v6M6 9h12v3a6 6 0 0 1-12 0V9ZM12 18v3"),
        sources: [{tool: "list_plugins"}],
        empty: "Yüklü plugin yok.",
        search: {tool: "plugin_search", placeholder: "Plugin ara (GitHub)…"},
    },
];

export default function DomainPanel({open, onClose, accent}: {open: boolean; onClose: () => void; accent: string}) {
    const [tab, setTab] = useState<TabId>("tasks");
    const [blocks, setBlocks] = useState<{title?: string; text: string}[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [searchOut, setSearchOut] = useState<string | null>(null);

    const def = TABS.find((t) => t.id === tab)!;

    const load = useCallback(async (d: TabDef) => {
        setLoading(true); setSearchOut(null); setQuery("");
        try {
            const out: {title?: string; text: string}[] = [];
            for (const s of d.sources) {
                const raw = await window.jarvis.runTool(s.tool, s.args);
                out.push({title: s.title, text: String(raw).trim()});
            }
            setBlocks(out);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { if (open) load(def); }, [open, tab, def, load]);

    useEffect(() => {
        if (!open) return;
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [open, onClose]);

    const runSearch = async () => {
        if (!def.search || !query.trim()) { setSearchOut(null); return; }
        const raw = await window.jarvis.runTool(def.search.tool, {query: query.trim()});
        setSearchOut(String(raw));
    };

    const doAction = async (line: string) => {
        if (!def.action) return;
        const m = line.match(def.action.match);
        if (!m) return;
        await window.jarvis.runTool(def.action.tool, {[def.action.argKey]: m[1]});
        load(def);
    };

    if (!open) return null;
    const ac = `rgb(${accent})`;

    // Bir blok metnini satırlara böl; boş ve ayraç satırlarını ele.
    const renderBlock = (text: string, withAction: boolean) => {
        const empty = !text || /yok\.|bulunamadı|Henüz/i.test(text) && text.length < 60;
        if (empty) return <div className="text-[11px] py-2" style={{color: `rgba(${accent},0.4)`}}>{text || def.empty}</div>;
        // Çok-satırlı bloklar (görev kayıtları boş satırla ayrılır)
        const items = text.split(/\n\s*\n/).filter((s) => s.trim());
        return (
            <div className="space-y-1.5">
                {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg group"
                        style={{background: `rgba(${accent},0.04)`, border: `1px solid rgba(${accent},0.1)`}}>
                        <pre className="flex-1 text-[11px] leading-snug whitespace-pre-wrap font-sans m-0" style={{color: `rgba(${accent},0.88)`}}>{item.trim()}</pre>
                        {withAction && def.action && def.action.match.test(item) && (
                            <button onClick={() => doAction(item)} title={def.action.label}
                                className={`opacity-0 group-hover:opacity-100 transition grid place-items-center w-4 h-4 rounded shrink-0 mt-0.5 ${def.action.danger ? "hover:text-red-400" : "hover:brightness-125"}`}
                                style={{color: `rgba(${accent},0.5)`}}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Zm3-3h6l1 2H8l1-2Z"/></svg>
                            </button>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)"}} onClick={onClose}>
            <div className="w-full max-w-2xl h-[80vh] rounded-2xl flex flex-col overflow-hidden"
                style={{background: "var(--bg-deep, #060a12)", border: `1px solid rgba(${accent},0.3)`, boxShadow: `0 0 40px rgba(${accent},0.15)`}}
                onClick={(e) => e.stopPropagation()}>
                {/* Başlık */}
                <div className="flex items-center gap-2 px-5 py-3.5" style={{borderBottom: `1px solid rgba(${accent},0.15)`}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="2" strokeLinecap="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>
                    <span className="text-[13px] font-semibold tracking-wide" style={{color: ac}}>KOMUT MERKEZİ</span>
                    <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100 transition" style={{color: ac}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>
                    </button>
                </div>
                {/* Sekmeler */}
                <div className="flex gap-1 px-3 py-2 overflow-x-auto" style={{borderBottom: `1px solid rgba(${accent},0.1)`}}>
                    {TABS.map((tb) => (
                        <button key={tb.id} onClick={() => setTab(tb.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-wider whitespace-nowrap transition"
                            style={{
                                background: tab === tb.id ? `rgba(${accent},0.15)` : "transparent",
                                border: `1px solid ${tab === tb.id ? `rgba(${accent},0.3)` : "transparent"}`,
                                color: tab === tb.id ? ac : `rgba(${accent},0.5)`,
                            }}>
                            {tb.icon}{tb.label}
                        </button>
                    ))}
                </div>
                {/* Arama (varsa) */}
                {def.search && (
                    <div className="px-5 pt-3 pb-1">
                        <div className="flex gap-2">
                            <input value={query} onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                                placeholder={def.search.placeholder}
                                className="flex-1 px-3 py-2 rounded-lg text-[12px] outline-none"
                                style={{background: `rgba(${accent},0.06)`, border: `1px solid rgba(${accent},0.2)`, color: ac}} />
                            <button onClick={runSearch} className="px-3 rounded-lg text-[11px] font-medium transition hover:brightness-125"
                                style={{background: `rgba(${accent},0.15)`, border: `1px solid rgba(${accent},0.3)`, color: ac}}>ARA</button>
                        </div>
                        {searchOut && (
                            <pre className="mt-2 px-3 py-2 rounded-lg text-[11px] whitespace-pre-wrap leading-relaxed font-sans"
                                style={{background: `rgba(${accent},0.04)`, border: `1px solid rgba(${accent},0.12)`, color: `rgba(${accent},0.85)`}}>{searchOut}</pre>
                        )}
                    </div>
                )}
                {/* İçerik */}
                <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
                    {loading ? (
                        <div className="text-[11px] py-6 text-center" style={{color: `rgba(${accent},0.4)`}}>Yükleniyor…</div>
                    ) : blocks.map((b, i) => (
                        <div key={i}>
                            {b.title && <div className="text-[9px] tracking-[0.2em] mb-1.5" style={{color: `rgba(${accent},0.45)`}}>{b.title.toUpperCase()}</div>}
                            {renderBlock(b.text, !!def.action)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
