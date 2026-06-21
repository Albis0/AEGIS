import {describe, it, expect} from "vitest";
import {__callbackPageForTest as callbackPage} from "../electron/spotify";

describe("Spotify callback sayfası", () => {
    it("başarı: AEGIS markası, başlık ve UTF-8 meta içerir", () => {
        const html = callbackPage({ok: true, title: "Spotify bağlandı", sub: "AEGIS artık müziğini kontrol edebilir."});
        expect(html).toContain("<!doctype html>");
        expect(html).toContain('charset="utf-8"');
        expect(html).toContain("AEGIS");
        expect(html).toContain("Spotify bağlandı");           // Türkçe karakter korunur
        expect(html).toContain("AEGIS artık müziğini kontrol edebilir.");
        // başarı rengi (emerald) — onay ikonu
        expect(html).toContain("52, 211, 153");
    });

    it("hata: kırmızı tema ve hata mesajını gösterir", () => {
        const html = callbackPage({ok: false, title: "Bağlantı başarısız", sub: "invalid_grant"});
        expect(html).toContain("Bağlantı başarısız");
        expect(html).toContain("invalid_grant");
        expect(html).toContain("248, 113, 113");              // red-400
    });

    it("çıplak Times New Roman değil — koyu marka zemini kullanır", () => {
        const html = callbackPage({ok: true, title: "x", sub: "y"});
        expect(html).toContain("#0a0e17");                    // marka zemini
        expect(html).toContain("Inter");                      // marka fontu
    });
});
