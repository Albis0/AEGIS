import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE = path.join(os.homedir(), ".aegis");
const PERSONAS = path.join(BASE, "personas.json");
const ROLEPLAY = path.join(BASE, "roleplay-state.json");

import {
    setActivePersona, getActivePersona, listPersonas, addPersona,
    getPersonaSystemPrompt, startRoleplay, stopRoleplay, getRoleplayPrompt,
} from "../../electron/persona";

function clearFiles(): void {
    for (const p of [PERSONAS, ROLEPLAY]) {
        try { fs.unlinkSync(p); } catch { /* yok */ }
    }
}

beforeEach(() => {
    fs.mkdirSync(BASE, {recursive: true});
    clearFiles();
});
afterEach(clearFiles);

// ─── Built-in personas ───────────────────────────────────────────────────────
describe("built-in kişilikler", () => {
    it("dosya yokken bile 5 built-in mevcut", () => {
        const out = listPersonas();
        for (const name of ["default", "formal", "friendly", "coach", "teacher"]) {
            expect(out).toContain(name);
        }
    });

    it("varsayılan aktif kişilik default", () => {
        expect(getActivePersona()).toContain("default");
    });
});

describe("setActivePersona", () => {
    it("built-in kişiliği aktifleştirir", () => {
        const msg = setActivePersona("coach");
        expect(msg).toContain("coach");
        expect(getActivePersona()).toContain("coach");
    });

    it("olmayan kişilik reddedilir + mevcutları listeler", () => {
        const msg = setActivePersona("yok-xyz");
        expect(msg).toContain("bulunamadı");
        expect(msg).toContain("default");
    });
});

describe("addPersona", () => {
    it("özel kişilik ekler ve aktif edilebilir", () => {
        addPersona("korsan", "Korsan gibi konuşur", "Arr! Korsan dilinde yanıt ver.");
        expect(listPersonas()).toContain("korsan");
        setActivePersona("korsan");
        expect(getActivePersona()).toContain("Korsan dilinde");
    });

    it("boş isim reddedilir", () => {
        expect(addPersona("  ", "x", "y")).toContain("HATA");
    });

    it("built-in'ler diske yazılmaz (sadece özel)", () => {
        addPersona("ozel", "açıklama", "yönerge");
        const raw = JSON.parse(fs.readFileSync(PERSONAS, "utf-8"));
        expect(Object.keys(raw.personas)).toEqual(["ozel"]);
        expect(raw.personas.default).toBeUndefined();
    });
});

// ─── System prompt ───────────────────────────────────────────────────────────
describe("getPersonaSystemPrompt", () => {
    it("default kişilikte boş string (varsayılan davranış)", () => {
        expect(getPersonaSystemPrompt()).toBe("");
    });

    it("aktif kişilik prompt'u [KİŞİLİK: X] formatında döner", () => {
        setActivePersona("formal");
        const p = getPersonaSystemPrompt();
        expect(p).toContain("[KİŞİLİK: FORMAL]");
        expect(p).toContain("kurumsal");
    });

    it("roleplay aktifken persona'yı ezer", () => {
        setActivePersona("formal");
        startRoleplay("Sherlock Holmes", "Bir cinayet vakası");
        const p = getPersonaSystemPrompt();
        expect(p).toContain("ROL YAPMA MODU");
        expect(p).toContain("Sherlock Holmes");
        expect(p).not.toContain("KİŞİLİK");
    });
});

// ─── Roleplay ────────────────────────────────────────────────────────────────
describe("roleplay", () => {
    it("başlat + durum yansır", () => {
        const msg = startRoleplay("Gandalf", "Orta Dünya");
        expect(msg).toContain("Gandalf");
        expect(getRoleplayPrompt()).toContain("Gandalf");
    });

    it("boş karakter reddedilir", () => {
        expect(startRoleplay("  ", "senaryo")).toContain("HATA");
    });

    it("durdurunca normal moda döner", () => {
        startRoleplay("Karakter", "");
        const msg = stopRoleplay();
        expect(msg).toContain("Normal moda");
        expect(getRoleplayPrompt()).toBe("");
    });

    it("aktif roleplay yokken durdurma mesajı", () => {
        expect(stopRoleplay()).toContain("Aktif rol yapma modu yok");
    });
});
