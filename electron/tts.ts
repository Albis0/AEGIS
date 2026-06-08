// @ts-ignore
import {MsEdgeTTS, OUTPUT_FORMAT} from "msedge-tts";
import {fetchWithTimeout} from "./fetch-utils";

export interface TtsOptions {
    provider: "edge" | "elevenlabs" | "kokoro";
    voice: string;
    rate: number;
    elevenlabsKey: string;
}

function float32ToWav(pcm: Float32Array, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcm.length * 2;
    const buf = Buffer.alloc(44 + dataSize);

    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(numChannels, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(byteRate, 28);
    buf.writeUInt16LE(blockAlign, 32);
    buf.writeUInt16LE(bitsPerSample, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < pcm.length; i++) {
        const s = Math.max(-1, Math.min(1, pcm[i]));
        buf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, 44 + i * 2);
    }
    return buf;
}

let _kokoro: any = null;
async function getKokoro(): Promise<any> {
    if (!_kokoro) {
        // @ts-ignore — kokoro-js uses package exports not supported by moduleResolution:node
        const {KokoroTTS} = require("kokoro-js");
        _kokoro = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
            dtype: "q8",
            device: "wasm",
        });
    }
    return _kokoro;
}

export async function generateTts(text: string, opts: TtsOptions): Promise<Buffer | null> {
    if (opts.provider === "kokoro") {
        const tts = await getKokoro();
        const audio = await tts.generate(text, {voice: opts.voice});
        const pcm: Float32Array = audio.data ?? audio;
        return float32ToWav(pcm, 24000);
    }

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
