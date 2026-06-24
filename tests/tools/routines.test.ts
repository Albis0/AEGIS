import {describe, it, expect, beforeEach, afterEach} from "vitest";
import * as r from "../../electron/routines";

beforeEach(() => r._resetForTest());
afterEach(() => r._resetForTest());

describe("routine recording", () => {
    it("starts a recording", () => {
        const msg = r.startRecording("Oyun Modu");
        expect(r.isRecording()).toBe(true);
        expect(r.recordingName()).toBe("Oyun Modu");
        expect(msg).toContain("Oyun Modu");
    });

    it("refuses a second concurrent recording", () => {
        r.startRecording("A");
        const msg = r.startRecording("B");
        expect(msg).toContain("already being recorded");
        expect(r.recordingName()).toBe("A");
    });

    it("captures only action tools, not read-only ones", () => {
        r.startRecording("Oyun Modu");
        r.captureStep("steam_launch", {game: "Dota 2"});
        r.captureStep("web_search", {query: "haberler"});   // read-only → should be skipped
        r.captureStep("screenshot", {});                     // read-only → should be skipped
        r.captureStep("spotify_volume", {volume: 30});
        r.captureStep("list_windows", {});                   // read-only → should be skipped
        const msg = r.stopRecording();
        expect(msg).toContain("2 steps");
    });

    it("ignores capture when not recording", () => {
        r.captureStep("steam_launch", {game: "X"});
        expect(r.isRecording()).toBe(false);
    });

    it("does not save an empty routine", () => {
        r.startRecording("Boş");
        const msg = r.stopRecording();
        expect(msg).toContain("No action was recorded");
        expect(r.getRoutine("Boş")).toBeNull();
    });

    it("cancel discards without saving", () => {
        r.startRecording("İptal");
        r.captureStep("spotify_pause", {});
        const msg = r.cancelRecording();
        expect(msg).toContain("cancelled");
        expect(r.getRoutine("İptal")).toBeNull();
    });
});

describe("routine CRUD", () => {
    function makeOyunModu(): void {
        r.startRecording("Oyun Modu");
        r.captureStep("steam_launch", {game: "Dota 2"});
        r.captureStep("spotify_volume", {volume: 30});
        r.captureStep("do_not_disturb", {minutes: 120});
        r.stopRecording();
    }

    it("saves and retrieves a routine with steps in order", () => {
        makeOyunModu();
        const routine = r.getRoutine("Oyun Modu");
        expect(routine).not.toBeNull();
        expect(routine!.steps).toHaveLength(3);
        expect(routine!.steps[0].tool).toBe("steam_launch");
        expect(routine!.steps[1].args.volume).toBe(30);
    });

    it("matches by partial name (case-insensitive)", () => {
        makeOyunModu();
        expect(r.getRoutine("oyun")).not.toBeNull();
        expect(r.getRoutine("OYUN MODU")).not.toBeNull();
    });

    it("lists routines", () => {
        makeOyunModu();
        const list = r.listRoutines();
        expect(list).toContain("Oyun Modu");
        expect(list).toContain("3 steps");
    });

    it("re-recording the same name overwrites (update)", () => {
        makeOyunModu();
        const id1 = r.getRoutine("Oyun Modu")!.id;
        r.startRecording("Oyun Modu");
        r.captureStep("spotify_pause", {});
        const msg = r.stopRecording();
        expect(msg).toContain("updated");
        const after = r.getRoutine("Oyun Modu")!;
        expect(after.id).toBe(id1);           // same routine, new steps
        expect(after.steps).toHaveLength(1);
    });

    it("renames a routine", () => {
        makeOyunModu();
        const msg = r.renameRoutine("Oyun Modu", "Gaming");
        expect(msg).toContain("Gaming");
        expect(r.getRoutine("Oyun Modu")).toBeNull();
        expect(r.getRoutine("Gaming")).not.toBeNull();
    });

    it("deletes a step (edit)", () => {
        makeOyunModu();
        const msg = r.deleteRoutineStep("Oyun Modu", 2);   // remove spotify_volume
        expect(msg).toContain("removed");
        const routine = r.getRoutine("Oyun Modu")!;
        expect(routine.steps).toHaveLength(2);
        expect(routine.steps.map((s) => s.tool)).toEqual(["steam_launch", "do_not_disturb"]);
    });

    it("rejects out-of-range step deletion", () => {
        makeOyunModu();
        const msg = r.deleteRoutineStep("Oyun Modu", 99);
        expect(msg).toContain("Invalid");
    });

    it("shows a routine's steps", () => {
        makeOyunModu();
        const out = r.showRoutine("Oyun Modu");
        expect(out).toContain("steam_launch");
        expect(out).toContain("game=");
    });

    it("deletes a routine", () => {
        makeOyunModu();
        const msg = r.deleteRoutine("Oyun Modu");
        expect(msg).toContain("deleted");
        expect(r.getRoutine("Oyun Modu")).toBeNull();
    });

    it("returns error messages for unknown routines", () => {
        expect(r.deleteRoutine("yok")).toContain("No routine found");
        expect(r.renameRoutine("yok", "x")).toContain("No routine found");
        expect(r.showRoutine("yok")).toContain("No routine found");
        expect(r.deleteRoutineStep("yok", 1)).toContain("No routine found");
    });
});

describe("isRecordableTool", () => {
    it("treats state-changing tools as recordable", () => {
        expect(r.isRecordableTool("steam_launch")).toBe(true);
        expect(r.isRecordableTool("spotify_volume")).toBe(true);
        expect(r.isRecordableTool("set_volume")).toBe(true);
    });

    it("excludes read-only and meta tools", () => {
        expect(r.isRecordableTool("web_search")).toBe(false);
        expect(r.isRecordableTool("screenshot")).toBe(false);
        expect(r.isRecordableTool("spotify_now_playing")).toBe(false);
        expect(r.isRecordableTool("list_windows")).toBe(false);
        expect(r.isRecordableTool("get_active_context")).toBe(false);
        expect(r.isRecordableTool("routine_run")).toBe(false);
        expect(r.isRecordableTool("start_macro")).toBe(false);
    });
});
