/**
 * Deterministic Reference Resolver (Jarvis Reliability Upgrade)
 *
 * Some user utterances must NOT be left to the LLM, because the model resolves
 * them inconsistently ("works one time, fails the next"):
 *
 *   tekrar yap · aynısını yap · az önce yaptığını yap · bunu tekrar et
 *   bir önceki · onu kapat · biraz artır · biraz azalt
 *   son oynadığım · son açtığım
 *
 * This module resolves ONLY those reference phrases from short-term memory,
 * deterministically. Everything else returns `null` and falls through to the
 * normal LLM tool-calling flow untouched.
 *
 * Contract (matches the agreed shape):
 *   { tool, args, entity, source: "resolver", ... }   when resolved
 *   { needsClarification: true, question, confidence } when ambiguous (<0.7)
 *   null                                               when not a reference phrase
 *
 * No new tools, no new providers — only re-targets EXISTING tools from STM.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SCOPE GUARD — this module is a REFLEX, NOT a BRAIN. Don't grow it.
 *
 *   DOES     : re-targets an EXISTING action in STM (repeat/close/delta).
 *   DOESN'T  : search (Spotify/Steam search), launch apps (start Discord/browser),
 *              intent classification, planning, multi-step reasoning.
 *
 * All of that is the LLM's job. Before adding a new "let X handle this too" pattern, ask:
 * "Is this a REFERENCE to something already done, or a NEW target?"
 * If it's a new target → it does NOT belong here, leave it to the LLM (resolveReference returns null).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {stmGet, stmLastByToolPrefix, stmLastWhere, ToolMemoryEntry} from "./short-term-memory";

export const CONFIDENCE_THRESHOLD = 0.7;

export interface ResolvedAction {
    kind: "action";
    tool: string;
    args: Record<string, unknown>;
    entity: string | null;
    source: "resolver";
    intent: string;          // human-readable label
    confidence: number;      // 0..1
    usedMemory: string;      // which STM fact was used (for Explain Mode)
    resolution: string;      // short description of how it was resolved
}

export interface NeedsClarification {
    kind: "clarify";
    question: string;
    confidence: number;
    intent: string;
    usedMemory: string;
    resolution: string;
}

export type ResolverResult = ResolvedAction | NeedsClarification | null;

// ── normalization (mirrors tools.ts so phrasing matches consistently) ────────
function normalizeTr(s: string): string {
    return s.toLowerCase()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
        .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
        .replace(/î/g, "i").replace(/â/g, "a");
}

// ── delta levels: context-aware, "biraz" = ±5 ───────────────────────────────
// magnitude derived from the wording; direction from artır/azalt.
function deltaMagnitude(norm: string): number {
    if (/\bbiraz daha\b/.test(norm)) return 10;   // "biraz daha" = a notch more than "biraz"
    if (/\bbiraz\b/.test(norm))      return 5;    // "biraz" = ±5  (agreed)
    if (/\bcok\b/.test(norm) || /\bbayagi\b/.test(norm)) return 20; // "çok artır"
    return 10;                                     // bare "artır/azalt" without qualifier
}

function clamp(n: number, lo = 0, hi = 100): number {
    return Math.max(lo, Math.min(hi, n));
}

// Numeric level arg name differs by tool but is always "level" for the volume/
// brightness family we delta-adjust. Reads current value from a prior STM entry.
function currentLevel(entry: ToolMemoryEntry | null): number | null {
    if (!entry) return null;
    const v = entry.args.level;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
}

// ── intent classification (reference phrases only) ───────────────────────────
type RefKind =
    | "repeat"        // tekrar yap / aynısını yap / az önce yaptığını / bunu tekrar et
    | "previous"      // bir önceki / bir öncekini
    | "closeThat"     // onu kapat / bunu kapat / kapat (referans)
    | "deltaUp"       // biraz artır / sesi artır
    | "deltaDown"     // biraz azalt / sesi kıs
    | "lastPlayed"    // son oynadığım (oyun)
    | "lastOpened"    // son açtığım
    | null;

function classify(norm: string): RefKind {
    // delta first — "sesi biraz artır" must not be caught by "repeat" etc.
    const hasArtir = /\b(artir|arttir|yukselt|yuksel|aç)\b/.test(norm) || /sesi ac/.test(norm);
    const hasAzalt = /\b(azalt|kis|dusur|alcalt|indir)\b/.test(norm);
    const hasBiraz = /\bbiraz\b/.test(norm);
    const aboutLevel = /\b(ses|sesi|parlak|parlaklik|brightness|volume)\b/.test(norm) || hasBiraz;

    if (aboutLevel && hasAzalt) return "deltaDown";
    if (aboutLevel && hasArtir) return "deltaUp";

    if (/\bson oynadig/.test(norm) || /\bson oynadik/.test(norm)) return "lastPlayed";
    if (/\bson actig/.test(norm)   || /\bson actik/.test(norm))   return "lastOpened";

    if (/\bbir oncek/.test(norm) || /\boncekini\b/.test(norm))    return "previous";

    if (/\b(onu|bunu|sunu)\b.*\bkapat\b/.test(norm) || /^kapat\b/.test(norm)) return "closeThat";

    if (/\btekrar (yap|et)\b/.test(norm) || /\baynisini\b/.test(norm) ||
        /\baz once yaptigini\b/.test(norm) || /\bbunu tekrar\b/.test(norm) ||
        /\byine yap\b/.test(norm)) return "repeat";

    return null;
}

// ── closing-tool mapping (re-targets EXISTING tools only) ────────────────────
function closeToolFor(entry: ToolMemoryEntry): {tool: string; args: Record<string, unknown>; label: string} | null {
    const t = entry.tool;
    if (t.startsWith("steam_")) return {tool: "steam_close", args: {}, label: "Steam"};
    if (t.startsWith("spotify_")) return {tool: "spotify_pause", args: {}, label: "Spotify"};
    if (t === "focus_window" || t === "run_command") {
        // We don't synthesize a kill command — too risky without an explicit close tool.
        return null;
    }
    return null;
}

/**
 * Resolve a reference utterance against short-term memory.
 * Returns null when the message is NOT a reference phrase (→ normal LLM flow).
 */
export function resolveReference(message: string): ResolverResult {
    const norm = normalizeTr(message).trim();
    const kind = classify(norm);
    if (!kind) return null; // not a reference phrase → LLM handles it

    const ctx = stmGet();
    const recent = ctx.recentTools;

    // No memory at all → we recognized a reference but have nothing to point to.
    if (recent.length === 0) {
        return {
            kind: "clarify",
            question: "I don't know what you mean — I haven't done anything yet. What would you like me to do?",
            confidence: 0.2,
            intent: `reference:${kind}`,
            usedMemory: "(STM empty)",
            resolution: "Reference could not be resolved because STM is empty",
        };
    }

    switch (kind) {
        case "repeat": {
            const last = recent[recent.length - 1];
            return {
                kind: "action",
                tool: last.tool,
                args: {...last.args},
                entity: last.entity,
                source: "resolver",
                intent: "repeat last action",
                confidence: 0.95,
                usedMemory: `lastTool=${last.tool} args=${JSON.stringify(last.args)}`,
                resolution: `"repeat/same again" → last action (${last.tool}) again with the same arguments`,
            };
        }

        case "previous": {
            const prev = recent[recent.length - 2];
            if (!prev) {
                return {
                    kind: "clarify",
                    question: "What do you mean by the previous one? I only remember a single action.",
                    confidence: 0.3,
                    intent: "previous",
                    usedMemory: `recentCount=${recent.length}`,
                    resolution: "No second-to-last action → could not resolve",
                };
            }
            return {
                kind: "action",
                tool: prev.tool,
                args: {...prev.args},
                entity: prev.entity,
                source: "resolver",
                intent: "do the previous action",
                confidence: 0.85,
                usedMemory: `recent[-2]=${prev.tool} args=${JSON.stringify(prev.args)}`,
                resolution: `"previous" → STM[-2] (${prev.tool})`,
            };
        }

        case "closeThat": {
            const last = recent[recent.length - 1];
            const close = closeToolFor(last);
            if (!close) {
                return {
                    kind: "clarify",
                    question: `Can you clarify what kind of close you want for "${last.entity ?? last.tool}"?`,
                    confidence: 0.4,
                    intent: "close that",
                    usedMemory: `lastTool=${last.tool} entity=${last.entity}`,
                    resolution: "No safe close tool matched the last action",
                };
            }
            return {
                kind: "action",
                tool: close.tool,
                args: close.args,
                entity: last.entity ?? close.label,
                source: "resolver",
                intent: "close that",
                confidence: 0.9,
                usedMemory: `lastTool=${last.tool} entity=${last.entity}`,
                resolution: `"close that" → close ${close.label} (${close.tool})`,
            };
        }

        case "deltaUp":
        case "deltaDown": {
            // Find the most recent level-bearing action (spotify_volume / set_volume / set_brightness).
            const lvlEntry = stmLastWhere(
                (e) => e.tool === "spotify_volume" || e.tool === "set_volume" || e.tool === "set_brightness",
            );
            const cur = currentLevel(lvlEntry);
            if (lvlEntry === null || cur === null) {
                return {
                    kind: "clarify",
                    question: "What level should I change? I haven't set any volume/brightness yet.",
                    confidence: 0.35,
                    intent: kind === "deltaUp" ? "increase a bit" : "decrease a bit",
                    usedMemory: lvlEntry ? `${lvlEntry.tool} (level unreadable)` : "(no level action)",
                    resolution: "Current level not in STM → delta could not be applied",
                };
            }
            const mag = deltaMagnitude(norm);
            const next = clamp(kind === "deltaUp" ? cur + mag : cur - mag);
            return {
                kind: "action",
                tool: lvlEntry.tool,
                args: {level: String(next)},
                entity: lvlEntry.entity,
                source: "resolver",
                intent: kind === "deltaUp" ? "increase a bit" : "decrease a bit",
                confidence: 0.9,
                usedMemory: `${lvlEntry.tool} level=${cur}`,
                resolution: `"${kind === "deltaUp" ? "+" : "-"}${mag}" → ${cur} ${kind === "deltaUp" ? "→" : "→"} ${next}`,
            };
        }

        case "lastPlayed": {
            const last = stmLastByToolPrefix("steam_");
            if (!last || !last.entity) {
                return {
                    kind: "clarify",
                    question: "I don't remember the game you last played. Which game should I open?",
                    confidence: 0.3,
                    intent: "open the game I last played",
                    usedMemory: last ? `${last.tool} (no entity)` : "(no steam action)",
                    resolution: "No game entity found in STM",
                };
            }
            return {
                kind: "action",
                tool: "steam_launch",
                args: {game: last.entity},
                entity: last.entity,
                source: "resolver",
                intent: "open the game I last played",
                confidence: 0.9,
                usedMemory: `last steam action: ${last.tool} game=${last.entity}`,
                resolution: `"last played" → ${last.entity} (steam_launch)`,
            };
        }

        case "lastOpened": {
            // Most recent action that opened/launched something with a concrete entity.
            const last = stmLastWhere((e) => !!e.entity &&
                (e.tool === "steam_launch" || e.tool.startsWith("spotify_") || e.tool === "run_command" || e.tool === "focus_window"));
            if (!last || !last.entity) {
                return {
                    kind: "clarify",
                    question: "I don't remember the last thing you opened. What should I open again?",
                    confidence: 0.3,
                    intent: "open what I last opened",
                    usedMemory: last ? `${last.tool} (no entity)` : "(no open action)",
                    resolution: "No opened entity found in STM",
                };
            }
            // Re-open via the same tool that opened it.
            return {
                kind: "action",
                tool: last.tool === "steam_launch" ? "steam_launch" : last.tool,
                args: {...last.args},
                entity: last.entity,
                source: "resolver",
                intent: "open what I last opened again",
                confidence: 0.85,
                usedMemory: `last open: ${last.tool} entity=${last.entity}`,
                resolution: `"last opened" → ${last.entity} (${last.tool})`,
            };
        }
    }

    return null;
}

/** Format a resolver decision for Explain Mode (developer setting). */
export function explainResolution(r: ResolvedAction | NeedsClarification): string {
    const lines = ["[EXPLAIN — reference resolver]"];
    lines.push(`  intent     : ${r.intent}`);
    lines.push(`  confidence : ${r.confidence.toFixed(2)}  (threshold ${CONFIDENCE_THRESHOLD})`);
    lines.push(`  memory     : ${r.usedMemory}`);
    lines.push(`  resolution : ${r.resolution}`);
    if (r.kind === "action") {
        lines.push(`  tool       : ${r.tool}`);
        lines.push(`  args       : ${JSON.stringify(r.args)}`);
        lines.push(`  entity     : ${r.entity ?? "-"}`);
        lines.push(`  source     : ${r.source}`);
    } else {
        lines.push(`  decision   : clarification requested (confidence < threshold)`);
    }
    return lines.join("\n");
}
