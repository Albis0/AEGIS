import {describe, it, expect} from "vitest";
import {updateReducer, type UpdateState} from "../src/update-state";

describe("update toast state machine", () => {
    it("available → start → progress → downloaded (mutlu yol)", () => {
        let s: UpdateState | null = null;
        s = updateReducer(s, {type: "available", version: "1.4.5"});
        expect(s).toMatchObject({version: "1.4.5", ready: false, downloading: false});

        s = updateReducer(s, {type: "start-download"});
        expect(s).toMatchObject({downloading: true, percent: 0, error: undefined});

        s = updateReducer(s, {type: "progress", percent: 12});
        s = updateReducer(s, {type: "progress", percent: 87.6});
        expect(s).toMatchObject({downloading: true, percent: 88}); // yuvarlanır

        s = updateReducer(s, {type: "downloaded", version: "1.4.5"});
        expect(s).toMatchObject({ready: true, downloading: false, percent: 100});
    });

    it("hata indirmeyi durdurur ve görünür kılar (sessiz takılma yok)", () => {
        let s: UpdateState | null = updateReducer(null, {type: "available", version: "1.4.5"});
        s = updateReducer(s, {type: "start-download"});
        s = updateReducer(s, {type: "progress", percent: 30});
        s = updateReducer(s, {type: "error", message: "net::ERR_CONNECTION_RESET"});
        expect(s).toMatchObject({downloading: false, error: "net::ERR_CONNECTION_RESET"});
    });

    it("retry hatayı temizler ve indirmeyi yeniden başlatır", () => {
        let s: UpdateState | null = updateReducer(null, {type: "available", version: "1.4.5"});
        s = updateReducer(s, {type: "error", message: "x"});
        s = updateReducer(s, {type: "retry"});
        expect(s).toMatchObject({downloading: true, percent: 0, error: undefined});
    });

    it("ready olduktan sonra gelen progress yoksayılır", () => {
        let s: UpdateState | null = updateReducer(null, {type: "available", version: "1.4.5"});
        s = updateReducer(s, {type: "downloaded"});
        const after = updateReducer(s, {type: "progress", percent: 50});
        expect(after).toMatchObject({ready: true, percent: 100}); // değişmedi
    });

    it("available İNDİRME TETİKLEMEZ — sadece bildirim (downloading=false)", () => {
        const s = updateReducer(null, {type: "available", version: "1.4.5"});
        expect(s?.downloading).toBe(false);
        expect(s?.ready).toBe(false);
    });
});
