import {app, shell, BrowserWindow, ipcMain, desktopCapturer, screen, Notification as ElectronNotification, Tray, Menu, nativeImage, dialog, safeStorage} from "electron";
import {TRAY_ICON_16_B64} from "./tray-icon-data";
import * as path from "path";
import * as os from "os";
import {exec} from "child_process";
// @ts-ignore
import Groq from "groq-sdk";
import {executeTool, initToolHost, registerPluginExecutors, extraSchemas, getAllToolSchemas, setPluginList, checkWatchConditions, _watchConditions, setFullPcAccess, setDisabledTools} from "./tools";
import {registerLLMCallback} from "./model-router";
import {getAccessToken} from "./auth";
import {AEGIS_GITHUB_TOKEN} from "./aegis-config";

import {pushToCloud, pullFromCloud} from "./cloud-sync";
import {addMacroStep, isRecording} from "./macros";
import {recordingName as routineRecordingName} from "./routines";
import {getFactsForContext, shouldShowMorningSummary, markMorningSummaryShown, buildMorningSummaryPrompt, autoLearnFromMessage, getProactiveSuggestion} from "./memory-plus";
import {initVault} from "./vault";
import {startScheduler, stopScheduler, registerSchedulerCallback} from "./scheduler";
import {checkAutomations} from "./automations";
import {startApiServer, stopApiServer, registerAskHandler, registerTtsHandler, broadcastFeedEvent, setApiServerWindow} from "./api-server";
import {loadPlugins} from "./plugins";

import {startSession, saveMessage, getUserProfile, saveSessionSummary, getRecentSummaries, getPendingNotes} from "./db";
import {loadSettings, saveSettings, type AppSettings} from "./settings";
import {loadConfig, saveConfig, applyConfig, type AegisConfig} from "./config";
import {initSecretStorage} from "./secret-storage";
import {getCorruptedFiles} from "./corrupted-file-tracker";
import {autoUpdater} from "electron-updater";
import {fetchWithTimeout, isTimeoutError, timeoutMsg} from "./fetch-utils";
import {bt, setBackendLang} from "./backend-i18n";
import {generateTts, warmupKokoro, setKokoroModelDir} from "./tts";
import {callAI, callProxy, extractTextContent, getProviderKey, friendlyHttpError, type MsgPart, type OAIMessage} from "./ai-client";
import {stmClear, stmBuildPromptBlock} from "./short-term-memory";



import {taintSource, clearTaint} from "./taint";
import {buildPlanPrompt} from "./goal-executor";

import {runAgentLoop, type ApprovalReason} from "./agent-loop";
import {reportAiError, flushReportQueue, setReportAppVersion} from "./error-report";
import {getSystemPrompt} from "./prompts";
import {registerMediaIpc} from "./ipc/media-ipc";
import {registerAuthIpc} from "./ipc/auth-ipc";
import {registerWindowIpc} from "./ipc/window-ipc";
import {registerDataIpc} from "./ipc/data-ipc";
import type {ChatCompletionTool} from "groq-sdk/resources/chat/completions";

// .env (dev environment) — load if present; dotenv isn't bundled in production
try { require("dotenv").config({path: path.join(__dirname, "../.env")}); } catch { /* production build */ }

// Try to wire up DPAPI encryption before the first read — safeStorage is backed by
// Windows DPAPI and is available without waiting for app.whenReady() in practice;
// if it ever isn't, config.ts/settings.ts fall back to treating values as plaintext.
try { initSecretStorage(safeStorage); } catch { /* safeStorage not ready yet — falls back to plaintext */ }

// config.json varsa env'yi override et
const savedConfig = loadConfig();
if (savedConfig) applyConfig(savedConfig);

let groq = new Groq({apiKey: process.env.GROQ_API_KEY ?? ""});
let currentSettings = loadSettings();
setBackendLang(currentSettings.language);
// If config.json/settings.json/facts.json/etc. existed but failed to parse, the
// loader already fell back to defaults and backed up the broken file as ".bak" —
// but the user would otherwise never learn their API keys/data just vanished.
const _corruptedFilesAtStartup = getCorruptedFiles();
let MODEL = currentSettings.model;
setFullPcAccess(currentSettings.fullPcAccess ?? false);
setDisabledTools(currentSettings.disabledTools ?? []);

// Cloud sync debounce — batch consecutive settings changes into a single push (3s).
let _cloudPushTimer: NodeJS.Timeout | null = null;
let _cloudPushFailureNotified = false;
function scheduleCloudPush(): void {
    if (_cloudPushTimer) clearTimeout(_cloudPushTimer);
    _cloudPushTimer = setTimeout(() => {
        pushToCloud().then((res) => {
            // "sync disabled" / "not signed in" are expected, silent no-ops.
            // A real error (network/server) means the change never reached the
            // cloud — tell the user once instead of failing invisibly forever.
            if (!res.ok && res.error !== "sync disabled" && res.error !== "not signed in" && !_cloudPushFailureNotified) {
                _cloudPushFailureNotified = true;
                sendToRenderer("system-notice", {
                    message: bt("noticeCloudSyncFail", {error: res.error ?? ""}),
                });
            } else if (res.ok) {
                _cloudPushFailureNotified = false;
            }
        }).catch((e) => console.error("[cloud-push]", e.message));
    }, 3000);
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function sendToRenderer(channel: string, payload: object = {}): void {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(channel, payload);
}

// System tray icon: the AEGIS mark, embedded as base64 (no external files).
// Regenerate with `node scripts/make-icons.mjs` when build/icon.svg changes.
function buildTrayMenu(): Menu {
    return Menu.buildFromTemplate([
        {
            label: bt("trayShow"),
            click: () => {
                if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
            },
        },
        {
            label: bt("trayMic"),
            click: () => {
                if (mainWindow) {
                    mainWindow.show(); mainWindow.focus();
                    mainWindow.webContents.send("tray-mic-toggle");
                }
            },
        },
        {type: "separator"},
        {
            label: bt("trayExit"),
            click: () => { isQuitting = true; app.quit(); },
        },
    ]);
}

function createTray(): void {
    if (tray) return;
    const icon = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON_16_B64, "base64"));
    tray = new Tray(icon);
    tray.setToolTip("AEGIS");
    tray.setContextMenu(buildTrayMenu());
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
        void shell.openExternal(url);
        return {action: "deny"};
    });

    // Surface "your data was reset" once, after the renderer can show it — otherwise
    // a corrupted ~/.aegis/*.json silently resets to defaults with no trace.
    if (_corruptedFilesAtStartup.length > 0) {
        mainWindow.webContents.once("did-finish-load", () => {
            sendToRenderer("system-notice", {
                message: bt("noticeDataReset", {files: _corruptedFilesAtStartup.join(", ")}),
            });
        });
    }

    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
        void mainWindow.loadURL("http://127.0.0.1:5173");
        // mainWindow.webContents.openDevTools({mode: "detach", activate: false});
    } else {
        void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
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

// CPU model name — once at startup
let cpuModel = os.cpus()[0]?.model?.trim() ?? "CPU";
// Truncate after @ (freq info) for display
const atIdx = cpuModel.indexOf(" @");
if (atIdx > 0) cpuModel = cpuModel.slice(0, atIdx).trim();

// Disk — all drives
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

// Network — adapter name + up/down
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

// CPU temperature + frequency
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

// Fan speeds (rpm) — only available if MSAcpi_FanSpeed is supported
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

// Top 8 processes — instantaneous CPU% + RAM MB + PID
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

// Active window
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

// System info — model, BIOS, board (once at startup)
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

        // Threshold alerts + conditional automation — checked every 1.5s
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
                    sendToRenderer("reminder-fired", {message: msg});
                    if (ElectronNotification.isSupported()) {
                        new ElectronNotification({title: "AEGIS · Threshold Alert", body: msg}).show();
                    }
                },
            );
        }

        checkAutomations(liveMetrics, (action) => {
            sendToRenderer("chat-stream-inject", {command: action});
        });
    }, 1500));
}

// ---- Weather ----
const WEATHER_CODES: Record<number, string> = {
    0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "cloudy",
    45: "foggy", 48: "foggy",
    51: "drizzle", 53: "drizzle", 55: "drizzle",
    61: "rainy", 63: "rainy", 65: "heavy rain",
    71: "snowy", 73: "snowy", 75: "heavy snow",
    80: "showers", 81: "showers", 82: "heavy showers",
    95: "thunderstorm",
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
            if (!geo.results?.length) return {error: `"${manualCity}" not found`};
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


// ---- User profile cache (avoid Supabase round-trip on every message) ----
let cachedProfile: Record<string, string> = {};
let profileCachedAt = 0;

// ---- Agentic streaming chat ----
// Phase 54 — Destructive action approval dialog. Native modal (not renderer-dependent).
// Return: "allow" (once), "always" (permanent permission), "deny" (cancel).
async function askDestructiveApproval(tool: string, argsJson: string, reason: ApprovalReason = "risk"): Promise<"allow" | "always" | "deny"> {
    // If Full PC Access is on, the user already granted full authority — skip asking.
    // EXCEPT for forced reasons: taint (audit A3 — the model may be following
    // injected instructions) and budget (UX 18.1 — too many destructive steps in
    // one run). Those always require a human click.
    if (currentSettings.fullPcAccess && reason === "risk") return "allow";
    const lang = currentSettings.language ?? "tr";
    const detailArgs = argsJson && argsJson !== "{}" ? `\n\n${argsJson.slice(0, 300)}` : "";
    const src = taintSource();
    const taintNote =
        reason === "taint"
            ? (lang === "tr"
                ? `\n\nBu konuşma dış kaynaklı içerik barındırıyor (${src ?? "web içeriği"}) — bu tür içerik gizli talimat içerebileceği için onayınız gerekiyor.`
                : `\n\nThis conversation contains content from an external source (${src ?? "web content"}) — such content can carry hidden instructions, so your approval is required.`)
        : reason === "budget"
            ? (lang === "tr"
                ? "\n\nBu görevde art arda birden çok yıkıcı işlem çalıştı — güvenlik için bundan sonraki her yıkıcı adım tek tek onayınızı gerektiriyor."
                : "\n\nSeveral destructive actions have already run in this task — for safety, each further destructive step now requires your approval.")
        : "";
    const L = lang === "tr"
        ? {title: "Yıkıcı eylem onayı", msg: `AEGIS geri alınamaz olabilecek bir işlem yapmak istiyor:\n\n${tool}${detailArgs}${taintNote}`, buttons: ["İptal", "İzin ver", "Her zaman izin ver"]}
        : {title: "Destructive action", msg: `AEGIS wants to run a potentially irreversible action:\n\n${tool}${detailArgs}${taintNote}`, buttons: ["Cancel", "Allow once", "Always allow"]};
    try {
        const {response} = await dialog.showMessageBox(mainWindow ?? undefined as never, {
            type: "warning",
            title: L.title,
            message: L.msg,
            buttons: L.buttons,
            defaultId: 0,   // safe default: Cancel
            cancelId: 0,
            noLink: true,
        });
        if (response === 2) return "always";
        if (response === 1) return "allow";
        return "deny";
    } catch {
        // If the dialog couldn't open (e.g. no window), stay on the safe side: deny.
        return "deny";
    }
}

async function runAgent(history: {role: string; content: string | MsgPart[]}[], reqId: string, isSubAgent = false): Promise<void> {
    // Only update sessionHistory for the main chat flow, not sub-agent calls (prevents race on parallel agents)
    if (!isSubAgent) {
        sessionHistory = history.map((m) => ({role: m.role, content: extractTextContent(m.content)}));
        // Phase 57 — adaptive memory: silently learn facts from the last user message
        // ("my name is X", "I use Python", "I like coffee"). Contradiction-resolver (updates the old fact).
        const lastUser = [...history].reverse().find((m) => m.role === "user");
        if (lastUser) {
            try { autoLearnFromMessage(extractTextContent(lastUser.content)); }
            catch (e) { console.error("[autoLearn]", (e as Error).message); }
        }
    }

    // Refresh profile at most once per minute
    if (Date.now() - profileCachedAt > 60_000) {
        cachedProfile = await getUserProfile().catch(() => ({}));
        profileCachedAt = Date.now();
    }
    const profileNote =
        Object.keys(cachedProfile).length > 0 ?
            `\nUser profile: ${Object.entries(cachedProfile)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}`
        :   "";
    const routineNote = routineRecordingName()
        ? `\n\nROUTINE RECORDING ACTIVE: "${routineRecordingName()}". Apply the user's commands with tools as normal — your actions are being recorded automatically. If the user says "stop/end recording", call routine_record_stop.`
        : "";
    const systemContent = getSystemPrompt(currentSettings.language ?? "tr", currentSettings.fullPcAccess ?? false) + profileNote + memorySummaries + getFactsForContext() + stmBuildPromptBlock() + routineNote;
    const send = (channel: string, payload: object) => {
        sendToRenderer(channel, {reqId, ...payload});
        if (channel === "chat-delta") broadcastFeedEvent("delta", payload);
        else if (channel === "chat-done") broadcastFeedEvent("done", payload);
        else if (channel === "tool-event") broadcastFeedEvent("tool", payload);
    };

    // The loop itself lives in agent-loop.ts (audit B2) — main.ts only binds the
    // environment: provider call, tool schemas, approval dialog, persistence, UI.
    await runAgentLoop(history, {
        send,
        callModel: (messages: OAIMessage[], onDelta: (t: string) => void, tools: ChatCompletionTool[]) => callAI(messages, onDelta, tools, currentSettings, MODEL, groq),
        getToolSchemas: (ctx: string) => getAllToolSchemas(currentSettings.aiProvider, ctx),
        executeTool,
        askApproval: askDestructiveApproval,
        saveMessage,
        systemContent,
        explainMode: !!currentSettings.explainMode,
        isSubAgent,
    });
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
    // Summarization requires a local Groq key; if missing (e.g. trial mode — key lives
    // on the server) skip silently, don't produce a 401.
    if (!(process.env.GROQ_API_KEY ?? "").trim()) return;
    try {
        const turns = sessionHistory
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => `${m.role === "user" ? "User" : "AEGIS"}: ${m.content}`)
            .join("\n");
        const res = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {role: "system", content: "Summarize the following conversation in 3-5 sentences. Write in Turkish. Write only the summary, nothing else."},
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
    return `${plugins.length} plugins loaded.`;
}

async function bootApp(): Promise<void> {
    const {safeStorage} = await import("electron");
    initVault(safeStorage);

    // Cloud sync (Phase 30.7) — if signed in + sync enabled, pull settings/keys from the cloud on startup.
    try {
        const res = await pullFromCloud();
        if (res.applied) {
            currentSettings = loadSettings();
            setBackendLang(currentSettings.language);
            MODEL = currentSettings.model;
            setFullPcAccess(currentSettings.fullPcAccess ?? false);
            setDisabledTools(currentSettings.disabledTools ?? []);
        }
    } catch { /* sync is optional — failure doesn't stop the app */ }

    activatePlugins();

    // Audit C3 — executor host hooks are wired in ONE typed initToolHost call
    // further below; the two larger implementations are defined here first.
    const captureScreen = async (): Promise<{base64: string; width: number; height: number} | {error: string}> => {
        try {
            // Visible notice every time the screen is captured — without this, a user
            // who enabled computer-use once and forgot has no way to know AEGIS just
            // looked at whatever was on screen (passwords, card numbers, etc).
            sendToRenderer("system-notice", {message: bt("noticeScreenCaptured")});
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
            if (!source) return {error: "Screen source not found."};
            const base64 = source.thumbnail.toDataURL().replace(/^data:image\/png;base64,/, "");
            return {base64, width, height};
        } catch (e) {
            return {error: (e as Error).message ?? String(e)};
        }
    };

    // Bug-report screenshot: same capture path (window hidden, user notified),
    // but returned as a compressed JPEG data URL sized for a DB row, not vision.
    ipcMain.handle("report-capture", async (): Promise<{ok: boolean; dataUrl?: string; error?: string}> => {
        const shot = await captureScreen();
        if ("error" in shot) return {ok: false, error: shot.error};
        const img = nativeImage.createFromDataURL(`data:image/png;base64,${shot.base64}`);
        const jpeg = img.toJPEG(70);
        return {ok: true, dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`};
    });

    const analyzeScreenWithModel = async (base64: string, prompt: string): Promise<string> => {
        const provider = currentSettings.aiProvider;
        const key = getProviderKey(provider, currentSettings);
        const imgUrl = `data:image/png;base64,${base64}`;

        // ── Trial mode (proxy) — if there's no own Groq key, use your proxy ──
        const ownGroqKey = (currentSettings.providerKeys?.groq ?? "").trim();
        if (currentSettings.aiMode === "trial" && !ownGroqKey) {
            const completion = await callProxy(
                [{role: "user", content: [
                    {type: "image_url", image_url: {url: imgUrl}},
                    {type: "text", text: prompt},
                ]} as OAIMessage],
                [], // no tools for vision
                {model: "meta-llama/llama-4-scout-17b-16e-instruct", temperature: 0.7, max_tokens: 1024},
            );
            return completion.choices[0]?.message?.content ?? "(no response received)";
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
            return data.content.find((b) => b.type === "text")?.text ?? "(no response received)";
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
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
                {method: "POST", headers: {"Content-Type": "application/json", "x-goog-api-key": key}, body: JSON.stringify(body)},
                60_000,
            );
            if (!resp.ok) throw new Error(await friendlyHttpError("Gemini vision", resp));
            const data = await resp.json() as {candidates: {content: {parts: {text?: string}[]}}[]};
            return data.candidates[0]?.content?.parts?.find((p) => p.text)?.text ?? "(no response received)";
        }

        // ── OpenAI / xAI / deepseek / mistral (OpenAI-compat vision) ──
        if ((provider === "openai" || provider === "xai" || provider === "deepseek" || provider === "mistral") && key) {
            const endpoints: Record<string, string> = {
                openai:   "https://api.openai.com/v1/chat/completions",
                xai:      "https://api.x.ai/v1/chat/completions",
                deepseek: "https://api.deepseek.com/v1/chat/completions",
                mistral:  "https://api.mistral.ai/v1/chat/completions",
            };
            // July 2026: gpt-4o-mini / grok-2-vision / pixtral-12b are retired —
            // current flagship lines all take image input directly.
            const visionModel: Record<string, string> = {
                openai:   MODEL.startsWith("gpt") ? MODEL : "gpt-5-mini",
                xai:      "grok-4.3",
                deepseek: MODEL,
                mistral:  "mistral-small-2603",
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
            return data.choices[0]?.message?.content ?? "(no response received)";
        }

        // ── Groq (fallback + when groq is selected) ──
        const groqKey = getProviderKey("groq", currentSettings) || process.env.GROQ_API_KEY || "";
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
        return (resp as any).choices[0]?.message?.content ?? "(no response received)";
    };

    // One typed wiring point (audit C3): a missing field here is a COMPILE error,
    // unlike the old registerXCallback calls where forgetting one failed at runtime.
    initToolHost({
        quit: () => app.quit(),
        setLanguage: (lang) => {
            const voice = LANG_DEFAULT_VOICE[lang] ?? LANG_DEFAULT_VOICE.tr;
            currentSettings = {...currentSettings, language: lang as AppSettings["language"], ttsVoice: voice};
            saveSettings(currentSettings);
            sendToRenderer("language-changed", {language: lang, ttsVoice: voice});
        },
        screenshot: captureScreen,
        analyzeScreen: analyzeScreenWithModel,
        remind: (message) => sendToRenderer("reminder-fired", {message}),
        notify: (title, body) => {
            if (ElectronNotification.isSupported()) {
                new ElectronNotification({title, body}).show();
            }
        },
        runAgent: (goal, maxSteps) => {
            const reqId = `agent-${Date.now()}`;
            // Phase 56 — plan-based agent prompt (plan → execute → verify → stop when stuck).
            const agentPrompt = buildPlanPrompt(goal, maxSteps);
            const messages = [...sessionHistory, {role: "user", content: agentPrompt}];
            saveMessage("user", agentPrompt).catch(() => {});
            runAgent(messages, reqId, true).catch(() => {});
        },
        runMacro: async (steps) => {
            for (const step of steps) {
                sendToRenderer("chat-stream-inject", {command: step});
                await new Promise<void>((r) => setTimeout(r, 3000));
            }
        },
        reloadPlugins: async () => activatePlugins(),
        todoUpdate: (steps) => sendToRenderer("todo-update", {steps}),
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
            memorySummaries = `\n\nPREVIOUS SESSIONS (memory):\n${lines}`;
        }
        const dueNotes = notes.filter((n) => n.remind_at && new Date(n.remind_at) <= new Date());
        if (dueNotes.length > 0) {
            const noteLines = dueNotes.map((n) => `- [${n.id.slice(0, 8)}] ${n.content}`).join("\n");
            memorySummaries += `\n\nPENDING REMINDERS (notify user):\n${noteLines}`;
        }
    } catch {}

    // Single-shot LLM call for pipeline_run / model_compare (no tools, no streaming).
    registerLLMCallback(async (prompt, model) => {
        // "provider:modelId" → strip the prefix for Groq models; otherwise use the active MODEL.
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
        try {
            const last = messages[messages.length - 1];
            if (last?.role === "user") {
                const textForSave = typeof last.content === "string" ? last.content : extractTextContent(last.content);
                await saveMessage("user", textForSave).catch((e) => console.error("[saveMessage]", e.message));
                if (isRecording()) addMacroStep(textForSave);
            }
            await runAgent(messages, reqId);
        } catch (e) {
            let msg = (e as Error).message ?? String(e);
            if (isTimeoutError(e)) {
                msg = timeoutMsg();
            } else if (/fetch failed|ENOTFOUND|ECONNREFUSED|network|getaddrinfo/i.test(msg)) {
                msg = bt("netDown");
            }
            sendToRenderer("chat-error", {reqId, message: msg});
        } finally {
            // chat-done must always be sent — resets the streaming state
            sendToRenderer("chat-done", {reqId});
        }
    });

    // Kokoro model weights land in the WRITABLE userData folder (asar/node_modules
    // are read-only). The kokoro-js library is bundled into the build; at runtime ONLY
    // the ~900MB ONNX weights are downloaded. NO cmd.exe/bun spawn.
    setKokoroModelDir(path.join(app.getPath("userData"), "kokoro-models"));

    // IPC handlers live in electron/ipc/* (audit B3) — main.ts only binds state.
    registerMediaIpc({
        getSettings: () => currentSettings,
        getGroq: () => groq,
        sendToRenderer,
    });
    registerDataIpc({
        getSettings: () => currentSettings,
        getWeather,
        onConfigApplied: (updated) => { groq = new Groq({apiKey: updated.groqApiKey}); },
        resetSession: async () => {
            await summarizeAndSave().catch(() => {});
            sessionHistory = [];
            stmClear();
            clearTaint(); // A3 — external content left the context with the session
            await startSession().catch(() => {});
        },
    });

    // Mobil API — ask handler: single-turn LLM call (no streaming)
    registerAskHandler(async (question) => {
        const profile = Object.keys(cachedProfile).length > 0
            ? `\nUser profile: ${Object.entries(cachedProfile).map(([k, v]) => `${k}=${v}`).join(", ")}`
            : "";
        const sysPrompt = getSystemPrompt(currentSettings.language, currentSettings.fullPcAccess ?? false) + profile + memorySummaries;
        const msgs = [{role: "system", content: sysPrompt}, {role: "user", content: question}];
        const result = await callAI(msgs as OAIMessage[], undefined, undefined, currentSettings, MODEL, groq);
        return result.choices[0]?.message?.content ?? "(no response received)";
    });

    registerTtsHandler(async (text) => {
        const cfg = loadConfig();
        return generateTts(text, {
            provider: currentSettings.ttsProvider,
            voice: currentSettings.ttsVoice,
            rate: currentSettings.ttsRate ?? 1.0,
            elevenlabsKey: cfg?.elevenlabsApiKey ?? process.env.ELEVENLABS_API_KEY ?? "",
        });
    });

    if (currentSettings.apiServerEnabled) startApiServer();

    createWindow();
    setApiServerWindow(mainWindow);
    startTelemetry();
    createTray();
    if (currentSettings.ttsProvider === "kokoro") warmupKokoro(currentSettings.ttsVoice);
    app.setLoginItemSettings({openAtLogin: currentSettings.autoLaunch});

    if (shouldShowMorningSummary()) {
        markMorningSummaryShown();
        setTimeout(() => {
            let prompt = buildMorningSummaryPrompt();
            // Phase 61 — opt-in proactive suggestion: if the user enabled it, add detected
            // temporal habit patterns to the morning summary (off → null → never added, no spam).
            const proactive = getProactiveSuggestion(currentSettings.proactiveSuggestions ?? false);
            if (proactive) {
                prompt += `\n\nI also noticed these habit patterns of the user; mention them naturally and ASK whether they'd like to automate them (don't push):\n${proactive}`;
            }
            const msgs = [...sessionHistory, {role: "user", content: prompt}];
            saveMessage("user", prompt).catch(() => {});
            runAgent(msgs, `morning-${Date.now()}`, true).catch(() => {});
        }, 4000); // 4s after the window loads
    }

    registerSchedulerCallback((task) => {
        sendToRenderer("chat-stream-inject", {command: task.command});
        if (ElectronNotification.isSupported()) {
            new ElectronNotification({title: "AEGIS · Scheduled Task", body: task.name}).show();
        }
    });
    startScheduler();

    // ── Auto-update (production only) ────────────────────────────────────────
    if (process.env.NODE_ENV !== "development") {
        // `private: true` + an empty token makes every GitHub API call fail (401/404)
        // with no visible error — which is exactly what happens for a normal public
        // user, since AEGIS_GITHUB_TOKEN is only set in CI for maintainers testing
        // against a not-yet-public repo. Only request private-repo auth when a token
        // is actually present; otherwise hit the (now public) repo with no auth at all.
        autoUpdater.setFeedURL({
            provider: "github",
            owner: "Albis0",
            repo: "AEGIS",
            ...(AEGIS_GITHUB_TOKEN ? {private: true, token: AEGIS_GITHUB_TOKEN} : {}),
        });
        // DOWNLOAD IS FULLY MANUAL. Automatic check ONLY gives a "new version available"
        // notification; download ONLY starts when the user clicks DOWNLOAD (update-download IPC).
        autoUpdater.autoDownload = false;          // checkForUpdates shouldn't trigger a download
        autoUpdater.autoInstallOnAppQuit = false;  // don't install silently on quit — let the user decide

        autoUpdater.on("update-available", (info) => {
            // Notification only. Do NOT call downloadUpdate() here.
            sendToRenderer("update-available", {version: info.version});
        });

        autoUpdater.on("download-progress", (prog) => {
            sendToRenderer("update-progress", {
                percent: Math.round(prog.percent),
                transferred: prog.transferred,
                total: prog.total,
                bytesPerSecond: prog.bytesPerSecond,
            });
        });

        autoUpdater.on("update-downloaded", (info) => {
            console.log("[updater] update-downloaded", info?.version);
            sendToRenderer("update-downloaded", {version: info?.version});
        });

        // CRITICAL: without an error event, the download would silently hang and
        // "downloading…" would stay forever. Now every error is forwarded to the renderer + logged.
        autoUpdater.on("error", (err) => {
            const msg = (err as Error)?.message ?? String(err);
            console.error("[updater] error:", msg);
            sendToRenderer("update-error", {message: msg});
        });
        autoUpdater.on("checking-for-update", () => console.log("[updater] checking…"));
        autoUpdater.on("update-not-available", () => console.log("[updater] up to date"));

        // Check for notification purposes only — autoDownload=false so it won't download.
        autoUpdater.checkForUpdates().catch((e) => { console.error("[updater] check:", e.message); sendToRenderer("update-error", {message: e.message}); });
        setInterval(() => autoUpdater.checkForUpdates().catch((e) => console.error("[updater]", e.message)), 4 * 60 * 60 * 1000);
    }

    registerWindowIpc({
        getMainWindow: () => mainWindow,
        getTray: () => tray,
        getSettings: () => currentSettings,
        autoUpdater,
        sendToRenderer,
    });
}

let onboardingWin: BrowserWindow | null = null;

function createOnboardingWindow(): void {
    onboardingWin = new BrowserWindow({
        width: 480,
        height: 720,
        resizable: false,
        autoHideMenuBar: true,
        frame: false,
        backgroundColor: "#0a0e17",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
        void onboardingWin.loadURL("http://127.0.0.1:5173?setup=1");
    } else {
        // loadFile's query string doesn't reliably reach location.search on some Electron
        // versions; use a hash instead — the renderer checks both ?setup and #setup.
        void onboardingWin.loadFile(path.join(__dirname, "../dist/index.html"), {hash: "setup"});
    }

    ipcMain.on("win-close", () => onboardingWin?.close());
    ipcMain.on("win-minimize", () => onboardingWin?.minimize());
}

// Closes the onboarding window and starts the actual app.
async function startMainAppFromOnboarding(): Promise<void> {
    // Boot (creates the main window + tray) BEFORE closing the onboarding window:
    // closing first leaves zero windows and no tray, so "window-all-closed"
    // quits the app mid-transition (raced in packaged builds).
    const oldWin = onboardingWin;
    onboardingWin = null;
    mainWindow = null;
    await bootApp();
    if (oldWin && !oldWin.isDestroyed()) oldWin.close();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}

// Advanced setup — save own keys (Supabase optional).
ipcMain.handle("setup-save", (_e, config: AegisConfig) => {
    saveConfig(config);
    applyConfig(config);
    groq = new Groq({apiKey: config.groqApiKey});
    // Note: we don't start the app here — the onboarding flow moves on to the
    // optional auth step and then calls onboarding-complete.
});

// Onboarding complete (trial or own) → start the app.
ipcMain.handle("onboarding-complete", async (_e, mode: "trial" | "own") => {
    currentSettings = {...currentSettings, aiMode: mode};
    saveSettings(currentSettings);
    await startMainAppFromOnboarding();
});

// Restart onboarding from the main app (Settings → Account).
ipcMain.handle("restart-onboarding", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
        mainWindow = null;
    }
    createOnboardingWindow();
});

// Is trial mode ready to use? (aiMode=trial + valid session)
async function trialReady(): Promise<boolean> {
    if (currentSettings.aiMode !== "trial") return false;
    try {
        const token = await getAccessToken();
        return !!token;
    } catch {
        return false;
    }
}

ipcMain.handle("get-app-version", () => app.getVersion());

// ── Auth & Spotify IPC — also needed during onboarding ──────────────────────
// the trial-auth step calls sign-in/sign-up, the spotify-connect step calls spotify-authorize;
// bootApp hasn't run yet at that point. Registered at module scope for that reason.
registerAuthIpc();

// ── Settings IPC — must also be accessible before onboarding ────────────────
// These handlers live here, not inside bootApp(); the onboarding flow picks a
// language and calls settingsSet, and bootApp hasn't run yet at that point.
// Full PC Access removes the per-action approval dialog entirely (see
// askDestructiveApproval above) — if the user enables it to try one thing and
// forgets, every future destructive tool call runs unattended. Auto-revoke it
// after 30 minutes of being on so a forgotten toggle can't stay open forever.
const FULL_PC_ACCESS_TIMEOUT_MS = 30 * 60 * 1000;
let _fullPcAccessTimer: NodeJS.Timeout | null = null;
function scheduleFullPcAccessExpiry(): void {
    if (_fullPcAccessTimer) clearTimeout(_fullPcAccessTimer);
    if (!currentSettings.fullPcAccess) return;
    _fullPcAccessTimer = setTimeout(() => {
        currentSettings = {...currentSettings, fullPcAccess: false};
        setFullPcAccess(false);
        saveSettings(currentSettings);
        sendToRenderer("system-notice", {
            message: bt("noticeFullAccessOff"),
        });
    }, FULL_PC_ACCESS_TIMEOUT_MS);
}

scheduleFullPcAccessExpiry(); // in case it was already on from a previous session

ipcMain.handle("settings-get", () => currentSettings);
ipcMain.handle("settings-set", (_e, patch: Partial<AppSettings>) => {
    const langChanged = patch.language && patch.language !== currentSettings.language;
    currentSettings = {...currentSettings, ...patch};
    if (langChanged && !patch.ttsVoice) {
        currentSettings.ttsVoice = LANG_DEFAULT_VOICE[currentSettings.language] ?? currentSettings.ttsVoice;
    }
    if (langChanged) {
        setBackendLang(currentSettings.language);
        if (tray) tray.setContextMenu(buildTrayMenu());
    }
    MODEL = currentSettings.model;
    setFullPcAccess(currentSettings.fullPcAccess ?? false);
    setDisabledTools(currentSettings.disabledTools ?? []);
    if (patch.fullPcAccess !== undefined) scheduleFullPcAccessExpiry();
    saveSettings(currentSettings);
    if (patch.autoLaunch !== undefined) {
        app.setLoginItemSettings({openAtLogin: patch.autoLaunch});
    }
    if (patch.apiServerEnabled !== undefined) {
        if (patch.apiServerEnabled) startApiServer();
        else stopApiServer();
    }
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
            const existing = _watchConditions.get(metric);
            if (existing) _watchConditions.delete(metric);
        }
    }
    if (langChanged) {
        sendToRenderer("language-changed", {
            language: currentSettings.language,
            ttsVoice: currentSettings.ttsVoice,
        });
    }
    scheduleCloudPush();
    if (patch.weatherCity !== undefined) {
        getWeather().then((w) => sendToRenderer("weather-update", w as object)).catch(() => {});
    }
    return currentSettings;
});

// ── Global error handlers — log silent crashes ───────────────────────────────
// Previously these only logged — the renderer (and thus the user) had no idea
// anything went wrong, so a background failure looked identical to "the app
// quietly froze" with no actionable information.
// Environmental network noise (offline boot, paused Supabase, DNS blips) is not
// actionable for the user and was painting the feed red on every cold start —
// log it, but don't notify or auto-report it.
function isNetworkNoise(msg: string): boolean {
    return /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|getaddrinfo|network|socket hang up|521|522|EAI_AGAIN/i.test(msg);
}
process.on("unhandledRejection", (reason) => {
    const msg = (reason as Error)?.message ?? String(reason);
    console.error("[AEGIS] Unhandled rejection:", reason);
    if (isNetworkNoise(msg)) return;
    sendToRenderer("system-notice", {message: bt("noticeBgError", {msg})});
    void reportAiError("unhandledRejection", (reason as Error)?.stack ?? String(reason));
});
process.on("uncaughtException", (err) => {
    console.error("[AEGIS] Uncaught exception:", err.message, err.stack);
    if (isNetworkNoise(err.message)) return;
    sendToRenderer("system-notice", {message: bt("noticeUnexpectedError", {msg: err.message})});
    void reportAiError(`uncaughtException: ${err.message}`, err.stack ?? "");
});

// Renderer crash (OOM, GPU crash) — without this the window just goes blank/unresponsive
// with zero indication of why; recreate it so the user isn't stuck with a dead window.
app.on("render-process-gone", (_e, wc, details) => {
    console.error("[AEGIS] Renderer process gone:", details.reason);
    if (details.reason === "clean-exit") return;
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents === wc) {
        createWindow();
    }
});

void app.whenReady().then(async () => {
    setReportAppVersion(app.getVersion());
    // Reports queued while offline/signed-out get retried once per launch.
    setTimeout(() => { flushReportQueue().catch(() => {}); }, 10_000);

    // Developer convenience: AEGIS_FORCE_ONBOARDING=1 forces the onboarding flow
    // open unconditionally (even with a config/trial token). For design/UX testing only.
    if (process.env.AEGIS_FORCE_ONBOARDING === "1") {
        createOnboardingWindow();
        return;
    }

    // Is advanced mode ready? (own Groq key in config or env)
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
    void summarizeAndSave().finally(() => {
        sessionHistory = [];
        app.quit();
    });
});

app.on("window-all-closed", () => {
    // When tray is active: closing the window hides it, app stays alive
    if (process.platform !== "darwin" && !tray) app.quit();
});
