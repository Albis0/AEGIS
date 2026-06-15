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
