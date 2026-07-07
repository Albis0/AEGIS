import {bt} from "./backend-i18n";

/**
 * fetch() wrapper with AbortController timeout.
 * Prevents API calls from hanging indefinitely when network is slow or down.
 */
export function fetchWithTimeout(
    url: string,
    opts: RequestInit = {},
    ms = 10_000,
): Promise<Response> {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    // Merge caller's signal with ours (caller may also have one)
    const signal = opts.signal
        ? anySignal([opts.signal as AbortSignal, ctrl.signal])
        : ctrl.signal;
    return fetch(url, {...opts, signal}).finally(() => clearTimeout(id));
}

/** Returns an AbortSignal that fires when ANY of the given signals fires. */
function anySignal(signals: AbortSignal[]): AbortSignal {
    const ctrl = new AbortController();
    for (const s of signals) {
        if (s.aborted) { ctrl.abort(); break; }
        s.addEventListener("abort", () => ctrl.abort(), {once: true});
    }
    return ctrl.signal;
}

/** Maps a fetch AbortError to a user-friendly message. */
export function isTimeoutError(e: unknown): boolean {
    return e instanceof Error && e.name === "AbortError";
}

// Localized via backend-i18n; a function (not a const) so it reflects the
// language selected at call time, not at module load.
export function timeoutMsg(): string {
    return bt("timeout");
}
