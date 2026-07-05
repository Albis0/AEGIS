// Supabase free-tier projects pause after inactivity: the first request after a
// pause fails with DNS/5xx symptoms until the project wakes (~10-30s). Retry
// those specific failures quietly instead of surfacing a raw error on first launch.

/** Matches "project is waking up / briefly unreachable" symptoms only —
 *  auth failures, quota errors etc. must NOT retry. */
export function isWakingError(message: string, status?: number): boolean {
    if (status !== undefined && [502, 503, 521, 522, 540].includes(status)) return true;
    return /fetch failed|failed to fetch|enotfound|econnrefused|econnreset|etimedout|getaddrinfo|socket hang up|network|521|522/i.test(message);
}

export interface WakeRetryOpts {
    attempts?: number;   // total tries (default 4)
    delayMs?: number;    // wait between tries (default 8000)
    onRetry?: (attempt: number) => void;
}

/** Run fn; if it throws a waking-class error, wait and retry. Anything else rethrows immediately. */
export async function withWakeRetry<T>(fn: () => Promise<T>, opts: WakeRetryOpts = {}): Promise<T> {
    const attempts = opts.attempts ?? 4;
    const delayMs = opts.delayMs ?? 8000;
    let lastErr: unknown;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            const msg = (e as Error)?.message ?? String(e);
            const status = (e as {status?: number})?.status;
            if (!isWakingError(msg, status) || i === attempts) throw e;
            opts.onRetry?.(i);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw lastErr;
}
