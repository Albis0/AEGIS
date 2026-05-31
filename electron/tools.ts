import {exec as execCb} from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type {ChatCompletionTool} from "groq-sdk/resources/chat/completions";
import {setUserProfile, getUserProfile, saveNote, getPendingNotes, markNoteDone} from "./db";

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
};

export async function executeTool(name: string, argsJson: string): Promise<ToolResult> {
    const fn = executors[name];
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
