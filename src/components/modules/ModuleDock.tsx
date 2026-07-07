// Home-screen module pool (Phase 34.2) — optional widgets the user enables in
// Settings → Appearance. Rendered as a collapsible dock on the right edge,
// above whatever skin is active; all colors come from the --hud CSS variable
// so it follows every skin family and accent automatically.
//
// Strings live in this file (MODULE_T) instead of the big LangStrings catalog:
// the dock is self-contained and its labels are only used here and in the
// settings toggle list, which imports moduleInfo() from this file.

import type React from "react";
import {useState, useEffect, useRef, useCallback} from "react";
import type {Telemetry} from "../../electron.d";
import type {Lang} from "../../i18n";
import SpotifyWidget from "../SpotifyWidget";

export type HomeModule = "clock" | "quickActions" | "notes" | "suggestions" | "nowPlaying" | "sparklines";

export const ALL_HOME_MODULES: HomeModule[] = ["clock", "quickActions", "notes", "suggestions", "nowPlaying", "sparklines"];

interface ModuleStrings {
    dockTitle: string;
    dockHint: string;
    clockLabel: string; clockSub: string;
    quickLabel: string; quickSub: string;
    notesLabel: string; notesSub: string; notesPlaceholder: string;
    suggestionsLabel: string; suggestionsSub: string;
    nowPlayingLabel: string; nowPlayingSub: string;
    sparklinesLabel: string; sparklinesSub: string;
    qaScreenshot: string; qaSystemReport: string; qaCleanup: string; qaBriefing: string;
    sgIdeas: string[];
}

const MODULE_T: Record<Lang, ModuleStrings> = {
    tr: {
        dockTitle: "MODÜLLER",
        dockHint: "Ana ekranda sağ kenardan açılan modül paneli. Seçtiklerin tüm temalarda görünür.",
        clockLabel: "Saat", clockSub: "Saat ve tarih",
        quickLabel: "Hızlı komutlar", quickSub: "Tek tıkla sık komutlar",
        notesLabel: "Notlar", notesSub: "Kalıcı karalama alanı",
        notesPlaceholder: "Not al…",
        suggestionsLabel: "Öneri çipleri", suggestionsSub: "Hazır istem önerileri",
        nowPlayingLabel: "Şimdi çalıyor", nowPlayingSub: "Spotify denetimi",
        sparklinesLabel: "Telemetri grafiği", sparklinesSub: "CPU/RAM mini geçmiş",
        qaScreenshot: "Ekranı analiz et", qaSystemReport: "Sistem raporu", qaCleanup: "Disk temizliği", qaBriefing: "Günlük brifing",
        sgIdeas: ["Bugün hava nasıl?", "Yapılacaklar listemi özetle", "Spotify'da müzik aç", "Bana bir haber özeti ver"],
    },
    en: {
        dockTitle: "MODULES",
        dockHint: "A module panel that slides out from the right edge of the home screen. Your picks show on every skin.",
        clockLabel: "Clock", clockSub: "Time and date",
        quickLabel: "Quick actions", quickSub: "Frequent commands, one click",
        notesLabel: "Notes", notesSub: "Persistent scratchpad",
        notesPlaceholder: "Take a note…",
        suggestionsLabel: "Suggestion chips", suggestionsSub: "Ready-made prompt ideas",
        nowPlayingLabel: "Now playing", nowPlayingSub: "Spotify controls",
        sparklinesLabel: "Telemetry sparklines", sparklinesSub: "CPU/RAM mini history",
        qaScreenshot: "Analyze my screen", qaSystemReport: "System report", qaCleanup: "Disk cleanup", qaBriefing: "Daily briefing",
        sgIdeas: ["What's the weather today?", "Summarize my to-do list", "Play some music on Spotify", "Give me a news summary"],
    },
    de: {
        dockTitle: "MODULE",
        dockHint: "Ein Modulpanel, das am rechten Rand des Startbildschirms ausklappt. Ihre Auswahl gilt für alle Skins.",
        clockLabel: "Uhr", clockSub: "Uhrzeit und Datum",
        quickLabel: "Schnellaktionen", quickSub: "Häufige Befehle per Klick",
        notesLabel: "Notizen", notesSub: "Dauerhafter Notizblock",
        notesPlaceholder: "Notiz schreiben…",
        suggestionsLabel: "Vorschlags-Chips", suggestionsSub: "Fertige Prompt-Ideen",
        nowPlayingLabel: "Läuft gerade", nowPlayingSub: "Spotify-Steuerung",
        sparklinesLabel: "Telemetrie-Verlauf", sparklinesSub: "CPU/RAM-Miniverlauf",
        qaScreenshot: "Bildschirm analysieren", qaSystemReport: "Systembericht", qaCleanup: "Datenträgerbereinigung", qaBriefing: "Tagesbriefing",
        sgIdeas: ["Wie ist das Wetter heute?", "Fasse meine To-do-Liste zusammen", "Spiel Musik auf Spotify", "Gib mir eine Nachrichtenübersicht"],
    },
    fr: {
        dockTitle: "MODULES",
        dockHint: "Un panneau de modules qui se déploie depuis le bord droit de l'écran d'accueil. Vos choix s'appliquent à tous les skins.",
        clockLabel: "Horloge", clockSub: "Heure et date",
        quickLabel: "Actions rapides", quickSub: "Commandes fréquentes en un clic",
        notesLabel: "Notes", notesSub: "Bloc-notes persistant",
        notesPlaceholder: "Prendre une note…",
        suggestionsLabel: "Suggestions", suggestionsSub: "Idées de requêtes prêtes",
        nowPlayingLabel: "En lecture", nowPlayingSub: "Contrôles Spotify",
        sparklinesLabel: "Courbes télémétrie", sparklinesSub: "Mini-historique CPU/RAM",
        qaScreenshot: "Analyser mon écran", qaSystemReport: "Rapport système", qaCleanup: "Nettoyage disque", qaBriefing: "Briefing du jour",
        sgIdeas: ["Quel temps fait-il aujourd'hui ?", "Résume ma liste de tâches", "Mets de la musique sur Spotify", "Donne-moi un résumé de l'actualité"],
    },
    es: {
        dockTitle: "MÓDULOS",
        dockHint: "Un panel de módulos que se despliega desde el borde derecho de la pantalla de inicio. Tu selección se aplica a todos los skins.",
        clockLabel: "Reloj", clockSub: "Hora y fecha",
        quickLabel: "Acciones rápidas", quickSub: "Comandos frecuentes con un clic",
        notesLabel: "Notas", notesSub: "Bloc de notas persistente",
        notesPlaceholder: "Escribe una nota…",
        suggestionsLabel: "Chips de sugerencias", suggestionsSub: "Ideas de peticiones listas",
        nowPlayingLabel: "Reproduciendo", nowPlayingSub: "Controles de Spotify",
        sparklinesLabel: "Gráficas de telemetría", sparklinesSub: "Minihistorial CPU/RAM",
        qaScreenshot: "Analiza mi pantalla", qaSystemReport: "Informe del sistema", qaCleanup: "Limpieza de disco", qaBriefing: "Resumen diario",
        sgIdeas: ["¿Qué tiempo hace hoy?", "Resume mi lista de tareas", "Pon música en Spotify", "Dame un resumen de noticias"],
    },
};

// Used by the settings toggle list (AppearanceTab).
export function moduleSection(lang: Lang): {title: string; hint: string} {
    const m = MODULE_T[lang] ?? MODULE_T.en;
    return {title: m.dockTitle, hint: m.dockHint};
}

export function moduleInfo(lang: Lang): Record<HomeModule, {label: string; sub: string}> {
    const m = MODULE_T[lang] ?? MODULE_T.en;
    return {
        clock:        {label: m.clockLabel,        sub: m.clockSub},
        quickActions: {label: m.quickLabel,        sub: m.quickSub},
        notes:        {label: m.notesLabel,        sub: m.notesSub},
        suggestions:  {label: m.suggestionsLabel,  sub: m.suggestionsSub},
        nowPlaying:   {label: m.nowPlayingLabel,   sub: m.nowPlayingSub},
        sparklines:   {label: m.sparklinesLabel,   sub: m.sparklinesSub},
    };
}

// ── Individual modules ───────────────────────────────────────────────────────

function ClockModule({locale}: {locale: string}) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <div className="text-center py-1">
            <div className="text-[26px] font-semibold tabular-nums tracking-wider" style={{color: "rgb(var(--hud))"}}>
                {now.toLocaleTimeString(locale, {hour: "2-digit", minute: "2-digit"})}
                <span className="text-[13px] opacity-50 ml-1">{now.toLocaleTimeString(locale, {second: "2-digit"})}</span>
            </div>
            <div className="text-[10px] mt-0.5 opacity-45" style={{color: "rgb(var(--hud))"}}>
                {now.toLocaleDateString(locale, {weekday: "long", day: "numeric", month: "long"})}
            </div>
        </div>
    );
}

function QuickActionsModule({m, onCommand}: {m: ModuleStrings; onCommand: (text: string) => void}) {
    const actions: {label: string; icon: React.ReactNode}[] = [
        {label: m.qaScreenshot, icon: <path d="M4 7h3l2-2h6l2 2h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>},
        {label: m.qaSystemReport, icon: <path d="M4 20V10m6 10V4m6 16v-7"/>},
        {label: m.qaCleanup, icon: <path d="M3 6h18M8 6V4h8v2m-9 4v8m5-8v8M5 6l1 14h12l1-14"/>},
        {label: m.qaBriefing, icon: <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m13.7-5.7 1.4-1.4M5.9 18.1l1.4-1.4m0-9.4L5.9 5.9m12.2 12.2-1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>},
    ];
    return (
        <div className="grid grid-cols-2 gap-1.5">
            {actions.map((a) => (
                <button key={a.label} onClick={() => onCommand(a.label)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition hover:brightness-125"
                    style={{background: "rgba(var(--hud),0.06)", border: "1px solid rgba(var(--hud),0.15)", color: "rgb(var(--hud))"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="shrink-0 opacity-70">{a.icon}</svg>
                    <span className="text-[10px] leading-tight">{a.label}</span>
                </button>
            ))}
        </div>
    );
}

const NOTES_KEY = "aegis-module-notes";

function NotesModule({placeholder}: {placeholder: string}) {
    const [text, setText] = useState(() => localStorage.getItem(NOTES_KEY) ?? "");
    const save = useCallback((v: string) => {
        setText(v);
        localStorage.setItem(NOTES_KEY, v);
    }, []);
    return (
        <textarea value={text} onChange={(e) => save(e.target.value)} placeholder={placeholder}
            rows={4} spellCheck={false}
            className="w-full resize-none rounded-lg px-2.5 py-2 text-[11px] leading-relaxed outline-none"
            style={{background: "rgba(var(--hud),0.05)", border: "1px solid rgba(var(--hud),0.15)", color: "rgb(var(--hud))"}} />
    );
}

function SuggestionsModule({m, onFill}: {m: ModuleStrings; onFill: (text: string) => void}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {m.sgIdeas.map((s) => (
                <button key={s} onClick={() => onFill(s)}
                    className="px-2.5 py-1.5 rounded-full text-[10px] transition hover:brightness-125"
                    style={{background: "rgba(var(--hud),0.06)", border: "1px solid rgba(var(--hud),0.18)", color: "rgba(var(--hud),0.85)"}}>
                    {s}
                </button>
            ))}
        </div>
    );
}

const SPARK_LEN = 40;

function Sparkline({values, label}: {values: number[]; label: string}) {
    const w = 200, h = 30;
    const pts = values.map((v, i) => `${(i / (SPARK_LEN - 1)) * w},${h - (Math.min(100, Math.max(0, v)) / 100) * h}`).join(" ");
    const last = values[values.length - 1] ?? 0;
    return (
        <div className="flex items-center gap-2">
            <span className="text-[9px] w-7 shrink-0 opacity-50" style={{color: "rgb(var(--hud))"}}>{label}</span>
            <svg viewBox={`0 0 ${w} ${h}`} className="flex-1 h-[30px]" preserveAspectRatio="none">
                <polyline points={pts} fill="none" stroke="rgba(var(--hud),0.75)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="text-[10px] w-9 text-right tabular-nums shrink-0" style={{color: "rgb(var(--hud))"}}>{Math.round(last)}%</span>
        </div>
    );
}

function SparklinesModule({tel}: {tel: Telemetry | null}) {
    // Rolling history is kept here (not in App) so the cost only exists while
    // the module is enabled and the dock is mounted.
    const cpuRef = useRef<number[]>(Array(SPARK_LEN).fill(0));
    const ramRef = useRef<number[]>(Array(SPARK_LEN).fill(0));
    const [, bump] = useState(0);
    useEffect(() => {
        if (!tel) return;
        cpuRef.current = [...cpuRef.current.slice(1), tel.cpu ?? 0];
        ramRef.current = [...ramRef.current.slice(1), tel.ram ?? 0];
        bump((n) => n + 1);
    }, [tel]);
    return (
        <div className="space-y-1.5">
            <Sparkline values={cpuRef.current} label="CPU" />
            <Sparkline values={ramRef.current} label="RAM" />
        </div>
    );
}

// ── Dock ─────────────────────────────────────────────────────────────────────

interface DockProps {
    modules: HomeModule[];
    lang: Lang;
    locale: string;
    tel: Telemetry | null;
    onCommand: (text: string) => void; // send straight to chat
    onFill: (text: string) => void;    // put into the input box
}

const OPEN_KEY = "aegis-module-dock-open";

function Section({title, children}: {title: string; children: React.ReactNode}) {
    return (
        <div>
            <div className="text-[8px] tracking-[0.3em] mb-1.5 opacity-40" style={{color: "rgb(var(--hud))"}}>{title}</div>
            {children}
        </div>
    );
}

export default function ModuleDock({modules, lang, locale, tel, onCommand, onFill}: DockProps) {
    const [open, setOpen] = useState(() => localStorage.getItem(OPEN_KEY) !== "0");
    const m = MODULE_T[lang] ?? MODULE_T.en;
    if (modules.length === 0) return null;
    const has = (x: HomeModule) => modules.includes(x);

    const toggle = () => {
        setOpen((o) => {
            localStorage.setItem(OPEN_KEY, o ? "0" : "1");
            return !o;
        });
    };

    return (
        <div className="fixed top-1/2 right-0 -translate-y-1/2 z-40 flex items-center pointer-events-none">
            {/* Edge tab */}
            <button onClick={toggle} title={m.dockTitle}
                className="pointer-events-auto w-5 h-16 rounded-l-lg grid place-items-center transition hover:brightness-150"
                style={{background: "rgba(4,7,13,0.92)", border: "1px solid rgba(var(--hud),0.3)", borderRight: "none", color: "rgb(var(--hud))"}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{transform: open ? "rotate(180deg)" : "none", transition: "transform .2s"}}>
                    <path d="M15 6l-6 6 6 6"/>
                </svg>
            </button>
            {/* Panel */}
            <div className="pointer-events-auto overflow-hidden transition-all duration-200"
                style={{width: open ? 252 : 0, opacity: open ? 1 : 0}}>
                <div className="w-[252px] max-h-[80vh] overflow-y-auto rounded-l-xl px-3.5 py-3 space-y-4"
                    style={{background: "rgba(4,7,13,0.92)", border: "1px solid rgba(var(--hud),0.3)", borderRight: "none", backdropFilter: "blur(8px)"}}>
                    {has("clock") && <ClockModule locale={locale} />}
                    {has("sparklines") && <Section title={m.sparklinesLabel.toUpperCase()}><SparklinesModule tel={tel} /></Section>}
                    {has("quickActions") && <Section title={m.quickLabel.toUpperCase()}><QuickActionsModule m={m} onCommand={onCommand} /></Section>}
                    {has("suggestions") && <Section title={m.suggestionsLabel.toUpperCase()}><SuggestionsModule m={m} onFill={onFill} /></Section>}
                    {has("notes") && <Section title={m.notesLabel.toUpperCase()}><NotesModule placeholder={m.notesPlaceholder} /></Section>}
                    {has("nowPlaying") && <Section title={m.nowPlayingLabel.toUpperCase()}><SpotifyWidget /></Section>}
                </div>
            </div>
        </div>
    );
}
