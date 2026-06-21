// AEGIS — Auth Screen (Phase 30.4, 30.8 multilingual, Phase 64 new design)
// Email/password sign-up + sign-in. Mandatory in trial mode, "Skip" available in advanced mode.

import {useState} from "react";
import type {OnboardingStrings} from "../i18n";
import {Shell, Body, Heading, Field, PrimaryButton, ErrorBox, LinkButton, C} from "./onboarding/ui";

interface Props {
    t: OnboardingStrings;
    step?: number;
    totalSteps?: number;
    // optional: "Skip" is shown in advanced mode; hidden in mandatory (trial) mode
    onAuthed: () => void;
    onSkip?: () => void;
    onBack?: () => void;
    subtitle?: string;
}

export default function AuthScreen({t, step, totalSteps, onAuthed, onSkip, onBack, subtitle}: Props) {
    const [mode, setMode] = useState<"signin" | "signup">("signup");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function submit() {
        if (!email.trim() || !password.trim()) { setError(t.errEmailPass); return; }
        if (password.length < 6) { setError(t.errPassLen); return; }
        setError("");
        setBusy(true);
        try {
            const res = mode === "signup"
                ? await window.jarvis.authSignUp(email.trim(), password)
                : await window.jarvis.authSignIn(email.trim(), password);
            if (!res.ok) { setError(res.error ?? "Bir hata oluştu."); setBusy(false); return; }
            onAuthed();
        } catch (e) {
            setError((e as Error).message ?? "Bilinmeyen hata.");
            setBusy(false);
        }
    }

    return (
        <Shell step={step} totalSteps={totalSteps}>
            <Body>
                <Heading title={mode === "signup" ? t.createAccount : t.signIn} subtitle={subtitle} />

                <div className="space-y-4">
                    <Field label={t.email} type="email" value={email} onChange={setEmail} placeholder="ornek@mail.com" />
                    <Field label={t.password} type="password" value={password} onChange={setPassword} placeholder={t.passwordHint} onEnter={submit} />
                </div>

                {error && <ErrorBox>{error}</ErrorBox>}

                <div className="flex flex-col gap-3">
                    <PrimaryButton onClick={submit} disabled={busy}>
                        {busy ? "…" : mode === "signup" ? t.signUpBtn : t.signInBtn}
                    </PrimaryButton>

                    <div className="flex items-center justify-between pt-0.5">
                        <button
                            onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}
                            className="text-[12.5px] font-medium transition hover:opacity-100"
                            style={{color: `rgb(${C.accent})`, opacity: 0.9}}
                        >
                            {mode === "signup" ? t.haveAccount : t.noAccount}
                        </button>
                        <div className="flex gap-4">
                            {onBack && <LinkButton onClick={onBack}>{t.back}</LinkButton>}
                            {onSkip && <LinkButton onClick={onSkip}>{t.skip}</LinkButton>}
                        </div>
                    </div>
                </div>
            </Body>
        </Shell>
    );
}
