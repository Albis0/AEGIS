// AEGIS — Onboarding akışı (Faz 30.4)
// İlk açılış state machine'i:
//   mode-select → (trial: auth zorunlu) | (own: setup + opsiyonel auth)
// Bitince main process'e "onboarding tamam" bildirir ve uygulama başlar.

import {useState} from "react";
import ModeSelectScreen from "./ModeSelectScreen";
import AuthScreen from "./AuthScreen";
import SetupScreen from "./SetupScreen";

type Step = "mode" | "trial-auth" | "own-setup" | "own-auth";

export default function Onboarding() {
    const [step, setStep] = useState<Step>("mode");

    // Deneme modu: aiMode=trial kaydet, auth zaten yapıldı → uygulamayı başlat
    async function finishTrial() {
        await window.jarvis.settingsSet({aiMode: "trial"});
        await window.jarvis.onboardingComplete("trial");
    }

    // Gelişmiş mod: SetupScreen kendi setupSave'ini çağırır; burada sadece
    // aiMode=own kaydedip auth adımına (opsiyonel) geçeriz.
    async function finishOwnSetup() {
        await window.jarvis.settingsSet({aiMode: "own"});
        setStep("own-auth");
    }

    async function finishOwn() {
        await window.jarvis.onboardingComplete("own");
    }

    if (step === "mode") {
        return <ModeSelectScreen onSelect={(m) => setStep(m === "trial" ? "trial-auth" : "own-setup")} />;
    }

    if (step === "trial-auth") {
        return (
            <AuthScreen
                subtitle="Deneme modu için bir hesap oluştur. Bu, günlük kullanımını takip etmek içindir."
                onAuthed={finishTrial}
                onBack={() => setStep("mode")}
            />
        );
    }

    if (step === "own-setup") {
        // SetupScreen kendi içinde setupSave yapıp window'u kapatmaya çalışıyordu;
        // onComplete callback'i ile akışı buraya bağlıyoruz (SetupScreen güncellendi).
        return <SetupScreen onComplete={finishOwnSetup} onBack={() => setStep("mode")} />;
    }

    // own-auth — opsiyonel
    return (
        <AuthScreen
            subtitle="İstersen giriş yap — ayarların ve API anahtarların cihazlar arasında senkronlanır. Ya da bu adımı atla."
            onAuthed={finishOwn}
            onSkip={finishOwn}
            onBack={() => setStep("own-setup")}
        />
    );
}
