/**
 * Faz 14 — Yerel Ağ API Sunucusu
 *
 * Node'un yerleşik http modülü (harici bağımlılık yok).
 * Endpoint'ler:
 *   GET  /api/status        → sunucu sağlık kontrolü
 *   POST /api/ask           → AEGIS'e soru sor, yanıt döndür
 *   POST /api/tts           → metin → MP3 buffer (base64)
 *   GET  /api/qr            → bağlantı bilgisi (IP + token)
 *   POST /api/token/reset   → yeni token üret
 *
 * Auth: Authorization: Bearer <token> (tüm endpoint'ler)
 * Token ~/.aegis/api-token.txt dosyasında saklanır.
 */

import * as http from "http";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const TOKEN_PATH = path.join(os.homedir(), ".aegis", "api-token.txt");
const DEFAULT_PORT = 7331;

function ensureDir(): void {
    fs.mkdirSync(path.dirname(TOKEN_PATH), {recursive: true});
}

export function loadToken(): string {
    try { return fs.readFileSync(TOKEN_PATH, "utf-8").trim(); } catch { return generateToken(); }
}

export function generateToken(): string {
    const token = crypto.randomBytes(24).toString("hex");
    ensureDir();
    fs.writeFileSync(TOKEN_PATH, token, "utf-8");
    return token;
}

function getLocalIP(): string {
    for (const ifaces of Object.values(os.networkInterfaces())) {
        for (const iface of ifaces ?? []) {
            if (iface.family === "IPv4" && !iface.internal) return iface.address;
        }
    }
    return "127.0.0.1";
}

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8"))); }
            catch { resolve({}); }
        });
        req.on("error", () => resolve({}));
    });
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
    const json = JSON.stringify(body);
    res.writeHead(status, {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"});
    res.end(json);
}

type AskHandler  = (question: string) => Promise<string>;
type TtsHandler  = (text: string)     => Promise<Buffer | null>;

let _askHandler:  AskHandler  | null = null;
let _ttsHandler:  TtsHandler  | null = null;

export function registerAskHandler(fn: AskHandler):  void { _askHandler  = fn; }
export function registerTtsHandler(fn: TtsHandler):  void { _ttsHandler  = fn; }

// SSE clients
const sseClients = new Set<http.ServerResponse>();

export function broadcastFeedEvent(type: "delta" | "done" | "tool" | "user", data: unknown): void {
    const payload = `data: ${JSON.stringify({type, data})}\n\n`;
    for (const client of sseClients) {
        try { client.write(payload); } catch { sseClients.delete(client); }
    }
}

// Minimal web UI HTML
function buildWebUI(ip: string, port: number): string {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AEGIS Web</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#04070d;color:#22d3ee;font-family:'JetBrains Mono',monospace;height:100dvh;display:flex;flex-direction:column}
#hdr{padding:12px 16px;border-bottom:1px solid rgba(34,211,238,0.15);font-size:13px;letter-spacing:.2em;opacity:.7}
#feed{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.msg{max-width:90%;padding:10px 14px;border-radius:10px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.user{align-self:flex-end;background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.25)}
.ai{align-self:flex-start;background:rgba(34,211,238,0.05);border:1px solid rgba(34,211,238,0.1)}
.tool{align-self:flex-start;font-size:11px;opacity:.5;padding:4px 10px;border:1px solid rgba(34,211,238,0.08);border-radius:6px}
#bar{padding:12px;border-top:1px solid rgba(34,211,238,0.1);display:flex;gap:8px}
#inp{flex:1;background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.2);color:#22d3ee;padding:10px 14px;border-radius:8px;font-size:13px;outline:none}
#btn{padding:10px 20px;background:rgba(34,211,238,0.15);border:1px solid rgba(34,211,238,0.35);color:#22d3ee;border-radius:8px;cursor:pointer;font-size:12px;letter-spacing:.1em}
#tok{padding:8px 14px;font-size:11px;opacity:.4;border-top:1px solid rgba(34,211,238,0.06)}
</style>
</head>
<body>
<div id="hdr">AEGIS · Web Arayüzü</div>
<div id="feed"></div>
<div id="bar">
  <input id="inp" type="text" placeholder="Mesajını yaz…" autocomplete="off"/>
  <button id="btn" onclick="sendMsg()">GÖNDER</button>
</div>
<div id="tok">Token: <input id="tkf" type="password" placeholder="Bearer token" style="background:transparent;border:none;color:#22d3ee;font-size:11px;width:220px;outline:none"/></div>
<script>
const feed = document.getElementById('feed');
const inp  = document.getElementById('inp');
const tkf  = document.getElementById('tkf');
let token = localStorage.getItem('aegis_token') || '';
tkf.value = token;
tkf.addEventListener('change', () => { token = tkf.value.trim(); localStorage.setItem('aegis_token', token); connectSSE(); });

let curAI = null;
function addMsg(role, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  d.textContent = text;
  feed.appendChild(d);
  feed.scrollTop = feed.scrollHeight;
  return d;
}

function connectSSE() {
  if (!token) return;
  const es = new EventSource('/events?token=' + encodeURIComponent(token));
  es.onmessage = e => {
    try {
      const {type, data} = JSON.parse(e.data);
      if (type === 'user') addMsg('user', data.text);
      else if (type === 'delta') {
        if (!curAI) curAI = addMsg('ai', '');
        curAI.textContent += data.text;
        feed.scrollTop = feed.scrollHeight;
      } else if (type === 'done') { curAI = null; }
      else if (type === 'tool') addMsg('tool', '⚙ ' + data.name + ' ' + (data.phase === 'done' ? '✓' : '…'));
    } catch {}
  };
  es.onerror = () => { setTimeout(connectSSE, 3000); es.close(); };
}
connectSSE();

async function sendMsg() {
  const text = inp.value.trim();
  if (!text || !token) { alert('Mesaj ve token gerekli.'); return; }
  inp.value = '';
  try {
    await fetch('/api/ask', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
      body: JSON.stringify({text})
    });
  } catch(e) { addMsg('ai', 'HATA: ' + e.message); }
}
inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
</script>
</body>
</html>`;
}

let server: http.Server | null = null;

export function startApiServer(port = DEFAULT_PORT): string {
    if (server) return `API sunucusu zaten çalışıyor (port ${port}).`;

    const token = loadToken();
    const ip    = getLocalIP();

    server = http.createServer(async (req, res) => {
        // CORS preflight
        if (req.method === "OPTIONS") {
            res.writeHead(204, {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization,Content-Type", "Access-Control-Allow-Methods": "GET,POST"});
            res.end(); return;
        }

        const url = (req.url ?? "/").split("?")[0];
        const query = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");

        // Web UI (no auth for HTML)
        if ((url === "/" || url === "/index.html") && req.method === "GET") {
            res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
            res.end(buildWebUI(ip, port)); return;
        }

        // Health check (no auth)
        if (url === "/api/status" && req.method === "GET") {
            send(res, 200, {ok: true, version: "1.0", ip, port}); return;
        }

        // SSE — auth via query param (browsers can't set headers on EventSource)
        if (url === "/events" && req.method === "GET") {
            const t = query.get("token") ?? "";
            if (t !== token) { send(res, 401, {error: "Yetkisiz."}); return; }
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
            });
            res.write(": connected\n\n");
            sseClients.add(res);
            req.on("close", () => sseClients.delete(res));
            return;
        }

        // Auth
        const authHeader = req.headers["authorization"] ?? "";
        const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (provided !== token) { send(res, 401, {error: "Yetkisiz. Geçerli token gerekli."}); return; }

        // POST /api/ask
        if (url === "/api/ask" && req.method === "POST") {
            const body = await parseBody(req);
            const question = String(body.text ?? body.question ?? "").trim();
            if (!question) { send(res, 400, {error: "text alanı gerekli."}); return; }
            try {
                const answer = await (_askHandler?.(question) ?? Promise.resolve("AEGIS bağlı değil."));
                send(res, 200, {answer});
            } catch (e) {
                send(res, 500, {error: (e as Error).message});
            }
            return;
        }

        // POST /api/tts
        if (url === "/api/tts" && req.method === "POST") {
            const body = await parseBody(req);
            const text = String(body.text ?? "").trim();
            if (!text) { send(res, 400, {error: "text alanı gerekli."}); return; }
            try {
                const buf = await (_ttsHandler?.(text) ?? Promise.resolve(null));
                if (!buf) { send(res, 503, {error: "TTS kullanılamıyor."}); return; }
                send(res, 200, {audio: buf.toString("base64"), format: "mp3"});
            } catch (e) {
                send(res, 500, {error: (e as Error).message});
            }
            return;
        }

        // GET /api/qr — bağlantı bilgisi
        if (url === "/api/qr" && req.method === "GET") {
            send(res, 200, {ip, port, token, url: `http://${ip}:${port}`}); return;
        }

        // POST /api/token/reset
        if (url === "/api/token/reset" && req.method === "POST") {
            const newToken = generateToken();
            send(res, 200, {token: newToken, message: "Yeni token oluşturuldu. Cihazları yeniden bağla."}); return;
        }

        send(res, 404, {error: "Endpoint bulunamadı."});
    });

    server.listen(port, "0.0.0.0", () => {
        console.log(`[API] http://${ip}:${port} → token: ${token.slice(0, 8)}…`);
    });

    server.on("error", (e: NodeJS.ErrnoException) => {
        if (e.code === "EADDRINUSE") console.warn(`[API] Port ${port} kullanımda, sunucu başlatılamadı.`);
        else console.error("[API] Sunucu hatası:", e.message);
        server = null;
    });

    return `API sunucusu başlatıldı: http://${ip}:${port}`;
}

export function stopApiServer(): void {
    server?.close();
    server = null;
}

export function getApiInfo(): {ip: string; port: number; token: string; running: boolean} {
    return {ip: getLocalIP(), port: DEFAULT_PORT, token: loadToken(), running: server !== null};
}
