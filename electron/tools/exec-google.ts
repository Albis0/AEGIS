/**
 * Google (Gmail + Calendar) tool executors — Phase 7.3.
 * Thin arg-coercion wrappers over google.ts; schemas live in tools/schemas.ts.
 */

import {googleAuthorize, googleDisconnect, googleStatus, gmailList, gmailRead, gmailSend, calendarListEvents, calendarCreateEvent, calendarDeleteEvent} from "../google";
import type {ToolExecutor} from "./executor-types";

export const googleExecutors: Record<string, ToolExecutor> = {
    async google_authorize() { return googleAuthorize(); },
    async google_disconnect() { return googleDisconnect(); },
    async google_status() { return googleStatus(); },
    async gmail_list({query, limit}: {query?: unknown; limit?: unknown} = {}) {
        return gmailList(typeof query === "string" ? query : "", Number(limit ?? 10));
    },
    async gmail_read({id}: {id?: unknown}) { return gmailRead(String(id ?? "")); },
    async gmail_send({to, subject, body}: {to?: unknown; subject?: unknown; body?: unknown}) {
        return gmailSend(String(to ?? ""), String(subject ?? ""), String(body ?? ""));
    },
    async calendar_events({days}: {days?: unknown} = {}) { return calendarListEvents(Number(days ?? 7)); },
    async calendar_create_event({summary, start, end, description, location}: {summary?: unknown; start?: unknown; end?: unknown; description?: unknown; location?: unknown}) {
        return calendarCreateEvent({
            summary: String(summary ?? ""),
            start: String(start ?? ""),
            end: end ? String(end) : undefined,
            description: description ? String(description) : undefined,
            location: location ? String(location) : undefined,
        });
    },
    async calendar_delete_event({id}: {id?: unknown}) { return calendarDeleteEvent(String(id ?? "")); },
};
