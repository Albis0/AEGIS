import {describe, it, expect} from "vitest";
import {
    getNetworkInfo,
    buildMdnsQuery,
    parseDnsName,
    parseMdnsResponse,
    classifyMdns,
    buildSsdpSearch,
    parseSsdpResponse,
    formatDevices,
    discoverAll,
    type DiscoveredDevice,
} from "../../electron/local-devices";

// ─────────────────────────────────────────────────────────────────────────────
// local-devices: discovers devices on the home network without HA. UDP sockets
// don't get real responses in CI; so what's ACTUALLY tested is the packet
// building + parsing logic (pure, no mocks). We also verify that discoverAll
// returns an empty list and doesn't throw in a no-permission environment.
// ─────────────────────────────────────────────────────────────────────────────

describe("getNetworkInfo", () => {
    it("returns non-internal IPv4 interfaces, does not throw", () => {
        const net = getNetworkInfo();
        expect(Array.isArray(net.interfaces)).toBe(true);
        for (const i of net.interfaces) {
            expect(typeof i.address).toBe("string");
            expect(i.address).not.toMatch(/^127\./); // loopback should be excluded
        }
    });
});

describe("buildMdnsQuery", () => {
    it("produces a valid DNS header (QDCOUNT=1, PTR query)", () => {
        const q = buildMdnsQuery();
        expect(q.length).toBeGreaterThan(12);
        expect(q.readUInt16BE(4)).toBe(1);          // QDCOUNT
        // last 4 bytes: QTYPE=PTR(12) + QCLASS=IN(1)
        expect(q.readUInt16BE(q.length - 4)).toBe(12);
        expect(q.readUInt16BE(q.length - 2)).toBe(1);
    });

    it("encodes a custom service name into labels", () => {
        const q = buildMdnsQuery("_googlecast._tcp.local");
        // "_googlecast" label: length 11 + content
        const idx = q.indexOf(Buffer.from("_googlecast", "utf8"));
        expect(idx).toBeGreaterThan(0);
        expect(q[idx - 1]).toBe(11); // length prefix
    });
});

describe("parseDnsName", () => {
    it("reads length-prefixed labels", () => {
        // 0x03 f o o 0x05 l o c a l 0x00
        const buf = Buffer.from([3, 0x66, 0x6f, 0x6f, 5, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0]);
        const {name, next} = parseDnsName(buf, 0);
        expect(name).toBe("foo.local");
        expect(next).toBe(buf.length);
    });

    it("follows a 0xC0 compression pointer", () => {
        // offset 0: "local\0"; offset 7: pointer → offset 0
        const buf = Buffer.alloc(10);
        buf[0] = 5; buf.write("local", 1); buf[6] = 0;
        buf[7] = 0xc0; buf[8] = 0x00; // pointer to offset 0x00
        const {name} = parseDnsName(buf, 7);
        expect(name).toBe("local");
    });

    it("safely terminates on a malformed/infinite-loop packet", () => {
        const buf = Buffer.from([0xc0, 0x00]); // pointer pointing to itself
        const {name} = parseDnsName(buf, 0);
        expect(typeof name).toBe("string"); // no throw or hang
    });
});

describe("parseMdnsResponse", () => {
    it("extracts the service name from a real PTR response", () => {
        // Manually build an mDNS response: header + 1 answer (PTR)
        const header = Buffer.from([0, 0, 0x84, 0, 0, 0, 0, 1, 0, 0, 0, 0]); // ANCOUNT=1
        // name: "_googlecast._tcp.local"
        const encodeName = (n: string) => {
            const parts: Buffer[] = [];
            for (const p of n.split(".")) { parts.push(Buffer.from([p.length]), Buffer.from(p)); }
            parts.push(Buffer.from([0]));
            return Buffer.concat(parts);
        };
        const recName = encodeName("_googlecast._tcp.local");
        const rdata = encodeName("Living-Room._googlecast._tcp.local");
        const rr = Buffer.concat([
            recName,
            Buffer.from([0, 12]),       // TYPE = PTR
            Buffer.from([0, 1]),        // CLASS = IN
            Buffer.from([0, 0, 0, 60]), // TTL
            Buffer.from([(rdata.length >> 8) & 0xff, rdata.length & 0xff]), // RDLENGTH
            rdata,
        ]);
        const pkt = Buffer.concat([header, rr]);
        const names = parseMdnsResponse(pkt);
        expect(names).toContain("Living-Room._googlecast._tcp.local");
    });

    it("returns empty for very short packets", () => {
        expect(parseMdnsResponse(Buffer.from([0, 0]))).toEqual([]);
    });
});

describe("classifyMdns", () => {
    it("classifies known service types", () => {
        expect(classifyMdns("Salon._googlecast._tcp.local").kind).toBe("chromecast");
        expect(classifyMdns("AppleTV._airplay._tcp.local").kind).toBe("airplay");
        expect(classifyMdns("HP._ipp._tcp.local").kind).toBe("printer");
        expect(classifyMdns("NAS._smb._tcp.local").kind).toBe("nas");
    });

    it("unknown service → mdns", () => {
        expect(classifyMdns("Foo._weird._tcp.local").kind).toBe("mdns");
    });

    it("extracts a human-readable name", () => {
        expect(classifyMdns("Living Room._googlecast._tcp.local").name).toBe("Living Room");
    });
});

describe("buildSsdpSearch", () => {
    it("produces a valid M-SEARCH packet", () => {
        const s = buildSsdpSearch().toString("utf8");
        expect(s).toContain("M-SEARCH * HTTP/1.1");
        expect(s).toContain('MAN: "ssdp:discover"');
        expect(s).toContain("HOST: 239.255.255.250:1900");
        // the backslash-escape hack must not leak through
        expect(s).not.toContain("\\MAN");
    });
});

describe("parseSsdpResponse", () => {
    it("recognizes a TV device from the ST header", () => {
        const resp = [
            "HTTP/1.1 200 OK",
            "ST: urn:schemas-upnp-org:device:MediaRenderer:1",
            "SERVER: Linux/4.0 UPnP/1.0 SmartTV/2.0",
            "USN: uuid:1234::urn:...",
            "",
        ].join("\r\n");
        const dev = parseSsdpResponse(resp, "192.168.1.50");
        expect(dev).not.toBeNull();
        expect(dev!.kind).toBe("tv");
        expect(dev!.address).toBe("192.168.1.50");
        expect(dev!.protocol).toBe("ssdp");
    });

    it("recognizes a router/gateway", () => {
        const resp = "HTTP/1.1 200 OK\r\nST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n\r\n";
        expect(parseSsdpResponse(resp, "192.168.1.1")!.kind).toBe("router");
    });

    it("headerless/empty response → null", () => {
        expect(parseSsdpResponse("garbage data", "1.2.3.4")).toBeNull();
    });
});

describe("formatDevices", () => {
    it("gives a meaningful message for an empty list", () => {
        const txt = formatDevices([], {interfaces: [], primary: "192.168.1.5"});
        expect(txt).toContain("192.168.1.5");
        expect(txt.toLowerCase()).toContain("no devices");
    });

    it("groups devices by kind", () => {
        const devs: DiscoveredDevice[] = [
            {name: "Salon TV", address: "192.168.1.10", kind: "tv", protocol: "ssdp"},
            {name: "Mutfak", address: "192.168.1.11", kind: "chromecast", protocol: "mdns"},
        ];
        const txt = formatDevices(devs, {interfaces: [], primary: "192.168.1.5"});
        expect(txt).toContain("2 devices found");
        expect(txt).toContain("Salon TV");
        expect(txt).toContain("tv:");
        expect(txt).toContain("chromecast:");
    });
});

describe("discoverAll (no permission/CI environment)", () => {
    it("completes quickly without throwing", async () => {
        const devices = await discoverAll(300);
        expect(Array.isArray(devices)).toBe(true);
    }, 10_000);
});
