/**
 * Main-window controls + updater IPC (audit B3). The onboarding window has its
 * own separate win-close/win-minimize registrations in main.ts.
 */

import {ipcMain, app, type BrowserWindow, type Tray} from "electron";
import type {AppUpdater} from "electron-updater";
import type {AppSettings} from "../settings";
import {performCheck, performDownload} from "../updater-logic";

export interface WindowIpcDeps {
    getMainWindow: () => BrowserWindow | null;
    getTray: () => Tray | null;
    getSettings: () => AppSettings;
    autoUpdater: AppUpdater;
    sendToRenderer: (channel: string, payload: object) => void;
}

export function registerWindowIpc(deps: WindowIpcDeps): void {
    const {getMainWindow, getTray, getSettings, autoUpdater, sendToRenderer} = deps;

    ipcMain.on("win-minimize", () => getMainWindow()?.minimize());
    ipcMain.on("win-close", () => {
        if (getSettings().minimizeToTray && getTray()) {
            getMainWindow()?.hide();
        } else {
            getMainWindow()?.close();
        }
    });
    // Display cycle: windowed → borderless (fills the screen like a second monitor,
    // keeps the OS taskbar-free feel) → true fullscreen → back to windowed. Requested
    // so users can pick the fit they want instead of a single on/off fullscreen.
    ipcMain.on("win-fullscreen", () => {
        const w = getMainWindow();
        if (!w) return;
        if (w.isFullScreen()) {
            // fullscreen → windowed
            w.setFullScreen(false);
            w.unmaximize();
            sendToRenderer("display-mode", {mode: "windowed"});
        } else if (w.isMaximized()) {
            // borderless (maximized) → true fullscreen
            w.setFullScreen(true);
            sendToRenderer("display-mode", {mode: "fullscreen"});
        } else {
            // windowed → borderless (maximized, no window chrome since frame:false)
            w.maximize();
            sendToRenderer("display-mode", {mode: "borderless"});
        }
    });
    ipcMain.on("win-maximize", () => {
        const w = getMainWindow();
        if (!w) return;
        if (w.isMaximized()) w.unmaximize();
        else w.maximize();
    });

    ipcMain.handle("update-install", () => autoUpdater.quitAndInstall());
    // Download ONLY starts from here — when the user clicks DOWNLOAD. BEFORE
    // downloading, the updater's own check runs — otherwise downloadUpdate() would
    // throw "Please check update first" (the manual button did a raw GitHub fetch
    // without feeding the updater's state). Logic: electron/updater-logic.ts.
    ipcMain.handle("update-download", () =>
        performDownload(autoUpdater, app.getVersion(), (msg) => sendToRenderer("update-error", {message: msg})));
    ipcMain.handle("check-for-updates", async () => {
        if (process.env.NODE_ENV === "development") return {dev: true, current: app.getVersion()};
        return performCheck(autoUpdater, app.getVersion());
    });
}
