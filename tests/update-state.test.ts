import {describe, it, expect} from "vitest";
import {updateReducer, type UpdateState} from "../src/update-state";

describe("update toast state machine", () => {
    it("available → start → progress → downloaded (happy path)", () => {
        let s: UpdateState | null = null;
        s = updateReducer(s, {type: "available", version: "1.4.5"});
        expect(s).toMatchObject({version: "1.4.5", ready: false, downloading: false});

        s = updateReducer(s, {type: "start-download"});
        expect(s).toMatchObject({downloading: true, percent: 0, error: undefined});

        s = updateReducer(s, {type: "progress", percent: 12});
        s = updateReducer(s, {type: "progress", percent: 87.6});
        expect(s).toMatchObject({downloading: true, percent: 88}); // rounded

        s = updateReducer(s, {type: "downloaded", version: "1.4.5"});
        expect(s).toMatchObject({ready: true, downloading: false, percent: 100});
    });

    it("error stops the download and makes it visible (no silent hang)", () => {
        let s: UpdateState | null = updateReducer(null, {type: "available", version: "1.4.5"});
        s = updateReducer(s, {type: "start-download"});
        s = updateReducer(s, {type: "progress", percent: 30});
        s = updateReducer(s, {type: "error", message: "net::ERR_CONNECTION_RESET"});
        expect(s).toMatchObject({downloading: false, error: "net::ERR_CONNECTION_RESET"});
    });

    it("retry clears the error and restarts the download", () => {
        let s: UpdateState | null = updateReducer(null, {type: "available", version: "1.4.5"});
        s = updateReducer(s, {type: "error", message: "x"});
        s = updateReducer(s, {type: "retry"});
        expect(s).toMatchObject({downloading: true, percent: 0, error: undefined});
    });

    it("progress events arriving after ready are ignored", () => {
        let s: UpdateState | null = updateReducer(null, {type: "available", version: "1.4.5"});
        s = updateReducer(s, {type: "downloaded"});
        const after = updateReducer(s, {type: "progress", percent: 50});
        expect(after).toMatchObject({ready: true, percent: 100}); // unchanged
    });

    it("available does NOT TRIGGER A DOWNLOAD — notification only (downloading=false)", () => {
        const s = updateReducer(null, {type: "available", version: "1.4.5"});
        expect(s?.downloading).toBe(false);
        expect(s?.ready).toBe(false);
    });

    it("an available event during an active download does not revert state (performDownload re-check)", () => {
        let s: UpdateState | null = updateReducer(null, {type: "available", version: "1.7.0"});
        s = updateReducer(s, {type: "start-download"});
        s = updateReducer(s, {type: "progress", percent: 5});
        // performDownload calls checkForUpdates before downloading → available fires again
        s = updateReducer(s, {type: "available", version: "1.7.0"});
        expect(s).toMatchObject({downloading: true}); // still downloading, "DOWNLOAD" button does not come back
        expect(s?.ready).toBe(false);
    });

    it("an available event while ready does not break state", () => {
        let s: UpdateState | null = updateReducer(null, {type: "available", version: "1.7.0"});
        s = updateReducer(s, {type: "downloaded", version: "1.7.0"});
        s = updateReducer(s, {type: "available", version: "1.7.0"});
        expect(s).toMatchObject({ready: true, downloading: false});
    });
});
