//! Localisation — user-facing strings in five languages.
//!
//! # Design
//!
//! Strings live in one table keyed by a `Key` enum, not by free-form string
//! IDs. The compiler then guarantees every language covers every key: adding
//! a key without translating it is a compile error, not a runtime `???`.
//!
//! The old project stored translations in a 1,172-line TypeScript object with
//! string keys — a missing key surfaced as `undefined` at runtime, in front of
//! the user.
//!
//! # What is *not* localised
//!
//! Tool names and descriptions stay in English. They are read by the model,
//! not the user, and translating them would fragment tool selection across
//! languages.

use serde::{Deserialize, Serialize};

/// Supported interface languages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Lang {
    #[default]
    En,
    Tr,
    De,
    Fr,
    Es,
}

impl Lang {
    pub const ALL: [Lang; 5] = [Self::En, Self::Tr, Self::De, Self::Fr, Self::Es];

    /// Two-letter code used in config files and API requests.
    pub fn code(self) -> &'static str {
        match self {
            Self::En => "en",
            Self::Tr => "tr",
            Self::De => "de",
            Self::Fr => "fr",
            Self::Es => "es",
        }
    }

    /// Name of the language *in that language* — how a picker should show it.
    pub fn native_name(self) -> &'static str {
        match self {
            Self::En => "English",
            Self::Tr => "Türkçe",
            Self::De => "Deutsch",
            Self::Fr => "Français",
            Self::Es => "Español",
        }
    }

    /// Parses a language code. Unknown codes fall back to English rather
    /// than failing — a bad config value must not block startup.
    pub fn parse(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "en" | "english" | "ingilizce" => Some(Self::En),
            "tr" | "turkish" | "türkçe" | "turkce" => Some(Self::Tr),
            "de" | "german" | "deutsch" | "almanca" => Some(Self::De),
            "fr" | "french" | "français" | "francais" | "fransızca" => Some(Self::Fr),
            "es" | "spanish" | "español" | "espanol" | "ispanyolca" => Some(Self::Es),
            _ => None,
        }
    }

    /// Language name the model should answer in.
    pub fn model_name(self) -> &'static str {
        match self {
            Self::En => "English",
            Self::Tr => "Turkish",
            Self::De => "German",
            Self::Fr => "French",
            Self::Es => "Spanish",
        }
    }
}

/// Every user-facing string in the app.
///
/// Adding a variant here forces a translation in all five languages —
/// that is the point.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Key {
    // Startup
    Ready,
    NoApiKey,
    TryLocal,
    HelpHint,
    HistoryRestored,

    // Status
    Thinking,
    Listening,
    Speaking,
    WaitingReply,
    TypeSomething,

    // Chat
    EmptyResponse,
    PreviousStillRunning,
    SpeechInterrupted,
    HistoryCleared,
    MemoryKept,

    // Keys & providers
    KeySaved,
    NoKeysStored,
    KeysStored,
    UnknownProvider,
    ProviderOptions,
    ModelSet,
    FetchingModels,
    NoModelsFound,
    ModelCount,

    // Errors
    ErrInvalidKey,
    ErrRateLimit,
    ErrModelNotFound,
    ErrRequestTooLong,
    ErrTimeout,
    ErrNoConnection,
    ErrConfigSave,

    // Voice
    VoiceOff,
    VoiceContinuous,
    VoiceWakeWord,
    VoiceNeedsKey,
    MicFailed,
    ListeningNow,
    SpeechNotRecognised,

    // Approval dialog
    ApprovalNeeded,
    ApprovalIrreversible,
    ApprovalBudget,
    Allow,
    AllowAlways,
    Deny,
    UserDenied,

    // Settings
    SettingsRestartNeeded,
    UnknownSetting,
    InvalidLanguage,
    InvalidFontSize,
    InvalidWindowMode,

    // Automation
    AutomationFired,
    AutomationSkippedBusy,

    // Health panel
    HealthTitle,
    HealthVersion,
    HealthProvider,
    HealthModel,
    HealthKeys,
    HealthTools,
    HealthHistory,
    HealthMemory,
    HealthAutomations,
    HealthVoice,
    HealthDataDir,
    HealthNone,
}

/// Returns the translated string for a key.
pub fn t(lang: Lang, key: Key) -> &'static str {
    use Key::*;
    use Lang::*;

    match (lang, key) {
        // ── Startup ──────────────────────────────────────────────────────
        (En, Ready) => "ready.",
        (Tr, Ready) => "hazır.",
        (De, Ready) => "bereit.",
        (Fr, Ready) => "prêt.",
        (Es, Ready) => "listo.",

        (En, NoApiKey) => "no API key — use /key <provider> <key>",
        (Tr, NoApiKey) => "API anahtarı yok — /key <sağlayıcı> <anahtar>",
        (De, NoApiKey) => "kein API-Schlüssel — /key <Anbieter> <Schlüssel>",
        (Fr, NoApiKey) => "pas de clé API — /key <fournisseur> <clé>",
        (Es, NoApiKey) => "sin clave API — /key <proveedor> <clave>",

        (En, TryLocal) => "to try without a key: /provider local",
        (Tr, TryLocal) => "anahtarsız denemek için: /provider local",
        (De, TryLocal) => "ohne Schlüssel testen: /provider local",
        (Fr, TryLocal) => "essayer sans clé : /provider local",
        (Es, TryLocal) => "probar sin clave: /provider local",

        (En, HelpHint) => "/help for commands · F1 for status",
        (Tr, HelpHint) => "/help komutlar · F1 durum",
        (De, HelpHint) => "/help Befehle · F1 Status",
        (Fr, HelpHint) => "/help commandes · F1 état",
        (Es, HelpHint) => "/help comandos · F1 estado",

        (En, HistoryRestored) => "messages restored from previous session",
        (Tr, HistoryRestored) => "mesaj önceki oturumdan yüklendi",
        (De, HistoryRestored) => "Nachrichten aus vorheriger Sitzung geladen",
        (Fr, HistoryRestored) => "messages restaurés de la session précédente",
        (Es, HistoryRestored) => "mensajes restaurados de la sesión anterior",

        // ── Status ───────────────────────────────────────────────────────
        (En, Thinking) => "thinking…",
        (Tr, Thinking) => "düşünüyor…",
        (De, Thinking) => "denkt nach…",
        (Fr, Thinking) => "réfléchit…",
        (Es, Thinking) => "pensando…",

        (En, Listening) => "listening",
        (Tr, Listening) => "dinliyor",
        (De, Listening) => "hört zu",
        (Fr, Listening) => "écoute",
        (Es, Listening) => "escuchando",

        (En, Speaking) => "speaking — ESC to stop",
        (Tr, Speaking) => "konuşuyor — ESC keser",
        (De, Speaking) => "spricht — ESC zum Stoppen",
        (Fr, Speaking) => "parle — ESC pour arrêter",
        (Es, Speaking) => "hablando — ESC para parar",

        (En, WaitingReply) => "waiting for reply…",
        (Tr, WaitingReply) => "cevap bekleniyor…",
        (De, WaitingReply) => "warte auf Antwort…",
        (Fr, WaitingReply) => "en attente de réponse…",
        (Es, WaitingReply) => "esperando respuesta…",

        (En, TypeSomething) => "type something…",
        (Tr, TypeSomething) => "bir şeyler yaz…",
        (De, TypeSomething) => "schreib etwas…",
        (Fr, TypeSomething) => "écrivez quelque chose…",
        (Es, TypeSomething) => "escribe algo…",

        // ── Chat ─────────────────────────────────────────────────────────
        (En, EmptyResponse) => "the model returned an empty response",
        (Tr, EmptyResponse) => "model boş cevap döndü",
        (De, EmptyResponse) => "das Modell gab eine leere Antwort zurück",
        (Fr, EmptyResponse) => "le modèle a renvoyé une réponse vide",
        (Es, EmptyResponse) => "el modelo devolvió una respuesta vacía",

        (En, PreviousStillRunning) => "previous reply still running — wait",
        (Tr, PreviousStillRunning) => "önceki cevap sürüyor — bekle",
        (De, PreviousStillRunning) => "vorherige Antwort läuft noch — warte",
        (Fr, PreviousStillRunning) => "réponse précédente en cours — attendez",
        (Es, PreviousStillRunning) => "respuesta anterior en curso — espera",

        (En, SpeechInterrupted) => "speech interrupted",
        (Tr, SpeechInterrupted) => "konuşma kesildi",
        (De, SpeechInterrupted) => "Sprache unterbrochen",
        (Fr, SpeechInterrupted) => "parole interrompue",
        (Es, SpeechInterrupted) => "habla interrumpida",

        (En, HistoryCleared) => "conversation cleared",
        (Tr, HistoryCleared) => "sohbet temizlendi",
        (De, HistoryCleared) => "Unterhaltung gelöscht",
        (Fr, HistoryCleared) => "conversation effacée",
        (Es, HistoryCleared) => "conversación borrada",

        (En, MemoryKept) => "(memory kept)",
        (Tr, MemoryKept) => "(hafıza korundu)",
        (De, MemoryKept) => "(Gedächtnis erhalten)",
        (Fr, MemoryKept) => "(mémoire conservée)",
        (Es, MemoryKept) => "(memoria conservada)",

        // ── Keys & providers ─────────────────────────────────────────────
        (En, KeySaved) => "key saved (encrypted)",
        (Tr, KeySaved) => "anahtar kaydedildi (şifreli)",
        (De, KeySaved) => "Schlüssel gespeichert (verschlüsselt)",
        (Fr, KeySaved) => "clé enregistrée (chiffrée)",
        (Es, KeySaved) => "clave guardada (cifrada)",

        (En, NoKeysStored) => "no keys stored",
        (Tr, NoKeysStored) => "kayıtlı anahtar yok",
        (De, NoKeysStored) => "keine Schlüssel gespeichert",
        (Fr, NoKeysStored) => "aucune clé enregistrée",
        (Es, NoKeysStored) => "no hay claves guardadas",

        (En, KeysStored) => "providers with keys:",
        (Tr, KeysStored) => "anahtarı olanlar:",
        (De, KeysStored) => "Anbieter mit Schlüssel:",
        (Fr, KeysStored) => "fournisseurs avec clé :",
        (Es, KeysStored) => "proveedores con clave:",

        (En, UnknownProvider) => "unknown provider",
        (Tr, UnknownProvider) => "bilinmeyen sağlayıcı",
        (De, UnknownProvider) => "unbekannter Anbieter",
        (Fr, UnknownProvider) => "fournisseur inconnu",
        (Es, UnknownProvider) => "proveedor desconocido",

        (En, ProviderOptions) => "options:",
        (Tr, ProviderOptions) => "seçenekler:",
        (De, ProviderOptions) => "Optionen:",
        (Fr, ProviderOptions) => "options :",
        (Es, ProviderOptions) => "opciones:",

        (En, ModelSet) => "model:",
        (Tr, ModelSet) => "model:",
        (De, ModelSet) => "Modell:",
        (Fr, ModelSet) => "modèle :",
        (Es, ModelSet) => "modelo:",

        (En, FetchingModels) => "fetching model list…",
        (Tr, FetchingModels) => "model listesi alınıyor…",
        (De, FetchingModels) => "Modellliste wird abgerufen…",
        (Fr, FetchingModels) => "récupération de la liste des modèles…",
        (Es, FetchingModels) => "obteniendo lista de modelos…",

        (En, NoModelsFound) => "no models found",
        (Tr, NoModelsFound) => "model bulunamadı",
        (De, NoModelsFound) => "keine Modelle gefunden",
        (Fr, NoModelsFound) => "aucun modèle trouvé",
        (Es, NoModelsFound) => "no se encontraron modelos",

        (En, ModelCount) => "models:",
        (Tr, ModelCount) => "model:",
        (De, ModelCount) => "Modelle:",
        (Fr, ModelCount) => "modèles :",
        (Es, ModelCount) => "modelos:",

        // ── Errors ───────────────────────────────────────────────────────
        (En, ErrInvalidKey) => "API key rejected. Update it with /key.",
        (Tr, ErrInvalidKey) => "API anahtarı geçersiz. /key ile güncelle.",
        (De, ErrInvalidKey) => "API-Schlüssel abgelehnt. Mit /key aktualisieren.",
        (Fr, ErrInvalidKey) => "Clé API refusée. Mettez-la à jour avec /key.",
        (Es, ErrInvalidKey) => "Clave API rechazada. Actualízala con /key.",

        (En, ErrRateLimit) => "Provider rate limit — wait a moment and retry.",
        (Tr, ErrRateLimit) => "Sağlayıcı hız sınırı — biraz bekleyip tekrar dene.",
        (De, ErrRateLimit) => "Anbieter-Ratenlimit — kurz warten und erneut versuchen.",
        (Fr, ErrRateLimit) => "Limite de débit — attendez un instant et réessayez.",
        (Es, ErrRateLimit) => "Límite de tasa — espera un momento y reinténtalo.",

        (En, ErrModelNotFound) => "Model not found. Use /models to list, /model to switch.",
        (Tr, ErrModelNotFound) => "Model bulunamadı. /models ile listele, /model ile değiştir.",
        (De, ErrModelNotFound) => {
            "Modell nicht gefunden. /models zum Auflisten, /model zum Wechseln."
        }
        (Fr, ErrModelNotFound) => "Modèle introuvable. /models pour lister, /model pour changer.",
        (Es, ErrModelNotFound) => "Modelo no encontrado. /models para listar, /model para cambiar.",

        (En, ErrRequestTooLong) => "Request too long — use /clear to reset the conversation.",
        (Tr, ErrRequestTooLong) => "İstek çok uzun — /clear ile geçmişi temizle.",
        (De, ErrRequestTooLong) => "Anfrage zu lang — mit /clear zurücksetzen.",
        (Fr, ErrRequestTooLong) => "Requête trop longue — utilisez /clear.",
        (Es, ErrRequestTooLong) => "Solicitud demasiado larga — usa /clear.",

        (En, ErrTimeout) => "Timed out — the provider did not respond.",
        (Tr, ErrTimeout) => "Zaman aşımı — sağlayıcı cevap vermedi.",
        (De, ErrTimeout) => "Zeitüberschreitung — der Anbieter antwortete nicht.",
        (Fr, ErrTimeout) => "Délai dépassé — le fournisseur n'a pas répondu.",
        (Es, ErrTimeout) => "Tiempo agotado — el proveedor no respondió.",

        (En, ErrNoConnection) => "Could not connect — check your internet or local server.",
        (Tr, ErrNoConnection) => "Bağlanılamadı — internet veya yerel sunucuyu kontrol et.",
        (De, ErrNoConnection) => "Keine Verbindung — Internet oder lokalen Server prüfen.",
        (Fr, ErrNoConnection) => "Connexion impossible — vérifiez internet ou le serveur local.",
        (Es, ErrNoConnection) => "Sin conexión — revisa internet o el servidor local.",

        (En, ErrConfigSave) => "could not save settings",
        (Tr, ErrConfigSave) => "ayar kaydedilemedi",
        (De, ErrConfigSave) => "Einstellungen konnten nicht gespeichert werden",
        (Fr, ErrConfigSave) => "impossible d'enregistrer les paramètres",
        (Es, ErrConfigSave) => "no se pudo guardar la configuración",

        // ── Voice ────────────────────────────────────────────────────────
        (En, VoiceOff) => "voice off",
        (Tr, VoiceOff) => "ses kapalı",
        (De, VoiceOff) => "Sprache aus",
        (Fr, VoiceOff) => "voix désactivée",
        (Es, VoiceOff) => "voz desactivada",

        (En, VoiceContinuous) => "listening continuously",
        (Tr, VoiceContinuous) => "sürekli dinliyor",
        (De, VoiceContinuous) => "hört durchgehend zu",
        (Fr, VoiceContinuous) => "écoute continue",
        (Es, VoiceContinuous) => "escucha continua",

        (En, VoiceWakeWord) => "waiting for wake word",
        (Tr, VoiceWakeWord) => "uyandırma kelimesi bekliyor",
        (De, VoiceWakeWord) => "wartet auf Weckwort",
        (Fr, VoiceWakeWord) => "attend le mot de réveil",
        (Es, VoiceWakeWord) => "esperando palabra de activación",

        (En, VoiceNeedsKey) => "speech recognition needs a Groq key — /key groq <key>",
        (Tr, VoiceNeedsKey) => "ses tanıma için Groq anahtarı gerekli — /key groq <anahtar>",
        (De, VoiceNeedsKey) => {
            "Spracherkennung braucht einen Groq-Schlüssel — /key groq <Schlüssel>"
        }
        (Fr, VoiceNeedsKey) => "la reconnaissance vocale nécessite une clé Groq — /key groq <clé>",
        (Es, VoiceNeedsKey) => {
            "el reconocimiento de voz necesita una clave Groq — /key groq <clave>"
        }

        (En, MicFailed) => "microphone could not be opened",
        (Tr, MicFailed) => "mikrofon açılamadı",
        (De, MicFailed) => "Mikrofon konnte nicht geöffnet werden",
        (Fr, MicFailed) => "impossible d'ouvrir le microphone",
        (Es, MicFailed) => "no se pudo abrir el micrófono",

        (En, ListeningNow) => "listening…",
        (Tr, ListeningNow) => "dinliyorum…",
        (De, ListeningNow) => "ich höre…",
        (Fr, ListeningNow) => "j'écoute…",
        (Es, ListeningNow) => "escuchando…",

        (En, SpeechNotRecognised) => "speech not recognised",
        (Tr, SpeechNotRecognised) => "ses tanınamadı",
        (De, SpeechNotRecognised) => "Sprache nicht erkannt",
        (Fr, SpeechNotRecognised) => "parole non reconnue",
        (Es, SpeechNotRecognised) => "habla no reconocida",

        // ── Approval ─────────────────────────────────────────────────────
        (En, ApprovalNeeded) => "approval needed",
        (Tr, ApprovalNeeded) => "onay gerekiyor",
        (De, ApprovalNeeded) => "Bestätigung erforderlich",
        (Fr, ApprovalNeeded) => "confirmation requise",
        (Es, ApprovalNeeded) => "se requiere aprobación",

        (En, ApprovalIrreversible) => "This action cannot be undone.",
        (Tr, ApprovalIrreversible) => "Bu işlem geri alınamaz.",
        (De, ApprovalIrreversible) => "Diese Aktion kann nicht rückgängig gemacht werden.",
        (Fr, ApprovalIrreversible) => "Cette action est irréversible.",
        (Es, ApprovalIrreversible) => "Esta acción no se puede deshacer.",

        (En, ApprovalBudget) => "Many destructive actions were already run in this turn.",
        (Tr, ApprovalBudget) => "Bu çalıştırmada çok sayıda yıkıcı işlem yapıldı.",
        (De, ApprovalBudget) => {
            "In diesem Durchlauf wurden bereits viele destruktive Aktionen ausgeführt."
        }
        (Fr, ApprovalBudget) => "De nombreuses actions destructrices ont déjà été exécutées.",
        (Es, ApprovalBudget) => "Ya se ejecutaron muchas acciones destructivas en este turno.",

        (En, Allow) => "Allow",
        (Tr, Allow) => "İzin ver",
        (De, Allow) => "Erlauben",
        (Fr, Allow) => "Autoriser",
        (Es, Allow) => "Permitir",

        (En, AllowAlways) => "Always allow",
        (Tr, AllowAlways) => "Hep izin ver",
        (De, AllowAlways) => "Immer erlauben",
        (Fr, AllowAlways) => "Toujours autoriser",
        (Es, AllowAlways) => "Permitir siempre",

        (En, Deny) => "Deny",
        (Tr, Deny) => "Reddet",
        (De, Deny) => "Ablehnen",
        (Fr, Deny) => "Refuser",
        (Es, Deny) => "Denegar",

        (En, UserDenied) => "The user denied this action.",
        (Tr, UserDenied) => "Kullanıcı bu işlemi reddetti.",
        (De, UserDenied) => "Der Benutzer hat diese Aktion abgelehnt.",
        (Fr, UserDenied) => "L'utilisateur a refusé cette action.",
        (Es, UserDenied) => "El usuario denegó esta acción.",

        // ── Settings ─────────────────────────────────────────────────────
        (En, SettingsRestartNeeded) => "(takes effect after restart)",
        (Tr, SettingsRestartNeeded) => "(yeniden başlatınca etkili olacak)",
        (De, SettingsRestartNeeded) => "(wird nach Neustart wirksam)",
        (Fr, SettingsRestartNeeded) => "(effectif après redémarrage)",
        (Es, SettingsRestartNeeded) => "(surte efecto tras reiniciar)",

        (En, UnknownSetting) => "unknown setting — use /settings to list",
        (Tr, UnknownSetting) => "bilinmeyen ayar — /ayarlar ile listele",
        (De, UnknownSetting) => "unbekannte Einstellung — /settings zum Auflisten",
        (Fr, UnknownSetting) => "paramètre inconnu — /settings pour lister",
        (Es, UnknownSetting) => "ajuste desconocido — /settings para listar",

        (En, InvalidLanguage) => "language must be one of: en, tr, de, fr, es",
        (Tr, InvalidLanguage) => "dil şunlardan biri olmalı: en, tr, de, fr, es",
        (De, InvalidLanguage) => "Sprache muss eine davon sein: en, tr, de, fr, es",
        (Fr, InvalidLanguage) => "la langue doit être : en, tr, de, fr, es",
        (Es, InvalidLanguage) => "el idioma debe ser: en, tr, de, fr, es",

        (En, InvalidFontSize) => "font size must be a number between 8 and 32",
        (Tr, InvalidFontSize) => "yazı tipi 8-32 arası bir sayı olmalı",
        (De, InvalidFontSize) => "Schriftgröße muss zwischen 8 und 32 liegen",
        (Fr, InvalidFontSize) => "la taille de police doit être entre 8 et 32",
        (Es, InvalidFontSize) => "el tamaño de fuente debe estar entre 8 y 32",

        (En, InvalidWindowMode) => "window mode: windowed · borderless · fullscreen",
        (Tr, InvalidWindowMode) => "pencere modu: windowed · borderless · fullscreen",
        (De, InvalidWindowMode) => "Fenstermodus: windowed · borderless · fullscreen",
        (Fr, InvalidWindowMode) => "mode fenêtre : windowed · borderless · fullscreen",
        (Es, InvalidWindowMode) => "modo ventana: windowed · borderless · fullscreen",

        // ── Automation ───────────────────────────────────────────────────
        (En, AutomationFired) => "automation",
        (Tr, AutomationFired) => "otomasyon",
        (De, AutomationFired) => "Automatisierung",
        (Fr, AutomationFired) => "automatisation",
        (Es, AutomationFired) => "automatización",

        (En, AutomationSkippedBusy) => "assistant busy — automation skipped:",
        (Tr, AutomationSkippedBusy) => "asistan meşgul — otomasyon atlandı:",
        (De, AutomationSkippedBusy) => "Assistent beschäftigt — Automatisierung übersprungen:",
        (Fr, AutomationSkippedBusy) => "assistant occupé — automatisation ignorée :",
        (Es, AutomationSkippedBusy) => "asistente ocupado — automatización omitida:",

        // ── Health panel ─────────────────────────────────────────────────
        (En, HealthTitle) => "system status",
        (Tr, HealthTitle) => "sistem durumu",
        (De, HealthTitle) => "Systemstatus",
        (Fr, HealthTitle) => "état du système",
        (Es, HealthTitle) => "estado del sistema",

        (En, HealthVersion) => "version",
        (Tr, HealthVersion) => "sürüm",
        (De, HealthVersion) => "Version",
        (Fr, HealthVersion) => "version",
        (Es, HealthVersion) => "versión",

        (En, HealthProvider) => "provider",
        (Tr, HealthProvider) => "sağlayıcı",
        (De, HealthProvider) => "Anbieter",
        (Fr, HealthProvider) => "fournisseur",
        (Es, HealthProvider) => "proveedor",

        (En, HealthModel) => "model",
        (Tr, HealthModel) => "model",
        (De, HealthModel) => "Modell",
        (Fr, HealthModel) => "modèle",
        (Es, HealthModel) => "modelo",

        (En, HealthKeys) => "keys",
        (Tr, HealthKeys) => "anahtarlar",
        (De, HealthKeys) => "Schlüssel",
        (Fr, HealthKeys) => "clés",
        (Es, HealthKeys) => "claves",

        (En, HealthTools) => "tools",
        (Tr, HealthTools) => "araçlar",
        (De, HealthTools) => "Werkzeuge",
        (Fr, HealthTools) => "outils",
        (Es, HealthTools) => "herramientas",

        (En, HealthHistory) => "history",
        (Tr, HealthHistory) => "geçmiş",
        (De, HealthHistory) => "Verlauf",
        (Fr, HealthHistory) => "historique",
        (Es, HealthHistory) => "historial",

        (En, HealthMemory) => "memory",
        (Tr, HealthMemory) => "hafıza",
        (De, HealthMemory) => "Gedächtnis",
        (Fr, HealthMemory) => "mémoire",
        (Es, HealthMemory) => "memoria",

        (En, HealthAutomations) => "automations",
        (Tr, HealthAutomations) => "otomasyonlar",
        (De, HealthAutomations) => "Automatisierungen",
        (Fr, HealthAutomations) => "automatisations",
        (Es, HealthAutomations) => "automatizaciones",

        (En, HealthVoice) => "voice",
        (Tr, HealthVoice) => "ses",
        (De, HealthVoice) => "Sprache",
        (Fr, HealthVoice) => "voix",
        (Es, HealthVoice) => "voz",

        (En, HealthDataDir) => "data directory",
        (Tr, HealthDataDir) => "veri dizini",
        (De, HealthDataDir) => "Datenverzeichnis",
        (Fr, HealthDataDir) => "répertoire de données",
        (Es, HealthDataDir) => "directorio de datos",

        (En, HealthNone) => "none",
        (Tr, HealthNone) => "yok",
        (De, HealthNone) => "keine",
        (Fr, HealthNone) => "aucune",
        (Es, HealthNone) => "ninguna",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every key must have a non-empty translation in every language.
    ///
    /// The compiler already guarantees coverage (the match is exhaustive);
    /// this catches accidental empty strings.
    #[test]
    fn every_key_is_translated_in_every_language() {
        // Listing keys explicitly — a new key added without a test entry is
        // still caught by the exhaustive match in `t()`.
        let keys = [
            Key::Ready,
            Key::NoApiKey,
            Key::TryLocal,
            Key::HelpHint,
            Key::HistoryRestored,
            Key::Thinking,
            Key::Listening,
            Key::Speaking,
            Key::WaitingReply,
            Key::TypeSomething,
            Key::EmptyResponse,
            Key::PreviousStillRunning,
            Key::SpeechInterrupted,
            Key::HistoryCleared,
            Key::MemoryKept,
            Key::KeySaved,
            Key::NoKeysStored,
            Key::KeysStored,
            Key::UnknownProvider,
            Key::ProviderOptions,
            Key::ModelSet,
            Key::FetchingModels,
            Key::NoModelsFound,
            Key::ModelCount,
            Key::ErrInvalidKey,
            Key::ErrRateLimit,
            Key::ErrModelNotFound,
            Key::ErrRequestTooLong,
            Key::ErrTimeout,
            Key::ErrNoConnection,
            Key::ErrConfigSave,
            Key::VoiceOff,
            Key::VoiceContinuous,
            Key::VoiceWakeWord,
            Key::VoiceNeedsKey,
            Key::MicFailed,
            Key::ListeningNow,
            Key::SpeechNotRecognised,
            Key::ApprovalNeeded,
            Key::ApprovalIrreversible,
            Key::ApprovalBudget,
            Key::Allow,
            Key::AllowAlways,
            Key::Deny,
            Key::UserDenied,
            Key::SettingsRestartNeeded,
            Key::UnknownSetting,
            Key::InvalidLanguage,
            Key::InvalidFontSize,
            Key::InvalidWindowMode,
            Key::AutomationFired,
            Key::AutomationSkippedBusy,
            Key::HealthTitle,
            Key::HealthVersion,
            Key::HealthProvider,
            Key::HealthModel,
            Key::HealthKeys,
            Key::HealthTools,
            Key::HealthHistory,
            Key::HealthMemory,
            Key::HealthAutomations,
            Key::HealthVoice,
            Key::HealthDataDir,
            Key::HealthNone,
        ];

        for lang in Lang::ALL {
            for key in keys {
                let text = t(lang, key);
                assert!(
                    !text.trim().is_empty(),
                    "{:?}/{key:?} is empty",
                    lang.code()
                );
            }
        }
    }

    #[test]
    fn language_codes_are_unique_and_two_letters() {
        let mut codes: Vec<&str> = Lang::ALL.iter().map(|l| l.code()).collect();
        let before = codes.len();
        codes.sort_unstable();
        codes.dedup();

        assert_eq!(before, codes.len(), "duplicate language code");
        for code in codes {
            assert_eq!(code.len(), 2, "code {code} is not two letters");
        }
    }

    #[test]
    fn parsing_accepts_codes_and_names() {
        assert_eq!(Lang::parse("en"), Some(Lang::En));
        assert_eq!(Lang::parse("TR"), Some(Lang::Tr));
        assert_eq!(Lang::parse("Deutsch"), Some(Lang::De));
        assert_eq!(Lang::parse("français"), Some(Lang::Fr));
        assert_eq!(Lang::parse("español"), Some(Lang::Es));
    }

    #[test]
    fn parsing_rejects_unsupported_languages() {
        assert_eq!(Lang::parse("klingon"), None);
        assert_eq!(Lang::parse(""), None);
        assert_eq!(Lang::parse("ru"), None);
    }

    #[test]
    fn default_language_is_english() {
        // The repo and the app default to English; other languages are opt-in.
        assert_eq!(Lang::default(), Lang::En);
    }

    #[test]
    fn native_names_are_distinct() {
        let mut names: Vec<&str> = Lang::ALL.iter().map(|l| l.native_name()).collect();
        let before = names.len();
        names.sort_unstable();
        names.dedup();
        assert_eq!(before, names.len());
    }

    #[test]
    fn model_names_are_english_words() {
        // Sent to the model in the system prompt — must be English.
        for lang in Lang::ALL {
            let name = lang.model_name();
            assert!(name.is_ascii(), "{name} is not plain ASCII English");
        }
    }

    #[test]
    fn round_trip_through_code() {
        for lang in Lang::ALL {
            assert_eq!(Lang::parse(lang.code()), Some(lang));
        }
    }

    #[test]
    fn translations_differ_across_languages() {
        // A key that is identical everywhere is usually an untranslated stub.
        // "model" is legitimately the same in several languages, so we check
        // a phrase instead.
        let en = t(Lang::En, Key::ApprovalIrreversible);
        let tr = t(Lang::Tr, Key::ApprovalIrreversible);
        let de = t(Lang::De, Key::ApprovalIrreversible);
        assert_ne!(en, tr);
        assert_ne!(en, de);
        assert_ne!(tr, de);
    }
}
