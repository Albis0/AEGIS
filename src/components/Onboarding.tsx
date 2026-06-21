// AEGIS — Onboarding akışı (Faz 30.4 + 30.8 çok dilli, Faz 64 yeni tasarım)
// İlk açılış state machine'i:
//   lang-select → mode-select → (trial: auth zorunlu) | (own: setup + opsiyonel auth) → spotify-connect
// Bitince main process'e "onboarding tamam" bildirir ve uygulama başlar.

import {useState} from "react";
import ModeSelectScreen from "./ModeSelectScreen";
import AuthScreen from "./AuthScreen";
import SetupScreen from "./SetupScreen";
import {ONBOARDING, LANG_NAMES, type Lang} from "../i18n";
import {Shell, Body, Heading, C, ac, muted, PrimaryButton, GhostButton} from "./onboarding/ui";

type Step = "lang" | "mode" | "trial-auth" | "own-setup" | "own-auth" | "spotify-connect";

const LANGS: Lang[] = ["tr", "en", "de", "fr", "es"];

// Adım göstergesi için 0-indexli konum (akışa göre yaklaşık konum)
const STEP_INDEX: Record<Step, number> = {
    lang: 0, mode: 1, "trial-auth": 2, "own-setup": 2, "own-auth": 3, "spotify-connect": 3,
};
const TOTAL_STEPS = 4;

// Her dil için bayrak emoji + yerel ad
const LANG_FLAG: Record<Lang, string> = {tr: "🇹🇷", en: "🇬🇧", de: "🇩🇪", fr: "🇫🇷", es: "🇪🇸"};

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
        return <LangSelect lang={lang} onHover={setLang} onSelect={chooseLang} />;
    }

    if (step === "mode") {
        return <ModeSelectScreen t={t} step={STEP_INDEX.mode} totalSteps={TOTAL_STEPS} onSelect={(m) => setStep(m === "trial" ? "trial-auth" : "own-setup")} onBack={() => setStep("lang")} />;
    }

    if (step === "trial-auth") {
        return (
            <AuthScreen
                t={t}
                step={STEP_INDEX["trial-auth"]} totalSteps={TOTAL_STEPS}
                subtitle={t.trialAuthSub}
                onAuthed={finishTrial}
                onBack={() => setStep("mode")}
            />
        );
    }

    if (step === "own-setup") {
        return <SetupScreen step={STEP_INDEX["own-setup"]} totalSteps={TOTAL_STEPS} onComplete={finishOwnSetup} onBack={() => setStep("mode")} />;
    }

    if (step === "own-auth") {
        return (
            <AuthScreen
                t={t}
                step={STEP_INDEX["own-auth"]} totalSteps={TOTAL_STEPS}
                subtitle={t.ownAuthSub}
                onAuthed={finishOwn}
                onSkip={finishOwn}
                onBack={() => setStep("own-setup")}
            />
        );
    }

    return <SpotifyConnectScreen lang={lang} step={STEP_INDEX["spotify-connect"]} totalSteps={TOTAL_STEPS} onDone={finishOnboarding} />;
}

// ── Dil seçimi ───────────────────────────────────────────────────────────────
function LangSelect({lang, onHover, onSelect}: {lang: Lang; onHover: (l: Lang) => void; onSelect: (l: Lang) => void}) {
    return (
        <Shell step={0} totalSteps={TOTAL_STEPS}>
            <Body>
                <Heading title="AEGIS" subtitle="Dilini seç · Choose your language" />
                <div className="grid grid-cols-1 gap-2.5">
                    {LANGS.map((l) => (
                        <button
                            key={l}
                            onMouseEnter={() => onHover(l)}
                            onClick={() => onSelect(l)}
                            className="group flex items-center gap-3.5 rounded-xl border px-4 py-3.5 transition-all duration-200 active:scale-[0.99] hover:bg-white/5"
                            style={{
                                borderColor: l === lang ? `rgba(${C.accent},0.45)` : `rgba(${C.line},0.16)`,
                                background: l === lang ? `rgba(${C.accent},0.07)` : "rgba(255,255,255,0.02)",
                            }}
                        >
                            <span className="text-xl leading-none">{LANG_FLAG[l]}</span>
                            <span className="text-[14px] font-medium flex-1 text-left" style={{color: ac}}>{LANG_NAMES[l]}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                className="opacity-0 group-hover:opacity-100 transition" style={{color: `rgb(${C.accent})`}}>
                                <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    ))}
                </div>
            </Body>
        </Shell>
    );
}

// ── Spotify bağlama ──────────────────────────────────────────────────────────
const SPOTIFY_LABELS: Record<Lang, {title: string; desc: string; connect: string; skip: string; connecting: string; done: string; note: string}> = {
    tr: {title: "Spotify Bağla", desc: "Müzik kontrolü için Spotify hesabını bağlayabilirsin. İstersen şimdi atla, ayarlardan sonra da bağlayabilirsin.", connect: "Spotify'ı Bağla", skip: "Şimdilik atla", connecting: "Tarayıcı açılıyor…", done: "Bağlandı — Devam et", note: "Bağlantı için tarayıcı açılacak, giriş yaptıktan sonra buraya dön."},
    en: {title: "Connect Spotify", desc: "Connect your Spotify account for music control. You can skip now and connect later in settings.", connect: "Connect Spotify", skip: "Skip for now", connecting: "Opening browser…", done: "Connected — Continue", note: "A browser will open for authorization. Return here after signing in."},
    de: {title: "Spotify verbinden", desc: "Verbinde dein Spotify-Konto für Musiksteuerung. Du kannst es später in den Einstellungen verbinden.", connect: "Spotify verbinden", skip: "Jetzt überspringen", connecting: "Browser wird geöffnet…", done: "Verbunden — Weiter", note: "Ein Browser öffnet sich zur Autorisierung."},
    fr: {title: "Connecter Spotify", desc: "Connecte ton compte Spotify pour contrôler la musique. Tu peux le faire plus tard dans les paramètres.", connect: "Connecter Spotify", skip: "Ignorer", connecting: "Ouverture du navigateur…", done: "Connecté — Continuer", note: "Un navigateur s'ouvrira pour l'autorisation."},
    es: {title: "Conectar Spotify", desc: "Conecta tu cuenta de Spotify para controlar la música. Puedes hacerlo más tarde en ajustes.", connect: "Conectar Spotify", skip: "Omitir", connecting: "Abriendo navegador…", done: "Conectado — Continuar", note: "Se abrirá un navegador para la autorización."},
};

function SpotifyConnectScreen({lang, step, totalSteps, onDone}: {lang: Lang; step: number; totalSteps: number; onDone: () => void}) {
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
        <Shell step={step} totalSteps={totalSteps}>
            <Body>
                <div className="flex flex-col items-center text-center gap-5">
                    {/* Spotify ikonu — yumuşak yeşil halka */}
                    <div
                        className="w-16 h-16 rounded-2xl grid place-items-center transition-all duration-300"
                        style={{
                            background: status === "done" ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${status === "done" ? "rgba(34,197,94,0.4)" : `rgba(${C.line},0.16)`}`,
                        }}
                    >
                        {/* Resmi Spotify logosu — dolu yeşil daire + 3 dalga (simetrik, ortalı) */}
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="rgb(34,197,94)" aria-hidden>
                            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 1 1-.277-1.215c3.809-.871 7.077-.496 9.712 1.115a.623.623 0 0 1 .207.857Zm1.224-2.723a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 1 1-.452-1.492c3.632-1.102 8.147-.568 11.232 1.329a.78.78 0 0 1 .257 1.072Zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 1 1-.542-1.79c3.532-1.072 9.404-.865 13.115 1.337a.936.936 0 0 1-.955 1.609Z" />
                        </svg>
                    </div>
                    <Heading title={s.title} subtitle={s.desc} />
                </div>

                <div className="flex flex-col gap-3">
                    {status !== "done" ? (
                        <PrimaryButton onClick={connect} disabled={status === "connecting"}>
                            {status === "connecting" ? s.connecting : s.connect}
                        </PrimaryButton>
                    ) : (
                        <PrimaryButton onClick={onDone}>{s.done}</PrimaryButton>
                    )}
                    <GhostButton onClick={onDone}>{s.skip}</GhostButton>
                    {status === "idle" && (
                        <p className="text-[11.5px] text-center leading-relaxed mt-1" style={{color: muted, opacity: 0.7}}>{s.note}</p>
                    )}
                </div>
            </Body>
        </Shell>
    );
}
