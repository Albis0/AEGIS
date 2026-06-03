import {SectionLabel} from "../shared";
import type {SettingsStrings} from "../../../i18n";

interface Props {
    accent: string;
    ac: string;
    s: SettingsStrings;
}

interface Shortcut {
    keys: string[];
    label: string;
    category: string;
}

const SHORTCUTS: Shortcut[] = [
    // Navigation
    {keys: ["Ctrl", "Space"], label: "Komut paleti aç",             category: "Navigasyon"},
    {keys: ["Esc"],           label: "Konuşmayı durdur / kapat",    category: "Navigasyon"},
    {keys: ["F11"],           label: "Tam ekran geç",               category: "Navigasyon"},
    // Voice
    {keys: ["M"],             label: "Mikrofon modu değiştir",      category: "Ses"},
    // Chat
    {keys: ["Enter"],         label: "Mesaj gönder",                category: "Sohbet"},
    {keys: ["Shift","Enter"], label: "Yeni satır (metin girişinde)", category: "Sohbet"},
];

const CATEGORIES = [...new Set(SHORTCUTS.map((s) => s.category))];

function Kbd({label, accent, ac}: {label: string; accent: string; ac: string}) {
    return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-medium min-w-[28px]"
            style={{
                color: ac,
                background: `rgba(${accent},0.1)`,
                border: `1px solid rgba(${accent},0.25)`,
                boxShadow: `0 1px 0 rgba(${accent},0.15)`,
                fontFamily: "'JetBrains Mono', monospace",
            }}>
            {label}
        </span>
    );
}

export default function ShortcutsTab({accent, ac, s}: Props) {
    return (
        <div className="space-y-7">
            {CATEGORIES.map((cat) => (
                <div key={cat}>
                    <SectionLabel label={cat.toUpperCase()} accent={accent} />
                    <div className="space-y-1.5">
                        {SHORTCUTS.filter((s) => s.category === cat).map((s, i) => (
                            <div key={i}
                                className="flex items-center justify-between px-4 py-3 rounded-xl"
                                style={{border: `1px solid rgba(${accent},0.07)`, background: `rgba(${accent},0.02)`}}>
                                <span className="text-[13px]" style={{color: `rgba(${accent},0.65)`}}>{s.label}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    {s.keys.map((k, ki) => (
                                        <span key={ki} className="flex items-center gap-1">
                                            <Kbd label={k} accent={accent} ac={ac} />
                                            {ki < s.keys.length - 1 && (
                                                <span className="text-[10px]" style={{color: `rgba(${accent},0.3)`}}>+</span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="rounded-xl p-4" style={{background: `rgba(${accent},0.04)`, border: `1px solid rgba(${accent},0.1)`}}>
                <p className="text-[11px] leading-relaxed" style={{color: `rgba(${accent},0.4)`}}>
                    {s.scHint}
                </p>
            </div>
        </div>
    );
}
