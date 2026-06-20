// AEGIS — Mod Seçim Ekranı (Faz 30.4, 30.8 çok dilli, Faz 64 yeni tasarım)

import type {OnboardingStrings} from "../i18n";
import {Shell, Body, Heading, C, ac, muted, LinkButton} from "./onboarding/ui";

interface Props {
    t: OnboardingStrings;
    step?: number;
    totalSteps?: number;
    onSelect: (mode: "trial" | "own") => void;
    onBack?: () => void;
}

export default function ModeSelectScreen({t, step, totalSteps, onSelect, onBack}: Props) {
    return (
        <Shell step={step} totalSteps={totalSteps}>
            <Body>
                <Heading title={t.welcome} subtitle={t.welcomeSub} />

                <div className="flex flex-col gap-3.5">
                    {/* Hızlı Başlangıç — önerilen */}
                    <ModeCard
                        recommended={t.recommended}
                        title={t.quickStart}
                        desc={t.quickStartDesc}
                        onClick={() => onSelect("trial")}
                        icon={
                            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
                        }
                    />
                    {/* Gelişmiş Kurulum */}
                    <ModeCard
                        title={t.advanced}
                        desc={t.advancedDesc}
                        onClick={() => onSelect("own")}
                        icon={
                            <>
                                <circle cx="8" cy="15" r="4" />
                                <path d="m10.85 12.15 8.15-8.15M18 5l2 2M15 8l2 2" strokeLinecap="round" strokeLinejoin="round" />
                            </>
                        }
                    />
                </div>

                {onBack && (
                    <div className="flex justify-center">
                        <LinkButton onClick={onBack}>‹ {t.back}</LinkButton>
                    </div>
                )}
            </Body>
        </Shell>
    );
}

function ModeCard({
    title, desc, onClick, icon, recommended,
}: {
    title: string;
    desc: string;
    onClick: () => void;
    icon: React.ReactNode;
    recommended?: string;
}) {
    return (
        <button
            onClick={onClick}
            className="group text-left rounded-2xl border p-4 transition-all duration-200 active:scale-[0.99] hover:bg-white/[0.04]"
            style={{
                borderColor: recommended ? `rgba(${C.accent},0.4)` : `rgba(${C.line},0.16)`,
                background: recommended ? `rgba(${C.accent},0.05)` : "rgba(255,255,255,0.02)",
            }}
        >
            <div className="flex items-start gap-3.5">
                <div
                    className="w-10 h-10 rounded-xl grid place-items-center shrink-0 transition"
                    style={{
                        background: recommended ? `linear-gradient(135deg, rgba(${C.accent},0.22), rgba(${C.accent2},0.22))` : "rgba(255,255,255,0.04)",
                        border: `1px solid rgba(${C.line},0.14)`,
                    }}
                >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={`rgb(${C.accent})`} strokeWidth="1.7">{icon}</svg>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[15px] font-semibold" style={{color: ac}}>{title}</span>
                        {recommended && (
                            <span className="text-[9.5px] font-semibold tracking-wider px-2 py-0.5 rounded-full"
                                style={{background: `linear-gradient(135deg, rgb(${C.accent}), rgb(${C.accent2}))`, color: "#0a0e17"}}>
                                {recommended}
                            </span>
                        )}
                    </div>
                    <p className="text-[12.5px] leading-relaxed" style={{color: muted}}>{desc}</p>
                </div>
            </div>
        </button>
    );
}
