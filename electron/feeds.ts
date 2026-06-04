import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as https from "https";
import * as http from "http";

const FEEDS_PATH = path.join(os.homedir(), ".aegis", "feeds.json");
const PORTFOLIO_PATH = path.join(os.homedir(), ".aegis", "portfolio.json");
const PRICE_ALERTS_PATH = path.join(os.homedir(), ".aegis", "price-alerts.json");

interface Feed { url: string; label: string; addedAt: string; }
interface PriceAlert { symbol: string; type: "crypto" | "stock" | "fx"; above?: number; below?: number; }

function load<T>(p: string, def: T): T {
    try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return def; }
}
function save(p: string, data: unknown): void {
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function httpGet(url: string, timeoutMs = 8000): Promise<string> {
    return new Promise((res, rej) => {
        const mod = url.startsWith("https") ? https : http;
        const req = mod.get(url, {headers: {"User-Agent": "AEGIS/1.0"}}, (r) => {
            let data = "";
            r.on("data", (chunk) => { data += chunk; if (data.length > 500000) req.destroy(); });
            r.on("end", () => res(data));
        });
        req.setTimeout(timeoutMs, () => { req.destroy(); rej(new Error("timeout")); });
        req.on("error", rej);
    });
}

function parseRss(xml: string, maxItems: number): string[] {
    const results: string[] = [];
    const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const titleRe = /<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i;
    const linkRe = /<link[^>]*>(.*?)<\/link>/i;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) !== null && results.length < maxItems) {
        const block = m[1];
        const title = titleRe.exec(block)?.[1]?.trim() ?? "(başlık yok)";
        const link = linkRe.exec(block)?.[1]?.trim() ?? "";
        results.push(link ? `${title}\n  ${link}` : title);
    }
    // Try Atom <entry>
    if (results.length === 0) {
        const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
        while ((m = entryRe.exec(xml)) !== null && results.length < maxItems) {
            const block = m[1];
            const title = titleRe.exec(block)?.[1]?.trim() ?? "(başlık yok)";
            results.push(title);
        }
    }
    return results;
}

export function rssAdd(url: string, label: string): string {
    if (!url.startsWith("http")) return "HATA: Geçerli bir RSS/Atom URL girin.";
    const feeds: Feed[] = load(FEEDS_PATH, []);
    if (feeds.find((f) => f.url === url)) return `Feed zaten kayıtlı: ${url}`;
    feeds.push({url, label: label || url, addedAt: new Date().toISOString()});
    save(FEEDS_PATH, feeds);
    return `Feed eklendi: "${label || url}"`;
}

export function rssRemove(url: string): string {
    const feeds: Feed[] = load(FEEDS_PATH, []);
    const before = feeds.length;
    const filtered = feeds.filter((f) => f.url !== url && f.label !== url);
    save(FEEDS_PATH, filtered);
    return before === filtered.length ? "Feed bulunamadı." : "Feed silindi.";
}

export function rssList(): string {
    const feeds: Feed[] = load(FEEDS_PATH, []);
    if (feeds.length === 0) return "Kayıtlı feed yok. rss_add ile ekle.";
    return feeds.map((f, i) => `${i + 1}. ${f.label}\n   ${f.url}`).join("\n");
}

export async function rssFetch(count: number): Promise<string> {
    const feeds: Feed[] = load(FEEDS_PATH, []);
    if (feeds.length === 0) return "Kayıtlı feed yok. rss_add ile ekle.";
    const itemsPerFeed = Math.max(3, Math.floor((count || 10) / feeds.length));
    const results: string[] = [];
    for (const feed of feeds) {
        try {
            const xml = await httpGet(feed.url);
            const items = parseRss(xml, itemsPerFeed);
            results.push(`── ${feed.label} ──\n${items.join("\n")}`);
        } catch (e) {
            results.push(`── ${feed.label} ── (HATA: ${(e as Error).message})`);
        }
    }
    return results.join("\n\n");
}

export async function getPrice(symbols: string): Promise<string> {
    const syms = symbols.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    const results: string[] = [];
    for (const sym of syms) {
        try {
            const data = await httpGet(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`);
            const j = JSON.parse(data);
            const price = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
            const currency = j?.chart?.result?.[0]?.meta?.currency ?? "";
            if (price != null) results.push(`${sym}: ${price.toFixed(2)} ${currency}`);
            else results.push(`${sym}: fiyat alınamadı`);
        } catch {
            results.push(`${sym}: HATA (Yahoo Finance erişilemedi)`);
        }
    }
    return results.join("\n");
}

export async function getCryptoPrice(coins: string): Promise<string> {
    const ids = coins.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
    try {
        const data = await httpGet(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd,try`);
        const j = JSON.parse(data);
        return Object.entries(j).map(([coin, prices]) => {
            const p = prices as Record<string, number>;
            return `${coin.toUpperCase()}: $${p.usd?.toLocaleString("en-US")} / ₺${p.try?.toLocaleString("tr-TR")}`;
        }).join("\n") || "Sonuç bulunamadı.";
    } catch (e) {
        return `HATA: ${(e as Error).message}`;
    }
}

export async function getFxRate(pairs: string): Promise<string> {
    const pairList = pairs.split(",").map((p) => p.trim().toUpperCase());
    try {
        const data = await httpGet("https://api.exchangerate-api.com/v4/latest/USD");
        const j = JSON.parse(data);
        const rates = j.rates ?? {};
        return pairList.map((pair) => {
            const [from, to] = pair.includes("/") ? pair.split("/") : [pair.slice(0, 3), pair.slice(3)];
            const fromRate = from === "USD" ? 1 : (1 / (rates[from] ?? NaN));
            const toRate = to === "USD" ? 1 : (rates[to] ?? NaN);
            const rate = fromRate * toRate;
            return isNaN(rate) ? `${pair}: bilinmiyor` : `${from}/${to}: ${rate.toFixed(4)}`;
        }).join("\n");
    } catch (e) {
        return `HATA: ${(e as Error).message}`;
    }
}

export function priceAlertSet(symbol: string, type: "crypto" | "stock" | "fx", above?: number, below?: number): string {
    const alerts: PriceAlert[] = load(PRICE_ALERTS_PATH, []);
    alerts.push({symbol, type, above, below});
    save(PRICE_ALERTS_PATH, alerts);
    const cond = [above != null ? `>${above}` : null, below != null ? `<${below}` : null].filter(Boolean).join(" veya ");
    return `Fiyat aleti eklendi: ${symbol} ${cond}`;
}

export function portfolioSummary(): string {
    const portfolio: Record<string, number> = load(PORTFOLIO_PATH, {});
    if (Object.keys(portfolio).length === 0) return "Portföy boş. portfolio_add ile sembol ekle.";
    return "Portföy listesi: " + Object.entries(portfolio).map(([sym, qty]) => `${sym}×${qty}`).join(", ") + ". Anlık fiyat için price_get kullan.";
}
