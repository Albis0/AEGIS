import {useState} from "react";
import type {AppSettings} from "../../../electron.d";
import {SectionLabel, Hint, Toggle} from "../shared";
import type {SettingsStrings} from "../../../i18n";

interface Props {
    accent: string;
    ac: string;
    settings: AppSettings;
    onApply: (patch: Partial<AppSettings>) => void;
    s: SettingsStrings;
}

interface ToolInfo {
    name: string;
    desc: string;
    category: string;
    icon: string;
    danger?: boolean;
}

const TOOLS: ToolInfo[] = [
    // System
    {name: "run_command",      desc: "Terminal komutu çalıştırır",                   category: "Sistem",    icon: ">_"},
    {name: "read_file",        desc: "Dosya içeriğini okur",                         category: "Sistem",    icon: "▤"},
    {name: "write_file",       desc: "Dosyaya içerik yazar (kapalıyken ev dizini)",  category: "Sistem",    icon: "✎",  danger: true},
    {name: "list_dir",         desc: "Dizin içeriğini listeler",                     category: "Sistem",    icon: "▦"},
    {name: "move_file",        desc: "Dosya/klasör taşır (Tam Erişim gerekli)",      category: "Sistem",    icon: "→",  danger: true},
    {name: "delete_file",      desc: "Dosya veya klasörü siler (Tam Erişim gerekli)",category: "Sistem",    icon: "✕",  danger: true},
    {name: "bulk_rename",      desc: "Regex ile toplu yeniden adlandırma",           category: "Sistem",    icon: "AB"},
    {name: "find_duplicates",  desc: "Yinelenen dosyaları bulur",                   category: "Sistem",    icon: "◈"},
    // Web
    {name: "web_search",       desc: "Web araması yapar (Tavily/Serper/DDG)",        category: "Web",       icon: "◎"},
    {name: "browse_url",       desc: "URL içeriğini scrape eder",                   category: "Web",       icon: "↗"},
    // Memory
    {name: "remember_fact",    desc: "Uzun süreli hafızaya not kaydeder",            category: "Hafıza",    icon: "◇"},
    {name: "recall_facts",     desc: "Hafızadan bilgi çeker",                        category: "Hafıza",    icon: "◈"},
    {name: "list_habits",      desc: "Kullanıcı alışkanlıklarını listeler",          category: "Hafıza",    icon: "▤"},
    // Productivity
    {name: "set_reminder",     desc: "Hatırlatıcı kurar",                            category: "Verimlilik",icon: "◷"},
    {name: "create_task",      desc: "Görev oluşturur",                              category: "Verimlilik",icon: "✓"},
    {name: "take_screenshot",  desc: "Ekran görüntüsü alır",                        category: "Verimlilik",icon: "◻"},
    // Data
    {name: "create_chart",     desc: "ASCII grafik oluşturur",                       category: "Veri",      icon: "▲"},
    {name: "calculate",        desc: "Matematiksel ifade hesaplar",                  category: "Veri",      icon: "="},
    {name: "note_save",        desc: "Markdown not kaydeder",                        category: "Veri",      icon: "▷"},
];

const CATEGORIES = [...new Set(TOOLS.map((t) => t.category))];

export default function ToolsTab({accent, ac, settings, onApply, s}: Props) {
    const [pendingEnable, setPendingEnable] = useState(false);
    const fullPcAccess = settings.fullPcAccess ?? false;
    const disabled = new Set(settings.disabledTools ?? []);

    function handleToggle() {
        if (!fullPcAccess) {
            setPendingEnable(true);
        } else {
            onApply({fullPcAccess: false});
        }
    }

    function confirmEnable() {
        onApply({fullPcAccess: true});
        setPendingEnable(false);
    }

    function toggleTool(name: string) {
        const next = new Set(disabled);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        onApply({disabledTools: [...next]});
    }

    return (
        <div className="space-y-7">
            <p className="text-[12px] leading-relaxed" style={{color: `rgba(${accent},0.4)`}}>
                AEGIS bu araçları kullanarak gerçek dünya görevlerini yerine getirir.
                Tehlikeli araçlar kırmızı ile işaretlenmiştir. Toggle ile her aracı ayrı ayrı açıp kapatabilirsin.
            </p>

            {/* ── Security section ── */}
            <div>
                <SectionLabel label="GÜVENLİK" accent={accent} />
                <div className="rounded-xl overflow-hidden"
                    style={{
                        border: `1px solid ${fullPcAccess ? "rgba(248,113,113,0.3)" : `rgba(${accent},0.1)`}`,
                        background: fullPcAccess ? "rgba(248,113,113,0.04)" : `rgba(${accent},0.02)`,
                    }}>
                    <div className="flex items-center gap-4 px-4 py-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[13px] font-medium"
                                    style={{color: fullPcAccess ? "rgba(248,113,113,0.9)" : `rgba(${accent},0.8)`}}>
                                    Tam PC Erişimi
                                </span>
                                {fullPcAccess && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                                        style={{color: "rgba(248,113,113,0.8)", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)"}}>
                                        AKTİF
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] leading-relaxed"
                                style={{color: fullPcAccess ? "rgba(248,113,113,0.5)" : `rgba(${accent},0.38)`}}>
                                Açıkken shutdown, format, disk silme dahil tüm komutlar onay istemeden çalışır.
                                delete_file ve move_file araçları aktif olur.
                            </p>
                        </div>
                        <Toggle
                            active={fullPcAccess}
                            onChange={handleToggle}
                            accent={fullPcAccess ? "248,113,113" : accent}
                        />
                    </div>

                    {pendingEnable && (
                        <div className="px-4 pb-4">
                            <div className="rounded-xl p-4"
                                style={{background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)"}}>
                                <p className="text-[11px] font-medium mb-1" style={{color: "rgba(248,113,113,0.9)"}}>
                                    ⚠ UYARI: Geri alınamaz işlemler
                                </p>
                                <p className="text-[11px] leading-relaxed mb-3" style={{color: "rgba(248,113,113,0.6)"}}>
                                    Bu mod açıldığında AI bilgisayarını yeniden başlatabilir,
                                    disk formatlayabilir ve dosyaları silebilir.
                                    Emin misiniz?
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={confirmEnable}
                                        className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest transition hover:brightness-125"
                                        style={{
                                            background: "rgba(248,113,113,0.12)",
                                            border: "1px solid rgba(248,113,113,0.35)",
                                            color: "rgba(248,113,113,0.9)",
                                        }}>
                                        EVET, ETKİNLEŞTİR
                                    </button>
                                    <button onClick={() => setPendingEnable(false)}
                                        className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest transition hover:brightness-110"
                                        style={{
                                            border: `1px solid rgba(${accent},0.15)`,
                                            color: `rgba(${accent},0.5)`,
                                        }}>
                                        İPTAL
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Tool list ── */}
            {CATEGORIES.map((cat) => (
                <div key={cat}>
                    <SectionLabel label={cat.toUpperCase()} accent={accent} />
                    <div className="space-y-1.5">
                        {TOOLS.filter((t) => t.category === cat).map((tool) => {
                            const isDisabled = disabled.has(tool.name);
                            return (
                                <div key={tool.name}
                                    className="flex items-center gap-3.5 px-4 py-3 rounded-xl transition-opacity"
                                    style={{
                                        background: isDisabled
                                            ? `rgba(${accent},0.01)`
                                            : tool.danger ? "rgba(248,113,113,0.04)" : `rgba(${accent},0.03)`,
                                        border: `1px solid ${isDisabled
                                            ? `rgba(${accent},0.04)`
                                            : tool.danger ? "rgba(248,113,113,0.12)" : `rgba(${accent},0.07)`}`,
                                        opacity: isDisabled ? 0.45 : 1,
                                    }}>
                                    <span className="text-[13px] font-mono w-6 text-center shrink-0 leading-none"
                                        style={{color: tool.danger ? "rgba(248,113,113,0.7)" : `rgba(${accent},0.35)`}}>{tool.icon}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[12px] font-mono font-medium"
                                            style={{color: isDisabled ? `rgba(${accent},0.3)` : tool.danger ? "rgba(248,113,113,0.8)" : ac}}>
                                            {tool.name}
                                        </span>
                                        <span className="block text-[11px] mt-0.5"
                                            style={{color: `rgba(${accent},0.3)`}}>{tool.desc}</span>
                                    </span>
                                    {tool.danger && !isDisabled && (
                                        <span className="text-[8px] px-1.5 py-0.5 rounded-full shrink-0 font-medium"
                                            style={{color: "rgba(248,113,113,0.8)", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)"}}>
                                            DİKKAT
                                        </span>
                                    )}
                                    <Toggle
                                        active={!isDisabled}
                                        onChange={() => toggleTool(tool.name)}
                                        accent={tool.danger && !isDisabled ? "248,113,113" : accent}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <Hint accent={accent}>
                Plugin sekmesinden ek araçlar yükleyebilirsin.
            </Hint>
        </div>
    );
}
