import type {Lang} from "./i18n";

// ── Yama notları / Patch notes ────────────────────────────────────────────────
// Tek kaynak: her sürüm + 5 dilde madde listesi. Yeni sürümde en üste ekle.
// date: YYYY-MM-DD (gösterimde kullanıcının locale'ine göre biçimlenir).

export interface ChangelogEntry {
    version: string;
    date: string;
    notes: Record<Lang, string[]>;
}

export const CHANGELOG: ChangelogEntry[] = [
    {
        version: "1.11.0",
        date: "2026-06-21",
        notes: {
            tr: [
                "İlk kurulum ekranı baştan tasarlandı: temiz, modern, yumuşak arayüz — dil, mod, hesap ve API anahtarı adımları artık çok daha anlaşılır.",
                "Kurulumda gelişmiş ayarlar (Supabase, web arama) artık katlanır bir bölümde gizli — yeni kullanıcı yalnızca tek zorunlu alanı görüyor.",
                "Hata durumunda artık tüm ekran kıpkırmızı olmuyor: ortam sakin accent renginde kalır, yalnızca reaktör ve hata mesajı kırmızı vurgu verir.",
            ],
            en: [
                "Redesigned first-run setup: a clean, modern, soft interface — language, mode, account and API-key steps are now much clearer.",
                "Advanced setup options (Supabase, web search) now live in a collapsible section — new users only see the single required field.",
                "Errors no longer paint the whole screen red: the environment stays in the calm accent color, only the reactor and error message turn red.",
            ],
            de: [
                "Neu gestalteter Ersteinrichtungsbildschirm: eine saubere, moderne, sanfte Oberfläche — Sprache, Modus, Konto und API-Schlüssel sind jetzt viel klarer.",
                "Erweiterte Optionen (Supabase, Websuche) liegen jetzt in einem aufklappbaren Bereich — neue Nutzer sehen nur das eine Pflichtfeld.",
                "Fehler färben nicht mehr den ganzen Bildschirm rot: die Umgebung bleibt in der ruhigen Akzentfarbe, nur Reaktor und Fehlermeldung werden rot.",
            ],
            fr: [
                "Écran de configuration initiale repensé : une interface épurée, moderne et douce — langue, mode, compte et clé API sont bien plus clairs.",
                "Les options avancées (Supabase, recherche web) sont désormais dans une section repliable — le nouvel utilisateur ne voit que le seul champ requis.",
                "Les erreurs ne colorent plus tout l'écran en rouge : l'environnement garde la couleur d'accent apaisée, seuls le réacteur et le message d'erreur passent au rouge.",
            ],
            es: [
                "Pantalla de configuración inicial rediseñada: una interfaz limpia, moderna y suave — idioma, modo, cuenta y clave API ahora mucho más claros.",
                "Las opciones avanzadas (Supabase, búsqueda web) ahora están en una sección plegable — el nuevo usuario solo ve el único campo obligatorio.",
                "Los errores ya no tiñen toda la pantalla de rojo: el entorno mantiene el color de acento tranquilo, solo el reactor y el mensaje de error se vuelven rojos.",
            ],
        },
    },
    {
        version: "1.10.0",
        date: "2026-06-20",
        notes: {
            tr: [
                "Yeni görsel paneller: Spotify gibi diğer alanların da artık canlı arayüzü var.",
                "Sol panele 3 yeni widget: çalışan Steam oyunu (kapatma butonuyla), pomodoro geri sayımı, akıllı ev (tümünü aç/kapat).",
                "Hafıza penceresi: AEGIS'in senin hakkında öğrendiği her şeyi gör, içinde ara, sil — başlık çubuğundaki beyin simgesi.",
                "Komut Merkezi (ızgara simgesi): tek pencerede görevler, bilgi tabanı, otomasyonlar, hedefler, kişilikler ve pluginler — sekmeler arası geçiş.",
            ],
            en: [
                "New visual panels: other areas now have a live interface too, just like Spotify.",
                "3 new left-panel widgets: running Steam game (with close button), pomodoro countdown, smart home (all on/off).",
                "Memory window: see everything AEGIS has learned about you, search it, delete entries — brain icon in the title bar.",
                "Command Center (grid icon): tasks, knowledge base, automations, goals, personas and plugins in one tabbed window.",
            ],
            de: [
                "Neue visuelle Panels: Andere Bereiche haben jetzt auch eine Live-Oberfläche, genau wie Spotify.",
                "3 neue Widgets im linken Panel: laufendes Steam-Spiel (mit Schließen-Button), Pomodoro-Countdown, Smart Home (alles an/aus).",
                "Gedächtnis-Fenster: Sieh alles, was AEGIS über dich gelernt hat, durchsuche und lösche es — Gehirn-Symbol in der Titelleiste.",
                "Kommandozentrale (Raster-Symbol): Aufgaben, Wissensbasis, Automatisierungen, Ziele, Personas und Plugins in einem Fenster mit Tabs.",
            ],
            fr: [
                "Nouveaux panneaux visuels : d'autres domaines ont aussi une interface en direct, comme Spotify.",
                "3 nouveaux widgets dans le panneau gauche : jeu Steam en cours (avec bouton fermer), minuteur pomodoro, maison connectée (tout allumer/éteindre).",
                "Fenêtre Mémoire : voyez tout ce qu'AEGIS a appris sur vous, recherchez, supprimez — icône cerveau dans la barre de titre.",
                "Centre de commande (icône grille) : tâches, base de connaissances, automatisations, objectifs, personas et plugins dans une fenêtre à onglets.",
            ],
            es: [
                "Nuevos paneles visuales: otras áreas ahora también tienen interfaz en vivo, igual que Spotify.",
                "3 nuevos widgets en el panel izquierdo: juego de Steam en ejecución (con botón cerrar), cuenta atrás pomodoro, hogar inteligente (todo encender/apagar).",
                "Ventana de memoria: ve todo lo que AEGIS ha aprendido sobre ti, búscalo, elimínalo — icono de cerebro en la barra de título.",
                "Centro de comandos (icono de cuadrícula): tareas, base de conocimiento, automatizaciones, objetivos, personas y plugins en una ventana con pestañas.",
            ],
        },
    },
    {
        version: "1.9.0",
        date: "2026-06-20",
        notes: {
            tr: [
                "Güvenilirlik sürümü: AEGIS artık daha az takılıyor, tehlikeli işlerde soruyor ve hatalardan öğreniyor.",
                "Döngü koruması: aynı işi boşuna tekrarlayıp takılmak yerine durup durumu net söyler.",
                "Güvenlik onayı: dosya silme, süreç kapatma gibi geri alınamaz işlemlerde önce onay ister ('her zaman izin ver' ile öğretebilirsin).",
                "Sızıntı koruması: bir .env/şifre dosyasını okuttuğunda API anahtarların ve parolaların yapay zekâya gitmeden otomatik maskelenir.",
                "Daha akıllı hafıza: konuşmadan otomatik öğrenir ('adım X', 'Python kullanıyorum'), çelişki olursa eskiyi günceller; 'geçen ay ne demiştim' diye arayabilirsin.",
                "Görevleri bitirme: çok adımlı işlerde plan yapar, her adımı doğrular, takılınca körlemesine tekrar yerine yön değiştirir.",
                "Proaktif öneriler (opsiyonel, varsayılan kapalı): alışkanlıklarını fark edip otomatikleştirmeyi teklif eder — Ayarlar'dan açıp kapatabilirsin.",
                "Tool seçim doğruluğu ölçülüp %100'e çıkarıldı (daha az 'bir çalışıyor bir çalışmıyor').",
            ],
            en: [
                "Reliability release: AEGIS now gets stuck less, asks before risky actions, and learns from errors.",
                "Loop guard: instead of pointlessly repeating the same action and freezing, it stops and tells you clearly.",
                "Safety approval: irreversible actions (deleting files, killing processes) now ask for confirmation first ('always allow' to teach it).",
                "Leak protection: when you have it read a .env/secrets file, your API keys and passwords are auto-masked before reaching the AI.",
                "Smarter memory: it auto-learns from conversation ('my name is X', 'I use Python'), updates the old fact on conflict; you can ask 'what did I say last month'.",
                "Finishing tasks: for multi-step jobs it plans, verifies each step, and changes strategy instead of blindly retrying when stuck.",
                "Proactive suggestions (optional, off by default): notices your habits and offers to automate them — toggle in Settings.",
                "Tool-selection accuracy measured and raised to 100% (fewer 'works sometimes' issues).",
            ],
            de: [
                "Zuverlässigkeits-Release: AEGIS bleibt seltener hängen, fragt vor riskanten Aktionen und lernt aus Fehlern.",
                "Schleifenschutz: Statt dieselbe Aktion sinnlos zu wiederholen und einzufrieren, hält es an und sagt es klar.",
                "Sicherheitsbestätigung: Unwiderrufliche Aktionen (Dateien löschen, Prozesse beenden) fragen zuerst nach Bestätigung ('immer erlauben' zum Lernen).",
                "Leck-Schutz: Wenn eine .env/Secrets-Datei gelesen wird, werden API-Schlüssel und Passwörter automatisch maskiert, bevor sie die KI erreichen.",
                "Klügeres Gedächtnis: lernt automatisch aus Gesprächen ('mein Name ist X', 'ich nutze Python'), aktualisiert bei Konflikt; du kannst fragen 'was habe ich letzten Monat gesagt'.",
                "Aufgaben abschließen: bei mehrstufigen Jobs plant es, prüft jeden Schritt und ändert die Strategie statt blind zu wiederholen.",
                "Proaktive Vorschläge (optional, standardmäßig aus): erkennt Gewohnheiten und bietet Automatisierung an — in Einstellungen umschaltbar.",
                "Tool-Auswahl-Genauigkeit gemessen und auf 100% erhöht (weniger 'funktioniert mal, mal nicht').",
            ],
            fr: [
                "Version fiabilité : AEGIS se bloque moins, demande avant les actions risquées et apprend de ses erreurs.",
                "Garde anti-boucle : au lieu de répéter inutilement la même action et de se figer, il s'arrête et le dit clairement.",
                "Approbation de sécurité : les actions irréversibles (suppression de fichiers, arrêt de processus) demandent d'abord confirmation (« toujours autoriser » pour apprendre).",
                "Protection contre les fuites : quand vous lui faites lire un .env/fichier de secrets, vos clés API et mots de passe sont masqués avant d'atteindre l'IA.",
                "Mémoire plus intelligente : apprend automatiquement (« je m'appelle X », « j'utilise Python »), met à jour en cas de conflit ; vous pouvez demander « qu'ai-je dit le mois dernier ».",
                "Terminer les tâches : pour les travaux en plusieurs étapes, il planifie, vérifie chaque étape et change de stratégie au lieu de réessayer aveuglément.",
                "Suggestions proactives (optionnel, désactivé par défaut) : repère vos habitudes et propose de les automatiser — réglable dans Paramètres.",
                "Précision de sélection d'outils mesurée et portée à 100% (moins de « ça marche une fois sur deux »).",
            ],
            es: [
                "Versión de fiabilidad: AEGIS se bloquea menos, pregunta antes de acciones arriesgadas y aprende de los errores.",
                "Protección de bucle: en vez de repetir la misma acción sin sentido y congelarse, se detiene y lo dice claramente.",
                "Aprobación de seguridad: las acciones irreversibles (borrar archivos, terminar procesos) piden confirmación primero ('permitir siempre' para enseñarle).",
                "Protección de fugas: cuando le haces leer un .env/archivo de secretos, tus claves API y contraseñas se enmascaran antes de llegar a la IA.",
                "Memoria más inteligente: aprende de la conversación ('me llamo X', 'uso Python'), actualiza en conflicto; puedes preguntar 'qué dije el mes pasado'.",
                "Terminar tareas: en trabajos de varios pasos planifica, verifica cada paso y cambia de estrategia en vez de reintentar a ciegas.",
                "Sugerencias proactivas (opcional, desactivado por defecto): detecta tus hábitos y ofrece automatizarlos — ajustable en Configuración.",
                "Precisión de selección de herramientas medida y elevada al 100% (menos 'a veces funciona').",
            ],
        },
    },
    {
        version: "1.8.0",
        date: "2026-06-18",
        notes: {
            tr: [
                "Yeni: yerel ağ cihaz keşfi — Home Assistant olmadan da evdeki cihazları (Chromecast, akıllı TV, yazıcı, hoparlör vb.) ağda tarayıp bulur. 'Ağdaki cihazları tara' deyin.",
                "Güvenilirlik: 8 yapay zekâ sağlayıcısının tamamı resmi dokümana göre yeniden doğrulandı; Gemini API anahtarı artık URL yerine güvenli başlıkta gönderiliyor, eski/kullanımdan kalkan modeller temizlendi.",
                "Düzeltme: e-posta SMTP kurulumunda şifre aslında kasaya kaydedilmiyordu — artık gerçekten güvenli kasaya yazılıyor.",
                "İç iyileştirme: kod tabanı sadeleştirildi ve hızlandırıldı; test sayısı 213'ten 376'ya çıkarıldı (daha az 'bir çalışıyor bir çalışmıyor').",
            ],
            en: [
                "New: local network device discovery — even without Home Assistant, AEGIS scans your network for devices (Chromecast, smart TVs, printers, speakers, etc.). Just say 'scan network devices'.",
                "Reliability: all 8 AI providers re-verified against official docs; the Gemini API key is now sent in a secure header instead of the URL, and deprecated models were cleaned up.",
                "Fix: email SMTP setup wasn't actually saving the password to the vault — it now really does.",
                "Internal: codebase streamlined and sped up; test count raised from 213 to 376 (fewer 'works sometimes' issues).",
            ],
            de: [
                "Neu: Geräteerkennung im lokalen Netzwerk — auch ohne Home Assistant durchsucht AEGIS das Netzwerk nach Geräten (Chromecast, Smart-TVs, Drucker, Lautsprecher usw.). Sagen Sie einfach 'Netzwerkgeräte scannen'.",
                "Zuverlässigkeit: Alle 8 KI-Anbieter anhand der offiziellen Doku neu verifiziert; der Gemini-API-Schlüssel wird jetzt in einem sicheren Header statt in der URL gesendet, veraltete Modelle wurden entfernt.",
                "Fehlerbehebung: Bei der E-Mail-SMTP-Einrichtung wurde das Passwort nicht wirklich im Tresor gespeichert — jetzt schon.",
                "Intern: Codebasis verschlankt und beschleunigt; Testanzahl von 213 auf 376 erhöht (weniger 'funktioniert mal, mal nicht').",
            ],
            fr: [
                "Nouveau : découverte des appareils du réseau local — même sans Home Assistant, AEGIS scanne le réseau à la recherche d'appareils (Chromecast, TV connectées, imprimantes, enceintes, etc.). Dites simplement « scanner les appareils du réseau ».",
                "Fiabilité : les 8 fournisseurs d'IA revérifiés selon la doc officielle ; la clé API Gemini est désormais envoyée dans un en-tête sécurisé plutôt que dans l'URL, et les modèles obsolètes ont été supprimés.",
                "Correctif : la configuration SMTP des e-mails n'enregistrait pas réellement le mot de passe dans le coffre — c'est désormais le cas.",
                "Interne : base de code allégée et accélérée ; nombre de tests porté de 213 à 376 (moins de « ça marche une fois sur deux »).",
            ],
            es: [
                "Nuevo: descubrimiento de dispositivos en la red local — incluso sin Home Assistant, AEGIS escanea la red en busca de dispositivos (Chromecast, smart TVs, impresoras, altavoces, etc.). Solo di 'escanear dispositivos de red'.",
                "Fiabilidad: los 8 proveedores de IA reverificados según la documentación oficial; la clave de API de Gemini ahora se envía en una cabecera segura en lugar de en la URL, y se eliminaron modelos obsoletos.",
                "Corrección: la configuración SMTP del correo no guardaba realmente la contraseña en la bóveda — ahora sí lo hace.",
                "Interno: base de código simplificada y acelerada; número de pruebas elevado de 213 a 376 (menos 'a veces funciona').",
            ],
        },
    },
    {
        version: "1.7.1",
        date: "2026-06-16",
        notes: {
            tr: [
                "Güncelleme düzeltmesi: 'İNDİR'e bastıktan sonra buton ~2 saniye sonra geri geliyordu ve indirme başlamıyor gibi görünüyordu — artık indirme durumu korunuyor ve ilerleme sorunsuz gösteriliyor.",
            ],
            en: [
                "Updater fix: after clicking 'DOWNLOAD' the button reappeared after ~2 seconds and it looked like the download never started — the downloading state is now preserved and progress shows smoothly.",
            ],
            de: [
                "Updater-Korrektur: Nach dem Klick auf 'HERUNTERLADEN' erschien die Schaltfläche nach ~2 Sekunden wieder und der Download schien nicht zu starten — der Download-Status bleibt jetzt erhalten und der Fortschritt wird sauber angezeigt.",
            ],
            fr: [
                "Correctif de mise à jour : après avoir cliqué sur « TÉLÉCHARGER », le bouton réapparaissait après ~2 secondes et le téléchargement semblait ne pas démarrer — l'état de téléchargement est désormais conservé et la progression s'affiche correctement.",
            ],
            es: [
                "Corrección del actualizador: tras pulsar 'DESCARGAR', el botón reaparecía después de ~2 segundos y parecía que la descarga no comenzaba — ahora se conserva el estado de descarga y el progreso se muestra correctamente.",
            ],
        },
    },
    {
        version: "1.7.0",
        date: "2026-06-16",
        notes: {
            tr: [
                "Routines (Rutinler): birden fazla işlemi tek isim altında kaydet. 'Kayıt başlat: Oyun Modu' de, yapmamı istediğin şeyleri komut olarak ver, 'kayıt bitir' de — sonra 'Oyun Modunu aç' deyince hepsi sırayla otomatik çalışır.",
                "Routine'ler deterministik çalışır: kaydedilen adımlar doğrudan uygulanır, modele yeniden sorulmaz — hızlı ve tutarlı.",
                "Routine yönetimi: listele, sil, yeniden adlandır, içeriğini göster ve tek tek adım çıkararak düzenle.",
                "Kayıt akıllı süzer: yalnızca durum değiştiren eylemler (Spotify/Steam/sistem/dosya) kaydedilir; arama ve ekran görüntüsü gibi salt-okuma işlemleri atlanır.",
            ],
            en: [
                "Routines: save multiple actions under one name. Say 'start recording: Game Mode', give your commands, say 'stop recording' — then 'turn on Game Mode' runs them all in order automatically.",
                "Routines run deterministically: recorded steps are applied directly without asking the model again — fast and consistent.",
                "Routine management: list, delete, rename, show contents, and edit by removing individual steps.",
                "Recording filters smartly: only state-changing actions (Spotify/Steam/system/file) are captured; read-only operations like search and screenshot are skipped.",
            ],
            de: [
                "Routinen: Mehrere Aktionen unter einem Namen speichern. Sage 'Aufnahme starten: Spielmodus', gib deine Befehle, sage 'Aufnahme beenden' — dann führt 'Spielmodus einschalten' alles automatisch der Reihe nach aus.",
                "Routinen laufen deterministisch: Aufgezeichnete Schritte werden direkt ausgeführt, ohne das Modell erneut zu fragen — schnell und konsistent.",
                "Routinenverwaltung: auflisten, löschen, umbenennen, Inhalt anzeigen und durch Entfernen einzelner Schritte bearbeiten.",
                "Die Aufnahme filtert intelligent: Nur zustandsändernde Aktionen (Spotify/Steam/System/Datei) werden erfasst; reine Lesevorgänge wie Suche und Screenshot werden übersprungen.",
            ],
            fr: [
                "Routines : enregistrez plusieurs actions sous un seul nom. Dites « démarre l'enregistrement : Mode Jeu », donnez vos commandes, dites « arrête l'enregistrement » — ensuite « active le Mode Jeu » les exécute toutes dans l'ordre automatiquement.",
                "Les routines s'exécutent de façon déterministe : les étapes enregistrées sont appliquées directement sans redemander au modèle — rapide et cohérent.",
                "Gestion des routines : lister, supprimer, renommer, afficher le contenu et modifier en retirant des étapes individuelles.",
                "L'enregistrement filtre intelligemment : seules les actions modifiant l'état (Spotify/Steam/système/fichier) sont capturées ; les opérations en lecture seule comme la recherche et la capture d'écran sont ignorées.",
            ],
            es: [
                "Rutinas: guarda varias acciones bajo un solo nombre. Di 'inicia grabación: Modo Juego', da tus comandos, di 'detén grabación' — luego 'activa el Modo Juego' las ejecuta todas en orden automáticamente.",
                "Las rutinas se ejecutan de forma determinista: los pasos grabados se aplican directamente sin volver a preguntar al modelo — rápido y consistente.",
                "Gestión de rutinas: listar, eliminar, renombrar, mostrar el contenido y editar quitando pasos individuales.",
                "La grabación filtra de forma inteligente: solo se capturan las acciones que cambian el estado (Spotify/Steam/sistema/archivo); se omiten las operaciones de solo lectura como búsqueda y captura de pantalla.",
            ],
        },
    },
    {
        version: "1.6.1",
        date: "2026-06-16",
        notes: {
            tr: [
                "Çok dilli güvenilirlik: İngilizce, Almanca, Fransızca ve İspanyolca komutlar artık doğru aracı çağırıyor — önceden bu dillerde 'Spotify çal', 'sesi ayarla', 'dosyayı oku' gibi komutlar bazen hiç çalışmıyordu (sadece Türkçe sağlamdı).",
                "Spotify: 'play killshot' / 'change it to X' gibi komutlarda çıkan 'Model yanıt üretemedi' hatası giderildi — şarkıyı adıyla çalma artık tek araçla çalışıyor.",
                "Steam istek listesi: 'oyunu istek listeme ekle' artık mağaza sayfasını açıp '+ İstek Listesine Ekle' butonuna otomatik tıklamayı deniyor (eskiden sadece sayfayı açıyordu).",
            ],
            en: [
                "Multilingual reliability: English, German, French and Spanish commands now trigger the correct tool — previously commands like 'play music', 'set the volume', 'read the file' sometimes did nothing in those languages (only Turkish was solid).",
                "Spotify: fixed the 'model could not generate a response' error on commands like 'play killshot' / 'change it to X' — playing a song by name now works in one step.",
                "Steam wishlist: 'add the game to my wishlist' now opens the store page and tries to auto-click the '+ Add to wishlist' button (previously it only opened the page).",
            ],
            de: [
                "Mehrsprachige Zuverlässigkeit: Englische, deutsche, französische und spanische Befehle lösen jetzt das richtige Werkzeug aus — zuvor taten Befehle wie 'Musik abspielen', 'Lautstärke einstellen', 'Datei lesen' in diesen Sprachen manchmal nichts (nur Türkisch war stabil).",
                "Spotify: Fehler 'Modell konnte keine Antwort erzeugen' bei Befehlen wie 'play killshot' / 'change it to X' behoben — ein Lied per Name abspielen funktioniert jetzt in einem Schritt.",
                "Steam-Wunschliste: 'Spiel zur Wunschliste hinzufügen' öffnet jetzt die Store-Seite und versucht, den Button '+ Zur Wunschliste' automatisch zu klicken (vorher nur Seite geöffnet).",
            ],
            fr: [
                "Fiabilité multilingue : les commandes en anglais, allemand, français et espagnol déclenchent désormais le bon outil — auparavant des commandes comme « joue de la musique », « règle le volume », « lis le fichier » ne faisaient parfois rien dans ces langues (seul le turc était solide).",
                "Spotify : corrigé l'erreur « le modèle n'a pas pu générer de réponse » sur des commandes comme « play killshot » / « change it to X » — lire une chanson par son nom fonctionne maintenant en une étape.",
                "Liste de souhaits Steam : « ajoute le jeu à ma liste de souhaits » ouvre désormais la page boutique et tente de cliquer automatiquement sur « + Ajouter à la liste de souhaits » (avant, la page s'ouvrait seulement).",
            ],
            es: [
                "Fiabilidad multilingüe: los comandos en inglés, alemán, francés y español ahora activan la herramienta correcta — antes comandos como 'reproduce música', 'ajusta el volumen', 'lee el archivo' a veces no hacían nada en esos idiomas (solo el turco era sólido).",
                "Spotify: corregido el error 'el modelo no pudo generar una respuesta' en comandos como 'play killshot' / 'change it to X' — reproducir una canción por su nombre ahora funciona en un paso.",
                "Lista de deseos de Steam: 'añade el juego a mi lista de deseos' ahora abre la página de la tienda e intenta hacer clic automáticamente en '+ Añadir a la lista de deseos' (antes solo abría la página).",
            ],
        },
    },
    {
        version: "1.6.0",
        date: "2026-06-15",
        notes: {
            tr: [
                "Jarvis Güvenilirlik Güncellemesi: 'tekrar yap', 'onu kapat', 'biraz azalt', 'son oynadığım oyunu aç' gibi referans komutları artık kural tabanlı ve tutarlı çözülüyor — modele bırakılmıyor.",
                "Kısa süreli hafıza güçlendirildi: her işlem hangi nesne üzerinde (oyun, dosya, şarkı, uygulama) ve hangi kaynakla (model mi refleks mi) yapıldığını hatırlıyor.",
                "Emin olunmadığında rastgele işlem yapmak yerine netleştirme soruluyor.",
                "Geliştirici için 'Açıklama Modu': açıkken niyet, güven skoru ve referans çözümleme adımları gösterilir.",
            ],
            en: [
                "Jarvis Reliability Upgrade: reference commands like 'do it again', 'close it', 'turn it down a bit', 'open the last game I played' are now resolved by deterministic rules — no longer left to the model.",
                "Short-term memory hardened: each action remembers what it acted on (game, file, track, app) and its source (model vs. reflex).",
                "When unsure, AEGIS asks for clarification instead of firing a random action.",
                "Developer 'Explain Mode': when on, shows intent, confidence score and reference-resolution steps.",
            ],
            de: [
                "Jarvis-Zuverlässigkeits-Update: Referenzbefehle wie 'mach das nochmal', 'schließ es', 'etwas leiser', 'öffne das zuletzt gespielte Spiel' werden jetzt regelbasiert und konsistent aufgelöst — nicht mehr dem Modell überlassen.",
                "Kurzzeitgedächtnis gestärkt: Jede Aktion merkt sich, worauf sie wirkte (Spiel, Datei, Titel, App) und ihre Quelle (Modell vs. Reflex).",
                "Bei Unsicherheit fragt AEGIS nach, statt eine zufällige Aktion auszulösen.",
                "Entwickler-'Erklärmodus': zeigt Absicht, Konfidenzwert und Schritte der Referenzauflösung.",
            ],
            fr: [
                "Mise à jour Fiabilité Jarvis : les commandes de référence comme « refais-le », « ferme-le », « baisse un peu », « ouvre le dernier jeu joué » sont désormais résolues par des règles déterministes — plus laissées au modèle.",
                "Mémoire à court terme renforcée : chaque action retient sur quoi elle a agi (jeu, fichier, titre, appli) et sa source (modèle ou réflexe).",
                "En cas de doute, AEGIS demande des précisions au lieu de lancer une action au hasard.",
                "« Mode Explication » développeur : affiche l'intention, le score de confiance et les étapes de résolution des références.",
            ],
            es: [
                "Actualización de Fiabilidad Jarvis: comandos de referencia como 'hazlo otra vez', 'ciérralo', 'baja un poco', 'abre el último juego que jugué' ahora se resuelven con reglas deterministas, sin dejarlo al modelo.",
                "Memoria a corto plazo reforzada: cada acción recuerda sobre qué actuó (juego, archivo, canción, app) y su origen (modelo o reflejo).",
                "Ante la duda, AEGIS pide aclaración en lugar de ejecutar una acción al azar.",
                "'Modo Explicación' para desarrolladores: muestra intención, puntuación de confianza y pasos de resolución de referencias.",
            ],
        },
    },
    {
        version: "1.5.1",
        date: "2026-06-15",
        notes: {
            tr: [
                "Güncelleme indirme hatası giderildi: 'Güncellemeleri Denetle' sonrası 'İndir'e basınca çıkan 'Please check update first' hatası düzeltildi. Artık denetleme ve indirme aynı güncelleme motorunu kullanıyor.",
            ],
            en: [
                "Fixed update download error: the 'Please check update first' error after pressing 'Download' (following 'Check for updates') is resolved. Check and download now use the same update engine.",
            ],
            de: [
                "Update-Download-Fehler behoben: Der Fehler 'Please check update first' nach 'Herunterladen' (nach 'Nach Updates suchen') ist behoben. Prüfung und Download nutzen jetzt dieselbe Update-Engine.",
            ],
            fr: [
                "Erreur de téléchargement corrigée : l'erreur « Please check update first » après « Télécharger » (suite à « Rechercher des mises à jour ») est résolue. La vérification et le téléchargement utilisent désormais le même moteur.",
            ],
            es: [
                "Corregido el error de descarga: el error 'Please check update first' al pulsar 'Descargar' (tras 'Buscar actualizaciones') está resuelto. La comprobación y la descarga ahora usan el mismo motor.",
            ],
        },
    },
    {
        version: "1.5.0",
        date: "2026-06-15",
        notes: {
            tr: [
                "Steam entegrasyonu büyük ölçüde genişledi: oyun başlat/kapat/yeniden başlat, yüklü oyunlar, mağaza arama, fiyat, indirimler ve haberler.",
                "Steam API key + SteamID girince: kütüphane, oynama süreleri, başarımlar, profil, seviye ve arkadaş listesi de kullanılabilir (Ayarlar > API Keys).",
                "İstek listesi, indirme yönetimi, Workshop ve yedekleme gibi gelişmiş Steam işlemleri deneysel olarak eklendi.",
            ],
            en: [
                "Steam integration greatly expanded: launch/close/restart games, installed games, store search, price, discounts and news.",
                "With a Steam API key + SteamID: library, playtimes, achievements, profile, level and friend list become available too (Settings > API Keys).",
                "Advanced Steam actions (wishlist, download management, Workshop, backups) added as experimental.",
            ],
            de: [
                "Steam-Integration stark erweitert: Spiele starten/schließen/neu starten, installierte Spiele, Store-Suche, Preis, Angebote und News.",
                "Mit Steam-API-Key + SteamID: auch Bibliothek, Spielzeiten, Erfolge, Profil, Level und Freundesliste (Einstellungen > API Keys).",
                "Erweiterte Steam-Aktionen (Wunschliste, Download-Verwaltung, Workshop, Backups) als experimentell hinzugefügt.",
            ],
            fr: [
                "Intégration Steam largement étendue : lancer/fermer/relancer des jeux, jeux installés, recherche boutique, prix, promotions et actualités.",
                "Avec une clé API Steam + SteamID : bibliothèque, temps de jeu, succès, profil, niveau et liste d'amis aussi (Paramètres > API Keys).",
                "Actions Steam avancées (liste de souhaits, gestion des téléchargements, Workshop, sauvegardes) ajoutées en expérimental.",
            ],
            es: [
                "Integración con Steam ampliada: abrir/cerrar/reiniciar juegos, juegos instalados, búsqueda en la tienda, precio, ofertas y noticias.",
                "Con una API key de Steam + SteamID: también biblioteca, tiempos de juego, logros, perfil, nivel y lista de amigos (Ajustes > API Keys).",
                "Acciones avanzadas de Steam (lista de deseos, gestión de descargas, Workshop, copias) añadidas como experimentales.",
            ],
        },
    },
    {
        version: "1.4.5",
        date: "2026-06-15",
        notes: {
            tr: [
                "Güncelleme indirme düzeltildi: artık takılıp 'indiriliyor…' diye sonsuza kalmıyor; hata olursa görünür mesaj + 'tekrar dene' çıkıyor.",
                "İndirme bildirimi (toast) ilerleme çubuğu ve yüzde gösteriyor; sekme değiştirince / ayarları kapatınca kaybolmuyor.",
            ],
            en: [
                "Update download fixed: no more endless 'downloading…' hang; on failure you get a visible error + 'retry'.",
                "Download toast shows a progress bar and percentage; it no longer disappears when switching tabs or closing settings.",
            ],
            de: [
                "Update-Download behoben: kein endloses 'wird geladen…' mehr; bei Fehler erscheint eine sichtbare Meldung + 'erneut versuchen'.",
                "Download-Hinweis zeigt Fortschrittsbalken und Prozent; verschwindet nicht mehr beim Tab-Wechsel oder Schließen der Einstellungen.",
            ],
            fr: [
                "Téléchargement des mises à jour corrigé : plus de blocage « téléchargement… » sans fin ; en cas d'échec, message visible + « réessayer ».",
                "La notification affiche une barre de progression et le pourcentage ; elle ne disparaît plus en changeant d'onglet ou en fermant les paramètres.",
            ],
            es: [
                "Descarga de actualizaciones corregida: ya no se queda atascada en 'descargando…'; si falla, muestra un error visible + 'reintentar'.",
                "El aviso muestra una barra de progreso y el porcentaje; ya no desaparece al cambiar de pestaña o cerrar ajustes.",
            ],
        },
    },
    {
        version: "1.4.4",
        date: "2026-06-14",
        notes: {
            tr: [
                "Güncelleme artık otomatik inmiyor — sadece 'yeni sürüm var' bildirimi geliyor; indirmeyi sen başlatıyorsun.",
                "Bu ekran: Hakkında sekmesine çok dilli yama notları eklendi (uygulamanın 5 dilinde).",
            ],
            en: [
                "Updates no longer download automatically — you only get a 'new version available' notice and start the download yourself.",
                "This screen: multilingual patch notes added to the About tab (in all 5 app languages).",
            ],
            de: [
                "Updates werden nicht mehr automatisch geladen — du erhältst nur einen Hinweis 'neue Version verfügbar' und startest den Download selbst.",
                "Dieser Bildschirm: mehrsprachige Änderungshinweise im Über-Tab (in allen 5 App-Sprachen).",
            ],
            fr: [
                "Les mises à jour ne se téléchargent plus automatiquement — vous recevez seulement un avis « nouvelle version disponible » et lancez le téléchargement vous-même.",
                "Cet écran : notes de version multilingues ajoutées à l'onglet À propos (dans les 5 langues de l'app).",
            ],
            es: [
                "Las actualizaciones ya no se descargan automáticamente: solo recibes un aviso de 'nueva versión disponible' e inicias la descarga tú mismo.",
                "Esta pantalla: notas de versión multilingües añadidas a la pestaña Acerca de (en los 5 idiomas de la app).",
            ],
        },
    },
    {
        version: "1.4.3",
        date: "2026-06-14",
        notes: {
            tr: [
                "Kokoro TTS paketlenmiş uygulamada gerçekten çalışıyor: kütüphane dahili, ~900MB model yazılabilir klasöre iniyor (eski 'cmd.exe ENOENT' hatası giderildi).",
                "Kokoro 'sil' artık model dosyalarını gerçekten siliyor; durum diskten doğrulanıyor.",
                "Spotify 'Beğenilen Şarkılar' çalma ve ~1 dk takılma düzeltildi (Liked Songs özel olarak çalınıyor).",
            ],
            en: [
                "Kokoro TTS now actually works in the packaged app: library bundled, ~900MB model downloads to a writable folder (old 'cmd.exe ENOENT' error fixed).",
                "Kokoro 'delete' now truly removes the model files; state verified from disk.",
                "Fixed Spotify 'Liked Songs' playback and the ~1 min hang (Liked Songs played specially).",
            ],
            de: [
                "Kokoro TTS funktioniert jetzt in der gepackten App: Bibliothek enthalten, ~900 MB Modell wird in einen beschreibbaren Ordner geladen ('cmd.exe ENOENT'-Fehler behoben).",
                "Kokoro 'Löschen' entfernt die Modelldateien nun wirklich; Status wird von der Festplatte geprüft.",
                "Spotify-Wiedergabe der 'Lieblingssongs' und ~1-min-Hänger behoben.",
            ],
            fr: [
                "Kokoro TTS fonctionne enfin dans l'app packagée : bibliothèque incluse, modèle ~900 Mo téléchargé dans un dossier inscriptible (erreur 'cmd.exe ENOENT' corrigée).",
                "« Supprimer » Kokoro retire réellement les fichiers du modèle ; état vérifié sur le disque.",
                "Correction de la lecture des « Titres likés » Spotify et du blocage d'~1 min.",
            ],
            es: [
                "Kokoro TTS ya funciona en la app empaquetada: librería incluida, el modelo de ~900 MB se descarga en una carpeta escribible (corregido el error 'cmd.exe ENOENT').",
                "'Eliminar' Kokoro borra de verdad los archivos del modelo; estado verificado desde el disco.",
                "Corregida la reproducción de 'Tus me gusta' de Spotify y el bloqueo de ~1 min.",
            ],
        },
    },
    {
        version: "1.4.0",
        date: "2026-06-14",
        notes: {
            tr: [
                "Spotify Web API tam entegrasyonu (96 uç nokta): sanatçı, albüm, şarkı, çalma listesi, öneri, takip ve daha fazlası. Sanatçı araçları artık isim de kabul ediyor.",
                "Araç güvenilirliği: 263 aracın tamamı statik ve çalışma-zamanı doğrulamasından geçti; tool seçim açıkları ('bazen çalışıyor bazen çalışmıyor') kapatıldı.",
                "Kısa süreli bellek + referans çözümleme ('biraz azalt', 'tekrar yap').",
            ],
            en: [
                "Full Spotify Web API integration (96 endpoints): artists, albums, tracks, playlists, recommendations, follow and more. Artist tools now accept names too.",
                "Tool reliability: all 263 tools passed static and runtime validation; tool-selection gaps ('sometimes works, sometimes not') closed.",
                "Short-term memory + reference resolution ('turn it down a bit', 'do that again').",
            ],
            de: [
                "Vollständige Spotify-Web-API-Integration (96 Endpunkte): Künstler, Alben, Titel, Playlists, Empfehlungen, Folgen u. v. m. Künstler-Tools akzeptieren jetzt auch Namen.",
                "Tool-Zuverlässigkeit: alle 263 Tools statisch und zur Laufzeit geprüft; Auswahllücken behoben.",
                "Kurzzeitgedächtnis + Referenzauflösung ('etwas leiser', 'mach das nochmal').",
            ],
            fr: [
                "Intégration complète de l'API Web Spotify (96 points de terminaison) : artistes, albums, titres, playlists, recommandations, suivi, etc. Les outils artiste acceptent désormais les noms.",
                "Fiabilité des outils : les 263 outils ont passé la validation statique et à l'exécution ; failles de sélection corrigées.",
                "Mémoire court terme + résolution de références (« baisse un peu », « refais ça »).",
            ],
            es: [
                "Integración completa de la API Web de Spotify (96 endpoints): artistas, álbumes, canciones, listas, recomendaciones, seguir y más. Las herramientas de artista ahora aceptan nombres.",
                "Fiabilidad de herramientas: las 263 herramientas pasaron la validación estática y en tiempo de ejecución; cerradas las brechas de selección.",
                "Memoria a corto plazo + resolución de referencias ('bájalo un poco', 'hazlo otra vez').",
            ],
        },
    },
];
