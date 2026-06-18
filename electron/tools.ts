import {exec as execCb} from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type {ChatCompletionTool} from "groq-sdk/resources/chat/completions";
import {setUserProfile, getUserProfile, saveNote, getPendingNotes, markNoteDone} from "./db";
import {toolScheduleTask, toolListScheduledTasks, toolCancelScheduledTask, toolToggleScheduledTask} from "./scheduler";
import {startMacroRecording, stopMacroRecording, listMacros, deleteMacro, getMacroSteps} from "./macros";
import * as routines from "./routines";
import {addAutomation, listAutomations, removeAutomation, toggleAutomation} from "./automations";
import {indexFile, indexFolder, searchKnowledge, readFileForChat, listIndexedFiles, removeFromIndex} from "./knowledge";
import {addFact, listFacts, removeFact, listHabits} from "./memory-plus";
import {vaultStore, vaultList, vaultDelete, privacyAudit, clearOldData} from "./vault";
import {pluginSearch, pluginInstall, pluginRemove} from "./plugin-manager";
import {playSound, ambientStart, ambientStop, listSounds} from "./sound-player";
import {fetchWithTimeout} from "./fetch-utils";
import {pomodoroStart, pomodoroStop, timeTrackStart, timeTrackStop, timeTrackReport} from "./time-manager";
import {addPersona, listPersonas, setActivePersona, getActivePersona, startRoleplay, stopRoleplay} from "./persona";
import {addFlashcard, reviewFlashcard, addReadingItem, getReadingList, summarizeUrl, setGoal, checkInGoal, listGoals} from "./learning";
import {modelCompare, pipelineRun, listPipelines, savePipeline, getModelRoutingRules, setModelRoutingRule} from "./model-router";
import {translationStart, translationStop, translateText, translateFile, subtitleToggle} from "./translator";
import {getRecentNotifications, notifFilterSet, notifFilterList, dndSet, dndOff, getNotifHistory} from "./notif-monitor";
import {buildProject, runTests, lintProject, formatCode, getProjectInfo} from "./dev-runner";
import {rssAdd, rssRemove, rssList, rssFetch, getPrice, getCryptoPrice, getFxRate, priceAlertSet} from "./feeds";
import {meetingStart, meetingStop, meetingList, meetingSummarize, meetingExport, meetingActionItems} from "./meeting";
import {getActiveContext, contextRuleSet, contextRuleList, clipboardWatch, clipboardHistory, clipboardSearch} from "./context-actions";
import {fileSearch, contentSearch, appSearch} from "./search-plus";
import {killHeavyProcesses, suspendProcess, resumeProcess, clearTemp, flushDns, startupManager, perfModeStart, perfModeStop} from "./sys-optimizer";
import {workspaceCreate, workspaceSwitch, workspaceList, workspaceDelete, workspaceExport, workspaceImport} from "./workspace";
import {dailyReport, weeklyReport, productivityInsights} from "./reporter";
import {spotifyAuthorizeCmd, spotifyPlay, spotifyPause, spotifyNext, spotifyPrev, spotifySetVolume, spotifyGetState, spotifyOpen, spotifySearchPlay, spotifyListPlaylists, spotifyPlayPlaylist, spotifyLikeTrack, spotifyAddToQueue, spotifyListDevices, spotifyTransferDevice, spotifySetShuffle, spotifySetRepeat, spotifySeek, spotifyGetRecentlyPlayed, spotifyGetQueue, spotifyGetAlbum, spotifyGetAlbumTracks, spotifyGetSavedAlbums, spotifySaveAlbum, spotifyRemoveSavedAlbum, spotifyGetArtist, spotifyGetArtistTopTracks, spotifyGetArtistAlbums, spotifyGetRelatedArtists, spotifyGetTrack, spotifyGetAudioFeatures, spotifyGetRecommendations, spotifyGetPlaylist, spotifyGetPlaylistItems, spotifyCreatePlaylist, spotifyPlaylistAdd, spotifyPlaylistRemove, spotifyGetFeaturedPlaylists, spotifyGetSavedTracks, spotifyCheckSavedTracks, spotifyGetSavedShows, spotifyGetSavedEpisodes, spotifyGetSavedAudiobooks, spotifyGetCurrentUser, spotifyGetTopItems, spotifyFollowArtist, spotifyUnfollowArtist, spotifyGetFollowedArtists, spotifyGetNewReleases, spotifyGetCategories, spotifyGetShow, spotifyGetShowEpisodes, spotifyGetEpisode, spotifyGetAudiobook} from "./spotify";
import {
    steamLaunchGame, steamListGames, steamOpen, steamClose, steamGameRunning,
    steamRestart, steamCloseGame, steamRestartGame, steamListRunningGames, steamIsGameRunning,
    steamInstallGame, steamUninstallGame, steamVerifyGameFiles, steamUpdateGame,
    steamDownloadStatus, steamPauseResumeCancel,
    steamOpenStorePage, steamOpenWorkshop, steamWorkshopSubscribe, steamListWorkshopSubs,
    steamOpenScreenshots, steamShowStorageUsage, steamLocateInstallation, steamOpenGameFolder,
    steamBackupGame, steamRestoreBackup, steamOpenChat, steamSendMessage, steamRepeatLastAction,
    steamWishlistAdd, steamWishlistList, steamTakeScreenshot,
    steamGetOwnedGames, steamSearchOwnedGames, steamGetRecentGames, steamGetMostPlayed,
    steamGetGamePlaytime, steamGetTotalPlaytime, steamSuggestGame,
    steamGetGameAchievements, steamGetAchievementProgress, steamGetPlayerStats,
    steamGetProfileSummary, steamGetLevel, steamGetFriendList, steamGetOnlineFriends,
    steamGetFriendCurrentGame, steamWhoIsPlaying, steamGetLastPlayed,
    steamSearchStore, steamGetGameDetails, steamGetGamePrice, steamGetDiscountedGames, steamGetGameNews,
} from "./steam";
import {mouseMove, mouseClick, mouseScroll, mouseDrag, keyPress, typeText, getScreenSize} from "./computer-use";
import {stmGet} from "./short-term-memory";
import * as smartHome from "./smart-home";
import type {HAConfig, Action as SmartHomeAction} from "./smart-home";
import {discoverAll, getNetworkInfo, formatDevices} from "./local-devices";
// Tool şemaları (saf veri) ayrı dosyada — burada yalnız import + executor mantığı.
import {
    toolSchemas, extraSchemas,
    schedulerSchemas, marketplaceSchemas, securitySchemas, memoryPlusSchemas,
    knowledgeSchemas, automationSchemas, macroSchemas, routineSchemas, agentSchemas,
    watchSchemas, soundSchemas, codeToolSchemas, timeSchemas, mediaSchemas,
    personaSchemas, networkSchemas, vizSchemas, emailSchemas, learningSchemas,
    iotSchemas, smartHomeSchemas, multiModelSchemas, spotifySchemas, steamSchemas,
    computerUseSchemas,
} from "./tools/schemas";
// main.ts toolSchemas/extraSchemas'ı "./tools"ten import ediyor → geriye uyumlu re-export.
export {toolSchemas, extraSchemas};

type ToolResult = string;

function resolvePath(p: string): string {
    if (!p) return os.homedir();
    // Model bazen şema "string" demesine rağmen sayı/obje gönderebilir — stringe zorla.
    if (typeof p !== "string") p = String(p);
    if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) {
        return path.join(os.homedir(), p.slice(1));
    }
    return path.isAbsolute(p) ? p : path.join(os.homedir(), p);
}

function run(cmd: string, timeoutMs = 30000): Promise<ToolResult> {
    return new Promise((resolve) => {
        execCb(cmd, {timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024}, (err, stdout, stderr) => {
            const out = (stdout ?? "").trim();
            const errOut = (stderr ?? "").trim();
            if (err && !out) {
                resolve(`HATA: ${err.message}${errOut ? "\n" + errOut : ""}`);
            } else {
                resolve(out || errOut || "(çıktı yok, komut çalıştı)");
            }
        });
    });
}

// Sadece geri alınamaz sistem yıkımı — process öldürme, uygulama kapatma SERBEST
const SYSTEM_DESTROY_PATTERNS: {pattern: RegExp; reason: string}[] = [
    {pattern: /Format-Volume/i,         reason: "Disk formatlamak geri alınamaz."},
    {pattern: /Clear-Disk/i,            reason: "Disk silmek geri alınamaz."},
    {pattern: /Initialize-Disk/i,       reason: "Disk başlatmak geri alınamaz."},
    {pattern: /shutdown\s+\/[sr]/i,     reason: "Sistemi kapatmak/yeniden başlatmak."},
    {pattern: /Restart-Computer/i,      reason: "Sistemi yeniden başlatmak."},
    {pattern: /Stop-Computer/i,         reason: "Sistemi kapatmak."},
    {pattern: /Remove-Item.*-Recurse.*[A-Za-z]:\\/i, reason: "Toplu dosya/klasör silmek geri alınamaz."},
];

let _quitCallback: (() => void) | null = null;
export function registerQuitCallback(cb: () => void): void { _quitCallback = cb; }

let _setLanguageCallback: ((lang: string) => void) | null = null;
export function registerSetLanguageCallback(cb: (lang: string) => void): void { _setLanguageCallback = cb; }

// screenshot: () => Promise<{ base64: string; width: number; height: number } | { error: string }>
// analyzeScreen: (base64, prompt) => Promise<string>
let _screenshotCallback: (() => Promise<{base64: string; width: number; height: number} | {error: string}>) | null = null;
let _analyzeScreenCallback: ((base64: string, prompt: string) => Promise<string>) | null = null;
export function registerScreenshotCallback(cb: typeof _screenshotCallback): void { _screenshotCallback = cb; }
export function registerAnalyzeScreenCallback(cb: typeof _analyzeScreenCallback): void { _analyzeScreenCallback = cb; }

let _remindCallback: ((message: string) => void) | null = null;
export function registerRemindCallback(cb: (message: string) => void): void { _remindCallback = cb; }

let _fullPcAccess = false;
export function setFullPcAccess(enabled: boolean): void { _fullPcAccess = enabled; }

let _disabledTools: Set<string> = new Set();
export function setDisabledTools(names: string[]): void { _disabledTools = new Set(names); }

let _notificationCallback: ((title: string, body: string) => void) | null = null;
export function registerNotificationCallback(cb: (title: string, body: string) => void): void { _notificationCallback = cb; }

// Plugin infrastructure — populated by main.ts after loadPlugins()
const _pluginExecutors: Record<string, (args: Record<string, string>) => Promise<ToolResult>> = {};
export function registerPluginExecutors(executors: Record<string, (args: Record<string, unknown>) => Promise<string>>): void {
    for (const key of Object.keys(_pluginExecutors)) delete _pluginExecutors[key];
    Object.assign(_pluginExecutors, executors);
}


const PROVIDER_TOOL_LIMITS: Record<string, number> = {
    groq:       64,
    openai:    128,
    anthropic:  64,
    mistral:    64,
    gemini:    128,
    xai:        64,
    deepseek:   64,
    ollama:     64,
};

// Çekirdek tool'lar — yalnızca bir AKSİYON niyeti olduğunda gönderilir.
// NOT: spotifySchemas burada YOK — TOOL_GROUPS üzerinden gelir. İkiye çıkmasın.
const CORE_SCHEMAS = () => [...toolSchemas, ...extraSchemas];

// Aksiyon fiil/isim KÖKLERİ — hepsi NORMALIZE (ASCII, ç→c ş→s ı→i ö→o ü→u ğ→g).
// Eşleştirme normalize edilmiş kelimeler üzerinde startsWith ile yapılır; Türkçe
// ekler sona geldiğinden kök yeter (ac→aciyor, gonder→gonderdim). Kelime-içi
// false-positive (nasilsin→sil) yaşanmaz çünkü kelimenin BAŞINA bakılır.
const ACTION_ROOTS = [
    "ac", "kapat", "calis", "baslat", "durdur", "yaz", "oku", "sil", "tasi", "kopyala",
    "indir", "kur", "yukle", "ara", "bul", "getir", "goster", "listele", "olustur",
    "ekle", "kaydet", "gonder", "hatirlat", "zamanla", "ayarla", "degistir", "guncelle",
    "kontrol", "tara", "baglan", "olc", "hesapla", "cevir", "donustur", "cal", "yazdir",
    "komut", "dosya", "klasor", "ekran", "sistem", "process", "servis", "uygulama", "program",
    "open", "close", "start", "stop", "write", "read", "delete", "move", "copy", "download",
    "install", "search", "find", "create", "send", "remind", "schedule", "update", "check",
    "scan", "connect", "play", "print", "launch", "run", "file", "folder", "screen",
    // Referans/devam & eksik aksiyon kökleri (harness ile bulundu):
    "azalt", "artir", "art", "kis", "yuksel", "dusur", "arttir", "yarila", "biraz",
    "parlak", "brightness", "tekrar", "yine", "aktar", "transfer", "temizle", "optimize",
    "bas", "tikla", "biliyor", "hakk", "tani", "bil", "pomodoro", "indeks", "rapor", "report",
    // ── Çok dilli aksiyon kökleri (DE/FR/ES) — lang-scan ile bulundu ──
    // Almanca
    "offne", "schliess", "starte", "stoppe", "spiel", "abspiel", "lies", "schreib", "loschen",
    "such", "erstell", "sende", "zeig", "liste", "einstell", "andere", "erhoh", "verring",
    "helligkeit", "lautstark", "screenshot", "bildschirm", "datei", "ordner", "pinge", "starten",
    // Fransızca
    "ouvre", "ferme", "lance", "demarre", "arrete", "joue", "lis", "ecris", "supprim",
    "cherche", "trouve", "cree", "envoie", "montre", "affiche", "regle", "change", "augment",
    "baisse", "diminue", "luminosite", "volume", "capture", "fichier", "dossier", "ecran",
    // İspanyolca
    "abre", "cierra", "inicia", "lanza", "detén", "deten", "reproduce", "lee", "escribe",
    "elimina", "borra", "busca", "encuentra", "crea", "envia", "muestra", "lista",
    "ajusta", "cambia", "aumenta", "sube", "baja", "reduce", "brillo", "captura", "archivo",
    "carpeta", "pantalla", "haz", "pon",
    // Ortak EN eksikleri
    "set", "increase", "decrease", "turn", "make", "show", "list", "take",
    // Akıllı ev aksiyon kökleri (Faz 62)
    "karart", "aydinlat", "kilitle", "kilid", "dim", "lock", "unlock",
];

// Türkçe karakterleri ASCII'ye indir — kullanıcı "dönüştür" veya "donustur"
// yazsa da aynı eşleşsin. Eşleştirme hep normalize edilmiş metin üzerinde yapılır.
function normalizeTr(s: string): string {
    return s.toLowerCase()
        // Türkçe
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
        .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
        .replace(/î/g, "i").replace(/â/g, "a")
        // Almanca / Fransızca / İspanyolca aksanları — kökler ASCII tutulduğu için
        // ("ecran", "espanol", "anadir") aksanlı girdiyi de ASCII'ye indir.
        .replace(/[äàáâ]/g, "a").replace(/[éèêë]/g, "e").replace(/[íìï]/g, "i")
        .replace(/[óòô]/g, "o").replace(/[úùû]/g, "u").replace(/ñ/g, "n").replace(/ß/g, "ss");
}

// Kelimelere böl (normalize sonrası ASCII).
function tokenize(text: string): string[] {
    return normalizeTr(text).split(/[^a-z0-9]+/).filter(Boolean);
}

// Bir kelime, köklerden biriyle BAŞLIYOR mu? (Türkçe ekler sona gelir: ac→aciyor)
function matchesRoots(words: string[], roots: string[]): boolean {
    return words.some((w) => roots.some((r) => w.startsWith(r)));
}

function hasActionSignal(words: string[]): boolean {
    return matchesRoots(words, ACTION_ROOTS);
}

// Bağlama göre eklenen tool grupları. Kök listesi NORMALIZE edilmiş (ASCII) —
// "resim/resmi", "donustur/dönüştür" gibi varyantları yakalamak için kök tutulur.
// Yanlış tarafa düşmektense (false-negative = tool gelmez, AI yapamaz) FAZLA tool
// göndermek (false-positive = sadece token) tercih edilir.
const TOOL_GROUPS: {schemas: () => ChatCompletionTool[]; roots: string[]}[] = [
    {schemas: () => memoryPlusSchemas,  roots: ["hatirla", "hafiza", "profil", "not", "tani", "tercih", "memory", "remember", "hakk", "biliyor", "bil", "alis", "habit", "fact"]},
    {schemas: () => schedulerSchemas,   roots: ["hatirlat", "zamanla", "schedule", "reminder", "alarm"]},
    {schemas: () => marketplaceSchemas, roots: ["plugin", "eklenti", "marketplace"]},
    {schemas: () => securitySchemas,    roots: ["sifre", "parola", "vault", "kasa", "guvenli", "encrypt", "secret", "gizli"]},
    {schemas: () => knowledgeSchemas,   roots: ["bilgi", "knowledge", "rag", "belge", "dokuman", "index", "indeks"]},
    {schemas: () => automationSchemas,  roots: ["otomasyon", "automation", "tetikle", "trigger", "workflow"]},
    {schemas: () => macroSchemas,       roots: ["makro", "macro"]},
    {schemas: () => routineSchemas,     roots: ["routine", "rutin", "kayit", "record", "kaydet", "kaydi", "kayd", "oyun modu", "mod"]},
    {schemas: () => agentSchemas,       roots: ["ajan", "agent", "otonom"]},
    {schemas: () => watchSchemas,       roots: ["izle", "watch", "uyar", "alert", "esik", "threshold", "takip"]},
    {schemas: () => soundSchemas,       roots: ["bip", "beep", "calar"]},
    {schemas: () => codeToolSchemas,    roots: ["kod", "code", "git", "npm", "derle", "compile", "lint", "repo", "commit", "fonksiyon", "push", "pull", "branch", "merge", "stash", "diff", "staged", "unstaged", "remote", "checkout"]},
    {schemas: () => timeSchemas,        roots: ["saat", "tarih", "zaman", "time", "takvim", "calendar", "timezone", "hafta", "pomodoro", "mola"]},
    {schemas: () => mediaSchemas,       roots: ["resim", "resm", "gorsel", "image", "video", "medya", "media", "foto", "donustur", "convert", "kirp"]},
    {schemas: () => personaSchemas,     roots: ["kisilik", "persona", "karakter"]},
    {schemas: () => networkSchemas,     roots: ["ping", "ssh", "docker", "sunucu", "server", "network", "port"]},
    {schemas: () => vizSchemas,         roots: ["grafik", "chart", "gorsellestir", "rapor", "report", "tablo", "istatistik", "graph"]},
    {schemas: () => emailSchemas,       roots: ["eposta", "email", "mail", "smtp", "imap", "taslak", "inbox"]},
    {schemas: () => learningSchemas,    roots: ["flashcard", "kart", "okuma", "hedef", "goal"]},
    {schemas: () => iotSchemas,         roots: ["bluetooth", "usb", "yazici", "cihaz", "device", "iot", "printer"]},
    {schemas: () => smartHomeSchemas,   roots: [
        // TR
        "isik", "isigi", "isiklar", "lamba", "lamba", "ampul", "abajur", "spot", "led",
        "priz", "fis", "kilit", "kapi", "garaj", "panjur", "perde", "kepenk", "stor",
        "termostat", "isitici", "klima", "soba", "kombi", "sicaklik", "derece", "fan", "vantilator",
        "salon", "yatakodasi", "yatak", "mutfak", "banyo", "oda", "koridor", "bahce", "ev",
        "akilliev", "sahne", "scene", "filmmodu", "iyigeceler", "karart", "aydinlat", "parlaklik",
        "homeassistant", "hue", "tapo", "kasa", "tuya", "matter", "zigbee", "smarthome",
        // EN
        "light", "lights", "lamp", "bulb", "plug", "outlet", "lock", "door", "garage",
        "blind", "blinds", "curtain", "shade", "shutter", "thermostat", "heater", "climate",
        "ac", "temperature", "living", "bedroom", "kitchen", "bathroom", "room", "home", "dim",
        // DE/FR/ES
        "licht", "lampe", "lumiere", "luz", "luces", "schloss", "serrure", "cerradura",
        "thermostat", "heizung", "chauffage", "calefaccion", "wohnzimmer", "schlafzimmer",
        "salon", "chambre", "cocina", "dormitorio", "rollladen", "volet", "persiana",
        // Yerel ağ keşfi (local_devices_scan) — HA gerekmeyen tarama
        "ag", "network", "agda", "tara", "tarat", "kesfet", "kesfi", "bul", "scan",
        "discover", "chromecast", "tv", "airplay", "upnp", "dlna", "yayin", "yerel", "lan", "wifi",
    ]},
    // NOT: multiModelSchemas Faz 32-44'ü kapsayan büyük bir dizi — multi-model,
    // çeviri, dosya/içerik/uygulama arama, sistem optimizasyonu, workspace ve
    // raporlar hep burada. Kökler bu içeriğin TAMAMINI yakalamalı (harness'la bulundu).
    {schemas: () => multiModelSchemas,  roots: [
        "pipeline", "karsilastir", "compare", "model",
        "cevir", "translate", "ceviri", "altyazi", "subtitle",
        "uygulama", "app", "icerik", "content", "dosyaara",
        "optimize", "temizle", "dns", "gecici", "process", "proses", "baslangic", "startup", "performans",
        "workspace", "calismaalani", "alan",
        "rapor", "report", "verimlilik", "productivity", "analiz", "ozet",
    ]},
    {schemas: () => spotifySchemas,     roots: ["spotify", "muzik", "muzigi", "sarki", "cal", "calar", "ses", "sarkilar", "album", "sanatci", "playlist", "next", "skip", "pause", "resume", "begeni", "like", "siray", "queue", "karistir", "shuffle", "tekrar", "repeat", "cihaz", "device", "transfer", "aktar", "bagla", "yetki", "oneri", "recommend", "takip", "follow", "top", "yeni", "release", "kategori", "podcast", "bolum", "episode", "sesli", "audiobook", "kuyrug", "recently", "dinlenen", "dinle", "dinledik", "profil", "ozellik", "feature", "ilgili", "related", "tempo", "enerji", "bpm", "valence", "akustik",
        // Çok dilli müzik/ses (DE/FR/ES + EN): music/musique/música, play/spielen/jouer/reproducir, volume/lautstärke/son, next/nächste/suivant/siguiente
        "music", "musik", "musique", "musica", "song", "lied", "chanson", "cancion",
        "play", "spiel", "abspiel", "joue", "jouer", "reproduce", "reproduz",
        "volume", "lautstark", "lauter", "leiser", "son", "vol", "louder", "quieter",
        "nachste", "suivant", "siguiente", "vorher", "precedent", "anterior", "previous"]},
    {schemas: () => steamSchemas,       roots: ["steam", "oyun", "oyunu", "oyuna", "oyunlar", "game", "launch", "dbd", "cs2", "csgo", "dota", "pubg", "valorant", "minecraft", "gta", "roblox", "fortnite", "basarim", "achievement", "arkadas", "friend", "kutuphane", "library", "magaza", "store", "fiyat", "price", "indirim", "discount", "workshop", "yedek", "backup", "wishlist", "istek", "seviye", "level", "profil", "kur", "install", "dogrula", "validate", "playtime"]},
    {schemas: () => computerUseSchemas, roots: ["tikla", "mouse", "fare", "klavye", "tus", "ekran", "screenshot", "yaz", "drag", "scroll", "click", "type", "screen", "computer_use", "bas", "ctrl", "alt", "enter", "kisayol",
        // Çok dilli ekran/fare/klavye: screen/Bildschirm/écran/pantalla, capture, klick, souris/ratón, clavier/teclado
        "bildschirm", "ecran", "pantalla", "capture", "captura", "klick", "souris", "raton", "clavier", "teclado", "taste", "touche", "tecla"]},
];

// Bir tool adının hangi TOOL_GROUP'a ait olduğunu bul (sticky context için).
// İlk çağrıda hesaplanır, sonra cache'lenir.
let _toolGroupIndex: Map<string, typeof TOOL_GROUPS[number]> | null = null;
function groupForTool(toolName: string): typeof TOOL_GROUPS[number] | null {
    if (!_toolGroupIndex) {
        _toolGroupIndex = new Map();
        for (const group of TOOL_GROUPS) {
            for (const t of group.schemas()) {
                const n = t.function?.name;
                if (n && !_toolGroupIndex.has(n)) _toolGroupIndex.set(n, group);
            }
        }
    }
    return _toolGroupIndex.get(toolName) ?? null;
}

// "Tüm şemalar" listesinin memoize hali (ajan modu sıcak yolu). extraSchemas
// (plugin) uzunluğu değişince geçersizleşir → plugin reload sonrası taze kurulur.
let _allSchemasCache: ChatCompletionTool[] | null = null;
let _allSchemasExtraLen = -1;
function getAllSchemasMemo(): ChatCompletionTool[] {
    if (_allSchemasCache && _allSchemasExtraLen === extraSchemas.length) return _allSchemasCache;
    _allSchemasCache = [
        ...toolSchemas, ...schedulerSchemas, ...marketplaceSchemas, ...securitySchemas,
        ...memoryPlusSchemas, ...knowledgeSchemas, ...automationSchemas, ...macroSchemas,
        ...routineSchemas, ...agentSchemas, ...watchSchemas,
        ...soundSchemas, ...codeToolSchemas, ...timeSchemas, ...mediaSchemas,
        ...personaSchemas, ...networkSchemas, ...vizSchemas, ...emailSchemas,
        ...learningSchemas, ...iotSchemas, ...smartHomeSchemas, ...multiModelSchemas,
        ...spotifySchemas, ...steamSchemas, ...computerUseSchemas,
        ...extraSchemas,
    ];
    _allSchemasExtraLen = extraSchemas.length;
    return _allSchemasCache;
}

// İsme göre tekille (aynı tool birden fazla gruptan gelebilir).
function dedupeByName(tools: ChatCompletionTool[]): ChatCompletionTool[] {
    const seen = new Set<string>();
    const out: ChatCompletionTool[] = [];
    for (const t of tools) {
        const n = t.function?.name ?? "";
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(t);
    }
    return out;
}

// context = son kullanıcı mesajı (düz metin). Verilirse bağlama göre tool seçilir.
export function getAllToolSchemas(provider?: string, context?: string): ChatCompletionTool[] {
    const limit = PROVIDER_TOOL_LIMITS[provider ?? "groq"] ?? 64;

    let selected: ChatCompletionTool[];
    if (context !== undefined) {
        const words = tokenize(context);
        const matchedGroups = TOOL_GROUPS.filter((g) => matchesRoots(words, g.roots));
        const actionSignal = hasActionSignal(words);

        // STICKY ESCAPE: aksiyon kökü ve domain kelimesi YOK ama bir önceki tool
        // bir domain grubuna aitse ("change it to X", "make it Y" gibi İngilizce
        // devam mesajları hiçbir köke uymuyor) → o grubu yine de teklif et.
        // Türkçede "değiştir/azalt" kökü olduğu için bu yola düşmez; sorun yalnız
        // kök taşımayan (çoğu İngilizce) devam mesajlarında. Sohbet kapanışlarını
        // (teşekkürler/tamam/ok…) dışarıda tutmak için kısa+selam kontrolü var.
        const CHATTER = new Set([
            "tesekkurler", "tesekkur", "sagol", "tamam", "ok", "okey", "tamamdir",
            "thanks", "thank", "thx", "cool", "nice", "great", "super", "harika",
            "evet", "hayir", "yes", "no", "peki", "guzel",
        ]);
        const isChatter = words.length > 0 && words.length <= 2 && words.every((w) => CHATTER.has(w));
        const lastToolEarly = stmGet().lastTool;
        const stickyEscape = !actionSignal && matchedGroups.length === 0 &&
            !isChatter && words.length >= 2 && !!lastToolEarly && !!groupForTool(lastToolEarly);

        // Sohbet/selam/saçma metin (aksiyon sinyali yok, grup eşleşmesi yok) → HİÇ tool yok.
        if (!actionSignal && matchedGroups.length === 0 && !stickyEscape) {
            selected = [];
        } else {
            // STICKY CONTEXT: aksiyon var ama domain kelimesi yoksa ("biraz azalt",
            // "telefona aktar", "tekrar yap") bir önceki tool'un grubunu da dahil et —
            // referans çözümleme tool'u kaybolmasın. Yalnızca komut turnlerinde uygulanır.
            const lastTool = stmGet().lastTool;
            if (lastTool) {
                const stickyGroup = groupForTool(lastTool);
                if (stickyGroup && !matchedGroups.includes(stickyGroup)) matchedGroups.push(stickyGroup);
            }
            // Eşleşen grup tool'larını ÖNE al; limit (Groq=64) çekirdek tool'lar
            // yüzünden kullanıcının asıl istediği domain tool'larını KIRPMASIN.
            const groupTools: ChatCompletionTool[] = [];
            for (const group of matchedGroups) groupTools.push(...group.schemas());
            selected = dedupeByName([...groupTools, ...CORE_SCHEMAS()]);
        }
    } else {
        // Bağlam yok (ör. ajan modu döngüsü) → hepsi. Bu liste extraSchemas
        // (plugin) dışında sabit; her döngü adımında 25 array spread etmemek için
        // memoize ediyoruz, yalnız plugin sayısı değişince yeniden kuruyoruz.
        selected = getAllSchemasMemo();
    }

    const filtered = _disabledTools.size > 0
        ? selected.filter((t) => !_disabledTools.has(t.function?.name ?? ""))
        : selected;
    return filtered.slice(0, limit);
}

let _pluginList: {name: string; tools: string[]}[] = [];
export function setPluginList(list: {name: string; tools: string[]}[]): void { _pluginList = list; }

let _reloadPluginsCallback: (() => Promise<string>) | null = null;
export function registerReloadPluginsCallback(cb: () => Promise<string>): void { _reloadPluginsCallback = cb; }

// ---- Agent mode callback ----
type AgentCallback = (goal: string, maxSteps: number) => void;
let _agentCallback: AgentCallback | null = null;
export function registerAgentCallback(cb: AgentCallback): void { _agentCallback = cb; }

// ---- Macro run callback ----
type MacroRunCallback = (steps: string[]) => void;
let _macroRunCallback: MacroRunCallback | null = null;
export function registerMacroRunCallback(cb: MacroRunCallback): void { _macroRunCallback = cb; }

// ---- Watch conditions (eşik uyarıları) ----
interface WatchCondition {threshold: number; direction: "above" | "below"}
export const _watchConditions = new Map<string, WatchCondition>();
const _alertCooldowns = new Map<string, number>(); // metric → last alert timestamp

export function checkWatchConditions(
    metrics: {cpu?: number; ram?: number; gpu?: number; disk?: number},
    onAlert: (msg: string) => void,
): void {
    const now = Date.now();
    for (const [metric, cond] of _watchConditions) {
        const val = metrics[metric as keyof typeof metrics] ?? 0;
        const triggered = cond.direction === "above" ? val >= cond.threshold : val <= cond.threshold;
        if (!triggered) continue;
        const lastAlert = _alertCooldowns.get(metric) ?? 0;
        if (now - lastAlert < 60_000) continue; // 1 dakika cooldown
        _alertCooldowns.set(metric, now);
        onAlert(`UYARI: ${metric.toUpperCase()} ${cond.direction === "above" ? ">" : "<"} %${cond.threshold} (şu an %${Math.round(val)})`);
    }
}

function runScript(content: string, timeoutMs = 15000): Promise<ToolResult> {
    const tmpPath = path.join(os.tmpdir(), `aegis-${Date.now()}.ps1`);
    fs.writeFileSync(tmpPath, content, "utf-8");
    return new Promise((resolve) => {
        execCb(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPath}"`,
            {timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024},
            (err, stdout, stderr) => {
                try { fs.unlinkSync(tmpPath); } catch {}
                const out = (stdout ?? "").trim();
                const errOut = (stderr ?? "").trim();
                if (err && !out) resolve(`HATA: ${err.message}${errOut ? "\n" + errOut : ""}`);
                else resolve(out || errOut || "(çıktı yok, komut çalıştı)");
            }
        );
    });
}

function isDangerous(command: string): string | null {
    for (const {pattern, reason} of SYSTEM_DESTROY_PATTERNS) {
        if (pattern.test(command)) return reason;
    }
    return null;
}

const executors: Record<string, (args: Record<string, string>) => Promise<ToolResult>> = {
    async quit_self() {
        setTimeout(() => _quitCallback?.(), 500);
        return "Uygulama kapatılıyor…";
    },
    async run_command({command}) {
        if (!_fullPcAccess) {
            const danger = isDangerous(command);
            if (danger) return `ENGELLENDI: ${danger}`;
        }
        // Script dosyasına yaz → PowerShell'e -File ile çalıştır (injection-proof)
        return runScript(command);
    },
    async read_file({path: p}) {
        try {
            const full = path.resolve(resolvePath(p));
            // Tam PC erişimi yoksa yalnızca ev dizinine izin ver
            if (!_fullPcAccess && !full.startsWith(path.resolve(os.homedir()))) {
                return `ENGELLENDI: Tam PC erişimi kapalıyken sadece ev dizinindeki dosyalar okunabilir (${os.homedir()}).`;
            }
            const data = fs.readFileSync(full, "utf-8");
            return data.length > 8000 ? data.slice(0, 8000) + "\n...(kısaltıldı)" : data;
        } catch (e) {
            return `HATA: ${(e as Error).message}`;
        }
    },
    async write_file({path: p, content}) {
        try {
            const full = resolvePath(p);
            if (!_fullPcAccess && !full.startsWith(os.homedir())) {
                return `ENGELLENDI: Tam PC erişimi kapalıyken sadece ev dizinine yazabilirsin (${os.homedir()}).`;
            }
            fs.mkdirSync(path.dirname(full), {recursive: true});
            fs.writeFileSync(full, content, "utf-8");
            return `Yazıldı: ${full} (${content.length} karakter)`;
        } catch (e) {
            return `HATA: ${(e as Error).message}`;
        }
    },
    async delete_file(args: Record<string, string>) {
        const p = args.path;
        const recursive = args.recursive;
        if (!_fullPcAccess) return `ENGELLENDI: delete_file sadece Tam PC Erişimi açıkken kullanılabilir.`;
        try {
            const full = resolvePath(p);
            if (!fs.existsSync(full)) return `HATA: Bulunamadı: ${full}`;
            if (fs.statSync(full).isDirectory()) {
                fs.rmSync(full, {recursive: recursive !== "false", force: true});
                return `Silindi (klasör): ${full}`;
            } else {
                fs.unlinkSync(full);
                return `Silindi: ${full}`;
            }
        } catch (e) {
            return `HATA: ${(e as Error).message}`;
        }
    },
    async move_file(args: Record<string, string>) {
        const source = args.source;
        const destination = args.destination;
        if (!_fullPcAccess) return `ENGELLENDI: move_file sadece Tam PC Erişimi açıkken kullanılabilir.`;
        try {
            const src = resolvePath(source);
            const dst = resolvePath(destination);
            if (!fs.existsSync(src)) return `HATA: Kaynak bulunamadı: ${src}`;
            fs.mkdirSync(path.dirname(dst), {recursive: true});
            try {
                fs.renameSync(src, dst);
            } catch (e) {
                if ((e as NodeJS.ErrnoException).code === "EXDEV") {
                    fs.copyFileSync(src, dst);
                    fs.unlinkSync(src);
                } else throw e;
            }
            return `Taşındı: ${src} → ${dst}`;
        } catch (e) {
            return `HATA: ${(e as Error).message}`;
        }
    },
    async list_directory({path: p}) {
        try {
            const full = resolvePath(p ?? "");
            const items = fs.readdirSync(full, {withFileTypes: true});
            if (items.length === 0) return "(boş klasör)";
            return items.map((d: fs.Dirent) => (d.isDirectory() ? `📁 ${d.name}` : `📄 ${d.name}`)).join("\n");
        } catch (e) {
            return `HATA: ${(e as Error).message}`;
        }
    },
    async set_profile({key, value}) {
        await setUserProfile(key, value);
        return `Kaydedildi: ${key} = ${value}`;
    },
    async get_profile() {
        const profile = await getUserProfile();
        if (Object.keys(profile).length === 0) return "Henüz kayıtlı bilgi yok.";
        return Object.entries(profile).map(([k, v]) => `${k}: ${v}`).join("\n");
    },
    async save_note({content, remind_at}) {
        const remindDate = remind_at ? new Date(remind_at) : undefined;
        await saveNote(content, remindDate);
        return remind_at ? `Not kaydedildi. Hatırlatma: ${remind_at}` : `Not kaydedildi.`;
    },
    async list_notes() {
        const notes = await getPendingNotes();
        if (notes.length === 0) return "Bekleyen not yok.";
        return notes.map((n) => `[${n.id.slice(0, 8)}] ${n.content}${n.remind_at ? ` (${n.remind_at})` : ""}`).join("\n");
    },
    async done_note({id}) {
        await markNoteDone(id);
        return `Not tamamlandı: ${id}`;
    },
    async read_clipboard() {
        return run(`powershell -NoProfile -Command "Get-Clipboard"`, 5000);
    },
    async write_clipboard({text}) {
        const tmpPath = path.join(os.tmpdir(), `aegis-clip-${Date.now()}.txt`);
        fs.writeFileSync(tmpPath, text, "utf-8");
        const result = await run(`powershell -NoProfile -Command "Get-Content '${tmpPath}' -Raw | Set-Clipboard"`, 5000);
        try { fs.unlinkSync(tmpPath); } catch {}
        if (result.startsWith("HATA")) return result;
        return `Panoya kopyalandı (${text.length} karakter)`;
    },
    async list_windows() {
        return run(
            `powershell -NoProfile -Command "Get-Process | Where-Object {$_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne ''} | Sort-Object MainWindowTitle | Select-Object -ExpandProperty MainWindowTitle"`,
            8000,
        );
    },
    async focus_window({title}) {
        return runScript(
            `$wsh = New-Object -ComObject WScript.Shell\n` +
            `$result = $wsh.AppActivate('${title.replace(/'/g, "''")}')\n` +
            `if ($result) { Write-Output "Pencere odaklandı: ${title}" } else { Write-Output "Pencere bulunamadı: ${title}" }`,
            5000,
        );
    },
    async set_volume({level}) {
        const vol = Math.max(0, Math.min(100, Math.round(parseFloat(String(level)))));
        return runScript(
            `Add-Type -TypeDefinition @"\nusing System.Runtime.InteropServices;\npublic class WinVol {\n    [DllImport("winmm.dll")]\n    public static extern int waveOutSetVolume(System.IntPtr h, uint v);\n}\n"@ -ErrorAction SilentlyContinue\n` +
            `$v = [uint32][Math]::Round(${vol} / 100.0 * 65535)\n` +
            `[WinVol]::waveOutSetVolume([System.IntPtr]::Zero, ($v -bor ($v -shl 16))) | Out-Null\n` +
            `Write-Output "Ses seviyesi ${vol}% olarak ayarlandı"`,
            10000,
        );
    },
    async set_brightness({level}) {
        const br = Math.max(0, Math.min(100, Math.round(parseFloat(String(level)))));
        return runScript(
            `$m = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue\n` +
            `if ($m) { $m.WmiSetBrightness(1, ${br}); Write-Output "Parlaklık ${br}% olarak ayarlandı" }\n` +
            `else { Write-Output "Dahili ekran bulunamadı (harici monitörde desteklenmez)" }`,
            8000,
        );
    },
    async remind_in({message, minutes}) {
        if (!_remindCallback) return "HATA: Hatırlatıcı callback kayıtlı değil.";
        const ms = parseFloat(String(minutes)) * 60 * 1000;
        if (isNaN(ms) || ms <= 0) return "HATA: Geçersiz süre.";
        setTimeout(() => _remindCallback!(message), ms);
        const label = ms < 60000 ? `${Math.round(ms / 1000)} saniye` : `${minutes} dakika`;
        return `Hatırlatıcı ayarlandı: ${label} sonra "${message}"`;
    },
    async save_app_profile({name, commands}) {
        const profilePath = path.join(os.homedir(), ".aegis", "app-profiles.json");
        let profiles: Record<string, string[]> = {};
        try {
            if (fs.existsSync(profilePath)) profiles = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
        } catch {}
        const cmds = commands.split("\n").map((s: string) => s.trim()).filter(Boolean);
        profiles[name] = cmds;
        fs.mkdirSync(path.dirname(profilePath), {recursive: true});
        fs.writeFileSync(profilePath, JSON.stringify(profiles, null, 2), "utf-8");
        return `Profil kaydedildi: "${name}" (${cmds.length} komut)`;
    },
    async run_app_profile({name}) {
        const profilePath = path.join(os.homedir(), ".aegis", "app-profiles.json");
        try {
            const profiles: Record<string, string[]> = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
            const cmds = profiles[name];
            if (!cmds || cmds.length === 0) return `Profil bulunamadı: "${name}"`;
            const script = cmds.join("\n");
            const result = await runScript(script, 30000);
            return `Profil çalıştırıldı: "${name}"\n${result}`;
        } catch (e) {
            return `HATA: ${(e as Error).message}`;
        }
    },
    async list_app_profiles() {
        const profilePath = path.join(os.homedir(), ".aegis", "app-profiles.json");
        try {
            const profiles: Record<string, string[]> = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
            const keys = Object.keys(profiles);
            if (keys.length === 0) return "Kayıtlı profil yok.";
            return keys.map((k) => `• ${k} (${profiles[k].length} komut)`).join("\n");
        } catch {
            return "Kayıtlı profil yok.";
        }
    },
    async screenshot({question}) {
        if (!_screenshotCallback) return "HATA: Screenshot callback kayıtlı değil.";
        if (!_analyzeScreenCallback) return "HATA: Vision callback kayıtlı değil.";
        const result = await _screenshotCallback();
        if ("error" in result) return `HATA: ${result.error}`;
        return await _analyzeScreenCallback(result.base64, question);
    },
    async set_language({language}) {
        _setLanguageCallback?.(language);
        return `Language switched to ${language}.`;
    },
    async fetch_url({url}) {
        try { new URL(url); } catch { return "HATA: Geçersiz URL."; }
        try {
            const ac = new AbortController();
            const tid = setTimeout(() => ac.abort(), 12000);
            const resp = await fetch(url, {
                headers: {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
                signal: ac.signal,
                redirect: "follow",
            } as RequestInit & {redirect: string}).finally(() => clearTimeout(tid));
            if (!resp.ok) return `HATA: HTTP ${resp.status} — ${url}`;
            const html = await resp.text();
            const text = html
                .replace(/<script[\s\S]*?<\/script>/gi, " ")
                .replace(/<style[\s\S]*?<\/style>/gi, " ")
                .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
                .replace(/<[^>]+>/g, " ")
                .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
                .replace(/\s+/g, " ").trim();
            return text.slice(0, 6000) + (text.length > 6000 ? "\n…(kısaltıldı, ilk 6000 karakter)" : "");
        } catch (e) {
            return `HATA: ${(e as Error).message}`;
        }
    },
    async show_notification({title, body}) {
        if (!_notificationCallback) return "HATA: Bildirim callback kayıtlı değil.";
        _notificationCallback(title || "AEGIS", body || "");
        return `Bildirim gösterildi: "${title}"`;
    },
    async list_plugins() {
        if (_pluginList.length === 0) return "Yüklü plugin yok. ~/.aegis/plugins/ klasörüne ekleyebilirsiniz.";
        return _pluginList.map((p) => `• ${p.name}: ${p.tools.join(", ")}`).join("\n");
    },
    async reload_plugins() {
        if (!_reloadPluginsCallback) return "HATA: Plugin reload callback kayıtlı değil.";
        return await _reloadPluginsCallback();
    },
    async web_search({query}) {
        // Fallback zinciri: Tavily → Serper → DuckDuckGo
        const formatResults = (source: string, results: {title: string; url: string; content?: string}[], answer?: string) => {
            let out = `[${source}]\n`;
            out += answer ? `Özet: ${answer}\n\n` : "";
            out += results.map((r) => `• ${r.title}\n  ${r.url}\n  ${(r.content ?? "").slice(0, 200)}`).join("\n\n");
            return out || "(sonuç bulunamadı)";
        };

        const fetchWithTimeout = (url: string, init: RequestInit, ms = 8000): Promise<Response> => {
            const ac = new AbortController();
            const tid = setTimeout(() => ac.abort(), ms);
            return fetch(url, {...init, signal: ac.signal}).finally(() => clearTimeout(tid));
        };

        // 1. Tavily
        const tavilyKey = process.env.TAVILY_API_KEY;
        if (tavilyKey) {
            try {
                const res = await fetchWithTimeout("https://api.tavily.com/search", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({api_key: tavilyKey, query, max_results: 5, include_answer: true}),
                });
                if (res.ok) {
                    const data = (await res.json()) as {answer?: string; results?: {title: string; url: string; content?: string}[]};
                    return formatResults("Tavily", data.results ?? [], data.answer);
                }
            } catch {}
        }

        // 2. Serper (Google)
        const serperKey = process.env.SERPER_API_KEY;
        if (serperKey) {
            try {
                const res = await fetchWithTimeout("https://google.serper.dev/search", {
                    method: "POST",
                    headers: {"Content-Type": "application/json", "X-API-KEY": serperKey},
                    body: JSON.stringify({q: query, num: 5}),
                });
                if (res.ok) {
                    const data = (await res.json()) as {answerBox?: {answer?: string}; organic?: {title: string; link: string; snippet?: string}[]};
                    const results = (data.organic ?? []).map((r) => ({title: r.title, url: r.link, content: r.snippet}));
                    return formatResults("Serper · Google", results, data.answerBox?.answer);
                }
            } catch {}
        }

        // 3. DuckDuckGo Instant Answer (key gerektirmiyor, sınırlı)
        try {
            const res = await fetchWithTimeout(
                `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`,
                {},
            );
            if (res.ok) {
                const data = (await res.json()) as {AbstractText?: string; AbstractURL?: string; RelatedTopics?: {Text?: string; FirstURL?: string}[]};
                const results: {title: string; url: string; content?: string}[] = [];
                if (data.AbstractText) results.push({title: "Özet", url: data.AbstractURL ?? "", content: data.AbstractText});
                for (const t of (data.RelatedTopics ?? []).slice(0, 4)) {
                    if (t.Text && t.FirstURL) results.push({title: t.Text.slice(0, 60), url: t.FirstURL, content: t.Text});
                }
                if (results.length > 0) return formatResults("DuckDuckGo", results);
            }
        } catch {}

        return "HATA: Tüm arama servisleri başarısız.";
    },

    async schedule_task({name, schedule, command}) {
        return toolScheduleTask(name ?? "", schedule ?? "", command ?? "");
    },
    async list_scheduled_tasks() {
        return toolListScheduledTasks();
    },
    async cancel_scheduled_task({id_or_name}) {
        return toolCancelScheduledTask(id_or_name ?? "");
    },
    async toggle_scheduled_task({id_or_name}) {
        return toolToggleScheduledTask(id_or_name ?? "");
    },

    async watch_condition({metric, threshold, direction}) {
        const m = (metric ?? "").toLowerCase();
        const pct = parseInt(String(threshold ?? "90"), 10);
        const dir = (direction ?? "above").toLowerCase() === "below" ? "below" : "above";
        if (!["cpu", "ram", "gpu", "disk"].includes(m)) {
            return "HATA: Geçersiz metrik. Desteklenenler: cpu, ram, gpu, disk";
        }
        if (isNaN(pct) || pct < 1 || pct > 100) return "HATA: Eşik 1-100 arasında olmalı.";
        _watchConditions.set(m, {threshold: pct, direction: dir});
        return `${m.toUpperCase()} ${dir === "above" ? ">" : "<"} %${pct} eşiği izleniyor. Tetiklenince bildirim gelir.`;
    },

    async list_watch_conditions() {
        if (_watchConditions.size === 0) return "Aktif izleme koşulu yok.";
        return [..._watchConditions.entries()].map(([m, c]) =>
            `${m.toUpperCase()} ${c.direction === "above" ? ">" : "<"} %${c.threshold}`
        ).join("\n");
    },

    async remove_watch_condition({metric}) {
        const m = (metric ?? "").toLowerCase();
        if (_watchConditions.delete(m)) return `${m.toUpperCase()} izlemesi kaldırıldı.`;
        return `${m.toUpperCase()} için aktif izleme yok.`;
    },

    async agent_run({goal, max_steps}) {
        const steps = Math.max(1, Math.min(20, parseInt(String(max_steps ?? "10"), 10)));
        _agentCallback?.(goal ?? "", steps);
        return `Ajan modu başlatıldı. Hedef: "${goal}". Maksimum ${steps} adım. Adımlar feed'e düşecek.`;
    },

    async start_macro({name}) {
        return startMacroRecording(name ?? "isimsiz");
    },
    async stop_macro() {
        return stopMacroRecording();
    },
    async run_macro({name}) {
        const steps = getMacroSteps(name ?? "");
        if (!steps) return `"${name}" adında makro bulunamadı. Mevcut makrolar: ${listMacros()}`;
        if (steps.length === 0) return `"${name}" makrosu boş.`;
        _macroRunCallback?.(steps);
        return `"${name}" makrosu çalıştırılıyor (${steps.length} adım)…`;
    },
    async list_macros() {
        return listMacros();
    },
    async delete_macro({name}) {
        return deleteMacro(name ?? "");
    },

    // ---- Routines (Faz 52) ----
    async routine_record_start({name}) {
        return routines.startRecording(name ?? "");
    },
    async routine_record_stop() {
        return routines.stopRecording();
    },
    async routine_record_cancel() {
        return routines.cancelRecording();
    },
    async routine_run({name}) {
        const r = routines.getRoutine(name ?? "");
        if (!r) return `"${name}" adında routine bulunamadı. Mevcut: ${routines.listRoutines()}`;
        if (r.steps.length === 0) return `"${r.name}" routine'i boş.`;
        const log: string[] = [];
        for (let i = 0; i < r.steps.length; i++) {
            const {tool, args} = r.steps[i];
            const res = await executeTool(tool, JSON.stringify(args ?? {}));
            log.push(`  ${i + 1}. ${tool} → ${String(res).slice(0, 100)}`);
        }
        return `"${r.name}" routine'i çalıştırıldı (${r.steps.length} adım):\n${log.join("\n")}`;
    },
    async routine_list() {
        return routines.listRoutines();
    },
    async routine_show({name}) {
        return routines.showRoutine(name ?? "");
    },
    async routine_delete({name}) {
        return routines.deleteRoutine(name ?? "");
    },
    async routine_rename({name, new_name}) {
        return routines.renameRoutine(name ?? "", new_name ?? "");
    },
    async routine_delete_step({name, step}) {
        const n = parseInt(String(step ?? ""), 10);
        if (!Number.isFinite(n)) return "Adım numarası geçersiz.";
        return routines.deleteRoutineStep(name ?? "", n);
    },

    async if_then({condition, action}) {
        return addAutomation(condition ?? "", action ?? "");
    },
    async list_automations() {
        return listAutomations();
    },
    async remove_automation({id_or_condition}) {
        return removeAutomation(id_or_condition ?? "");
    },
    async toggle_automation({id_or_condition}) {
        return toggleAutomation(id_or_condition ?? "");
    },

    async index_file({file_path}) {
        return indexFile(file_path ?? "");
    },
    async index_folder({folder_path, extensions}) {
        const exts = extensions ? String(extensions).split(",").map((e) => e.trim()) : undefined;
        return indexFolder(folder_path ?? "", exts);
    },
    async search_knowledge({query, top_k}) {
        return searchKnowledge(query ?? "", top_k ? parseInt(String(top_k)) : 5);
    },
    async chat_with_file({file_path}) {
        const content = readFileForChat(file_path ?? "");
        if (content.startsWith("HATA:")) return content;
        return `Dosya içeriği (${file_path}):\n\n${content}\n\n[Yukarıdaki içeriği bağlam olarak kullanarak soruları yanıtla.]`;
    },
    async list_indexed_files() {
        return listIndexedFiles();
    },
    async remove_from_index({file_path}) {
        return removeFromIndex(file_path ?? "");
    },

    async remember_fact({content, tags}) {
        const tagList = tags ? String(tags).split(",").map((t) => t.trim()).filter(Boolean) : [];
        return addFact(content ?? "", "manual", tagList);
    },
    async list_facts({filter}) {
        return listFacts(filter ?? "");
    },
    async forget_fact({id_or_content}) {
        return removeFact(id_or_content ?? "");
    },
    async list_habits() {
        return listHabits();
    },

    async vault_store({key, value}) {
        return vaultStore(key ?? "", value ?? "");
    },
    async vault_list() {
        return vaultList();
    },
    async vault_delete({key}) {
        return vaultDelete(key ?? "");
    },
    async privacy_audit() {
        return privacyAudit();
    },
    async clear_old_data({days}) {
        const d = parseInt(String(days ?? "30"), 10);
        return clearOldData(isNaN(d) ? 30 : d);
    },

    async plugin_search({query}) {
        return pluginSearch(query ?? "");
    },
    async plugin_install({repo}) {
        return pluginInstall(repo ?? "");
    },
    async plugin_remove({name}) {
        return pluginRemove(name ?? "");
    },

    // ── Faz 19: Ses & Müzik ──────────────────────────────────────────────────
    async play_sound({file_path, volume}) {
        return playSound(file_path ?? "", volume ? Number(volume) : 50);
    },
    async ambient_start({category, volume}) {
        return ambientStart(category ?? "rain", volume ? Number(volume) : 30);
    },
    async ambient_stop() {
        return ambientStop();
    },
    async list_sounds() {
        return listSounds();
    },

    // ── Faz 20: Kod Asistanı ─────────────────────────────────────────────────
    async git_status({repo_path}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        const out = await run(`git -C "${cwd}" status -sb`);
        return out || "(clean — değişiklik yok)";
    },
    async git_log({repo_path, count, graph}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        const n = count ? Math.min(parseInt(String(count)), 100) : 10;
        if (String(graph) === "true") {
            return run(`git -C "${cwd}" log --oneline --graph --decorate --all -${n}`);
        }
        return run(`git -C "${cwd}" log --oneline -${n} --decorate --format="%C(yellow)%h%Creset %C(cyan)%ar%Creset %s%C(auto)%d"`);
    },
    async git_diff({repo_path, staged, file}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        const flag = String(staged) === "true" ? "--cached" : "";
        const filePart = file ? `-- "${path.resolve(resolvePath(file))}"` : "";
        const out = await run(`git -C "${cwd}" diff ${flag} --stat ${filePart}`);
        return out || "(değişiklik yok)";
    },
    async git_add({repo_path, files}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        if (!files) return "HATA: files parametresi gerekli ('.' = hepsi)";
        const target = files.trim() === "." ? "." : `"${path.resolve(resolvePath(files))}"`;
        return run(`git -C "${cwd}" add ${target}`);
    },
    async git_commit({repo_path, message, add_all}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        if (!message) return "HATA: commit mesajı gerekli";
        if (String(add_all) === "true") {
            await run(`git -C "${cwd}" add .`);
        }
        // Mesajı stdin değil temp dosya üzerinden geç — injection yok
        const tmpMsg = path.join(os.tmpdir(), `aegis-commit-${Date.now()}.txt`);
        fs.writeFileSync(tmpMsg, message, "utf-8");
        const out = await run(`git -C "${cwd}" commit -F "${tmpMsg}"`);
        try { fs.unlinkSync(tmpMsg); } catch {}
        return out;
    },
    async git_push({repo_path, remote, branch, force}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        const rem = (remote || "origin").replace(/[^a-zA-Z0-9._-]/g, "");
        const br = branch ? (branch as string).replace(/[^a-zA-Z0-9._/-]/g, "") : "";
        const forceFlag = String(force) === "true" ? "--force-with-lease" : "";
        return run(`git -C "${cwd}" push ${forceFlag} ${rem} ${br}`.trim());
    },
    async git_pull({repo_path, remote, rebase}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        const rem = (remote || "origin").replace(/[^a-zA-Z0-9._-]/g, "");
        const rebaseFlag = String(rebase) === "true" ? "--rebase" : "";
        return run(`git -C "${cwd}" pull ${rebaseFlag} ${rem}`.trim());
    },
    async git_branch({repo_path, action, branch_name}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        if (action === "list") return run(`git -C "${cwd}" branch -avv`);
        if (action === "graph") return run(`git -C "${cwd}" log --oneline --graph --decorate --all -20`);
        const safe = branch_name ? (branch_name as string).replace(/[^a-zA-Z0-9._/-]/g, "") : "";
        if (!safe) return "HATA: branch_name gerekli";
        if (action === "create") return run(`git -C "${cwd}" checkout -b "${safe}"`);
        if (action === "switch") return run(`git -C "${cwd}" checkout "${safe}"`);
        if (action === "delete") return run(`git -C "${cwd}" branch -d "${safe}"`);
        return "HATA: action = list | create | switch | delete | graph";
    },
    async git_stash({repo_path, action, message, index}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        const idx = index !== undefined ? parseInt(String(index)) : 0;
        if (action === "list") return run(`git -C "${cwd}" stash list`);
        if (action === "pop") return run(`git -C "${cwd}" stash pop stash@{${idx}}`);
        if (action === "apply") return run(`git -C "${cwd}" stash apply stash@{${idx}}`);
        if (action === "drop") return run(`git -C "${cwd}" stash drop stash@{${idx}}`);
        if (action === "save") {
            const tmpMsg = path.join(os.tmpdir(), `aegis-stash-${Date.now()}.txt`);
            const msg = message || `aegis-stash-${new Date().toISOString()}`;
            fs.writeFileSync(tmpMsg, msg, "utf-8");
            const out = await run(`git -C "${cwd}" stash push -m "${msg.replace(/"/g, '\\"').slice(0, 100)}"`);
            try { fs.unlinkSync(tmpMsg); } catch {}
            return out;
        }
        return "HATA: action = save | pop | list | drop | apply";
    },
    async git_merge({repo_path, branch, no_ff}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        if (!branch) return "HATA: branch adı gerekli";
        const safe = (branch as string).replace(/[^a-zA-Z0-9._/-]/g, "");
        const flag = String(no_ff) === "true" ? "--no-ff" : "";
        return run(`git -C "${cwd}" merge ${flag} "${safe}"`.trim());
    },
    async git_reset({repo_path, mode, commits, file}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        if (file) {
            const safeFile = path.resolve(resolvePath(file as string));
            return run(`git -C "${cwd}" reset HEAD -- "${safeFile}"`);
        }
        const validModes = ["soft", "mixed", "hard"];
        const m = validModes.includes(mode as string) ? (mode as string) : "mixed";
        const n = commits ? parseInt(String(commits)) : 1;
        if (m === "hard") {
            const confirm = await run(`git -C "${cwd}" status --short`);
            if (confirm.trim()) {
                return `UYARI: --hard reset tüm değişiklikleri siler.\nMevcut değişiklikler:\n${confirm}\n\nEmin misin? Onaylamak için git_reset mode=hard commits=${n} şeklinde tekrar çağır.`;
            }
        }
        return run(`git -C "${cwd}" reset --${m} HEAD~${n}`);
    },
    async git_remote({repo_path, action, name, url}) {
        const cwd = repo_path ? path.resolve(resolvePath(repo_path)) : process.cwd();
        if (action === "list") return run(`git -C "${cwd}" remote -v`);
        const safeName = (name || "origin").replace(/[^a-zA-Z0-9._-]/g, "");
        if (action === "add" && url) return run(`git -C "${cwd}" remote add "${safeName}" "${(url as string).replace(/"/g, '\\"')}"`);
        if (action === "set-url" && url) return run(`git -C "${cwd}" remote set-url "${safeName}" "${(url as string).replace(/"/g, '\\"')}"`);
        return "HATA: action = list | add | set-url";
    },
    async run_and_analyze({command, context}) {
        const output = await runScript(command ?? "", 30000);
        return `Komut çıktısı:\n${output}\n\nBağlam: ${context || "yok"}\n\n[Yukarıdaki çıktıyı analiz et, hata varsa açıkla ve çözüm öner.]`;
    },
    async scaffold_project({template, target_path}) {
        const templates: Record<string, {dirs: string[]; files: Record<string, string>}> = {
            "python-fastapi": {
                dirs: ["app", "app/routers", "tests"],
                files: {
                    "app/__init__.py": "",
                    "app/main.py": 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/")\ndef root():\n    return {"message": "Hello from FastAPI"}\n',
                    "requirements.txt": "fastapi\nuvicorn[standard]\n",
                    "README.md": "# FastAPI Project\n\nRun: `uvicorn app.main:app --reload`\n",
                },
            },
            "react-tailwind": {
                dirs: ["src", "src/components", "public"],
                files: {
                    "package.json": '{"name":"my-app","version":"0.1.0","scripts":{"dev":"vite","build":"vite build"},"dependencies":{"react":"^18.0.0","react-dom":"^18.0.0"},"devDependencies":{"vite":"^5.0.0","@vitejs/plugin-react":"^4.0.0","tailwindcss":"^3.0.0"}}\n',
                    "src/App.tsx": 'export default function App() {\n  return <div className="p-8 text-2xl font-bold">Hello Tailwind</div>;\n}\n',
                    "src/main.tsx": 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);\n',
                    "index.html": '<!DOCTYPE html>\n<html><head><title>App</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
                },
            },
            "node-express": {
                dirs: ["src", "routes"],
                files: {
                    "src/index.js": 'const express = require("express");\nconst app = express();\napp.use(express.json());\napp.get("/", (req, res) => res.json({status:"ok"}));\napp.listen(3000, () => console.log("Server on :3000"));\n',
                    "package.json": '{"name":"my-api","version":"1.0.0","main":"src/index.js","scripts":{"start":"node src/index.js","dev":"nodemon src/index.js"},"dependencies":{"express":"^4.18.0"}}\n',
                },
            },
            "electron-app": {
                dirs: ["src", "electron"],
                files: {
                    "package.json": '{"name":"my-electron","version":"0.1.0","main":"electron/main.js","scripts":{"dev":"electron ."},"dependencies":{"electron":"^28.0.0"}}\n',
                    "electron/main.js": 'const {app,BrowserWindow}=require("electron");\napp.whenReady().then(()=>{\n  const win=new BrowserWindow({width:800,height:600});\n  win.loadFile("src/index.html");\n});\n',
                    "src/index.html": '<!DOCTYPE html><html><body><h1>Hello Electron</h1></body></html>\n',
                },
            },
            "next-ts": {
                dirs: ["app", "components", "public"],
                files: {
                    "package.json": '{"name":"my-next","version":"0.1.0","scripts":{"dev":"next dev","build":"next build"},"dependencies":{"next":"^14.0.0","react":"^18.0.0","react-dom":"^18.0.0"},"devDependencies":{"typescript":"^5.0.0","@types/react":"^18.0.0"}}\n',
                    "app/page.tsx": 'export default function Home() {\n  return <main><h1>Hello Next.js</h1></main>;\n}\n',
                    "app/layout.tsx": 'export default function RootLayout({children}:{children:React.ReactNode}) {\n  return <html><body>{children}</body></html>;\n}\n',
                    "tsconfig.json": '{"compilerOptions":{"target":"es2017","lib":["dom","es2017"],"jsx":"preserve","strict":true,"moduleResolution":"bundler"}}\n',
                },
            },
        };
        const tpl = templates[template ?? ""];
        if (!tpl) {
            return `Bilinmeyen şablon: ${template}\nMevcut şablonlar: ${Object.keys(templates).join(", ")}`;
        }
        const desktop = path.join(os.homedir(), "Desktop");
        const basePath = target_path ? resolvePath(target_path) : path.join(desktop, template ?? "project");
        try {
            for (const dir of tpl.dirs) {
                fs.mkdirSync(path.join(basePath, dir), {recursive: true});
            }
            for (const [file, content] of Object.entries(tpl.files)) {
                const fp = path.join(basePath, file);
                fs.mkdirSync(path.dirname(fp), {recursive: true});
                fs.writeFileSync(fp, content, "utf-8");
            }
            return `"${template}" şablonu oluşturuldu: ${basePath}\nDosyalar: ${Object.keys(tpl.files).join(", ")}`;
        } catch (e) {
            return `HATA: ${(e as Error).message}`;
        }
    },
    async list_templates() {
        return "Mevcut şablonlar:\n• python-fastapi — FastAPI + uvicorn\n• react-tailwind — React + Vite + Tailwind\n• node-express — Node.js + Express API\n• electron-app — Temel Electron uygulaması\n• next-ts — Next.js 14 + TypeScript";
    },

    // ── Faz 21: Takvim & Zaman ───────────────────────────────────────────────
    async pomodoro_start({work_minutes, break_minutes}) {
        return pomodoroStart(work_minutes ? Number(work_minutes) : 25, break_minutes ? Number(break_minutes) : 5);
    },
    async pomodoro_stop() {
        return pomodoroStop();
    },
    async time_track_start({task_name}) {
        return timeTrackStart(task_name ?? "");
    },
    async time_track_stop() {
        return timeTrackStop();
    },
    async time_track_report({period}) {
        return timeTrackReport(period ?? "today");
    },
    async calendar_get_events({date, days_ahead}) {
        const d = date ?? new Date().toISOString().slice(0, 10);
        const ahead = days_ahead ? Number(days_ahead) : 1;
        const ps = `
$start = [datetime]::Parse("${d}")
$end = $start.AddDays(${ahead})
$cal = [Windows.ApplicationModel.Appointments.AppointmentManager,Windows.ApplicationModel.Appointments,ContentType=WindowsRuntime]::RequestStoreAsync([Windows.ApplicationModel.Appointments.AppointmentStoreAccessType]::AllCalendarsReadOnly).GetAwaiter().GetResult()
$appts = $cal.FindAppointmentsAsync($start,$end-$start).GetAwaiter().GetResult()
if($appts.Count -eq 0){"Etkinlik yok."}
else{$appts|ForEach-Object{"• $($_.StartTime.LocalDateTime.ToString('HH:mm')) - $($_.Subject) ($($_.Duration.TotalMinutes)dk)"}|Out-String}
`.trim();
        const out = await runScript(ps, 15000);
        if (out.includes("HATA") || out.includes("hata") || !out.trim()) {
            // Fallback: use PowerShell Get-Date based simple approach
            return `Takvim API'ye erişim için UWP izni gerekli. Alternatif: 'Görevler' veya 'Notlar' özelliklerini kullanabilirsin.`;
        }
        return out;
    },
    async calendar_add_event({title, start_time, duration_minutes, notes}) {
        const dur = duration_minutes ? Number(duration_minutes) : 60;
        const ps = `
Add-Type -AssemblyName Microsoft.Office.Interop.Outlook -ErrorAction SilentlyContinue
try {
  $outlook = New-Object -ComObject Outlook.Application -ErrorAction Stop
  $appt = $outlook.CreateItem(1)
  $appt.Subject = "${(title ?? "").replace(/"/g, "'")}"
  $appt.Start = [datetime]::Parse("${start_time}")
  $appt.Duration = ${dur}
  $appt.Body = "${(notes ?? "").replace(/"/g, "'")}"
  $appt.Save()
  "Etkinlik eklendi: ${title}"
} catch {
  "Outlook bulunamadı. Etkinlik manuel eklenmeli: ${title} - ${start_time}"
}
`.trim();
        return runScript(ps, 10000);
    },

    // ── Faz 22: Dosya & Medya ────────────────────────────────────────────────
    async organize_folder({folder_path, by}) {
        const target = resolvePath(folder_path ?? "");
        if (!fs.existsSync(target)) return `HATA: Klasör bulunamadı: ${target}`;
        const groupBy = (by === "date") ? "date" : "extension";
        const files = fs.readdirSync(target).filter((f) => {
            try { return fs.statSync(path.join(target, f)).isFile(); } catch { return false; }
        });
        let moved = 0;
        const skipped: string[] = [];
        for (const file of files) {
            const filePath = path.join(target, file);
            let subDir: string;
            if (groupBy === "date") {
                const stat = fs.statSync(filePath);
                const d = new Date(stat.mtime);
                subDir = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            } else {
                const ext = path.extname(file).slice(1).toLowerCase() || "other";
                subDir = ext;
            }
            const destDir = path.join(target, subDir);
            fs.mkdirSync(destDir, {recursive: true});
            try {
                fs.renameSync(filePath, path.join(destDir, file));
                moved++;
            } catch {
                skipped.push(file);
            }
        }
        return `${moved} dosya taşındı (grupla: ${groupBy}). ${skipped.length > 0 ? "Atlanan: " + skipped.join(", ") : ""}`.trim();
    },
    async find_duplicates({folder_path, recursive}) {
        const target = resolvePath(folder_path ?? "");
        if (!fs.existsSync(target)) return `HATA: Klasör bulunamadı: ${target}`;
        const isRecursive = String(recursive) !== "false";
        const {createHash} = await import("crypto");
        function getFiles(dir: string): string[] {
            let result: string[] = [];
            for (const f of fs.readdirSync(dir)) {
                const full = path.join(dir, f);
                try {
                    const stat = fs.statSync(full);
                    if (stat.isDirectory() && isRecursive) result = result.concat(getFiles(full));
                    else if (stat.isFile()) result.push(full);
                } catch {}
            }
            return result;
        }
        const files = getFiles(target);
        const hashMap = new Map<string, string[]>();
        const SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB — büyük dosyaları atla
        for (const f of files) {
            try {
                const stat = fs.statSync(f);
                if (stat.size > SIZE_LIMIT) continue;
                const buf = fs.readFileSync(f);
                const hash = createHash("md5").update(buf).digest("hex");
                const arr = hashMap.get(hash) ?? [];
                arr.push(f);
                hashMap.set(hash, arr);
            } catch {}
        }
        const dupes = [...hashMap.values()].filter((arr) => arr.length > 1);
        if (dupes.length === 0) return "Yinelenen dosya bulunamadı.";
        return `${dupes.length} yinelenen grup bulundu:\n${dupes.map((g, i) => `${i + 1}. (${g.length} dosya)\n   ${g.join("\n   ")}`).join("\n\n")}`;
    },
    async bulk_rename({folder_path, pattern, replacement, extension}) {
        const target = resolvePath(folder_path ?? "");
        if (!fs.existsSync(target)) return `HATA: Klasör bulunamadı: ${target}`;
        if (!pattern) return "HATA: Regex pattern gerekli.";
        let regex: RegExp;
        try {
            regex = new RegExp(pattern, "g");
        } catch {
            return `HATA: Geçersiz regex pattern: ${pattern}`;
        }
        let files = fs.readdirSync(target).filter((f) => {
            try { return fs.statSync(path.join(target, f)).isFile(); } catch { return false; }
        });
        if (extension) files = files.filter((f) => f.endsWith(extension));
        let renamed = 0;
        let repl = replacement ?? "";
        files.forEach((file, i) => {
            const actualRepl = repl.replace(/\{n\}/g, String(i + 1));
            const newName = file.replace(regex, actualRepl);
            if (newName !== file) {
                try {
                    fs.renameSync(path.join(target, file), path.join(target, newName));
                    renamed++;
                } catch {}
            }
        });
        return `${renamed} dosya yeniden adlandırıldı.`;
    },
    async analyze_image({image_path, question}) {
        const target = resolvePath(image_path ?? "");
        if (!fs.existsSync(target)) return `HATA: Görüntü bulunamadı: ${target}`;
        try {
            const buf = fs.readFileSync(target);
            const base64 = buf.toString("base64");
            const ext = path.extname(target).slice(1).toLowerCase();
            const mimeMap: Record<string, string> = {jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", gif:"image/gif", webp:"image/webp"};
            const mime = mimeMap[ext] ?? "image/png";
            return `[GÖRÜNTÜ ANALİZİ]\nDosya: ${path.basename(target)}\nBoyut: ${(buf.length / 1024).toFixed(1)} KB\nSoru: ${question || "Bu görüntüde ne var?"}\nNot: Görüntü analizi için vision destekli model (gpt-4o-mini veya llama-3.2-vision) gerekiyor. Mevcut Groq modeli metin tabanlı. Görüntüyü base64 olarak hazırladım (${mime}, ${base64.length} karakter). Vision özelliği için ayarlardan OpenAI API key ekle.`;
        } catch (e) {
            return `HATA: ${(e as Error).message}`;
        }
    },
    async resize_image({image_path, width, height, output_path}) {
        const target = resolvePath(image_path ?? "");
        if (!fs.existsSync(target)) return `HATA: Görüntü bulunamadı: ${target}`;
        const w = Number(width);
        const h = height ? Number(height) : 0;
        const ext = path.extname(target);
        const outPath = output_path ? resolvePath(output_path) : target.replace(ext, `_resized${ext}`);
        const ps = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("${target.replace(/\\/g, "\\\\")}")
$w = ${w}; $h = if(${h} -gt 0){${height ?? 0}}else{[int]($img.Height * ${w} / $img.Width)}
$bmp = New-Object System.Drawing.Bitmap($w,$h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img,0,0,$w,$h)
$bmp.Save("${outPath.replace(/\\/g, "\\\\")}")
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
"Yeniden boyutlandırıldı: ${outPath} (${w}x" + $h + "px)"
`.trim();
        return runScript(ps, 15000);
    },
    async convert_image({image_path, output_format, output_path}) {
        const target = resolvePath(image_path ?? "");
        if (!fs.existsSync(target)) return `HATA: Görüntü bulunamadı: ${target}`;
        const fmt = (output_format ?? "png").toLowerCase();
        const fmtMap: Record<string, string> = {jpg:"Jpeg", jpeg:"Jpeg", png:"Png", bmp:"Bmp", gif:"Gif"};
        const dotNetFmt = fmtMap[fmt] ?? "Png";
        const ext = path.extname(target);
        const outPath = output_path ? resolvePath(output_path) : target.replace(ext, `.${fmt}`);
        const ps = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("${target.replace(/\\/g, "\\\\")}")
$img.Save("${outPath.replace(/\\/g, "\\\\")}",  [System.Drawing.Imaging.ImageFormat]::${dotNetFmt})
$img.Dispose()
"Dönüştürüldü: ${outPath}"
`.trim();
        return runScript(ps, 15000);
    },
    async pdf_to_text({pdf_path, max_chars}) {
        const target = resolvePath(pdf_path ?? "");
        if (!fs.existsSync(target)) return `HATA: PDF bulunamadı: ${target}`;
        const maxC = max_chars ? Number(max_chars) : 10000;
        const ps = `
Add-Type -AssemblyName Microsoft.Office.Interop.Word -ErrorAction SilentlyContinue
try {
  $word = New-Object -ComObject Word.Application -ErrorAction Stop
  $word.Visible = $false
  $doc = $word.Documents.Open("${target.replace(/\\/g, "\\\\")}")
  $text = $doc.Content.Text
  $doc.Close([ref]$false)
  $word.Quit()
  if($text.Length -gt ${maxC}){$text.Substring(0,${maxC})+"...(kısaltıldı)"}else{$text}
} catch {
  "Word COM nesnesi bulunamadı. Alternatif: PDF okuma için 'pdftotext' aracı kur veya dosyayı bilgi tabanına indeksle (index_file)."
}
`.trim();
        return runScript(ps, 20000);
    },

    // ── Faz 23: Kişilik & Rol ────────────────────────────────────────────────
    async set_persona({name}) {
        return setActivePersona(name ?? "default");
    },
    async get_persona() {
        return getActivePersona();
    },
    async list_personas() {
        return listPersonas();
    },
    async add_persona({name, description, system_prompt}) {
        return addPersona(name ?? "", description ?? "", system_prompt ?? "");
    },
    async roleplay_start({character, scenario}) {
        return startRoleplay(character ?? "", scenario ?? "");
    },
    async roleplay_stop() {
        return stopRoleplay();
    },

    // ── Faz 24: Ağ & Sunucu ──────────────────────────────────────────────────
    async ping_host({host, count}) {
        const n = count ? Number(count) : 4;
        return run(`powershell -NoProfile -Command "Test-Connection -ComputerName '${host}' -Count ${n} | Select-Object -Property Address,ResponseTime,StatusCode | ConvertTo-Json -Compress"`, 15000);
    },
    async trace_route({host, max_hops}) {
        const hops = max_hops ? Number(max_hops) : 30;
        return run(`tracert -h ${hops} ${host}`, 30000);
    },
    async port_scan({host, ports}) {
        const portList = (ports ?? "21,22,25,80,443,3306,8080,8443").split(",").map((p) => p.trim());
        const ps = portList.map((p) => {
            const [start, end] = p.includes("-") ? p.split("-").map(Number) : [Number(p), Number(p)];
            if (end > start) {
                return `${start}..${end} | ForEach-Object { $tcp = New-Object System.Net.Sockets.TcpClient; $conn = $tcp.BeginConnect('${host}',$_,$null,$null); $wait = $conn.AsyncWaitHandle.WaitOne(500); if($wait -and -not $tcp.Connected){}; if($tcp.Connected){"Port $_ ACIK"}; $tcp.Close() }`;
            }
            return `$tcp = New-Object System.Net.Sockets.TcpClient; $conn = $tcp.BeginConnect('${host}',${start},$null,$null); if($conn.AsyncWaitHandle.WaitOne(500) -and $tcp.Connected){"Port ${start}: ACIK"}else{"Port ${start}: KAPALI"}; $tcp.Close()`;
        }).join("; ");
        const result = await runScript(ps, 30000);
        return result || "Tüm portlar kapalı veya erişilemiyor.";
    },
    async dns_lookup({domain, type}) {
        const recType = (type ?? "A").toUpperCase();
        return run(`powershell -NoProfile -Command "Resolve-DnsName -Name '${domain}' -Type ${recType} | Select-Object Name,Type,TTL,IPAddress,NameExchange,Strings | ConvertTo-Json -Compress -Depth 2"`, 10000);
    },
    async ssh_run({host_alias, command}) {
        const hostsPath = path.join(os.homedir(), ".aegis", "ssh-hosts.json");
        if (!fs.existsSync(hostsPath)) return "HATA: SSH profili bulunamadı. Önce 'ssh_add_host' ile profil ekle.";
        const hosts = JSON.parse(fs.readFileSync(hostsPath, "utf-8"));
        const profile = hosts[host_alias ?? ""];
        if (!profile) return `HATA: "${host_alias}" profili bulunamadı. Mevcut: ${Object.keys(hosts).join(", ")}`;
        const {hostname, username, port = 22, key_path} = profile;
        const keyFlag = key_path ? `-i "${key_path}"` : "";
        const cmd = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${port} ${keyFlag} ${username}@${hostname} "${(command ?? "").replace(/"/g, '\\"')}"`;
        return run(cmd, 30000);
    },
    async ssh_add_host({alias, hostname, username, port, key_path}) {
        const hostsPath = path.join(os.homedir(), ".aegis", "ssh-hosts.json");
        const hosts = fs.existsSync(hostsPath) ? JSON.parse(fs.readFileSync(hostsPath, "utf-8")) : {};
        hosts[alias ?? ""] = {hostname, username, port: port ? Number(port) : 22, ...(key_path ? {key_path} : {})};
        fs.writeFileSync(hostsPath, JSON.stringify(hosts, null, 2));
        return `SSH profili kaydedildi: ${alias} → ${username}@${hostname}:${port ?? 22}`;
    },
    async docker_ps({all}) {
        const flag = String(all) === "true" ? "-a" : "";
        return run(`docker ps ${flag} --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"`, 10000);
    },
    async docker_start({container}) {
        return run(`docker start ${container ?? ""}`, 10000);
    },
    async docker_stop({container}) {
        return run(`docker stop ${container ?? ""}`, 10000);
    },
    async docker_logs({container, lines}) {
        const n = lines ? Number(lines) : 50;
        return run(`docker logs --tail ${n} ${container ?? ""}`, 10000);
    },

    // ── Faz 25: Görselleştirme ───────────────────────────────────────────────
    async create_chart({type, data, title}) {
        try {
            const parsed: {labels?: string[]; values?: number[]} | [string, number][] = JSON.parse(data ?? "{}");
            let labels: string[];
            let values: number[];
            if (Array.isArray(parsed)) {
                labels = parsed.map((item) => String(item[0]));
                values = parsed.map((item) => Number(item[1]));
            } else {
                labels = parsed.labels ?? [];
                values = (parsed.values ?? []).map(Number);
            }
            if (labels.length === 0 || values.length === 0) return "HATA: Veri eksik. Format: {labels:[...], values:[...]} veya [[label,val],...]";
            const chartType = (type ?? "bar").toLowerCase();
            const maxVal = Math.max(...values);
            const chartWidth = 40;
            const t = title ? `── ${title} ──\n` : "";
            if (chartType === "bar") {
                const rows = labels.map((l, i) => {
                    const barLen = maxVal > 0 ? Math.round((values[i] / maxVal) * chartWidth) : 0;
                    const bar = "█".repeat(barLen) + "░".repeat(chartWidth - barLen);
                    return `${l.padEnd(12).slice(0, 12)} │${bar}│ ${values[i]}`;
                });
                return `${t}${rows.join("\n")}`;
            }
            if (chartType === "pie") {
                const total = values.reduce((s, v) => s + v, 0);
                const rows = labels.map((l, i) => {
                    const pct = total > 0 ? (values[i] / total * 100).toFixed(1) : "0.0";
                    const barLen = Math.round(Number(pct) / 100 * chartWidth);
                    return `${l.padEnd(12).slice(0, 12)} │${"█".repeat(barLen)}│ ${pct}%`;
                });
                return `${t}${rows.join("\n")}\nToplam: ${total}`;
            }
            if (chartType === "line") {
                if (maxVal === 0) return `${t}(tüm değerler sıfır — grafik çizilemez)`;
                const height = 10;
                const grid: string[][] = Array.from({length: height}, () => Array(values.length).fill(" "));
                values.forEach((v, i) => {
                    const row = height - 1 - Math.round((v / maxVal) * (height - 1));
                    grid[row][i] = "●";
                });
                const rows = grid.map((row, ri) => {
                    const yVal = maxVal - Math.round((ri / (height - 1)) * maxVal);
                    return `${String(yVal).padStart(6)} │${row.join(" ")}`;
                });
                return `${t}${rows.join("\n")}\n       └${"─".repeat(values.length * 2)}\n        ${labels.map((l) => l.slice(0, 2)).join(" ")}`;
            }
            return "HATA: Desteklenmeyen grafik tipi. Kullan: bar, pie, line";
        } catch (e) {
            return `HATA: Veri ayrıştırılamadı — ${(e as Error).message}`;
        }
    },
    async system_report() {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const ramUsedPct = Math.round((1 - freeMem / totalMem) * 100);
        const uptime = Math.floor(os.uptime() / 3600);
        const diskInfo = await run(`powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | Select-Object Name,Used,Free | ConvertTo-Json -Compress"`, 8000);
        let diskSummary = "N/A";
        try {
            const disksData = JSON.parse(diskInfo);
            const arr = Array.isArray(disksData) ? disksData : [disksData];
            diskSummary = arr.map((d: {Name?: string; Used?: number; Free?: number}) => {
                const total = (d.Used ?? 0) + (d.Free ?? 0);
                const pct = total > 0 ? Math.round((d.Used ?? 0) / total * 100) : 0;
                return `${d.Name}: %${pct} (${(( d.Used ?? 0) / 1e9).toFixed(1)}GB / ${(total / 1e9).toFixed(1)}GB)`;
            }).join(", ");
        } catch {}
        const report = [
            `AEGIS Sistem Sağlık Raporu — ${new Date().toLocaleString("tr-TR")}`,
            `═══════════════════════════════════════════`,
            `CPU     : ${cpus[0].model.split(" @")[0].trim()}`,
            `CPU     : ${cpus.length} çekirdek`,
            `RAM     : %${ramUsedPct} kullanımda (${((totalMem - freeMem) / 1e9).toFixed(1)}GB / ${(totalMem / 1e9).toFixed(1)}GB)`,
            `Disk    : ${diskSummary}`,
            `Uptime  : ${uptime} saat`,
            `Platform: ${os.version()}`,
        ].join("\n");
        return report;
    },

    // ── Faz 26: E-posta ──────────────────────────────────────────────────────
    async email_draft({intent, recipient, tone, language}) {
        const lang = language ?? "tr";
        const t = tone ?? "formal";
        const toneDesc = t === "friendly" ? "samimi ve sıcak" : t === "assertive" ? "net ve kararlı" : "profesyonel ve resmi";
        return `E-posta taslağı hazırlanıyor (${lang === "tr" ? "Türkçe" : "İngilizce"}, ${toneDesc} ton):\n\n---\nKonu: [Konuyu buraya yaz]\n\nSayın ${recipient ?? "[Alıcı]"},\n\n${intent}\n\nSaygılarımla,\n[İmza]\n---\n\nNot: SMTP ile göndermek için önce 'email_setup_smtp' ile profil kur.`;
    },
    async email_setup_smtp({alias, smtp_host, smtp_port, imap_host, imap_port, username, password}) {
        const profilesPath = path.join(os.homedir(), ".aegis", "email-profiles.json");
        const profiles = fs.existsSync(profilesPath) ? JSON.parse(fs.readFileSync(profilesPath, "utf-8")) : {};
        const aliasKey = alias ?? "default";
        profiles[aliasKey] = {
            smtp: {host: smtp_host, port: smtp_port ?? 587},
            imap: imap_host ? {host: imap_host, port: imap_port ?? 993} : null,
            username,
            password_hint: "[vault'ta şifreli]",
        };
        fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
        // Şifreyi düz metin olarak profil dosyasına YAZMA — şifreli vault'a koy.
        let vaultNote = "";
        if (password) {
            try {
                vaultStore(`email_${aliasKey}_pass`, password);
                vaultNote = " Şifre vault'a şifreli olarak kaydedildi.";
            } catch (e) {
                vaultNote = ` (Şifre vault'a kaydedilemedi: ${(e as Error).message})`;
            }
        }
        return `E-posta profili kaydedildi: ${aliasKey}.${vaultNote}`;
    },
    async email_send({to, subject, body, from_alias}) {
        const profilesPath = path.join(os.homedir(), ".aegis", "email-profiles.json");
        if (!fs.existsSync(profilesPath)) {
            return "HATA: E-posta profili yok. Önce 'email_setup_smtp' ile profil kur.";
        }
        const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf-8"));
        const profile = profiles[from_alias ?? "default"];
        if (!profile) return `HATA: "${from_alias}" profili bulunamadı.`;
        const {smtp, username} = profile;
        const ps = `
Send-MailMessage -To "${to}" -From "${username}" -Subject "${(subject ?? "").replace(/"/g, "'")}" -Body "${(body ?? "").replace(/"/g, "'")}" -SmtpServer "${smtp.host}" -Port ${smtp.port ?? 587} -UseSsl -Credential (New-Object PSCredential("${username}", (ConvertTo-SecureString "[VAULT_PASS]" -AsPlainText -Force))) -ErrorAction Stop
"E-posta gönderildi: ${to}"
`.trim();
        return `E-posta gönderiliyor...\nNot: Vault'tan şifreyi al ve PowerShell'de gönder:\n${ps}`;
    },
    async email_fetch({count, folder}) {
        return `IMAP okuma için şu an doğrudan PowerShell desteği sınırlı. Alternatif: Outlook COM nesnesi kullanılabilir.\nProfil: ${folder ?? "INBOX"}, Son: ${count ?? 10} e-posta\nNot: Outlook kuruluysa 'run_command' ile Outlook COM ile e-posta okuyabilirsin.`;
    },

    // ── Faz 27: Öğrenme & Kişisel Gelişim ───────────────────────────────────
    async card_add({front, back, tags}) {
        const tagList = tags ? String(tags).split(",").map((t) => t.trim()) : [];
        return addFlashcard(front ?? "", back ?? "", tagList);
    },
    async card_review({tag, count}) {
        return reviewFlashcard(tag ?? "", count ? Number(count) : 5);
    },
    async reading_add({url_or_title, notes, priority}) {
        return addReadingItem(url_or_title ?? "", notes ?? "", priority ? Number(priority) : 3);
    },
    async reading_list({status}) {
        return getReadingList(status ?? "pending");
    },
    async reading_summarize({url, add_to_list}) {
        return summarizeUrl(url ?? "", String(add_to_list) !== "false");
    },
    async goal_set({title, deadline, steps}) {
        const stepList = steps ? String(steps).split(",").map((s) => s.trim()) : [];
        return setGoal(title ?? "", deadline ?? "", stepList);
    },
    async goal_check_in({goal_id_or_title, progress, note}) {
        return checkInGoal(goal_id_or_title ?? "", Number(progress ?? 0), note ?? "");
    },
    async goal_list({status}) {
        return listGoals(status ?? "active");
    },

    // ── Faz 28: IoT & Fiziksel ───────────────────────────────────────────────
    async list_bluetooth() {
        return runScript(`Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Select-Object FriendlyName,Status,InstanceId | ConvertTo-Json -Compress`, 10000);
    },
    async connect_bluetooth({device_name}) {
        const ps = `
$dev = Get-PnpDevice -Class Bluetooth | Where-Object {$_.FriendlyName -like "*${device_name}*"} | Select-Object -First 1
if(-not $dev){"HATA: '${ device_name}' bulunamadı"}
else{
  $null = Enable-PnpDevice -InstanceId $dev.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
  "Bağlanıldı: $($dev.FriendlyName)"
}`.trim();
        return runScript(ps, 15000);
    },
    async disconnect_bluetooth({device_name}) {
        const ps = `
$dev = Get-PnpDevice -Class Bluetooth | Where-Object {$_.FriendlyName -like "*${device_name}*"} | Select-Object -First 1
if(-not $dev){"HATA: '${device_name}' bulunamadı"}
else{
  Disable-PnpDevice -InstanceId $dev.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
  "Bağlantı kesildi: $($dev.FriendlyName)"
}`.trim();
        return runScript(ps, 15000);
    },
    async list_usb() {
        return runScript(`Get-PnpDevice -PresentOnly | Where-Object {$_.InstanceId -match '^USB'} | Select-Object FriendlyName,Status,Class | ConvertTo-Json -Compress`, 10000);
    },
    async list_printers() {
        return runScript(`Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus | ConvertTo-Json -Compress`, 10000);
    },
    async print_file({file_path, printer_name}) {
        const target = resolvePath(file_path ?? "");
        if (!fs.existsSync(target)) return `HATA: Dosya bulunamadı: ${target}`;
        const printerArg = printer_name ? `-PrinterName "${printer_name}"` : "";
        return runScript(`Start-Process -FilePath "${target.replace(/\\/g, "\\\\")}" -Verb Print ${printerArg} -Wait`, 30000);
    },
    async printer_status({printer_name}) {
        const filter = printer_name ? `| Where-Object {$_.Name -like "*${printer_name}*"}` : "";
        return runScript(`Get-Printer ${filter} | Select-Object Name,PrinterStatus,WorkOffline | ConvertTo-Json -Compress`, 10000);
    },
    async weather_station({location}) {
        const WEATHER_CODES: Record<number, string> = {
            0: "açık", 1: "az bulutlu", 2: "parçalı bulutlu", 3: "bulutlu",
            45: "sisli", 48: "sisli",
            51: "çiseliyor", 53: "çiseliyor", 55: "çiseliyor",
            61: "yağmurlu", 63: "yağmurlu", 65: "kuvvetli yağmur",
            71: "karlı", 73: "karlı", 75: "yoğun kar",
            80: "sağanak", 81: "sağanak", 82: "kuvvetli sağanak",
            95: "gök gürültülü",
        };
        try {
            let lat: number, lon: number, city: string, country: string;
            if (location && location.trim()) {
                const geo = await (await fetchWithTimeout(
                    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.trim())}&count=1&language=tr&format=json`,
                    {}, 8_000
                )).json() as {results?: {latitude: number; longitude: number; name: string; country: string}[]};
                if (!geo.results?.length) return `"${location}" konumu bulunamadı.`;
                const r = geo.results[0];
                lat = r.latitude; lon = r.longitude; city = r.name; country = r.country;
            } else {
                const geo = await (await fetchWithTimeout("http://ip-api.com/json/?fields=city,country,lat,lon", {}, 8_000)).json() as {city: string; country: string; lat: number; lon: number};
                lat = geo.lat; lon = geo.lon; city = geo.city; country = geo.country;
            }
            const w = await (await fetchWithTimeout(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure`,
                {}, 8_000
            )).json() as {current: {temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number; surface_pressure: number}};
            const c = w.current;
            return `${city}, ${country} Hava Durumu:\nSıcaklık: ${Math.round(c.temperature_2m)}°C (hissedilen ${Math.round(c.apparent_temperature)}°C)\nNem: %${c.relative_humidity_2m}\nBasınç: ${Math.round(c.surface_pressure)} hPa\nRüzgar: ${c.wind_speed_10m} km/s\nDurum: ${WEATHER_CODES[c.weather_code] ?? "—"}`;
        } catch (e) {
            return `HATA: ${(e as Error).message}`;
        }
    },

    // ── Faz 29: Çoklu Model ──────────────────────────────────────────────────
    async model_compare({prompt, models}) {
        return modelCompare(prompt ?? "", models ?? "groq:qwen3-32b,groq:llama-3.3-70b");
    },
    async pipeline_run({pipeline_name, input}) {
        return pipelineRun(pipeline_name ?? "", input ?? "");
    },
    async pipeline_save({name, steps, description}) {
        return savePipeline(name ?? "", steps ?? "[]", description ?? "");
    },
    async pipeline_list() {
        return listPipelines();
    },
    async model_route_set({task_type, model, description}) {
        return setModelRoutingRule(task_type ?? "", model ?? "", description ?? "");
    },
    async model_route_list() {
        return getModelRoutingRules();
    },

    // ── Faz 35: Sesli Çeviri ─────────────────────────────────────────────────
    async translation_start({source_lang, target_lang}) {
        return translationStart(source_lang ?? "tr", target_lang ?? "en");
    },
    async translation_stop() {
        return translationStop();
    },
    async translate_text({text, target_lang, tone}) {
        if (!text) return "HATA: Metin gerekli.";
        return translateText(text, target_lang ?? "en", tone ?? "formal");
    },
    async translate_file({file_path, target_lang}) {
        return translateFile(file_path ?? "", target_lang ?? "en");
    },
    async subtitle_toggle({enable}) {
        return subtitleToggle(!!enable);
    },

    // ── Faz 36: Bildirim Monitörü ────────────────────────────────────────────
    async notification_recent({count}) {
        return getRecentNotifications(Number(count ?? 20));
    },
    async notification_history({count}) {
        return getNotifHistory(Number(count ?? 20));
    },
    async notification_filter_set({app, action}) {
        return notifFilterSet(app ?? "", (action as "show" | "hide") ?? "show");
    },
    async notification_filter_list() {
        return notifFilterList();
    },
    async do_not_disturb({minutes, off}) {
        if (off) return dndOff();
        return dndSet(Number(minutes ?? 30));
    },

    // ── Faz 37: Kod Derleyici & Test Koşucusu ───────────────────────────────
    async project_detect({dir}) {
        return getProjectInfo(dir ?? ".");
    },
    async build_project({dir}) {
        return buildProject(dir ?? ".");
    },
    async run_tests({dir, test_file}) {
        return runTests(dir ?? ".", test_file);
    },
    async lint_project({dir}) {
        return lintProject(dir ?? ".");
    },
    async format_code({dir}) {
        return formatCode(dir ?? ".");
    },

    // ── Faz 38: Haber & Fiyat Takibi ─────────────────────────────────────────
    async rss_add({url, label}) {
        return rssAdd(url ?? "", label ?? "");
    },
    async rss_remove({url}) {
        return rssRemove(url ?? "");
    },
    async rss_list() {
        return rssList();
    },
    async rss_fetch({count}) {
        return rssFetch(Number(count ?? 10));
    },
    async price_get({symbols}) {
        return getPrice(symbols ?? "");
    },
    async crypto_price({coins}) {
        return getCryptoPrice(coins ?? "bitcoin");
    },
    async fx_rate({pairs}) {
        return getFxRate(pairs ?? "USD/TRY");
    },
    async price_alert_set({symbol, type, above, below}) {
        return priceAlertSet(symbol ?? "", (type as "crypto" | "stock" | "fx") ?? "crypto", above != null ? Number(above) : undefined, below != null ? Number(below) : undefined);
    },

    // ── Faz 39: Sesli Toplantı Asistanı ─────────────────────────────────────
    async meeting_start() {
        return meetingStart();
    },
    async meeting_stop() {
        return meetingStop();
    },
    async meeting_list() {
        return meetingList();
    },
    async meeting_summarize({id}) {
        return meetingSummarize(id ?? "");
    },
    async meeting_export({id}) {
        return meetingExport(id ?? "");
    },
    async meeting_action_items({id}) {
        return meetingActionItems(id ?? "");
    },

    // ── Faz 40: Bağlam-Duyarlı Eylemler ─────────────────────────────────────
    async get_active_context() {
        return getActiveContext();
    },
    async context_rule_set({app_pattern, suggestion, auto_action}) {
        return contextRuleSet(app_pattern ?? "", suggestion ?? "", auto_action);
    },
    async context_rule_list() {
        return contextRuleList();
    },
    async clipboard_watch() {
        return clipboardWatch();
    },
    async clipboard_history({count}) {
        return clipboardHistory(Number(count ?? 10));
    },
    async clipboard_search({query}) {
        return clipboardSearch(query ?? "");
    },

    // ── Faz 41: Güçlü Yerel Arama ──────────────────────────────────────────
    async file_search({query, dir}) {
        return fileSearch(query ?? "", dir);
    },
    async content_search({query, dir, extension}) {
        return contentSearch(query ?? "", dir ?? ".", extension);
    },
    async app_search({query, launch}) {
        return appSearch(query ?? "", !!launch);
    },

    // ── Faz 42: Sistem Optimizasyonu ─────────────────────────────────────────
    async kill_heavy_process({top_n, confirm}) {
        return killHeavyProcesses(Number(top_n ?? 3), !!confirm);
    },
    async suspend_process({name}) {
        return suspendProcess(name ?? "");
    },
    async resume_process({name}) {
        return resumeProcess(name ?? "");
    },
    async clear_temp() {
        return clearTemp();
    },
    async flush_dns() {
        return flushDns();
    },
    async startup_manager({action, name}) {
        return startupManager((action as "list" | "disable") ?? "list", name);
    },
    async perf_mode_start() {
        return perfModeStart();
    },
    async perf_mode_stop() {
        return perfModeStop();
    },

    // ── Faz 43: Workspace Sistemi ─────────────────────────────────────────────
    async workspace_create({name, description, system_prompt, model, working_dir}) {
        return workspaceCreate(name ?? "", description ?? "", system_prompt, model, working_dir);
    },
    async workspace_switch({name}) {
        const {result} = workspaceSwitch(name ?? "");
        return result;
    },
    async workspace_list() {
        return workspaceList();
    },
    async workspace_delete({name}) {
        return workspaceDelete(name ?? "");
    },
    async workspace_export({name}) {
        return workspaceExport(name ?? "");
    },
    async workspace_import({file_path}) {
        return workspaceImport(file_path ?? "");
    },

    // ── Faz 44: Rapor & Analitik ──────────────────────────────────────────────
    async daily_report() {
        return dailyReport();
    },
    async weekly_report() {
        return weeklyReport();
    },
    async productivity_insights() {
        return productivityInsights();
    },

    // ── Faz 46: Spotify ──────────────────────────────────────────────────────
    async spotify_authorize() { return spotifyAuthorizeCmd(); },
    async spotify_play({query}: {query?: unknown} = {}) {
        const q = typeof query === "string" ? query.trim() : "";
        return q ? spotifySearchPlay(q) : spotifyPlay();
    },
    async spotify_pause() { return spotifyPause(); },
    async spotify_next() { return spotifyNext(); },
    async spotify_prev() { return spotifyPrev(); },
    async spotify_volume({level}: {level?: unknown}) { return spotifySetVolume(Number(level ?? 50)); },
    async spotify_now_playing() { return spotifyGetState(); },
    async spotify_open() { return spotifyOpen(); },
    async spotify_search({query}: {query?: unknown}) { return spotifySearchPlay(String(query ?? "")); },
    async spotify_playlists() { return spotifyListPlaylists(); },
    async spotify_play_playlist({name}: {name?: unknown}) { return spotifyPlayPlaylist(String(name ?? "")); },
    async spotify_like() { return spotifyLikeTrack(); },
    async spotify_queue({query}: {query?: unknown}) { return spotifyAddToQueue(String(query ?? "")); },
    async spotify_devices() { return spotifyListDevices(); },
    async spotify_transfer({device}: {device?: unknown}) { return spotifyTransferDevice(String(device ?? "")); },
    async spotify_shuffle({enabled}: {enabled?: unknown}) { return spotifySetShuffle(String(enabled) === "true"); },
    async spotify_repeat({mode}: {mode?: unknown}) { return spotifySetRepeat((mode as "off" | "track" | "context") ?? "off"); },

    // Player extras
    async spotify_seek({position_ms}: {position_ms?: unknown}) { return spotifySeek(Number(position_ms ?? 0)); },
    async spotify_recently_played({limit}: {limit?: unknown}) { return spotifyGetRecentlyPlayed(Number(limit ?? 20)); },
    async spotify_get_queue() { return spotifyGetQueue(); },

    // Albums
    async spotify_get_album({id}: {id?: unknown}) { return spotifyGetAlbum(String(id ?? "")); },
    async spotify_album_tracks({id}: {id?: unknown}) { return spotifyGetAlbumTracks(String(id ?? "")); },
    async spotify_saved_albums({limit}: {limit?: unknown}) { return spotifyGetSavedAlbums(Number(limit ?? 20)); },
    async spotify_save_album({id}: {id?: unknown}) { return spotifySaveAlbum(String(id ?? "")); },
    async spotify_remove_album({id}: {id?: unknown}) { return spotifyRemoveSavedAlbum(String(id ?? "")); },

    // Artists
    async spotify_get_artist({id}: {id?: unknown}) { return spotifyGetArtist(String(id ?? "")); },
    async spotify_artist_top_tracks({id}: {id?: unknown}) { return spotifyGetArtistTopTracks(String(id ?? "")); },
    async spotify_artist_albums({id}: {id?: unknown}) { return spotifyGetArtistAlbums(String(id ?? "")); },
    async spotify_related_artists({id}: {id?: unknown}) { return spotifyGetRelatedArtists(String(id ?? "")); },

    // Tracks
    async spotify_get_track({id}: {id?: unknown}) { return spotifyGetTrack(String(id ?? "")); },
    async spotify_audio_features({id}: {id?: unknown}) { return spotifyGetAudioFeatures(String(id ?? "")); },
    async spotify_recommendations({seed_artists, seed_tracks, seed_genres, limit}: {seed_artists?: unknown; seed_tracks?: unknown; seed_genres?: unknown; limit?: unknown}) {
        return spotifyGetRecommendations({
            seed_artists: seed_artists ? String(seed_artists) : undefined,
            seed_tracks:  seed_tracks  ? String(seed_tracks)  : undefined,
            seed_genres:  seed_genres  ? String(seed_genres)  : undefined,
            limit: limit ? Number(limit) : undefined,
        });
    },

    // Playlists extended
    async spotify_get_playlist({id}: {id?: unknown}) { return spotifyGetPlaylist(String(id ?? "")); },
    async spotify_playlist_tracks({id, limit}: {id?: unknown; limit?: unknown}) { return spotifyGetPlaylistItems(String(id ?? ""), Number(limit ?? 20)); },
    async spotify_create_playlist({name, public: pub, description}: {name?: unknown; public?: unknown; description?: unknown}) {
        return spotifyCreatePlaylist(String(name ?? ""), Boolean(pub), String(description ?? ""));
    },
    async spotify_playlist_add({playlist_id, uris}: {playlist_id?: unknown; uris?: unknown}) {
        return spotifyPlaylistAdd(String(playlist_id ?? ""), Array.isArray(uris) ? uris.map(String) : []);
    },
    async spotify_playlist_remove({playlist_id, uris}: {playlist_id?: unknown; uris?: unknown}) {
        return spotifyPlaylistRemove(String(playlist_id ?? ""), Array.isArray(uris) ? uris.map(String) : []);
    },
    async spotify_featured_playlists() { return spotifyGetFeaturedPlaylists(); },

    // Library
    async spotify_saved_tracks({limit}: {limit?: unknown}) { return spotifyGetSavedTracks(Number(limit ?? 20)); },
    async spotify_check_saved_tracks({ids}: {ids?: unknown}) { return spotifyCheckSavedTracks(Array.isArray(ids) ? ids.map(String) : []); },
    async spotify_saved_shows({limit}: {limit?: unknown}) { return spotifyGetSavedShows(Number(limit ?? 20)); },
    async spotify_saved_episodes({limit}: {limit?: unknown}) { return spotifyGetSavedEpisodes(Number(limit ?? 20)); },
    async spotify_saved_audiobooks({limit}: {limit?: unknown}) { return spotifyGetSavedAudiobooks(Number(limit ?? 20)); },

    // User
    async spotify_me() { return spotifyGetCurrentUser(); },
    async spotify_top_items({type, time_range, limit}: {type?: unknown; time_range?: unknown; limit?: unknown}) {
        return spotifyGetTopItems(
            (type as "artists" | "tracks") ?? "tracks",
            (time_range as "short_term" | "medium_term" | "long_term") ?? "medium_term",
            Number(limit ?? 10),
        );
    },

    // Follow
    async spotify_follow_artist({id}: {id?: unknown}) { return spotifyFollowArtist(String(id ?? "")); },
    async spotify_unfollow_artist({id}: {id?: unknown}) { return spotifyUnfollowArtist(String(id ?? "")); },
    async spotify_followed_artists({limit}: {limit?: unknown}) { return spotifyGetFollowedArtists(Number(limit ?? 20)); },

    // Browse
    async spotify_new_releases({limit}: {limit?: unknown}) { return spotifyGetNewReleases(Number(limit ?? 10)); },
    async spotify_categories({limit}: {limit?: unknown}) { return spotifyGetCategories(Number(limit ?? 20)); },

    // Shows / Episodes / Audiobooks
    async spotify_get_show({id}: {id?: unknown}) { return spotifyGetShow(String(id ?? "")); },
    async spotify_show_episodes({id, limit}: {id?: unknown; limit?: unknown}) { return spotifyGetShowEpisodes(String(id ?? ""), Number(limit ?? 10)); },
    async spotify_get_episode({id}: {id?: unknown}) { return spotifyGetEpisode(String(id ?? "")); },
    async spotify_get_audiobook({id}: {id?: unknown}) { return spotifyGetAudiobook(String(id ?? "")); },

    // ── Faz 46: Steam ────────────────────────────────────────────────────────
    async steam_launch({game}: {game?: unknown}) { return steamLaunchGame(String(game ?? "")); },
    async steam_list() { return steamListGames(); },
    async steam_open() { return steamOpen(); },
    async steam_close() { return steamClose(); },
    async steam_game_running() { return steamGameRunning(); },
    // Grup A — local/protokol
    async steam_restart() { return steamRestart(); },
    async steam_close_game({game}: {game?: unknown}) { return steamCloseGame(game != null ? String(game) : undefined); },
    async steam_restart_game({game}: {game?: unknown}) { return steamRestartGame(String(game ?? "")); },
    async steam_list_running_games() { return steamListRunningGames(); },
    async steam_is_game_running({game}: {game?: unknown}) { return steamIsGameRunning(String(game ?? "")); },
    async steam_install_game({game}: {game?: unknown}) { return steamInstallGame(String(game ?? "")); },
    async steam_uninstall_game({game}: {game?: unknown}) { return steamUninstallGame(String(game ?? "")); },
    async steam_verify_game_files({game}: {game?: unknown}) { return steamVerifyGameFiles(String(game ?? "")); },
    async steam_update_game({game}: {game?: unknown}) { return steamUpdateGame(String(game ?? "")); },
    async steam_download_status() { return steamDownloadStatus(); },
    async steam_open_store_page({game}: {game?: unknown}) { return steamOpenStorePage(String(game ?? "")); },
    async steam_open_screenshots() { return steamOpenScreenshots(); },
    async steam_show_storage_usage() { return steamShowStorageUsage(); },
    async steam_locate_installation({game}: {game?: unknown}) { return steamLocateInstallation(String(game ?? "")); },
    async steam_open_game_folder({game}: {game?: unknown}) { return steamOpenGameFolder(String(game ?? "")); },
    async steam_last_played_game() { return steamGetLastPlayed(); },
    // Grup C — storefront
    async steam_search_store({query}: {query?: unknown}) { return steamSearchStore(String(query ?? "")); },
    async steam_game_details({game}: {game?: unknown}) { return steamGetGameDetails(String(game ?? "")); },
    async steam_game_price({game}: {game?: unknown}) { return steamGetGamePrice(String(game ?? "")); },
    async steam_discounted_games() { return steamGetDiscountedGames(); },
    async steam_game_news({game}: {game?: unknown}) { return steamGetGameNews(String(game ?? "")); },
    // Grup B — Web API
    async steam_owned_games() { return steamGetOwnedGames(); },
    async steam_search_owned_games({query}: {query?: unknown}) { return steamSearchOwnedGames(String(query ?? "")); },
    async steam_recent_games() { return steamGetRecentGames(); },
    async steam_most_played_games() { return steamGetMostPlayed(); },
    async steam_game_playtime({game}: {game?: unknown}) { return steamGetGamePlaytime(String(game ?? "")); },
    async steam_total_playtime() { return steamGetTotalPlaytime(); },
    async steam_suggest_game() { return steamSuggestGame(); },
    async steam_game_achievements({game}: {game?: unknown}) { return steamGetGameAchievements(String(game ?? "")); },
    async steam_achievement_progress({game}: {game?: unknown}) { return steamGetAchievementProgress(String(game ?? "")); },
    async steam_player_stats({game}: {game?: unknown}) { return steamGetPlayerStats(String(game ?? "")); },
    async steam_profile_summary() { return steamGetProfileSummary(); },
    async steam_level() { return steamGetLevel(); },
    async steam_friend_list() { return steamGetFriendList(); },
    async steam_online_friends() { return steamGetOnlineFriends(); },
    async steam_friend_current_game({friend}: {friend?: unknown}) { return steamGetFriendCurrentGame(String(friend ?? "")); },
    async steam_who_is_playing({game}: {game?: unknown}) { return steamWhoIsPlaying(String(game ?? "")); },
    // Grup D — deneysel
    async steam_wishlist_add({game}: {game?: unknown}) {
        // 1) Mağaza sayfasını aç (AppID çözülür). Steam 3rd-party'ye sessiz wishlist
        //    yazma API'si vermez; sayfa açıldıktan sonra computer-use ile '+ İstek
        //    Listesine Ekle' butonuna tıklamayı DENERİZ.
        const opened = await steamWishlistAdd(String(game ?? ""), true);
        if (/^HATA|bulunamadı/.test(opened)) return opened;

        // Vision döngüsü kullanılamıyorsa (callback yok) sayfa açık kalır — kullanıcı elle ekler.
        if (!_screenshotCallback || !_analyzeScreenCallback) {
            return `${opened}\n(Otomatik tıklama için vision modeli gerekli — sayfadan elle ekleyebilirsin.)`;
        }

        // 2) Sayfanın yüklenmesini bekle, sonra butona otomatik tıkla.
        await new Promise((r) => setTimeout(r, 3500));
        const goal = "Açık olan Steam mağaza sayfasında '+ İstek Listesine Ekle' " +
            "(veya İngilizce 'Add to your wishlist') butonunu bul ve TIKLA. " +
            "Buton zaten 'İstek Listesinde' yazıyorsa zaten ekli demektir, done döndür. " +
            "Tıkladıktan sonra done döndür.";
        const cuResult = await executors.computer_use({goal, max_steps: "6"});
        return `${opened}\n\nOtomatik ekleme denemesi:\n${cuResult}\n\n(Computer-use kırılgandır; eklenmediyse sayfadan elle '+ İstek Listesine Ekle'ye tıkla.)`;
    },
    async steam_wishlist_remove({game}: {game?: unknown}) { return steamWishlistAdd(String(game ?? ""), false); },
    async steam_wishlist_list() { return steamWishlistList(); },
    async steam_pause_download() { return steamPauseResumeCancel("pause"); },
    async steam_resume_download() { return steamPauseResumeCancel("resume"); },
    async steam_cancel_download() { return steamPauseResumeCancel("cancel"); },
    async steam_open_workshop({game}: {game?: unknown}) { return steamOpenWorkshop(game != null ? String(game) : undefined); },
    async steam_subscribe_workshop({item_id}: {item_id?: unknown}) { return steamWorkshopSubscribe(String(item_id ?? ""), true); },
    async steam_unsubscribe_workshop({item_id}: {item_id?: unknown}) { return steamWorkshopSubscribe(String(item_id ?? ""), false); },
    async steam_list_workshop_subscriptions({game}: {game?: unknown}) { return steamListWorkshopSubs(game != null ? String(game) : undefined); },
    async steam_open_chat({friend_id}: {friend_id?: unknown}) { return steamOpenChat(String(friend_id ?? "")); },
    async steam_send_message({friend_id, message}: {friend_id?: unknown; message?: unknown}) { return steamSendMessage(String(friend_id ?? ""), String(message ?? "")); },
    async steam_backup_game({game}: {game?: unknown}) { return steamBackupGame(String(game ?? "")); },
    async steam_restore_backup() { return steamRestoreBackup(); },
    async steam_take_screenshot() { return steamTakeScreenshot(); },
    async steam_repeat_last_action() { return steamRepeatLastAction(); },

    // ── Faz 47: Computer Use ─────────────────────────────────────────────────
    async mouse_move({x, y}: {x?: unknown; y?: unknown}) {
        return mouseMove(Number(x ?? 0), Number(y ?? 0));
    },
    async mouse_click({x, y, button, double: dbl}: {x?: unknown; y?: unknown; button?: unknown; double?: unknown}) {
        return mouseClick(Number(x ?? 0), Number(y ?? 0), (String(button ?? "left")) as "left"|"right"|"middle", Boolean(dbl));
    },
    async mouse_scroll({x, y, direction, amount}: {x?: unknown; y?: unknown; direction?: unknown; amount?: unknown}) {
        return mouseScroll(Number(x ?? 0), Number(y ?? 0), (String(direction ?? "down")) as "up"|"down", Number(amount ?? 3));
    },
    async mouse_drag({x1, y1, x2, y2}: {x1?: unknown; y1?: unknown; x2?: unknown; y2?: unknown}) {
        return mouseDrag(Number(x1 ?? 0), Number(y1 ?? 0), Number(x2 ?? 0), Number(y2 ?? 0));
    },
    async key_press({keys}: {keys?: unknown}) {
        return keyPress(String(keys ?? ""));
    },
    async type_text({text}: {text?: unknown}) {
        return typeText(String(text ?? ""));
    },
    async screen_size() {
        const s = await getScreenSize();
        return `Ekran çözünürlüğü: ${s.width}x${s.height}`;
    },
    async computer_use({goal, max_steps}: {goal?: unknown; max_steps?: unknown}) {
        if (!_screenshotCallback) return "HATA: Screenshot callback kayıtlı değil.";
        if (!_analyzeScreenCallback) return "HATA: Vision callback kayıtlı değil.";
        if (!goal) return "HATA: Hedef belirtilmedi.";

        const maxSteps = Math.min(Number(max_steps ?? 10), 20);
        const log: string[] = [];

        const screenSize = await getScreenSize();
        const systemPrompt = `Sen bir bilgisayar kullanıcısısın. Ekran görüntüsüne bakıp mouse/klavye ile hedefi gerçekleştiriyorsun.
Ekran boyutu: ${screenSize.width}x${screenSize.height}.
Her yanıtında SADECE JSON formatında bir eylem döndür:
{"action": "click", "x": 100, "y": 200, "button": "left"}
{"action": "double_click", "x": 100, "y": 200}
{"action": "right_click", "x": 100, "y": 200}
{"action": "type", "text": "yazılacak metin"}
{"action": "key", "keys": "ctrl+c"}
{"action": "scroll", "x": 500, "y": 400, "direction": "down", "amount": 3}
{"action": "move", "x": 300, "y": 150}
{"action": "done", "result": "Açıklama"}
{"action": "fail", "reason": "Neden başarısız"}
Hedef tamamlandıysa "done", tamamlanamıyorsa "fail" döndür.`;

        for (let step = 0; step < maxSteps; step++) {
            const scResult = await _screenshotCallback();
            if ("error" in scResult) {
                log.push(`[Adım ${step + 1}] Screenshot hatası: ${scResult.error}`);
                break;
            }

            const prompt = `Hedef: ${String(goal)}\nTamamlanan adımlar: ${log.join("; ") || "yok"}\nEkrana bak ve sonraki eylemi JSON olarak döndür.`;
            const response = await _analyzeScreenCallback(scResult.base64, `${systemPrompt}\n\n${prompt}`);

            // JSON çıkar
            const jsonMatch = response.match(/\{[^}]+\}/);
            if (!jsonMatch) {
                log.push(`[Adım ${step + 1}] JSON parse hatası`);
                break;
            }

            let action: Record<string, unknown>;
            try {
                action = JSON.parse(jsonMatch[0]);
            } catch {
                log.push(`[Adım ${step + 1}] JSON geçersiz`);
                break;
            }

            const act = String(action.action ?? "");

            if (act === "done") {
                log.push(`[Adım ${step + 1}] Tamamlandı: ${action.result}`);
                return `Hedef tamamlandı (${step + 1} adımda):\n${log.join("\n")}`;
            }
            if (act === "fail") {
                log.push(`[Adım ${step + 1}] Başarısız: ${action.reason}`);
                return `Hedef tamamlanamadı:\n${log.join("\n")}`;
            }

            let stepResult = "";
            const x = Number(action.x ?? 0);
            const y = Number(action.y ?? 0);

            if (act === "click")        stepResult = await mouseClick(x, y, "left", false);
            else if (act === "double_click") stepResult = await mouseClick(x, y, "left", true);
            else if (act === "right_click") stepResult = await mouseClick(x, y, "right", false);
            else if (act === "move")    stepResult = await mouseMove(x, y);
            else if (act === "type")    stepResult = await typeText(String(action.text ?? ""));
            else if (act === "key")     stepResult = await keyPress(String(action.keys ?? ""));
            else if (act === "scroll")  stepResult = await mouseScroll(x, y, String(action.direction ?? "down") as "up"|"down", Number(action.amount ?? 3));
            else {
                log.push(`[Adım ${step + 1}] Bilinmeyen eylem: ${act}`);
                break;
            }

            log.push(`[Adım ${step + 1}] ${act}: ${stepResult}`);
            // Ekranın güncellenmesi için kısa bekleme
            await new Promise((r) => setTimeout(r, 600));
        }

        return `Computer Use tamamlandı (${maxSteps} adım limiti):\n${log.join("\n")}`;
    },

    // ─────────────────────────────────────────── Faz 62 — Akıllı Ev (Home Assistant)
    async smart_home_devices({area}) {
        const cfg = getHAConfig();
        if (!cfg) return HA_NOT_CONFIGURED;
        try {
            const all = smartHome.controllable(await smartHome.fetchStates(cfg));
            if (all.length === 0) return "Home Assistant'a bağlanıldı ama kontrol edilebilir cihaz bulunamadı.";
            let list = all;
            if (area) {
                const a = smartHome.normalize(area);
                list = all.filter((e) => smartHome.normalize(e.friendly_name + " " + (e.attributes.area as string ?? "")).includes(a));
                if (list.length === 0) return `"${area}" alanında cihaz bulunamadı. Tüm cihazları görmek için alan belirtme.`;
            }
            const byArea = smartHome.groupByArea(list);
            const parts: string[] = [];
            for (const [areaName, ents] of byArea) {
                parts.push(`\n📍 ${areaName}:`);
                for (const e of ents) parts.push(`  • ${smartHome.describeState(e)}${smartHome.isCriticalEntity(e) ? " ⚠️" : ""}`);
            }
            return `Akıllı ev cihazları (${list.length}):${parts.join("\n")}\n\n⚠️ = kritik cihaz (kontrol için onay ister)`;
        } catch (e) {
            return `Akıllı ev cihazları alınamadı: ${(e as Error).message}`;
        }
    },

    async smart_home_status({target}) {
        const cfg = getHAConfig();
        if (!cfg) return HA_NOT_CONFIGURED;
        try {
            const states = await smartHome.fetchStates(cfg);
            const {matches} = smartHome.resolveEntities(target, states);
            if (matches.length === 0) return `"${target}" ile eşleşen cihaz bulunamadı. 'akıllı ev cihazlarını listele' diyerek mevcut cihazları gör.`;
            return matches.map((e) => smartHome.describeState(e)).join("\n");
        } catch (e) {
            return `Durum sorgulanamadı: ${(e as Error).message}`;
        }
    },

    async smart_home_control({target, action, value, confirm}) {
        const cfg = getHAConfig();
        if (!cfg) return HA_NOT_CONFIGURED;
        try {
            const states = await smartHome.fetchStates(cfg);
            const {matches, scope} = smartHome.resolveEntities(target, states);
            if (matches.length === 0) return `"${target}" ile eşleşen cihaz bulunamadı. 'akıllı ev cihazlarını listele' diyerek mevcut cihazları gör.`;

            const act = buildSmartHomeAction(action, value);
            if (typeof act === "string") return act; // hata mesajı

            // Onay kapısı: eşleşenlerden biri kritikse ve confirm gelmemişse, dur ve sor.
            const critical = matches.filter((e) => smartHome.isCriticalEntity(e));
            const confirmed = String(confirm ?? "").toLowerCase() === "true";
            if (critical.length > 0 && !confirmed) {
                const names = critical.map((e) => e.friendly_name).join(", ");
                return `ONAY GEREKLİ: Bu kritik cihaz(lar) etkilenecek → ${names}. ` +
                    `Kullanıcıya "${names} için '${describeAction(action, value)}' yapayım mı?" diye sor. ` +
                    `Onaylarsa aynı aracı confirm:"true" ile tekrar çağır.`;
            }

            const results: string[] = [];
            for (const e of matches) {
                try {
                    results.push("✓ " + await smartHome.applyAction(cfg, e, act));
                } catch (err) {
                    results.push(`✗ ${e.friendly_name}: ${(err as Error).message}`);
                }
            }
            const header = scope ? `${scope} → ${describeAction(action, value)}:\n` : "";
            return header + results.join("\n");
        } catch (e) {
            return `Kontrol başarısız: ${(e as Error).message}`;
        }
    },

    async smart_home_scene({name}) {
        const cfg = getHAConfig();
        if (!cfg) return HA_NOT_CONFIGURED;
        try {
            const states = await smartHome.fetchStates(cfg);
            const target = smartHome.normalize(name);
            // scene.* veya script.* domain'inde isim eşleşmesi ara
            const cand = states.filter((e) => (e.domain === "scene" || e.domain === "script"))
                .map((e) => ({e, hay: smartHome.normalize(e.friendly_name + " " + e.entity_id)}))
                .filter((x) => target.split(" ").every((w) => x.hay.includes(w)));
            if (cand.length === 0) return `"${name}" adında sahne veya script bulunamadı.`;
            const chosen = cand[0].e;
            if (chosen.domain === "scene") {
                await smartHome.callService(cfg, "scene", "turn_on", {entity_id: chosen.entity_id});
            } else {
                await smartHome.callService(cfg, "script", "turn_on", {entity_id: chosen.entity_id});
            }
            return `✓ "${chosen.friendly_name}" etkinleştirildi.`;
        } catch (e) {
            return `Sahne etkinleştirilemedi: ${(e as Error).message}`;
        }
    },

    async local_devices_scan({duration_ms}) {
        // Home Assistant GEREKMEZ — saf yerel ağ keşfi (mDNS + SSDP).
        const raw = parseInt(String(duration_ms ?? "3000"), 10);
        const dur = Number.isFinite(raw) ? Math.min(6000, Math.max(1000, raw)) : 3000;
        try {
            const net = getNetworkInfo();
            const devices = await discoverAll(dur);
            return formatDevices(devices, net);
        } catch (e) {
            return `Yerel cihaz taraması başarısız: ${(e as Error).message}`;
        }
    },
};

// ── Akıllı ev yardımcıları ────────────────────────────────────────────────────
const HA_NOT_CONFIGURED =
    "Akıllı ev bağlı değil. Ayarlar → Akıllı Ev'den Home Assistant adresini (örn: " +
    "http://homeassistant.local:8123) ve erişim token'ını gir. Home Assistant, tek " +
    "bağlantıyla Philips Hue, Tapo, Tuya, Matter ve daha fazlasını kontrol etmeni sağlar.";

function getHAConfig(): HAConfig | null {
    const url = process.env.HOME_ASSISTANT_URL ?? "";
    const token = process.env.HOME_ASSISTANT_TOKEN ?? "";
    if (!url || !token) return null;
    return {url, token};
}

// action + value → SmartHomeAction (veya kullanıcıya dönecek hata string'i).
function buildSmartHomeAction(action: string, value?: string): SmartHomeAction | string {
    switch (action) {
        case "on": return {kind: "on"};
        case "off": return {kind: "off"};
        case "toggle": return {kind: "toggle"};
        case "lock": return {kind: "lock"};
        case "unlock": return {kind: "unlock"};
        case "open": return {kind: "open"};
        case "close": return {kind: "close"};
        case "brightness": {
            const pct = Number(value);
            if (!Number.isFinite(pct)) return "Parlaklık için 0-100 arası bir yüzde değeri gerekli (value).";
            return {kind: "brightness", pct};
        }
        case "temperature": {
            const c = Number(value);
            if (!Number.isFinite(c)) return "Sıcaklık için derece değeri gerekli (value).";
            return {kind: "temperature", celsius: c};
        }
        default:
            return `Bilinmeyen aksiyon: "${action}".`;
    }
}

function describeAction(action: string, value?: string): string {
    switch (action) {
        case "on": return "aç";
        case "off": return "kapat";
        case "toggle": return "değiştir";
        case "lock": return "kilitle";
        case "unlock": return "kilidi aç";
        case "open": return "aç (panjur/garaj)";
        case "close": return "kapat (panjur/garaj)";
        case "brightness": return `parlaklık %${value ?? "?"}`;
        case "temperature": return `${value ?? "?"}°C`;
        default: return action;
    }
}

export async function executeTool(name: string, argsJson: string): Promise<ToolResult> {
    if (_disabledTools.has(name)) return `ENGELLENDI: "${name}" aracı ayarlardan devre dışı bırakılmış.`;
    const fn = executors[name] ?? _pluginExecutors[name];
    if (!fn) {
        console.error(`[executeTool] Bilinmeyen araç: "${name}"`);
        return `Bu araç tanımlı değil: "${name}". Model yanlış bir araç adı üretiyor olabilir — konuşmayı yenile.`;
    }
    let args: Record<string, string> = {};
    try {
        args = argsJson ? JSON.parse(argsJson) : {};
    } catch {
        console.error(`[executeTool] JSON parse hatası — araç: ${name}, args: ${argsJson}`);
        return `Araç argümanları geçersiz format içeriyor. Tekrar dene.`;
    }
    try {
        return await fn(args);
    } catch (e) {
        const msg = (e as Error).message ?? String(e);
        console.error(`[executeTool] "${name}" çalışırken hata:`, msg);
        return `"${name}" aracı çalışırken hata oluştu: ${msg}`;
    }
}
