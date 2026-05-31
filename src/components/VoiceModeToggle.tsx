import type {VoiceMode} from "../hooks/useVoice";

interface Props {
    mode: VoiceMode;
    listening: boolean;
    activated: boolean;
    onToggle: () => void;
}

const NEXT: Record<VoiceMode, VoiceMode> = {off: "always-on", "always-on": "wake-word", "wake-word": "off"};

const LABEL: Record<VoiceMode, string> = {
    off: "MİK KAPALI",
    "always-on": "SÜREKLİ",
    "wake-word": "UYANDIRMA",
};

export default function VoiceModeToggle({mode, listening, activated, onToggle}: Props) {
    const isActive = mode !== "off";
    const dotPulse = (mode === "always-on" && listening) || (mode === "wake-word" && activated);

    return (
        <button
            onClick={onToggle}
            title={`Ses modu: ${LABEL[mode]} → ${LABEL[NEXT[mode]]}`}
            className="flex items-center gap-1.5 hover:brightness-125 transition select-none"
            style={{color: isActive ? "rgb(var(--hud))" : "rgba(var(--hud),0.35)"}}
        >
            <span
                className={`w-1.5 h-1.5 rounded-full ${dotPulse ? "flick" : ""}`}
                style={{
                    background: isActive ? "rgb(var(--hud))" : "rgba(var(--hud),0.3)",
                    boxShadow: isActive ? "0 0 6px rgb(var(--hud))" : "none",
                }}
            />
            <span className="text-[11px] tracking-[0.2em]">{mode === "wake-word" && activated ? '"JARVIS"' : LABEL[mode]}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{opacity: isActive ? 0.9 : 0.4}}>
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
            </svg>
        </button>
    );
}
