export type Lang = "tr" | "en" | "de" | "fr" | "es";

export interface LangStrings {
    processing: string;
    listening: string;
    waitingVoice: string;
    idle: string;
}

export const UI: Record<Lang, LangStrings> = {
    tr: {
        processing: "JARVIS işliyor…",
        listening: "Dinliyorum, efendim…",
        waitingVoice: "Sesli komut bekleniyor…",
        idle: "Komutunuzu verin, efendim…",
    },
    en: {
        processing: "AEGIS processing…",
        listening: "Listening, sir…",
        waitingVoice: "Waiting for voice command…",
        idle: "Give your command, sir…",
    },
    de: {
        processing: "AEGIS verarbeitet…",
        listening: "Ich höre, Sir…",
        waitingVoice: "Warte auf Sprachbefehl…",
        idle: "Ihr Befehl, Sir…",
    },
    fr: {
        processing: "AEGIS traite…",
        listening: "J'écoute, Monsieur…",
        waitingVoice: "En attente d'une commande vocale…",
        idle: "Votre commande, Monsieur…",
    },
    es: {
        processing: "AEGIS procesando…",
        listening: "Escuchando, señor…",
        waitingVoice: "Esperando comando de voz…",
        idle: "Su orden, señor…",
    },
};

export const LANG_DEFAULT_VOICE: Record<Lang, string> = {
    tr: "tr-TR-EmelNeural",
    en: "en-US-AriaNeural",
    de: "de-DE-KatjaNeural",
    fr: "fr-FR-DeniseNeural",
    es: "es-ES-ElviraNeural",
};
