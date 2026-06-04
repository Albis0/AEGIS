import {useEffect, useState} from "react";
import type {AppSettings} from "../../../electron.d";
import {SectionLabel, Hint} from "../shared";
import type {SettingsStrings} from "../../../i18n";

interface Props {
    accent: string;
    ac: string;
    settings: AppSettings;
    onApply: (patch: Partial<AppSettings>) => void;
    s: SettingsStrings;
}

interface Usage {
    signedIn: boolean;
    usedRequests: number; usedTokens: number;
    limitRequests: number; limitTokens: number;
}

export default function AccountTab({accent, ac, settings, onApply, s}: Props) {
    const [user, setUser] = useState<{userId: string; email?: string} | null>(null);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [loading, setLoading] = useState(true);
    const isTrial = settings.aiMode === "trial";

    useEffect(() => {
        Promise.all([window.jarvis.authCurrentUser(), window.jarvis.usageGet()])
            .then(([u, us]) => { setUser(u); setUsage(us); })
            .finally(() => setLoading(false));
    }, []);

    async function handleSignOut() {
        await window.jarvis.authSignOut();
        setUser(null);
        setUsage(null);
    }

    async function handleAuthed(u: {userId: string; email?: string}) {
        setUser(u);
        const us = await window.jarvis.usageGet().catch(() => null);
        setUsage(us);
    }

    const card = {background: `rgba(${accent},0.04)`, border: `1px solid rgba(${accent},0.12)`};

    return (
        <div className="space-y-5">
            <SectionLabel label={s.accSection} accent={accent} />

            <div className="rounded-xl p-4 space-y-3" style={card}>
                <Row label={s.accMode} ac={ac} value={isTrial ? s.accTrial : s.accAdvanced} />
                <Row label={s.accEmail} ac={ac}
                    value={loading ? "…" : user?.email ?? s.accSignInHint} />
            </div>

            {/* ── Giriş yapılmamışsa inline auth formu ── */}
            {!loading && !user && (
                <InlineAuth accent={accent} ac={ac} s={s} onAuthed={handleAuthed} />
            )}

            {/* ── Kota (trial + giriş yapılmışsa) ── */}
            {isTrial && (
                <>
                    <SectionLabel label={s.accQuota} accent={accent} />
                    <div className="rounded-xl p-4 space-y-3" style={card}>
                        {usage?.signedIn ? (
                            <>
                                <Quota label={s.accRequests} used={usage.usedRequests} limit={usage.limitRequests} accent={accent} ac={ac} />
                                <Quota label={s.accTokens} used={usage.usedTokens} limit={usage.limitTokens} accent={accent} ac={ac} />
                                <Hint accent={accent}>{s.accQuotaHint}</Hint>
                            </>
                        ) : (
                            <Hint accent={accent}>{s.accSignInHint}</Hint>
                        )}
                    </div>
                </>
            )}

            {/* ── Cloud sync (giriş yapılmışsa) ── */}
            {user && (
                <>
                    <SectionLabel label={s.accSync} accent={accent} />
                    <div className="rounded-xl p-4 space-y-3" style={card}>
                        <div className="flex items-center justify-between">
                            <span className="text-[12.5px]" style={{color: ac, opacity: 0.8}}>{s.accSyncHint.split(".")[0]}</span>
                            <button
                                onClick={() => onApply({cloudSync: !(settings.cloudSync ?? true)})}
                                className="shrink-0 w-11 h-6 rounded-full relative transition-all"
                                style={{
                                    background: (settings.cloudSync ?? true) ? `rgba(${accent},0.45)` : `rgba(${accent},0.08)`,
                                    border: `1px solid ${(settings.cloudSync ?? true) ? `rgba(${accent},0.6)` : `rgba(${accent},0.2)`}`,
                                }}
                            >
                                <span className="absolute top-1 w-4 h-4 rounded-full transition-all"
                                    style={{
                                        background: (settings.cloudSync ?? true) ? `rgb(${accent})` : `rgba(${accent},0.3)`,
                                        left: (settings.cloudSync ?? true) ? "calc(100% - 18px)" : "2px",
                                    }} />
                            </button>
                        </div>
                        <Hint accent={accent}>{s.accSyncHint}</Hint>
                    </div>
                </>
            )}

            {/* ── Çıkış yap ── */}
            {user && (
                <button
                    onClick={handleSignOut}
                    className="text-[12px] px-4 py-2 rounded-lg border transition hover:brightness-125"
                    style={{color: "#f87171", borderColor: "rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.05)"}}
                >
                    {s.accSignOut}
                </button>
            )}

            {/* ── Onboarding yeniden başlat ── */}
            <div>
                <SectionLabel label={s.accRestartOnboarding.toUpperCase()} accent={accent} />
                <div className="rounded-xl p-4 space-y-3" style={card}>
                    <p className="text-[11px] leading-relaxed" style={{color: `rgba(${accent},0.4)`}}>
                        {s.accRestartOnboardingHint}
                    </p>
                    <button
                        onClick={() => window.jarvis.restartOnboarding()}
                        className="text-[11px] px-4 py-2 rounded-lg border tracking-widest transition hover:brightness-125"
                        style={{color: `rgba(${accent},0.6)`, borderColor: `rgba(${accent},0.2)`, background: `rgba(${accent},0.04)`}}
                    >
                        {s.accRestartOnboarding.toUpperCase()} ›
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Inline Auth Form ────────────────────────────────────────────────────────

interface AuthProps {
    accent: string;
    ac: string;
    s: SettingsStrings;
    onAuthed: (u: {userId: string; email?: string}) => void;
}

function InlineAuth({accent, ac, s, onAuthed}: AuthProps) {
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function submit() {
        if (!email.trim() || !password.trim()) return;
        if (password.length < 6) { setError(s.accFormPasswordHint); return; }
        setError("");
        setBusy(true);
        try {
            const res = mode === "signup"
                ? await window.jarvis.authSignUp(email.trim(), password)
                : await window.jarvis.authSignIn(email.trim(), password);
            if (!res.ok) { setError(res.error ?? s.accAuthError); setBusy(false); return; }
            onAuthed({userId: res.userId ?? "", email: res.email ?? email.trim()});
        } catch (e) {
            setError((e as Error).message ?? s.accAuthError);
            setBusy(false);
        }
    }

    const inputStyle = {
        borderColor: `rgba(${accent},0.2)`,
        color: ac,
    };

    return (
        <div className="rounded-xl p-4 space-y-4"
            style={{background: `rgba(${accent},0.03)`, border: `1px solid rgba(${accent},0.12)`}}>
            <p className="text-[11px] tracking-[0.2em] font-medium" style={{color: `rgba(${accent},0.5)`}}>
                {mode === "signin" ? s.accSignIn.toUpperCase() : s.accSignUp.toUpperCase()}
            </p>

            <div className="space-y-2">
                <div>
                    <p className="text-[10px] tracking-[0.25em] mb-1" style={{color: `rgba(${accent},0.4)`}}>{s.accFormEmail}</p>
                    <input
                        type="email" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ornek@mail.com"
                        className="w-full bg-transparent rounded-lg px-3 py-2 text-[12px] outline-none border transition"
                        style={inputStyle}
                    />
                </div>
                <div>
                    <p className="text-[10px] tracking-[0.25em] mb-1" style={{color: `rgba(${accent},0.4)`}}>{s.accFormPassword}</p>
                    <input
                        type="password" value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                        placeholder={s.accFormPasswordHint}
                        className="w-full bg-transparent rounded-lg px-3 py-2 text-[12px] outline-none border transition"
                        style={inputStyle}
                    />
                </div>
            </div>

            {error && (
                <p className="text-[11px] px-3 py-2 rounded-lg"
                    style={{color: "#f87171", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)"}}>
                    {error}
                </p>
            )}

            <div className="flex items-center gap-2">
                <button
                    onClick={submit} disabled={busy}
                    className="flex-1 py-2 rounded-lg text-[11px] tracking-widest border transition hover:brightness-125 disabled:opacity-40"
                    style={{color: ac, borderColor: `rgba(${accent},0.35)`, background: `rgba(${accent},0.1)`}}
                >
                    {busy ? "…" : mode === "signin" ? s.accSignInBtn : s.accSignUpBtn}
                </button>
            </div>

            <button
                onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
                className="text-[10px] opacity-50 hover:opacity-80 transition underline"
                style={{color: ac}}
            >
                {mode === "signin" ? s.accNoAccount : s.accHaveAccount}
            </button>
        </div>
    );
}

// ── helpers ─────────────────────────────────────────────────────────────────

function Row({label, value, ac}: {label: string; value: string; ac: string}) {
    return (
        <div className="flex items-center justify-between text-[12.5px]">
            <span style={{color: ac, opacity: 0.55}}>{label}</span>
            <span style={{color: ac}}>{value}</span>
        </div>
    );
}

function Quota({label, used, limit, accent, ac}: {label: string; used: number; limit: number; accent: string; ac: string}) {
    const pct = Math.min(100, Math.round((used / limit) * 100));
    const danger = pct >= 90;
    const warn = pct >= 70;
    const color = danger ? "248,113,113" : warn ? "245,185,60" : accent;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
                <span style={{color: ac, opacity: 0.6}}>{label}</span>
                <span className="tabular-nums" style={{color: `rgb(${color})`}}>
                    {used.toLocaleString()} / {limit.toLocaleString()}
                </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{background: `rgba(${accent},0.12)`}}>
                <div className="h-full rounded-full transition-[width] duration-500"
                    style={{width: `${pct}%`, background: `rgb(${color})`}} />
            </div>
        </div>
    );
}
