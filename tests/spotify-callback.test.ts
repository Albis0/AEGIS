import {describe, it, expect} from "vitest";
import {__callbackPageForTest as callbackPage} from "../electron/spotify";

describe("Spotify callback page", () => {
    it("success: contains the AEGIS brand, title, and UTF-8 meta", () => {
        const html = callbackPage({ok: true, title: "Spotify bağlandı", sub: "AEGIS artık müziğini kontrol edebilir."});
        expect(html).toContain("<!doctype html>");
        expect(html).toContain('charset="utf-8"');
        expect(html).toContain("AEGIS");
        expect(html).toContain("Spotify bağlandı");           // Turkish characters are preserved
        expect(html).toContain("AEGIS artık müziğini kontrol edebilir.");
        // success color (emerald) — check icon
        expect(html).toContain("52, 211, 153");
    });

    it("error: shows red theme and the error message", () => {
        const html = callbackPage({ok: false, title: "Bağlantı başarısız", sub: "invalid_grant"});
        expect(html).toContain("Bağlantı başarısız");
        expect(html).toContain("invalid_grant");
        expect(html).toContain("248, 113, 113");              // red-400
    });

    it("not plain Times New Roman — uses the dark brand background", () => {
        const html = callbackPage({ok: true, title: "x", sub: "y"});
        expect(html).toContain("#0a0e17");                    // brand background
        expect(html).toContain("Inter");                      // brand font
    });
});
