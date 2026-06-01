import {app, shell, BrowserWindow, ipcMain, desktopCapturer, screen, Notification as ElectronNotification, Tray, Menu, nativeImage} from "electron";
import * as zlib from "zlib";
import * as path from "path";
import * as os from "os";
import {exec} from "child_process";
import * as dotenv from "dotenv";
// @ts-ignore
import Groq from "groq-sdk";
import type {ChatCompletionMessageParam} from "groq-sdk/resources/chat/completions";
import {executeTool, registerQuitCallback, registerSetLanguageCallback, registerScreenshotCallback, registerAnalyzeScreenCallback, registerRemindCallback, registerNotificationCallback, registerPluginExecutors, extraSchemas, getAllToolSchemas, setPluginList, registerReloadPluginsCallback, checkWatchConditions, _watchConditions, registerAgentCallback, registerMacroRunCallback} from "./tools";
import {addMacroStep, isRecording} from "./macros";
import {getFactsForContext, recordToolUsage, shouldShowMorningSummary, markMorningSummaryShown, buildMorningSummaryPrompt} from "./memory-plus";
import {initVault} from "./vault";
import {startScheduler, stopScheduler, registerSchedulerCallback} from "./scheduler";
import {checkAutomations} from "./automations";
import {startApiServer, stopApiServer, registerAskHandler, registerTtsHandler, getApiInfo, broadcastFeedEvent} from "./api-server";
import {loadPlugins} from "./plugins";
import {getSessions, getSessionMessages} from "./db";
// @ts-ignore
import {MsEdgeTTS, OUTPUT_FORMAT} from "msedge-tts";
import {startSession, saveMessage, getUserProfile, saveSessionSummary, getRecentSummaries, getPendingNotes} from "./db";
import {loadSettings, saveSettings, type AppSettings} from "./settings";
import {loadConfig, saveConfig, applyConfig, type AegisConfig} from "./config";

// .env (dev ortamı) — varsa yükle, production'da config.json kullanılır
dotenv.config({path: path.join(__dirname, "../.env")});

// config.json varsa env'yi override et
const savedConfig = loadConfig();
if (savedConfig) applyConfig(savedConfig);

let groq = new Groq({apiKey: process.env.GROQ_API_KEY ?? ""});
let currentSettings = loadSettings();
let MODEL = currentSettings.model;

const SYSTEM_PROMPTS: Record<string, string> = {
    tr: `Sen AEGIS, kişisel AI asistanısın. Türkçe konuş, kısa ve net ol. Windows 11'de çalışıyorsun. PowerShell sözdizimi kullan. Uygulama açmak için Start-Process, kapatmak için Stop-Process kullan. Araçları gerektiğinde kullan, önce yap sonra özetle.

FORMAT KURALLARI:
- Düz metin yaz. Markdown kullanma: **, *, #, backtick, --- gibi sembolleri kullanma.
- Emoji kullanma.
- Kısa tut, 1-3 cümle yeterli.

GÜVENLİK KURALLARI (SADECE BUNLAR):
- Format-Volume, Clear-Disk, Initialize-Disk gibi disk yıkım komutlarını çalıştırma.
- shutdown /s, shutdown /r, Restart-Computer, Stop-Computer gibi sistemi kapatma/yeniden başlatma komutlarını çalıştırma.
- Remove-Item -Recurse ile tüm disk/sürücü silme işlemi yapma.
- Yukarıdaki listede OLMAYAN her şeyi (Stop-Process, taskkill, uygulama kapatma, dosya silme vb.) kullanıcı isterse DOĞRUDAN yap, onay isteme.`,

    en: `You are AEGIS, a personal AI assistant. Speak English, be short and precise. Running on Windows 11. Use PowerShell syntax. Use Start-Process to open apps, Stop-Process to close them. Use tools when needed — act first, summarize after.

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

function getSystemPrompt(lang: string): string {
    return SYSTEM_PROMPTS[lang] ?? SYSTEM_PROMPTS.tr;
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
        minWidth: 720,
        minHeight: 540,
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
        mainWindow.webContents.openDevTools({mode: "detach", activate: false});
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
async function getWeather(): Promise<object> {
    try {
        const geo = (await (await fetch("http://ip-api.com/json/?fields=city,country,lat,lon")).json()) as {city: string; country: string; lat: number; lon: number};
        const w = (await (
            await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code`)
        ).json()) as {current: {temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number}};
        const c = w.current;
        const CODES: Record<number, string> = {
            0: "açık",
            1: "az bulutlu",
            2: "parçalı bulutlu",
            3: "bulutlu",
            45: "sisli",
            48: "sisli",
            51: "çiseliyor",
            53: "çiseliyor",
            55: "çiseliyor",
            61: "yağmurlu",
            63: "yağmurlu",
            65: "kuvvetli yağmur",
            71: "karlı",
            73: "karlı",
            75: "yoğun kar",
            80: "sağanak",
            81: "sağanak",
            82: "kuvvetli sağanak",
            95: "gök gürültülü",
        };
        return {
            city: geo.city,
            country: geo.country,
            temp: Math.round(c.temperature_2m),
            feels: Math.round(c.apparent_temperature),
            humidity: c.relative_humidity_2m,
            desc: CODES[c.weather_code] ?? "—",
        };
    } catch (e) {
        return {error: (e as Error).message ?? String(e)};
    }
}

// ---- Multi-provider AI client ----
type OAIMessage = {role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string};
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

// Reasoning models don't support temperature or tools
const REASONING_MODELS = new Set(["o1", "o1-mini", "o3", "o3-mini", "o4-mini"]);

async function callAI(messages: OAIMessage[], onDelta?: (text: string) => void): Promise<OAICompletion> {
    const provider = currentSettings.aiProvider;
    const key = getProviderKey(provider);
    const temp = currentSettings.temperature ?? 0.7;
    const maxTok = currentSettings.maxTokens ?? 8192;
    const topP = currentSettings.topP ?? 1.0;
    const isReasoning = REASONING_MODELS.has(MODEL);

    const activeSchemas = getAllToolSchemas();

    // ── Groq (streaming) ──────────────────────────────────────────────────────
    if (provider === "groq") {
        const stream = await groq.chat.completions.create({
            model: MODEL,
            messages: messages as ChatCompletionMessageParam[],
            tools: activeSchemas,
            stream: true,
            temperature: temp,
            max_tokens: maxTok,
        });
        let fullContent = "";
        const tcMap = new Map<number, {id: string; name: string; args: string}>();
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
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
        return {choices: [{message: {
            content: fullContent || null,
            tool_calls: tcMap.size > 0
                ? [...tcMap.values()].map((tc) => ({id: tc.id, type: "function" as const, function: {name: tc.name, arguments: tc.args}}))
                : undefined,
        }}]};
    }

    // ── Anthropic ────────────────────────────────────────────────────────────
    if (provider === "anthropic") {
        const system = messages.find((m) => m.role === "system")?.content ?? "";
        const turns = messages.filter((m) => m.role !== "system");
        const body: Record<string, unknown> = {
            model: MODEL,
            max_tokens: maxTok,
            system,
            temperature: Math.min(temp, 1), // Anthropic max is 1
            messages: turns.map((m) => ({
                role: m.role === "tool" ? "user" : m.role,
                content: m.role === "tool"
                    ? [{type: "tool_result", tool_use_id: m.tool_call_id, content: m.content}]
                    : m.content ?? "",
            })),
            tools: activeSchemas.map((t) => ({
                name: t.function?.name,
                description: t.function?.description,
                input_schema: t.function?.parameters,
            })),
        };
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`);
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
                contents.push({role: "user", parts: [{text: m.content ?? ""}]});
            } else if (m.role === "assistant") {
                const parts: object[] = [];
                if (m.content) parts.push({text: m.content});
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

        const functionDeclarations = activeSchemas.map((s) => ({
            name: s.function?.name,
            description: s.function?.description,
            parameters: s.function?.parameters,
        }));

        const body: Record<string, unknown> = {
            contents,
            generationConfig: {temperature: temp, maxOutputTokens: maxTok, topP},
        };
        if (sysMsg?.content) body.systemInstruction = {parts: [{text: sysMsg.content}]};
        if (functionDeclarations.length > 0) body.tools = [{functionDeclarations}];

        const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
            {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)},
        );
        if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${await resp.text()}`);

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
            resp = await fetch(ollamaUrl, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    model: MODEL,
                    messages,
                    tools: activeSchemas,
                    stream: false,
                    temperature: temp,
                    options: {num_ctx: currentSettings.ollamaNumCtx ?? 4096},
                }),
            });
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
        const body: Record<string, unknown> = {
            model: MODEL, messages, tools: activeSchemas, stream: false,
            temperature: temp, max_tokens: maxTok,
        };
        const resp = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {"Authorization": `Bearer ${key}`, "Content-Type": "application/json"},
            body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error(`xAI ${resp.status}: ${await resp.text()}`);
        const result = await resp.json() as OAICompletion;
        const text = result.choices[0]?.message?.content;
        if (text) onDelta?.(text);
        return result;
    }

    // ── DeepSeek — OpenAI-compatible ─────────────────────────────────────────
    if (provider === "deepseek") {
        if (!key) throw new Error("DeepSeek API key eksik. Model ayarlarından girin.");
        const body: Record<string, unknown> = {
            model: MODEL, messages, tools: activeSchemas, stream: false,
            temperature: Math.min(temp, 1.5), max_tokens: maxTok,
        };
        const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {"Authorization": `Bearer ${key}`, "Content-Type": "application/json"},
            body: JSON.stringify(body),
        });
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
        tools: isReasoning ? undefined : activeSchemas,
        stream: false,
        max_tokens: maxTok,
    };
    if (!isReasoning) body.temperature = temp;
    if (topP !== 1.0) body.top_p = topP;
    if (provider === "openai" && currentSettings.presencePenalty !== 0) body.presence_penalty = currentSettings.presencePenalty;
    if (provider === "openai" && currentSettings.frequencyPenalty !== 0) body.frequency_penalty = currentSettings.frequencyPenalty;
    if (provider === "mistral" && currentSettings.mistralSafeMode) body.safe_prompt = true;

    const resp = await fetch(url, {
        method: "POST",
        headers: {"Authorization": `Bearer ${key}`, "Content-Type": "application/json"},
        body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`${provider} ${resp.status}: ${await resp.text()}`);
    const result = await resp.json() as OAICompletion;
    const text = result.choices[0]?.message?.content;
    if (text) onDelta?.(text);
    return result;
}

// ---- User profile cache (avoid Supabase round-trip on every message) ----
let cachedProfile: Record<string, string> = {};
let profileCachedAt = 0;

// ---- Agentic streaming chat ----
async function runAgent(history: {role: string; content: string}[], reqId: string): Promise<void> {
    // Track messages for end-of-session summarization
    sessionHistory = history.map((m) => ({role: m.role, content: m.content}));

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
    const systemContent = getSystemPrompt(currentSettings.language ?? "tr") + profileNote + memorySummaries + getFactsForContext();
    const messages: OAIMessage[] = [{role: "system", content: systemContent}, ...history];
    const send = (channel: string, payload: object) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, {reqId, ...payload});
        if (channel === "chat-delta") broadcastFeedEvent("delta", payload);
        else if (channel === "chat-done") broadcastFeedEvent("done", payload);
        else if (channel === "tool-event") broadcastFeedEvent("tool", payload);
    };

    for (let step = 0; step < 8; step++) {
        // Groq: tokens stream via onDelta. Other providers: full response returned.
        const completion = await callAI(messages, (text) => send("chat-delta", {text}));

        const msg = completion.choices[0]?.message;
        const content = msg?.content ?? "";
        const toolCalls = (msg?.tool_calls ?? []) as {id: string; type: "function"; function: {name: string; arguments: string}}[];

        // Non-Groq providers send the full content at once (Groq already streamed it)
        if (content && currentSettings.aiProvider !== "groq") send("chat-delta", {text: content});

        if (toolCalls.length === 0) {
            if (content) await saveMessage("assistant", content).catch(() => {});
            send("chat-done", {});
            return;
        }

        messages.push({role: "assistant", content: content || null, tool_calls: toolCalls} as OAIMessage);

        // Run all tool calls in parallel
        const toolResults = await Promise.all(
            toolCalls.map(async (call) => {
                const name = call.function.name;
                const argsJson = call.function.arguments || "{}";
                send("tool-event", {phase: "start", name, args: argsJson});
                recordToolUsage(name);
                const result = await executeTool(name, argsJson);
                send("tool-event", {phase: "done", name, result: String(result).slice(0, 400)});
                await saveMessage("tool", String(result).slice(0, 1000), name).catch(() => {});
                return {id: call.id, content: String(result)};
            })
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
            const sources = await desktopCapturer.getSources({
                types: ["screen"],
                thumbnailSize: {width, height},
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
        const visionGroq = new Groq({apiKey: process.env.GROQ_API_KEY ?? ""});
        const resp = await visionGroq.chat.completions.create({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {url: `data:image/png;base64,${base64}`},
                        },
                        {
                            type: "text",
                            text: prompt,
                        },
                    ] as any,
                },
            ],
            stream: false,
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
    await startSession().catch(() => {});

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
        runAgent(messages, reqId).catch(() => {});
    });

    registerMacroRunCallback(async (steps) => {
        for (const step of steps) {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("chat-stream-inject", {command: step});
            }
            await new Promise<void>((r) => setTimeout(r, 3000));
        }
    });

    ipcMain.on("chat-stream", async (_e, {messages, reqId}: {messages: {role: string; content: string}[]; reqId: string}) => {
        try {
            const last = messages[messages.length - 1];
            if (last?.role === "user") {
                await saveMessage("user", last.content).catch(() => {});
                if (isRecording()) addMacroStep(last.content);
            }
            await runAgent(messages, reqId);
        } catch (e) {
            const msg = (e as Error).message ?? String(e);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("chat-error", {reqId, message: msg});
                mainWindow.webContents.send("chat-delta", {reqId, text: `\n\n[Sistem hatası: ${msg}]`});
                mainWindow.webContents.send("chat-done", {reqId});
            }
        }
    });

    ipcMain.handle("weather", () => getWeather());

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
                const resp = await fetch(
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
        const sysPrompt = getSystemPrompt(currentSettings.language) + profile + memorySummaries;
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
            const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: "POST",
                headers: {"xi-api-key": elKey, "Content-Type": "application/json"},
                body: JSON.stringify({text, model_id: "eleven_flash_v2_5", voice_settings: {stability: 0.5, similarity_boost: 0.75}, output_format: "mp3_44100_128", speed}),
            });
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
    startTelemetry();
    createTray();
    app.setLoginItemSettings({openAtLogin: currentSettings.autoLaunch});

    if (shouldShowMorningSummary()) {
        markMorningSummaryShown();
        setTimeout(() => {
            const prompt = buildMorningSummaryPrompt();
            const msgs = [...sessionHistory, {role: "user", content: prompt}];
            saveMessage("user", prompt).catch(() => {});
            runAgent(msgs, `morning-${Date.now()}`).catch(() => {});
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
}

function createSetupWindow(): void {
    const win = new BrowserWindow({
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
        win.loadURL("http://127.0.0.1:5173?setup=1");
    } else {
        win.loadFile(path.join(__dirname, "../dist/index.html"), {query: {setup: "1"}});
    }

    // Setup form submit
    ipcMain.handleOnce("setup-save", async (_e, config: AegisConfig) => {
        saveConfig(config);
        applyConfig(config);
        groq = new Groq({apiKey: config.groqApiKey});
        win.close();
        mainWindow = null;
        await bootApp();
        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    ipcMain.on("win-close", () => win.close());
    ipcMain.on("win-minimize", () => win.minimize());
}

app.whenReady().then(async () => {
    const hasConfig =
        (loadConfig() !== null) ||
        (!!process.env.GROQ_API_KEY && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY);

    if (!hasConfig) {
        createSetupWindow();
    } else {
        await bootApp();
        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
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
