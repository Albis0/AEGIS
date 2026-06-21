// Updater flow logic — pure, testable. The main.ts IPC handlers call this.
// The real bug: "Check for Updates" did a raw GitHub fetch and didn't feed
// electron-updater's state; then downloadUpdate() threw "Please check update first".
// The fix: both check and download rely on electron-updater's OWN checkForUpdates.

export interface UpdaterLike {
    checkForUpdates(): Promise<{updateInfo?: {version?: string}} | null>;
    downloadUpdate(): Promise<unknown>;
}

export interface CheckResult {
    current: string;
    latest?: string;
    hasUpdate?: boolean;
    error?: string;
}

export interface DownloadResult {
    ok: boolean;
    error?: string;
}

/** "Check for Updates" logic — uses the real updater check (feeds its state). */
export async function performCheck(updater: UpdaterLike, currentVersion: string): Promise<CheckResult> {
    try {
        const result = await updater.checkForUpdates();
        const latest = result?.updateInfo?.version;
        if (!latest) return {current: currentVersion, latest: currentVersion, hasUpdate: false};
        return {current: currentVersion, latest, hasUpdate: latest !== currentVersion};
    } catch (e) {
        return {current: currentVersion, error: (e as Error)?.message ?? String(e)};
    }
}

/** "Download" logic — checks BEFORE downloading; makes sure the updater found an update. */
export async function performDownload(
    updater: UpdaterLike,
    currentVersion: string,
    onError: (msg: string) => void,
): Promise<DownloadResult> {
    try {
        const result = await updater.checkForUpdates();
        if (!result?.updateInfo?.version || result.updateInfo.version === currentVersion) {
            const msg = "You're on the latest version, or no new version was found.";
            onError(msg);
            return {ok: false, error: msg};
        }
        await updater.downloadUpdate();
        return {ok: true};
    } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        onError(msg);
        return {ok: false, error: msg};
    }
}
