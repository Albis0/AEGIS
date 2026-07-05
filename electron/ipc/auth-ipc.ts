/**
 * Auth & Spotify-authorize IPC (audit B3). Registered at module scope in
 * main.ts (NOT inside bootApp) because the onboarding flow needs sign-in/
 * sign-up/spotify-authorize before the main app boots.
 */

import {ipcMain} from "electron";
import {signUp, signIn, signOut, getCurrentUser, getUsage} from "../auth";
import {submitReport, pendingReportCount, type ErrorReportInput} from "../error-report";
import {spotifyAuthorizeCmd} from "../spotify";

export function registerAuthIpc(): void {
    ipcMain.handle("auth-sign-up", (_e, {email, password}: {email: string; password: string}) => signUp(email, password));
    ipcMain.handle("auth-sign-in", (_e, {email, password}: {email: string; password: string}) => signIn(email, password));
    ipcMain.handle("auth-sign-out", () => signOut());
    ipcMain.handle("auth-current-user", () => getCurrentUser());
    ipcMain.handle("usage-get", () => getUsage());
    ipcMain.handle("spotify-authorize", () => spotifyAuthorizeCmd());
    // Bug reports (user-filed, Settings → About). Renderer input is untrusted:
    // pin source to "user" and only pass through the whitelisted fields.
    ipcMain.handle("report-submit", (_e, r: Partial<ErrorReportInput>) =>
        submitReport({
            source: "user",
            title: String(r?.title ?? ""),
            description: String(r?.description ?? ""),
            screenshot: typeof r?.screenshot === "string" ? r.screenshot : undefined,
        }));
    ipcMain.handle("report-pending-count", () => pendingReportCount());
}
