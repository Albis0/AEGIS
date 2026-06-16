import {describe, it, expect} from "vitest";
import {
    resolveEntities, isCriticalEntity, describeState, normalize,
    type HAEntity,
} from "../electron/smart-home";

// Test fixture'ı — tipik bir akıllı ev kurulumu.
function ent(entity_id: string, state: string, friendly_name: string, attributes: Record<string, unknown> = {}): HAEntity {
    return {entity_id, state, friendly_name, attributes, domain: entity_id.split(".")[0]};
}

const HOME: HAEntity[] = [
    ent("light.salon_lamba", "on", "Salon Lamba", {brightness: 255}),
    ent("light.salon_spot", "off", "Salon Spot"),
    ent("light.yatak_odasi", "on", "Yatak Odası Lambası", {brightness: 128}),
    ent("light.mutfak", "off", "Mutfak Işığı"),
    ent("switch.kahve_makinesi", "off", "Kahve Makinesi"),
    ent("switch.salon_isitici", "off", "Salon Isıtıcı"),       // kritik (isim ipucu)
    ent("lock.on_kapi", "locked", "Ön Kapı Kilidi"),           // kritik (domain)
    ent("cover.garaj", "closed", "Garaj Kapısı"),              // kritik (domain)
    ent("climate.salon", "heat", "Salon Termostat", {current_temperature: 21, temperature: 23}), // kritik
    ent("sensor.salon_nem", "45", "Salon Nem", {unit_of_measurement: "%"}), // kontrol edilemez
];

describe("normalize", () => {
    it("Türkçe ve aksanları ASCII'ye indirir, ayraçları boşluğa çevirir", () => {
        expect(normalize("Yatak_Odası-Lambası")).toBe("yatak odasi lambasi");
        expect(normalize("ÖN KAPI")).toBe("on kapi");
    });
});

describe("resolveEntities — doğal dil çözümleme", () => {
    it("oda adı tek başına o odadaki tüm ışıkları kapsar", () => {
        const {matches} = resolveEntities("salon", HOME);
        const ids = matches.map((m) => m.entity_id);
        expect(ids).toContain("light.salon_lamba");
        expect(ids).toContain("light.salon_spot");
        // ışık varsa ışıkları önceler → ısıtıcı/termostat değil
        expect(ids).not.toContain("switch.salon_isitici");
    });

    it("'her şey' tüm güvenli cihazları kapsar, kritikleri dışlamaz değil — sadece safe domain", () => {
        const {matches, scope} = resolveEntities("her şeyi kapat", HOME);
        expect(scope).toBe("tüm cihazlar");
        // safe domain (light/switch) dahil, lock/cover/climate hariç
        expect(matches.some((m) => m.domain === "light")).toBe(true);
        expect(matches.some((m) => m.domain === "lock")).toBe(false);
        expect(matches.some((m) => m.domain === "climate")).toBe(false);
    });

    it("'tüm ışıklar' yalnızca light domain'i döndürür", () => {
        const {matches, scope} = resolveEntities("tüm ışıkları aç", HOME);
        expect(scope).toBe("tüm ışıklar");
        expect(matches.every((m) => m.domain === "light")).toBe(true);
        expect(matches.length).toBe(4);
    });

    it("spesifik cihaz adı tek eşleşme verir", () => {
        const {matches} = resolveEntities("yatak odası lambası", HOME);
        expect(matches).toHaveLength(1);
        expect(matches[0].entity_id).toBe("light.yatak_odasi");
    });

    it("tam entity_id ile doğrudan eşleşir", () => {
        const {matches} = resolveEntities("lock.on_kapi", HOME);
        expect(matches).toHaveLength(1);
        expect(matches[0].entity_id).toBe("lock.on_kapi");
    });

    it("eşleşme yoksa boş döner", () => {
        const {matches} = resolveEntities("uzay gemisi", HOME);
        expect(matches).toHaveLength(0);
    });
});

describe("isCriticalEntity — onay kapısı sınıflandırması", () => {
    it("kilit, garaj, termostat kritiktir", () => {
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "lock.on_kapi")!)).toBe(true);
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "cover.garaj")!)).toBe(true);
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "climate.salon")!)).toBe(true);
    });

    it("ısıtıcı prizi isim ipucuyla kritiktir", () => {
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "switch.salon_isitici")!)).toBe(true);
    });

    it("normal ışık ve priz kritik değildir", () => {
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "light.salon_lamba")!)).toBe(false);
        expect(isCriticalEntity(HOME.find((e) => e.entity_id === "switch.kahve_makinesi")!)).toBe(false);
    });
});

describe("describeState — insan-okur özet", () => {
    it("açık ışıkta parlaklık yüzdesi gösterir", () => {
        expect(describeState(HOME.find((e) => e.entity_id === "light.yatak_odasi")!)).toBe("Yatak Odası Lambası: açık (%50)");
    });
    it("kapalı ışık", () => {
        expect(describeState(HOME.find((e) => e.entity_id === "light.mutfak")!)).toBe("Mutfak Işığı: kapalı");
    });
    it("termostat ortam ve hedef sıcaklığı gösterir", () => {
        expect(describeState(HOME.find((e) => e.entity_id === "climate.salon")!)).toContain("hedef 23°C");
    });
    it("kilit durumu Türkçeleştirilir", () => {
        expect(describeState(HOME.find((e) => e.entity_id === "lock.on_kapi")!)).toBe("Ön Kapı Kilidi: kilitli");
    });
});
