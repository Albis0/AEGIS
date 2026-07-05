// Pure helpers for sentence-level streaming TTS (shared by App.tsx and useVoice).

/** Edge/Kokoro TTS input cap per sentence. */
export const TTS_MAX_CHARS = 500;

/** Sentence boundary: punctuation followed by whitespace, or a blank line. */
export const SENT_END = /(?<=[.!?])\s+|(?<=\n)\s*\n/;

/** Split a streaming buffer into complete sentences + the unfinished remainder. */
export function splitSentences(buf: string): {sentences: string[]; rest: string} {
    const sentences: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = SENT_END.exec(buf)) !== null) {
        const sentence = buf.slice(0, match.index + 1).trim();
        buf = buf.slice(match.index + match[0].length);
        if (sentence) sentences.push(sentence);
    }
    return {sentences, rest: buf};
}

/** Strip markdown/emoji so the TTS engine doesn't read asterisks aloud. */
export function cleanForTts(text: string): string {
    return text
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/#{1,6}\s+/g, "")
        .replace(/`[^`]+`/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
