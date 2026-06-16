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
