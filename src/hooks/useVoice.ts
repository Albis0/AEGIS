import {useCallback, useEffect, useRef, useState} from "react";

export type VoiceMode = "off" | "always-on" | "wake-word";

const WAKE_RE = /\baegis[',!?.]*\b/i;
const SILENCE_MS = 1400; // ms of silence after speech ends → send
const MIN_RECORD_MS = 800; // ignore clips shorter than this (Whisper needs real audio)
const NOISE_ADAPT_RATE = 0.015; // how fast baseline noise adapts (slower = more stable)
const SPEECH_RATIO = 5.0; // speech = rms > baseline * this ratio (higher = less false triggers)

export function useVoice({onTranscript, isBusyRef, ttsRate = 1.0}: {onTranscript: (text: string) => void; isBusyRef: React.MutableRefObject<boolean>; ttsRate?: number}) {
    const [mode, setModeState] = useState<VoiceMode>("off");
    const [listening, setListening] = useState(false);
    const [activated, setActivated] = useState(false);
    const [capturing, setCapturing] = useState(false); // true while mic is actively recording speech

    const modeRef = useRef<VoiceMode>("off");
    const ttsRateRef = useRef(ttsRate);
    useEffect(() => { ttsRateRef.current = ttsRate; }, [ttsRate]);
    const activatedRef = useRef(false);
    const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Recording state
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recordStartRef = useRef<number>(0);
    const isRecordingRef = useRef(false);
    const isActiveRef = useRef(false); // overall mic session active

    // AudioContext for VAD (voice activity detection)
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const vadRafRef = useRef<number>(0);
    const speakingRef = useRef(false);

    const processTranscript = useCallback(
        (text: string) => {
            const lower = text.toLowerCase();

            if (modeRef.current === "always-on") {
                if (!isBusyRef.current) onTranscript(text);
                return;
            }

            // wake-word mode
            if (!activatedRef.current) {
                if (WAKE_RE.test(lower)) {
                    const after = text.replace(/^.*\baegis[',!?.]*\s*/i, "").trim();
                    if (after && !isBusyRef.current) {
                        onTranscript(after);
                    } else if (!after) {
                        activatedRef.current = true;
                        setActivated(true);
                        if (activationTimerRef.current) clearTimeout(activationTimerRef.current);
                        activationTimerRef.current = setTimeout(() => {
                            activatedRef.current = false;
                            setActivated(false);
                        }, 8000);
                    }
                }
            } else {
                if (activationTimerRef.current) {
                    clearTimeout(activationTimerRef.current);
                    activationTimerRef.current = null;
                }
                if (!isBusyRef.current) onTranscript(text);
                activatedRef.current = false;
                setActivated(false);
            }
        },
        [isBusyRef, onTranscript],
    );

    const sendAudio = useCallback(async () => {
        if (chunksRef.current.length === 0) return;
        const elapsed = Date.now() - recordStartRef.current;
        if (elapsed < MIN_RECORD_MS) {
            chunksRef.current = [];
            return;
        }

        const blob = new Blob(chunksRef.current, {type: "audio/webm"});
        chunksRef.current = [];

        try {
            const arrayBuffer = await blob.arrayBuffer();
            const result = await window.jarvis.transcribe(arrayBuffer);
            if (result.error) {
                console.warn("Transcribe hatası:", result.error);
                return;
            }
            const text = (result.text ?? "").trim();
            if (text) processTranscript(text);
        } catch (e) {
            console.warn("Transcribe exception:", e);
        }
    }, [processTranscript]);

    const stopRecording = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (recorderRef.current && isRecordingRef.current) {
            try {
                recorderRef.current.stop();
            } catch {
                /* ignore */
            }
        }
    }, []);

    // Start a single recording segment
    const startRecording = useCallback(() => {
        if (!streamRef.current || isRecordingRef.current) return;

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
        const recorder = new MediaRecorder(streamRef.current, {mimeType});
        recorderRef.current = recorder;
        chunksRef.current = [];
        recordStartRef.current = Date.now();
        isRecordingRef.current = true;
        setCapturing(true);

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
            isRecordingRef.current = false;
            recorderRef.current = null;
            setCapturing(false);
            await sendAudio();
        };

        recorder.onerror = () => {
            isRecordingRef.current = false;
            setCapturing(false);
        };
        recorder.start(100);
    }, [sendAudio, setCapturing]);

    // VAD loop with adaptive noise baseline
    const startVAD = useCallback(() => {
        if (!analyserRef.current) return;
        const analyser = analyserRef.current;
        const buf = new Uint8Array(analyser.fftSize);
        let noiseBaseline = 1.5; // initial guess, adapts quickly
        let adaptPause = 0; // frames to skip baseline adaptation after recording stops
        let logThrottle = 0;

        const tick = () => {
            if (!isActiveRef.current) return;
            vadRafRef.current = requestAnimationFrame(tick);

            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
                const v = buf[i] - 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            const threshold = noiseBaseline * SPEECH_RATIO;
            const hasSpeech = rms > threshold;

            // Adapt baseline only during silence, with a cooldown after recording stops
            if (isRecordingRef.current) {
                adaptPause = 30; // skip ~500ms of adaptation after clip ends
            } else if (adaptPause > 0) {
                adaptPause--;
            } else {
                noiseBaseline = noiseBaseline * (1 - NOISE_ADAPT_RATE) + rms * NOISE_ADAPT_RATE;
                if (noiseBaseline < 0.3) noiseBaseline = 0.3;
            }

            if (++logThrottle % 90 === 0) {
                console.log(`[VAD] RMS:${rms.toFixed(1)} base:${noiseBaseline.toFixed(1)} thr:${threshold.toFixed(1)}${hasSpeech ? " ← KONUŞMA" : ""}`);
            }

            if (hasSpeech) {
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                }
                if (!isRecordingRef.current) startRecording();
            } else {
                if (isRecordingRef.current && !silenceTimerRef.current) {
                    silenceTimerRef.current = setTimeout(() => {
                        silenceTimerRef.current = null;
                        stopRecording();
                    }, SILENCE_MS);
                }
            }
        };
        vadRafRef.current = requestAnimationFrame(tick);
    }, [startRecording, stopRecording]);

    // Fully tear down mic + AudioContext (used when mode goes off)
    const stopListening = useCallback(() => {
        isActiveRef.current = false;
        cancelAnimationFrame(vadRafRef.current);
        speakingRef.current = false;
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (recorderRef.current && isRecordingRef.current) {
            try {
                recorderRef.current.stop();
            } catch {
                /* ignore */
            }
        }
        recorderRef.current = null;
        isRecordingRef.current = false;
        if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => {});
            audioCtxRef.current = null;
            analyserRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        chunksRef.current = [];
        setListening(false);
        setActivated(false);
        activatedRef.current = false;
        if (activationTimerRef.current) {
            clearTimeout(activationTimerRef.current);
            activationTimerRef.current = null;
        }
    }, []);

    // Pause VAD + recorder without closing the mic stream (used during TTS)
    const pauseVAD = useCallback(() => {
        cancelAnimationFrame(vadRafRef.current);
        speakingRef.current = false;
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (recorderRef.current && isRecordingRef.current) {
            try {
                recorderRef.current.stop();
            } catch {
                /* ignore */
            }
        }
        recorderRef.current = null;
        isRecordingRef.current = false;
        chunksRef.current = [];
    }, []);

    // Resume VAD on existing stream (after TTS ends)
    const resumeVAD = useCallback(() => {
        if (!isActiveRef.current || !analyserRef.current) return;
        startVAD();
    }, [startVAD]);

    const startListening = useCallback(async () => {
        if (modeRef.current === "off") return;
        if (isActiveRef.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
            streamRef.current = stream;
            isActiveRef.current = true;

            const audioCtx = new AudioContext();
            audioCtxRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            analyserRef.current = analyser;

            setListening(true);
            startVAD();
        } catch (e: any) {
            console.error("[VAD] Mikrofon hatası:", e.name, e.message ?? e);
            modeRef.current = "off";
            setModeState("off");
            setListening(false);
        }
    }, [startVAD]);

    const setMode = useCallback(
        (m: VoiceMode) => {
            modeRef.current = m;
            setModeState(m);
            if (m === "off") {
                stopListening();
            } else {
                stopListening();
                setTimeout(() => startListening(), 100);
            }
        },
        [startListening, stopListening],
    );

    const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const ttsAudioCtxRef = useRef<AudioContext | null>(null);

    const onSpeakEndRef = useRef<(() => void) | null>(null);

    const stopSpeaking = useCallback(() => {
        try {
            ttsSourceRef.current?.stop();
        } catch {
            /* ignore */
        }
        ttsSourceRef.current = null;
        ttsAudioCtxRef.current?.close().catch(() => {});
        ttsAudioCtxRef.current = null;
        // Resume mic if it was paused for TTS
        if (modeRef.current !== "off") setTimeout(() => resumeVAD(), 200);
        onSpeakEndRef.current?.();
        onSpeakEndRef.current = null;
    }, [resumeVAD]);

    const speak = useCallback(
        async (text: string, onEnd?: () => void) => {
            pauseVAD();
            stopSpeaking();
            onSpeakEndRef.current = onEnd ?? null;

            try {
                const clean = text
                    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
                    .replace(/\*\*([^*]+)\*\*/g, "$1")
                    .replace(/\*([^*]+)\*/g, "$1")
                    .replace(/#{1,6}\s+/g, "")
                    .replace(/`[^`]+`/g, "")
                    .replace(/\s+/g, " ")
                    .trim();
                const result = await window.jarvis.tts(clean.slice(0, 500));
                if (result.error || !result.buffer) {
                    console.warn("TTS hatası:", result.error);
                    if (modeRef.current !== "off") setTimeout(() => resumeVAD(), 200);
                    onSpeakEndRef.current?.();
                    onSpeakEndRef.current = null;
                    return;
                }

                const audioCtx = new AudioContext();
                ttsAudioCtxRef.current = audioCtx;

                // result.buffer is a plain object from IPC, rebuild as Uint8Array
                const raw = result.buffer as unknown as {data: number[]};
                const bytes = raw.data ? new Uint8Array(raw.data) : new Uint8Array(result.buffer as unknown as ArrayBuffer);
                const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);

                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioCtx.destination);
                ttsSourceRef.current = source;

                source.onended = () => {
                    ttsSourceRef.current = null;
                    audioCtx.close().catch(() => {});
                    ttsAudioCtxRef.current = null;
                    if (modeRef.current !== "off") setTimeout(() => resumeVAD(), 200);
                    onSpeakEndRef.current?.();
                    onSpeakEndRef.current = null;
                };

                source.start();
            } catch (e) {
                console.warn("TTS oynatma hatası:", e);
                if (modeRef.current !== "off") setTimeout(() => resumeVAD(), 200);
                onSpeakEndRef.current?.();
                onSpeakEndRef.current = null;
            }
        },
        [pauseVAD, resumeVAD, stopSpeaking],
    );

    useEffect(() => {
        return () => {
            modeRef.current = "off";
            stopListening();
            stopSpeaking();
        };
    }, [stopListening, stopSpeaking]);

    return {mode, setMode, listening, activated, capturing, speak, stopSpeaking};
}
