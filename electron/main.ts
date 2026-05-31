import {app, shell, BrowserWindow, ipcMain} from "electron";
import * as path from "path";
import * as os from "os";
import {exec} from "child_process";
import * as dotenv from "dotenv";
// @ts-ignore
import Groq from "groq-sdk";
import type {ChatCompletionMessageParam} from "groq-sdk/resources/chat/completions";
import {toolSchemas, executeTool, registerQuitCallback} from "./tools";
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

const SYSTEM_PROMPT = `Sen AEGIS, kişisel AI asistanısın. Türkçe konuş, kısa ve net ol. Windows 11'de çalışıyorsun. PowerShell sözdizimi kullan. Uygulama açmak için Start-Process, kapatmak için Stop-Process kullan. Araçları gerektiğinde kullan, önce yap sonra özetle.

FORMAT KURALLARI:
- Düz metin yaz. Markdown kullanma: **, *, #, backtick, --- gibi sembolleri kullanma.
- Emoji kullanma.
- Kısa tut, 1-3 cümle yeterli.

GÜVENLİK KURALLARI (SADECE BUNLAR):
- Format-Volume, Clear-Disk, Initialize-Disk gibi disk yıkım komutlarını çalıştırma.
- shutdown /s, shutdown /r, Restart-Computer, Stop-Computer gibi sistemi kapatma/yeniden başlatma komutlarını çalıştırma.
- Remove-Item -Recurse ile tüm disk/sürücü silme işlemi yapma.
- Yukarıdaki listede OLMAYAN her şeyi (Stop-Process, taskkill, uygulama kapatma, dosya silme vb.) kullanıcı isterse DOĞRUDAN yap, onay isteme.`;

let mainWindow: BrowserWindow | null = null;

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

let diskPct = 0;
function refreshDisk(): void {
    const drive = (process.env.SystemDrive ?? "C:").replace(/\\$/, "");
    exec(
        `powershell -NoProfile -Command "$d=Get-PSDrive ${drive.replace(":", "")} -ErrorAction SilentlyContinue; if($d){[math]::Round($d.Used/($d.Used+$d.Free)*100)}"`,
        {windowsHide: true, timeout: 8000},
        (_e, stdout) => {
            const n = parseInt((stdout ?? "").trim(), 10);
            if (!isNaN(n)) diskPct = n;
        },
    );
}

let battery: number | null = null;
function refreshBattery(): void {
    exec(`powershell -NoProfile -Command "(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue).EstimatedChargeRemaining"`, {windowsHide: true, timeout: 8000}, (_e, stdout) => {
        const n = parseInt((stdout ?? "").trim(), 10);
        battery = isNaN(n) ? null : n;
    });
}

let netUp = 0;
let netDown = 0;
function refreshNetwork(): void {
    exec(
        `powershell -NoProfile -Command "$s=Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue | Measure-Object -Property BytesSentPersec,BytesReceivedPersec -Sum; ''+($s | Where-Object{$_.Property -eq 'BytesSentPersec'}).Sum+'|'+($s | Where-Object{$_.Property -eq 'BytesReceivedPersec'}).Sum"`,
        {windowsHide: true, timeout: 8000},
        (_e, stdout) => {
            const [up, down] = (stdout ?? "")
                .trim()
                .split("|")
                .map((x) => parseInt(x, 10));
            if (!isNaN(up)) netUp = up;
            if (!isNaN(down)) netDown = down;
        },
    );
}

// GPU
type GpuInfo = {name: string; load: number; vramUsed: number; vramTotal: number; temp: number | null};
let gpuInfo: GpuInfo[] = [];

function initGpuStatic(): void {
    // GPU adı ve toplam VRAM — sadece başlangıçta bir kez çekilir
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
    // Sadece dinamik veriler: load, VRAM kullanımı, sıcaklık
    exec(
        `nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits`,
        {windowsHide: true, timeout: 5000},
        (_e, stdout) => {
            if (!stdout) return;
            stdout.trim().split("\n").forEach((line, i) => {
                const parts = line.split(",").map((s) => parseInt(s.trim(), 10));
                if (parts.length >= 4) {
                    if (!gpuInfo[i]) gpuInfo[i] = {name: `GPU ${i}`, load: 0, vramUsed: 0, vramTotal: 0, temp: null};
                    gpuInfo[i].load = isNaN(parts[0]) ? 0 : parts[0];
                    gpuInfo[i].vramUsed = isNaN(parts[1]) ? 0 : parts[1];
                    gpuInfo[i].vramTotal = isNaN(parts[2]) ? gpuInfo[i].vramTotal : parts[2];
                    gpuInfo[i].temp = isNaN(parts[3]) ? null : parts[3];
                }
            });
        },
    );
}

// CPU sıcaklığı
let cpuTemp: number | null = null;
function refreshCpuTemp(): void {
    exec(
        `powershell -NoProfile -Command "Get-CimInstance -Namespace root/WMI -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty CurrentTemperature"`,
        {windowsHide: true, timeout: 8000},
        (_e, stdout) => {
            const raw = parseInt((stdout ?? "").trim(), 10);
            if (!isNaN(raw) && raw > 0) cpuTemp = Math.round(raw / 10 - 273.15);
        },
    );
}

// Top 5 process
type ProcInfo = {name: string; cpu: number; ram: number};
let topProcs: ProcInfo[] = [];
function refreshTopProcs(): void {
    exec(
        `powershell -NoProfile -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name,@{N='CPU';E={[math]::Round($_.CPU,1)}},@{N='RAM';E={[math]::Round($_.WorkingSet64/1MB,0)}} | ConvertTo-Json -Compress"`,
        {windowsHide: true, timeout: 10000},
        (_e, stdout) => {
            try {
                const raw = JSON.parse((stdout ?? "").trim());
                const arr = Array.isArray(raw) ? raw : [raw];
                topProcs = arr.map((p: {Name?: string; CPU?: number; RAM?: number}) => ({
                    name: (p.Name ?? "?").slice(0, 20),
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

const telIntervals: NodeJS.Timeout[] = [];

function startTelemetry(): void {
    refreshDisk();
    refreshBattery();
    refreshNetwork();
    initGpuStatic();
    refreshGpu();
    refreshCpuTemp();
    refreshTopProcs();
    refreshActiveWindow();
    telIntervals.push(setInterval(refreshDisk, 15000));
    telIntervals.push(setInterval(refreshBattery, 30000));
    telIntervals.push(setInterval(refreshNetwork, 4000));
    telIntervals.push(setInterval(refreshGpu, 8000));
    telIntervals.push(setInterval(refreshCpuTemp, 8000));
    telIntervals.push(setInterval(refreshTopProcs, 10000));
    telIntervals.push(setInterval(refreshActiveWindow, 5000));

    telIntervals.push(setInterval(() => {
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
            gpu: gpuInfo,
            cpuTemp,
            topProcs,
            activeWindow,
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

async function callAI(messages: OAIMessage[], onDelta?: (text: string) => void): Promise<OAICompletion> {
    const provider = currentSettings.aiProvider;
    const key = (provider === "groq") ? (process.env.GROQ_API_KEY ?? "") : currentSettings.aiApiKey;

    if (provider === "groq") {
        const stream = await groq.chat.completions.create({
            model: MODEL,
            messages: messages as ChatCompletionMessageParam[],
            tools: toolSchemas,
            stream: true,
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

    if (provider === "anthropic") {
        // Anthropic Messages API — convert to Anthropic format
        const system = messages.find((m) => m.role === "system")?.content ?? "";
        const turns = messages.filter((m) => m.role !== "system");
        const body = {
            model: MODEL,
            max_tokens: 4096,
            system,
            messages: turns.map((m) => ({role: m.role === "tool" ? "user" : m.role, content: m.role === "tool" ? [{type: "tool_result", tool_use_id: m.tool_call_id, content: m.content}] : m.content ?? ""})),
            tools: toolSchemas.map((t) => ({name: t.function?.name, description: t.function?.description, input_schema: t.function?.parameters})),
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
        return {choices: [{message: {
            content: textBlock?.text ?? null,
            tool_calls: toolBlocks.length > 0 ? toolBlocks.map((b) => ({id: b.id!, type: "function" as const, function: {name: b.name!, arguments: JSON.stringify(b.input ?? {})}})) : undefined,
        }}]};
    }

    if (provider === "ollama") {
        // Ollama — OpenAI-compatible endpoint, no auth needed, runs locally
        const ollamaUrl = (currentSettings.ollamaUrl || "http://localhost:11434") + "/v1/chat/completions";
        let resp: Response;
        try {
            resp = await fetch(ollamaUrl, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({model: MODEL, messages, tools: toolSchemas, stream: false}),
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

    // OpenAI-compatible: openai, mistral
    const endpoints: Record<string, string> = {
        openai: "https://api.openai.com/v1/chat/completions",
        mistral: "https://api.mistral.ai/v1/chat/completions",
    };
    const url = endpoints[provider] ?? endpoints.openai;
    const resp = await fetch(url, {
        method: "POST",
        headers: {"Authorization": `Bearer ${key}`, "Content-Type": "application/json"},
        body: JSON.stringify({model: MODEL, messages, tools: toolSchemas, stream: false}),
    });
    if (!resp.ok) throw new Error(`${provider} ${resp.status}: ${await resp.text()}`);
    return await resp.json() as OAICompletion;
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
    const systemContent = SYSTEM_PROMPT + profileNote + memorySummaries;
    const messages: OAIMessage[] = [{role: "system", content: systemContent}, ...history];
    const send = (channel: string, payload: object) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, {reqId, ...payload});
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

async function bootApp(): Promise<void> {
    registerQuitCallback(() => app.quit());
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

    ipcMain.on("chat-stream", async (_e, {messages, reqId}: {messages: {role: string; content: string}[]; reqId: string}) => {
        try {
            const last = messages[messages.length - 1];
            if (last?.role === "user") {
                await saveMessage("user", last.content).catch(() => {});
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
            const result = await groq.audio.transcriptions.create({
                file: Object.assign(fs.createReadStream(tmpPath), {name: "audio.webm"}),
                model: "whisper-large-v3-turbo",
                language: "tr",
                prompt: "Türkçe konuşma. Steam, Discord, YouTube, PowerShell gibi teknik kelimeler içerebilir.",
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
                // ElevenLabs TTS — uses Multilingual v2 model, voice from ttsVoice field (voice_id)
                const voiceId = currentSettings.ttsVoice.startsWith("el:") ?
                    currentSettings.ttsVoice.slice(3) :
                    "21m00Tcm4TlvDq8ikWAM"; // Rachel (default)
                const resp = await fetch(
                    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
                    {
                        method: "POST",
                        headers: {"xi-api-key": elKey, "Content-Type": "application/json"},
                        body: JSON.stringify({
                            text,
                            model_id: "eleven_multilingual_v2",
                            voice_settings: {stability: 0.5, similarity_boost: 0.75, speed: currentSettings.ttsRate},
                        }),
                    },
                );
                if (!resp.ok) throw new Error(`ElevenLabs ${resp.status}: ${await resp.text()}`);
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
        currentSettings = {...currentSettings, ...patch};
        MODEL = currentSettings.model;
        saveSettings(currentSettings);
        return currentSettings;
    });

    ipcMain.on("win-minimize", () => mainWindow?.minimize());
    ipcMain.on("win-close", () => mainWindow?.close());
    ipcMain.on("win-fullscreen", () => {
        if (!mainWindow) return;
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
    });
    ipcMain.on("win-maximize", () => {
        if (!mainWindow) return;
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    });

    createWindow();
    startTelemetry();
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
    if (isQuitting || sessionHistory.length < 2) return;
    e.preventDefault();
    isQuitting = true;
    summarizeAndSave().finally(() => {
        sessionHistory = [];
        app.quit();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
