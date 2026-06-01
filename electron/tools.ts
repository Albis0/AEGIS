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

export function getAllToolSchemas(): ChatCompletionTool[] { return [...toolSchemas, ...schedulerSchemas, ...knowledgeSchemas, ...automationSchemas, ...macroSchemas, ...agentSchemas, ...watchSchemas, ...extraSchemas]; }

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
        const danger = isDangerous(command);
        if (danger) {
            return `ENGELLENDI: ${danger}`;
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
            fs.mkdirSync(path.dirname(full), {recursive: true});
            fs.writeFileSync(full, content, "utf-8");
            return `Yazıldı: ${full} (${content.length} karakter)`;
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
};

export async function executeTool(name: string, argsJson: string): Promise<ToolResult> {
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
