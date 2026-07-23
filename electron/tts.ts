// @ts-ignore
import {MsEdgeTTS, OUTPUT_FORMAT} from "msedge-tts";
import {fetchWithTimeout} from "./fetch-utils";
import * as fs from "fs";
import * as path from "path";

export interface TtsOptions {
    provider: "edge" | "elevenlabs" | "kokoro";
    voice: string;
    rate: number;
    elevenlabsKey: string;
}

function compressSilence(pcm: Float32Array, sampleRate = 24000, maxSilenceMs = 500): Float32Array {
    const maxSamp = (maxSilenceMs * sampleRate) / 1000;
    const frameLen = 240;
    const out: number[] = [];
    let silentAcc = 0;
    for (let i = 0; i < pcm.length; i += frameLen) {
        const chunk = pcm.slice(i, i + frameLen);
        const rms = Math.sqrt(chunk.reduce((s, v) => s + v * v, 0) / chunk.length);
        if (rms < 0.003) {
            silentAcc += chunk.length;
            if (silentAcc <= maxSamp) out.push(...chunk);
        } else {
            silentAcc = 0;
            out.push(...chunk);
        }
    }
    return new Float32Array(out);
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
let _kokoroWarmupDone = false;

// ── Kokoro model files are downloaded to a WRITABLE folder (in the packaged app
// node_modules/asar is read-only). The main process passes the userData path here at startup.
const KOKORO_REPO = "onnx-community/Kokoro-82M-v1.0-ONNX";
let _kokoroModelDir: string | null = null;

/** Called by main.ts at startup: the writable folder where model weights will be downloaded. */
export function setKokoroModelDir(dir: string): void {
    _kokoroModelDir = dir;
}

/** Point the transformers cache folder to a writable directory (not before require — before from_pretrained is enough). */
function configureTransformersCache(): void {
    if (!_kokoroModelDir) return;
    try {
        // @ts-ignore
        const {env} = require("@huggingface/transformers");
        env.cacheDir = _kokoroModelDir;
        env.allowLocalModels = true;
    } catch { /* fine if transformers isn't present yet; from_pretrained will throw anyway */ }
}

/** The exact folder where downloaded model files will live (HF cache layout: models--owner--repo). */
function kokoroSnapshotDir(): string | null {
    if (!_kokoroModelDir) return null;
    const safe = "models--" + KOKORO_REPO.replace(/\//g, "--");
    return path.join(_kokoroModelDir, safe);
}

/** Are the model files present ON DISK? Doesn't trust the require.resolve cache. */
export function isKokoroInstalled(): boolean {
    const snap = kokoroSnapshotDir();
    if (!snap) return false;
    try {
        if (!fs.existsSync(snap)) return false;
        // snapshots/<hash>/onnx/*.onnx — there must be at least one .onnx weight file.
        return hasOnnxWeight(snap);
    } catch { return false; }
}

function hasOnnxWeight(dir: string): boolean {
    let found = false;
    const walk = (d: string, depth: number) => {
        if (found || depth > 6) return;
        for (const e of fs.readdirSync(d, {withFileTypes: true})) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) { walk(full, depth + 1); continue; }
            // Accept any sizable model weight file. The q8 build lands as
            // model_quantized.onnx; some transformers versions split weights into a
            // companion .onnx_data blob and keep the .onnx graph small — so match
            // either extension and use a 500 KB floor (a real weight file clears it,
            // a truncated/partial download does not).
            const isWeight = e.name.endsWith(".onnx") || e.name.endsWith(".onnx_data");
            if (isWeight) {
                try { if (fs.statSync(full).size > 500_000) { found = true; return; } } catch { /* ignore */ }
            }
        }
    };
    try { walk(dir, 0); } catch { /* ignore */ }
    return found;
}

/** Delete the model folder entirely. Returns whether it was actually deleted. */
export function deleteKokoroModel(): {deleted: boolean; freedBytes: number} {
    const snap = kokoroSnapshotDir();
    if (!snap || !fs.existsSync(snap)) return {deleted: false, freedBytes: 0};
    let freed = 0;
    try { freed = dirSize(snap); } catch { /* ignore */ }
    fs.rmSync(snap, {recursive: true, force: true});
    _kokoro = null;            // release the in-memory instance
    _kokoroWarmupDone = false;
    return {deleted: !fs.existsSync(snap), freedBytes: freed};
}

function dirSize(dir: string): number {
    let total = 0;
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) total += dirSize(full);
        else { try { total += fs.statSync(full).size; } catch { /* ignore */ } }
    }
    return total;
}

export function warmupKokoro(voice: string): void {
    if (_kokoroWarmupDone) return;
    if (!isKokoroInstalled()) return; // if the model isn't there, don't trigger a download — warmup only
    _kokoroWarmupDone = true;
    getKokoro()
        .then((tts: any) => tts.generate(".", {voice: voice || "af_heart"}))
        .catch(() => {});
}

export type KokoroProgressCb = (info: {status: string; file?: string; progress?: number; loaded?: number; total?: number}) => void;

export async function loadKokoro(onProgress?: KokoroProgressCb): Promise<void> {
    if (_kokoro) return;
    configureTransformersCache();
    let KokoroTTS: any;
    try {
        // @ts-ignore
        ({KokoroTTS} = require("kokoro-js"));
    } catch {
        throw new Error("KOKORO_NOT_INSTALLED");
    }
    _kokoro = await KokoroTTS.from_pretrained(KOKORO_REPO, {
        dtype: "q8",
        device: "cpu",
        progress_callback: onProgress,
    });
}

async function getKokoro(): Promise<any> {
    if (!_kokoro) await loadKokoro();
    return _kokoro;
}

export async function generateTts(text: string, opts: TtsOptions): Promise<Buffer | null> {
    if (opts.provider === "kokoro") {
        const tts = await getKokoro();
        const audio = await tts.generate(text, {voice: opts.voice});
        const pcm: Float32Array = audio.audio ?? audio.data ?? audio;
        const sr: number = audio.sampling_rate ?? 24000;
        return float32ToWav(compressSilence(pcm, sr), sr);
    }

    if (opts.provider === "elevenlabs") {
        // Don't silently fall through to Edge when ElevenLabs is the chosen engine but
        // the key is missing — that made it look like "ElevenLabs isn't working" when
        // really the key never reached here. Surface the real reason instead.
        if (!opts.elevenlabsKey) {
            throw new Error("ElevenLabs API key is missing. Add it under Settings → API Keys.");
        }
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
            throw new Error(`ElevenLabs ${resp.status}: ${body || "Unknown error. Is the API key correct?"}`);
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
