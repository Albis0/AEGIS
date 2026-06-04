// AEGIS — Onboarding akışı (Faz 30.4 + 30.8 çok dilli)
// İlk açılış state machine'i:
//   lang-select → mode-select → (trial: auth zorunlu) | (own: setup + opsiyonel auth) → spotify-connect
// Bitince main process'e "onboarding tamam" bildirir ve uygulama başlar.

import {useState} from "react";
import ModeSelectScreen from "./ModeSelectScreen";
import AuthScreen from "./AuthScreen";
import SetupScreen from "./SetupScreen";
import {ONBOARDING, LANG_NAMES, type Lang} from "../i18n";

type Step = "lang" | "mode" | "trial-auth" | "own-setup" | "own-auth" | "spotify-connect";

const CYAN = "34,211,238";
const ac = `rgb(${CYAN})`;
const LANGS: Lang[] = ["tr", "en", "de", "fr", "es"];

export default function Onboarding() {
    const [step, setStep] = useState<Step>("lang");
    const [lang, setLang] = useState<Lang>("tr");
    const [aiMode, setAiMode] = useState<"trial" | "own">("own");
    const t = ONBOARDING[lang];

    async function chooseLang(l: Lang) {
        setLang(l);
        await window.jarvis.settingsSet({language: l});
        setStep("mode");
    }

    async function finishTrial() {
        await window.jarvis.settingsSet({aiMode: "trial"});
        setAiMode("trial");
        setStep("spotify-connect");
    }

    async function finishOwnSetup() {
        await window.jarvis.settingsSet({aiMode: "own"});
        setAiMode("own");
        setStep("own-auth");
    }

    async function finishOwn() {
        setStep("spotify-connect");
    }

    async function finishOnboarding() {
        await window.jarvis.onboardingComplete(aiMode);
    }

    if (step === "lang") {
        return <LangSelect onSelect={chooseLang} />;
    }

    if (step === "mode") {
        return <ModeSelectScreen t={t} onSelect={(m) => setStep(m === "trial" ? "trial-auth" : "own-setup")} onBack={() => setStep("lang")} />;
    }

    if (step === "trial-auth") {
        return (
            <AuthScreen
                t={t}
                subtitle={t.trialAuthSub}
                onAuthed={finishTrial}
                onBack={() => setStep("mode")}
            />
        );
    }

    if (step === "own-setup") {
        return <SetupScreen onComplete={finishOwnSetup} onBack={() => setStep("mode")} />;
    }

    if (step === "own-auth") {
        return (
            <AuthScreen
                t={t}
                subtitle={t.ownAuthSub}
                onAuthed={finishOwn}
                onSkip={finishOwn}
                onBack={() => setStep("own-setup")}
            />
        );
    }

    return <SpotifyConnectScreen lang={lang} onDone={finishOnboarding} />;
}

function LangSelect({onSelect}: {onSelect: (l: Lang) => void}) {
    return (
        <div
            className="h-screen w-screen flex flex-col"
            style={{
                background: "#03060c",
                color: ac,
                fontFamily: "'JetBrains Mono', monospace",
                WebkitFontSmoothing: "antialiased",
            } as React.CSSProperties}
        >
            <div className="drag h-9 shrink-0 flex items-center justify-between px-5">
                <span className="text-[11px] tracking-[0.45em]" style={{fontFamily: "Orbitron, sans-serif", color: ac, opacity: 0.6}}>AEGIS</span>
                <button className="no-drag w-7 h-7 grid place-items-center opacity-40 hover:opacity-100 transition text-sm" style={{color: ac}} onClick={() => window.jarvis.close()}>✕</button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
                <div className="text-2xl" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>
                    Dil / Language
                </div>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    {LANGS.map((l) => (
                        <button
                            key={l}
                            onClick={() => onSelect(l)}
                            className="rounded-xl border py-3.5 text-[14px] tracking-wide transition hover:brightness-125"
                            style={{borderColor: `rgba(${CYAN},0.3)`, background: `rgba(${CYAN},0.05)`, color: ac}}
                        >
                            {LANG_NAMES[l]}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

const SPOTIFY_LABELS: Record<Lang, {title: string; desc: string; connect: string; skip: string; connecting: string; done: string; note: string}> = {
    tr: {title: "Spotify Bağla", desc: "Müzik kontrolü için Spotify hesabını bağlayabilirsin. İstersen şimdi atla, ayarlardan sonra da bağlayabilirsin.", connect: "Spotify Hesabını Bağla", skip: "Şimdi Atla", connecting: "Tarayıcı açılıyor...", done: "Bağlandı! Devam et →", note: "Bağlantı için tarayıcı açılacak, giriş yaptıktan sonra buraya dön."},
    en: {title: "Connect Spotify", desc: "Connect your Spotify account for music control. You can skip now and connect later in settings.", connect: "Connect Spotify Account", skip: "Skip for Now", connecting: "Opening browser...", done: "Connected! Continue →", note: "A browser will open for authorization. Return here after signing in."},
    de: {title: "Spotify verbinden", desc: "Verbinde dein Spotify-Konto für Musiksteuerung. Du kannst es später in den Einstellungen verbinden.", connect: "Spotify-Konto verbinden", skip: "Jetzt überspringen", connecting: "Browser wird geöffnet...", done: "Verbunden! Weiter →", note: "Ein Browser öffnet sich zur Autorisierung."},
    fr: {title: "Connecter Spotify", desc: "Connecte ton compte Spotify pour contrôler la musique. Tu peux le faire plus tard dans les paramètres.", connect: "Connecter le compte Spotify", skip: "Ignorer maintenant", connecting: "Ouverture du navigateur...", done: "Connecté ! Continuer →", note: "Un navigateur s'ouvrira pour l'autorisation."},
    es: {title: "Conectar Spotify", desc: "Conecta tu cuenta de Spotify para controlar la música. Puedes hacerlo más tarde en ajustes.", connect: "Conectar cuenta de Spotify", skip: "Omitir por ahora", connecting: "Abriendo navegador...", done: "Conectado! Continuar →", note: "Se abrirá un navegador para la autorización."},
};

function SpotifyConnectScreen({lang, onDone}: {lang: Lang; onDone: () => void}) {
    const [status, setStatus] = useState<"idle" | "connecting" | "done">("idle");
    const s = SPOTIFY_LABELS[lang] ?? SPOTIFY_LABELS.en;

    async function connect() {
        setStatus("connecting");
        try {
            await window.jarvis.spotifyAuthorize();
            setStatus("done");
        } catch {
            setStatus("idle");
        }
    }

    return (
        <div
            className="h-screen w-screen flex flex-col"
            style={{background: "#03060c", color: ac, fontFamily: "'JetBrains Mono', monospace", WebkitFontSmoothing: "antialiased"} as React.CSSProperties}
        >
            <div className="drag h-9 shrink-0 flex items-center justify-between px-5">
                <span className="text-[11px] tracking-[0.45em]" style={{fontFamily: "Orbitron, sans-serif", color: ac, opacity: 0.6}}>AEGIS · SPOTIFY</span>
                <button className="no-drag w-7 h-7 grid place-items-center opacity-40 hover:opacity-100 transition text-sm" style={{color: ac}} onClick={() => window.jarvis.close()}>✕</button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8 max-w-sm mx-auto w-full">
                {/* Spotify icon */}
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{opacity: 0.85}}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 11.5c2.5-1 5.5-1 8 0" />
                    <path d="M7 14.5c3-1.2 7-1.2 10 0" />
                    <path d="M9.5 17.5c2-.8 5-.8 7 0" />
                </svg>

                <div className="text-center space-y-3">
                    <div className="text-xl" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>{s.title}</div>
                    <p className="text-[12px] leading-relaxed" style={{color: ac, opacity: 0.55}}>{s.desc}</p>
                </div>

                {status === "idle" && (
                    <p className="text-[11px] text-center" style={{color: ac, opacity: 0.4}}>{s.note}</p>
                )}

                <div className="flex flex-col gap-3 w-full">
                    {status !== "done" ? (
                        <button
                            onClick={connect}
                            disabled={status === "connecting"}
                            className="w-full py-3 rounded-xl border text-[13px] tracking-[0.25em] disabled:opacity-40 transition hover:brightness-125"
                            style={{fontFamily: "Orbitron, sans-serif", color: ac, borderColor: `rgba(${CYAN},0.4)`, background: `rgba(${CYAN},0.08)`}}
                        >
                            {status === "connecting" ? s.connecting : s.connect}
                        </button>
                    ) : (
                        <button
                            onClick={onDone}
                            className="w-full py-3 rounded-xl border text-[13px] tracking-[0.25em] transition hover:brightness-125"
                            style={{fontFamily: "Orbitron, sans-serif", color: ac, borderColor: `rgba(${CYAN},0.6)`, background: `rgba(${CYAN},0.12)`}}
                        >
                            {s.done}
                        </button>
                    )}
                    <button
                        onClick={onDone}
                        className="w-full py-2.5 text-[12px] tracking-wider opacity-40 hover:opacity-70 transition"
                        style={{color: ac}}
                    >
                        {s.skip}
                    </button>
                </div>
            </div>
        </div>
    );
}
