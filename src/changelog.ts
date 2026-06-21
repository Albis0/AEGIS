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
