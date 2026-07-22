/**
 * Faz CC-7 — Code review (Claude-Code /code-review parity, lightweight).
 *
 * Takes a git diff, asks the model for structured findings, and parses the reply
 * into {file, line, severity, summary} rows the UI can render. Pure prompt +
 * parse here; the git diff and the model call are provided by the caller
 * (executor in tools.ts / host hook in main.ts) so this stays unit-testable.
 */

export type Severity = "high" | "medium" | "low";

export interface Finding {
    file: string;
    line: number | null;
    severity: Severity;
    summary: string;
}

const SEVERITY_ORDER: Record<Severity, number> = {high: 0, medium: 1, low: 2};

/** The instruction we send with the diff. We ask for one finding per line, pipe-delimited. */
export function buildReviewPrompt(diff: string): string {
    return [
        "You are a senior code reviewer. Review the following git diff and report concrete problems only:",
        "bugs, security issues, resource leaks, incorrect logic, missing error handling, obvious performance traps.",
        "Do NOT report style nits or praise. If there are no real problems, reply with the single line: NO_FINDINGS.",
        "",
        "Output format — one finding per line, no prose, no markdown, exactly:",
        "SEVERITY | file/path | line | one-sentence problem",
        "SEVERITY is one of high, medium, low. Use the new-file line number, or 0 if not line-specific.",
        "",
        "DIFF:",
        diff,
    ].join("\n");
}

function normSeverity(s: string): Severity {
    const v = s.trim().toLowerCase();
    if (v.startsWith("high") || v === "h" || v === "critical") return "high";
    if (v.startsWith("low") || v === "l") return "low";
    return "medium";
}

/** Parse the model reply into findings, sorted most-severe first. */
export function parseFindings(reply: string): Finding[] {
    const text = (reply ?? "").trim();
    if (!text || /^NO_FINDINGS\b/i.test(text)) return [];
    const out: Finding[] = [];
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim().replace(/^[-*\d.)\s]+/, ""); // strip list markers
        if (!line || !line.includes("|")) continue;
        const parts = line.split("|").map((p) => p.trim());
        if (parts.length < 4) continue;
        const [sev, file, lineNo, ...rest] = parts;
        const summary = rest.join(" | ").trim();
        if (!file || !summary) continue;
        const n = parseInt(lineNo, 10);
        out.push({
            file,
            line: Number.isFinite(n) && n > 0 ? n : null,
            severity: normSeverity(sev),
            summary,
        });
    }
    return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Render findings as the tool's text result (also what the model sees). */
export function formatFindings(findings: Finding[]): string {
    if (findings.length === 0) return "No issues found in the changes.";
    const counts = {high: 0, medium: 0, low: 0} as Record<Severity, number>;
    for (const f of findings) counts[f.severity]++;
    const header = `${findings.length} finding(s) — ${counts.high} high, ${counts.medium} medium, ${counts.low} low:`;
    const lines = findings.map((f) => {
        const loc = f.line ? `${f.file}:${f.line}` : f.file;
        return `[${f.severity.toUpperCase()}] ${loc} — ${f.summary}`;
    });
    return `${header}\n${lines.join("\n")}`;
}
