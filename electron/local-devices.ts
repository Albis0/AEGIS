// AEGIS — Yerel Ağ Cihaz Keşfi (Local Device Discovery)
//
// Home Assistant GEREKTİRMEDEN ev ağındaki cihazları bulur. Kullanıcı hiçbir şey
// kurmadan "evdeki cihazları göster" diyebilsin diye. İki standart protokol:
//
//   • mDNS / Bonjour (UDP 5353, 224.0.0.251) — Chromecast, AirPlay, HomeKit,
//     yazıcılar, NAS, çoğu IoT cihazı kendini buradan duyurur.
//   • SSDP / UPnP   (UDP 1900, 239.255.255.250) — akıllı TV, DLNA medya
//     sunucuları, router, oyun konsolu.
//
// Tamamen Node yerleşik `dgram` + `os` ile; harici bağımlılık yok. Saf I/O —
// Electron'a bağımlı değil, bu yüzden test edilebilir (parse fonksiyonları mock'suz).

import * as dgram from "dgram";
import * as os from "os";

export interface DiscoveredDevice {
    name: string;            // okunabilir ad ("Living Room TV", "HP-Printer")
    address: string;         // IP (biliniyorsa)
    kind: string;            // "chromecast" | "airplay" | "printer" | "tv" | "upnp" | "mdns" …
    protocol: "mdns" | "ssdp";
    detail?: string;         // servis tipi / model / ek bilgi
}

// ── Ağ özeti (kendi IP / subnet) ────────────────────────────────────────────
export interface NetworkInfo {
    interfaces: {name: string; address: string; netmask: string; cidr: string}[];
    primary?: string;        // dışa açık (internal olmayan) IPv4
}

export function getNetworkInfo(): NetworkInfo {
    const ifaces = os.networkInterfaces();
    const out: NetworkInfo["interfaces"] = [];
    let primary: string | undefined;
    for (const [name, addrs] of Object.entries(ifaces)) {
        for (const a of addrs ?? []) {
            if (a.family !== "IPv4" || a.internal) continue;
            out.push({name, address: a.address, netmask: a.netmask, cidr: a.cidr ?? ""});
            if (!primary) primary = a.address;
        }
    }
    return {interfaces: out, primary};
}

// ── mDNS sorgu paketi ───────────────────────────────────────────────────────
// "_services._dns-sd._udp.local" PTR sorgusu → ağdaki tüm servis tiplerini ister.
// Standart bir mDNS keşif paketi (RFC 6763 §9). Elle kuruyoruz; kütüphane yok.
export function buildMdnsQuery(serviceName = "_services._dns-sd._udp.local"): Buffer {
    const header = Buffer.from([
        0x00, 0x00, // ID = 0
        0x00, 0x00, // flags = standart sorgu
        0x00, 0x01, // QDCOUNT = 1
        0x00, 0x00, // ANCOUNT
        0x00, 0x00, // NSCOUNT
        0x00, 0x00, // ARCOUNT
    ]);
    const labels: Buffer[] = [];
    for (const part of serviceName.split(".")) {
        if (!part) continue;
        const b = Buffer.from(part, "utf8");
        labels.push(Buffer.from([b.length]), b);
    }
    labels.push(Buffer.from([0x00])); // kök etiketi
    const question = Buffer.concat([
        ...labels,
        Buffer.from([0x00, 0x0c]), // QTYPE = PTR
        Buffer.from([0x00, 0x01]), // QCLASS = IN
    ]);
    return Buffer.concat([header, question]);
}

// ── mDNS yanıt çözümleme ────────────────────────────────────────────────────
// DNS adlarını (etiket uzunluğu önekli + 0xC0 işaretçi sıkıştırması) okur.
export function parseDnsName(buf: Buffer, offset: number): {name: string; next: number} {
    const parts: string[] = [];
    let pos = offset;
    let jumped = false;
    let next = offset;
    let safety = 0;
    while (pos < buf.length && safety++ < 128) {
        const len = buf[pos];
        if (len === 0) { if (!jumped) next = pos + 1; break; }
        if ((len & 0xc0) === 0xc0) {
            // sıkıştırma işaretçisi → 14-bit offset'e atla
            const ptr = ((len & 0x3f) << 8) | buf[pos + 1];
            if (!jumped) next = pos + 2;
            pos = ptr;
            jumped = true;
            continue;
        }
        pos += 1;
        if (pos + len > buf.length) break;
        parts.push(buf.toString("utf8", pos, pos + len));
        pos += len;
    }
    return {name: parts.join("."), next};
}

// Bir mDNS yanıt paketindeki PTR/SRV/A kayıtlarından servis adlarını çıkarır.
export function parseMdnsResponse(buf: Buffer): string[] {
    const names = new Set<string>();
    if (buf.length < 12) return [];
    const qd = buf.readUInt16BE(4);
    const an = buf.readUInt16BE(6);
    const ns = buf.readUInt16BE(8);
    const ar = buf.readUInt16BE(10);
    let pos = 12;
    // Soruları atla
    for (let i = 0; i < qd && pos < buf.length; i++) {
        const {next} = parseDnsName(buf, pos);
        pos = next + 4; // QTYPE + QCLASS
    }
    const total = an + ns + ar;
    for (let i = 0; i < total && pos < buf.length; i++) {
        const {next} = parseDnsName(buf, pos);
        pos = next;
        if (pos + 10 > buf.length) break;
        const type = buf.readUInt16BE(pos);
        const rdlength = buf.readUInt16BE(pos + 8);
        pos += 10;
        if (type === 12) {
            // PTR → rdata da bir DNS adı
            const {name} = parseDnsName(buf, pos);
            if (name) names.add(name);
        }
        pos += rdlength;
    }
    return [...names];
}

// mDNS servis tipinden okunabilir cihaz türü çıkar.
export function classifyMdns(service: string): {kind: string; name: string} {
    const s = service.toLowerCase();
    const map: [RegExp, string][] = [
        [/_googlecast/, "chromecast"],
        [/_airplay|_raop/, "airplay"],
        [/_homekit|_hap/, "homekit"],
        [/_ipp|_printer|_pdl/, "printer"],
        [/_spotify-connect/, "speaker"],
        [/_sonos/, "speaker"],
        [/_smb|_afpovertcp|_nfs/, "nas"],
        [/_ssh|_sftp/, "computer"],
        [/_http|_https/, "web-device"],
    ];
    let kind = "mdns";
    for (const [re, k] of map) { if (re.test(s)) { kind = k; break; } }
    // Servis adından insan-okur kısmı al ("Living Room._googlecast._tcp.local" → "Living Room")
    const human = service.split(".")[0]?.replace(/\\.*$/, "").trim() || service;
    return {kind, name: human};
}

// ── SSDP M-SEARCH paketi ────────────────────────────────────────────────────
export function buildSsdpSearch(target = "ssdp:all", mx = 2): Buffer {
    const msg =
        "M-SEARCH * HTTP/1.1\r\n" +
        "HOST: 239.255.255.250:1900\r\n" +
        'MAN: "ssdp:discover"\r\n' +
        `MX: ${mx}\r\n` +
        `ST: ${target}\r\n` +
        "\r\n";
    return Buffer.from(msg, "utf8");
}

// SSDP yanıtından okunabilir cihaz bilgisi çıkar.
export function parseSsdpResponse(text: string, address: string): DiscoveredDevice | null {
    if (!/^HTTP\/1\.\d\s+200/i.test(text) && !/^NOTIFY/i.test(text)) {
        // İlk satır 200 OK veya NOTIFY değilse de devam et (bazı cihazlar farklı)
    }
    const headers: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
        const idx = line.indexOf(":");
        if (idx > 0) headers[line.slice(0, idx).trim().toUpperCase()] = line.slice(idx + 1).trim();
    }
    const st = headers["ST"] || headers["NT"] || "";
    const server = headers["SERVER"] || "";
    const usn = headers["USN"] || "";
    if (!st && !server && !usn) return null;

    const s = (st + " " + server + " " + usn).toLowerCase();
    let kind = "upnp";
    if (/mediarenderer|dial|dlna|tv/.test(s)) kind = "tv";
    else if (/internetgatewaydevice|router|wanconnection/.test(s)) kind = "router";
    else if (/mediaserver/.test(s)) kind = "media-server";
    else if (/printer/.test(s)) kind = "printer";

    const name = server.split(/[,/]/)[0]?.trim() || st || "UPnP cihazı";
    return {name, address, kind, protocol: "ssdp", detail: st || server};
}

// ── Canlı tarama (UDP) ──────────────────────────────────────────────────────
// Belirtilen süre boyunca dinler; bağlantısı/izni olmayan ortamda (CI) hata
// fırlatmaz, boş liste döner. Gerçek ağda cihazları toplar.
export function discoverMdns(durationMs = 3000): Promise<DiscoveredDevice[]> {
    return new Promise((resolve) => {
        const found = new Map<string, DiscoveredDevice>();
        let sock: dgram.Socket;
        try {
            sock = dgram.createSocket({type: "udp4", reuseAddr: true});
        } catch { resolve([]); return; }

        const done = () => {
            try { sock.close(); } catch { /* zaten kapalı */ }
            resolve([...found.values()]);
        };
        const timer = setTimeout(done, durationMs);

        sock.on("error", () => { clearTimeout(timer); try { sock.close(); } catch {} resolve([...found.values()]); });
        sock.on("message", (msg, rinfo) => {
            try {
                const services = parseMdnsResponse(msg);
                for (const svc of services) {
                    const {kind, name} = classifyMdns(svc);
                    found.set(svc, {name, address: rinfo.address, kind, protocol: "mdns", detail: svc});
                }
            } catch { /* bozuk paket → atla */ }
        });
        sock.bind(() => {
            try {
                sock.addMembership("224.0.0.251");
            } catch { /* multicast üyeliği başarısız → yine de yanıt gelebilir */ }
            const q = buildMdnsQuery();
            sock.send(q, 0, q.length, 5353, "224.0.0.251", (e) => { if (e) { /* gönderim hatası → timeout'a kadar dinle */ } });
        });
    });
}

export function discoverSsdp(durationMs = 3000): Promise<DiscoveredDevice[]> {
    return new Promise((resolve) => {
        const found = new Map<string, DiscoveredDevice>();
        let sock: dgram.Socket;
        try {
            sock = dgram.createSocket({type: "udp4", reuseAddr: true});
        } catch { resolve([]); return; }

        const done = () => {
            try { sock.close(); } catch {}
            resolve([...found.values()]);
        };
        const timer = setTimeout(done, durationMs);

        sock.on("error", () => { clearTimeout(timer); try { sock.close(); } catch {} resolve([...found.values()]); });
        sock.on("message", (msg, rinfo) => {
            const dev = parseSsdpResponse(msg.toString("utf8"), rinfo.address);
            if (dev) found.set(rinfo.address + "|" + dev.detail, dev);
        });
        sock.bind(() => {
            const q = buildSsdpSearch();
            sock.send(q, 0, q.length, 1900, "239.255.255.250", () => { /* yanıtlar mesaj olayında */ });
        });
    });
}

/** Hem mDNS hem SSDP'yi paralel tara, sonuçları birleştir + IP'ye göre tekille. */
export async function discoverAll(durationMs = 3000): Promise<DiscoveredDevice[]> {
    const [mdns, ssdp] = await Promise.all([
        discoverMdns(durationMs).catch(() => []),
        discoverSsdp(durationMs).catch(() => []),
    ]);
    const merged = [...mdns, ...ssdp];
    // Aynı IP+kind tekrarını ele
    const seen = new Set<string>();
    const out: DiscoveredDevice[] = [];
    for (const d of merged) {
        const key = `${d.address}|${d.kind}|${d.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(d);
    }
    return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

/** Keşfedilen cihazları LLM/kullanıcı için okunabilir metne çevir. */
export function formatDevices(devices: DiscoveredDevice[], net: NetworkInfo): string {
    const lines: string[] = [];
    if (net.primary) lines.push(`Bu cihaz: ${net.primary}`);
    if (devices.length === 0) {
        lines.push("Ağda mDNS/SSDP ile duyuran cihaz bulunamadı. (Cihazlar farklı VLAN'da olabilir veya keşif yayınına yanıt vermiyor olabilir.)");
        return lines.join("\n");
    }
    const byKind = new Map<string, DiscoveredDevice[]>();
    for (const d of devices) {
        const arr = byKind.get(d.kind) ?? [];
        arr.push(d);
        byKind.set(d.kind, arr);
    }
    lines.push(`${devices.length} cihaz bulundu:`);
    for (const [kind, arr] of [...byKind.entries()].sort()) {
        lines.push(`\n${kind}:`);
        for (const d of arr) lines.push(`  • ${d.name}${d.address ? " (" + d.address + ")" : ""}`);
    }
    return lines.join("\n");
}
