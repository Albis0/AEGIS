import {describe, it, expect} from "vitest";
import {
    resolveEntities, isCriticalEntity, describeState, normalize,
    type HAEntity,
} from "../electron/smart-home";

// Test fixture — a typical smart home setup.
function ent(entity_id: string, state: string, friendly_name: string, attributes: Record<string, unknown> = {}): HAEntity {
    return {entity_id, state, friendly_name, attributes, domain: entity_id.split(".")[0]};
}

const HOME: HAEntity[] = [
    ent("light.salon_lamba", "on", "Salon Lamba", {brightness: 255}),
    ent("light.salon_spot", "off", "Salon Spot"),
    ent("light.yatak_odasi", "on", "Yatak Odası Lambası", {brightness: 128}),
    ent("light.mutfak", "off", "Mutfak Işığı"),
    ent("switch.kahve_makinesi", "off", "Kahve Makinesi"),
    ent("switch.salon_isitici", "off", "Salon Isıtıcı"),       // critical (name hint)
    ent("lock.on_kapi", "locked", "Ön Kapı Kilidi"),           // critical (domain)
    ent("cover.garaj", "closed", "Garaj Kapısı"),              // critical (domain)
    ent("climate.salon", "heat", "Salon Termostat", {current_temperature: 21, temperature: 23}), // critical
    ent("sensor.salon_nem", "45", "Salon Nem", {unit_of_measurement: "%"}), // not controllable
];

describe("normalize", () => {
    it("lowercases Turkish/accented chars to ASCII, converts separators to spaces", () => {
        expect(normalize("Yatak_Odası-Lambası")).toBe("yatak odasi lambasi");
        expect(normalize("ÖN KAPI")).toBe("on kapi");
    });
});

describe("resolveEntities — natural language resolution", () => {
    it("room name alone covers all lights in that room", () => {
        const {matches} = resolveEntities("salon", HOME);
        const ids = matches.map((m) => m.entity_id);
        expect(ids).toContain("light.salon_lamba");
        expect(ids).toContain("light.salon_spot");
        // prioritizes lights when present → not the heater/thermostat
        expect(ids).not.toContain("switch.salon_isitici");
    });

    it("'everything' covers all safe devices, not exclude criticals — only safe domain", () => {
        const {matches, scope} = resolveEntities("her şeyi kapat", HOME);
        expect(scope).toBe("all devices");
        // includes safe domain (light/switch), excludes lock/cover/climate
        expect(matches.some((m) => m.domain === "light")).toBe(true);
        expect(matches.some((m) => m.domain === "lock")).toBe(false);
        expect(matches.some((m) => m.domain === "climate")).toBe(false);
    });

    it("'all lights' returns only the light domain", () => {
        const {matches, scope} = resolveEntities("tüm ışıkları aç", HOME);
        expect(scope).toBe("all lights");
        expect(matches.every((m) => m.domain === "light")).toBe(true);
        expect(matches.length).toBe(4);
    });

    it("specific device name gives a single match", () => {
        const {matches} = resolveEntities("yatak odası lambası", HOME);
        expect(matches).toHaveLength(1);
        expect(matches[0].entity_id).toBe("light.yatak_odasi");
    });

    it("matches directly by exact entity_id", () => {
        const {matches} = resolveEntities("lock.on_kapi", HOME);
        expect(matches).toHaveLength(1);
        expect(matches[0].entity_id).toBe("lock.on_kapi");
    });

    it("returns empty when there's no match", () => {
        const {matches} = resolveEntities("uzay gemisi", HOME);
        expect(matches).toHaveLength(0);
    });
});

describe("isCriticalEntity — confirmation gate classification", () => {
    it("lock, garage door, thermostat are critical", () => {
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "lock.on_kapi")!)).toBe(true);
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "cover.garaj")!)).toBe(true);
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "climate.salon")!)).toBe(true);
    });

    it("heater outlet is critical via name hint", () => {
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "switch.salon_isitici")!)).toBe(true);
    });

    it("normal light and outlet are not critical", () => {
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "light.salon_lamba")!)).toBe(false);
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "switch.kahve_makinesi")!)).toBe(false);
    });
});

describe("describeState — human-readable summary", () => {
    it("shows brightness percentage for an on light", () => {
        expect(describeState(HOME.find((e) => e.entity_id === "light.yatak_odasi")!)).toBe("Yatak Odası Lambası: on (50%)");
    });
    it("off light", () => {
        expect(describeState(HOME.find((e) => e.entity_id === "light.mutfak")!)).toBe("Mutfak Işığı: off");
    });
    it("shows thermostat ambient and target temperature", () => {
        expect(describeState(HOME.find((e) => e.entity_id === "climate.salon")!)).toContain("target 23°C");
    });
    it("lock state is shown in English", () => {
        expect(describeState(HOME.find((e) => e.entity_id === "lock.on_kapi")!)).toBe("Ön Kapı Kilidi: locked");
    });
});
