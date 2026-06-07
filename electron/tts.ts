// @ts-ignore
import {MsEdgeTTS, OUTPUT_FORMAT} from "msedge-tts";
import {fetchWithTimeout} from "./fetch-utils";

export interface TtsOptions {
    provider: "edge" | "elevenlabs";
    voice: string;
    rate: number;
    elevenlabsKey: string;
}

export async function generateTts(text: string, opts: TtsOptions): Promise<Buffer | null> {
    if (opts.provider === "elevenlabs" && opts.elevenlabsKey) {
        const voiceId = opts.voice.startsWith("el:") ? opts.voice.slice(3) : "cgSgspJ2msm6clMCkdW9";
        const speed = Math.max(0.7, Math.min(1.2, opts.rate));
        const resp = await fetchWithTimeout(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                method: "POST",
                headers: {"xi-api-key": opts.elevenlabsKey, "Content-Type": "application/json"},
                body: JSON.stringify({
                    text,
                    model_id: "eleven_flash_v2_5",
                    voice_settings: {stability: 0.5, similarity_boost: 0.75},
                    output_format: "mp3_44100_128",
                    speed,
                }),
            },
            30_000,
        );
        if (!resp.ok) {
            const body = await resp.text().catch(() => "");
            throw new Error(`ElevenLabs ${resp.status}: ${body || "Bilinmeyen hata. API key doğru mu?"}`);
        }
        return Buffer.from(await resp.arrayBuffer());
    }

    // Edge TTS (default)
    const tts = new MsEdgeTTS();
    const rateStr = opts.rate === 1.0 ? "+0%" : `${opts.rate > 1 ? "+" : ""}${Math.round((opts.rate - 1) * 100)}%`;
    await tts.setMetadata(opts.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const {audioStream} = await tts.toStream(text, {rate: rateStr});
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
        audioStream.on("data", (d: Buffer) => chunks.push(d));
        audioStream.on("close", resolve);
        audioStream.on("error", reject);
    });
    return Buffer.concat(chunks);
}
