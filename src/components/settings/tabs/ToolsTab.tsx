import {useState, useEffect} from "react";
import type {AppSettings} from "../../../electron.d";
import {SectionLabel, Hint, Toggle} from "../shared";
import type {SettingsStrings} from "../../../i18n";

// Faz CC-4 — skills list (packaged instruction sets). Loads via list_skills;
// output is "• /name — description" lines from the backend.
function SkillsSection({accent, ac, s}: {accent: string; ac: string; s: SettingsStrings}) {
    const [skills, setSkills] = useState<{name: string; desc: string}[]>([]);
    useEffect(() => {
        let alive = true;
        window.jarvis.runTool("list_skills").then((raw: string) => {
            if (!alive) return;
            const parsed = raw.split("\n").map((line) => {
                const m = line.match(/^•\s*\/([^\s]+)\s*—\s*(.*)$/);
                return m ? {name: m[1], desc: m[2].trim()} : null;
            }).filter(Boolean) as {name: string; desc: string}[];
            setSkills(parsed);
        }).catch(() => {});
        return () => { alive = false; };
    }, []);
    return (
        <div>
            <SectionLabel label={s.tlSkillsTitle} accent={accent} />
            <div className="space-y-1 mb-2">
                {skills.length === 0 ? (
                    <div className="text-[11px] py-1" style={{color: `rgba(${accent},0.45)`}}>—</div>
                ) : skills.map((sk) => (
                    <div key={sk.name} className="flex items-baseline gap-2 px-2.5 py-1.5 rounded-lg"
                        style={{background: `rgba(${accent},0.04)`, border: `1px solid rgba(${accent},0.1)`}}>
                        <span className="text-[11px] font-medium shrink-0" style={{color: ac}}>/{sk.name}</span>
                        <span className="text-[10px] leading-snug" style={{color: `rgba(${accent},0.6)`}}>{sk.desc}</span>
                    </div>
                ))}
            </div>
            <Hint accent={accent}>{s.tlSkillsHint}</Hint>
        </div>
    );
}

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

function buildTools(s: SettingsStrings): ToolInfo[] {
    return [
        // System
        {name: "run_command",      desc: s.tlDescRunCommand,      category: s.tlCatSystem,       icon: ">_"},
        {name: "read_file",        desc: s.tlDescReadFile,        category: s.tlCatSystem,       icon: "▤"},
        {name: "write_file",       desc: s.tlDescWriteFile,       category: s.tlCatSystem,       icon: "✎",  danger: true},
        {name: "list_dir",         desc: s.tlDescListDir,         category: s.tlCatSystem,       icon: "▦"},
        {name: "move_file",        desc: s.tlDescMoveFile,        category: s.tlCatSystem,       icon: "→",  danger: true},
        {name: "delete_file",      desc: s.tlDescDeleteFile,      category: s.tlCatSystem,       icon: "✕",  danger: true},
        {name: "bulk_rename",      desc: s.tlDescBulkRename,      category: s.tlCatSystem,       icon: "AB"},
        {name: "find_duplicates",  desc: s.tlDescFindDuplicates,  category: s.tlCatSystem,       icon: "◈"},
        // Web
        {name: "web_search",       desc: s.tlDescWebSearch,       category: s.tlCatWeb,          icon: "◎"},
        {name: "browse_url",       desc: s.tlDescBrowseUrl,       category: s.tlCatWeb,          icon: "↗"},
        // Memory
        {name: "remember_fact",    desc: s.tlDescRememberFact,    category: s.tlCatMemory,       icon: "◇"},
        {name: "recall_facts",     desc: s.tlDescRecallFacts,     category: s.tlCatMemory,       icon: "◈"},
        {name: "list_habits",      desc: s.tlDescListHabits,      category: s.tlCatMemory,       icon: "▤"},
        // Productivity
        {name: "set_reminder",     desc: s.tlDescSetReminder,     category: s.tlCatProductivity, icon: "◷"},
        {name: "create_task",      desc: s.tlDescCreateTask,      category: s.tlCatProductivity, icon: "✓"},
        {name: "take_screenshot",  desc: s.tlDescTakeScreenshot,  category: s.tlCatProductivity, icon: "◻"},
        // Data
        {name: "create_chart",     desc: s.tlDescCreateChart,     category: s.tlCatData,         icon: "▲"},
        {name: "calculate",        desc: s.tlDescCalculate,       category: s.tlCatData,         icon: "="},
        {name: "note_save",        desc: s.tlDescNoteSave,        category: s.tlCatData,         icon: "▷"},
    ];
}

export default function ToolsTab({accent, ac, settings, onApply, s}: Props) {
    const TOOLS = buildTools(s);
    const CATEGORIES = [...new Set(TOOLS.map((t) => t.category))];
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
                {s.tlIntro}
            </p>

            {/* ── Security section ── */}
            <div>
                <SectionLabel label={s.tlSecurityTitle} accent={accent} />
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
                                    {s.tlFullAccessLabel}
                                </span>
                                {fullPcAccess && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                                        style={{color: "rgba(248,113,113,0.8)", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)"}}>
                                        {s.tlActiveBadge}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] leading-relaxed"
                                style={{color: fullPcAccess ? "rgba(248,113,113,0.5)" : `rgba(${accent},0.38)`}}>
                                {s.tlFullAccessDesc}
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
                                    {s.tlWarningTitle}
                                </p>
                                <p className="text-[11px] leading-relaxed mb-3" style={{color: "rgba(248,113,113,0.6)"}}>
                                    {s.tlWarningBody}
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={confirmEnable}
                                        className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest transition hover:brightness-125"
                                        style={{
                                            background: "rgba(248,113,113,0.12)",
                                            border: "1px solid rgba(248,113,113,0.35)",
                                            color: "rgba(248,113,113,0.9)",
                                        }}>
                                        {s.tlConfirmEnable}
                                    </button>
                                    <button onClick={() => setPendingEnable(false)}
                                        className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest transition hover:brightness-110"
                                        style={{
                                            border: `1px solid rgba(${accent},0.15)`,
                                            color: `rgba(${accent},0.5)`,
                                        }}>
                                        {s.tlCancel}
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
                                            {s.tlDangerBadge}
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

            <SkillsSection accent={accent} ac={ac} s={s} />

            <Hint accent={accent}>
                {s.tlPluginHint}
            </Hint>
        </div>
    );
}
