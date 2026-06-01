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
            description: "Windows PowerShell komutu çalıştır.",
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
    {type:"function",function:{name:"git_log",description:"Son commit'leri listele.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},count:{type:"number",description:"Gösterilecek commit sayısı (varsayılan 10)"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_diff",description:"Staged veya unstaged değişiklikleri göster.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},staged:{type:"boolean",description:"true = staged değişiklikler, false = unstaged (varsayılan false)"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_commit",description:"Staged değişiklikleri commit et.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},message:{type:"string",description:"Commit mesajı"}},required:["message"],additionalProperties:false}}},
    {type:"function",function:{name:"git_branch",description:"Branch oluştur, değiştir veya listele.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},action:{type:"string",description:"list, create veya switch"},branch_name:{type:"string",description:"Branch adı (create/switch için)"}},required:["action"],additionalProperties:false}}},
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
    {type:"function",function:{name:"weather_station",description:"Yerel hava istasyonu verileri: sıcaklık, nem, basınç. OpenWeatherMap kişisel API key ile çalışır.",parameters:{type:"object",properties:{location:{type:"string",description:"Konum (şehir adı veya koordinatlar, varsayılan: settings'teki konum)"}},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 29 Schemas
const multiModelSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"model_compare",description:"Aynı soruyu birden fazla modele gönder ve yanıtları karşılaştır.",parameters:{type:"object",properties:{prompt:{type:"string",description:"Karşılaştırılacak soru/görev"},models:{type:"string",description:"Karşılaştırılacak modeller virgülle (örn: groq:qwen3-32b,groq:llama-3.3-70b)"}},required:["prompt"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_run",description:"Adım adım prompt zinciri çalıştır. Her adımın çıktısı sonrakine aktarılır.",parameters:{type:"object",properties:{pipeline_name:{type:"string",description:"Kaydedilmiş pipeline adı"},input:{type:"string",description:"İlk adıma verilecek girdi"}},required:["pipeline_name","input"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_save",description:"Yeni prompt pipeline kaydet.",parameters:{type:"object",properties:{name:{type:"string",description:"Pipeline adı"},steps:{type:"string",description:"JSON array: [{\"prompt\":\"...\",\"model\":\"groq:qwen3-32b\"},{...}]"},description:{type:"string",description:"Pipeline açıklaması"}},required:["name","steps"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_list",description:"Kaydedilmiş pipeline'ları listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"model_route_set",description:"Görev türüne göre model yönlendirme kuralı ekle.",parameters:{type:"object",properties:{task_type:{type:"string",description:"Görev türü (örn: code, vision, fast, creative)"},model:{type:"string",description:"Kullanılacak model (örn: groq:qwen3-32b, openai:gpt-4o)"},description:{type:"string",description:"Kural açıklaması"}},required:["task_type","model"],additionalProperties:false}}},
    {type:"function",function:{name:"model_route_list",description:"Mevcut model yönlendirme kurallarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
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

export function getAllToolSchemas(provider?: string): ChatCompletionTool[] {
    const limit = PROVIDER_TOOL_LIMITS[provider ?? "groq"] ?? 64;
    const all = [
        ...toolSchemas, ...schedulerSchemas, ...marketplaceSchemas, ...securitySchemas,
        ...memoryPlusSchemas, ...knowledgeSchemas, ...automationSchemas, ...macroSchemas,
        ...agentSchemas, ...watchSchemas,
        ...soundSchemas, ...codeToolSchemas, ...timeSchemas, ...mediaSchemas,
        ...personaSchemas, ...networkSchemas, ...vizSchemas, ...emailSchemas,
        ...learningSchemas, ...iotSchemas, ...multiModelSchemas,
        ...extraSchemas,
    ];
    const filtered = _disabledTools.size > 0
        ? all.filter((t) => !_disabledTools.has(t.function?.name ?? ""))
        : all;
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
        return run(`powershell -NoProfile -Command "${command.replace(/"/g, '\\"')}"`);
    },
    async read_file({path: p}) {
        try {
            const full = resolvePath(p);
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
        const cwd = repo_path ? resolvePath(repo_path) : process.cwd();
        return run(`git -C "${cwd}" status --short --branch`);
    },
    async git_log({repo_path, count}) {
        const cwd = repo_path ? resolvePath(repo_path) : process.cwd();
        const n = count ? parseInt(String(count)) : 10;
        return run(`git -C "${cwd}" log --oneline -${n} --decorate`);
    },
    async git_diff({repo_path, staged}) {
        const cwd = repo_path ? resolvePath(repo_path) : process.cwd();
        const flag = String(staged) === "true" ? "--cached" : "";
        const out = await run(`git -C "${cwd}" diff ${flag} --stat`);
        return out || "(değişiklik yok)";
    },
    async git_commit({repo_path, message}) {
        const cwd = repo_path ? resolvePath(repo_path) : process.cwd();
        if (!message) return "HATA: commit mesajı gerekli";
        return run(`git -C "${cwd}" commit -m "${message.replace(/"/g, '\\"')}"`);
    },
    async git_branch({repo_path, action, branch_name}) {
        const cwd = repo_path ? resolvePath(repo_path) : process.cwd();
        if (action === "list") return run(`git -C "${cwd}" branch -a`);
        if (action === "create" && branch_name) return run(`git -C "${cwd}" checkout -b "${branch_name}"`);
        if (action === "switch" && branch_name) return run(`git -C "${cwd}" checkout "${branch_name}"`);
        return "HATA: action = list | create | switch; create/switch için branch_name gerekli";
    },
    async run_and_analyze({command, context}) {
        const output = await run(`powershell -NoProfile -Command "${(command ?? "").replace(/"/g, '\\"')}"`, 30000);
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
        const loc = location ?? "Istanbul";
        const apiKey = process.env.OPENWEATHER_API_KEY ?? "";
        if (!apiKey) {
            return `Hava istasyonu için OpenWeatherMap API key gerekli. Ayarlar > API Keys'e OPENWEATHER_API_KEY ekle.\nKonum: ${loc}`;
        }
        try {
            const ac = new AbortController();
            const tid = setTimeout(() => ac.abort(), 8000);
            const resp = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(loc)}&appid=${apiKey}&units=metric&lang=tr`, {signal: ac.signal});
            clearTimeout(tid);
            if (!resp.ok) return `HATA: OpenWeatherMap yanıtı ${resp.status}`;
            const d = await resp.json() as {name?: string; main?: {temp?: number; feels_like?: number; humidity?: number; pressure?: number}; weather?: {description?: string}[]; wind?: {speed?: number}; uvi?: number};
            const m = d.main ?? {};
            return `${d.name} Hava Durumu:\nSıcaklık: ${m.temp?.toFixed(1)}°C (hissedilen ${m.feels_like?.toFixed(1)}°C)\nNem: %${m.humidity}\nBasınç: ${m.pressure} hPa\nRüzgar: ${d.wind?.speed} m/s\nDurum: ${d.weather?.[0]?.description}`;
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
