// AEGIS — Kimlik Ekranı (Faz 30.4, 30.8 çok dilli)
// Email/şifre ile kayıt + giriş. Deneme modunda zorunlu, gelişmiş modda "Atla" var.

import {useState} from "react";
import type {OnboardingStrings} from "../i18n";

const CYAN = "34,211,238";
const ac = `rgb(${CYAN})`;
const border = `rgba(${CYAN},0.15)`;

interface Props {
    t: OnboardingStrings;
    // optional: gelişmiş modda "Atla" gösterilir; zorunlu (deneme) modda gizli
    onAuthed: () => void;
    onSkip?: () => void;
    onBack?: () => void;
    subtitle?: string;
}

export default function AuthScreen({t, onAuthed, onSkip, onBack, subtitle}: Props) {
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
                <span className="text-[11px] tracking-[0.45em]" style={{fontFamily: "Orbitron, sans-serif", color: ac, opacity: 0.6}}>
                    AEGIS · {mode === "signup" ? t.createAccount.toUpperCase() : t.signIn.toUpperCase()}
                </span>
                <button
                    className="no-drag w-7 h-7 grid place-items-center opacity-40 hover:opacity-100 transition text-sm"
                    style={{color: ac}}
                    onClick={() => window.jarvis.close()}
                >✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6 max-w-md w-full mx-auto">
                <div>
                    <div className="text-2xl" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>
                        {mode === "signup" ? t.createAccount : t.signIn}
                    </div>
                    {subtitle && (
                        <p className="text-[12px] mt-2 leading-relaxed" style={{color: ac, opacity: 0.5}}>{subtitle}</p>
                    )}
                </div>

                <div className="space-y-4">
                    <Field label={t.email} type="email" value={email} onChange={setEmail} placeholder="ornek@mail.com" />
                    <Field label={t.password} type="password" value={password} onChange={setPassword} placeholder={t.passwordHint}
                        onEnter={submit} />
                </div>

                {error && (
                    <div className="text-[12px] px-4 py-2.5 rounded-lg"
                        style={{color: "#f87171", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.25)"}}>
                        {error}
                    </div>
                )}

                <button
                    onClick={submit}
                    disabled={busy}
                    className="w-full py-3 rounded-xl border text-[13px] tracking-[0.3em] disabled:opacity-40 transition hover:brightness-125"
                    style={{fontFamily: "Orbitron, sans-serif", color: ac, borderColor: `rgba(${CYAN},0.4)`, background: `rgba(${CYAN},0.07)`}}
                >
                    {busy ? "..." : mode === "signup" ? t.signUpBtn : t.signInBtn}
                </button>

                <div className="flex items-center justify-between text-[11px]">
                    <button
                        onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}
                        className="opacity-60 hover:opacity-100 transition underline"
                        style={{color: ac}}
                    >
                        {mode === "signup" ? t.haveAccount : t.noAccount}
                    </button>
                    <div className="flex gap-3">
                        {onBack && (
                            <button onClick={onBack} className="opacity-40 hover:opacity-100 transition" style={{color: ac}}>{t.back}</button>
                        )}
                        {onSkip && (
                            <button onClick={onSkip} className="opacity-40 hover:opacity-100 transition" style={{color: ac}}>{t.skip}</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({label, type, value, onChange, placeholder, onEnter}: {
    label: string; type: string; value: string;
    onChange: (v: string) => void; placeholder: string; onEnter?: () => void;
}) {
    return (
        <div className="space-y-1.5">
            <span className="text-[11px] tracking-[0.25em]" style={{color: `rgba(${CYAN},0.6)`}}>{label}</span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
                placeholder={placeholder}
                className="w-full bg-transparent rounded-lg px-3 py-2.5 text-[13px] outline-none border transition"
                style={{borderColor: value ? `rgba(${CYAN},0.4)` : border, color: ac}}
            />
        </div>
    );
}
