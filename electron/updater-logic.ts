// Updater akış mantığı — saf, test edilebilir. main.ts IPC handler'ları bunu çağırır.
// Asıl bug: "Güncellemeleri Denetle" ham GitHub fetch yapıp electron-updater'ın
// state'ini beslemiyordu; sonra downloadUpdate() "Please check update first" atıyordu.
// Çözüm: hem check hem download, electron-updater'ın KENDİ checkForUpdates'ine dayanır.

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

/** "Güncellemeleri Denetle" mantığı — gerçek updater check'ini kullanır (state'i besler). */
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

/** "İndir" mantığı — indirmeden ÖNCE check yapar; updater'ın update bulduğundan emin olur. */
export async function performDownload(
    updater: UpdaterLike,
    currentVersion: string,
    onError: (msg: string) => void,
): Promise<DownloadResult> {
    try {
        const result = await updater.checkForUpdates();
        if (!result?.updateInfo?.version || result.updateInfo.version === currentVersion) {
            const msg = "Güncel sürümdesin veya yeni sürüm bulunamadı.";
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
