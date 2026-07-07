import {describe, it, expect} from "vitest";
import {extractPlainText, buildRawEmail, type MimePart} from "../../electron/google";

const b64url = (s: string) => Buffer.from(s, "utf-8").toString("base64url");

describe("google — MIME parsing", () => {
    it("reads a flat text/plain body", () => {
        const part: MimePart = {mimeType: "text/plain", body: {data: b64url("merhaba dünya")}};
        expect(extractPlainText(part)).toBe("merhaba dünya");
    });

    it("finds text/plain inside multipart/alternative", () => {
        const part: MimePart = {
            mimeType: "multipart/alternative",
            parts: [
                {mimeType: "text/html", body: {data: b64url("<b>hi</b>")}},
                {mimeType: "text/plain", body: {data: b64url("hi")}},
            ],
        };
        expect(extractPlainText(part)).toBe("hi");
    });

    it("falls back to stripped HTML when no text/plain exists", () => {
        const part: MimePart = {mimeType: "text/html", body: {data: b64url("<p>Hello <b>world</b></p><style>p{}</style>")}};
        expect(extractPlainText(part)).toBe("Hello world");
    });

    it("returns empty for undefined/empty parts", () => {
        expect(extractPlainText(undefined)).toBe("");
        expect(extractPlainText({})).toBe("");
    });
});

describe("google — raw email builder", () => {
    it("produces a base64url RFC 2822 message with UTF-8 subject round-trip", () => {
        const raw = buildRawEmail("a@b.com", "Merhaba Şölen", "gövde çğüö");
        const decoded = Buffer.from(raw, "base64url").toString("utf-8");
        expect(decoded).toContain("To: a@b.com");
        // Subject is RFC 2047 encoded — decode and verify
        const m = decoded.match(/Subject: =\?UTF-8\?B\?(.+)\?=/);
        expect(m).not.toBeNull();
        expect(Buffer.from(m![1], "base64").toString("utf-8")).toBe("Merhaba Şölen");
        // Body is base64 after the blank line
        const body = decoded.split("\r\n\r\n")[1];
        expect(Buffer.from(body, "base64").toString("utf-8")).toBe("gövde çğüö");
        // base64url must not contain +, / or =
        expect(raw).not.toMatch(/[+/=]/);
    });
});
