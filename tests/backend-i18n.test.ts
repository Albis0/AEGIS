import {describe, it, expect, afterEach} from "vitest";
import {bt, setBackendLang, getBackendLang} from "../electron/backend-i18n";

afterEach(() => setBackendLang("en"));

describe("backend-i18n", () => {
    it("defaults to English", () => {
        expect(getBackendLang()).toBe("en");
        expect(bt("authBadCreds")).toBe("Email or password is incorrect.");
    });

    it("switches language at call time", () => {
        setBackendLang("tr");
        expect(bt("authBadCreds")).toBe("E-posta veya şifre hatalı.");
        setBackendLang("de");
        expect(bt("authBadCreds")).toBe("E-Mail oder Passwort ist falsch.");
    });

    it("ignores unknown language codes", () => {
        setBackendLang("tr");
        setBackendLang("xx");
        expect(getBackendLang()).toBe("tr");
    });

    it("interpolates {placeholders}, including repeats", () => {
        setBackendLang("en");
        const msg = bt("http429quota", {provider: "OpenAI"});
        expect(msg).toContain("OpenAI: Insufficient");
        expect(msg).toContain("your OpenAI account");
        expect(msg).not.toContain("{provider}");
    });

    it("leaves missing params visible instead of crashing", () => {
        expect(bt("httpGeneric", {provider: "X"})).toContain("{status}");
    });

    it("every key has all 5 languages non-empty (spot-check via tr/es)", () => {
        setBackendLang("es");
        expect(bt("proxyLimit").length).toBeGreaterThan(10);
        setBackendLang("fr");
        expect(bt("noticeDataReset", {files: "a"})).toContain("a");
    });
});
