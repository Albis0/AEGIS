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
        version: "0.7.3",
        date: "2026-07-06",
        notes: {
            tr: [
                "Kritik düzeltme: Deneme modu kurulumu tamamlanınca uygulama kapanıyordu — düzeltildi.",
                "Yeni AEGIS uygulama ikonu (exe, kısayollar ve sistem tepsisi).",
                "Sesli okuma artık cümleler arasında takılmadan akıcı ilerliyor (ön-sentezleme).",
                "Deneme sunucusu uykudan uyanırken istekler otomatik yeniden denenir; ham ağ hatası gösterilmez.",
                "Hata bildir formuna ekran görüntüsü ekleme geldi; açılıştaki bilgi mesajları artık kırmızı değil yumuşak renkte.",
                "Ayarlar paneli 5 dilde tamamen çevrildi; model kataloğu güncellendi (eski/kaldırılmış modeller temizlendi).",
            ],
            en: [
                "Critical fix: the app quit after finishing trial-mode onboarding — fixed.",
                "New AEGIS app icon (exe, shortcuts and system tray).",
                "Text-to-speech now flows smoothly between sentences (audio prefetching).",
                "Requests retry automatically while the trial server wakes from sleep; no more raw network errors.",
                "Bug-report form gained screenshot attachments; startup notices are now soft-colored instead of red.",
                "Settings panel fully translated into all 5 languages; model catalog updated (deprecated models removed).",
            ],
            de: [
                "Kritischer Fix: Die App beendete sich nach Abschluss des Testmodus-Onboardings — behoben.",
                "Neues AEGIS-App-Icon (Exe, Verknüpfungen und Systemleiste).",
                "Sprachausgabe fließt jetzt ohne Stocken zwischen Sätzen (Audio-Vorabsynthese).",
                "Anfragen werden automatisch wiederholt, während der Testserver aufwacht; keine rohen Netzwerkfehler mehr.",
                "Fehlerbericht-Formular unterstützt jetzt Screenshots; Starthinweise sind nicht mehr rot, sondern dezent gefärbt.",
                "Einstellungen vollständig in alle 5 Sprachen übersetzt; Modellkatalog aktualisiert.",
            ],
            fr: [
                "Correctif critique : l'application se fermait après l'onboarding du mode d'essai — corrigé.",
                "Nouvelle icône AEGIS (exe, raccourcis et barre système).",
                "La synthèse vocale enchaîne désormais les phrases sans accroc (pré-synthèse audio).",
                "Les requêtes sont automatiquement réessayées pendant que le serveur d'essai se réveille ; plus d'erreurs réseau brutes.",
                "Le formulaire de rapport de bug accepte les captures d'écran ; les notifications de démarrage sont désormais en couleur douce.",
                "Panneau de paramètres entièrement traduit dans les 5 langues ; catalogue de modèles mis à jour.",
            ],
            es: [
                "Corrección crítica: la aplicación se cerraba al terminar el onboarding del modo de prueba — corregido.",
                "Nuevo icono de AEGIS (exe, accesos directos y bandeja del sistema).",
                "La síntesis de voz ahora fluye entre frases sin pausas (preprocesado de audio).",
                "Las solicitudes se reintentan automáticamente mientras el servidor de prueba despierta; se acabaron los errores de red sin formato.",
                "El formulario de informe de errores admite capturas de pantalla; los avisos de inicio ahora usan colores suaves en lugar de rojo.",
                "Panel de ajustes totalmente traducido a los 5 idiomas; catálogo de modelos actualizado.",
            ],
        },
    },
    {
        version: "0.7.2",
        date: "2026-06-21",
        notes: {
            tr: [
                "İlk public sürüm. AEGIS hâlâ geliştirme aşamasında — her şey tam çalışmayabilir; bilinen sorunlar sonraki sürümlerde düzeltilmeye çalışılacak.",
                "Konuşma tanıma, çoklu LLM desteği ve yüzlerce araçla sistem, medya, akıllı ev ve üretkenlik kontrolü.",
                "Geri bildirim ve hata raporları memnuniyetle karşılanır.",
            ],
            en: [
                "First public release. AEGIS is still under active development — not everything works perfectly yet; known issues will be addressed in upcoming versions.",
                "Speech recognition, multi-LLM support, and hundreds of tools to control your system, media, smart home, and productivity.",
                "Feedback and bug reports are very welcome.",
            ],
            de: [
                "Erste öffentliche Version. AEGIS befindet sich noch in aktiver Entwicklung — noch funktioniert nicht alles perfekt; bekannte Probleme werden in kommenden Versionen behoben.",
                "Spracherkennung, Multi-LLM-Unterstützung und Hunderte von Tools zur Steuerung von System, Medien, Smart Home und Produktivität.",
                "Feedback und Fehlerberichte sind herzlich willkommen.",
            ],
            fr: [
                "Première version publique. AEGIS est encore en développement actif — tout ne fonctionne pas encore parfaitement ; les problèmes connus seront corrigés dans les prochaines versions.",
                "Reconnaissance vocale, prise en charge multi-LLM et des centaines d'outils pour contrôler votre système, vos médias, votre maison connectée et votre productivité.",
                "Vos retours et rapports de bug sont les bienvenus.",
            ],
            es: [
                "Primera versión pública. AEGIS sigue en desarrollo activo — todavía no todo funciona a la perfección; los problemas conocidos se irán corrigiendo en próximas versiones.",
                "Reconocimiento de voz, soporte multi-LLM y cientos de herramientas para controlar tu sistema, multimedia, hogar inteligente y productividad.",
                "Los comentarios y reportes de errores son bienvenidos.",
            ],
        },
    },
];
