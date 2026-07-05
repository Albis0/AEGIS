import {describe, it, expect} from "vitest";
import {splitSentences, cleanForTts, TTS_MAX_CHARS} from "../src/tts-stream";

describe("splitSentences", () => {
    it("extracts complete sentences and keeps the unfinished remainder", () => {
        const r = splitSentences("Merhaba dünya. İkinci cümle! Üçüncü yarım kal");
        expect(r.sentences).toEqual(["Merhaba dünya.", "İkinci cümle!"]);
        expect(r.rest).toBe("Üçüncü yarım kal");
    });

    it("streaming chunks: no boundary → everything stays in rest", () => {
        const r = splitSentences("Henüz nokta yok");
        expect(r.sentences).toEqual([]);
        expect(r.rest).toBe("Henüz nokta yok");
    });

    it("splits on blank lines (lists/paragraphs without punctuation)", () => {
        const r = splitSentences("Birinci paragraf\n\nikinci kısım devam");
        expect(r.sentences).toEqual(["Birinci paragraf"]);
        expect(r.rest).toBe("ikinci kısım devam");
    });

    it("decimal numbers don't split mid-sentence without whitespace", () => {
        const r = splitSentences("Fiyat 3.14 lira oldu. Sonraki");
        expect(r.sentences).toEqual(["Fiyat 3.14 lira oldu."]);
        expect(r.rest).toBe("Sonraki");
    });
});

describe("cleanForTts", () => {
    it("strips markdown emphasis, headers, inline code and emoji", () => {
        expect(cleanForTts("## Başlık\n**kalın** ve *italik* `kod` 🎉 son"))
            .toBe("Başlık kalın ve italik son");
    });

    it("cap constant sane", () => {
        expect(TTS_MAX_CHARS).toBeGreaterThanOrEqual(200);
    });
});
