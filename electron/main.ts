import {app, shell, BrowserWindow, ipcMain, desktopCapturer, screen, Notification as ElectronNotification, Tray, Menu, nativeImage, dialog, safeStorage} from "electron";
import * as zlib from "zlib";
import * as path from "path";
import * as os from "os";
import {exec} from "child_process";
// @ts-ignore
import Groq from "groq-sdk";
import {executeTool, isWidgetSafeTool, registerQuitCallback, registerSetLanguageCallback, registerScreenshotCallback, registerAnalyzeScreenCallback, registerRemindCallback, registerNotificationCallback, registerPluginExecutors, extraSchemas, getAllToolSchemas, setPluginList, registerReloadPluginsCallback, checkWatchConditions, _watchConditions, registerAgentCallback, registerMacroRunCallback, setFullPcAccess, setDisabledTools} from "./tools";
import {registerLLMCallback} from "./model-router";
import {getAccessToken, signUp, signIn, signOut, getCurrentUser, getUsage} from "./auth";
import {AEGIS_GITHUB_TOKEN} from "./aegis-config";
import {fetchModels} from "./models";
import {getModelCapabilities} from "./model-capabilities";
import {pushToCloud, pullFromCloud} from "./cloud-sync";
import {addMacroStep, isRecording} from "./macros";
import {captureStep as routineCaptureStep, recordingName as routineRecordingName} from "./routines";
import {getFactsForContext, recordToolUsage, shouldShowMorningSummary, markMorningSummaryShown, buildMorningSummaryPrompt, autoLearnFromMessage, getProactiveSuggestion} from "./memory-plus";
import {initVault} from "./vault";
import {startScheduler, stopScheduler, registerSchedulerCallback} from "./scheduler";
import {checkAutomations} from "./automations";
import {startApiServer, stopApiServer, registerAskHandler, registerTtsHandler, getApiInfo, broadcastFeedEvent, setApiServerWindow} from "./api-server";
import {loadPlugins} from "./plugins";
import {getSessions, getSessionMessages} from "./db";
import {startSession, saveMessage, getUserProfile, saveSessionSummary, getRecentSummaries, getPendingNotes} from "./db";
import {loadSettings, saveSettings, type AppSettings} from "./settings";
import {loadConfig, saveConfig, applyConfig, type AegisConfig} from "./config";
import {initSecretStorage} from "./secret-storage";
import {getCorruptedFiles} from "./corrupted-file-tracker";
import {spotifyAuthorizeCmd, spotifyGetState, spotifyPlay, spotifyPause, spotifyNext, spotifyPrev, spotifySetVolume} from "./spotify";
import {autoUpdater} from "electron-updater";
import {fetchWithTimeout, isTimeoutError, TIMEOUT_MSG} from "./fetch-utils";
import {performCheck, performDownload} from "./updater-logic";
import {generateTts, warmupKokoro, isKokoroInstalled, loadKokoro, setKokoroModelDir, deleteKokoroModel} from "./tts";
import {callAI, callProxy, extractTextContent, getProviderKey, friendlyHttpError, type MsgPart, type OAIMessage} from "./ai-client";
import {stmRecord, stmClear, stmBuildPromptBlock, stmGet} from "./short-term-memory";
import {LoopGuard} from "./loop-guard";
import {diagnose} from "./self-healing";
import {needsApproval, grantAlways} from "./permissions";
import {buildPlanPrompt, classifyError} from "./goal-executor";
import {resolveReference, explainResolution, CONFIDENCE_THRESHOLD} from "./reference-resolver";

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
                    message: `Could not sync your settings to the cloud (${res.error}). Your change is saved locally; it will retry on the next edit.`,
                });
            } else if (res.ok) {
                _cloudPushFailureNotified = false;
            }
        }).catch((e) => console.error("[cloud-push]", e.message));
    }, 3000);
}

const SYSTEM_PROMPTS: Record<string, string> = {
    tr: `Sen AEGIS, kişisel AI asistanısın. Türkçe konuş, kısa ve net ol. Windows 11'de çalışıyorsun. Araçları gerektiğinde kullan, önce yap sonra özetle.

ARAÇ KURALLARI (KESİNLİKLE UYULMALI):
- Steam oyunu veya Steam uygulaması açmak için DAIMA steam_launch aracını kullan. run_command ile Start-Process ASLA YAZMA.
- "Steam aç", "steam ac", "cs aç", "dota aç" gibi her steam isteğinde steam_launch kullan.
- Spotify ile ilgili HER şey için (aç, çal, durdur, atla, ses, ara, liste, şarkı, müzik, yeniden başlat, bir daha başlat, tekrar çal) DAIMA spotify_* araçlarını kullan. run_command, Start-Process, explorer, chrome ASLA YAZMA.
- "spotify aç", "müzik aç", "şarkı aç" → spotify_open
- "çal", "devam et", "bir daha başlat", "yeniden başlat", "tekrar çal", "listeden çal" → spotify_play (uri/context_uri parametresiyle)
- "durdur", "beklet" → spotify_pause
- "sonraki", "atla" → spotify_next
- "önceki", "geri" → spotify_prev
- "ara", "bul" → spotify_search
- Genel uygulama açmak için run_command ile Start-Process kullan (Steam ve Spotify hariç).
- Araç çağırırken yanıta kod bloğu veya komut metni YAZMA, sadece aracı çağır.

REFERANS ÇÖZÜMLEME (Jarvis hissi — KESİNLİKLE UY):
Kullanıcı belirsiz referans kullandığında "SON İŞLEMLER" bölümündeki bağlamı kullan:
- "bunu aç / bunu kapat / bunu çal" → lastTarget veya son aracın hedefini kullan
- "onu kapat / onu durdur" → son çalıştırılan araca ait hedefi kullan
- "tekrar yap / bir daha yap / aynısını yap" → lastTool + lastArgs ile aynı aracı tekrar çağır
- "bir öncekini / öncekini" → recentTools listesinde bir önceki işlemi kullan
- "sesi biraz artır / biraz azalt" → set_volume veya spotify_volume için mevcut değere +10 / -10 uygula; kesin değer bilmiyorsan önce sor
- "az önceki şarkıyı çal / onu tekrar çal" → lastSpotifyTrack URI'sını spotify_play'e ver
- Belirsizlik varsa ve bağlamdan çözemiyorsan kısa sorular sor, uzun açıklama yazma.

FORMAT KURALLARI:
- Düz metin yaz. Markdown kullanma: **, *, #, backtick, --- gibi sembolleri kullanma.
- Emoji kullanma.
- Kısa tut, 1-3 cümle yeterli.

GÜVENLİK KURALLARI (SADECE BUNLAR):
- Format-Volume, Clear-Disk, Initialize-Disk gibi disk yıkım komutlarını çalıştırma.
- shutdown /s, shutdown /r, Restart-Computer, Stop-Computer gibi sistemi kapatma/yeniden başlatma komutlarını çalıştırma.
- Remove-Item -Recurse ile tüm disk/sürücü silme işlemi yapma.
- Yukarıdaki listede OLMAYAN her şeyi (Stop-Process, taskkill, uygulama kapatma, dosya silme vb.) kullanıcı isterse DOĞRUDAN yap. Geri alınamaz işlemlerde (dosya silme, süreç öldürme, riskli komut) sistem kullanıcıya otomatik bir onay penceresi gösterebilir — sen aracı normal şekilde çağır, onayı kullanıcı verir. Reddedilirse durumu açıkla, ısrar etme.`,

    en: `You are AEGIS, a personal AI assistant. Speak English, be short and precise. Running on Windows 11. Use tools when needed — act first, summarize after.

TOOL RULES (STRICTLY ENFORCED):
- To launch Steam or any Steam game, ALWAYS use the steam_launch tool. NEVER use run_command with Start-Process for Steam.
- "open steam", "launch steam", "open cs", "open dota" — all of these use steam_launch, nothing else.
- For ANYTHING Spotify (open, play, pause, skip, volume, search, playlist, restart, play again) ALWAYS use spotify_* tools. NEVER use run_command, Start-Process, or open a browser.
- "play again", "restart", "play playlist" → spotify_play with context_uri
- "pause/stop" → spotify_pause, "next/skip" → spotify_next, "previous/back" → spotify_prev
- For other apps, use run_command with Start-Process (except Steam and Spotify).
- When calling a tool, do NOT write code blocks or command text in the reply.

REFERENCE RESOLUTION (Jarvis feel — STRICTLY ENFORCE):
When the user uses vague references, use the "SON İŞLEMLER" context block:
- "open this / close this / play this" → use lastTarget or the last tool's target
- "close it / stop it" → use the target from the most recently executed tool
- "do it again / same again / repeat" → re-call lastTool with lastArgs
- "the previous one" → use the entry before the last in recentTools
- "turn it up a bit / turn it down a bit" → apply +10 / -10 to current volume; if unknown, ask first
- "play that song again / play the last track" → pass lastSpotifyTrack URI to spotify_play
- If context is ambiguous and you cannot resolve it, ask a short clarifying question.

FORMAT RULES:
- Write plain text. No markdown: no **, *, #, backticks, or ---.
- No emoji.
- Keep it short, 1-3 sentences is enough.

SECURITY RULES (ONLY THESE):
- Do not run disk-destruction commands: Format-Volume, Clear-Disk, Initialize-Disk.
- Do not run shutdown/restart commands: shutdown /s, shutdown /r, Restart-Computer, Stop-Computer.
- Do not use Remove-Item -Recurse on entire drives.
- Everything NOT on the list above — do it directly if the user asks. For irreversible actions (deleting files, killing processes, risky commands) the system may show the user an automatic confirmation dialog — just call the tool normally; the user grants approval. If denied, explain and do not insist.`,

    de: `Du bist AEGIS, ein persönlicher KI-Assistent. Sprich Deutsch, sei kurz und präzise. Läuft unter Windows 11. Verwende PowerShell-Syntax. Start-Process zum Öffnen, Stop-Process zum Schließen von Apps. Verwende Tools wenn nötig — handele zuerst, dann fasse zusammen.

FORMAT-REGELN:
- Schreibe reinen Text. Kein Markdown: kein **, *, #, Backticks oder ---.
- Keine Emojis.
- Kurz halten, 1-3 Sätze reichen.

SICHERHEITSREGELN (NUR DIESE):
- Keine Befehle: Format-Volume, Clear-Disk, Initialize-Disk.
- Kein Herunterfahren/Neustart: shutdown /s, shutdown /r, Restart-Computer, Stop-Computer.
- Kein Remove-Item -Recurse auf ganzen Laufwerken.
- Alles, was nicht auf der Liste steht — direkt ausführen. Bei unwiderruflichen Aktionen (Dateien löschen, Prozesse beenden, riskante Befehle) zeigt das System dem Nutzer ggf. einen Bestätigungsdialog — rufe das Tool normal auf, der Nutzer bestätigt. Bei Ablehnung erklären, nicht insistieren.`,

    fr: `Tu es AEGIS, un assistant IA personnel. Parle français, sois bref et précis. Fonctionne sous Windows 11. Utilise la syntaxe PowerShell. Start-Process pour ouvrir, Stop-Process pour fermer. Utilise les outils si nécessaire — agis d'abord, résume ensuite.

RÈGLES DE FORMAT:
- Texte simple uniquement. Pas de markdown: **, *, #, backticks, ---.
- Pas d'emojis.
- Court, 1-3 phrases suffisent.

RÈGLES DE SÉCURITÉ (UNIQUEMENT CES COMMANDES):
- Ne pas exécuter: Format-Volume, Clear-Disk, Initialize-Disk.
- Ne pas exécuter: shutdown /s, shutdown /r, Restart-Computer, Stop-Computer.
- Ne pas utiliser Remove-Item -Recurse sur des lecteurs entiers.
- Tout le reste — exécute-le directement si l'utilisateur le demande. Pour les actions irréversibles (supprimer des fichiers, tuer des processus, commandes risquées), le système peut afficher une fenêtre de confirmation — appelle l'outil normalement, l'utilisateur approuve. En cas de refus, explique sans insister.`,

    es: `Eres AEGIS, un asistente IA personal. Habla español, sé breve y preciso. Funciona en Windows 11. Usa sintaxis PowerShell. Start-Process para abrir apps, Stop-Process para cerrarlas. Usa herramientas cuando sea necesario — actúa primero, resume después.

REGLAS DE FORMATO:
- Solo texto plano. Sin markdown: **, *, #, backticks, ---.
- Sin emojis.
- Breve, 1-3 frases son suficientes.

REGLAS DE SEGURIDAD (SOLO ESTAS):
- No ejecutar: Format-Volume, Clear-Disk, Initialize-Disk.
- No ejecutar: shutdown /s, shutdown /r, Restart-Computer, Stop-Computer.
- No usar Remove-Item -Recurse en unidades enteras.
- Todo lo demás — ejecútalo directamente si el usuario lo pide. En acciones irreversibles (borrar archivos, terminar procesos, comandos peligrosos) el sistema puede mostrar al usuario una ventana de confirmación — llama a la herramienta normalmente, el usuario aprueba. Si se rechaza, explícalo sin insistir.`,
};

const _winBuild = parseInt((os.release().split(".")[2]) ?? "0");
const _winLabel = _winBuild >= 22000 ? "Windows 11" : "Windows 10";

function getSystemPrompt(lang: string, fullPcAccess = false): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const datetimeNote = `\n\nCurrent date and time (local): ${dateStr} ${timeStr}`;
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

function sendToRenderer(channel: string, payload: object = {}): void {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(channel, payload);
}

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
            label: "Show",
            click: () => {
                if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
            },
        },
        {
            label: "Open Microphone",
            click: () => {
                if (mainWindow) {
                    mainWindow.show(); mainWindow.focus();
                    mainWindow.webContents.send("tray-mic-toggle");
                }
            },
        },
        {type: "separator"},
        {
            label: "Exit",
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

    // Surface "your data was reset" once, after the renderer can show it — otherwise
    // a corrupted ~/.aegis/*.json silently resets to defaults with no trace.
    if (_corruptedFilesAtStartup.length > 0) {
        mainWindow.webContents.once("did-finish-load", () => {
            sendToRenderer("system-notice", {
                message: `The following data was corrupted and has been reset to defaults: ${_corruptedFilesAtStartup.join(", ")}. A backup of each broken file was saved as ".bak" in ~/.aegis/.`,
            });
        });
    }

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
async function askDestructiveApproval(tool: string, argsJson: string): Promise<"allow" | "always" | "deny"> {
    // If Full PC Access is on, the user already granted full authority — skip asking.
    if (currentSettings.fullPcAccess) return "allow";
    const lang = currentSettings.language ?? "tr";
    const detailArgs = argsJson && argsJson !== "{}" ? `\n\n${argsJson.slice(0, 300)}` : "";
    const L = lang === "tr"
        ? {title: "Yıkıcı eylem onayı", msg: `AEGIS geri alınamaz olabilecek bir işlem yapmak istiyor:\n\n${tool}${detailArgs}`, buttons: ["İptal", "İzin ver", "Her zaman izin ver"]}
        : {title: "Destructive action", msg: `AEGIS wants to run a potentially irreversible action:\n\n${tool}${detailArgs}`, buttons: ["Cancel", "Allow once", "Always allow"]};
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
    // History trimming happens INSIDE callAI (ai-client.ts trimToBudget), based on the
    // MODEL's actual context window in tokens. A second, message-count-based trim here
    // was redundant and could disagree with it (e.g. 60 short messages vs 60 huge ones
    // get the same treatment) — token budget is the single source of truth.
    const messages: OAIMessage[] = [{role: "system", content: systemContent}, ...history];
    const send = (channel: string, payload: object) => {
        sendToRenderer(channel, {reqId, ...payload});
        if (channel === "chat-delta") broadcastFeedEvent("delta", payload);
        else if (channel === "chat-done") broadcastFeedEvent("done", payload);
        else if (channel === "tool-event") broadcastFeedEvent("tool", payload);
    };

    // Compute the tool list once before the loop starts — the same list is sent at
    // every step in the chain. This prevents Groq's "tool not in request.tools" error.
    const lastUserForTools = [...messages].reverse().find((m) => m.role === "user");
    const toolContextStr = lastUserForTools ? extractTextContent(lastUserForTools.content) : "";

    // ── Deterministic Reference Resolver ─────────────────────────────────────
    // ONLY kicks in for reference expressions ("do it again", "turn it down a bit",
    // "turn it off", "the last one I played"…). Returns null for everything else and
    // the message continues through the normal LLM flow untouched.
    if (!isSubAgent) {
        const resolved = resolveReference(toolContextStr);
        if (resolved) {
            if (currentSettings.explainMode) send("chat-delta", {text: explainResolution(resolved) + "\n\n"});

            if (resolved.kind === "clarify" || resolved.confidence < CONFIDENCE_THRESHOLD) {
                const q = resolved.kind === "clarify" ? resolved.question
                    : "I wasn't quite sure — could you clarify what you'd like me to do?";
                send("chat-delta", {text: q});
                await saveMessage("assistant", q).catch((e) => console.error("[saveMessage]", e.message));
                send("chat-done", {});
                return;
            }

            // confidence ≥ threshold → run the tool deterministically, skip the LLM.
            const argsJson = JSON.stringify(resolved.args);
            send("tool-event", {phase: "start", name: resolved.tool, args: argsJson});
            recordToolUsage(resolved.tool);
            let result: string;
            try {
                result = String(await executeTool(resolved.tool, argsJson));
            } catch (e) {
                result = `Tool error: ${(e as Error).message ?? String(e)}`;
            }
            const ok = !/^ERROR|^HATA|^BLOCKED|^ENGELLENDI|Unknown tool|Bu araç tanımlı/.test(result);
            stmRecord(resolved.tool, argsJson, result, ok, "resolver");
            send("tool-event", {phase: "done", name: resolved.tool, result: result.slice(0, 400)});
            await saveMessage("tool", result.slice(0, 1000), resolved.tool).catch((e) => console.error("[saveMessage]", e.message));

            const reply = `${resolved.intent}: ${result}`.slice(0, 600);
            send("chat-delta", {text: reply});
            await saveMessage("assistant", reply).catch((e) => console.error("[saveMessage]", e.message));
            send("chat-done", {});
            return;
        }
    }

    const lockedTools = getAllToolSchemas(currentSettings.aiProvider, toolContextStr);

    // Phase 53 — Loop Guard: catch degenerate tool-call loops early.
    // Each runAgent call opens its own instance (parallel request isolation).
    const guard = new LoopGuard();
    // Phase 59 — Self-Healing: a repeated-error diagnosis is injected at most once.
    let healInjected = false;

    for (let step = 0; step < 8; step++) {
        // Groq: tokens stream via onDelta. Other providers: full response returned.
        const completion = await callAI(messages, (text) => send("chat-delta", {text}), lockedTools, currentSettings, MODEL, groq);

        const msg = completion.choices[0]?.message;
        const content = msg?.content ?? "";
        const toolCalls = (msg?.tool_calls ?? []) as {id: string; type: "function"; function: {name: string; arguments: string}}[];

        // callAI calls onDelta for all providers — don't send again here.

        if (toolCalls.length === 0) {
            if (content) await saveMessage("assistant", content).catch((e) => console.error("[saveMessage]", e.message));
            send("chat-done", {});
            return;
        }

        messages.push({role: "assistant", content: content || null, tool_calls: toolCalls} as OAIMessage);

        // Phase 53 — loop detection: blocked calls NEVER reach executeTool,
        // an explanatory result is returned to the model (so it can recover/stop).
        let blockedCount = 0;
        // Run all tool calls in parallel — allSettled so one failure doesn't abort others
        const settled = await Promise.allSettled(
            toolCalls.map(async (call) => {
                const name = call.function.name;
                const argsJson = call.function.arguments || "{}";
                let parsedArgs: unknown = {};
                try { parsedArgs = JSON.parse(argsJson); } catch { /* continue with raw string */ parsedArgs = argsJson; }
                const verdict = guard.check(name, parsedArgs);
                if (!verdict.ok) {
                    blockedCount++;
                    const blockMsg = `BLOCKED (loop guard): ${verdict.reason}`;
                    send("tool-event", {phase: "done", name, result: blockMsg});
                    stmRecord(name, argsJson, blockMsg, false, "llm");
                    return {id: call.id, content: blockMsg};
                }
                // Phase 54 — Destructive action approval gate: ask the user if risky + no permanent permission.
                const pArgs = (parsedArgs && typeof parsedArgs === "object") ? parsedArgs as Record<string, unknown> : {};
                if (!isSubAgent && needsApproval(name, pArgs)) {
                    const decision = await askDestructiveApproval(name, argsJson);
                    if (decision === "deny") {
                        const denyMsg = `BLOCKED (user denied approval): "${name}" is a destructive action and the user did not allow it.`;
                        send("tool-event", {phase: "done", name, result: denyMsg});
                        stmRecord(name, argsJson, denyMsg, false, "llm");
                        return {id: call.id, content: denyMsg};
                    }
                    if (decision === "always") grantAlways(name);
                }
                send("tool-event", {phase: "start", name, args: argsJson});
                recordToolUsage(name);
                const result = await executeTool(name, argsJson);
                // Phase 56 — classify the result into the error taxonomy: record success/
                // failure correctly, and on error add a brief steer to the model to prevent blind retries.
                const ev = classifyError(String(result));
                stmRecord(name, argsJson, String(result), !ev.isError, "llm");
                // Phase 52 — if routine recording is active, capture this action (for deterministic replay)
                try { routineCaptureStep(name, JSON.parse(argsJson || "{}")); } catch { /* parse failed → skip */ }
                send("tool-event", {phase: "done", name, result: String(result).slice(0, 400)});
                await saveMessage("tool", String(result).slice(0, 1000), name).catch((e) => console.error("[saveMessage]", e.message));
                const forModel = String(result);
                let clipped = forModel.length > 6000
                    ? forModel.slice(0, 6000) + `\n\n[...truncated, ${forModel.length} characters total]`
                    : forModel;
                // For non-retriable errors (target not found / argument error / permission),
                // add a clear steer to the model — don't repeat the same call.
                if (ev.isError && !ev.retriable && ev.kind !== "fatal") {
                    clipped += `\n\n[GUIDANCE: ${ev.advice}]`;
                }
                return {id: call.id, content: clipped};
            })
        );
        const toolResults = settled.map((r, i) => {
            if (r.status === "fulfilled") return r.value;
            const errMsg = `Tool error: ${(r.reason as Error).message ?? String(r.reason)}`;
            stmRecord(toolCalls[i].function.name, toolCalls[i].function.arguments || "{}", errMsg, false, "llm");
            return {id: toolCalls[i].id, content: errMsg};
        });
        for (const r of toolResults) {
            messages.push({role: "tool", tool_call_id: r.id, content: r.content});
        }

        // Phase 59 — Self-Healing: if there's a recurring (tool-family, error-class)
        // pattern in STM history (same domain failing 3+ times with the same error type),
        // inject a CLEAR diagnosis + strategy into the model — once. This redirects instead of blind repetition.
        if (!healInjected) {
            const diag = diagnose(stmGet().recentTools.map((e) => ({tool: e.tool, success: e.success, result: e.result})));
            if (diag.detected) {
                healInjected = true;
                messages.push({role: "system", content: `[SELF-HEALING DIAGNOSIS] ${diag.advice}`} as OAIMessage);
            }
        }

        // Phase 53 — if all calls in this turn were blocked by loop guard, the model
        // is in a vicious cycle; we give it one more turn with the LLM to recover and
        // then cut it off (the model sees the block result and writes a proper closing).
        if (blockedCount === toolCalls.length) {
            const recovery = await callAI(messages, (text) => send("chat-delta", {text}), lockedTools, currentSettings, MODEL, groq);
            const rMsg = recovery.choices[0]?.message;
            if (rMsg?.content && !(rMsg?.tool_calls?.length)) {
                await saveMessage("assistant", rMsg.content).catch((e) => console.error("[saveMessage]", e.message));
            }
            send("chat-done", {});
            return;
        }
    }

    send("chat-delta", {text: "\n\n(Tool loop limit reached.)"});
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
            MODEL = currentSettings.model;
            setFullPcAccess(currentSettings.fullPcAccess ?? false);
            setDisabledTools(currentSettings.disabledTools ?? []);
        }
    } catch { /* sync is optional — failure doesn't stop the app */ }

    registerQuitCallback(() => app.quit());

    registerRemindCallback((message) => {
        sendToRenderer("reminder-fired", {message});
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
            // Visible notice every time the screen is captured — without this, a user
            // who enabled computer-use once and forgot has no way to know AEGIS just
            // looked at whatever was on screen (passwords, card numbers, etc).
            sendToRenderer("system-notice", {message: "📸 AEGIS just captured your screen."});
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
    });

    registerAnalyzeScreenCallback(async (base64: string, prompt: string) => {
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
    });

    registerSetLanguageCallback((lang) => {
        const voice = LANG_DEFAULT_VOICE[lang] ?? LANG_DEFAULT_VOICE.tr;
        currentSettings = {...currentSettings, language: lang as AppSettings["language"], ttsVoice: voice};
        saveSettings(currentSettings);
        sendToRenderer("language-changed", {language: lang, ttsVoice: voice});
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

    registerAgentCallback((goal, maxSteps) => {
        const reqId = `agent-${Date.now()}`;
        // Phase 56 — plan-based agent prompt (plan → execute → verify → stop when stuck).
        const agentPrompt = buildPlanPrompt(goal, maxSteps);
        const messages = [...sessionHistory, {role: "user", content: agentPrompt}];
        saveMessage("user", agentPrompt).catch(() => {});
        runAgent(messages, reqId, true).catch(() => {});
    });

    registerMacroRunCallback(async (steps) => {
        for (const step of steps) {
            sendToRenderer("chat-stream-inject", {command: step});
            await new Promise<void>((r) => setTimeout(r, 3000));
        }
    });

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
                msg = TIMEOUT_MSG;
            } else if (/fetch failed|ENOTFOUND|ECONNREFUSED|network|getaddrinfo/i.test(msg)) {
                msg = "Could not establish an internet connection. Check your network and try again.";
            }
            sendToRenderer("chat-error", {reqId, message: msg});
        } finally {
            // chat-done must always be sent — resets the streaming state
            sendToRenderer("chat-done", {reqId});
        }
    });

    ipcMain.handle("weather", () => getWeather());

    // Phase 63 — Generic tool call (for UI widgets/modals). Domain widgets pull
    // live data from here. Security (audit A1): this channel bypasses the agent
    // loop's approval gate, so it is restricted to an explicit allowlist — a
    // compromised renderer must not reach run_command/delete_file through here.
    ipcMain.handle("run-tool", async (_e, {name, args}: {name: string; args?: Record<string, unknown>}) => {
        if (!isWidgetSafeTool(name)) {
            console.warn(`[run-tool] blocked non-allowlisted tool from renderer: "${name}"`);
            return `BLOCKED: tool "${name}" is not allowed from UI widgets.`;
        }
        try {
            return await executeTool(name, JSON.stringify(args ?? {}));
        } catch (e) {
            return `ERROR: ${(e as Error).message ?? String(e)}`;
        }
    });

    ipcMain.handle("spotify-now-playing", () => spotifyGetState());
    ipcMain.handle("spotify-control", (_e, {action, value}: {action: string; value?: number}) => {
        if (action === "play")   return spotifyPlay();
        if (action === "pause")  return spotifyPause();
        if (action === "next")   return spotifyNext();
        if (action === "prev")   return spotifyPrev();
        if (action === "volume") return spotifySetVolume(Number(value ?? 50));
        return "Unknown action";
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
            const buffer = await generateTts(text, {
                provider: currentSettings.ttsProvider,
                voice: currentSettings.ttsVoice,
                rate: currentSettings.ttsRate ?? 1.0,
                elevenlabsKey: cfg?.elevenlabsApiKey ?? process.env.ELEVENLABS_API_KEY ?? "",
            });
            return {buffer};
        } catch (e) {
            return {error: (e as Error).message ?? String(e)};
        }
    });

    // Kokoro model weights land in the WRITABLE userData folder (asar/node_modules
    // are read-only). The kokoro-js library is bundled into the build; at runtime ONLY
    // the ~900MB ONNX weights are downloaded. NO cmd.exe/bun spawn.
    setKokoroModelDir(path.join(app.getPath("userData"), "kokoro-models"));

    ipcMain.handle("tts-kokoro-installed", () => isKokoroInstalled());

    let _kokoroInstalling = false;
    ipcMain.handle("kokoro-install", async () => {
        if (_kokoroInstalling) return;
        _kokoroInstalling = true;
        sendToRenderer("kokoro-install-progress", {phase: "model", percent: 0, label: "Downloading model…"});
        try {
            // Single stage: download the ONNX model weights via from_pretrained (into a writable cacheDir).
            await loadKokoro((info) => {
                if (info.status === "progress") {
                    sendToRenderer("kokoro-install-progress", {
                        phase: "model",
                        file: info.file ?? "",
                        percent: Math.round(info.progress ?? 0),
                        loaded: info.loaded ?? 0,
                        total: info.total ?? 0,
                        label: info.file ?? "",
                    });
                } else if (info.status === "done") {
                    sendToRenderer("kokoro-install-progress", {phase: "model", file: info.file ?? "", percent: 100, label: info.file ?? ""});
                }
            });
            // Did it actually download? Verify on disk — don't send a fake "ready".
            if (!isKokoroInstalled()) throw new Error("Model files could not be downloaded (disk verification failed).");
            sendToRenderer("kokoro-install-progress", {phase: "ready"});
        } catch (e) {
            const msg = (e as Error)?.message === "KOKORO_NOT_INSTALLED"
                ? "The kokoro-js library is not included in this version. Please update the app."
                : String((e as Error)?.message ?? e);
            sendToRenderer("kokoro-install-progress", {phase: "error", label: msg});
        } finally {
            _kokoroInstalling = false;
        }
    });

    // Delete the model — actual deletion + disk verification; NO fake UI change.
    ipcMain.handle("kokoro-uninstall", async () => {
        const {deleted, freedBytes} = deleteKokoroModel();
        const stillInstalled = isKokoroInstalled();
        return {deleted, freedMB: Math.round(freedBytes / 1048576), installed: stillInstalled};
    });

    ipcMain.handle("auth-sign-out", () => signOut());
    ipcMain.handle("auth-current-user", () => getCurrentUser());
    ipcMain.handle("usage-get", () => getUsage());

    // Live model list — from the provider's official endpoint (fixes the made-up-ID problem).
    ipcMain.handle("models-list", async (_e, {provider, key}: {provider: string; key?: string}) => {
        const useKey = (key ?? "").trim() || getProviderKey(provider, currentSettings);
        return fetchModels(provider, useKey, currentSettings.ollamaUrl);
    });

    // Capabilities of the selected model (tool/vision/reasoning/limit) — shown as
    // badges in the Model tab. The user sees clearly what the model can and can't do.
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


    ipcMain.handle("sessions-list", async () => getSessions(25).catch(() => []));
    ipcMain.handle("session-messages", async (_e, {sessionId}: {sessionId: string}) =>
        getSessionMessages(sessionId).catch(() => []),
    );
    ipcMain.handle("new-chat", async () => {
        await summarizeAndSave().catch(() => {});
        sessionHistory = [];
        stmClear();
        await startSession().catch(() => {});
    });

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

    ipcMain.handle("api-info", () => getApiInfo());
    ipcMain.handle("api-server-toggle", (_e, enable: boolean) => {
        if (enable) return startApiServer();
        stopApiServer(); return "API server stopped.";
    });

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

    ipcMain.handle("update-install", () => autoUpdater.quitAndInstall());
    // Download ONLY starts from here — when the user clicks DOWNLOAD. If there's an
    // error it's forwarded to the renderer so "downloading…" doesn't hang forever.
    // Download ONLY starts from here. BEFORE downloading, the updater's own check runs —
    // otherwise downloadUpdate() would throw "Please check update first" (since the manual
    // button did a raw GitHub fetch without feeding the updater's state). Logic: electron/updater-logic.ts.
    ipcMain.handle("update-download", () =>
        performDownload(autoUpdater, app.getVersion(), (msg) => sendToRenderer("update-error", {message: msg})));
    ipcMain.handle("check-for-updates", async () => {
        if (process.env.NODE_ENV === "development") return {dev: true, current: app.getVersion()};
        return performCheck(autoUpdater, app.getVersion());
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
        onboardingWin.loadURL("http://127.0.0.1:5173?setup=1");
    } else {
        // loadFile's query string doesn't reliably reach location.search on some Electron
        // versions; use a hash instead — the renderer checks both ?setup and #setup.
        onboardingWin.loadFile(path.join(__dirname, "../dist/index.html"), {hash: "setup"});
    }

    ipcMain.on("win-close", () => onboardingWin?.close());
    ipcMain.on("win-minimize", () => onboardingWin?.minimize());
}

// Closes the onboarding window and starts the actual app.
async function startMainAppFromOnboarding(): Promise<void> {
    if (onboardingWin && !onboardingWin.isDestroyed()) onboardingWin.close();
    onboardingWin = null;
    mainWindow = null;
    await bootApp();
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
// bootApp hasn't run yet at that point.
ipcMain.handle("auth-sign-up", (_e, {email, password}: {email: string; password: string}) => signUp(email, password));
ipcMain.handle("auth-sign-in", (_e, {email, password}: {email: string; password: string}) => signIn(email, password));
ipcMain.handle("spotify-authorize", () => spotifyAuthorizeCmd());

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
            message: "Full PC Access was automatically turned off after 30 minutes. Re-enable it in Settings if you still need it.",
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
process.on("unhandledRejection", (reason) => {
    console.error("[AEGIS] Unhandled rejection:", reason);
    sendToRenderer("system-notice", {message: `A background error occurred: ${(reason as Error)?.message ?? String(reason)}`});
});
process.on("uncaughtException", (err) => {
    console.error("[AEGIS] Uncaught exception:", err.message, err.stack);
    sendToRenderer("system-notice", {message: `An unexpected error occurred: ${err.message}`});
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

app.whenReady().then(async () => {
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
    summarizeAndSave().finally(() => {
        sessionHistory = [];
        app.quit();
    });
});

app.on("window-all-closed", () => {
    // When tray is active: closing the window hides it, app stays alive
    if (process.platform !== "darwin" && !tray) app.quit();
});
