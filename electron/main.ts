import {app, shell, BrowserWindow, ipcMain, desktopCapturer, screen, Notification as ElectronNotification, Tray, Menu, nativeImage} from "electron";
import * as zlib from "zlib";
import * as path from "path";
import * as os from "os";
import {exec} from "child_process";
import * as dotenv from "dotenv";
// @ts-ignore
import Groq from "groq-sdk";
import type {ChatCompletionMessageParam} from "groq-sdk/resources/chat/completions";
import {executeTool, registerQuitCallback, registerSetLanguageCallback, registerScreenshotCallback, registerAnalyzeScreenCallback, registerRemindCallback, registerNotificationCallback, registerPluginExecutors, extraSchemas, getAllToolSchemas, setPluginList, registerReloadPluginsCallback, checkWatchConditions, _watchConditions, registerAgentCallback, registerMacroRunCallback, setFullPcAccess, setDisabledTools} from "./tools";
import {registerLLMCallback} from "./model-router";
import {getAccessToken, signUp, signIn, signOut, getCurrentUser, getUsage} from "./auth";
import {AEGIS_PROXY_URL} from "./aegis-config";
import {fetchModels} from "./models";
import {getModelCapabilities, clampMaxTokens, resolveTemperature, estimateTokens, type ModelCaps} from "./model-capabilities";
import {pushToCloud, pullFromCloud} from "./cloud-sync";
import {addMacroStep, isRecording} from "./macros";
import {getFactsForContext, recordToolUsage, shouldShowMorningSummary, markMorningSummaryShown, buildMorningSummaryPrompt} from "./memory-plus";
import {initVault} from "./vault";
import {startScheduler, stopScheduler, registerSchedulerCallback} from "./scheduler";
import {checkAutomations} from "./automations";
import {startApiServer, stopApiServer, registerAskHandler, registerTtsHandler, getApiInfo, broadcastFeedEvent, setApiServerWindow} from "./api-server";
import {loadPlugins} from "./plugins";
import {getSessions, getSessionMessages} from "./db";
// @ts-ignore
import {MsEdgeTTS, OUTPUT_FORMAT} from "msedge-tts";
import {startSession, saveMessage, getUserProfile, saveSessionSummary, getRecentSummaries, getPendingNotes} from "./db";
import {loadSettings, saveSettings, type AppSettings} from "./settings";
import {loadConfig, saveConfig, applyConfig, type AegisConfig} from "./config";
import {spotifyAuthorizeCmd, spotifyGetState, spotifyPlay, spotifyPause, spotifyNext, spotifyPrev, spotifySetVolume} from "./spotify";
import {autoUpdater} from "electron-updater";
import {fetchWithTimeout, isTimeoutError, TIMEOUT_MSG} from "./fetch-utils";

// .env (dev ortamı) — varsa yükle, production'da config.json kullanılır
dotenv.config({path: path.join(__dirname, "../.env")});

// config.json varsa env'yi override et
const savedConfig = loadConfig();
if (savedConfig) applyConfig(savedConfig);

let groq = new Groq({apiKey: process.env.GROQ_API_KEY ?? ""});
let currentSettings = loadSettings();
let MODEL = currentSettings.model;
setFullPcAccess(currentSettings.fullPcAccess ?? false);
setDisabledTools(currentSettings.disabledTools ?? []);

// Cloud sync debounce — ardışık ayar değişikliklerini tek push'ta topla (3sn).
let _cloudPushTimer: NodeJS.Timeout | null = null;
function scheduleCloudPush(): void {
    if (_cloudPushTimer) clearTimeout(_cloudPushTimer);
    _cloudPushTimer = setTimeout(() => {
        pushToCloud().catch((e) => console.error("[cloud-push]", e.message)); // giriş yoksa/sync kapalıysa no-op
    }, 3000);
}

const SYSTEM_PROMPTS: Record<string, string> = {
    tr: `Sen AEGIS, kişisel AI asistanısın. Türkçe konuş, kısa ve net ol. Windows 11'de çalışıyorsun. Araçları gerektiğinde kullan, önce yap sonra özetle.

ARAÇ KURALLARI (KESİNLİKLE UYULMALI):
- Steam oyunu veya Steam uygulaması açmak için DAIMA steam_launch aracını kullan. run_command ile Start-Process ASLA YAZMA.
- "Steam aç", "steam ac", "cs aç", "dota aç" gibi her steam isteğinde steam_launch kullan.
- Spotify kontrolü için spotify_play/pause/next/prev/search araçlarını kullan.
- Genel uygulama açmak için run_command ile Start-Process kullan (Steam ve Spotify hariç).
- Araç çağırırken yanıta kod bloğu veya komut metni YAZMA, sadece aracı çağır.

FORMAT KURALLARI:
- Düz metin yaz. Markdown kullanma: **, *, #, backtick, --- gibi sembolleri kullanma.
- Emoji kullanma.
- Kısa tut, 1-3 cümle yeterli.

GÜVENLİK KURALLARI (SADECE BUNLAR):
- Format-Volume, Clear-Disk, Initialize-Disk gibi disk yıkım komutlarını çalıştırma.
- shutdown /s, shutdown /r, Restart-Computer, Stop-Computer gibi sistemi kapatma/yeniden başlatma komutlarını çalıştırma.
- Remove-Item -Recurse ile tüm disk/sürücü silme işlemi yapma.
- Yukarıdaki listede OLMAYAN her şeyi (Stop-Process, taskkill, uygulama kapatma, dosya silme vb.) kullanıcı isterse DOĞRUDAN yap, onay isteme.`,

    en: `You are AEGIS, a personal AI assistant. Speak English, be short and precise. Running on Windows 11. Use tools when needed — act first, summarize after.

TOOL RULES (STRICTLY ENFORCED):
- To launch Steam or any Steam game, ALWAYS use the steam_launch tool. NEVER use run_command with Start-Process for Steam.
- "open steam", "launch steam", "open cs", "open dota" — all of these use steam_launch, nothing else.
- For Spotify, use spotify_play/pause/next/prev/search tools.
- For other apps, use run_command with Start-Process (except Steam and Spotify).
- When calling a tool, do NOT write code blocks or command text in the reply.

FORMAT RULES:
- Write plain text. No markdown: no **, *, #, backticks, or ---.
- No emoji.
- Keep it short, 1-3 sentences is enough.

SECURITY RULES (ONLY THESE):
- Do not run disk-destruction commands: Format-Volume, Clear-Disk, Initialize-Disk.
- Do not run shutdown/restart commands: shutdown /s, shutdown /r, Restart-Computer, Stop-Computer.
- Do not use Remove-Item -Recurse on entire drives.
- Everything NOT on the list above — do it directly if the user asks, no confirmation needed.`,

    de: `Du bist AEGIS, ein persönlicher KI-Assistent. Sprich Deutsch, sei kurz und präzise. Läuft unter Windows 11. Verwende PowerShell-Syntax. Start-Process zum Öffnen, Stop-Process zum Schließen von Apps. Verwende Tools wenn nötig — handele zuerst, dann fasse zusammen.

FORMAT-REGELN:
- Schreibe reinen Text. Kein Markdown: kein **, *, #, Backticks oder ---.
- Keine Emojis.
- Kurz halten, 1-3 Sätze reichen.

SICHERHEITSREGELN (NUR DIESE):
- Keine Befehle: Format-Volume, Clear-Disk, Initialize-Disk.
- Kein Herunterfahren/Neustart: shutdown /s, shutdown /r, Restart-Computer, Stop-Computer.
- Kein Remove-Item -Recurse auf ganzen Laufwerken.
- Alles, was nicht auf der Liste steht — direkt ausführen.`,

    fr: `Tu es AEGIS, un assistant IA personnel. Parle français, sois bref et précis. Fonctionne sous Windows 11. Utilise la syntaxe PowerShell. Start-Process pour ouvrir, Stop-Process pour fermer. Utilise les outils si nécessaire — agis d'abord, résume ensuite.

RÈGLES DE FORMAT:
- Texte simple uniquement. Pas de markdown: **, *, #, backticks, ---.
- Pas d'emojis.
- Court, 1-3 phrases suffisent.

RÈGLES DE SÉCURITÉ (UNIQUEMENT CES COMMANDES):
- Ne pas exécuter: Format-Volume, Clear-Disk, Initialize-Disk.
- Ne pas exécuter: shutdown /s, shutdown /r, Restart-Computer, Stop-Computer.
- Ne pas utiliser Remove-Item -Recurse sur des lecteurs entiers.
- Tout le reste — exécute-le directement si l'utilisateur le demande.`,

    es: `Eres AEGIS, un asistente IA personal. Habla español, sé breve y preciso. Funciona en Windows 11. Usa sintaxis PowerShell. Start-Process para abrir apps, Stop-Process para cerrarlas. Usa herramientas cuando sea necesario — actúa primero, resume después.

REGLAS DE FORMATO:
- Solo texto plano. Sin markdown: **, *, #, backticks, ---.
- Sin emojis.
- Breve, 1-3 frases son suficientes.

REGLAS DE SEGURIDAD (SOLO ESTAS):
- No ejecutar: Format-Volume, Clear-Disk, Initialize-Disk.
- No ejecutar: shutdown /s, shutdown /r, Restart-Computer, Stop-Computer.
- No usar Remove-Item -Recurse en unidades enteras.
- Todo lo demás — ejecútalo directamente si el usuario lo pide.`,
};

const _winBuild = parseInt((os.release().split(".")[2]) ?? "0");
const _winLabel = _winBuild >= 22000 ? "Windows 11" : "Windows 10";

function getSystemPrompt(lang: string, fullPcAccess = false): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const datetimeNote = `\n\nŞu anki tarih ve saat (yerel): ${dateStr} ${timeStr}`;
    const base = (SYSTEM_PROMPTS[lang] ?? SYSTEM_PROMPTS.tr).replace(/Windows 11/g, _winLabel) + datetimeNote;
    if (!fullPcAccess) return base;
    const note: Record<string, string> = {
        tr: "\n\nTAM PC ERİŞİMİ AKTİF: Kullanıcı tam sistem yetkisi verdi. Shutdown, format, delete_file, move_file dahil her komutu onay istemeden çalıştır.",
        en: "\n\nFULL PC ACCESS ACTIVE: User granted full system access. Execute all commands including shutdown, format, delete_file, move_file without confirmation.",
        de: "\n\nVOLLER PC-ZUGRIFF AKTIV: Nutzer hat vollen Systemzugriff gewährt. Alle Befehle ohne Bestätigung ausführen.",
        fr: "\n\nACCÈS PC COMPLET ACTIF: L'utilisateur a accordé un accès complet. Exécutez toutes les commandes sans confirmation.",
        es: "\n\nACCESO PC COMPLETO ACTIVO: El usuario otorgó acceso completo. Ejecuta todos los comandos sin confirmación.",
    };
    return base + (note[lang] ?? note.tr);
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ---- System tray icon (16x16 cyan circle, no external files) ----
function buildTrayIconBuffer(): Buffer {
    const W = 16, H = 16;
    const rows: Buffer[] = [];
    for (let y = 0; y < H; y++) {
        const row = Buffer.alloc(1 + W * 3);
        row[0] = 0; // PNG filter None
        for (let x = 0; x < W; x++) {
            const cx = x - 7.5, cy = y - 7.5;
            const inside = (cx * cx + cy * cy) < 44;
            row[1 + x * 3]     = inside ? 34  : 4;
            row[1 + x * 3 + 1] = inside ? 211 : 7;
            row[1 + x * 3 + 2] = inside ? 238 : 13;
        }
        rows.push(row);
    }
    const raw = Buffer.concat(rows);
    const compressed = zlib.deflateSync(raw);
    const table = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c >>> 0;
        }
        return t;
    })();
    function crc32(b: Buffer): number {
        let c = 0xFFFFFFFF;
        for (const byte of b) c = table[(c ^ byte) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }
    function chunk(type: string, data: Buffer): Buffer {
        const tp = Buffer.from(type, "ascii");
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const crcBuf = Buffer.concat([tp, data]);
        const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcBuf));
        return Buffer.concat([len, tp, data, crcVal]);
    }
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
    ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
    return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

function createTray(): void {
    if (tray) return;
    const icon = nativeImage.createFromBuffer(buildTrayIconBuffer());
    tray = new Tray(icon);
    tray.setToolTip("AEGIS");
    const menu = Menu.buildFromTemplate([
        {
            label: "Göster",
            click: () => {
                if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
            },
        },
        {
            label: "Mikrofon Aç",
            click: () => {
                if (mainWindow) {
                    mainWindow.show(); mainWindow.focus();
                    mainWindow.webContents.send("tray-mic-toggle");
                }
            },
        },
        {type: "separator"},
        {
            label: "Çıkış",
            click: () => { isQuitting = true; app.quit(); },
        },
    ]);
    tray.setContextMenu(menu);
    tray.on("double-click", () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
}

// Conversation memory
let sessionHistory: {role: string; content: string}[] = [];
let memorySummaries = ""; // injected into system prompt at session start

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 760,
        minWidth: 800,
        minHeight: 550,
        show: true,
        resizable: true,
        autoHideMenuBar: true,
        frame: false,
        titleBarStyle: "hidden",
        backgroundColor: "#04070d",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Grant microphone permission automatically
    mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
        if (permission === "media") callback(true);
        else callback(false);
    });

    mainWindow.webContents.setWindowOpenHandler(({url}) => {
        shell.openExternal(url);
        return {action: "deny"};
    });

    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
        mainWindow.loadURL("http://127.0.0.1:5173");
        // mainWindow.webContents.openDevTools({mode: "detach", activate: false});
    } else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }
}

// ---- System telemetry ----
let lastCpuTimes = os.cpus().map((c) => ({...c.times}));
let lastCoreSnapshot = os.cpus().map((c) => ({...c.times}));

function cpuUsageAll(): {total: number; cores: number[]} {
    const now = os.cpus();
    let idleTotal = 0, totalTotal = 0;
    const cores: number[] = [];
    for (let i = 0; i < now.length; i++) {
        const a = lastCpuTimes[i] ?? now[i].times;
        const b = now[i].times;
        const idle = b.idle - a.idle;
        const total = (b.user - a.user) + (b.nice - a.nice) + (b.sys - a.sys) + (b.irq - a.irq) + idle;
        idleTotal += idle;
        totalTotal += total;
        cores.push(total === 0 ? 0 : Math.min(100, Math.max(0, Math.round((1 - idle / total) * 100))));
    }
    lastCpuTimes = now.map((c) => ({...c.times}));
    const total = totalTotal === 0 ? 0 : Math.min(100, Math.max(0, Math.round((1 - idleTotal / totalTotal) * 100)));
    return {total, cores};
}

// Per-core snapshot for the slow interval (shown in expand panel)
let coreUsages: number[] = [];
function refreshCoreUsages(): void {
    const now = os.cpus();
    const cores: number[] = [];
    for (let i = 0; i < now.length; i++) {
        const a = lastCoreSnapshot[i] ?? now[i].times;
        const b = now[i].times;
        const idle = b.idle - a.idle;
        const total = (b.user - a.user) + (b.nice - a.nice) + (b.sys - a.sys) + (b.irq - a.irq) + idle;
        cores.push(total === 0 ? 0 : Math.min(100, Math.max(0, Math.round((1 - idle / total) * 100))));
    }
    lastCoreSnapshot = now.map((c) => ({...c.times}));
    coreUsages = cores;
}

// CPU model adı — başlangıçta bir kez
let cpuModel = os.cpus()[0]?.model?.trim() ?? "CPU";
// Truncate after @ (freq info) for display
const atIdx = cpuModel.indexOf(" @");
if (atIdx > 0) cpuModel = cpuModel.slice(0, atIdx).trim();

// Disk — tüm sürücüler
type DiskInfo = {drive: string; usedPct: number; usedGB: number; totalGB: number};
let disks: DiskInfo[] = [];
function refreshDisks(): void {
    exec(
        `powershell -NoProfile -Command "` +
        `Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue | ` +
        `Where-Object {$_.Used -ne $null -and ($_.Used+$_.Free) -gt 0} | ` +
        `Select-Object Name,Used,Free | ConvertTo-Json -Compress` +
        `"`,
        {windowsHide: true, timeout: 10000},
        (_e, stdout) => {
            try {
                const raw = JSON.parse((stdout ?? "").trim());
                const arr = Array.isArray(raw) ? raw : [raw];
                disks = arr.map((d: {Name?: string; Used?: number; Free?: number}) => {
                    const used = d.Used ?? 0;
                    const free = d.Free ?? 0;
                    const total = used + free;
                    return {
                        drive: (d.Name ?? "?") + ":",
                        usedPct: total > 0 ? Math.round((used / total) * 100) : 0,
                        usedGB: Math.round(used / 1073741824 * 10) / 10,
                        totalGB: Math.round(total / 1073741824 * 10) / 10,
                    };
                });
            } catch {}
        },
    );
}

// Backward-compat: primary disk % (C: or first)
function primaryDiskPct(): number {
    const c = disks.find((d) => d.drive === "C:") ?? disks[0];
    return c?.usedPct ?? 0;
}

let battery: number | null = null;
let batteryCharging: boolean | null = null;
function refreshBattery(): void {
    exec(
        `powershell -NoProfile -Command "` +
        `$b=Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1; ` +
        `if($b){''+$b.EstimatedChargeRemaining+'|'+$b.BatteryStatus} else {'null'}` +
        `"`,
        {windowsHide: true, timeout: 8000},
        (_e, stdout) => {
            const s = (stdout ?? "").trim();
            if (s === "null") { battery = null; batteryCharging = null; return; }
            const parts = s.split("|");
            const n = parseInt(parts[0], 10);
            battery = isNaN(n) ? null : n;
            // BatteryStatus: 2=Charging, 6=Charging, 1=Discharging
            const st = parseInt(parts[1] ?? "", 10);
            batteryCharging = !isNaN(st) ? (st === 2 || st === 6) : null;
        },
    );
}

// Network — adapter adı + up/down
type NetInfo = {name: string; up: number; down: number};
let netAdapters: NetInfo[] = [];
let netUp = 0;
let netDown = 0;
function refreshNetwork(): void {
    exec(
        `powershell -NoProfile -Command "` +
        `Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue | ` +
        `Where-Object {$_.BytesSentPersec -gt 0 -or $_.BytesReceivedPersec -gt 0 -or $_.Name -match 'Ethernet|Wi-Fi|Wireless|LAN'} | ` +
        `Select-Object Name,BytesSentPersec,BytesReceivedPersec | ConvertTo-Json -Compress` +
        `"`,
        {windowsHide: true, timeout: 8000},
        (_e, stdout) => {
            try {
                const raw = JSON.parse((stdout ?? "").trim());
                const arr = (Array.isArray(raw) ? raw : [raw]) as {Name?: string; BytesSentPersec?: number; BytesReceivedPersec?: number}[];
                netAdapters = arr.map((a) => ({
                    name: (a.Name ?? "").slice(0, 32),
                    up: a.BytesSentPersec ?? 0,
                    down: a.BytesReceivedPersec ?? 0,
                }));
                netUp = netAdapters.reduce((s, a) => s + a.up, 0);
                netDown = netAdapters.reduce((s, a) => s + a.down, 0);
            } catch {
                // fallback: sum only
                exec(
                    `powershell -NoProfile -Command "$s=Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue | Measure-Object -Property BytesSentPersec,BytesReceivedPersec -Sum; ''+($s | Where-Object{$_.Property -eq 'BytesSentPersec'}).Sum+'|'+($s | Where-Object{$_.Property -eq 'BytesReceivedPersec'}).Sum"`,
                    {windowsHide: true, timeout: 8000},
                    (_e2, stdout2) => {
                        const [up, down] = (stdout2 ?? "").trim().split("|").map((x) => parseInt(x, 10));
                        if (!isNaN(up)) netUp = up;
                        if (!isNaN(down)) netDown = down;
                    },
                );
            }
        },
    );
}

// GPU
type GpuInfo = {name: string; load: number; vramUsed: number; vramTotal: number; temp: number | null};
let gpuInfo: GpuInfo[] = [];

function initGpuStatic(): void {
    exec(
        `powershell -NoProfile -Command "Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress"`,
        {windowsHide: true, timeout: 8000},
        (_e, stdout) => {
            try {
                const raw = JSON.parse((stdout ?? "").trim());
                const arr = Array.isArray(raw) ? raw : [raw];
                gpuInfo = arr.map((g: {Name?: string; AdapterRAM?: number}) => ({
                    name: (g.Name ?? "GPU").slice(0, 40),
                    load: 0,
                    vramUsed: 0,
                    vramTotal: Math.round((g.AdapterRAM ?? 0) / 1024 / 1024),
                    temp: null,
                }));
            } catch {}
        },
    );
}

function refreshGpu(): void {
    exec(
        `powershell -NoProfile -Command "` +
        `$c=(Get-Counter '\\GPU Engine(*)\\Utilization Percentage' -ErrorAction SilentlyContinue).CounterSamples | ` +
        `Where-Object {$_.InstanceName -match 'engtype_3D'} | ` +
        `Measure-Object -Property CookedValue -Sum; ` +
        `$m=(Get-Counter '\\GPU Process Memory(*)\\Dedicated Usage' -ErrorAction SilentlyContinue).CounterSamples | ` +
        `Measure-Object -Property CookedValue -Sum; ` +
        `$t=nvidia-smi --query-gpu=temperature.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>$null; ` +
        `[math]::Round($c.Sum),'|',([math]::Round($m.Sum/1MB)),'|',$t -join ''` +
        `"`,
        {windowsHide: true, timeout: 8000},
        (_e, stdout) => {
            if (!stdout) return;
            const raw = stdout.trim();
            const pipeIdx = raw.indexOf("|");
            const pipeIdx2 = raw.indexOf("|", pipeIdx + 1);
            if (pipeIdx < 0) return;
            const load3d = parseInt(raw.slice(0, pipeIdx).trim(), 10);
            const vramUsedMB = parseInt(raw.slice(pipeIdx + 1, pipeIdx2).trim(), 10);
            const smiParts = raw.slice(pipeIdx2 + 1).trim().split(",").map((s: string) => parseInt(s.trim(), 10));
            const temp = isNaN(smiParts[0]) ? null : smiParts[0];
            const vramTotal = isNaN(smiParts[2]) ? (gpuInfo[0]?.vramTotal ?? 0) : smiParts[2];
            if (!gpuInfo[0]) gpuInfo[0] = {name: "GPU 0", load: 0, vramUsed: 0, vramTotal: 0, temp: null};
            gpuInfo[0].load = isNaN(load3d) ? 0 : Math.min(100, load3d);
            gpuInfo[0].vramUsed = isNaN(smiParts[1]) ? (isNaN(vramUsedMB) ? 0 : vramUsedMB) : smiParts[1];
            gpuInfo[0].vramTotal = vramTotal;
            gpuInfo[0].temp = temp;
        },
    );
}

// CPU sıcaklığı + frekans
let cpuTemp: number | null = null;
let cpuFreqMHz: number | null = null;
function refreshCpuTemp(): void {
    exec(
        `powershell -NoProfile -Command "` +
        `$t=Get-CimInstance -Namespace root/WMI -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty CurrentTemperature; ` +
        `$f=(Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty CurrentClockSpeed); ` +
        `''+$t+'|'+$f` +
        `"`,
        {windowsHide: true, timeout: 8000},
        (_e, stdout) => {
            const parts = (stdout ?? "").trim().split("|");
            const rawT = parseInt(parts[0] ?? "", 10);
            if (!isNaN(rawT) && rawT > 0) cpuTemp = Math.round(rawT / 10 - 273.15);
            const rawF = parseInt(parts[1] ?? "", 10);
            if (!isNaN(rawF) && rawF > 0) cpuFreqMHz = rawF;
        },
    );
}

// Fan hızları (rpm) — sadece MSAcpi_FanSpeed destekleniyorsa gelir
let fanSpeeds: number[] = [];
function refreshFans(): void {
    exec(
        `powershell -NoProfile -Command "Get-CimInstance -Namespace root/WMI -ClassName MSAcpi_FanSpeed -ErrorAction SilentlyContinue | Select-Object -ExpandProperty CurrentReading"`,
        {windowsHide: true, timeout: 5000},
        (_e, stdout) => {
            const vals = (stdout ?? "").trim().split(/\r?\n/).map((l) => parseInt(l.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
            if (vals.length > 0) fanSpeeds = vals;
        },
    );
}

// Top 8 process — CPU% anlık + RAM MB + PID
type ProcInfo = {name: string; cpu: number; ram: number; pid: number};
let topProcs: ProcInfo[] = [];
function refreshTopProcs(): void {
    exec(
        `powershell -NoProfile -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 8 Name,Id,@{N='CPU';E={[math]::Round($_.CPU,1)}},@{N='RAM';E={[math]::Round($_.WorkingSet64/1MB,0)}} | ConvertTo-Json -Compress"`,
        {windowsHide: true, timeout: 10000},
        (_e, stdout) => {
            try {
                const raw = JSON.parse((stdout ?? "").trim());
                const arr = Array.isArray(raw) ? raw : [raw];
                topProcs = arr.map((p: {Name?: string; Id?: number; CPU?: number; RAM?: number}) => ({
                    name: (p.Name ?? "?").slice(0, 24),
                    pid: p.Id ?? 0,
                    cpu: p.CPU ?? 0,
                    ram: p.RAM ?? 0,
                }));
            } catch {}
        },
    );
}

// Aktif pencere
let activeWindow = "";
function refreshActiveWindow(): void {
    exec(
        `powershell -NoProfile -Command "Get-Process | Where-Object {$_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne ''} | Sort-Object -Property StartTime -Descending | Select-Object -First 1 -ExpandProperty MainWindowTitle"`,
        {windowsHide: true, timeout: 5000},
        (_e, stdout) => {
            const t = (stdout ?? "").trim();
            if (t) activeWindow = t.slice(0, 60);
        },
    );
}

// Sistem bilgisi — model, BIOS, board (başlangıçta bir kez)
let sysModel = "";
let sysBoard = "";
function initSysInfo(): void {
    exec(
        `powershell -NoProfile -Command "` +
        `$cs=Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue; ` +
        `$bb=Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue; ` +
        `''+$cs.Manufacturer.Trim()+' '+$cs.Model.Trim()+'|'+$bb.Manufacturer.Trim()+' '+$bb.Product.Trim()` +
        `"`,
        {windowsHide: true, timeout: 10000},
        (_e, stdout) => {
            const parts = (stdout ?? "").trim().split("|");
            sysModel = (parts[0] ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
            sysBoard = (parts[1] ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
        },
    );
}

const telIntervals: NodeJS.Timeout[] = [];

function startTelemetry(): void {
    initSysInfo();
    refreshDisks();
    refreshBattery();
    refreshNetwork();
    initGpuStatic();
    refreshGpu();
    refreshCpuTemp();
    refreshTopProcs();
    refreshActiveWindow();
    refreshCoreUsages();
    refreshFans();

    telIntervals.push(setInterval(refreshDisks, 20000));
    telIntervals.push(setInterval(refreshBattery, 30000));
    telIntervals.push(setInterval(refreshNetwork, 3000));
    telIntervals.push(setInterval(refreshGpu, 6000));
    telIntervals.push(setInterval(refreshCpuTemp, 8000));
    telIntervals.push(setInterval(refreshTopProcs, 8000));
    telIntervals.push(setInterval(refreshActiveWindow, 4000));
    telIntervals.push(setInterval(refreshCoreUsages, 3000));
    telIntervals.push(setInterval(refreshFans, 15000));

    telIntervals.push(setInterval(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const {total: cpuTotal, cores} = cpuUsageAll();
        mainWindow.webContents.send("telemetry", {
            // CPU
            cpu: cpuTotal,
            cpuCores: coreUsages.length > 0 ? coreUsages : cores,
            cpuModel,
            cpuTemp,
            cpuFreqMHz,
            cpuCoreCount: os.cpus().length,
            // RAM
            ram: Math.round((usedMem / totalMem) * 100),
            ramUsedMB: Math.round(usedMem / 1048576),
            ramTotalMB: Math.round(totalMem / 1048576),
            ramFreeMB: Math.round(freeMem / 1048576),
            // Disk
            disk: primaryDiskPct(),
            disks,
            // Battery
            battery,
            batteryCharging,
            // Network
            netUp,
            netDown,
            netAdapters,
            // GPU
            gpu: gpuInfo,
            // Fans
            fanSpeeds,
            // Processes
            topProcs,
            // System
            uptime: Math.round(os.uptime()),
            host: os.hostname(),
            platform: `${os.type()} ${os.release()}`,
            sysModel,
            sysBoard,
            activeWindow,
        });

        // Eşik uyarıları + koşullu otomasyon — her 1.5sn kontrol
        const ramPct = Math.round((usedMem / totalMem) * 100);
        const gpuLoad = gpuInfo[0]?.load ?? 0;
        const now = new Date();
        const liveMetrics = {
            cpu: cpuTotal, ram: ramPct, gpu: gpuLoad, disk: primaryDiskPct(),
            hour: now.getHours(), minute: now.getMinutes(),
        };

        if (_watchConditions.size > 0) {
            checkWatchConditions(
                liveMetrics,
                (msg) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send("reminder-fired", {message: msg});
                    }
                    if (ElectronNotification.isSupported()) {
                        new ElectronNotification({title: "AEGIS · Eşik Uyarısı", body: msg}).show();
                    }
                },
            );
        }

        checkAutomations(liveMetrics, (action) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("chat-stream-inject", {command: action});
            }
        });
    }, 1500));
}

// ---- Weather ----
const WEATHER_CODES: Record<number, string> = {
    0: "açık", 1: "az bulutlu", 2: "parçalı bulutlu", 3: "bulutlu",
    45: "sisli", 48: "sisli",
    51: "çiseliyor", 53: "çiseliyor", 55: "çiseliyor",
    61: "yağmurlu", 63: "yağmurlu", 65: "kuvvetli yağmur",
    71: "karlı", 73: "karlı", 75: "yoğun kar",
    80: "sağanak", 81: "sağanak", 82: "kuvvetli sağanak",
    95: "gök gürültülü",
};

async function getWeather(): Promise<object> {
    try {
        let lat: number, lon: number, city: string, country: string;

        const manualCity = (currentSettings.weatherCity ?? "").trim();
        if (manualCity) {
            // Geocoding via Open-Meteo (no API key needed)
            const geo = (await (await fetchWithTimeout(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(manualCity)}&count=1&language=tr&format=json`,
                {}, 8_000
            )).json()) as {results?: {latitude: number; longitude: number; name: string; country: string}[]};
            if (!geo.results?.length) return {error: `"${manualCity}" bulunamadı`};
            const r = geo.results[0];
            lat = r.latitude; lon = r.longitude;
            city = r.name; country = r.country;
        } else {
            // IP geolocation fallback
            const geo = (await (await fetchWithTimeout("http://ip-api.com/json/?fields=city,country,lat,lon", {}, 8_000)).json()) as {city: string; country: string; lat: number; lon: number};
            lat = geo.lat; lon = geo.lon;
            city = geo.city; country = geo.country;
        }

        const w = (await (
            await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code`, {}, 8_000)
        ).json()) as {current: {temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number}};
        const c = w.current;
        return {
            city,
            country,
            temp: Math.round(c.temperature_2m),
            feels: Math.round(c.apparent_temperature),
            humidity: c.relative_humidity_2m,
            desc: WEATHER_CODES[c.weather_code] ?? "—",
        };
    } catch (e) {
        return {error: (e as Error).message ?? String(e)};
    }
}

// ---- Multi-provider AI client ----
type MsgPart = {type: "text"; text: string} | {type: "image_url"; image_url: {url: string}; name?: string} | {type: "file"; data: string; name: string; mime: string};
type OAIMessage = {role: string; content: string | MsgPart[] | null; tool_calls?: unknown[]; tool_call_id?: string};
type OAICompletion = {choices: [{message: {content: string | null; tool_calls?: {id: string; type: "function"; function: {name: string; arguments: string}}[]}}]};

function getProviderKey(provider: string): string {
    if (provider === "groq") return process.env.GROQ_API_KEY ?? "";
    return currentSettings.providerKeys?.[provider] ?? currentSettings.aiApiKey ?? "";
}

// Find tool name by call ID (needed for Gemini function response format)
function findToolName(messages: OAIMessage[], callId: string): string {
    for (const m of messages) {
        for (const tc of (m.tool_calls ?? []) as {id: string; function: {name: string}}[]) {
            if (tc.id === callId) return tc.function?.name ?? "result";
        }
    }
    return "result";
}

// Not: Modele özel kısıtlar (reasoning, tool/temperature/vision/system desteği,
// max_tokens & context tavanları) artık ./model-capabilities içinde merkezi.

function extractTextContent(content: string | MsgPart[] | null): string {
    if (!content) return "";
    if (typeof content === "string") return content;
    return content.filter((p): p is {type:"text";text:string} => p.type === "text").map((p) => p.text).join("\n");
}

function toAnthropicContent(content: string | MsgPart[] | null): unknown[] {
    if (!content) return [{type: "text", text: ""}];
    if (typeof content === "string") return [{type: "text", text: content}];
    return content.map((p) => {
        if (p.type === "text") return {type: "text", text: p.text};
        if (p.type === "image_url") {
            const url = p.image_url.url;
            if (url.startsWith("data:")) {
                const [header, data] = url.split(",");
                const mime = header.split(":")[1]?.split(";")[0] ?? "image/png";
                return {type: "image", source: {type: "base64", media_type: mime, data}};
            }
            return {type: "image", source: {type: "url", url}};
        }
        if (p.type === "file") return {type: "text", text: `[Dosya: ${p.name}]\n${Buffer.from(p.data, "base64").toString("utf-8")}`};
        return {type: "text", text: ""};
    });
}

function toGeminiParts(content: string | MsgPart[] | null): object[] {
    if (!content) return [{text: ""}];
    if (typeof content === "string") return [{text: content}];
    return content.map((p) => {
        if (p.type === "text") return {text: p.text};
        if (p.type === "image_url") {
            const url = p.image_url.url;
            if (url.startsWith("data:")) {
                const [header, data] = url.split(",");
                const mime = header.split(":")[1]?.split(";")[0] ?? "image/png";
                return {inline_data: {mime_type: mime, data}};
            }
            return {text: url};
        }
        if (p.type === "file") return {text: `[Dosya: ${p.name}]\n${Buffer.from(p.data, "base64").toString("utf-8")}`};
        return {text: ""};
    });
}

// HTTP provider hatasını kullanıcı dostu, kısa bir mesaja çevirir.
// Ham JSON gövdesini chat'e basmak yerine duruma göre anlamlı açıklama döndürür.
async function friendlyHttpError(providerLabel: string, resp: Response): Promise<string> {
    let bodyText = "";
    try { bodyText = await resp.text(); } catch { /* ignore */ }
    let detail = "";
    try {
        const j = JSON.parse(bodyText);
        detail = j?.error?.message ?? j?.message ?? j?.error?.code ?? "";
    } catch {
        detail = bodyText.slice(0, 160);
    }
    const s = resp.status;
    if (s === 401 || s === 403) return `${providerLabel}: API anahtarın geçersiz veya yetkisiz (${s}). Ayarlar → Model'den anahtarı kontrol et.`;
    if (s === 404) return `${providerLabel}: Model bulunamadı (404). Seçili model bu sağlayıcıda mevcut değil — Ayarlar → Model'den başka bir model seç.`;
    if (s === 429 && /quota|billing|insufficient|credit|payment/i.test(detail)) {
        return `${providerLabel}: Hesabında yeterli bakiye/kota yok. ${providerLabel} hesabına ödeme/kredi eklemen gerekiyor.`;
    }
    if (s === 429) return `${providerLabel}: Hız sınırına takıldın (429). Birkaç saniye sonra tekrar dene.`;
    if (s === 400 && /model|not found|does not exist|decommission/i.test(detail)) {
        return `${providerLabel}: Bu model artık geçersiz veya desteklenmiyor. Ayarlar → Model'den güncel bir model seç.`;
    }
    if (s >= 500) return `${providerLabel}: Sağlayıcı sunucu hatası (${s}). Geçici olabilir, tekrar dene.`;
    return `${providerLabel} hatası (${s})${detail ? ": " + detail.slice(0, 160) : ""}`;
}

// Groq SDK exception'ını kullanıcı dostu mesaja çevirir (SDK kendi hata nesnesini fırlatır).
function friendlyGroqError(e: unknown): string {
    const err = e as {status?: number; error?: {message?: string; code?: string}; message?: string};
    const status = err?.status ?? 0;
    const detail = (err?.error?.message ?? err?.message ?? "").toString();
    const low = detail.toLowerCase();
    if (status === 401 || status === 403) return "Groq: API anahtarın geçersiz. Ayarlar → Model'den anahtarı kontrol et.";
    if (status === 404 || /decommission|not found|does not exist/.test(low)) return "Groq: Bu model artık geçersiz. Ayarlar → Model'den güncel bir model seç.";
    if (status === 413 || /too large|tpm|tokens per minute|reduce your message/.test(low)) {
        return "Seçili model bu kadar metni tek seferde kaldıramıyor (dakikalık token limiti). Daha kısa bir mesajla dene veya Ayarlar → Model'den daha geniş limitli bir model (örn. Llama 4 Scout) seç.";
    }
    if (status === 429) return "Groq: Çok hızlı istek attın (hız limiti). Birkaç saniye sonra tekrar dene.";
    if (status >= 500) return "Groq: Sağlayıcı sunucu hatası. Geçici olabilir, tekrar dene.";
    if (/fetch failed|network|ENOTFOUND|ECONNREFUSED/i.test(detail)) return "İnternet bağlantısı kurulamadı. Ağını kontrol et.";
    return `Groq hatası${detail ? ": " + detail.slice(0, 140) : ""}`;
}

// Deneme modu — chat-proxy Edge Function üzerinden Groq (senin key'in, rate limited).
// SSE stream'i parse edip OAICompletion formatına çevirir (tool-call dahil).
async function callProxy(
    messages: OAIMessage[],
    tools: ReturnType<typeof getAllToolSchemas>,
    opts: {model: string; temperature: number; max_tokens: number},
    onDelta?: (text: string) => void,
): Promise<OAICompletion> {
    const token = await getAccessToken();
    if (!token) throw new Error("Deneme modu için giriş yapman gerekiyor. Lütfen oturum aç.");

    let resp: Response;
    try {
        resp = await fetchWithTimeout(AEGIS_PROXY_URL, {
            method: "POST",
            headers: {"Authorization": `Bearer ${token}`, "Content-Type": "application/json"},
            body: JSON.stringify({
                model: opts.model,
                messages,
                // Boş tool listesi gönderme (sohbet mesajları) — token tasarrufu.
                ...(tools.length > 0 ? {tools} : {}),
                temperature: opts.temperature,
                max_tokens: opts.max_tokens,
            }),
        });
    } catch {
        // Proxy/Supabase'e ulaşılamadı (servis down veya ağ yok) → gelişmiş moda düşme öner.
        throw new Error("Deneme servisine ulaşılamıyor (sunucu veya internet bağlantısı). Ayarlar → Model'den kendi API anahtarınla Gelişmiş moda geçebilirsin.");
    }

    if (resp.status === 429) {
        // 429 iki şey olabilir: (a) bizim günlük deneme kotamız doldu (Edge "limit"),
        // (b) Groq'un dakikalık hız limiti (rate_limit_exceeded). İkisini ayır.
        const info = await resp.json().catch(() => ({}) as Record<string, unknown>);
        const raw = JSON.stringify(info).toLowerCase();
        if ((info as {error?: string}).error === "limit") {
            const err = new Error((info as {message?: string}).message ?? "Günlük deneme limitin doldu. Kendi Groq anahtarını ekle veya yarın tekrar dene.");
            (err as Error & {isLimit?: boolean}).isLimit = true;
            throw err;
        }
        if (/tpm|tokens per minute|rate_limit|too large/.test(raw)) {
            throw new Error("Şu an çok yoğunluk var (dakikalık hız limiti). Birkaç saniye bekleyip tekrar dene; mesajın çok uzunsa kısalt.");
        }
        const err2 = new Error("Deneme servisi geçici olarak meşgul. Birkaç saniye sonra tekrar dene.");
        (err2 as Error & {isLimit?: boolean}).isLimit = true;
        throw err2;
    }
    if (resp.status === 413) {
        throw new Error("Mesajın veya ekli dosyalar çok büyük. Daha kısa bir mesaj veya daha küçük dosya ile dene.");
    }
    if (resp.status === 401) {
        throw new Error("Deneme modu için oturumun geçersiz. Lütfen çıkış yapıp tekrar giriş yap.");
    }
    if (!resp.ok || !resp.body) {
        // Ham JSON yerine kullanıcı dostu mesaj — gövdeden anlamlı detay çek.
        const errText = await resp.text().catch(() => "");
        let detail = "";
        try { const j = JSON.parse(errText); detail = j?.error?.message ?? j?.message ?? j?.error ?? ""; } catch { detail = errText.slice(0, 120); }
        if (resp.status >= 500) throw new Error("Deneme sunucusunda geçici bir hata oluştu. Tekrar dene.");
        throw new Error(`Deneme servisi hatası${detail ? ": " + String(detail).slice(0, 120) : ` (${resp.status})`}`);
    }

    // SSE parse — Groq chunk formatı (callAI'deki Groq dalıyla aynı mantık)
    let fullContent = "";
    const tcMap = new Map<number, {id: string; name: string; args: string}>();
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // son kısmi satırı koru
        for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "" || payload === "[DONE]") continue;
            let chunk: any;
            try { chunk = JSON.parse(payload); } catch { continue; }
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
                fullContent += delta.content;
                onDelta?.(delta.content);
            }
            for (const tc of delta?.tool_calls ?? []) {
                const ex = tcMap.get(tc.index) ?? {id: "", name: "", args: ""};
                tcMap.set(tc.index, {
                    id: tc.id ?? ex.id,
                    name: tc.function?.name ?? ex.name,
                    args: ex.args + (tc.function?.arguments ?? ""),
                });
            }
        }
    }

    return {choices: [{message: {
        content: fullContent || null,
        tool_calls: tcMap.size > 0
            ? [...tcMap.values()].map((tc) => ({id: tc.id, type: "function" as const, function: {name: tc.name, arguments: tc.args}}))
            : undefined,
    }}]};
}

// ───────── Mesaj ön-işleme (modele göre) ─────────
// Görüntü desteklemeyen modele image göndermeyiz (400 önler) — yer tutucu metne çevir.
function stripImagesIfNeeded(messages: OAIMessage[], caps: ModelCaps): OAIMessage[] {
    if (caps.supportsVision) return messages;
    let changed = false;
    const out = messages.map((msg) => {
        if (!Array.isArray(msg.content)) return msg;
        if (!msg.content.some((p) => p.type === "image_url")) return msg;
        changed = true;
        const parts = msg.content.map((p) =>
            p.type === "image_url" ? {type: "text" as const, text: "[görüntü atlandı: bu model görüntü desteklemiyor]"} : p);
        return {...msg, content: parts};
    });
    return changed ? out : messages;
}

// system rolünü desteklemeyen modeller (o1-mini/o1-preview) için system metnini
// ilk user mesajının başına ekleyip system mesajını kaldır.
function mergeSystemIfNeeded(messages: OAIMessage[], caps: ModelCaps): OAIMessage[] {
    if (caps.supportsSystemPrompt) return messages;
    const sys = messages.find((mm) => mm.role === "system");
    if (!sys) return messages;
    const sysText = extractTextContent(sys.content);
    const rest = messages.filter((mm) => mm.role !== "system");
    const idx = rest.findIndex((mm) => mm.role === "user");
    if (idx >= 0 && sysText) {
        rest[idx] = {...rest[idx], content: `${sysText}\n\n${extractTextContent(rest[idx].content)}`};
    }
    return rest;
}

// Bağlam penceresine göre geçmişi kırp. system + en yeni mesajları korur; pencere
// "tool" ya da araç-çağrılı "assistant" ile başlamasın (yoksa API 400 verir).
function trimToBudget(messages: OAIMessage[], caps: ModelCaps, maxOut: number): OAIMessage[] {
    const sysMsg = messages[0]?.role === "system" ? messages[0] : null;
    const body = sysMsg ? messages.slice(1) : messages;
    const sysTokens = sysMsg ? estimateTokens(extractTextContent(sysMsg.content)) : 0;
    const budget = caps.contextWindow - maxOut - sysTokens - 512;
    if (budget <= 0) return messages;

    const kept: OAIMessage[] = [];
    let used = 0;
    for (let i = body.length - 1; i >= 0; i--) {
        const msg = body[i];
        let tok = estimateTokens(typeof msg.content === "string" ? msg.content : extractTextContent(msg.content));
        if (Array.isArray(msg.content)) tok += msg.content.filter((p) => p.type === "image_url").length * 1100;
        if (used + tok > budget && kept.length > 0) break;
        kept.unshift(msg);
        used += tok;
    }
    while (kept.length > 0 && (kept[0].role === "tool" || (kept[0].role === "assistant" && kept[0].tool_calls))) {
        kept.shift();
    }
    if (kept.length === 0) {
        const lastUser = [...body].reverse().find((mm) => mm.role === "user");
        if (lastUser) kept.push(lastUser);
    }
    return sysMsg ? [sysMsg, ...kept] : kept;
}

async function callAI(messages: OAIMessage[], onDelta?: (text: string) => void, lockedSchemas?: ReturnType<typeof getAllToolSchemas>): Promise<OAICompletion> {
    const provider = currentSettings.aiProvider;
    const key = getProviderKey(provider);
    const temp = currentSettings.temperature ?? 0.7;
    const reqMaxTok = currentSettings.maxTokens ?? 8192;
    const topP = currentSettings.topP ?? 1.0;

    // Deneme modunda (kendi Groq key'i yoksa) chat proxy üzerinden Groq'a gider —
    // bu yüzden yetenekleri ve tool seçimini groq'a göre hesapla.
    const ownGroqKey = (currentSettings.providerKeys?.groq ?? "").trim();
    const trialMode = currentSettings.aiMode === "trial" && !ownGroqKey;
    const effectiveProvider = trialMode ? "groq" : provider;

    // ── Modele özel yetenekler — her parametreyi buna göre kırp/at ──
    const caps = getModelCapabilities(effectiveProvider, MODEL, currentSettings.ollamaNumCtx ?? 4096);
    const maxTok = clampMaxTokens(reqMaxTok, caps);
    const sendTemp = resolveTemperature(temp, caps); // number | undefined (reasoning → undefined)

    // Mesajları ön-işle: vision yoksa görüntü çıkar, system yoksa birleştir, bağlama göre kırp.
    messages = stripImagesIfNeeded(messages, caps);
    messages = mergeSystemIfNeeded(messages, caps);
    messages = trimToBudget(messages, caps, maxTok);

    // Bağlama göre tool seçimi — ilk çağrıda hesapla, tool call zincirinde kilitle.
    // lockedSchemas verilmişse onu kullan (zincir tutarlılığı), yoksa context'ten hesapla.
    const activeSchemas: ReturnType<typeof getAllToolSchemas> = lockedSchemas ?? (() => {
        if (!caps.supportsTools) return [];
        const lastUserMsg = [...messages].reverse().find((mm) => mm.role === "user");
        const toolContext = lastUserMsg ? extractTextContent(lastUserMsg.content) : "";
        return getAllToolSchemas(effectiveProvider, toolContext);
    })();

    // ── Deneme modu (proxy) ──
    if (trialMode) {
        return callProxy(messages, activeSchemas, {model: MODEL, temperature: sendTemp ?? temp, max_tokens: maxTok}, onDelta);
    }

    // ── Groq (streaming) ──────────────────────────────────────────────────────
    if (provider === "groq") {
        // failed_generation geçici bir model hatası — 1 kez otomatik yeniden dene.
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const stream = await groq.chat.completions.create({
                    model: MODEL,
                    messages: messages as ChatCompletionMessageParam[],
                    // Boş tool listesi gönderme — sohbet mesajlarında token tasarrufu (özellikle düşük-TPM modeller).
                    ...(activeSchemas.length > 0 ? {tools: activeSchemas} : {}),
                    stream: true,
                    ...(sendTemp !== undefined ? {temperature: sendTemp} : {}),
                    max_tokens: maxTok,
                });
                let fullContent = "";
                let finishReason = "";
                const tcMap = new Map<number, {id: string; name: string; args: string}>();
                for await (const chunk of stream) {
                    const choice = chunk.choices[0];
                    const delta = choice?.delta;
                    finishReason = (choice as any)?.finish_reason ?? finishReason;
                    if (delta?.content) {
                        fullContent += delta.content;
                        onDelta?.(delta.content);
                    }
                    for (const tc of (delta as any)?.tool_calls ?? []) {
                        const ex = tcMap.get(tc.index) ?? {id: "", name: "", args: ""};
                        tcMap.set(tc.index, {
                            id: tc.id ?? ex.id,
                            name: tc.function?.name ?? ex.name,
                            args: ex.args + (tc.function?.arguments ?? ""),
                        });
                    }
                }
                // failed_generation: model JSON üretemedi — bir kez sessizce yeniden dene.
                if (finishReason === "failed_generation" && attempt === 0) {
                    await new Promise((r) => setTimeout(r, 800));
                    continue;
                }
                return {choices: [{message: {
                    content: fullContent || null,
                    tool_calls: tcMap.size > 0
                        ? [...tcMap.values()].map((tc) => ({id: tc.id, type: "function" as const, function: {name: tc.name, arguments: tc.args}}))
                        : undefined,
                }}]};
            } catch (e) {
                throw new Error(friendlyGroqError(e));
            }
        }
        // İkinci deneme de failed_generation ile bittiyse boş response dön.
        return {choices: [{message: {content: null, tool_calls: undefined}}]};
    }

    // ── Anthropic ────────────────────────────────────────────────────────────
    if (provider === "anthropic") {
        const system = messages.find((m) => m.role === "system")?.content ?? "";
        const turns = messages.filter((m) => m.role !== "system");
        const body: Record<string, unknown> = {
            model: MODEL,
            max_tokens: maxTok,
            system,
            ...(sendTemp !== undefined ? {temperature: sendTemp} : {}),
            messages: turns.map((m) => ({
                role: m.role === "tool" ? "user" : m.role,
                content: m.role === "tool"
                    ? [{type: "tool_result", tool_use_id: m.tool_call_id, content: typeof m.content === "string" ? m.content : extractTextContent(m.content)}]
                    : toAnthropicContent(m.content),
            })),
            ...(activeSchemas.length > 0 ? {tools: activeSchemas.map((t) => ({
                name: t.function?.name,
                description: t.function?.description,
                input_schema: t.function?.parameters,
            }))} : {}),
        };
        const resp = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            body: JSON.stringify(body),
        }, 60_000);
        if (!resp.ok) throw new Error(await friendlyHttpError("Anthropic", resp));
        const data = await resp.json() as {content: {type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown>}[]};
        const textBlock = data.content.find((b) => b.type === "text");
        const toolBlocks = data.content.filter((b) => b.type === "tool_use");
        const text = textBlock?.text ?? null;
        if (text) onDelta?.(text);
        return {choices: [{message: {
            content: text,
            tool_calls: toolBlocks.length > 0
                ? toolBlocks.map((b) => ({id: b.id!, type: "function" as const, function: {name: b.name!, arguments: JSON.stringify(b.input ?? {})}}))
                : undefined,
        }}]};
    }

    // ── Gemini ───────────────────────────────────────────────────────────────
    if (provider === "gemini") {
        if (!key) throw new Error("Gemini API key eksik. Model ayarlarından girin.");
        const sysMsg = messages.find((m) => m.role === "system");
        const turns = messages.filter((m) => m.role !== "system");

        const contents: {role: string; parts: object[]}[] = [];
        for (const m of turns) {
            if (m.role === "user") {
                contents.push({role: "user", parts: toGeminiParts(m.content)});
            } else if (m.role === "assistant") {
                const parts: object[] = [];
                if (m.content) parts.push({text: extractTextContent(m.content)});
                for (const tc of (m.tool_calls ?? []) as {id: string; function: {name: string; arguments: string}}[]) {
                    let args: unknown = {};
                    try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
                    parts.push({functionCall: {name: tc.function.name, args}});
                }
                if (parts.length > 0) contents.push({role: "model", parts});
            } else if (m.role === "tool") {
                const toolName = findToolName(messages, m.tool_call_id ?? "");
                contents.push({role: "user", parts: [{functionResponse: {name: toolName, response: {output: m.content}}}]});
            }
        }

        // Gemini, JSON Schema'da "additionalProperties" field'ını tanımıyor — strip et
        function stripAdditionalProps(obj: unknown): unknown {
            if (Array.isArray(obj)) return obj.map(stripAdditionalProps);
            if (obj && typeof obj === "object") {
                const out: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
                    if (k === "additionalProperties") continue;
                    out[k] = stripAdditionalProps(v);
                }
                return out;
            }
            return obj;
        }
        const functionDeclarations = activeSchemas.map((s) => ({
            name: s.function?.name,
            description: s.function?.description,
            parameters: stripAdditionalProps(s.function?.parameters),
        }));

        const generationConfig: Record<string, unknown> = {maxOutputTokens: maxTok, topP};
        if (sendTemp !== undefined) generationConfig.temperature = sendTemp;
        const body: Record<string, unknown> = {contents, generationConfig};
        if (sysMsg?.content) body.systemInstruction = {parts: [{text: extractTextContent(sysMsg.content)}]};
        if (functionDeclarations.length > 0) body.tools = [{functionDeclarations}];

        const resp = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
            {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)},
            60_000,
        );
        if (!resp.ok) throw new Error(await friendlyHttpError("Gemini", resp));

        const data = await resp.json() as {
            candidates?: [{content?: {parts?: ({text?: string; functionCall?: {name: string; args: Record<string, unknown>}})[]; role?: string}}]
        };
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const textParts = parts.filter((p) => p.text).map((p) => p.text!).join("");
        const funcCalls = parts.filter((p) => p.functionCall);

        if (textParts) onDelta?.(textParts);
        return {choices: [{message: {
            content: textParts || null,
            tool_calls: funcCalls.length > 0
                ? funcCalls.map((p, i) => ({
                    id: `gemini-${p.functionCall!.name}-${i}`,
                    type: "function" as const,
                    function: {name: p.functionCall!.name, arguments: JSON.stringify(p.functionCall!.args ?? {})},
                }))
                : undefined,
        }}]};
    }

    // ── Ollama ───────────────────────────────────────────────────────────────
    if (provider === "ollama") {
        const ollamaUrl = (currentSettings.ollamaUrl || "http://localhost:11434") + "/v1/chat/completions";
        let resp: Response;
        try {
            resp = await fetchWithTimeout(ollamaUrl, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    model: MODEL,
                    messages,
                    ...(activeSchemas.length > 0 ? {tools: activeSchemas} : {}),
                    stream: false,
                    ...(sendTemp !== undefined ? {temperature: sendTemp} : {}),
                    options: {num_ctx: currentSettings.ollamaNumCtx ?? 4096},
                }),
            }, 60_000);
        } catch {
            throw new Error("Ollama bağlantı hatası. Ollama çalışıyor mu? (ollama serve)");
        }
        if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            throw new Error(`Ollama ${resp.status}: ${txt || "bilinmeyen hata"}`);
        }
        return await resp.json() as OAICompletion;
    }

    // ── xAI (Grok) — OpenAI-compatible ───────────────────────────────────────
    if (provider === "xai") {
        if (!key) throw new Error("xAI API key eksik. Model ayarlarından girin.");
        const body: Record<string, unknown> = {model: MODEL, messages, stream: false, max_tokens: maxTok};
        if (activeSchemas.length > 0) body.tools = activeSchemas;
        if (sendTemp !== undefined) body.temperature = sendTemp;
        const resp = await fetchWithTimeout("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {"Authorization": `Bearer ${key}`, "Content-Type": "application/json"},
            body: JSON.stringify(body),
        }, 60_000);
        if (!resp.ok) throw new Error(`xAI ${resp.status}: ${await resp.text()}`);
        const result = await resp.json() as OAICompletion;
        const text = result.choices[0]?.message?.content;
        if (text) onDelta?.(text);
        return result;
    }

    // ── DeepSeek — OpenAI-compatible ─────────────────────────────────────────
    if (provider === "deepseek") {
        if (!key) throw new Error("DeepSeek API key eksik. Model ayarlarından girin.");
        const body: Record<string, unknown> = {model: MODEL, messages, stream: false, max_tokens: maxTok};
        if (activeSchemas.length > 0) body.tools = activeSchemas;
        if (sendTemp !== undefined) body.temperature = sendTemp;
        const resp = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {"Authorization": `Bearer ${key}`, "Content-Type": "application/json"},
            body: JSON.stringify(body),
        }, 60_000);
        if (!resp.ok) throw new Error(`DeepSeek ${resp.status}: ${await resp.text()}`);
        const result = await resp.json() as OAICompletion;
        const text = result.choices[0]?.message?.content;
        if (text) onDelta?.(text);
        return result;
    }

    // ── OpenAI / Mistral — OpenAI-compatible ──────────────────────────────────
    const endpoints: Record<string, string> = {
        openai:  "https://api.openai.com/v1/chat/completions",
        mistral: "https://api.mistral.ai/v1/chat/completions",
    };
    const url = endpoints[provider] ?? endpoints.openai;
    const body: Record<string, unknown> = {
        model: MODEL,
        messages,
        stream: false,
    };
    if (activeSchemas.length > 0) body.tools = activeSchemas;
    // OpenAI o-serisi / gpt-5: max_tokens YERİNE max_completion_tokens ister.
    if (caps.usesMaxCompletionTokens) body.max_completion_tokens = maxTok;
    else body.max_tokens = maxTok;
    if (sendTemp !== undefined) body.temperature = sendTemp;
    if (topP !== 1.0 && caps.supportsTemperature) body.top_p = topP;
    if (provider === "openai" && caps.supportsTemperature && currentSettings.presencePenalty !== 0) body.presence_penalty = currentSettings.presencePenalty;
    if (provider === "openai" && caps.supportsTemperature && currentSettings.frequencyPenalty !== 0) body.frequency_penalty = currentSettings.frequencyPenalty;
    if (provider === "mistral" && currentSettings.mistralSafeMode) body.safe_prompt = true;

    const resp = await fetchWithTimeout(url, {
        method: "POST",
        headers: {"Authorization": `Bearer ${key}`, "Content-Type": "application/json"},
        body: JSON.stringify(body),
    }, 60_000);
    if (!resp.ok) throw new Error(await friendlyHttpError(provider.toUpperCase(), resp));
    const result = await resp.json() as OAICompletion;
    const text = result.choices[0]?.message?.content;
    if (text) onDelta?.(text);
    return result;
}

// ---- User profile cache (avoid Supabase round-trip on every message) ----
let cachedProfile: Record<string, string> = {};
let profileCachedAt = 0;

// ---- Agentic streaming chat ----
async function runAgent(history: {role: string; content: string | MsgPart[]}[], reqId: string, isSubAgent = false): Promise<void> {
    // Only update sessionHistory for the main chat flow, not sub-agent calls (prevents race on parallel agents)
    if (!isSubAgent) {
        sessionHistory = history.map((m) => ({role: m.role, content: extractTextContent(m.content)}));
    }

    // Refresh profile at most once per minute
    if (Date.now() - profileCachedAt > 60_000) {
        cachedProfile = await getUserProfile().catch(() => ({}));
        profileCachedAt = Date.now();
    }
    const profileNote =
        Object.keys(cachedProfile).length > 0 ?
            `\nKullanıcı profili: ${Object.entries(cachedProfile)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}`
        :   "";
    const systemContent = getSystemPrompt(currentSettings.language ?? "tr", currentSettings.fullPcAccess ?? false) + profileNote + memorySummaries + getFactsForContext();
    // Geçmiş kırpma artık callAI içinde MODELE GÖRE (bağlam penceresi token bütçesi +
    // boundary düzeltme) yapılıyor. Burada yalnız belleğin sınırsız büyümesini önlemek
    // için kaba bir üst sınır koyuyoruz; gerçek kırpmayı model yeteneği belirler.
    const trimmedHistory = history.length > 60 ? history.slice(-60) : history;
    const messages: OAIMessage[] = [{role: "system", content: systemContent}, ...trimmedHistory];
    const send = (channel: string, payload: object) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, {reqId, ...payload});
        if (channel === "chat-delta") broadcastFeedEvent("delta", payload);
        else if (channel === "chat-done") broadcastFeedEvent("done", payload);
        else if (channel === "tool-event") broadcastFeedEvent("tool", payload);
    };

    // Tool listesini döngü başlamadan bir kez hesapla — zincirde her adımda aynı
    // liste gönderilsin. Groq "tool not in request.tools" hatasını bu önler.
    const lastUserForTools = [...messages].reverse().find((m) => m.role === "user");
    const toolContextStr = lastUserForTools ? extractTextContent(lastUserForTools.content) : "";
    const lockedTools = getAllToolSchemas(currentSettings.aiProvider, toolContextStr);

    for (let step = 0; step < 8; step++) {
        // Groq: tokens stream via onDelta. Other providers: full response returned.
        const completion = await callAI(messages, (text) => send("chat-delta", {text}), lockedTools);

        const msg = completion.choices[0]?.message;
        const content = msg?.content ?? "";
        const toolCalls = (msg?.tool_calls ?? []) as {id: string; type: "function"; function: {name: string; arguments: string}}[];

        // callAI tüm providerlar için onDelta'yı çağırıyor — burada tekrar gönderme.

        if (toolCalls.length === 0) {
            if (content) await saveMessage("assistant", content).catch((e) => console.error("[saveMessage]", e.message));
            send("chat-done", {});
            return;
        }

        messages.push({role: "assistant", content: content || null, tool_calls: toolCalls} as OAIMessage);

        // Run all tool calls in parallel — allSettled so one failure doesn't abort others
        const settled = await Promise.allSettled(
            toolCalls.map(async (call) => {
                const name = call.function.name;
                const argsJson = call.function.arguments || "{}";
                send("tool-event", {phase: "start", name, args: argsJson});
                recordToolUsage(name);
                const result = await executeTool(name, argsJson);
                send("tool-event", {phase: "done", name, result: String(result).slice(0, 400)});
                await saveMessage("tool", String(result).slice(0, 1000), name).catch((e) => console.error("[saveMessage]", e.message));
                const forModel = String(result);
                const clipped = forModel.length > 6000
                    ? forModel.slice(0, 6000) + `\n\n[...kısaltıldı, toplam ${forModel.length} karakter]`
                    : forModel;
                return {id: call.id, content: clipped};
            })
        );
        const toolResults = settled.map((r, i) =>
            r.status === "fulfilled"
                ? r.value
                : {id: toolCalls[i].id, content: `Araç hatası: ${(r.reason as Error).message ?? String(r.reason)}`}
        );
        for (const r of toolResults) {
            messages.push({role: "tool", tool_call_id: r.id, content: r.content});
        }
    }

    send("chat-delta", {text: "\n\n(İşlem araç döngüsü limitine ulaştı.)"});
    send("chat-done", {});
}

// Ensure only one instance runs
if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}
app.on("second-instance", () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

async function summarizeAndSave(): Promise<void> {
    if (sessionHistory.length < 2) return;
    // Özet için yerel Groq anahtarı gerekir; yoksa (ör. trial modu — anahtar sunucuda)
    // sessizce atla, 401 üretme.
    if (!(process.env.GROQ_API_KEY ?? "").trim()) return;
    try {
        const turns = sessionHistory
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => `${m.role === "user" ? "Kullanıcı" : "AEGIS"}: ${m.content}`)
            .join("\n");
        const res = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {role: "system", content: "Aşağıdaki konuşmayı 3-5 cümleyle özetle. Türkçe. Sadece özeti yaz, başka bir şey ekleme."},
                {role: "user", content: turns.slice(0, 6000)},
            ],
            stream: false,
        });
        const summary = res.choices[0]?.message?.content?.trim() ?? "";
        if (summary) await saveSessionSummary(summary);
    } catch (e) {
        console.error("Session summary error:", e);
    }
}

const LANG_DEFAULT_VOICE: Record<string, string> = {
    tr: "tr-TR-EmelNeural",
    en: "en-US-AriaNeural",
    de: "de-DE-KatjaNeural",
    fr: "fr-FR-DeniseNeural",
    es: "es-ES-ElviraNeural",
};

function activatePlugins(): string {
    const {schemas, executors, plugins} = loadPlugins();
    extraSchemas.length = 0;
    extraSchemas.push(...schemas);
    registerPluginExecutors(executors);
    setPluginList(plugins);
    return `${plugins.length} plugin yüklendi.`;
}

async function bootApp(): Promise<void> {
    const {safeStorage} = await import("electron");
    initVault(safeStorage);

    // Cloud sync (Faz 30.7) — giriş + sync açıksa açılışta buluttan ayar/key çek.
    try {
        const res = await pullFromCloud();
        if (res.applied) {
            currentSettings = loadSettings();
            MODEL = currentSettings.model;
            setFullPcAccess(currentSettings.fullPcAccess ?? false);
            setDisabledTools(currentSettings.disabledTools ?? []);
        }
    } catch { /* sync opsiyonel — başarısızlık uygulamayı durdurmaz */ }

    registerQuitCallback(() => app.quit());

    registerRemindCallback((message) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("reminder-fired", {message});
        }
    });

    registerNotificationCallback((title, body) => {
        if (ElectronNotification.isSupported()) {
            new ElectronNotification({title, body}).show();
        }
    });

    activatePlugins();
    registerReloadPluginsCallback(async () => activatePlugins());

    registerScreenshotCallback(async () => {
        try {
            // Hide AEGIS window so it doesn't appear in the screenshot
            const wasVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
            if (wasVisible) mainWindow!.hide();
            // Small delay to let the OS repaint the desktop behind us
            await new Promise<void>((r) => setTimeout(r, 300));

            const primaryDisplay = screen.getPrimaryDisplay();
            const {width, height} = primaryDisplay.size;
            const thumbW = Math.round(Math.min(width, 1280));
            const thumbH = Math.round(height * (thumbW / width));
            const sources = await desktopCapturer.getSources({
                types: ["screen"],
                thumbnailSize: {width: thumbW, height: thumbH},
            });

            if (wasVisible) mainWindow!.show();

            const source = sources[0];
            if (!source) return {error: "Ekran kaynağı bulunamadı."};
            const base64 = source.thumbnail.toDataURL().replace(/^data:image\/png;base64,/, "");
            return {base64, width, height};
        } catch (e) {
            return {error: (e as Error).message ?? String(e)};
        }
    });

    registerAnalyzeScreenCallback(async (base64: string, prompt: string) => {
        const provider = currentSettings.aiProvider;
        const key = getProviderKey(provider);
        const imgUrl = `data:image/png;base64,${base64}`;

        // ── Deneme modu (proxy) — kendi Groq key'i yoksa senin proxy'inden ──
        const ownGroqKey = (currentSettings.providerKeys?.groq ?? "").trim();
        if (currentSettings.aiMode === "trial" && !ownGroqKey) {
            const completion = await callProxy(
                [{role: "user", content: [
                    {type: "image_url", image_url: {url: imgUrl}},
                    {type: "text", text: prompt},
                ]} as OAIMessage],
                [], // vision için tool yok
                {model: "meta-llama/llama-4-scout-17b-16e-instruct", temperature: 0.7, max_tokens: 1024},
            );
            return completion.choices[0]?.message?.content ?? "(yanıt alınamadı)";
        }

        // ── Anthropic vision ──
        if (provider === "anthropic" && key) {
            const body = {
                model: MODEL,
                max_tokens: 1024,
                messages: [{
                    role: "user",
                    content: [
                        {type: "image", source: {type: "base64", media_type: "image/png", data: base64}},
                        {type: "text", text: prompt},
                    ],
                }],
            };
            const resp = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                body: JSON.stringify(body),
            }, 60_000);
            if (!resp.ok) throw new Error(await friendlyHttpError("Anthropic vision", resp));
            const data = await resp.json() as {content: {type: string; text?: string}[]};
            return data.content.find((b) => b.type === "text")?.text ?? "(yanıt alınamadı)";
        }

        // ── Gemini vision ──
        if (provider === "gemini" && key) {
            const body = {
                contents: [{role: "user", parts: [
                    {inline_data: {mime_type: "image/png", data: base64}},
                    {text: prompt},
                ]}],
                generationConfig: {maxOutputTokens: 1024},
            };
            const resp = await fetchWithTimeout(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
                {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)},
                60_000,
            );
            if (!resp.ok) throw new Error(await friendlyHttpError("Gemini vision", resp));
            const data = await resp.json() as {candidates: {content: {parts: {text?: string}[]}}[]};
            return data.candidates[0]?.content?.parts?.find((p) => p.text)?.text ?? "(yanıt alınamadı)";
        }

        // ── OpenAI / xAI / deepseek / mistral (OpenAI-compat vision) ──
        if ((provider === "openai" || provider === "xai" || provider === "deepseek" || provider === "mistral") && key) {
            const endpoints: Record<string, string> = {
                openai:   "https://api.openai.com/v1/chat/completions",
                xai:      "https://api.x.ai/v1/chat/completions",
                deepseek: "https://api.deepseek.com/v1/chat/completions",
                mistral:  "https://api.mistral.ai/v1/chat/completions",
            };
            const visionModel: Record<string, string> = {
                openai:   MODEL.startsWith("gpt") ? MODEL : "gpt-4o-mini",
                xai:      "grok-2-vision-1212",
                deepseek: MODEL,
                mistral:  "pixtral-12b-2409",
            };
            const body = {
                model: visionModel[provider],
                max_tokens: 1024,
                messages: [{
                    role: "user",
                    content: [
                        {type: "image_url", image_url: {url: imgUrl}},
                        {type: "text", text: prompt},
                    ],
                }],
            };
            const resp = await fetchWithTimeout(endpoints[provider], {
                method: "POST",
                headers: {"Authorization": `Bearer ${key}`, "content-type": "application/json"},
                body: JSON.stringify(body),
            }, 60_000);
            if (!resp.ok) throw new Error(await friendlyHttpError(`${provider.toUpperCase()} vision`, resp));
            const data = await resp.json() as {choices: {message: {content: string}}[]};
            return data.choices[0]?.message?.content ?? "(yanıt alınamadı)";
        }

        // ── Groq (fallback + groq seçiliyken) ──
        const groqKey = getProviderKey("groq") || process.env.GROQ_API_KEY || "";
        const visionGroq = new Groq({apiKey: groqKey});
        const resp = await visionGroq.chat.completions.create({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [{
                role: "user",
                content: [
                    {type: "image_url", image_url: {url: imgUrl}},
                    {type: "text", text: prompt},
                ] as any,
            }],
            stream: false,
            max_tokens: 1024,
        } as any);
        return (resp as any).choices[0]?.message?.content ?? "(yanıt alınamadı)";
    });

    registerSetLanguageCallback((lang) => {
        const voice = LANG_DEFAULT_VOICE[lang] ?? LANG_DEFAULT_VOICE.tr;
        currentSettings = {...currentSettings, language: lang as AppSettings["language"], ttsVoice: voice};
        saveSettings(currentSettings);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("language-changed", {language: lang, ttsVoice: voice});
        }
    });
    await startSession().catch((e) => console.error("[startSession]", e.message));

    // Load previous session summaries + pending reminders into system prompt context
    try {
        const [summaries, notes] = await Promise.all([getRecentSummaries(5), getPendingNotes()]);
        if (summaries.length > 0) {
            const lines = summaries.map((s) => {
                const date = s.ended_at ? new Date(s.ended_at).toLocaleDateString("tr-TR") : "?";
                return `- ${date}: ${s.summary}`;
            }).join("\n");
            memorySummaries = `\n\nÖNCEKİ OTURUMLAR (hafıza):\n${lines}`;
        }
        const dueNotes = notes.filter((n) => n.remind_at && new Date(n.remind_at) <= new Date());
        if (dueNotes.length > 0) {
            const noteLines = dueNotes.map((n) => `- [${n.id.slice(0, 8)}] ${n.content}`).join("\n");
            memorySummaries += `\n\nBEKLEYEN HATIRLATICILAR (kullanıcıya bildir):\n${noteLines}`;
        }
    } catch {}

    registerAgentCallback((goal, maxSteps) => {
        const reqId = `agent-${Date.now()}`;
        const agentPrompt = `[AJAN MODU — maks ${maxSteps} adım] Hedef: ${goal}\n\nBu hedefi araçları kullanarak adım adım tamamla. Her adımda kısa bir durum bildirimi yaz. Bitince özet sun.`;
        const messages = [...sessionHistory, {role: "user", content: agentPrompt}];
        saveMessage("user", agentPrompt).catch(() => {});
        runAgent(messages, reqId, true).catch(() => {});
    });

    registerMacroRunCallback(async (steps) => {
        for (const step of steps) {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("chat-stream-inject", {command: step});
            }
            await new Promise<void>((r) => setTimeout(r, 3000));
        }
    });

    // pipeline_run / model_compare için tek-atışlık LLM çağrısı (tool'suz, stream'siz).
    registerLLMCallback(async (prompt, model) => {
        // "provider:modelId" → Groq modelleri için prefix'i sıyır; aksi halde aktif MODEL.
        const modelId = model
            ? (model.startsWith("groq:") ? model.slice(5) : model.includes(":") ? model.split(":")[1] : model)
            : MODEL;
        const res = await groq.chat.completions.create({
            model: modelId,
            messages: [{role: "user", content: prompt}],
            stream: false,
        });
        return res.choices[0]?.message?.content ?? "";
    });

    ipcMain.on("chat-stream", async (_e, {messages, reqId}: {messages: {role: string; content: string | MsgPart[]}[]; reqId: string}) => {
        let errSent = false;
        try {
            const last = messages[messages.length - 1];
            if (last?.role === "user") {
                const textForSave = typeof last.content === "string" ? last.content : extractTextContent(last.content);
                await saveMessage("user", textForSave).catch((e) => console.error("[saveMessage]", e.message));
                if (isRecording()) addMacroStep(textForSave);
            }
            await runAgent(messages, reqId);
        } catch (e) {
            errSent = true;
            let msg = (e as Error).message ?? String(e);
            if (isTimeoutError(e)) {
                msg = TIMEOUT_MSG;
            } else if (/fetch failed|ENOTFOUND|ECONNREFUSED|network|getaddrinfo/i.test(msg)) {
                msg = "İnternet bağlantısı kurulamadı. Ağ bağlantını kontrol et ve tekrar dene.";
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("chat-error", {reqId, message: msg});
            }
        } finally {
            // chat-done her zaman gönderilmeli — streaming state sıfırlanır
            if (!errSent || true) {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("chat-done", {reqId});
                }
            }
        }
    });

    ipcMain.handle("weather", () => getWeather());

    ipcMain.handle("spotify-authorize", () => spotifyAuthorizeCmd());
    ipcMain.handle("spotify-now-playing", () => spotifyGetState());
    ipcMain.handle("spotify-control", (_e, {action, value}: {action: string; value?: number}) => {
        if (action === "play")   return spotifyPlay();
        if (action === "pause")  return spotifyPause();
        if (action === "next")   return spotifyNext();
        if (action === "prev")   return spotifyPrev();
        if (action === "volume") return spotifySetVolume(Number(value ?? 50));
        return "Bilinmeyen aksiyon";
    });

    ipcMain.handle("transcribe", async (_e, audioBuffer: ArrayBuffer) => {
        try {
            const buffer = Buffer.from(audioBuffer);
            const tmpPath = path.join(os.tmpdir(), `jarvis-audio-${Date.now()}.webm`);
            const fs = await import("fs");
            fs.writeFileSync(tmpPath, buffer);
            const whisperLang = currentSettings.language ?? "tr";
            const whisperPrompts: Record<string, string> = {
                tr: "Türkçe konuşma. Steam, Discord, YouTube, PowerShell gibi teknik kelimeler içerebilir.",
                en: "English speech. May contain technical terms like Steam, Discord, YouTube, PowerShell.",
                de: "Deutsche Sprache. Kann technische Begriffe wie Steam, Discord, YouTube, PowerShell enthalten.",
                fr: "Discours français. Peut contenir des termes techniques comme Steam, Discord, YouTube, PowerShell.",
                es: "Habla en español. Puede contener términos técnicos como Steam, Discord, YouTube, PowerShell.",
            };
            const result = await groq.audio.transcriptions.create({
                file: Object.assign(fs.createReadStream(tmpPath), {name: "audio.webm"}),
                model: "whisper-large-v3-turbo",
                language: whisperLang,
                prompt: whisperPrompts[whisperLang] ?? whisperPrompts.tr,
                response_format: "json",
            });
            fs.unlinkSync(tmpPath);
            return {text: result.text};
        } catch (e) {
            return {error: (e as Error).message ?? String(e)};
        }
    });

    ipcMain.handle("tts", async (_e, text: string) => {
        try {
            const cfg = loadConfig();
            const elKey = cfg?.elevenlabsApiKey ?? process.env.ELEVENLABS_API_KEY ?? "";

            if (currentSettings.ttsProvider === "elevenlabs" && elKey) {
                const voiceId = currentSettings.ttsVoice.startsWith("el:") ?
                    currentSettings.ttsVoice.slice(3) :
                    "cgSgspJ2msm6clMCkdW9"; // Jessica (default)
                const speed = Math.max(0.7, Math.min(1.2, currentSettings.ttsRate ?? 1.0));
                const resp = await fetchWithTimeout(
                    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                    {
                        method: "POST",
                        headers: {"xi-api-key": elKey, "Content-Type": "application/json"},
                        body: JSON.stringify({
                            text,
                            model_id: "eleven_flash_v2_5",
                            voice_settings: {stability: 0.5, similarity_boost: 0.75},
                            output_format: "mp3_44100_128",
                            speed,
                        }),
                    },
                );
                if (!resp.ok) {
                    const body = await resp.text().catch(() => "");
                    throw new Error(`ElevenLabs ${resp.status}: ${body || "Bilinmeyen hata. API key doğru mu?"}`);
                }
                const ab = await resp.arrayBuffer();
                return {buffer: Buffer.from(ab)};
            }

            // Edge TTS (default)
            const tts = new MsEdgeTTS();
            await tts.setMetadata(currentSettings.ttsVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            const {audioStream} = await tts.toStream(text);
            const chunks: Buffer[] = [];
            await new Promise<void>((resolve, reject) => {
                audioStream.on("data", (d: Buffer) => chunks.push(d));
                audioStream.on("close", resolve);
                audioStream.on("error", reject);
            });
            return {buffer: Buffer.concat(chunks)};
        } catch (e) {
            return {error: (e as Error).message ?? String(e)};
        }
    });

    // ── Auth (Faz 30) ───────────────────────────────────────────────────────
    ipcMain.handle("auth-sign-up", (_e, {email, password}: {email: string; password: string}) => signUp(email, password));
    ipcMain.handle("auth-sign-in", (_e, {email, password}: {email: string; password: string}) => signIn(email, password));
    ipcMain.handle("auth-sign-out", () => signOut());
    ipcMain.handle("auth-current-user", () => getCurrentUser());
    ipcMain.handle("usage-get", () => getUsage());

    // Canlı model listesi — provider'ın resmi endpoint'inden (uydurma ID sorununu çözer).
    ipcMain.handle("models-list", async (_e, {provider, key}: {provider: string; key?: string}) => {
        const useKey = (key ?? "").trim() || getProviderKey(provider);
        return fetchModels(provider, useKey, currentSettings.ollamaUrl);
    });

    // Seçili modelin yetenekleri (tool/vision/reasoning/limit) — Model sekmesinde
    // rozet olarak gösterilir. Kullanıcı modelin ne yapıp yapamadığını net görür.
    ipcMain.handle("caps-get", (_e, {provider, model}: {provider: string; model: string}) => {
        return getModelCapabilities(provider, model, currentSettings.ollamaNumCtx ?? 4096);
    });

    ipcMain.handle("config-get", () => {
        return {
            groqApiKey: process.env.GROQ_API_KEY ?? "",
            supabaseUrl: process.env.SUPABASE_URL ?? "",
            supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? "",
            tavilyApiKey: process.env.TAVILY_API_KEY ?? "",
            serperApiKey: process.env.SERPER_API_KEY ?? "",
        };
    });
    ipcMain.handle("config-set", (_e, patch: Partial<AegisConfig>) => {
        const existing = loadConfig() ?? {
            groqApiKey: process.env.GROQ_API_KEY ?? "",
            supabaseUrl: process.env.SUPABASE_URL ?? "",
            supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? "",
        };
        const updated: AegisConfig = {...existing, ...patch};
        saveConfig(updated);
        applyConfig(updated);
        groq = new Groq({apiKey: updated.groqApiKey});
    });

    ipcMain.handle("settings-get", () => currentSettings);
    ipcMain.handle("settings-set", (_e, patch: Partial<AppSettings>) => {
        const langChanged = patch.language && patch.language !== currentSettings.language;
        currentSettings = {...currentSettings, ...patch};
        // Auto-update TTS voice when language changes via settings panel
        if (langChanged && !patch.ttsVoice) {
            currentSettings.ttsVoice = LANG_DEFAULT_VOICE[currentSettings.language] ?? currentSettings.ttsVoice;
        }
        MODEL = currentSettings.model;
        setFullPcAccess(currentSettings.fullPcAccess ?? false);
        setDisabledTools(currentSettings.disabledTools ?? []);
        saveSettings(currentSettings);
        if (patch.autoLaunch !== undefined) {
            app.setLoginItemSettings({openAtLogin: patch.autoLaunch});
        }
        if (patch.apiServerEnabled !== undefined) {
            if (patch.apiServerEnabled) startApiServer();
            else stopApiServer();
        }
        // Sync settings-based watch conditions
        const alertMap: Record<string, number | null> = {
            cpu: currentSettings.alertCpuPct ?? null,
            ram: currentSettings.alertRamPct ?? null,
            gpu: currentSettings.alertGpuPct ?? null,
            disk: currentSettings.alertDiskPct ?? null,
        };
        for (const [metric, pct] of Object.entries(alertMap)) {
            if (pct !== null) {
                _watchConditions.set(metric, {threshold: pct, direction: "above"});
            } else {
                // Only remove if it was set via settings (not via watch_condition tool)
                const existing = _watchConditions.get(metric);
                if (existing) _watchConditions.delete(metric);
            }
        }
        if (langChanged && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("language-changed", {
                language: currentSettings.language,
                ttsVoice: currentSettings.ttsVoice,
            });
        }
        // Cloud sync (Faz 30.7) — ayar değişince debounce'lu buluta yaz (giriş + sync açıksa).
        scheduleCloudPush();
        // Şehir değiştiyse hava durumunu anında yenile ve renderer'a gönder.
        if (patch.weatherCity !== undefined && mainWindow && !mainWindow.isDestroyed()) {
            getWeather().then((w) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("weather-update", w);
                }
            }).catch(() => {});
        }
        return currentSettings;
    });

    ipcMain.handle("sessions-list", async () => getSessions(25).catch(() => []));
    ipcMain.handle("session-messages", async (_e, {sessionId}: {sessionId: string}) =>
        getSessionMessages(sessionId).catch(() => []),
    );

    ipcMain.on("win-minimize", () => mainWindow?.minimize());
    ipcMain.on("win-close", () => {
        if (currentSettings.minimizeToTray && tray) {
            mainWindow?.hide();
        } else {
            mainWindow?.close();
        }
    });
    ipcMain.on("win-fullscreen", () => {
        if (!mainWindow) return;
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
    });
    ipcMain.on("win-maximize", () => {
        if (!mainWindow) return;
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    });

    // Mobil API — ask handler: single-turn LLM call (no streaming)
    registerAskHandler(async (question) => {
        const profile = Object.keys(cachedProfile).length > 0
            ? `\nKullanıcı profili: ${Object.entries(cachedProfile).map(([k, v]) => `${k}=${v}`).join(", ")}`
            : "";
        const sysPrompt = getSystemPrompt(currentSettings.language, currentSettings.fullPcAccess ?? false) + profile + memorySummaries;
        const msgs = [{role: "system", content: sysPrompt}, {role: "user", content: question}];
        const result = await callAI(msgs as OAIMessage[]);
        return result.choices[0]?.message?.content ?? "(yanıt alınamadı)";
    });

    registerTtsHandler(async (text) => {
        const cfg = loadConfig();
        const elKey = cfg?.elevenlabsApiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
        if (currentSettings.ttsProvider === "elevenlabs" && elKey) {
            const voiceId = currentSettings.ttsVoice.startsWith("el:") ? currentSettings.ttsVoice.slice(3) : "cgSgspJ2msm6clMCkdW9";
            const speed = Math.max(0.7, Math.min(1.2, currentSettings.ttsRate ?? 1.0));
            const resp = await fetchWithTimeout(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: "POST",
                headers: {"xi-api-key": elKey, "Content-Type": "application/json"},
                body: JSON.stringify({text, model_id: "eleven_flash_v2_5", voice_settings: {stability: 0.5, similarity_boost: 0.75}, output_format: "mp3_44100_128", speed}),
            }, 30_000);
            if (!resp.ok) return null;
            return Buffer.from(await resp.arrayBuffer());
        }
        const {MsEdgeTTS: EdgeTTS, OUTPUT_FORMAT: FMT} = await import("msedge-tts") as typeof import("msedge-tts");
        const tts = new EdgeTTS();
        await tts.setMetadata(currentSettings.ttsVoice, FMT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const {audioStream} = await tts.toStream(text);
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
            audioStream.on("data", (d: Buffer) => chunks.push(d));
            audioStream.on("close", resolve);
            audioStream.on("error", reject);
        });
        return Buffer.concat(chunks);
    });

    if (currentSettings.apiServerEnabled) startApiServer();

    ipcMain.handle("api-info", () => getApiInfo());
    ipcMain.handle("api-server-toggle", (_e, enable: boolean) => {
        if (enable) return startApiServer();
        stopApiServer(); return "API sunucusu durduruldu.";
    });

    createWindow();
    setApiServerWindow(mainWindow);
    startTelemetry();
    createTray();
    app.setLoginItemSettings({openAtLogin: currentSettings.autoLaunch});

    if (shouldShowMorningSummary()) {
        markMorningSummaryShown();
        setTimeout(() => {
            const prompt = buildMorningSummaryPrompt();
            const msgs = [...sessionHistory, {role: "user", content: prompt}];
            saveMessage("user", prompt).catch(() => {});
            runAgent(msgs, `morning-${Date.now()}`, true).catch(() => {});
        }, 4000); // pencere yüklendikten 4sn sonra
    }

    registerSchedulerCallback((task) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("chat-stream-inject", {command: task.command});
        }
        if (ElectronNotification.isSupported()) {
            new ElectronNotification({title: "AEGIS · Zamanlanmış Görev", body: task.name}).show();
        }
    });
    startScheduler();

    // ── Auto-update (production only) ────────────────────────────────────────
    if (process.env.NODE_ENV !== "development") {
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;

        autoUpdater.on("update-available", (info) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("update-available", {version: info.version});
            }
        });

        autoUpdater.on("update-downloaded", () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("update-downloaded", {});
            }
        });

        autoUpdater.checkForUpdates().catch((e) => console.error("[updater]", e.message));
        setInterval(() => autoUpdater.checkForUpdates().catch((e) => console.error("[updater]", e.message)), 4 * 60 * 60 * 1000);
    }

    ipcMain.handle("update-install", () => autoUpdater.quitAndInstall());
}

let onboardingWin: BrowserWindow | null = null;

function createOnboardingWindow(): void {
    onboardingWin = new BrowserWindow({
        width: 560,
        height: 680,
        resizable: false,
        autoHideMenuBar: true,
        frame: false,
        backgroundColor: "#04070d",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
        onboardingWin.loadURL("http://127.0.0.1:5173?setup=1");
    } else {
        // loadFile query'si bazı Electron sürümlerinde location.search'e güvenilir geçmiyor;
        // hash kullan — renderer hem ?setup hem #setup'ı kontrol eder.
        onboardingWin.loadFile(path.join(__dirname, "../dist/index.html"), {hash: "setup"});
    }

    ipcMain.on("win-close", () => onboardingWin?.close());
    ipcMain.on("win-minimize", () => onboardingWin?.minimize());
}

// Onboarding penceresini kapatıp asıl uygulamayı başlatır.
async function startMainAppFromOnboarding(): Promise<void> {
    if (onboardingWin && !onboardingWin.isDestroyed()) onboardingWin.close();
    onboardingWin = null;
    mainWindow = null;
    await bootApp();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}

// Gelişmiş kurulum — kendi anahtarlarını kaydet (Supabase opsiyonel).
ipcMain.handle("setup-save", (_e, config: AegisConfig) => {
    saveConfig(config);
    applyConfig(config);
    groq = new Groq({apiKey: config.groqApiKey});
    // Not: uygulamayı burada başlatmıyoruz — onboarding akışı opsiyonel auth
    // adımına geçip sonra onboarding-complete çağırır.
});

// Onboarding tamamlandı (trial veya own) → uygulamayı başlat.
ipcMain.handle("onboarding-complete", async (_e, mode: "trial" | "own") => {
    currentSettings = {...currentSettings, aiMode: mode};
    saveSettings(currentSettings);
    await startMainAppFromOnboarding();
});

// Ana uygulamadan onboarding'i yeniden başlat (Ayarlar → Hesap).
ipcMain.handle("restart-onboarding", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
        mainWindow = null;
    }
    createOnboardingWindow();
});

// Deneme modu kullanıma hazır mı? (aiMode=trial + geçerli oturum)
async function trialReady(): Promise<boolean> {
    if (currentSettings.aiMode !== "trial") return false;
    try {
        const token = await getAccessToken();
        return !!token;
    } catch {
        return false;
    }
}

// ── Global hata yakalayıcılar — sessiz crash'leri logla ─────────────────────
process.on("unhandledRejection", (reason) => {
    console.error("[AEGIS] Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
    console.error("[AEGIS] Uncaught exception:", err.message, err.stack);
});

app.whenReady().then(async () => {
    // Gelişmiş mod hazır mı? (kendi Groq key'i config'te veya env'de)
    const ownReady =
        currentSettings.aiMode === "own" &&
        ((loadConfig()?.groqApiKey ?? "").trim() !== "" || !!process.env.GROQ_API_KEY);

    if (ownReady || await trialReady()) {
        await bootApp();
        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    } else {
        createOnboardingWindow();
    }
});

let isQuitting = false;
app.on("before-quit", (e) => {
    telIntervals.forEach(clearInterval);
    stopScheduler();
    stopApiServer();
    if (isQuitting || sessionHistory.length < 2) return;
    e.preventDefault();
    isQuitting = true;
    summarizeAndSave().finally(() => {
        sessionHistory = [];
        app.quit();
    });
});

app.on("window-all-closed", () => {
    // When tray is active: closing the window hides it, app stays alive
    if (process.platform !== "darwin" && !tray) app.quit();
});
