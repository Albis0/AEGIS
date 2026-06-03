// AEGIS — Onboarding akışı (Faz 30.4 + 30.8 çok dilli)
// İlk açılış state machine'i:
//   lang-select → mode-select → (trial: auth zorunlu) | (own: setup + opsiyonel auth)
// Bitince main process'e "onboarding tamam" bildirir ve uygulama başlar.

import {useState} from "react";
import ModeSelectScreen from "./ModeSelectScreen";
import AuthScreen from "./AuthScreen";
import SetupScreen from "./SetupScreen";
import {ONBOARDING, LANG_NAMES, type Lang} from "../i18n";

type Step = "lang" | "mode" | "trial-auth" | "own-setup" | "own-auth";

const CYAN = "34,211,238";
const ac = `rgb(${CYAN})`;
const LANGS: Lang[] = ["tr", "en", "de", "fr", "es"];

export default function Onboarding() {
    const [step, setStep] = useState<Step>("lang");
    const [lang, setLang] = useState<Lang>("tr");
    const t = ONBOARDING[lang];

    async function chooseLang(l: Lang) {
        setLang(l);
        await window.jarvis.settingsSet({language: l});
        setStep("mode");
    }

    async function finishTrial() {
        await window.jarvis.settingsSet({aiMode: "trial"});
        await window.jarvis.onboardingComplete("trial");
    }

    async function finishOwnSetup() {
        await window.jarvis.settingsSet({aiMode: "own"});
        setStep("own-auth");
    }

    async function finishOwn() {
        await window.jarvis.onboardingComplete("own");
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
