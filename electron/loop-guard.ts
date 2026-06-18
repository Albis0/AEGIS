/**
 * Faz 53 — Loop Guard & Eylem Bütçesi
 *
 * `runAgent`'taki 8-adım limiti degenerate döngüyü ÇÖZMEZ, sadece geç keser:
 * aynı tool'u tekrar tekrar çağıran model token/para yakar + "AEGIS takıldı" hissi
 * verir. Bu modül degenerate tool-call örüntülerini ERKEN tespit edip durdurur.
 *
 * Tespit edilen üç örüntü:
 *   1. Aynı (tool, args) çağrısının N kez tekrarı           → MAX_IDENTICAL
 *   2. A-B-A-B ping-pong (iki tool arasında salınım)        → PING_PONG_REPEATS
 *   3. Bir polling tool'unun (durum sorgulayan) aşırı çağrısı → POLL_BUDGET
 *
 * Saf veri + saf fonksiyon — Electron'a, dosya sistemine, ağa bağımlı DEĞİL.
 * Her `runAgent` döngüsü kendi `LoopGuard` örneğini açar (paralel istek izolasyonu).
 */

/** Bir tool çağrısının kararı: çalıştır, yoksa neden engellendi. */
export interface GuardVerdict {
    ok: boolean;
    /** Engellendiyse kullanıcıya/modele gösterilecek kısa Türkçe sebep. */
    reason?: string;
    /** Hangi örüntü tetikledi (telemetri / test için). */
    pattern?: "identical" | "ping_pong" | "poll_budget";
}

/** Aynı (tool,args) çağrısı bu kadar kez görülünce engellenir (3. çağrı bloklanır). */
export const MAX_IDENTICAL = 3;
/** Son bu kadar çağrı içinde A-B-A-B örüntüsü aranır. */
export const PING_PONG_WINDOW = 4;
/** Ping-pong: A↔B salınımı bu kadar tam tur tamamlanınca engellenir. */
export const PING_PONG_REPEATS = 2;
/** Polling tool'ları için gevşek bütçe (durum sorguları normalde çok çağrılır). */
export const POLL_BUDGET = 6;

/**
 * Polling / salt-okuma durum tool'ları — döngüde tekrar çağrılması NORMALDİR
 * (ör. indirme ilerlemesi, telemetri). Bunlara identical/ping-pong uygulanmaz;
 * yalnızca daha gevşek POLL_BUDGET geçerli olur. İsim parçası eşleşmesi (substring).
 */
const POLL_TOOL_HINTS = [
    "status", "durum", "get_", "list_", "telemetry", "telemetri",
    "check", "watch", "progress", "ilerleme", "read_", "fetch_url",
    "ping", "system_report", "usage",
];

function isPollTool(tool: string): boolean {
    const t = tool.toLowerCase();
    return POLL_TOOL_HINTS.some((h) => t.includes(h));
}

/**
 * args objesini deterministik bir imzaya çevirir (anahtar sırası fark etmesin).
 * Geçersiz/parse edilemez args ham string olarak kullanılır — yine de stabil hash verir.
 */
function hashCall(tool: string, args: unknown): string {
    let argPart: string;
    try {
        if (args && typeof args === "object") {
            const sorted = Object.keys(args as Record<string, unknown>)
                .sort()
                .reduce<Record<string, unknown>>((acc, k) => {
                    acc[k] = (args as Record<string, unknown>)[k];
                    return acc;
                }, {});
            argPart = JSON.stringify(sorted);
        } else {
            argPart = String(args ?? "");
        }
    } catch {
        argPart = String(args ?? "");
    }
    return `${tool}::${argPart}`;
}

export class LoopGuard {
    /** Çağrı imzası → kaç kez görüldü. */
    private counts = new Map<string, number>();
    /** Sadece tool adlarının zaman sıralı geçmişi (ping-pong tespiti için). */
    private toolSeq: string[] = [];
    /** Polling tool adı → bütçe sayacı. */
    private pollCounts = new Map<string, number>();

    /**
     * Bir tool çağrısı YÜRÜTÜLMEDEN ÖNCE çağır. Çalışmasına izin varsa
     * sayaçları günceller ve `{ok:true}` döner; degenerate örüntü tespit
     * edilirse `{ok:false, reason}` döner ve çağrı atlanmalıdır.
     */
    check(tool: string, args: unknown): GuardVerdict {
        // ── Polling tool'ları: yalnızca gevşek bütçe ─────────────────────────
        if (isPollTool(tool)) {
            const n = (this.pollCounts.get(tool) ?? 0) + 1;
            this.pollCounts.set(tool, n);
            this.toolSeq.push(tool);
            if (n > POLL_BUDGET) {
                return {
                    ok: false,
                    pattern: "poll_budget",
                    reason: `"${tool}" durum sorgusu ${POLL_BUDGET} kez tekrarlandı; sonuç değişmiyor gibi. Döngüyü durduruyorum.`,
                };
            }
            return {ok: true};
        }

        // ── Aynı (tool,args) tekrarı ─────────────────────────────────────────
        const sig = hashCall(tool, args);
        const seen = (this.counts.get(sig) ?? 0) + 1;
        this.counts.set(sig, seen);
        this.toolSeq.push(tool);

        if (seen >= MAX_IDENTICAL) {
            return {
                ok: false,
                pattern: "identical",
                reason: `Aynı işlemi ("${tool}") aynı argümanlarla ${seen}. kez deniyorum — sonuç değişmeyecek. Döngüyü durdurdum.`,
            };
        }

        // ── A-B-A-B ping-pong ────────────────────────────────────────────────
        if (this.detectPingPong()) {
            return {
                ok: false,
                pattern: "ping_pong",
                reason: `İki işlem arasında ("${this.toolSeq[this.toolSeq.length - 2]}" ↔ "${tool}") gidip geliyorum. Bu bir döngü; durdurdum.`,
            };
        }

        return {ok: true};
    }

    /**
     * Son PING_PONG_WINDOW çağrıda A-B-A-B (en az PING_PONG_REPEATS tam tur)
     * örüntüsü var mı? Yalnızca tam-değişimli, iki farklı tool salınımı sayılır.
     */
    private detectPingPong(): boolean {
        const seq = this.toolSeq;
        const need = PING_PONG_WINDOW;
        if (seq.length < need) return false;
        const tail = seq.slice(-need);
        const a = tail[0];
        const b = tail[1];
        if (a === b) return false; // salınım değil, aynı tool tekrarı (identical kapsar)
        for (let i = 0; i < need; i++) {
            const expected = i % 2 === 0 ? a : b;
            if (tail[i] !== expected) return false;
        }
        return true;
    }

    /** Test/telemetri: bir imzanın şimdiye kadarki çağrı sayısı. */
    countOf(tool: string, args: unknown): number {
        return this.counts.get(hashCall(tool, args)) ?? 0;
    }
}
