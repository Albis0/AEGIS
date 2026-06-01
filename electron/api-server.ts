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

        const url = req.url ?? "/";

        // Health check (no auth)
        if (url === "/api/status" && req.method === "GET") {
            send(res, 200, {ok: true, version: "1.0", ip, port}); return;
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
