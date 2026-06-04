import {exec as execCb} from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type {ChatCompletionTool} from "groq-sdk/resources/chat/completions";
import {setUserProfile, getUserProfile, saveNote, getPendingNotes, markNoteDone} from "./db";
import {toolScheduleTask, toolListScheduledTasks, toolCancelScheduledTask, toolToggleScheduledTask} from "./scheduler";
import {startMacroRecording, stopMacroRecording, listMacros, deleteMacro, getMacroSteps, isRecording, addMacroStep} from "./macros";
import {addAutomation, listAutomations, removeAutomation, toggleAutomation} from "./automations";
import {indexFile, indexFolder, searchKnowledge, readFileForChat, listIndexedFiles, removeFromIndex} from "./knowledge";
import {addFact, listFacts, removeFact, listHabits, recordToolUsage} from "./memory-plus";
import {vaultStore, vaultList, vaultDelete, privacyAudit, clearOldData} from "./vault";
import {pluginSearch, pluginInstall, pluginRemove} from "./plugin-manager";
import {playSound, ambientStart, ambientStop, listSounds} from "./sound-player";
import {pomodoroStart, pomodoroStop, timeTrackStart, timeTrackStop, timeTrackReport} from "./time-manager";
import {addPersona, listPersonas, setActivePersona, getActivePersona, startRoleplay, stopRoleplay, getRoleplayPrompt} from "./persona";
import {addFlashcard, reviewFlashcard, addReadingItem, getReadingList, summarizeUrl, setGoal, checkInGoal, listGoals} from "./learning";
import {modelCompare, pipelineRun, listPipelines, savePipeline, getModelRoutingRules, setModelRoutingRule} from "./model-router";
import {translationStart, translationStop, translateText, translateFile, subtitleToggle} from "./translator";
import {getRecentNotifications, notifFilterSet, notifFilterList, dndSet, dndOff, getNotifHistory} from "./notif-monitor";
import {detectProject, buildProject, runTests, lintProject, formatCode, getProjectInfo} from "./dev-runner";
import {rssAdd, rssRemove, rssList, rssFetch, getPrice, getCryptoPrice, getFxRate, priceAlertSet, portfolioSummary} from "./feeds";
import {meetingStart, meetingStop, meetingList, meetingSummarize, meetingExport, meetingActionItems} from "./meeting";
import {getActiveContext, contextRuleSet, contextRuleList, clipboardWatch, clipboardHistory, clipboardSearch} from "./context-actions";
import {fileSearch, contentSearch, appSearch} from "./search-plus";
import {killHeavyProcesses, suspendProcess, resumeProcess, clearTemp, flushDns, startupManager, perfModeStart, perfModeStop} from "./sys-optimizer";
import {workspaceCreate, workspaceSwitch, workspaceList, workspaceDelete, workspaceExport, workspaceImport} from "./workspace";
import {dailyReport, weeklyReport, productivityInsights} from "./reporter";
import {spotifyAuthorizeCmd, spotifyPlay, spotifyPause, spotifyNext, spotifyPrev, spotifySetVolume, spotifyGetState, spotifyOpen, spotifySearchPlay, spotifyListPlaylists, spotifyPlayPlaylist, spotifyLikeTrack, spotifyAddToQueue, spotifyListDevices, spotifyTransferDevice, spotifySetShuffle, spotifySetRepeat} from "./spotify";
import {steamLaunchGame, steamListGames, steamOpen, steamClose, steamGameRunning} from "./steam";
import {mouseMove, mouseClick, mouseScroll, mouseDrag, keyPress, typeText, getScreenSize} from "./computer-use";

type ToolResult = string;

function resolvePath(p: string): string {
    if (!p) return os.homedir();
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

export const toolSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "quit_self",
            description: "AEGIS uygulamasını kapat. Kullanıcı 'kendini kapat', 'uygulamayı kapat', 'çık' gibi bir şey dediğinde kullan.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "run_command",
            description: "Windows PowerShell komutu çalıştır. YASAK: Steam oyunu açmak için ASLA kullanma — bunun için steam_launch aracı var. Spotify için de spotify_* araçlarını kullan.",
            parameters: {
                type: "object",
                properties: {command: {type: "string", description: "Çalıştırılacak PowerShell komutu"}},
                required: ["command"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "read_file",
            description: "Bir metin dosyasının içeriğini oku. ~ ev dizinini temsil eder.",
            parameters: {
                type: "object",
                properties: {path: {type: "string", description: "Okunacak dosya yolu"}},
                required: ["path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "write_file",
            description: "Bir dosyaya içerik yaz (varsa üzerine yazar, yoksa oluşturur).",
            parameters: {
                type: "object",
                properties: {
                    path: {type: "string", description: "Yazılacak dosya yolu"},
                    content: {type: "string", description: "Dosyaya yazılacak içerik"},
                },
                required: ["path", "content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_directory",
            description: "Bir klasördeki dosya ve klasörleri listele.",
            parameters: {
                type: "object",
                properties: {path: {type: "string", description: "Listelenecek klasör yolu (opsiyonel)"}},
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "web_search",
            description: "İnternette güncel bilgi ara. Tavily kullanır.",
            parameters: {
                type: "object",
                properties: {query: {type: "string", description: "Arama sorgusu"}},
                required: ["query"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_profile",
            description: "Kullanıcı hakkında bir bilgi kaydet. Örn: isim, meslek, tercihler, alışkanlıklar.",
            parameters: {
                type: "object",
                properties: {
                    key: {type: "string", description: "Bilgi anahtarı (örn: 'isim', 'meslek', 'kahve_tercihi')"},
                    value: {type: "string", description: "Bilgi değeri"},
                },
                required: ["key", "value"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_profile",
            description: "Kaydedilmiş kullanıcı bilgilerini getir.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "save_note",
            description: "Bir not veya hatırlatıcı kaydet. Tarih/saat belirtilirse o zaman hatırlatır.",
            parameters: {
                type: "object",
                properties: {
                    content: {type: "string", description: "Not içeriği"},
                    remind_at: {type: "string", description: "ISO 8601 tarih/saat (opsiyonel, örn: '2026-06-01T09:00:00')"},
                },
                required: ["content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_notes",
            description: "Bekleyen notları ve hatırlatıcıları listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "done_note",
            description: "Bir notu tamamlandı olarak işaretle.",
            parameters: {
                type: "object",
                properties: {id: {type: "string", description: "Not ID'si"}},
                required: ["id"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "read_clipboard",
            description: "Panodaki metni oku. 'Panoyu oku', 'Panoda ne var?' gibi.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "write_clipboard",
            description: "Metni panoya kopyala. 'Bunu kopyala', 'Panoya yaz' gibi.",
            parameters: {
                type: "object",
                properties: {text: {type: "string", description: "Panoya yazılacak metin"}},
                required: ["text"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_windows",
            description: "Şu an açık olan pencereleri listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "focus_window",
            description: "Belirtilen pencereyi öne getir / odakla. 'Chrome'u öne getir', 'VSCode'u aç' gibi.",
            parameters: {
                type: "object",
                properties: {title: {type: "string", description: "Pencere başlığı veya uygulama adı (kısmi eşleşme yeterli)"}},
                required: ["title"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_volume",
            description: "Sistem ses seviyesini ayarla (0-100). 'Sesi %50 yap', 'Sesi aç/kapat' gibi.",
            parameters: {
                type: "object",
                properties: {level: {type: "number", description: "Ses seviyesi 0-100"}},
                required: ["level"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_brightness",
            description: "Ekran parlaklığını ayarla (0-100). Dahili ekranlarda çalışır.",
            parameters: {
                type: "object",
                properties: {level: {type: "number", description: "Parlaklık 0-100"}},
                required: ["level"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "remind_in",
            description: "X dakika sonra kullanıcıya sesli/yazılı hatırlatıcı gönder. '10 dakika sonra hatırlat', 'Yarım saat sonra...' gibi.",
            parameters: {
                type: "object",
                properties: {
                    message: {type: "string", description: "Hatırlatıcı mesajı"},
                    minutes: {type: "number", description: "Kaç dakika sonra (ondalık da olabilir, örn: 0.5 = 30 saniye)"},
                },
                required: ["message", "minutes"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "save_app_profile",
            description: "Bir uygulama profili kaydet. Her satırda bir PowerShell komutu. 'Oyun modunu kaydet', 'Çalışma profili oluştur' gibi.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Profil adı (örn: oyun_modu, calisma_modu)"},
                    commands: {type: "string", description: "Her satırda bir PowerShell komutu (örn: Start-Process chrome\\nStart-Process code)"},
                },
                required: ["name", "commands"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "run_app_profile",
            description: "Kaydedilmiş uygulama profilini çalıştır. 'Oyun modunu aç', 'Çalışma moduna geç' gibi.",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Çalıştırılacak profil adı"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_app_profiles",
            description: "Kayıtlı uygulama profillerini listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "screenshot",
            description: "Ekranın anlık görüntüsünü al ve analiz et. 'Ekranımda ne var?', 'Bu hata ne?', 'Ekranı analiz et' gibi sorularda kullan. question parametresi ile ne sormak istediğini belirt.",
            parameters: {
                type: "object",
                properties: {
                    question: {type: "string", description: "Ekran hakkında sorulacak soru veya yapılacak analiz (örn: 'Ekranda ne var?', 'Bu hata mesajı ne anlama geliyor?', 'Hangi uygulama açık?')"},
                },
                required: ["question"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_language",
            description: "Switch the interface and response language. Call when user asks to change language (e.g. 'switch to English', 'Türkçeye geç', 'Auf Deutsch wechseln', 'en français', 'cambia a español').",
            parameters: {
                type: "object",
                properties: {
                    language: {
                        type: "string",
                        enum: ["tr", "en", "de", "fr", "es"],
                        description: "Language code: tr=Turkish, en=English, de=German, fr=French, es=Spanish",
                    },
                },
                required: ["language"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "fetch_url",
            description: "Bir web sayfasının içeriğini getir ve düz metin olarak döndür. 'Bu sayfada ne yazıyor?', 'URL'yi oku', 'Haberi özetle' gibi.",
            parameters: {
                type: "object",
                properties: {
                    url: {type: "string", description: "Okunacak web sayfasının URL'si (örn: https://example.com)"},
                },
                required: ["url"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "show_notification",
            description: "Windows'ta sistem bildirim balonu göster. 'Bildirim gönder', 'Bana bildir', 'Toast bildirim' gibi.",
            parameters: {
                type: "object",
                properties: {
                    title: {type: "string", description: "Bildirim başlığı"},
                    body: {type: "string", description: "Bildirim içeriği / mesaj"},
                },
                required: ["title", "body"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_plugins",
            description: "Yüklü plugin'leri ve sağladıkları araçları listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "reload_plugins",
            description: "Plugin'leri ~/.aegis/plugins/ klasöründen yeniden yükle. Yeni plugin eklendikten sonra kullan.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
];

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

export const extraSchemas: ChatCompletionTool[] = [];

const schedulerSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "schedule_task",
            description: "Tekrarlayan zamanlanmış görev oluştur. 'Her sabah hava durumunu söyle', 'Her saat başı CPU kullanımını kontrol et' gibi.",
            parameters: {
                type: "object",
                properties: {
                    name:     {type: "string", description: "Görev adı (benzersiz, kısa)"},
                    schedule: {type: "string", description: "Zamanlama: 'every 30 minutes', 'every 2 hours', 'daily at 09:00', 'hourly'"},
                    command:  {type: "string", description: "AEGIS'e gönderilecek doğal dil komutu (örn: 'hava durumunu söyle')"},
                },
                required: ["name", "schedule", "command"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_scheduled_tasks",
            description: "Tüm zamanlanmış görevleri listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "cancel_scheduled_task",
            description: "Zamanlanmış görevi iptal et (ad veya ID ile).",
            parameters: {
                type: "object",
                properties: {
                    id_or_name: {type: "string", description: "Görev adı (kısmi eşleşme yeterli) veya ID"},
                },
                required: ["id_or_name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "toggle_scheduled_task",
            description: "Zamanlanmış görevi etkinleştir/devre dışı bırak.",
            parameters: {
                type: "object",
                properties: {
                    id_or_name: {type: "string", description: "Görev adı veya ID"},
                },
                required: ["id_or_name"],
                additionalProperties: false,
            },
        },
    },
];

const marketplaceSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "plugin_search",
            description: "GitHub'da AEGIS plugin ara. 'Discord plugin var mı?', 'Notion entegrasyonu ara' gibi.",
            parameters: {
                type: "object",
                properties: {
                    query: {type: "string", description: "Arama terimi"},
                },
                required: ["query"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "plugin_install",
            description: "GitHub repo'sundan plugin kur. 'kullanici/aegis-plugin-x' formatında.",
            parameters: {
                type: "object",
                properties: {
                    repo: {type: "string", description: "GitHub repo yolu (örn: user/aegis-plugin-discord)"},
                },
                required: ["repo"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "plugin_remove",
            description: "Yüklü bir plugin'i kaldır.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Plugin adı"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
];

const securitySchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "vault_store",
            description: "API key veya hassas veriyi Windows şifreli depoya (safeStorage) kaydet.",
            parameters: {
                type: "object",
                properties: {
                    key:   {type: "string", description: "Anahtar adı (örn: 'openai_key')"},
                    value: {type: "string", description: "Kaydedilecek değer"},
                },
                required: ["key", "value"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "vault_list",
            description: "Güvenli depodaki anahtarları listele (değerleri göstermez).",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "vault_delete",
            description: "Güvenli depodan bir anahtarı sil.",
            parameters: {
                type: "object",
                properties: {
                    key: {type: "string", description: "Silinecek anahtar adı"},
                },
                required: ["key"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "privacy_audit",
            description: "Hangi verilerin nerede saklandığını listele. 'Gizlilik denetimi yap', 'Verilerimi nerede saklıyorsun?' gibi.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "clear_old_data",
            description: "Eski verileri temizle (bilgi tabanı chunk'ları, devre dışı görevler). 'X günden eski verileri sil' gibi.",
            parameters: {
                type: "object",
                properties: {
                    days: {type: "number", description: "Kaç günden eski veri silinsin (varsayılan 30)"},
                },
                additionalProperties: false,
            },
        },
    },
];

const memoryPlusSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "remember_fact",
            description: "Kalıcı bir gerçeği hafızaya kaydet. 'Bunu bil: abimin adı Ahmet', 'Hatırla: proje teslim tarihi 15 Temmuz' gibi.",
            parameters: {
                type: "object",
                properties: {
                    content: {type: "string", description: "Kaydedilecek gerçek"},
                    tags:    {type: "string", description: "Etiketler, virgülle ayrılmış (opsiyonel, örn: 'aile,kişisel')"},
                },
                required: ["content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_facts",
            description: "Kaydedilmiş gerçekleri listele. 'Ne biliyorsun?', 'Kayıtlı bilgilerin neler?' gibi.",
            parameters: {
                type: "object",
                properties: {
                    filter: {type: "string", description: "Filtreleme terimi (opsiyonel)"},
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "forget_fact",
            description: "Kayıtlı bir gerçeği sil.",
            parameters: {
                type: "object",
                properties: {
                    id_or_content: {type: "string", description: "Gerçek ID veya içeriği (kısmi eşleşme)"},
                },
                required: ["id_or_content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_habits",
            description: "En sık kullandığın araçları ve alışkanlık istatistiklerini göster.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
];

const knowledgeSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "index_file",
            description: "Bir dosyayı bilgi tabanına indeksle. .txt, .md, .ts, .js, .py, .json, .csv desteklenir.",
            parameters: {
                type: "object",
                properties: {
                    file_path: {type: "string", description: "İndekslenecek dosya yolu (~ desteklenir)"},
                },
                required: ["file_path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "index_folder",
            description: "Bir klasördeki tüm uygun dosyaları bilgi tabanına indeksle.",
            parameters: {
                type: "object",
                properties: {
                    folder_path: {type: "string", description: "Klasör yolu"},
                    extensions:  {type: "string", description: "Virgülle ayrılmış uzantılar (varsayılan: .txt,.md,.ts,.js,.py)"},
                },
                required: ["folder_path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_knowledge",
            description: "Bilgi tabanında semantik arama yap. 'Proje notlarımda X hakkında ne var?' gibi.",
            parameters: {
                type: "object",
                properties: {
                    query: {type: "string", description: "Arama sorgusu"},
                    top_k: {type: "number", description: "Döndürülecek sonuç sayısı (varsayılan 5)"},
                },
                required: ["query"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "chat_with_file",
            description: "Bir dosyayla sohbet et — dosya içeriğini bağlam olarak yükle. 'Bu PDF ne diyor?', 'Şu dosyayı özetle' gibi.",
            parameters: {
                type: "object",
                properties: {
                    file_path: {type: "string", description: "Okunacak dosya yolu"},
                },
                required: ["file_path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_indexed_files",
            description: "Bilgi tabanındaki indekslenmiş dosyaları listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "remove_from_index",
            description: "Bir dosyayı bilgi tabanından kaldır.",
            parameters: {
                type: "object",
                properties: {
                    file_path: {type: "string", description: "Kaldırılacak dosya yolu"},
                },
                required: ["file_path"],
                additionalProperties: false,
            },
        },
    },
];

const automationSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "if_then",
            description: "Koşullu otomasyon kur. 'Saat 23 olunca ekranı karat', 'CPU 90 geçince müziği durdur' gibi. Desteklenen metrikler: cpu, ram, gpu, disk, hour, minute.",
            parameters: {
                type: "object",
                properties: {
                    condition: {type: "string", description: "Koşul ifadesi: 'cpu > 80', 'hour == 23', 'ram >= 75'"},
                    action:    {type: "string", description: "Tetiklenince AEGIS'e gönderilecek komut"},
                },
                required: ["condition", "action"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_automations",
            description: "Tanımlı otomasyon kurallarını listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "remove_automation",
            description: "Bir otomasyon kuralını sil.",
            parameters: {
                type: "object",
                properties: {
                    id_or_condition: {type: "string", description: "Otomasyon ID veya koşul ifadesi (kısmi eşleşme)"},
                },
                required: ["id_or_condition"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "toggle_automation",
            description: "Bir otomasyon kuralını etkinleştir/devre dışı bırak.",
            parameters: {
                type: "object",
                properties: {
                    id_or_condition: {type: "string", description: "Otomasyon ID veya koşul ifadesi"},
                },
                required: ["id_or_condition"],
                additionalProperties: false,
            },
        },
    },
];

const macroSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "start_macro",
            description: "Makro kaydını başlat. Bundan sonra verilen komutlar makroya eklenir. 'Sabah rutinini kaydet', 'Oyun başlatma makrosu oluştur' gibi.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Makro adı"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "stop_macro",
            description: "Aktif makro kaydını durdur ve kaydet.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "run_macro",
            description: "Kaydedilmiş bir makroyu çalıştır. 'Sabah rutinini çalıştır', 'Oyun makrosunu başlat' gibi.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Makro adı (kısmi eşleşme yeterli)"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_macros",
            description: "Kayıtlı makroları listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "delete_macro",
            description: "Bir makroyu sil.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Silinecek makro adı veya ID"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
];

const agentSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "agent_run",
            description: "Ajan modunu başlat: bir hedef ver, AEGIS araçları zincirleme kullanarak onu tamamlar. 'Şu klasördeki tüm .txt dosyalarını özetle', 'Sistemi optimize et' gibi karmaşık görevler için.",
            parameters: {
                type: "object",
                properties: {
                    goal:      {type: "string", description: "Tamamlanacak hedef (açık ve net olsun)"},
                    max_steps: {type: "number", description: "Maksimum adım sayısı (varsayılan 10, max 20)"},
                },
                required: ["goal"],
                additionalProperties: false,
            },
        },
    },
];

const watchSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "watch_condition",
            description: "Bir sistem metriğini izle ve eşik aşılınca bildirim ver. 'GPU %90 geçerse uyar', 'RAM %80 üstüne çıkarsa bildir' gibi.",
            parameters: {
                type: "object",
                properties: {
                    metric:    {type: "string", description: "İzlenecek metrik: cpu, ram, gpu, disk"},
                    threshold: {type: "number", description: "Eşik değeri (yüzde, 1-100)"},
                    direction: {type: "string", description: "'above' (üstüne çıkarsa) veya 'below' (altına düşerse)"},
                },
                required: ["metric", "threshold"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_watch_conditions",
            description: "Aktif eşik izlemelerini listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "remove_watch_condition",
            description: "Bir eşik izlemesini kaldır.",
            parameters: {
                type: "object",
                properties: {
                    metric: {type: "string", description: "Kaldırılacak metrik: cpu, ram, gpu, disk"},
                },
                required: ["metric"],
                additionalProperties: false,
            },
        },
    },
];

// ───────────────────────────────────────────────────────────── Faz 19 Schemas
const soundSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"play_sound",description:"Bir ses dosyasını çal (.mp3/.wav). ~/.aegis/sounds/ klasöründeki dosyalar veya tam yol.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Ses dosyasının yolu (örn: notification.wav, ~/sounds/ding.mp3)"},volume:{type:"number",description:"Ses seviyesi 0-100 (varsayılan 50)"}},required:["file_path"],additionalProperties:false}}},
    {type:"function",function:{name:"ambient_start",description:"Arka plan ambient sesi başlat. Odaklanma, dinlenme veya çalışma müziği için.",parameters:{type:"object",properties:{category:{type:"string",description:"Ambient kategorisi: rain, forest, cafe, white, space, lofi"},volume:{type:"number",description:"Ses seviyesi 0-100 (varsayılan 30)"}},required:["category"],additionalProperties:false}}},
    {type:"function",function:{name:"ambient_stop",description:"Çalan ambient sesi durdur.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"list_sounds",description:"Mevcut ses dosyalarını ve ambient kategorilerini listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 20 Schemas
const codeToolSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"git_status",description:"Git repo durumunu göster: staged, unstaged, untracked dosyalar.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu (varsayılan: mevcut dizin)"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_log",description:"Son commit'leri listele. Graph/tree görünümü destekler.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},count:{type:"number",description:"Gösterilecek commit sayısı (varsayılan 10)"},graph:{type:"boolean",description:"true = ASCII branch grafiği göster"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_diff",description:"Staged veya unstaged değişiklikleri göster. Belirli dosya verilebilir.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},staged:{type:"boolean",description:"true = staged değişiklikler, false = unstaged (varsayılan false)"},file:{type:"string",description:"Sadece bu dosyanın diff'ini göster (opsiyonel)"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_add",description:"Dosyaları stage'e ekle (git add). '.' = tüm değişiklikler.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},files:{type:"string",description:"Stage'e eklenecek dosya/desen. '.' = hepsi, veya spesifik dosya/klasör adı"}},required:["files"],additionalProperties:false}}},
    {type:"function",function:{name:"git_commit",description:"Staged değişiklikleri commit et. add_all=true ile önce tüm değişiklikleri stage'e alır.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},message:{type:"string",description:"Commit mesajı"},add_all:{type:"boolean",description:"true = önce git add . çalıştır, sonra commit et"}},required:["message"],additionalProperties:false}}},
    {type:"function",function:{name:"git_push",description:"Değişiklikleri remote'a gönder (git push).",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},remote:{type:"string",description:"Remote adı (varsayılan: origin)"},branch:{type:"string",description:"Branch adı (varsayılan: aktif branch)"},force:{type:"boolean",description:"true = --force-with-lease ile zorla it"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_pull",description:"Remote'dan değişiklikleri çek (git pull).",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},remote:{type:"string",description:"Remote adı (varsayılan: origin)"},rebase:{type:"boolean",description:"true = --rebase ile çek"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_branch",description:"Branch oluştur, değiştir, sil veya listele. Görsel branch haritası için action=graph.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},action:{type:"string",description:"list, create, switch, delete, graph (görsel ağaç)"},branch_name:{type:"string",description:"Branch adı (create/switch/delete için)"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"git_stash",description:"Değişiklikleri geçici olarak sakla veya geri yükle.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},action:{type:"string",description:"save, pop, list, drop, apply"},message:{type:"string",description:"Stash mesajı (save için opsiyonel)"},index:{type:"number",description:"Stash indeksi (drop/apply için, varsayılan 0)"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"git_merge",description:"Branch merge et. fast-forward veya no-ff destekler.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},branch:{type:"string",description:"Merge edilecek branch"},no_ff:{type:"boolean",description:"true = --no-ff (merge commit oluştur)"}},required:["branch"],additionalProperties:false}}},
    {type:"function",function:{name:"git_reset",description:"Staged dosyaları unstage et veya son commit'i geri al.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},mode:{type:"string",description:"soft (commit geri al, dosyalar staged kalır), mixed (varsayılan, staged temizle), hard (dikkat! tüm değişiklikleri sil)"},commits:{type:"number",description:"Kaç commit geri git (varsayılan 1)"},file:{type:"string",description:"Belirli dosyayı unstage et (mode yerine kullanılır)"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_remote",description:"Remote URL'leri listele veya ekle/değiştir.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},action:{type:"string",description:"list, add, set-url"},name:{type:"string",description:"Remote adı"},url:{type:"string",description:"Remote URL"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"run_and_analyze",description:"Bir komutu çalıştır ve çıktısını analiz et. Hata mesajlarını açıkla, çözüm öner.",parameters:{type:"object",properties:{command:{type:"string",description:"Çalıştırılacak komut"},context:{type:"string",description:"Ek bağlam (örn: bu bir Node.js projesi)"}},required:["command"],additionalProperties:false}}},
    {type:"function",function:{name:"scaffold_project",description:"Hazır şablondan yeni proje oluştur. Örnek: 'Python FastAPI', 'React Tailwind', 'Node Express'.",parameters:{type:"object",properties:{template:{type:"string",description:"Şablon adı: python-fastapi, react-tailwind, node-express, electron-app, next-ts"},target_path:{type:"string",description:"Projenin oluşturulacağı dizin (varsayılan: Desktop)"}},required:["template"],additionalProperties:false}}},
    {type:"function",function:{name:"list_templates",description:"Mevcut proje şablonlarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 21 Schemas
const timeSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"pomodoro_start",description:"Pomodoro zamanlayıcısını başlat. 25 dakika çalışma / 5 dakika mola döngüsü.",parameters:{type:"object",properties:{work_minutes:{type:"number",description:"Çalışma süresi dakika (varsayılan 25)"},break_minutes:{type:"number",description:"Mola süresi dakika (varsayılan 5)"}},additionalProperties:false}}},
    {type:"function",function:{name:"pomodoro_stop",description:"Çalışan pomodoro zamanlayıcısını durdur.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"time_track_start",description:"Görev bazlı zaman takibini başlat.",parameters:{type:"object",properties:{task_name:{type:"string",description:"Takip edilecek görev adı"}},required:["task_name"],additionalProperties:false}}},
    {type:"function",function:{name:"time_track_stop",description:"Zaman takibini durdur ve süreyi kaydet.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"time_track_report",description:"Günlük/haftalık zaman harcama raporunu göster.",parameters:{type:"object",properties:{period:{type:"string",description:"Dönem: today, week, month (varsayılan: today)"}},additionalProperties:false}}},
    {type:"function",function:{name:"calendar_get_events",description:"Windows Takvim'den etkinlikleri çek. Bugünkü veya belirtilen tarihteki etkinlikler.",parameters:{type:"object",properties:{date:{type:"string",description:"Tarih YYYY-MM-DD formatında (varsayılan: bugün)"},days_ahead:{type:"number",description:"Kaç gün ileri bak (varsayılan 1)"}},additionalProperties:false}}},
    {type:"function",function:{name:"calendar_add_event",description:"Windows Takvim'e etkinlik ekle.",parameters:{type:"object",properties:{title:{type:"string",description:"Etkinlik başlığı"},start_time:{type:"string",description:"Başlangıç zamanı (örn: 2024-01-15 14:00)"},duration_minutes:{type:"number",description:"Süre dakika (varsayılan 60)"},notes:{type:"string",description:"Notlar (opsiyonel)"}},required:["title","start_time"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 22 Schemas
const mediaSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"organize_folder",description:"Klasörü tara ve dosyaları uzantı/tarihe göre alt klasörlere taşı.",parameters:{type:"object",properties:{folder_path:{type:"string",description:"Organize edilecek klasör yolu"},by:{type:"string",description:"Gruplama kriteri: extension (uzantı) veya date (tarih, varsayılan: extension)"}},required:["folder_path"],additionalProperties:false}}},
    {type:"function",function:{name:"find_duplicates",description:"Bir klasördeki yinelenen dosyaları hash karşılaştırmasıyla bul.",parameters:{type:"object",properties:{folder_path:{type:"string",description:"Taranacak klasör"},recursive:{type:"boolean",description:"Alt klasörleri de tara (varsayılan true)"}},required:["folder_path"],additionalProperties:false}}},
    {type:"function",function:{name:"bulk_rename",description:"Bir klasördeki dosyaları toplu yeniden adlandır.",parameters:{type:"object",properties:{folder_path:{type:"string",description:"Klasör yolu"},pattern:{type:"string",description:"Mevcut kalıp (regex veya sabit metin)"},replacement:{type:"string",description:"Yeni ad kalıbı ($1 = yakalama grubu, {n} = sıra numarası)"},extension:{type:"string",description:"Sadece bu uzantıya uygula (opsiyonel, örn: .jpg)"}},required:["folder_path","pattern","replacement"],additionalProperties:false}}},
    {type:"function",function:{name:"analyze_image",description:"Yerel bir görüntü dosyasını vision modelle analiz et.",parameters:{type:"object",properties:{image_path:{type:"string",description:"Görüntü dosyasının yolu"},question:{type:"string",description:"Görüntü hakkında soru (opsiyonel)"}},required:["image_path"],additionalProperties:false}}},
    {type:"function",function:{name:"resize_image",description:"Bir görüntüyü yeniden boyutlandır.",parameters:{type:"object",properties:{image_path:{type:"string",description:"Görüntü yolu"},width:{type:"number",description:"Hedef genişlik (piksel)"},height:{type:"number",description:"Hedef yükseklik (piksel, opsiyonel — orantılı)"},output_path:{type:"string",description:"Çıktı yolu (opsiyonel, varsayılan: kaynak_resized.ext)"}},required:["image_path","width"],additionalProperties:false}}},
    {type:"function",function:{name:"convert_image",description:"Bir görüntü dosyasını farklı formata çevir (PNG/JPEG/BMP/GIF).",parameters:{type:"object",properties:{image_path:{type:"string",description:"Kaynak görüntü yolu"},output_format:{type:"string",description:"Hedef format: png, jpg, bmp, gif"},output_path:{type:"string",description:"Çıktı yolu (opsiyonel)"}},required:["image_path","output_format"],additionalProperties:false}}},
    {type:"function",function:{name:"pdf_to_text",description:"PDF dosyasından metin çıkar.",parameters:{type:"object",properties:{pdf_path:{type:"string",description:"PDF dosyasının yolu"},max_chars:{type:"number",description:"Maksimum karakter sayısı (varsayılan 10000)"}},required:["pdf_path"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 23 Schemas
const personaSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"set_persona",description:"AEGIS'in aktif kişiliğini değiştir. Farklı modlar: resmi asistan, samimi arkadaş, sert koç, öğretmen.",parameters:{type:"object",properties:{name:{type:"string",description:"Persona adı: default, formal, friendly, coach, teacher veya özel persona adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"get_persona",description:"Şu an aktif olan kişiliği göster.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"list_personas",description:"Tüm mevcut kişilikleri listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"add_persona",description:"Yeni özel kişilik ekle.",parameters:{type:"object",properties:{name:{type:"string",description:"Kişilik adı"},description:{type:"string",description:"Kısa açıklama"},system_prompt:{type:"string",description:"Bu kişilik için sistem talimatları"}},required:["name","system_prompt"],additionalProperties:false}}},
    {type:"function",function:{name:"roleplay_start",description:"Belirli bir karakterde rol yapma modunu başlat.",parameters:{type:"object",properties:{character:{type:"string",description:"Karakter açıklaması (örn: 'deneyimli Python öğretmeni', 'startup CEO')"},scenario:{type:"string",description:"Senaryo bağlamı (opsiyonel)"}},required:["character"],additionalProperties:false}}},
    {type:"function",function:{name:"roleplay_stop",description:"Rol yapma modundan çık, normal moda dön.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 24 Schemas
const networkSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"ping_host",description:"Bir host'a ping at, gecikme ve paket kaybını ölç.",parameters:{type:"object",properties:{host:{type:"string",description:"Hedef host (IP veya domain)"},count:{type:"number",description:"Ping sayısı (varsayılan 4)"}},required:["host"],additionalProperties:false}}},
    {type:"function",function:{name:"trace_route",description:"Bir host'a giden ağ yolunu izle.",parameters:{type:"object",properties:{host:{type:"string",description:"Hedef host"},max_hops:{type:"number",description:"Maksimum hop sayısı (varsayılan 30)"}},required:["host"],additionalProperties:false}}},
    {type:"function",function:{name:"port_scan",description:"Bir host'un açık portlarını tara (yerel ağ, eğitim amaçlı).",parameters:{type:"object",properties:{host:{type:"string",description:"Hedef host (IP)"},ports:{type:"string",description:"Port aralığı (örn: 80,443,8080 veya 1-1024, varsayılan: 21,22,25,80,443,3306,8080)"}},required:["host"],additionalProperties:false}}},
    {type:"function",function:{name:"dns_lookup",description:"Bir domain için DNS kayıtlarını sorgula (A, MX, TXT).",parameters:{type:"object",properties:{domain:{type:"string",description:"Sorgulancak domain"},type:{type:"string",description:"Kayıt tipi: A, MX, TXT, NS, CNAME (varsayılan A)"}},required:["domain"],additionalProperties:false}}},
    {type:"function",function:{name:"ssh_run",description:"SSH ile uzak sunucuda komut çalıştır (önceden kaydedilmiş host).",parameters:{type:"object",properties:{host_alias:{type:"string",description:"~/.aegis/ssh-hosts.json'daki host takma adı"},command:{type:"string",description:"Çalıştırılacak komut"}},required:["host_alias","command"],additionalProperties:false}}},
    {type:"function",function:{name:"ssh_add_host",description:"SSH host profili kaydet.",parameters:{type:"object",properties:{alias:{type:"string",description:"Takma ad"},hostname:{type:"string",description:"IP veya hostname"},username:{type:"string",description:"Kullanıcı adı"},port:{type:"number",description:"SSH portu (varsayılan 22)"},key_path:{type:"string",description:"Private key yolu (opsiyonel)"}},required:["alias","hostname","username"],additionalProperties:false}}},
    {type:"function",function:{name:"docker_ps",description:"Çalışan Docker container'larını listele.",parameters:{type:"object",properties:{all:{type:"boolean",description:"Durdurulmuş container'ları da göster (varsayılan false)"}},additionalProperties:false}}},
    {type:"function",function:{name:"docker_start",description:"Bir Docker container'ını başlat.",parameters:{type:"object",properties:{container:{type:"string",description:"Container adı veya ID"}},required:["container"],additionalProperties:false}}},
    {type:"function",function:{name:"docker_stop",description:"Bir Docker container'ını durdur.",parameters:{type:"object",properties:{container:{type:"string",description:"Container adı veya ID"}},required:["container"],additionalProperties:false}}},
    {type:"function",function:{name:"docker_logs",description:"Docker container loglarını al.",parameters:{type:"object",properties:{container:{type:"string",description:"Container adı veya ID"},lines:{type:"number",description:"Son kaç satır (varsayılan 50)"}},required:["container"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 25 Schemas
const vizSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"create_chart",description:"Veriden ASCII grafik oluştur. Sütun, çizgi veya pasta grafik. Feed'de gösterilir.",parameters:{type:"object",properties:{type:{type:"string",description:"Grafik tipi: bar, line, pie"},data:{type:"string",description:"JSON formatında veri: {labels:[...], values:[...]} veya [[label,value],...]"},title:{type:"string",description:"Grafik başlığı (opsiyonel)"}},required:["type","data"],additionalProperties:false}}},
    {type:"function",function:{name:"system_report",description:"Sistem sağlık raporu oluştur: CPU, RAM, disk, GPU son 24 saatin özeti.",parameters:{type:"object",properties:{format:{type:"string",description:"Çıktı formatı: text veya html (varsayılan text)"}},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 26 Schemas
const emailSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"email_send",description:"SMTP ile e-posta gönder. Kimlik bilgileri vault'ta saklanmalı.",parameters:{type:"object",properties:{to:{type:"string",description:"Alıcı e-posta adresi"},subject:{type:"string",description:"Konu"},body:{type:"string",description:"E-posta gövdesi"},from_alias:{type:"string",description:"Vault'taki SMTP profili takma adı (varsayılan: default)"}},required:["to","subject","body"],additionalProperties:false}}},
    {type:"function",function:{name:"email_fetch",description:"IMAP ile gelen kutusunu oku.",parameters:{type:"object",properties:{count:{type:"number",description:"Son kaç e-posta (varsayılan 10)"},folder:{type:"string",description:"Klasör adı (varsayılan: INBOX)"},from_alias:{type:"string",description:"Vault'taki IMAP profili takma adı"}},additionalProperties:false}}},
    {type:"function",function:{name:"email_draft",description:"Doğal dil açıklamasından profesyonel e-posta taslağı oluştur.",parameters:{type:"object",properties:{intent:{type:"string",description:"E-postanın amacı (örn: toplantı teklifi, şikayet, teşekkür)"},recipient:{type:"string",description:"Alıcının rolü/adı"},tone:{type:"string",description:"Ton: formal, friendly, assertive (varsayılan: formal)"},language:{type:"string",description:"Dil: tr, en (varsayılan: tr)"}},required:["intent"],additionalProperties:false}}},
    {type:"function",function:{name:"email_setup_smtp",description:"SMTP/IMAP e-posta profili kaydet (şifreli vault'a).",parameters:{type:"object",properties:{alias:{type:"string",description:"Profil takma adı"},smtp_host:{type:"string",description:"SMTP sunucu"},smtp_port:{type:"number",description:"SMTP portu"},imap_host:{type:"string",description:"IMAP sunucu"},imap_port:{type:"number",description:"IMAP portu"},username:{type:"string",description:"Kullanıcı adı (e-posta)"},password:{type:"string",description:"Şifre (vault'a şifreli kaydedilir)"}},required:["alias","smtp_host","username","password"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 27 Schemas
const learningSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"card_add",description:"Yeni flashcard ekle. Konu + cevap çifti.",parameters:{type:"object",properties:{front:{type:"string",description:"Soru veya konu"},back:{type:"string",description:"Cevap veya açıklama"},tags:{type:"string",description:"Etiketler virgülle ayrılmış (örn: python,programlama)"}},required:["front","back"],additionalProperties:false}}},
    {type:"function",function:{name:"card_review",description:"Spaced repetition ile flashcard çalış. Bugünkü tekrar gereken kartları göster.",parameters:{type:"object",properties:{tag:{type:"string",description:"Belirli etikete göre filtrele (opsiyonel)"},count:{type:"number",description:"Kaç kart çalışılacak (varsayılan 5)"}},additionalProperties:false}}},
    {type:"function",function:{name:"reading_add",description:"Okuma listesine URL veya kitap ekle.",parameters:{type:"object",properties:{url_or_title:{type:"string",description:"Makale URL'i veya kitap adı"},notes:{type:"string",description:"Notlar (opsiyonel)"},priority:{type:"number",description:"Öncelik 1-5 (varsayılan 3)"}},required:["url_or_title"],additionalProperties:false}}},
    {type:"function",function:{name:"reading_list",description:"Okuma listesini göster.",parameters:{type:"object",properties:{status:{type:"string",description:"Filtre: all, pending, done (varsayılan: pending)"}},additionalProperties:false}}},
    {type:"function",function:{name:"reading_summarize",description:"Bir URL'deki makaleyi çekip LLM ile özetle.",parameters:{type:"object",properties:{url:{type:"string",description:"Özetlenecek makale URL'i"},add_to_list:{type:"boolean",description:"Okuma listesine de ekle (varsayılan true)"}},required:["url"],additionalProperties:false}}},
    {type:"function",function:{name:"goal_set",description:"Yeni hedef tanımla.",parameters:{type:"object",properties:{title:{type:"string",description:"Hedef başlığı"},deadline:{type:"string",description:"Son tarih YYYY-MM-DD (opsiyonel)"},steps:{type:"string",description:"Alt adımlar virgülle ayrılmış (opsiyonel)"}},required:["title"],additionalProperties:false}}},
    {type:"function",function:{name:"goal_check_in",description:"Bir hedefin ilerlemesini güncelle.",parameters:{type:"object",properties:{goal_id_or_title:{type:"string",description:"Hedef ID veya başlığı"},progress:{type:"number",description:"Tamamlanma yüzdesi 0-100"},note:{type:"string",description:"İlerleme notu (opsiyonel)"}},required:["goal_id_or_title","progress"],additionalProperties:false}}},
    {type:"function",function:{name:"goal_list",description:"Aktif hedefleri ve tamamlanma yüzdelerini göster.",parameters:{type:"object",properties:{status:{type:"string",description:"Filtre: all, active, done (varsayılan: active)"}},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 28 Schemas
const iotSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"list_bluetooth",description:"Bağlı ve eşleştirilmiş Bluetooth cihazlarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"connect_bluetooth",description:"Bir Bluetooth cihazına bağlan.",parameters:{type:"object",properties:{device_name:{type:"string",description:"Cihaz adı (kısmi eşleşme desteklenir)"}},required:["device_name"],additionalProperties:false}}},
    {type:"function",function:{name:"disconnect_bluetooth",description:"Bağlı Bluetooth cihazının bağlantısını kes.",parameters:{type:"object",properties:{device_name:{type:"string",description:"Cihaz adı"}},required:["device_name"],additionalProperties:false}}},
    {type:"function",function:{name:"list_usb",description:"Bağlı USB cihazlarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"list_printers",description:"Kurulu yazıcıları listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"print_file",description:"Belirtilen dosyayı yazdır.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Yazdırılacak dosya yolu"},printer_name:{type:"string",description:"Yazıcı adı (opsiyonel, varsayılan: varsayılan yazıcı)"}},required:["file_path"],additionalProperties:false}}},
    {type:"function",function:{name:"printer_status",description:"Yazıcı durumunu sorgula (kağıt, mürekkep, kuyruk).",parameters:{type:"object",properties:{printer_name:{type:"string",description:"Yazıcı adı (opsiyonel)"}},additionalProperties:false}}},
    {type:"function",function:{name:"weather_station",description:"Hava durumu: sıcaklık, nem, basınç, rüzgar. Konum belirtilmezse kullanıcının IP konumunu kullanır. API key gerektirmez.",parameters:{type:"object",properties:{location:{type:"string",description:"Şehir adı (örn: Ankara, Istanbul, London). Boş bırakılırsa kullanıcının konumu otomatik algılanır."}},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 29 Schemas
const multiModelSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"model_compare",description:"Aynı soruyu birden fazla modele gönder ve yanıtları karşılaştır.",parameters:{type:"object",properties:{prompt:{type:"string",description:"Karşılaştırılacak soru/görev"},models:{type:"string",description:"Karşılaştırılacak modeller virgülle (örn: groq:qwen3-32b,groq:llama-3.3-70b)"}},required:["prompt"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_run",description:"Adım adım prompt zinciri çalıştır. Her adımın çıktısı sonrakine aktarılır.",parameters:{type:"object",properties:{pipeline_name:{type:"string",description:"Kaydedilmiş pipeline adı"},input:{type:"string",description:"İlk adıma verilecek girdi"}},required:["pipeline_name","input"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_save",description:"Yeni prompt pipeline kaydet.",parameters:{type:"object",properties:{name:{type:"string",description:"Pipeline adı"},steps:{type:"string",description:"JSON array: [{\"prompt\":\"...\",\"model\":\"groq:qwen3-32b\"},{...}]"},description:{type:"string",description:"Pipeline açıklaması"}},required:["name","steps"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_list",description:"Kaydedilmiş pipeline'ları listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"model_route_set",description:"Görev türüne göre model yönlendirme kuralı ekle.",parameters:{type:"object",properties:{task_type:{type:"string",description:"Görev türü (örn: code, vision, fast, creative)"},model:{type:"string",description:"Kullanılacak model (örn: groq:qwen3-32b, openai:gpt-4o)"},description:{type:"string",description:"Kural açıklaması"}},required:["task_type","model"],additionalProperties:false}}},
    {type:"function",function:{name:"model_route_list",description:"Mevcut model yönlendirme kurallarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // ── Faz 35: Sesli Çeviri ─────────────────────────────────────────────────
    {type:"function",function:{name:"translation_start",description:"Gerçek zamanlı sesli çeviri modunu başlat. Kullanıcı konuştukça otomatik çeviri yapılır.",parameters:{type:"object",properties:{source_lang:{type:"string",description:"Kaynak dil kodu (tr, en, de, fr, es, ar, ru, zh...)"},target_lang:{type:"string",description:"Hedef dil kodu"}},required:["source_lang","target_lang"],additionalProperties:false}}},
    {type:"function",function:{name:"translation_stop",description:"Gerçek zamanlı çeviri modunu durdur.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"translate_text",description:"Verilen metni hedef dile çevir.",parameters:{type:"object",properties:{text:{type:"string",description:"Çevrilecek metin"},target_lang:{type:"string",description:"Hedef dil kodu (tr, en, de, fr, es...)"},tone:{type:"string",enum:["formal","casual","technical"],description:"Çeviri tonu"}},required:["text","target_lang"],additionalProperties:false}}},
    {type:"function",function:{name:"translate_file",description:".txt veya .md dosyasını hedef dile çevir.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Çevrilecek dosya yolu"},target_lang:{type:"string",description:"Hedef dil kodu"}},required:["file_path","target_lang"],additionalProperties:false}}},
    {type:"function",function:{name:"subtitle_toggle",description:"Ekran üstü altyazı overlay'ini aç veya kapat.",parameters:{type:"object",properties:{enable:{type:"boolean",description:"true=aç, false=kapat"}},required:["enable"],additionalProperties:false}}},

    // ── Faz 36: Bildirim Monitörü ────────────────────────────────────────────
    {type:"function",function:{name:"notification_recent",description:"Son N Windows bildirimini göster.",parameters:{type:"object",properties:{count:{type:"number",description:"Kaç bildirim (varsayılan 20, max 100)"}},additionalProperties:false}}},
    {type:"function",function:{name:"notification_history",description:"AEGIS'in kaydettiği bildirim geçmişini göster.",parameters:{type:"object",properties:{count:{type:"number",description:"Kaç bildirim gösterilsin"}},additionalProperties:false}}},
    {type:"function",function:{name:"notification_filter_set",description:"Belirli bir uygulamanın bildirimlerini göster veya gizle.",parameters:{type:"object",properties:{app:{type:"string",description:"Uygulama adı (örn: Spotify, WhatsApp, Teams)"},action:{type:"string",enum:["show","hide"],description:"show=göster, hide=gizle"}},required:["app","action"],additionalProperties:false}}},
    {type:"function",function:{name:"notification_filter_list",description:"Kayıtlı bildirim filtre kurallarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"do_not_disturb",description:"Rahatsız etme modunu belirtilen dakika boyunca etkinleştir.",parameters:{type:"object",properties:{minutes:{type:"number",description:"DND süresi (dakika)"},off:{type:"boolean",description:"true ise DND'yi kapat"}},additionalProperties:false}}},

    // ── Faz 37: Kod Derleyici & Test Koşucusu ───────────────────────────────
    {type:"function",function:{name:"project_detect",description:"Klasördeki proje tipini tespit et (Node.js, Rust, Python, Go, Java vb.)",parameters:{type:"object",properties:{dir:{type:"string",description:"Proje klasörü"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"build_project",description:"Projeyi derle/build et. Hataları analiz eder ve öneriler sunar.",parameters:{type:"object",properties:{dir:{type:"string",description:"Proje klasörü"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"run_tests",description:"Proje testlerini koştur. Sonuçları özetler.",parameters:{type:"object",properties:{dir:{type:"string",description:"Proje klasörü"},test_file:{type:"string",description:"Belirli bir test dosyası (opsiyonel)"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"lint_project",description:"Proje lint kontrolü yap.",parameters:{type:"object",properties:{dir:{type:"string",description:"Proje klasörü"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"format_code",description:"Kodu otomatik formatla (prettier, black, rustfmt, gofmt).",parameters:{type:"object",properties:{dir:{type:"string",description:"Proje klasörü"}},required:["dir"],additionalProperties:false}}},

    // ── Faz 38: Haber & Fiyat Takibi ─────────────────────────────────────────
    {type:"function",function:{name:"rss_add",description:"RSS/Atom feed ekle.",parameters:{type:"object",properties:{url:{type:"string",description:"Feed URL"},label:{type:"string",description:"Feed etiketi"}},required:["url"],additionalProperties:false}}},
    {type:"function",function:{name:"rss_remove",description:"Feed kaldır.",parameters:{type:"object",properties:{url:{type:"string",description:"Feed URL veya etiketi"}},required:["url"],additionalProperties:false}}},
    {type:"function",function:{name:"rss_list",description:"Kayıtlı feed'leri listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"rss_fetch",description:"Kayıtlı feed'lerden son haberleri çek ve özetle.",parameters:{type:"object",properties:{count:{type:"number",description:"Toplam haber sayısı (varsayılan 10)"}},additionalProperties:false}}},
    {type:"function",function:{name:"price_get",description:"Hisse senedi veya döviz fiyatı al (Yahoo Finance). Örn: AAPL, GOOG, BIST:THYAO",parameters:{type:"object",properties:{symbols:{type:"string",description:"Virgülle ayrılmış semboller (örn: AAPL,TSLA)"}},required:["symbols"],additionalProperties:false}}},
    {type:"function",function:{name:"crypto_price",description:"Kripto para fiyatı al (CoinGecko). USD ve TRY cinsinden.",parameters:{type:"object",properties:{coins:{type:"string",description:"Virgülle ayrılmış coin adları (örn: bitcoin,ethereum,solana)"}},required:["coins"],additionalProperties:false}}},
    {type:"function",function:{name:"fx_rate",description:"Döviz kuru al (exchangerate-api). Örn: USD/TRY, EUR/USD",parameters:{type:"object",properties:{pairs:{type:"string",description:"Virgülle ayrılmış döviz çiftleri (örn: USD/TRY,EUR/TRY)"}},required:["pairs"],additionalProperties:false}}},
    {type:"function",function:{name:"price_alert_set",description:"Fiyat aleti kur. Belirtilen fiyata ulaşınca bildirim gelir.",parameters:{type:"object",properties:{symbol:{type:"string",description:"Sembol (örn: bitcoin, AAPL, USD/TRY)"},type:{type:"string",enum:["crypto","stock","fx"]},above:{type:"number",description:"Bu fiyatın üstüne çıkarsa uyar"},below:{type:"number",description:"Bu fiyatın altına düşerse uyar"}},required:["symbol","type"],additionalProperties:false}}},

    // ── Faz 39: Sesli Toplantı Asistanı ─────────────────────────────────────
    {type:"function",function:{name:"meeting_start",description:"Toplantı kaydını başlat. Konuşmalar transkript edilir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_stop",description:"Toplantı kaydını durdur ve kaydet.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_list",description:"Kaydedilmiş toplantıları listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_summarize",description:"Toplantıyı özetle: kararlar, eylem maddeleri, katılımcılar.",parameters:{type:"object",properties:{id:{type:"string",description:"Toplantı ID (boş bırakılırsa son toplantı)"}},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_export",description:"Toplantıyı .md dosyası olarak dışa aktar.",parameters:{type:"object",properties:{id:{type:"string",description:"Toplantı ID"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"meeting_action_items",description:"Toplantıdan eylem maddelerini çıkar.",parameters:{type:"object",properties:{id:{type:"string",description:"Toplantı ID"}},required:["id"],additionalProperties:false}}},

    // ── Faz 40: Bağlam-Duyarlı Eylemler ─────────────────────────────────────
    {type:"function",function:{name:"get_active_context",description:"Aktif uygulamayı ve bağlamı tespit et. Önerilen araçları göster.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"context_rule_set",description:"Belirli bir uygulama açıkken özel öneri veya otomatik eylem tanımla.",parameters:{type:"object",properties:{app_pattern:{type:"string",description:"Uygulama adı veya pencere başlığında aranacak desen"},suggestion:{type:"string",description:"Öneri metni"},auto_action:{type:"string",description:"Otomatik çalıştırılacak araç (opsiyonel)"}},required:["app_pattern","suggestion"],additionalProperties:false}}},
    {type:"function",function:{name:"context_rule_list",description:"Bağlam kurallarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"clipboard_watch",description:"Panodaki içeriği analiz et ve öneriler sun.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"clipboard_history",description:"Pano geçmişini göster.",parameters:{type:"object",properties:{count:{type:"number",description:"Kaç giriş gösterilsin (varsayılan 10)"}},additionalProperties:false}}},
    {type:"function",function:{name:"clipboard_search",description:"Pano geçmişinde arama yap.",parameters:{type:"object",properties:{query:{type:"string",description:"Aranacak metin"}},required:["query"],additionalProperties:false}}},

    // ── Faz 41: Güçlü Yerel Arama ──────────────────────────────────────────
    {type:"function",function:{name:"file_search",description:"Dosya sisteminde dosya adına göre ara (Everything veya PowerShell).",parameters:{type:"object",properties:{query:{type:"string",description:"Dosya adı veya deseni"},dir:{type:"string",description:"Aranacak klasör (opsiyonel, varsayılan: ev dizini)"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"content_search",description:"Klasördeki dosyaların içeriğinde metin ara. Satır numarasıyla sonuç döner.",parameters:{type:"object",properties:{query:{type:"string",description:"Aranacak metin veya regex"},dir:{type:"string",description:"Aranacak klasör"},extension:{type:"string",description:"Dosya uzantısı filtresi (örn: ts, py, md)"}},required:["query","dir"],additionalProperties:false}}},
    {type:"function",function:{name:"app_search",description:"Uygulama ara ve gerekirse başlat. Fuzzy arama destekler.",parameters:{type:"object",properties:{query:{type:"string",description:"Uygulama adı (kısmi yazılabilir, örn: 'chr' için Chrome)"},launch:{type:"boolean",description:"true ise en iyi eşleşmeyi başlat"}},required:["query"],additionalProperties:false}}},

    // ── Faz 42: Sistem Optimizasyonu ─────────────────────────────────────────
    {type:"function",function:{name:"kill_heavy_process",description:"En fazla CPU/RAM tüketen prosesleri listele ve isteğe bağlı kapat.",parameters:{type:"object",properties:{top_n:{type:"number",description:"Kaç proses listele (varsayılan 3)"},confirm:{type:"boolean",description:"true ise prosesleri gerçekten kapat"}},additionalProperties:false}}},
    {type:"function",function:{name:"suspend_process",description:"Prosesin önceliğini Idle'a düşür (duraklatmaya benzer, RAM'den atmaz).",parameters:{type:"object",properties:{name:{type:"string",description:"Proses adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"resume_process",description:"Prosesin önceliğini Normal'e döndür.",parameters:{type:"object",properties:{name:{type:"string",description:"Proses adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"clear_temp",description:"Windows temp klasörlerini temizle ve boşaltılan alanı raporla.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"flush_dns",description:"DNS önbelleğini temizle.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"startup_manager",description:"Windows başlangıç uygulamalarını listele veya devre dışı bırak.",parameters:{type:"object",properties:{action:{type:"string",enum:["list","disable"],description:"list=listele, disable=devre dışı bırak"},name:{type:"string",description:"Devre dışı bırakılacak uygulama adı (disable için)"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"perf_mode_start",description:"Performans modunu başlat: güç planı Yüksek Performans, arka plan uygulamaları yavaşlatılır.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"perf_mode_stop",description:"Performans modunu durdur, normal moda geri dön.",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // ── Faz 43: Workspace Sistemi ─────────────────────────────────────────────
    {type:"function",function:{name:"workspace_create",description:"İsimli çalışma alanı oluştur. Kendi system promptu, modeli ve geçmişiyle izole.",parameters:{type:"object",properties:{name:{type:"string",description:"Workspace adı"},description:{type:"string",description:"Workspace açıklaması"},system_prompt:{type:"string",description:"Bu workspace'e özel system prompt"},model:{type:"string",description:"Varsayılan model (örn: groq:qwen3-32b)"},working_dir:{type:"string",description:"Bu workspace'in çalışma dizini"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_switch",description:"Farklı bir workspace'e geç.",parameters:{type:"object",properties:{name:{type:"string",description:"Geçilecek workspace adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_list",description:"Mevcut workspace'leri listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"workspace_delete",description:"Workspace'i sil.",parameters:{type:"object",properties:{name:{type:"string",description:"Silinecek workspace adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_export",description:"Workspace'i JSON dosyası olarak dışa aktar.",parameters:{type:"object",properties:{name:{type:"string",description:"Workspace adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_import",description:"JSON dosyasından workspace içe aktar.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Export JSON dosyası yolu"}},required:["file_path"],additionalProperties:false}}},

    // ── Faz 44: Rapor & Analitik ──────────────────────────────────────────────
    {type:"function",function:{name:"daily_report",description:"Bugünkü aktivite raporunu oluştur: araç kullanımı, zaman takibi, hedef ilerlemesi.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"weekly_report",description:"Son 7 günün haftalık aktivite raporunu oluştur.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"productivity_insights",description:"Kişisel verimlilik analizi: güçlü yönler, gelişim alanları ve öneriler.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ── Faz 46: Spotify ──────────────────────────────────────────────────────────
const spotifySchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"spotify_authorize",description:"Spotify hesabını AEGIS'e bağla (ilk kullanımda bir kez yapılır). Tarayıcıda Spotify login sayfası açılır.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_play",description:"Spotify'da müziği başlat / devam ettir. Spotify kapalıysa açar.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_pause",description:"Spotify'da çalan müziği duraklat.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_next",description:"Spotify'da sonraki parçaya geç.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_prev",description:"Spotify'da önceki parçaya dön.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_volume",description:"Spotify ses seviyesini ayarla (0-100). level sayı olmalı, örnek: 20",parameters:{type:"object",properties:{level:{type:["number","string"],description:"Ses seviyesi 0-100"}},required:["level"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_now_playing",description:"Spotify'da şu an ne çaldığını göster (şarkı, sanatçı, albüm, süre).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_open",description:"Spotify uygulamasını aç.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_search",description:"Spotify'da şarkı/sanatçı/albüm ara ve çal.",parameters:{type:"object",properties:{query:{type:"string",description:"Arama terimi (şarkı adı, sanatçı, albüm)"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_playlists",description:"Kullanıcının Spotify playlistlerini listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_play_playlist",description:"Belirtilen Spotify playlistini çal (ad veya ID ile).",parameters:{type:"object",properties:{name:{type:"string",description:"Playlist adı (kısmi eşleşir) veya Spotify playlist ID"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_like",description:"Şu an çalan şarkıyı beğen (Liked Songs'a ekle).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_queue",description:"Şarkıyı sıraya ekle.",parameters:{type:"object",properties:{query:{type:"string",description:"Sıraya eklenecek şarkı adı veya sanatçı"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_devices",description:"Mevcut Spotify cihazlarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_transfer",description:"Müziği başka bir cihaza aktar (telefon, TV, bilgisayar).",parameters:{type:"object",properties:{device:{type:"string",description:"Cihaz adı veya ID"}},required:["device"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_shuffle",description:"Karıştır modunu aç/kapat.",parameters:{type:"object",properties:{enabled:{type:"boolean",description:"true = aç, false = kapat"}},required:["enabled"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_repeat",description:"Tekrar modunu ayarla.",parameters:{type:"object",properties:{mode:{type:"string",enum:["off","track","context"],description:"off=kapalı, track=şarkı tekrar, context=liste tekrar"}},required:["mode"],additionalProperties:false}}},
];

// ── Faz 46: Steam ────────────────────────────────────────────────────────────
const steamSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"steam_launch",description:"Steam oyunu başlat. Kullanıcı bir Steam oyunu açmak istediğinde DAIMA bu tool'u kullan, run_command KULLANMA. Oyun adı veya AppID ver. Steam kapalıysa açar.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı (ör: 'Cyberpunk 2077', 'Dead by Daylight', 'dbd') veya Steam AppID (ör: '1091500')"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_list",description:"Bilgisayarda yüklü Steam oyunlarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_open",description:"Steam uygulamasını aç ve öne getir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_close",description:"Steam'i kapat.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_running",description:"Şu an Steam üzerinden çalışan oyun var mı, varsa hangisi?",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ── Faz 47: Computer Use ─────────────────────────────────────────────────
const computerUseSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"mouse_move",description:"Fare imlecini ekranda (x,y) koordinatına taşı.",parameters:{type:"object",properties:{x:{type:"number"},y:{type:"number"}},required:["x","y"],additionalProperties:false}}},
    {type:"function",function:{name:"mouse_click",description:"Fare tıklaması yap. Tıklamadan önce otomatik o konuma gider. button: left/right/middle. double: çift tıklama.",parameters:{type:"object",properties:{x:{type:"number"},y:{type:"number"},button:{type:"string",enum:["left","right","middle"]},double:{type:"boolean"}},required:["x","y"],additionalProperties:false}}},
    {type:"function",function:{name:"mouse_scroll",description:"Fare tekerleği ile kaydır. direction: up/down. amount: kaç adım (varsayılan 3).",parameters:{type:"object",properties:{x:{type:"number"},y:{type:"number"},direction:{type:"string",enum:["up","down"]},amount:{type:"number"}},required:["x","y"],additionalProperties:false}}},
    {type:"function",function:{name:"mouse_drag",description:"Bir noktadan diğerine sürükle bırak.",parameters:{type:"object",properties:{x1:{type:"number"},y1:{type:"number"},x2:{type:"number"},y2:{type:"number"}},required:["x1","y1","x2","y2"],additionalProperties:false}}},
    {type:"function",function:{name:"key_press",description:"Klavye tuşuna veya kısayoluna bas. Örnekler: 'ctrl+c', 'alt+tab', 'win+d', 'enter', 'esc', 'f5'.",parameters:{type:"object",properties:{keys:{type:"string",description:"Tuş kombinasyonu, '+' ile ayır (ör: 'ctrl+shift+t')"}},required:["keys"],additionalProperties:false}}},
    {type:"function",function:{name:"type_text",description:"Aktif alana metin yaz (klavyeden yazılıyormuş gibi).",parameters:{type:"object",properties:{text:{type:"string",description:"Yazılacak metin"}},required:["text"],additionalProperties:false}}},
    {type:"function",function:{name:"computer_use",description:"Ekran görüntüsü alıp AI ile analiz ederek hedefi gerçekleştir. Mouse+klavye ile bilgisayarı kullanır. 'Spotify'da şu şarkıyı çal', 'Chrome'da şu siteyi aç', 'Şu dosyayı bul ve sil' gibi serbest komutlar.",parameters:{type:"object",properties:{goal:{type:"string",description:"Ne yapmak istediğin (serbest dil, ör: 'Chrome aç ve youtube.com git')"},max_steps:{type:"number",description:"Maksimum adım sayısı (varsayılan 10)"}},required:["goal"],additionalProperties:false}}},
    {type:"function",function:{name:"screen_size",description:"Ekran çözünürlüğünü öğren (mouse_click koordinatları için gerekebilir).",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

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

// Çekirdek tool'lar — yalnızca bir AKSİYON niyeti olduğunda gönderilir
// (komut çalıştır, dosya, web arama, ekran). Düşük-TPM modelleri (gpt-oss-120b
// gibi 8K) korumak için olabildiğince küçük tutulur.
// Spotify her zaman core'da — tool call zincirinde context kayması yaşanmasın.
const CORE_SCHEMAS = () => [...toolSchemas, ...extraSchemas, ...spotifySchemas];

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
];

// Türkçe karakterleri ASCII'ye indir — kullanıcı "dönüştür" veya "donustur"
// yazsa da aynı eşleşsin. Eşleştirme hep normalize edilmiş metin üzerinde yapılır.
function normalizeTr(s: string): string {
    return s.toLowerCase()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
        .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
        .replace(/î/g, "i").replace(/â/g, "a");
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
    {schemas: () => memoryPlusSchemas,  roots: ["hatirla", "hafiza", "profil", "not", "tani", "tercih", "memory", "remember"]},
    {schemas: () => schedulerSchemas,   roots: ["hatirlat", "zamanla", "schedule", "reminder", "alarm"]},
    {schemas: () => marketplaceSchemas, roots: ["plugin", "eklenti", "marketplace"]},
    {schemas: () => securitySchemas,    roots: ["sifre", "parola", "vault", "kasa", "guvenli", "encrypt", "secret", "gizli"]},
    {schemas: () => knowledgeSchemas,   roots: ["bilgi", "knowledge", "rag", "belge", "dokuman", "index"]},
    {schemas: () => automationSchemas,  roots: ["otomasyon", "automation", "tetikle", "trigger", "workflow"]},
    {schemas: () => macroSchemas,       roots: ["makro", "macro", "record"]},
    {schemas: () => agentSchemas,       roots: ["ajan", "agent", "otonom"]},
    {schemas: () => watchSchemas,       roots: ["izle", "watch", "uyar", "alert", "esik", "threshold", "takip"]},
    {schemas: () => soundSchemas,       roots: ["bip", "beep", "calar"]},
    {schemas: () => codeToolSchemas,    roots: ["kod", "code", "git", "npm", "derle", "compile", "lint", "repo", "commit", "fonksiyon", "push", "pull", "branch", "merge", "stash", "diff", "staged", "unstaged", "remote", "checkout"]},
    {schemas: () => timeSchemas,        roots: ["saat", "tarih", "zaman", "time", "takvim", "calendar", "timezone", "hafta"]},
    {schemas: () => mediaSchemas,       roots: ["resim", "resm", "gorsel", "image", "video", "medya", "media", "foto", "donustur", "convert", "kirp"]},
    {schemas: () => personaSchemas,     roots: ["kisilik", "persona", "karakter"]},
    {schemas: () => networkSchemas,     roots: ["ping", "ssh", "docker", "sunucu", "server", "network", "port"]},
    {schemas: () => vizSchemas,         roots: ["grafik", "chart", "gorsellestir", "rapor", "report", "tablo", "istatistik", "graph"]},
    {schemas: () => emailSchemas,       roots: ["eposta", "email", "mail", "smtp", "imap", "taslak", "inbox"]},
    {schemas: () => learningSchemas,    roots: ["flashcard", "kart", "okuma", "hedef", "goal"]},
    {schemas: () => iotSchemas,         roots: ["bluetooth", "usb", "yazici", "cihaz", "device", "iot", "printer"]},
    {schemas: () => multiModelSchemas,  roots: ["pipeline", "karsilastir", "compare"]},
    {schemas: () => spotifySchemas,     roots: ["spotify", "muzik", "muzigi", "sarki", "cal", "calar", "ses", "sarkilar", "album", "sanatci", "playlist", "next", "skip", "pause", "resume", "begeni", "like", "siray", "queue", "karistir", "shuffle", "tekrar", "repeat", "cihaz", "device", "transfer", "bagla", "yetki"]},
    {schemas: () => steamSchemas,       roots: ["steam", "oyun", "oyunu", "oyuna", "game", "launch", "dbd", "cs2", "csgo", "dota", "pubg", "valorant", "minecraft", "gta", "roblox", "fortnite"]},
    {schemas: () => computerUseSchemas, roots: ["tikla", "mouse", "fare", "klavye", "tus", "ekran", "screenshot", "yaz", "drag", "scroll", "click", "type", "screen", "computer_use"]},
];

// context = son kullanıcı mesajı (düz metin). Verilirse bağlama göre tool seçilir.
export function getAllToolSchemas(provider?: string, context?: string): ChatCompletionTool[] {
    const limit = PROVIDER_TOOL_LIMITS[provider ?? "groq"] ?? 64;

    let selected: ChatCompletionTool[];
    if (context !== undefined) {
        const words = tokenize(context);
        const matchedGroups = TOOL_GROUPS.filter((g) => matchesRoots(words, g.roots));
        // Sohbet/selam/saçma metin (aksiyon sinyali yok, grup eşleşmesi yok) → HİÇ tool yok.
        if (!hasActionSignal(words) && matchedGroups.length === 0) {
            selected = [];
        } else {
            selected = [...CORE_SCHEMAS()];
            for (const group of matchedGroups) selected.push(...group.schemas());
        }
    } else {
        // Bağlam yok (ör. ajan modu) → eski davranış: hepsi.
        selected = [
            ...toolSchemas, ...schedulerSchemas, ...marketplaceSchemas, ...securitySchemas,
            ...memoryPlusSchemas, ...knowledgeSchemas, ...automationSchemas, ...macroSchemas,
            ...agentSchemas, ...watchSchemas,
            ...soundSchemas, ...codeToolSchemas, ...timeSchemas, ...mediaSchemas,
            ...personaSchemas, ...networkSchemas, ...vizSchemas, ...emailSchemas,
            ...learningSchemas, ...iotSchemas, ...multiModelSchemas,
            ...spotifySchemas, ...steamSchemas, ...computerUseSchemas,
            ...extraSchemas,
        ];
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
        const heightParam = h > 0 ? h : Math.round(w * 0.75);
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
    async system_report({format}) {
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
        const recip = recipient ? `${recipient}'a` : "alıcıya";
        return `E-posta taslağı hazırlanıyor (${lang === "tr" ? "Türkçe" : "İngilizce"}, ${toneDesc} ton):\n\n---\nKonu: [Konuyu buraya yaz]\n\nSayın ${recipient ?? "[Alıcı]"},\n\n${intent}\n\nSaygılarımla,\n[İmza]\n---\n\nNot: SMTP ile göndermek için önce 'email_setup_smtp' ile profil kur.`;
    },
    async email_setup_smtp({alias, smtp_host, smtp_port, imap_host, imap_port, username, password}) {
        const profilesPath = path.join(os.homedir(), ".aegis", "email-profiles.json");
        const profiles = fs.existsSync(profilesPath) ? JSON.parse(fs.readFileSync(profilesPath, "utf-8")) : {};
        profiles[alias ?? "default"] = {
            smtp: {host: smtp_host, port: smtp_port ?? 587},
            imap: imap_host ? {host: imap_host, port: imap_port ?? 993} : null,
            username,
            password_hint: "[vault'ta şifreli]",
        };
        // Save password to vault key
        fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
        return `E-posta profili kaydedildi: ${alias}. Şifre vault'a ekleniyor (vault_store ile 'email_${alias}_pass' key kullan).`;
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
                const geo = await (await fetch(
                    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.trim())}&count=1&language=tr&format=json`
                )).json() as {results?: {latitude: number; longitude: number; name: string; country: string}[]};
                if (!geo.results?.length) return `"${location}" konumu bulunamadı.`;
                const r = geo.results[0];
                lat = r.latitude; lon = r.longitude; city = r.name; country = r.country;
            } else {
                const geo = await (await fetch("http://ip-api.com/json/?fields=city,country,lat,lon")).json() as {city: string; country: string; lat: number; lon: number};
                lat = geo.lat; lon = geo.lon; city = geo.city; country = geo.country;
            }
            const w = await (await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure`
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
    async spotify_play() { return spotifyPlay(); },
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

    // ── Faz 46: Steam ────────────────────────────────────────────────────────
    async steam_launch({game}: {game?: unknown}) { return steamLaunchGame(String(game ?? "")); },
    async steam_list() { return steamListGames(); },
    async steam_open() { return steamOpen(); },
    async steam_close() { return steamClose(); },
    async steam_game_running() { return steamGameRunning(); },

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
};

export async function executeTool(name: string, argsJson: string): Promise<ToolResult> {
    if (_disabledTools.has(name)) return `ENGELLENDI: "${name}" aracı ayarlardan devre dışı bırakılmış.`;
    const fn = executors[name] ?? _pluginExecutors[name];
    if (!fn) return `HATA: bilinmeyen araç "${name}"`;
    let args: Record<string, string> = {};
    try {
        args = argsJson ? JSON.parse(argsJson) : {};
    } catch {
        return `HATA: araç argümanları çözümlenemedi: ${argsJson}`;
    }
    try {
        return await fn(args);
    } catch (e) {
        return `HATA: ${(e as Error).message}`;
    }
}
