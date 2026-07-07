// Backend (main process) user-facing message catalog — i18n P3.
// The renderer has its own catalog in src/i18n.ts; strings created in the main
// process (provider errors, trial-proxy errors, auth errors, system notices,
// tray menu) are localized here. main.ts calls setBackendLang() at startup and
// whenever the user changes the language in settings.

export type BackendLang = "tr" | "en" | "de" | "fr" | "es";

let currentLang: BackendLang = "en";

export function setBackendLang(lang: string): void {
    if (lang === "tr" || lang === "en" || lang === "de" || lang === "fr" || lang === "es") {
        currentLang = lang;
    }
}

export function getBackendLang(): BackendLang {
    return currentLang;
}

type Catalog = Record<string, Record<BackendLang, string>>;

const M = {
    // ── fetch-utils ──────────────────────────────────────────────────────────
    timeout: {
        en: "The request timed out. Check your network connection and try again.",
        tr: "İstek zaman aşımına uğradı. Ağ bağlantınızı kontrol edip tekrar deneyin.",
        de: "Die Anfrage hat das Zeitlimit überschritten. Prüfen Sie Ihre Netzwerkverbindung und versuchen Sie es erneut.",
        fr: "La requête a expiré. Vérifiez votre connexion réseau et réessayez.",
        es: "La solicitud agotó el tiempo de espera. Comprueba tu conexión de red e inténtalo de nuevo.",
    },
    // ── friendlyHttpError ({provider}, {status}, {detail}) ──────────────────
    http401: {
        en: "{provider}: Your API key is invalid or expired. Update the key in Settings → Model.",
        tr: "{provider}: API anahtarınız geçersiz veya süresi dolmuş. Ayarlar → Model bölümünden anahtarı güncelleyin.",
        de: "{provider}: Ihr API-Schlüssel ist ungültig oder abgelaufen. Aktualisieren Sie den Schlüssel unter Einstellungen → Modell.",
        fr: "{provider} : votre clé API est invalide ou expirée. Mettez-la à jour dans Paramètres → Modèle.",
        es: "{provider}: tu clave de API no es válida o ha caducado. Actualízala en Ajustes → Modelo.",
    },
    httpDupTool: {
        en: "{provider}: Duplicate tool declaration error. Refresh the conversation (Ctrl+R).",
        tr: "{provider}: Yinelenen araç bildirimi hatası. Konuşmayı yenileyin (Ctrl+R).",
        de: "{provider}: Fehler durch doppelte Tool-Deklaration. Aktualisieren Sie das Gespräch (Strg+R).",
        fr: "{provider} : erreur de déclaration d'outil en double. Actualisez la conversation (Ctrl+R).",
        es: "{provider}: error de declaración de herramienta duplicada. Actualiza la conversación (Ctrl+R).",
    },
    http403: {
        en: "{provider}: You are not authorized for this operation (403). Check your API key in Settings → Model.",
        tr: "{provider}: Bu işlem için yetkiniz yok (403). Ayarlar → Model bölümünden API anahtarınızı kontrol edin.",
        de: "{provider}: Sie sind für diesen Vorgang nicht autorisiert (403). Prüfen Sie Ihren API-Schlüssel unter Einstellungen → Modell.",
        fr: "{provider} : vous n'êtes pas autorisé pour cette opération (403). Vérifiez votre clé API dans Paramètres → Modèle.",
        es: "{provider}: no estás autorizado para esta operación (403). Comprueba tu clave de API en Ajustes → Modelo.",
    },
    http400model: {
        en: "{provider}: The selected model is not available with this provider. Pick another model in Settings → Model.",
        tr: "{provider}: Seçili model bu sağlayıcıda kullanılamıyor. Ayarlar → Model bölümünden başka bir model seçin.",
        de: "{provider}: Das ausgewählte Modell ist bei diesem Anbieter nicht verfügbar. Wählen Sie unter Einstellungen → Modell ein anderes Modell.",
        fr: "{provider} : le modèle sélectionné n'est pas disponible chez ce fournisseur. Choisissez un autre modèle dans Paramètres → Modèle.",
        es: "{provider}: el modelo seleccionado no está disponible con este proveedor. Elige otro modelo en Ajustes → Modelo.",
    },
    http400ctx: {
        en: "{provider}: Message is too long and doesn't fit the context window. Clear the chat or write something shorter.",
        tr: "{provider}: Mesaj çok uzun, bağlam penceresine sığmıyor. Sohbeti temizleyin veya daha kısa yazın.",
        de: "{provider}: Die Nachricht ist zu lang und passt nicht ins Kontextfenster. Leeren Sie den Chat oder schreiben Sie kürzer.",
        fr: "{provider} : le message est trop long et dépasse la fenêtre de contexte. Effacez la conversation ou écrivez plus court.",
        es: "{provider}: el mensaje es demasiado largo y no cabe en la ventana de contexto. Borra el chat o escribe algo más corto.",
    },
    http400: {
        en: "{provider}: Invalid request (400){detail}. Check your configuration in Settings → Model.",
        tr: "{provider}: Geçersiz istek (400){detail}. Ayarlar → Model bölümünden yapılandırmanızı kontrol edin.",
        de: "{provider}: Ungültige Anfrage (400){detail}. Prüfen Sie Ihre Konfiguration unter Einstellungen → Modell.",
        fr: "{provider} : requête invalide (400){detail}. Vérifiez votre configuration dans Paramètres → Modèle.",
        es: "{provider}: solicitud no válida (400){detail}. Comprueba tu configuración en Ajustes → Modelo.",
    },
    http404: {
        en: "{provider}: Model not found. Pick a current model in Settings → Model.",
        tr: "{provider}: Model bulunamadı. Ayarlar → Model bölümünden güncel bir model seçin.",
        de: "{provider}: Modell nicht gefunden. Wählen Sie unter Einstellungen → Modell ein aktuelles Modell.",
        fr: "{provider} : modèle introuvable. Choisissez un modèle actuel dans Paramètres → Modèle.",
        es: "{provider}: modelo no encontrado. Elige un modelo actual en Ajustes → Modelo.",
    },
    http429quota: {
        en: "{provider}: Insufficient account credit/quota. Add balance to your {provider} account.",
        tr: "{provider}: Hesap kredisi/kotası yetersiz. {provider} hesabınıza bakiye ekleyin.",
        de: "{provider}: Unzureichendes Guthaben/Kontingent. Laden Sie Guthaben auf Ihr {provider}-Konto.",
        fr: "{provider} : crédit/quota de compte insuffisant. Ajoutez du solde à votre compte {provider}.",
        es: "{provider}: crédito/cuota de la cuenta insuficiente. Añade saldo a tu cuenta de {provider}.",
    },
    http429tpm: {
        en: "{provider}: Per-minute token limit exceeded. Wait a few seconds or write a shorter message.",
        tr: "{provider}: Dakikalık token limiti aşıldı. Birkaç saniye bekleyin veya daha kısa bir mesaj yazın.",
        de: "{provider}: Token-Limit pro Minute überschritten. Warten Sie einige Sekunden oder schreiben Sie eine kürzere Nachricht.",
        fr: "{provider} : limite de jetons par minute dépassée. Attendez quelques secondes ou écrivez un message plus court.",
        es: "{provider}: límite de tokens por minuto superado. Espera unos segundos o escribe un mensaje más corto.",
    },
    http429: {
        en: "{provider}: Too many requests sent (rate limit). Wait a few seconds and try again.",
        tr: "{provider}: Çok fazla istek gönderildi (hız limiti). Birkaç saniye bekleyip tekrar deneyin.",
        de: "{provider}: Zu viele Anfragen gesendet (Rate-Limit). Warten Sie einige Sekunden und versuchen Sie es erneut.",
        fr: "{provider} : trop de requêtes envoyées (limite de débit). Attendez quelques secondes et réessayez.",
        es: "{provider}: demasiadas solicitudes enviadas (límite de velocidad). Espera unos segundos e inténtalo de nuevo.",
    },
    http413: {
        en: "{provider}: Message or file is too large. Try again with shorter content.",
        tr: "{provider}: Mesaj veya dosya çok büyük. Daha kısa içerikle tekrar deneyin.",
        de: "{provider}: Nachricht oder Datei ist zu groß. Versuchen Sie es mit kürzerem Inhalt erneut.",
        fr: "{provider} : message ou fichier trop volumineux. Réessayez avec un contenu plus court.",
        es: "{provider}: el mensaje o archivo es demasiado grande. Inténtalo de nuevo con un contenido más corto.",
    },
    http422: {
        en: "{provider}: Invalid request format (422){detail}.",
        tr: "{provider}: Geçersiz istek biçimi (422){detail}.",
        de: "{provider}: Ungültiges Anfrageformat (422){detail}.",
        fr: "{provider} : format de requête invalide (422){detail}.",
        es: "{provider}: formato de solicitud no válido (422){detail}.",
    },
    http5xx: {
        en: "{provider}: Temporary error on the provider's server ({status}). Try again in a few seconds.",
        tr: "{provider}: Sağlayıcının sunucusunda geçici bir hata oluştu ({status}). Birkaç saniye sonra tekrar deneyin.",
        de: "{provider}: Vorübergehender Fehler auf dem Server des Anbieters ({status}). Versuchen Sie es in einigen Sekunden erneut.",
        fr: "{provider} : erreur temporaire sur le serveur du fournisseur ({status}). Réessayez dans quelques secondes.",
        es: "{provider}: error temporal en el servidor del proveedor ({status}). Inténtalo de nuevo en unos segundos.",
    },
    httpNet: {
        en: "{provider}: Cannot reach the server. Check your internet connection and VPN status.",
        tr: "{provider}: Sunucuya ulaşılamıyor. İnternet bağlantınızı ve VPN durumunuzu kontrol edin.",
        de: "{provider}: Server nicht erreichbar. Prüfen Sie Ihre Internetverbindung und Ihren VPN-Status.",
        fr: "{provider} : impossible de joindre le serveur. Vérifiez votre connexion Internet et votre VPN.",
        es: "{provider}: no se puede acceder al servidor. Comprueba tu conexión a Internet y el estado de tu VPN.",
    },
    httpGeneric: {
        en: "{provider} error ({status}){detail}",
        tr: "{provider} hatası ({status}){detail}",
        de: "{provider}-Fehler ({status}){detail}",
        fr: "Erreur {provider} ({status}){detail}",
        es: "Error de {provider} ({status}){detail}",
    },
    // ── friendlyGroqError ────────────────────────────────────────────────────
    groqAuth: {
        en: "Groq: Your API key is invalid or expired. Update the key in Settings → Model.",
        tr: "Groq: API anahtarınız geçersiz veya süresi dolmuş. Ayarlar → Model bölümünden anahtarı güncelleyin.",
        de: "Groq: Ihr API-Schlüssel ist ungültig oder abgelaufen. Aktualisieren Sie den Schlüssel unter Einstellungen → Modell.",
        fr: "Groq : votre clé API est invalide ou expirée. Mettez-la à jour dans Paramètres → Modèle.",
        es: "Groq: tu clave de API no es válida o ha caducado. Actualízala en Ajustes → Modelo.",
    },
    groqModel: {
        en: "Groq: The selected model is no longer available. Pick a current model in Settings → Model.",
        tr: "Groq: Seçili model artık kullanılamıyor. Ayarlar → Model bölümünden güncel bir model seçin.",
        de: "Groq: Das ausgewählte Modell ist nicht mehr verfügbar. Wählen Sie unter Einstellungen → Modell ein aktuelles Modell.",
        fr: "Groq : le modèle sélectionné n'est plus disponible. Choisissez un modèle actuel dans Paramètres → Modèle.",
        es: "Groq: el modelo seleccionado ya no está disponible. Elige un modelo actual en Ajustes → Modelo.",
    },
    groqTooLarge: {
        en: "Groq: Your message is too long. Clear the chat or write something shorter.",
        tr: "Groq: Mesajınız çok uzun. Sohbeti temizleyin veya daha kısa yazın.",
        de: "Groq: Ihre Nachricht ist zu lang. Leeren Sie den Chat oder schreiben Sie kürzer.",
        fr: "Groq : votre message est trop long. Effacez la conversation ou écrivez plus court.",
        es: "Groq: tu mensaje es demasiado largo. Borra el chat o escribe algo más corto.",
    },
    groqRate: {
        en: "Groq: Hit the rate limit (auto-retry was attempted). Wait a few seconds or pick a different model.",
        tr: "Groq: Hız limitine takıldı (otomatik yeniden deneme yapıldı). Birkaç saniye bekleyin veya farklı bir model seçin.",
        de: "Groq: Rate-Limit erreicht (automatischer Neuversuch wurde unternommen). Warten Sie einige Sekunden oder wählen Sie ein anderes Modell.",
        fr: "Groq : limite de débit atteinte (nouvelle tentative automatique effectuée). Attendez quelques secondes ou choisissez un autre modèle.",
        es: "Groq: se alcanzó el límite de velocidad (se intentó un reintento automático). Espera unos segundos o elige otro modelo.",
    },
    groq5xx: {
        en: "Groq: The server returned a temporary error. Try again in a few seconds.",
        tr: "Groq: Sunucu geçici bir hata döndürdü. Birkaç saniye sonra tekrar deneyin.",
        de: "Groq: Der Server hat einen vorübergehenden Fehler zurückgegeben. Versuchen Sie es in einigen Sekunden erneut.",
        fr: "Groq : le serveur a renvoyé une erreur temporaire. Réessayez dans quelques secondes.",
        es: "Groq: el servidor devolvió un error temporal. Inténtalo de nuevo en unos segundos.",
    },
    groqNet: {
        en: "Cannot reach Groq. Check your internet connection.",
        tr: "Groq'a ulaşılamıyor. İnternet bağlantınızı kontrol edin.",
        de: "Groq ist nicht erreichbar. Prüfen Sie Ihre Internetverbindung.",
        fr: "Impossible de joindre Groq. Vérifiez votre connexion Internet.",
        es: "No se puede acceder a Groq. Comprueba tu conexión a Internet.",
    },
    groqFailedGen: {
        en: "Groq: The model failed to generate a response. Try again.",
        tr: "Groq: Model bir yanıt üretemedi. Tekrar deneyin.",
        de: "Groq: Das Modell konnte keine Antwort erzeugen. Versuchen Sie es erneut.",
        fr: "Groq : le modèle n'a pas réussi à générer une réponse. Réessayez.",
        es: "Groq: el modelo no pudo generar una respuesta. Inténtalo de nuevo.",
    },
    groqGeneric: {
        en: "Groq error{detail}",
        tr: "Groq hatası{detail}",
        de: "Groq-Fehler{detail}",
        fr: "Erreur Groq{detail}",
        es: "Error de Groq{detail}",
    },
    // ── callProxy (trial mode) ───────────────────────────────────────────────
    proxySignin: {
        en: "You need to sign in to use trial mode. Please log in.",
        tr: "Deneme modunu kullanmak için oturum açmanız gerekiyor. Lütfen giriş yapın.",
        de: "Für den Testmodus müssen Sie sich anmelden. Bitte loggen Sie sich ein.",
        fr: "Vous devez vous connecter pour utiliser le mode d'essai. Veuillez vous identifier.",
        es: "Debes iniciar sesión para usar el modo de prueba. Por favor, inicia sesión.",
    },
    proxyTimeout: {
        en: "The trial service did not respond (timeout). Check your internet connection or switch to Advanced mode with your own key in Settings → Model.",
        tr: "Deneme servisi yanıt vermedi (zaman aşımı). İnternet bağlantınızı kontrol edin veya Ayarlar → Model bölümünden kendi anahtarınızla Gelişmiş moda geçin.",
        de: "Der Testdienst hat nicht geantwortet (Timeout). Prüfen Sie Ihre Internetverbindung oder wechseln Sie unter Einstellungen → Modell mit eigenem Schlüssel in den erweiterten Modus.",
        fr: "Le service d'essai n'a pas répondu (délai dépassé). Vérifiez votre connexion Internet ou passez en mode avancé avec votre propre clé dans Paramètres → Modèle.",
        es: "El servicio de prueba no respondió (tiempo agotado). Comprueba tu conexión a Internet o cambia al modo avanzado con tu propia clave en Ajustes → Modelo.",
    },
    proxyWaking: {
        en: "The trial service seems to be waking up from sleep (free server). Wait ~30 seconds and try again, or switch to Advanced mode in Settings → Model.",
        tr: "Deneme servisi uykudan uyanıyor gibi görünüyor (ücretsiz sunucu). ~30 saniye bekleyip tekrar deneyin veya Ayarlar → Model bölümünden Gelişmiş moda geçin.",
        de: "Der Testdienst scheint gerade aus dem Ruhezustand aufzuwachen (kostenloser Server). Warten Sie ca. 30 Sekunden und versuchen Sie es erneut, oder wechseln Sie unter Einstellungen → Modell in den erweiterten Modus.",
        fr: "Le service d'essai semble sortir de veille (serveur gratuit). Attendez ~30 secondes et réessayez, ou passez en mode avancé dans Paramètres → Modèle.",
        es: "El servicio de prueba parece estar despertando (servidor gratuito). Espera ~30 segundos e inténtalo de nuevo, o cambia al modo avanzado en Ajustes → Modelo.",
    },
    proxyUnreachable: {
        en: "Cannot reach the trial service. Check your internet connection or switch to Advanced mode in Settings → Model.",
        tr: "Deneme servisine ulaşılamıyor. İnternet bağlantınızı kontrol edin veya Ayarlar → Model bölümünden Gelişmiş moda geçin.",
        de: "Der Testdienst ist nicht erreichbar. Prüfen Sie Ihre Internetverbindung oder wechseln Sie unter Einstellungen → Modell in den erweiterten Modus.",
        fr: "Impossible de joindre le service d'essai. Vérifiez votre connexion Internet ou passez en mode avancé dans Paramètres → Modèle.",
        es: "No se puede acceder al servicio de prueba. Comprueba tu conexión a Internet o cambia al modo avanzado en Ajustes → Modelo.",
    },
    proxyLimit: {
        en: "Your daily trial limit is used up. Add your own Groq key or try again tomorrow.",
        tr: "Günlük deneme limitiniz doldu. Kendi Groq anahtarınızı ekleyin veya yarın tekrar deneyin.",
        de: "Ihr tägliches Testlimit ist aufgebraucht. Fügen Sie Ihren eigenen Groq-Schlüssel hinzu oder versuchen Sie es morgen erneut.",
        fr: "Votre limite d'essai quotidienne est épuisée. Ajoutez votre propre clé Groq ou réessayez demain.",
        es: "Tu límite diario de prueba se ha agotado. Añade tu propia clave de Groq o inténtalo de nuevo mañana.",
    },
    proxyTpm: {
        en: "There's heavy load right now (per-minute rate limit). Wait a few seconds and try again; shorten your message if it's too long.",
        tr: "Şu anda yoğunluk var (dakikalık hız limiti). Birkaç saniye bekleyip tekrar deneyin; mesajınız çok uzunsa kısaltın.",
        de: "Gerade herrscht hohe Last (Rate-Limit pro Minute). Warten Sie einige Sekunden und versuchen Sie es erneut; kürzen Sie Ihre Nachricht, falls sie zu lang ist.",
        fr: "Forte charge en ce moment (limite de débit par minute). Attendez quelques secondes et réessayez ; raccourcissez votre message s'il est trop long.",
        es: "Hay mucha carga en este momento (límite de velocidad por minuto). Espera unos segundos e inténtalo de nuevo; acorta tu mensaje si es demasiado largo.",
    },
    proxyBusy: {
        en: "The trial service is temporarily busy. Try again in a few seconds.",
        tr: "Deneme servisi geçici olarak meşgul. Birkaç saniye sonra tekrar deneyin.",
        de: "Der Testdienst ist vorübergehend ausgelastet. Versuchen Sie es in einigen Sekunden erneut.",
        fr: "Le service d'essai est temporairement occupé. Réessayez dans quelques secondes.",
        es: "El servicio de prueba está temporalmente ocupado. Inténtalo de nuevo en unos segundos.",
    },
    proxy413: {
        en: "Your message or attached files are too large. Try a shorter message or a smaller file.",
        tr: "Mesajınız veya eklediğiniz dosyalar çok büyük. Daha kısa bir mesaj veya daha küçük bir dosya deneyin.",
        de: "Ihre Nachricht oder die angehängten Dateien sind zu groß. Versuchen Sie eine kürzere Nachricht oder eine kleinere Datei.",
        fr: "Votre message ou les fichiers joints sont trop volumineux. Essayez un message plus court ou un fichier plus petit.",
        es: "Tu mensaje o los archivos adjuntos son demasiado grandes. Prueba con un mensaje más corto o un archivo más pequeño.",
    },
    proxy401: {
        en: "Your session is invalid for trial mode. Please log out and sign in again.",
        tr: "Oturumunuz deneme modu için geçersiz. Lütfen çıkış yapıp yeniden giriş yapın.",
        de: "Ihre Sitzung ist für den Testmodus ungültig. Bitte melden Sie sich ab und wieder an.",
        fr: "Votre session est invalide pour le mode d'essai. Veuillez vous déconnecter puis vous reconnecter.",
        es: "Tu sesión no es válida para el modo de prueba. Cierra sesión y vuelve a iniciarla.",
    },
    proxy5xx: {
        en: "A temporary error occurred on the trial server. Try again.",
        tr: "Deneme sunucusunda geçici bir hata oluştu. Tekrar deneyin.",
        de: "Auf dem Testserver ist ein vorübergehender Fehler aufgetreten. Versuchen Sie es erneut.",
        fr: "Une erreur temporaire s'est produite sur le serveur d'essai. Réessayez.",
        es: "Se produjo un error temporal en el servidor de prueba. Inténtalo de nuevo.",
    },
    proxyGeneric: {
        en: "Trial service error{detail}",
        tr: "Deneme servisi hatası{detail}",
        de: "Testdienst-Fehler{detail}",
        fr: "Erreur du service d'essai{detail}",
        es: "Error del servicio de prueba{detail}",
    },
    // ── friendlyAuthError ────────────────────────────────────────────────────
    authNet: {
        en: "Could not reach the server. The free trial server may be waking up from sleep — wait ~30 seconds and try again (also check your internet connection).",
        tr: "Sunucuya ulaşılamadı. Ücretsiz deneme sunucusu uykudan uyanıyor olabilir — ~30 saniye bekleyip tekrar deneyin (internet bağlantınızı da kontrol edin).",
        de: "Der Server war nicht erreichbar. Der kostenlose Testserver wacht möglicherweise gerade auf — warten Sie ca. 30 Sekunden und versuchen Sie es erneut (prüfen Sie auch Ihre Internetverbindung).",
        fr: "Impossible de joindre le serveur. Le serveur d'essai gratuit sort peut-être de veille — attendez ~30 secondes et réessayez (vérifiez aussi votre connexion Internet).",
        es: "No se pudo acceder al servidor. El servidor de prueba gratuito puede estar despertando — espera ~30 segundos e inténtalo de nuevo (comprueba también tu conexión a Internet).",
    },
    authBadCreds: {
        en: "Email or password is incorrect.",
        tr: "E-posta veya şifre hatalı.",
        de: "E-Mail oder Passwort ist falsch.",
        fr: "L'adresse e-mail ou le mot de passe est incorrect.",
        es: "El correo o la contraseña son incorrectos.",
    },
    authExists: {
        en: "This email is already registered — use Sign In instead.",
        tr: "Bu e-posta zaten kayıtlı — bunun yerine Giriş Yap'ı kullanın.",
        de: "Diese E-Mail ist bereits registriert — verwenden Sie stattdessen die Anmeldung.",
        fr: "Cet e-mail est déjà enregistré — utilisez plutôt la connexion.",
        es: "Este correo ya está registrado — usa Iniciar sesión en su lugar.",
    },
    authRate: {
        en: "Too many attempts — wait a minute and try again.",
        tr: "Çok fazla deneme yapıldı — bir dakika bekleyip tekrar deneyin.",
        de: "Zu viele Versuche — warten Sie eine Minute und versuchen Sie es erneut.",
        fr: "Trop de tentatives — attendez une minute et réessayez.",
        es: "Demasiados intentos — espera un minuto e inténtalo de nuevo.",
    },
    authUnconfirmed: {
        en: "This email hasn't been confirmed yet — check your inbox.",
        tr: "Bu e-posta henüz doğrulanmadı — gelen kutunuzu kontrol edin.",
        de: "Diese E-Mail wurde noch nicht bestätigt — prüfen Sie Ihren Posteingang.",
        fr: "Cet e-mail n'a pas encore été confirmé — vérifiez votre boîte de réception.",
        es: "Este correo aún no se ha confirmado — revisa tu bandeja de entrada.",
    },
    authBadEmail: {
        en: "That doesn't look like a valid email address.",
        tr: "Bu geçerli bir e-posta adresine benzemiyor.",
        de: "Das sieht nicht nach einer gültigen E-Mail-Adresse aus.",
        fr: "Cela ne ressemble pas à une adresse e-mail valide.",
        es: "Eso no parece una dirección de correo válida.",
    },
    netDown: {
        en: "Could not establish an internet connection. Check your network and try again.",
        tr: "İnternet bağlantısı kurulamadı. Ağınızı kontrol edip tekrar deneyin.",
        de: "Es konnte keine Internetverbindung hergestellt werden. Prüfen Sie Ihr Netzwerk und versuchen Sie es erneut.",
        fr: "Impossible d'établir une connexion Internet. Vérifiez votre réseau et réessayez.",
        es: "No se pudo establecer una conexión a Internet. Comprueba tu red e inténtalo de nuevo.",
    },
    // ── main.ts system notices ───────────────────────────────────────────────
    noticeFullAccessOff: {
        en: "Full PC Access was automatically turned off after 30 minutes. Re-enable it in Settings if you still need it.",
        tr: "Tam PC Erişimi 30 dakika sonra otomatik olarak kapatıldı. Hâlâ ihtiyacınız varsa Ayarlar'dan yeniden etkinleştirin.",
        de: "Der vollständige PC-Zugriff wurde nach 30 Minuten automatisch deaktiviert. Aktivieren Sie ihn bei Bedarf in den Einstellungen erneut.",
        fr: "L'accès complet au PC a été automatiquement désactivé après 30 minutes. Réactivez-le dans les Paramètres si vous en avez encore besoin.",
        es: "El acceso completo al PC se desactivó automáticamente después de 30 minutos. Vuelve a activarlo en Ajustes si aún lo necesitas.",
    },
    noticeCloudSyncFail: {
        en: "Could not sync your settings to the cloud ({error}). Your change is saved locally; it will retry on the next edit.",
        tr: "Ayarlarınız buluta eşitlenemedi ({error}). Değişikliğiniz yerel olarak kaydedildi; bir sonraki düzenlemede yeniden denenecek.",
        de: "Ihre Einstellungen konnten nicht mit der Cloud synchronisiert werden ({error}). Ihre Änderung wurde lokal gespeichert; beim nächsten Bearbeiten wird es erneut versucht.",
        fr: "Impossible de synchroniser vos paramètres avec le cloud ({error}). Votre modification est enregistrée localement ; nouvelle tentative à la prochaine modification.",
        es: "No se pudieron sincronizar tus ajustes con la nube ({error}). Tu cambio se guardó localmente; se reintentará en la próxima edición.",
    },
    noticeScreenCaptured: {
        en: "AEGIS just captured your screen.",
        tr: "AEGIS az önce ekranınızın görüntüsünü aldı.",
        de: "AEGIS hat soeben Ihren Bildschirm aufgenommen.",
        fr: "AEGIS vient de capturer votre écran.",
        es: "AEGIS acaba de capturar tu pantalla.",
    },
    noticeDataReset: {
        en: "The following data was corrupted and has been reset to defaults: {files}. A backup of each broken file was saved as \".bak\" in ~/.aegis/.",
        tr: "Şu veriler bozulmuştu ve varsayılanlara sıfırlandı: {files}. Her bozuk dosyanın yedeği ~/.aegis/ içine \".bak\" olarak kaydedildi.",
        de: "Die folgenden Daten waren beschädigt und wurden auf die Standardwerte zurückgesetzt: {files}. Von jeder defekten Datei wurde eine Sicherung als \".bak\" in ~/.aegis/ gespeichert.",
        fr: "Les données suivantes étaient corrompues et ont été réinitialisées : {files}. Une sauvegarde de chaque fichier endommagé a été enregistrée sous \".bak\" dans ~/.aegis/.",
        es: "Los siguientes datos estaban dañados y se restablecieron a los valores predeterminados: {files}. Se guardó una copia de cada archivo dañado como \".bak\" en ~/.aegis/.",
    },
    noticeBgError: {
        en: "A background error occurred: {msg}",
        tr: "Arka planda bir hata oluştu: {msg}",
        de: "Im Hintergrund ist ein Fehler aufgetreten: {msg}",
        fr: "Une erreur est survenue en arrière-plan : {msg}",
        es: "Ocurrió un error en segundo plano: {msg}",
    },
    noticeUnexpectedError: {
        en: "An unexpected error occurred: {msg}",
        tr: "Beklenmeyen bir hata oluştu: {msg}",
        de: "Ein unerwarteter Fehler ist aufgetreten: {msg}",
        fr: "Une erreur inattendue s'est produite : {msg}",
        es: "Ocurrió un error inesperado: {msg}",
    },
    // ── Tray menu ────────────────────────────────────────────────────────────
    trayShow: {
        en: "Show",
        tr: "Göster",
        de: "Anzeigen",
        fr: "Afficher",
        es: "Mostrar",
    },
    trayMic: {
        en: "Open Microphone",
        tr: "Mikrofonu Aç",
        de: "Mikrofon öffnen",
        fr: "Ouvrir le microphone",
        es: "Abrir micrófono",
    },
    trayExit: {
        en: "Exit",
        tr: "Çıkış",
        de: "Beenden",
        fr: "Quitter",
        es: "Salir",
    },
} satisfies Catalog;

export type BackendMsgKey = keyof typeof M;

// Translate a backend message. {placeholders} are replaced from params;
// missing params are left as-is (visible in dev, harmless in prod).
export function bt(key: BackendMsgKey, params?: Record<string, string | number>): string {
    let text: string = M[key][currentLang] ?? M[key].en;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            text = text.split(`{${k}}`).join(String(v));
        }
    }
    return text;
}
