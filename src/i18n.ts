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

// ───────── Komut paleti + geçmiş paneli (Öncelik 1, Chunk B) ─────────
export interface ExtraStrings {
    palSearch: string; palNotFound: string; palInstant: string; palEdit: string;
    palNav: string; palSelect: string; palClose: string; palHint: string;
    histTitle: string; histLoading: string; histEmpty: string; histNoSummary: string;
    histContinue: string; histExport: string; histYou: string; histAegis: string;
}

export const EXTRA: Record<Lang, ExtraStrings> = {
    tr: {palSearch: "Komut ara…", palNotFound: "komut bulunamadı", palInstant: "ANLIK", palEdit: "DÜZENLE",
        palNav: "↑↓ gezin", palSelect: "↵ seç", palClose: "ESC kapat", palHint: "Ctrl+Space açar",
        histTitle: "GEÇMİŞ OTURUMLAR", histLoading: "yükleniyor…", histEmpty: "kayıtlı oturum yok", histNoSummary: "özet yok",
        histContinue: "DEVAM ET", histExport: "DIŞA AKTAR", histYou: "SİZ", histAegis: "AEGIS"},
    en: {palSearch: "Search command…", palNotFound: "no command found", palInstant: "INSTANT", palEdit: "EDIT",
        palNav: "↑↓ navigate", palSelect: "↵ select", palClose: "ESC close", palHint: "Ctrl+Space opens",
        histTitle: "PAST SESSIONS", histLoading: "loading…", histEmpty: "no saved sessions", histNoSummary: "no summary",
        histContinue: "CONTINUE", histExport: "EXPORT", histYou: "YOU", histAegis: "AEGIS"},
    de: {palSearch: "Befehl suchen…", palNotFound: "kein Befehl gefunden", palInstant: "SOFORT", palEdit: "BEARBEITEN",
        palNav: "↑↓ navigieren", palSelect: "↵ wählen", palClose: "ESC schließen", palHint: "Ctrl+Space öffnet",
        histTitle: "FRÜHERE SITZUNGEN", histLoading: "lädt…", histEmpty: "keine Sitzungen", histNoSummary: "keine Zusammenfassung",
        histContinue: "FORTSETZEN", histExport: "EXPORTIEREN", histYou: "SIE", histAegis: "AEGIS"},
    fr: {palSearch: "Rechercher…", palNotFound: "aucune commande", palInstant: "INSTANT", palEdit: "MODIFIER",
        palNav: "↑↓ naviguer", palSelect: "↵ sélect.", palClose: "ESC fermer", palHint: "Ctrl+Space ouvre",
        histTitle: "SESSIONS PASSÉES", histLoading: "chargement…", histEmpty: "aucune session", histNoSummary: "pas de résumé",
        histContinue: "CONTINUER", histExport: "EXPORTER", histYou: "VOUS", histAegis: "AEGIS"},
    es: {palSearch: "Buscar comando…", palNotFound: "sin comandos", palInstant: "AL INSTANTE", palEdit: "EDITAR",
        palNav: "↑↓ navegar", palSelect: "↵ elegir", palClose: "ESC cerrar", palHint: "Ctrl+Space abre",
        histTitle: "SESIONES ANTERIORES", histLoading: "cargando…", histEmpty: "sin sesiones", histNoSummary: "sin resumen",
        histContinue: "CONTINUAR", histExport: "EXPORTAR", histYou: "USTED", histAegis: "AEGIS"},
};

export interface PaletteCommand {id: string; label: string; description: string; text: string; direct: boolean;}

export const PALETTE_COMMANDS: Record<Lang, PaletteCommand[]> = {
    tr: [
        {id: "screenshot", label: "Ekranı analiz et", description: "Tam ekran yakala + vision ile analiz", text: "Ekranımda ne var?", direct: true},
        {id: "clipboard_r", label: "Panoyu oku", description: "Panodaki mevcut metni göster", text: "Panodaki metni oku", direct: true},
        {id: "windows", label: "Açık pencereleri listele", description: "Tüm açık uygulama pencerelerini göster", text: "Açık pencereleri listele", direct: true},
        {id: "weather", label: "Hava durumu", description: "Konumunuzun güncel hava durumu", text: "Hava durumu nasıl?", direct: true},
        {id: "profile", label: "Profilimi göster", description: "Kaydedilmiş kullanıcı bilgileri", text: "Profilimi göster", direct: true},
        {id: "notes", label: "Notlarımı göster", description: "Bekleyen notlar ve hatırlatıcılar", text: "Notlarımı göster", direct: true},
        {id: "app_profiles", label: "Uygulama profillerini listele", description: "Kayıtlı app başlatma profilleri", text: "Uygulama profillerini listele", direct: true},
        {id: "plugins", label: "Plugin'leri listele", description: "Yüklü plugin'ler ve araçları", text: "Plugin'leri listele", direct: true},
        {id: "reload_plugins", label: "Plugin'leri yenile", description: "~/.aegis/plugins/ diskten yeniden yükle", text: "Plugin'leri yenile", direct: true},
        {id: "fetch_url", label: "Web sayfasını oku", description: "URL'nin içeriğini çek ve özetle", text: "Bu sayfayı oku: https://", direct: false},
        {id: "volume", label: "Ses seviyesini ayarla", description: "Sistem ses seviyesi 0-100", text: "Sesi %50 yap", direct: false},
        {id: "brightness", label: "Parlaklığı ayarla", description: "Ekran parlaklığı 0-100", text: "Parlaklığı %50 yap", direct: false},
        {id: "remind", label: "Hatırlatıcı ayarla", description: "X dakika/saniye sonra sesli hatırlat", text: "10 dakika sonra hatırlat: ", direct: false},
        {id: "note_save", label: "Not kaydet", description: "Yeni not ekle", text: "Not kaydet: ", direct: false},
        {id: "search", label: "İnternette ara", description: "Tavily/Serper/DuckDuckGo ile ara", text: "Ara: ", direct: false},
        {id: "notif", label: "Bildirim gönder", description: "Windows toast bildirimi göster", text: "Bildirim gönder başlık: AEGIS mesaj: Merhaba", direct: false},
        {id: "focus", label: "Pencereyi öne getir", description: "Uygulamayı aktif pencere yap", text: "Öne getir: ", direct: false},
        {id: "clip_write", label: "Panoya yaz", description: "Metni panonuza kopyala", text: "Panoya kopyala: ", direct: false},
        {id: "run_profile", label: "Profil çalıştır", description: "Kayıtlı uygulama profili başlat", text: "Profili çalıştır: ", direct: false},
    ],
    en: [
        {id: "screenshot", label: "Analyze screen", description: "Full screenshot + vision analysis", text: "What's on my screen?", direct: true},
        {id: "clipboard_r", label: "Read clipboard", description: "Show current clipboard text", text: "Read the clipboard text", direct: true},
        {id: "windows", label: "List open windows", description: "Show all open app windows", text: "List open windows", direct: true},
        {id: "weather", label: "Weather", description: "Current weather for your location", text: "What's the weather?", direct: true},
        {id: "profile", label: "Show my profile", description: "Saved user info", text: "Show my profile", direct: true},
        {id: "notes", label: "Show my notes", description: "Pending notes and reminders", text: "Show my notes", direct: true},
        {id: "app_profiles", label: "List app profiles", description: "Saved app launch profiles", text: "List app profiles", direct: true},
        {id: "plugins", label: "List plugins", description: "Installed plugins and tools", text: "List plugins", direct: true},
        {id: "reload_plugins", label: "Reload plugins", description: "Reload from ~/.aegis/plugins/", text: "Reload plugins", direct: true},
        {id: "fetch_url", label: "Read web page", description: "Fetch and summarize a URL", text: "Read this page: https://", direct: false},
        {id: "volume", label: "Set volume", description: "System volume 0-100", text: "Set volume to 50%", direct: false},
        {id: "brightness", label: "Set brightness", description: "Screen brightness 0-100", text: "Set brightness to 50%", direct: false},
        {id: "remind", label: "Set reminder", description: "Voice reminder in X minutes", text: "Remind me in 10 minutes: ", direct: false},
        {id: "note_save", label: "Save note", description: "Add a new note", text: "Save note: ", direct: false},
        {id: "search", label: "Search the web", description: "Search via Tavily/Serper/DuckDuckGo", text: "Search: ", direct: false},
        {id: "notif", label: "Send notification", description: "Show a Windows toast", text: "Send notification title: AEGIS message: Hello", direct: false},
        {id: "focus", label: "Focus window", description: "Bring app to front", text: "Focus: ", direct: false},
        {id: "clip_write", label: "Write to clipboard", description: "Copy text to clipboard", text: "Copy to clipboard: ", direct: false},
        {id: "run_profile", label: "Run profile", description: "Launch a saved app profile", text: "Run profile: ", direct: false},
    ],
    de: [
        {id: "screenshot", label: "Bildschirm analysieren", description: "Vollbild + Vision-Analyse", text: "Was ist auf meinem Bildschirm?", direct: true},
        {id: "clipboard_r", label: "Zwischenablage lesen", description: "Aktuellen Text anzeigen", text: "Lies die Zwischenablage", direct: true},
        {id: "windows", label: "Offene Fenster auflisten", description: "Alle offenen Fenster zeigen", text: "Offene Fenster auflisten", direct: true},
        {id: "weather", label: "Wetter", description: "Aktuelles Wetter deines Standorts", text: "Wie ist das Wetter?", direct: true},
        {id: "profile", label: "Mein Profil zeigen", description: "Gespeicherte Nutzerdaten", text: "Zeig mein Profil", direct: true},
        {id: "notes", label: "Meine Notizen zeigen", description: "Offene Notizen und Erinnerungen", text: "Zeig meine Notizen", direct: true},
        {id: "app_profiles", label: "App-Profile auflisten", description: "Gespeicherte Start-Profile", text: "App-Profile auflisten", direct: true},
        {id: "plugins", label: "Plugins auflisten", description: "Installierte Plugins und Tools", text: "Plugins auflisten", direct: true},
        {id: "reload_plugins", label: "Plugins neu laden", description: "Aus ~/.aegis/plugins/ neu laden", text: "Plugins neu laden", direct: true},
        {id: "fetch_url", label: "Webseite lesen", description: "URL abrufen und zusammenfassen", text: "Lies diese Seite: https://", direct: false},
        {id: "volume", label: "Lautstärke einstellen", description: "Systemlautstärke 0-100", text: "Stell die Lautstärke auf 50%", direct: false},
        {id: "brightness", label: "Helligkeit einstellen", description: "Bildschirmhelligkeit 0-100", text: "Stell die Helligkeit auf 50%", direct: false},
        {id: "remind", label: "Erinnerung setzen", description: "Sprach-Erinnerung in X Minuten", text: "Erinnere mich in 10 Minuten: ", direct: false},
        {id: "note_save", label: "Notiz speichern", description: "Neue Notiz hinzufügen", text: "Notiz speichern: ", direct: false},
        {id: "search", label: "Im Web suchen", description: "Suche via Tavily/Serper/DuckDuckGo", text: "Suche: ", direct: false},
        {id: "notif", label: "Benachrichtigung senden", description: "Windows-Toast anzeigen", text: "Benachrichtigung Titel: AEGIS Nachricht: Hallo", direct: false},
        {id: "focus", label: "Fenster fokussieren", description: "App in den Vordergrund", text: "Fokus: ", direct: false},
        {id: "clip_write", label: "In Zwischenablage schreiben", description: "Text kopieren", text: "In Zwischenablage: ", direct: false},
        {id: "run_profile", label: "Profil ausführen", description: "Gespeichertes Profil starten", text: "Profil ausführen: ", direct: false},
    ],
    fr: [
        {id: "screenshot", label: "Analyser l'écran", description: "Capture plein écran + vision", text: "Qu'y a-t-il sur mon écran ?", direct: true},
        {id: "clipboard_r", label: "Lire le presse-papiers", description: "Afficher le texte actuel", text: "Lis le presse-papiers", direct: true},
        {id: "windows", label: "Lister les fenêtres", description: "Toutes les fenêtres ouvertes", text: "Liste les fenêtres ouvertes", direct: true},
        {id: "weather", label: "Météo", description: "Météo actuelle de votre position", text: "Quel temps fait-il ?", direct: true},
        {id: "profile", label: "Afficher mon profil", description: "Infos utilisateur enregistrées", text: "Affiche mon profil", direct: true},
        {id: "notes", label: "Afficher mes notes", description: "Notes et rappels en attente", text: "Affiche mes notes", direct: true},
        {id: "app_profiles", label: "Lister les profils d'app", description: "Profils de lancement enregistrés", text: "Liste les profils d'app", direct: true},
        {id: "plugins", label: "Lister les plugins", description: "Plugins et outils installés", text: "Liste les plugins", direct: true},
        {id: "reload_plugins", label: "Recharger les plugins", description: "Recharger depuis ~/.aegis/plugins/", text: "Recharge les plugins", direct: true},
        {id: "fetch_url", label: "Lire une page web", description: "Récupérer et résumer une URL", text: "Lis cette page : https://", direct: false},
        {id: "volume", label: "Régler le volume", description: "Volume système 0-100", text: "Mets le volume à 50%", direct: false},
        {id: "brightness", label: "Régler la luminosité", description: "Luminosité écran 0-100", text: "Mets la luminosité à 50%", direct: false},
        {id: "remind", label: "Définir un rappel", description: "Rappel vocal dans X minutes", text: "Rappelle-moi dans 10 minutes : ", direct: false},
        {id: "note_save", label: "Enregistrer une note", description: "Ajouter une nouvelle note", text: "Note : ", direct: false},
        {id: "search", label: "Rechercher sur le web", description: "Recherche via Tavily/Serper/DuckDuckGo", text: "Cherche : ", direct: false},
        {id: "notif", label: "Envoyer une notification", description: "Afficher un toast Windows", text: "Notification titre : AEGIS message : Bonjour", direct: false},
        {id: "focus", label: "Mettre la fenêtre au premier plan", description: "Activer l'application", text: "Focus : ", direct: false},
        {id: "clip_write", label: "Écrire dans le presse-papiers", description: "Copier du texte", text: "Copier : ", direct: false},
        {id: "run_profile", label: "Exécuter un profil", description: "Lancer un profil enregistré", text: "Exécute le profil : ", direct: false},
    ],
    es: [
        {id: "screenshot", label: "Analizar pantalla", description: "Captura completa + visión", text: "¿Qué hay en mi pantalla?", direct: true},
        {id: "clipboard_r", label: "Leer portapapeles", description: "Mostrar el texto actual", text: "Lee el portapapeles", direct: true},
        {id: "windows", label: "Listar ventanas abiertas", description: "Todas las ventanas abiertas", text: "Lista las ventanas abiertas", direct: true},
        {id: "weather", label: "Clima", description: "Clima actual de tu ubicación", text: "¿Qué tiempo hace?", direct: true},
        {id: "profile", label: "Mostrar mi perfil", description: "Datos de usuario guardados", text: "Muestra mi perfil", direct: true},
        {id: "notes", label: "Mostrar mis notas", description: "Notas y recordatorios pendientes", text: "Muestra mis notas", direct: true},
        {id: "app_profiles", label: "Listar perfiles de app", description: "Perfiles de inicio guardados", text: "Lista los perfiles de app", direct: true},
        {id: "plugins", label: "Listar plugins", description: "Plugins y herramientas instalados", text: "Lista los plugins", direct: true},
        {id: "reload_plugins", label: "Recargar plugins", description: "Recargar desde ~/.aegis/plugins/", text: "Recarga los plugins", direct: true},
        {id: "fetch_url", label: "Leer página web", description: "Obtener y resumir una URL", text: "Lee esta página: https://", direct: false},
        {id: "volume", label: "Ajustar volumen", description: "Volumen del sistema 0-100", text: "Pon el volumen al 50%", direct: false},
        {id: "brightness", label: "Ajustar brillo", description: "Brillo de pantalla 0-100", text: "Pon el brillo al 50%", direct: false},
        {id: "remind", label: "Poner recordatorio", description: "Recordatorio de voz en X minutos", text: "Recuérdame en 10 minutos: ", direct: false},
        {id: "note_save", label: "Guardar nota", description: "Añadir una nota nueva", text: "Guardar nota: ", direct: false},
        {id: "search", label: "Buscar en la web", description: "Busca vía Tavily/Serper/DuckDuckGo", text: "Buscar: ", direct: false},
        {id: "notif", label: "Enviar notificación", description: "Mostrar un toast de Windows", text: "Notificación título: AEGIS mensaje: Hola", direct: false},
        {id: "focus", label: "Enfocar ventana", description: "Traer app al frente", text: "Enfocar: ", direct: false},
        {id: "clip_write", label: "Escribir en portapapeles", description: "Copiar texto", text: "Copiar: ", direct: false},
        {id: "run_profile", label: "Ejecutar perfil", description: "Iniciar un perfil guardado", text: "Ejecutar perfil: ", direct: false},
    ],
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
