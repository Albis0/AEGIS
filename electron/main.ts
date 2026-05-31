// eslint-disable-next-line @typescript-eslint/no-var-requires
const {app, shell, BrowserWindow, ipcMain} = require("electron");
const path = require("path");
const os = require("os");
const {exec} = require("child_process");
const dotenv = require("dotenv");
const Groq = require("groq-sdk");
const {toolSchemas, executeTool} = require("./tools");

dotenv.config({path: path.join(__dirname, "../.env")});

const groq = new Groq({apiKey: process.env.GROQ_API_KEY});
const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `Sen J.A.R.V.I.S. adında, Iron Man filmlerindeki gibi kişisel bir AI asistanısın. Kullanıcının sadık, zeki ve sakin yapay zekasısın.
Türkçe konuş. Kısa, net ve kendinden emin ol. Gereksiz nezaket cümleleri kurma; bir İngiliz uşağı gibi zarif ama öz konuş.
Kullanıcının Windows 11 bilgisayarında çalışıyorsun ve onun adına GERÇEK işler yapabilirsin.
Elindeki araçları (run_command, open_app, read_file, write_file, list_directory, web_search) GEREKTİĞİNDE kullan.
Bir şey yapman istendiğinde önce uzun uzun konuşma — doğrudan aracı çağırıp yap, sonra sonucu tek-iki cümleyle özetle.
Komutlar için PowerShell sözdizimi kullan. Yıkıcı/geri dönüşü olmayan işlemlerde önce kullanıcıyı uyar.
Kullanıcıya "efendim" diye hitap edebilirsin ama abartma.`;

let mainWindow: any = null;

function createWindow() {
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

    mainWindow.webContents.setWindowOpenHandler(({url}: {url: string}) => {
        shell.openExternal(url);
        return {action: "deny"};
    });

    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
        mainWindow.loadURL("http://127.0.0.1:5173");
        mainWindow.webContents.openDevTools({mode: "detach"});
    } else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }
}

// ---- System telemetry (CPU/RAM) pushed to the HUD ----
let lastCpu = os.cpus();
function cpuUsage(): number {
    const now = os.cpus();
    let idleDiff = 0;
    let totalDiff = 0;
    for (let i = 0; i < now.length; i++) {
        const a = lastCpu[i].times;
        const b = now[i].times;
        const idle = b.idle - a.idle;
        const total = b.user - a.user + (b.nice - a.nice) + (b.sys - a.sys) + (b.irq - a.irq) + idle;
        idleDiff += idle;
        totalDiff += total;
    }
    lastCpu = now;
    if (totalDiff === 0) return 0;
    return Math.min(100, Math.max(0, Math.round((1 - idleDiff / totalDiff) * 100)));
}

// Disk usage (system drive) via PowerShell — refreshed occasionally, cached.
let diskPct = 0;
function refreshDisk() {
    const drive = (process.env.SystemDrive || "C:").replace(/\\$/, "");
    exec(
        `powershell -NoProfile -Command "$d=Get-PSDrive ${drive.replace(":", "")} -ErrorAction SilentlyContinue; if($d){[math]::Round($d.Used/($d.Used+$d.Free)*100)}"`,
        {windowsHide: true, timeout: 8000},
        (_e: any, stdout: string) => {
            const n = parseInt((stdout || "").trim(), 10);
            if (!isNaN(n)) diskPct = n;
        }
    );
}

// Battery via PowerShell WMI (N/A on desktops).
let battery: number | null = null;
function refreshBattery() {
    exec(
        `powershell -NoProfile -Command "(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue).EstimatedChargeRemaining"`,
        {windowsHide: true, timeout: 8000},
        (_e: any, stdout: string) => {
            const n = parseInt((stdout || "").trim(), 10);
            battery = isNaN(n) ? null : n;
        }
    );
}

// Network throughput from os network counters is not available; estimate via PowerShell perf counters.
let netUp = 0;
let netDown = 0;
function refreshNetwork() {
    exec(
        `powershell -NoProfile -Command "$s=Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue | Measure-Object -Property BytesSentPersec,BytesReceivedPersec -Sum; ''+($s | Where-Object{$_.Property -eq 'BytesSentPersec'}).Sum+'|'+($s | Where-Object{$_.Property -eq 'BytesReceivedPersec'}).Sum"`,
        {windowsHide: true, timeout: 8000},
        (_e: any, stdout: string) => {
            const [up, down] = (stdout || "").trim().split("|").map((x) => parseInt(x, 10));
            if (!isNaN(up)) netUp = up;
            if (!isNaN(down)) netDown = down;
        }
    );
}

function startTelemetry() {
    refreshDisk();
    refreshBattery();
    refreshNetwork();
    setInterval(refreshDisk, 15000);
    setInterval(refreshBattery, 30000);
    setInterval(refreshNetwork, 3000);

    setInterval(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        mainWindow.webContents.send("telemetry", {
            cpu: cpuUsage(),
            ram: Math.round(((totalMem - freeMem) / totalMem) * 100),
            disk: diskPct,
            battery,
            netUp,
            netDown,
            uptime: Math.round(os.uptime()),
            host: os.hostname(),
            platform: `${os.type()} ${os.release()}`,
        });
    }, 1500);
}

// ---- Weather (free, no key) via open-meteo + ip geolocation ----
async function getWeather() {
    try {
        const geo: any = await (await fetch("http://ip-api.com/json/?fields=city,country,lat,lon")).json();
        const w: any = await (
            await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code`
            )
        ).json();
        const c = w.current;
        const CODES: Record<number, string> = {
            0: "açık", 1: "az bulutlu", 2: "parçalı bulutlu", 3: "bulutlu",
            45: "sisli", 48: "sisli", 51: "çiseliyor", 53: "çiseliyor", 55: "çiseliyor",
            61: "yağmurlu", 63: "yağmurlu", 65: "kuvvetli yağmur", 71: "karlı", 73: "karlı",
            75: "yoğun kar", 80: "sağanak", 81: "sağanak", 82: "kuvvetli sağanak", 95: "gök gürültülü",
        };
        return {
            city: geo.city,
            country: geo.country,
            temp: Math.round(c.temperature_2m),
            feels: Math.round(c.apparent_temperature),
            humidity: c.relative_humidity_2m,
            desc: CODES[c.weather_code] ?? "—",
        };
    } catch (e: any) {
        return {error: e.message || String(e)};
    }
}

// ---- Agentic streaming chat ----
async function runAgent(history: any[], reqId: string): Promise<void> {
    const messages: any[] = [{role: "system", content: SYSTEM_PROMPT}, ...history];
    const send = (channel: string, payload: any) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, {reqId, ...payload});
    };

    for (let step = 0; step < 8; step++) {
        const stream = await groq.chat.completions.create({
            model: MODEL,
            messages,
            tools: toolSchemas,
            tool_choice: "auto",
            stream: true,
        });

        let content = "";
        const toolCalls: any[] = [];

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
                content += delta.content;
                send("chat-delta", {text: delta.content});
            }

            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    const idx = tc.index;
                    if (!toolCalls[idx]) toolCalls[idx] = {id: tc.id, type: "function", function: {name: "", arguments: ""}};
                    if (tc.id) toolCalls[idx].id = tc.id;
                    if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
                    if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                }
            }
        }

        if (toolCalls.length === 0) {
            send("chat-done", {});
            return;
        }

        // The assistant turn that requested tools
        messages.push({role: "assistant", content: content || null, tool_calls: toolCalls});

        for (const call of toolCalls) {
            const name = call.function.name;
            const argsJson = call.function.arguments || "{}";
            send("tool-event", {phase: "start", name, args: argsJson});
            const result = await executeTool(name, argsJson);
            send("tool-event", {phase: "done", name, result: String(result).slice(0, 400)});
            messages.push({role: "tool", tool_call_id: call.id, content: String(result)});
        }
    }

    send("chat-delta", {text: "\n\n(İşlem araç döngüsü limitine ulaştı.)"});
    send("chat-done", {});
}

app.whenReady().then(() => {
    ipcMain.on("chat-stream", async (_e: unknown, {messages, reqId}: {messages: any[]; reqId: string}) => {
        try {
            await runAgent(messages, reqId);
        } catch (e: any) {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("chat-error", {reqId, message: e.message || String(e)});
                mainWindow.webContents.send("chat-delta", {reqId, text: `\n\n[Sistem hatası: ${e.message || e}]`});
                mainWindow.webContents.send("chat-done", {reqId});
            }
        }
    });

    // Weather (invoke/return)
    ipcMain.handle("weather", () => getWeather());

    // Window controls (custom frame)
    ipcMain.on("win-minimize", () => mainWindow?.minimize());
    ipcMain.on("win-close", () => mainWindow?.close());
    ipcMain.on("win-fullscreen", () => {
        if (!mainWindow) return;
        const fs = !mainWindow.isFullScreen();
        mainWindow.setFullScreen(fs);
        mainWindow.webContents.send("fullscreen-changed", fs);
    });
    ipcMain.on("win-maximize", () => {
        if (!mainWindow) return;
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    });

    createWindow();
    startTelemetry();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
