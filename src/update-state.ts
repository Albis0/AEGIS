// State machine for the update toast — shared by App.tsx and tests.
// Download is MANUAL: 'available' -> user downloads -> 'downloading'(+percent) -> 'ready'.
// An error at any stage stops 'downloading' and surfaces it (no silent hang).

export interface UpdateState {
    version?: string;
    ready: boolean;
    downloading?: boolean;
    percent?: number;
    error?: string;
}

export type UpdateEvent =
    | {type: "available"; version: string}
    | {type: "start-download"}        // user clicked "download"
    | {type: "progress"; percent: number}
    | {type: "downloaded"; version?: string}
    | {type: "error"; message: string}
    | {type: "retry"};

export function updateReducer(state: UpdateState | null, ev: UpdateEvent): UpdateState | null {
    switch (ev.type) {
        case "available":
            // A re-check event that arrives while downloading/installing (performDownload
            // calls checkForUpdates again first) must not revert the "downloading" state.
            if (state && (state.downloading || state.ready)) {
                return {...state, version: ev.version};
            }
            return {version: ev.version, ready: false, downloading: false};
        case "start-download":
            return state ? {...state, downloading: true, percent: 0, error: undefined} : state;
        case "progress":
            // ignore progress events that arrive after ready
            return state && !state.ready
                ? {...state, downloading: true, percent: Math.round(ev.percent), error: undefined}
                : state;
        case "downloaded":
            return {version: ev.version ?? state?.version, ready: true, downloading: false, percent: 100};
        case "error":
            // stop the download, show the error — don't let "downloading…" hang forever
            return state ? {...state, downloading: false, error: ev.message} : state;
        case "retry":
            return state ? {...state, error: undefined, downloading: true, percent: 0} : state;
        default:
            return state;
    }
}
