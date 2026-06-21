import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const AUTO_PATH = path.join(os.homedir(), ".aegis", "automations.json");

import {
    addAutomation, listAutomations, removeAutomation, toggleAutomation,
    loadAutomations, checkAutomations,
} from "../../electron/automations";

function clearAutos(): void {
    try { fs.writeFileSync(AUTO_PATH, "[]", "utf-8"); } catch { /* none */ }
}

beforeEach(() => {
    fs.mkdirSync(path.dirname(AUTO_PATH), {recursive: true});
    clearAutos();
});
afterEach(clearAutos);

// ─── Add ───────────────────────────────────────────────────────────────────
describe("addAutomation", () => {
    it("adds an automation with a valid condition", () => {
        const msg = addAutomation("cpu > 80", "give cpu warning");
        expect(msg).toContain("Automation created");
        expect(msg).toContain("cpu > 80");
        expect(loadAutomations().length).toBe(1);
    });

    it("returns an error for an invalid condition", () => {
        const msg = addAutomation("cpu high", "warn");
        expect(msg).toContain("ERROR");
        expect(loadAutomations().length).toBe(0);
    });

    it("accepts all operators", () => {
        for (const op of [">", "<", ">=", "<=", "==", "!="]) {
            clearAutos();
            const msg = addAutomation(`cpu ${op} 50`, "warn");
            expect(msg).not.toContain("ERROR");
        }
    });

    it("accepts a float threshold", () => {
        const msg = addAutomation("ram > 75.5", "warn");
        expect(msg).not.toContain("ERROR");
    });

    it("a newly added automation starts with enabled=true", () => {
        addAutomation("gpu > 90", "gpu warning");
        const list = loadAutomations();
        expect(list[0].enabled).toBe(true);
    });
});

// ─── List ──────────────────────────────────────────────────────────────────
describe("listAutomations", () => {
    it("returns a message when empty", () => {
        expect(listAutomations()).toContain("No automations defined");
    });

    it("lists automations", () => {
        addAutomation("ram > 75", "clear ram");
        const list = listAutomations();
        expect(list).toContain("ram > 75");
        expect(list).toContain("clear ram");
    });
});

// ─── Remove ────────────────────────────────────────────────────────────────
describe("removeAutomation", () => {
    it("removes by ID", () => {
        addAutomation("cpu > 90", "warn");
        const id = loadAutomations()[0].id;
        const msg = removeAutomation(id);
        expect(msg).toContain("removed");
        expect(loadAutomations().length).toBe(0);
    });

    it("removes by condition substring", () => {
        addAutomation("hour == 23", "night notification");
        const msg = removeAutomation("hour");
        expect(msg).toContain("removed");
    });

    it("returns an error for a nonexistent automation", () => {
        expect(removeAutomation("yok-abc")).toContain("No automation found");
    });
});

// ─── Toggle ────────────────────────────────────────────────────────────────
describe("toggleAutomation", () => {
    it("enabled → disabled", () => {
        addAutomation("cpu > 80", "warn");
        const id = loadAutomations()[0].id;
        const msg = toggleAutomation(id);
        expect(msg).toContain("disabled");
        expect(loadAutomations()[0].enabled).toBe(false);
    });

    it("disabled → enabled", () => {
        addAutomation("cpu > 80", "warn");
        const id = loadAutomations()[0].id;
        toggleAutomation(id);                // disabled
        const msg = toggleAutomation(id);   // re-enabled
        expect(msg).toContain("enabled");
        expect(loadAutomations()[0].enabled).toBe(true);
    });

    it("returns an error for a nonexistent automation", () => {
        expect(toggleAutomation("yok")).toContain("No automation found");
    });
});

// ─── checkAutomations ──────────────────────────────────────────────────────
describe("checkAutomations", () => {
    it("calls onTrigger when the threshold is exceeded", () => {
        addAutomation("cpu > 80", "cpu high warning");
        const triggered: string[] = [];
        checkAutomations({cpu: 95}, (action) => triggered.push(action));
        expect(triggered).toContain("cpu high warning");
    });

    it("doesn't trigger when the threshold isn't exceeded", () => {
        addAutomation("cpu > 80", "warn");
        const triggered: string[] = [];
        checkAutomations({cpu: 50}, (a) => triggered.push(a));
        expect(triggered).toHaveLength(0);
    });

    it("doesn't trigger a disabled automation", () => {
        addAutomation("ram > 75", "ram warning");
        const id = loadAutomations()[0].id;
        toggleAutomation(id); // disabled
        const triggered: string[] = [];
        checkAutomations({ram: 90}, (a) => triggered.push(a));
        expect(triggered).toHaveLength(0);
    });

    it("doesn't trigger when the metric is missing", () => {
        addAutomation("gpu > 90", "gpu warning");
        const triggered: string[] = [];
        checkAutomations({cpu: 100}, (a) => triggered.push(a)); // no gpu metric
        expect(triggered).toHaveLength(0);
    });

    it("the <= operator works", () => {
        addAutomation("hour <= 6", "night mode");
        const triggered: string[] = [];
        checkAutomations({hour: 3}, (a) => triggered.push(a));
        expect(triggered).toContain("night mode");
    });

    it("the == operator works", () => {
        addAutomation("hour == 9", "morning notification");
        const triggered: string[] = [];
        checkAutomations({hour: 9}, (a) => triggered.push(a));
        expect(triggered).toContain("morning notification");
    });

    it("the != operator works", () => {
        addAutomation("cpu != 0", "cpu active");
        const triggered: string[] = [];
        checkAutomations({cpu: 50}, (a) => triggered.push(a));
        expect(triggered).toContain("cpu active");
    });
});
