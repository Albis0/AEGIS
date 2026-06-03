export type Lang = "tr" | "en" | "de" | "fr" | "es";

export interface LangStrings {
    processing: string; listening: string; waitingVoice: string; idle: string;
    locale: string;
    send: string; stop: string; closeBtn: string; attachFile: string;
    tipHistory: string; tipSettings: string; tipMinimize: string; tipFullscreen: string; tipClose: string;
    conversation: string;
    stLive: string; stProc: string; stResp: string; stListen: string; stErr: string; stReady: string;
    empty1: string; empty2: string; empty3: string; emptyDash: string;
    secSystem: string; secWeather: string; wx: string; feelsLike: string; humidity: string; wConnecting: string; wLoading: string;
    ramUsed: string; ramFree: string; ramTotal: string;
    errLabel: string; vRun: string; vRead: string; vWrite: string; vList: string; vSearch: string;
    vmOff: string; vmAlways: string; vmWake: string; vmTitle: string;
}

export const UI: Record<Lang, LangStrings> = {
    tr: {
        processing: "JARVIS işliyor…", listening: "Dinliyorum, efendim…", waitingVoice: "Sesli komut bekleniyor…", idle: "Komutunuzu verin, efendim…",
        locale: "tr-TR",
        send: "GÖNDER", stop: "DURDUR", closeBtn: "KAPAT", attachFile: "Dosya ekle",
        tipHistory: "Konuşma geçmişi", tipSettings: "Ayarlar", tipMinimize: "Küçült", tipFullscreen: "Tam ekran (F11)", tipClose: "Kapat",
        conversation: "KONUŞMA",
        stLive: "CANLI", stProc: "İŞLENİYOR", stResp: "YANIT VERİYOR", stListen: "DİNLİYOR", stErr: "HATA", stReady: "HAZIR",
        empty1: "SYS: JARVIS çevrimiçi.", empty2: "SYS: Sistemler nominal.", empty3: "SYS: Emrinizi bekliyorum, efendim…", emptyDash: "Sistem hazır. Komut bekleniyor…",
        secSystem: "SİSTEM DURUMU", secWeather: "HAVA DURUMU", wx: "HAVA", feelsLike: "hissedilen", humidity: "nem", wConnecting: "bağlanılamadı", wLoading: "yükleniyor…",
        ramUsed: "KULLANILAN", ramFree: "BOŞ", ramTotal: "TOPLAM",
        errLabel: "HATA", vRun: "KOMUT YÜRÜTÜLÜYOR", vRead: "DOSYA OKUNUYOR", vWrite: "DOSYA YAZILIYOR", vList: "DİZİN TARANIYOR", vSearch: "AĞ TARANIYOR",
        vmOff: "MİK KAPALI", vmAlways: "SÜREKLİ", vmWake: "UYANDIRMA", vmTitle: "Ses modu",
    },
    en: {
        processing: "AEGIS processing…", listening: "Listening, sir…", waitingVoice: "Waiting for voice command…", idle: "Give your command, sir…",
        locale: "en-US",
        send: "SEND", stop: "STOP", closeBtn: "CLOSE", attachFile: "Attach file",
        tipHistory: "Chat history", tipSettings: "Settings", tipMinimize: "Minimize", tipFullscreen: "Fullscreen (F11)", tipClose: "Close",
        conversation: "CONVERSATION",
        stLive: "LIVE", stProc: "PROCESSING", stResp: "RESPONDING", stListen: "LISTENING", stErr: "ERROR", stReady: "READY",
        empty1: "SYS: JARVIS online.", empty2: "SYS: Systems nominal.", empty3: "SYS: Awaiting your command, sir…", emptyDash: "System ready. Awaiting command…",
        secSystem: "SYSTEM STATUS", secWeather: "WEATHER", wx: "WX", feelsLike: "feels like", humidity: "humidity", wConnecting: "can't connect", wLoading: "loading…",
        ramUsed: "USED", ramFree: "FREE", ramTotal: "TOTAL",
        errLabel: "ERROR", vRun: "RUNNING COMMAND", vRead: "READING FILE", vWrite: "WRITING FILE", vList: "LISTING DIR", vSearch: "SEARCHING WEB",
        vmOff: "MIC OFF", vmAlways: "ALWAYS-ON", vmWake: "WAKE WORD", vmTitle: "Voice mode",
    },
    de: {
        processing: "AEGIS verarbeitet…", listening: "Ich höre, Sir…", waitingVoice: "Warte auf Sprachbefehl…", idle: "Ihr Befehl, Sir…",
        locale: "de-DE",
        send: "SENDEN", stop: "STOPP", closeBtn: "SCHLIESSEN", attachFile: "Datei anhängen",
        tipHistory: "Verlauf", tipSettings: "Einstellungen", tipMinimize: "Minimieren", tipFullscreen: "Vollbild (F11)", tipClose: "Schließen",
        conversation: "GESPRÄCH",
        stLive: "LIVE", stProc: "VERARBEITUNG", stResp: "ANTWORTET", stListen: "HÖRT ZU", stErr: "FEHLER", stReady: "BEREIT",
        empty1: "SYS: JARVIS online.", empty2: "SYS: Systeme nominal.", empty3: "SYS: Erwarte Ihren Befehl, Sir…", emptyDash: "System bereit. Warte auf Befehl…",
        secSystem: "SYSTEMSTATUS", secWeather: "WETTER", wx: "WTR", feelsLike: "gefühlt", humidity: "Feuchte", wConnecting: "keine Verbindung", wLoading: "lädt…",
        ramUsed: "BELEGT", ramFree: "FREI", ramTotal: "GESAMT",
        errLabel: "FEHLER", vRun: "BEFEHL LÄUFT", vRead: "DATEI LESEN", vWrite: "DATEI SCHREIBEN", vList: "VERZEICHNIS", vSearch: "WEB-SUCHE",
        vmOff: "MIK AUS", vmAlways: "IMMER AN", vmWake: "WAKE WORD", vmTitle: "Sprachmodus",
    },
    fr: {
        processing: "AEGIS traite…", listening: "J'écoute, Monsieur…", waitingVoice: "En attente d'une commande vocale…", idle: "Votre commande, Monsieur…",
        locale: "fr-FR",
        send: "ENVOYER", stop: "STOP", closeBtn: "FERMER", attachFile: "Joindre un fichier",
        tipHistory: "Historique", tipSettings: "Paramètres", tipMinimize: "Réduire", tipFullscreen: "Plein écran (F11)", tipClose: "Fermer",
        conversation: "CONVERSATION",
        stLive: "EN DIRECT", stProc: "TRAITEMENT", stResp: "RÉPONSE", stListen: "À L'ÉCOUTE", stErr: "ERREUR", stReady: "PRÊT",
        empty1: "SYS: JARVIS en ligne.", empty2: "SYS: Systèmes nominaux.", empty3: "SYS: En attente de votre commande, Monsieur…", emptyDash: "Système prêt. En attente…",
        secSystem: "ÉTAT SYSTÈME", secWeather: "MÉTÉO", wx: "MÉTÉO", feelsLike: "ressenti", humidity: "humidité", wConnecting: "connexion impossible", wLoading: "chargement…",
        ramUsed: "UTILISÉ", ramFree: "LIBRE", ramTotal: "TOTAL",
        errLabel: "ERREUR", vRun: "EXÉCUTION", vRead: "LECTURE FICHIER", vWrite: "ÉCRITURE FICHIER", vList: "LISTE DOSSIER", vSearch: "RECHERCHE WEB",
        vmOff: "MIC OFF", vmAlways: "CONTINU", vmWake: "MOT-CLÉ", vmTitle: "Mode vocal",
    },
    es: {
        processing: "AEGIS procesando…", listening: "Escuchando, señor…", waitingVoice: "Esperando comando de voz…", idle: "Su orden, señor…",
        locale: "es-ES",
        send: "ENVIAR", stop: "DETENER", closeBtn: "CERRAR", attachFile: "Adjuntar archivo",
        tipHistory: "Historial", tipSettings: "Ajustes", tipMinimize: "Minimizar", tipFullscreen: "Pantalla completa (F11)", tipClose: "Cerrar",
        conversation: "CONVERSACIÓN",
        stLive: "EN VIVO", stProc: "PROCESANDO", stResp: "RESPONDIENDO", stListen: "ESCUCHANDO", stErr: "ERROR", stReady: "LISTO",
        empty1: "SYS: JARVIS en línea.", empty2: "SYS: Sistemas nominales.", empty3: "SYS: Esperando su orden, señor…", emptyDash: "Sistema listo. Esperando comando…",
        secSystem: "ESTADO SISTEMA", secWeather: "CLIMA", wx: "CLIMA", feelsLike: "sensación", humidity: "humedad", wConnecting: "sin conexión", wLoading: "cargando…",
        ramUsed: "USADO", ramFree: "LIBRE", ramTotal: "TOTAL",
        errLabel: "ERROR", vRun: "EJECUTANDO", vRead: "LEYENDO ARCHIVO", vWrite: "ESCRIBIENDO ARCHIVO", vList: "LISTANDO DIR", vSearch: "BUSCANDO WEB",
        vmOff: "MIC OFF", vmAlways: "CONTINUO", vmWake: "PALABRA CLAVE", vmTitle: "Modo voz",
    },
};

export const LANG_DEFAULT_VOICE: Record<Lang, string> = {
    tr: "tr-TR-EmelNeural",
    en: "en-US-AriaNeural",
    de: "de-DE-KatjaNeural",
    fr: "fr-FR-DeniseNeural",
    es: "es-ES-ElviraNeural",
};

// Dil seçim ekranındaki dil isimleri (kendi dilinde) — bayraklı liste.
export const LANG_NAMES: Record<Lang, string> = {
    tr: "Türkçe",
    en: "English",
    de: "Deutsch",
    fr: "Français",
    es: "Español",
};

export interface OnboardingStrings {
    chooseLang: string;
    welcome: string;
    welcomeSub: string;
    quickStart: string;
    quickStartDesc: string;
    recommended: string;
    advanced: string;
    advancedDesc: string;
    // Auth
    createAccount: string;
    signIn: string;
    email: string;
    password: string;
    passwordHint: string;
    signUpBtn: string;
    signInBtn: string;
    haveAccount: string;
    noAccount: string;
    back: string;
    skip: string;
    trialAuthSub: string;
    ownAuthSub: string;
    errEmailPass: string;
    errPassLen: string;
}

export const ONBOARDING: Record<Lang, OnboardingStrings> = {
    tr: {
        chooseLang: "Dilini seç",
        welcome: "AEGIS'e Hoş Geldin",
        welcomeSub: "Nasıl başlamak istersin? Bunu sonradan ayarlardan değiştirebilirsin.",
        quickStart: "Hızlı Başlangıç",
        quickStartDesc: "Hemen dene — API anahtarı gerekmez. Sadece bir hesap oluştur, çalışmaya başla. Günlük kullanım sınırı vardır.",
        recommended: "ÖNERİLEN",
        advanced: "Gelişmiş Kurulum",
        advancedDesc: "Kendi AI sağlayıcını seç ve kendi API anahtarınla kullan. Sınır yok. Giriş yapmak opsiyoneldir (ayarları cihazlar arası senkronlamak için).",
        createAccount: "Hesap Oluştur",
        signIn: "Giriş Yap",
        email: "E-POSTA",
        password: "ŞİFRE",
        passwordHint: "en az 6 karakter",
        signUpBtn: "KAYIT OL VE BAŞLA",
        signInBtn: "GİRİŞ YAP",
        haveAccount: "Zaten hesabım var → Giriş yap",
        noAccount: "Hesabım yok → Kayıt ol",
        back: "‹ Geri",
        skip: "Atla ›",
        trialAuthSub: "Deneme modu için bir hesap oluştur. Bu, günlük kullanımını takip etmek içindir.",
        ownAuthSub: "İstersen giriş yap — ayarların ve API anahtarların cihazlar arasında senkronlanır. Ya da bu adımı atla.",
        errEmailPass: "E-posta ve şifre gerekli.",
        errPassLen: "Şifre en az 6 karakter olmalı.",
    },
    en: {
        chooseLang: "Choose your language",
        welcome: "Welcome to AEGIS",
        welcomeSub: "How would you like to start? You can change this later in settings.",
        quickStart: "Quick Start",
        quickStartDesc: "Try it now — no API key needed. Just create an account and get started. A daily usage limit applies.",
        recommended: "RECOMMENDED",
        advanced: "Advanced Setup",
        advancedDesc: "Choose your own AI provider and use your own API key. No limits. Signing in is optional (to sync settings across devices).",
        createAccount: "Create Account",
        signIn: "Sign In",
        email: "EMAIL",
        password: "PASSWORD",
        passwordHint: "at least 6 characters",
        signUpBtn: "SIGN UP & START",
        signInBtn: "SIGN IN",
        haveAccount: "I already have an account → Sign in",
        noAccount: "I don't have an account → Sign up",
        back: "‹ Back",
        skip: "Skip ›",
        trialAuthSub: "Create an account for trial mode. This is used to track your daily usage.",
        ownAuthSub: "Sign in if you like — your settings and API keys sync across devices. Or skip this step.",
        errEmailPass: "Email and password required.",
        errPassLen: "Password must be at least 6 characters.",
    },
    de: {
        chooseLang: "Wähle deine Sprache",
        welcome: "Willkommen bei AEGIS",
        welcomeSub: "Wie möchtest du starten? Du kannst dies später in den Einstellungen ändern.",
        quickStart: "Schnellstart",
        quickStartDesc: "Jetzt ausprobieren — kein API-Schlüssel nötig. Erstelle einfach ein Konto und leg los. Es gilt ein tägliches Nutzungslimit.",
        recommended: "EMPFOHLEN",
        advanced: "Erweiterte Einrichtung",
        advancedDesc: "Wähle deinen eigenen KI-Anbieter und nutze deinen eigenen API-Schlüssel. Keine Limits. Anmeldung optional (zum Synchronisieren der Einstellungen).",
        createAccount: "Konto erstellen",
        signIn: "Anmelden",
        email: "E-MAIL",
        password: "PASSWORT",
        passwordHint: "mindestens 6 Zeichen",
        signUpBtn: "REGISTRIEREN & STARTEN",
        signInBtn: "ANMELDEN",
        haveAccount: "Ich habe bereits ein Konto → Anmelden",
        noAccount: "Ich habe kein Konto → Registrieren",
        back: "‹ Zurück",
        skip: "Überspringen ›",
        trialAuthSub: "Erstelle ein Konto für den Testmodus. Dies dient zur Verfolgung deiner täglichen Nutzung.",
        ownAuthSub: "Melde dich an, wenn du möchtest — deine Einstellungen und API-Schlüssel werden geräteübergreifend synchronisiert. Oder überspringe diesen Schritt.",
        errEmailPass: "E-Mail und Passwort erforderlich.",
        errPassLen: "Passwort muss mindestens 6 Zeichen haben.",
    },
    fr: {
        chooseLang: "Choisis ta langue",
        welcome: "Bienvenue sur AEGIS",
        welcomeSub: "Comment veux-tu commencer ? Tu peux changer cela plus tard dans les paramètres.",
        quickStart: "Démarrage Rapide",
        quickStartDesc: "Essaie maintenant — aucune clé API nécessaire. Crée simplement un compte et commence. Une limite d'utilisation quotidienne s'applique.",
        recommended: "RECOMMANDÉ",
        advanced: "Configuration Avancée",
        advancedDesc: "Choisis ton propre fournisseur d'IA et utilise ta propre clé API. Aucune limite. La connexion est optionnelle (pour synchroniser les paramètres entre appareils).",
        createAccount: "Créer un Compte",
        signIn: "Se Connecter",
        email: "E-MAIL",
        password: "MOT DE PASSE",
        passwordHint: "au moins 6 caractères",
        signUpBtn: "S'INSCRIRE & COMMENCER",
        signInBtn: "SE CONNECTER",
        haveAccount: "J'ai déjà un compte → Se connecter",
        noAccount: "Je n'ai pas de compte → S'inscrire",
        back: "‹ Retour",
        skip: "Passer ›",
        trialAuthSub: "Crée un compte pour le mode d'essai. Cela sert à suivre ton utilisation quotidienne.",
        ownAuthSub: "Connecte-toi si tu veux — tes paramètres et clés API se synchronisent entre appareils. Ou passe cette étape.",
        errEmailPass: "E-mail et mot de passe requis.",
        errPassLen: "Le mot de passe doit comporter au moins 6 caractères.",
    },
    es: {
        chooseLang: "Elige tu idioma",
        welcome: "Bienvenido a AEGIS",
        welcomeSub: "¿Cómo quieres empezar? Puedes cambiar esto más tarde en ajustes.",
        quickStart: "Inicio Rápido",
        quickStartDesc: "Pruébalo ahora — no se necesita clave API. Solo crea una cuenta y empieza. Se aplica un límite de uso diario.",
        recommended: "RECOMENDADO",
        advanced: "Configuración Avanzada",
        advancedDesc: "Elige tu propio proveedor de IA y usa tu propia clave API. Sin límites. Iniciar sesión es opcional (para sincronizar ajustes entre dispositivos).",
        createAccount: "Crear Cuenta",
        signIn: "Iniciar Sesión",
        email: "CORREO",
        password: "CONTRASEÑA",
        passwordHint: "al menos 6 caracteres",
        signUpBtn: "REGISTRARSE Y EMPEZAR",
        signInBtn: "INICIAR SESIÓN",
        haveAccount: "Ya tengo una cuenta → Iniciar sesión",
        noAccount: "No tengo cuenta → Registrarse",
        back: "‹ Atrás",
        skip: "Omitir ›",
        trialAuthSub: "Crea una cuenta para el modo de prueba. Esto se usa para rastrear tu uso diario.",
        ownAuthSub: "Inicia sesión si quieres — tus ajustes y claves API se sincronizan entre dispositivos. O omite este paso.",
        errEmailPass: "Correo y contraseña requeridos.",
        errPassLen: "La contraseña debe tener al menos 6 caracteres.",
    },
};
