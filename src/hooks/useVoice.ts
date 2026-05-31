import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceMode = 'off' | 'always-on' | 'wake-word'

const WAKE_RE = /\bjarvis[',!?.]*\b/i
const SILENCE_MS = 1400    // ms of silence after speech ends → send
const MIN_RECORD_MS = 400   // ignore clips shorter than this
const NOISE_ADAPT_RATE = 0.02  // how fast baseline noise adapts
const SPEECH_RATIO = 4.0       // speech = rms > baseline * this ratio

export function useVoice({
    onTranscript,
    isBusyRef,
}: {
    onTranscript: (text: string) => void
    isBusyRef: React.MutableRefObject<boolean>
}) {
    const [mode, setModeState] = useState<VoiceMode>('off')
    const [listening, setListening] = useState(false)
    const [activated, setActivated] = useState(false)
    const [capturing, setCapturing] = useState(false)  // true while mic is actively recording speech

    const modeRef = useRef<VoiceMode>('off')
    const activatedRef = useRef(false)
    const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const voicesRef = useRef<SpeechSynthesisVoice[]>([])
    const synthRef = useRef<SpeechSynthesisUtterance | null>(null)

    // Recording state
    const streamRef = useRef<MediaStream | null>(null)
    const recorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const recordStartRef = useRef<number>(0)
    const isRecordingRef = useRef(false)
    const isActiveRef = useRef(false)  // overall mic session active

    // AudioContext for VAD (voice activity detection)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const vadRafRef = useRef<number>(0)
    const speakingRef = useRef(false)

    useEffect(() => {
        const load = () => { voicesRef.current = window.speechSynthesis.getVoices() }
        load()
        window.speechSynthesis.addEventListener('voiceschanged', load)
        return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
    }, [])

    const processTranscript = useCallback((text: string) => {
        const lower = text.toLowerCase()

        if (modeRef.current === 'always-on') {
            if (!isBusyRef.current) onTranscript(text)
            return
        }

        // wake-word mode
        if (!activatedRef.current) {
            if (WAKE_RE.test(lower)) {
                const after = text.replace(/^.*\bjarvis[',!?.]*\s*/i, '').trim()
                if (after && !isBusyRef.current) {
                    onTranscript(after)
                } else if (!after) {
                    activatedRef.current = true
                    setActivated(true)
                    if (activationTimerRef.current) clearTimeout(activationTimerRef.current)
                    activationTimerRef.current = setTimeout(() => {
                        activatedRef.current = false
                        setActivated(false)
                    }, 8000)
                }
            }
        } else {
            if (activationTimerRef.current) { clearTimeout(activationTimerRef.current); activationTimerRef.current = null }
            if (!isBusyRef.current) onTranscript(text)
            activatedRef.current = false
            setActivated(false)
        }
    }, [isBusyRef, onTranscript])

    const sendAudio = useCallback(async () => {
        if (chunksRef.current.length === 0) return
        const elapsed = Date.now() - recordStartRef.current
        if (elapsed < MIN_RECORD_MS) { chunksRef.current = []; return }

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        chunksRef.current = []

        try {
            const arrayBuffer = await blob.arrayBuffer()
            const result = await window.jarvis.transcribe(arrayBuffer)
            if (result.error) { console.warn('Transcribe hatası:', result.error); return }
            const text = (result.text ?? '').trim()
            if (text) processTranscript(text)
        } catch (e) {
            console.warn('Transcribe exception:', e)
        }
    }, [processTranscript])

    const stopRecording = useCallback(() => {
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
        if (recorderRef.current && isRecordingRef.current) {
            try { recorderRef.current.stop() } catch { /* ignore */ }
        }
    }, [])

    // Start a single recording segment
    const startRecording = useCallback(() => {
        if (!streamRef.current || isRecordingRef.current) return

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm'
        const recorder = new MediaRecorder(streamRef.current, { mimeType })
        recorderRef.current = recorder
        chunksRef.current = []
        recordStartRef.current = Date.now()
        isRecordingRef.current = true
        setCapturing(true)

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = async () => {
            isRecordingRef.current = false
            recorderRef.current = null
            setCapturing(false)
            await sendAudio()
        }

        recorder.onerror = () => { isRecordingRef.current = false; setCapturing(false) }
        recorder.start(100)
    }, [sendAudio, setCapturing])

    // VAD loop with adaptive noise baseline
    const startVAD = useCallback(() => {
        if (!analyserRef.current) return
        const analyser = analyserRef.current
        const buf = new Uint8Array(analyser.fftSize)
        let noiseBaseline = 1.5  // initial guess, adapts quickly
        let logThrottle = 0

        const tick = () => {
            if (!isActiveRef.current) return
            vadRafRef.current = requestAnimationFrame(tick)

            analyser.getByteTimeDomainData(buf)
            let sum = 0
            for (let i = 0; i < buf.length; i++) {
                const v = buf[i] - 128
                sum += v * v
            }
            const rms = Math.sqrt(sum / buf.length)
            const threshold = noiseBaseline * SPEECH_RATIO
            const hasSpeech = rms > threshold

            // Adapt baseline only during silence (not during speech)
            if (!isRecordingRef.current) {
                noiseBaseline = noiseBaseline * (1 - NOISE_ADAPT_RATE) + rms * NOISE_ADAPT_RATE
                // Floor the baseline so it never goes to 0
                if (noiseBaseline < 0.3) noiseBaseline = 0.3
            }

            if (++logThrottle % 90 === 0) {
                console.log(`[VAD] RMS:${rms.toFixed(1)} base:${noiseBaseline.toFixed(1)} thr:${threshold.toFixed(1)}${hasSpeech ? ' ← KONUŞMA' : ''}`)
            }

            if (hasSpeech) {
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current)
                    silenceTimerRef.current = null
                }
                if (!isRecordingRef.current) startRecording()
            } else {
                if (isRecordingRef.current && !silenceTimerRef.current) {
                    silenceTimerRef.current = setTimeout(() => {
                        silenceTimerRef.current = null
                        stopRecording()
                    }, SILENCE_MS)
                }
            }
        }
        vadRafRef.current = requestAnimationFrame(tick)
    }, [startRecording, stopRecording])

    // Fully tear down mic + AudioContext (used when mode goes off)
    const stopListening = useCallback(() => {
        isActiveRef.current = false
        cancelAnimationFrame(vadRafRef.current)
        speakingRef.current = false
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
        if (recorderRef.current && isRecordingRef.current) {
            try { recorderRef.current.stop() } catch { /* ignore */ }
        }
        recorderRef.current = null
        isRecordingRef.current = false
        if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => {})
            audioCtxRef.current = null
            analyserRef.current = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        chunksRef.current = []
        setListening(false)
        setActivated(false)
        activatedRef.current = false
        if (activationTimerRef.current) { clearTimeout(activationTimerRef.current); activationTimerRef.current = null }
    }, [])

    // Pause VAD + recorder without closing the mic stream (used during TTS)
    const pauseVAD = useCallback(() => {
        cancelAnimationFrame(vadRafRef.current)
        speakingRef.current = false
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
        if (recorderRef.current && isRecordingRef.current) {
            try { recorderRef.current.stop() } catch { /* ignore */ }
        }
        recorderRef.current = null
        isRecordingRef.current = false
        chunksRef.current = []
    }, [])

    // Resume VAD on existing stream (after TTS ends)
    const resumeVAD = useCallback(() => {
        if (!isActiveRef.current || !analyserRef.current) return
        startVAD()
    }, [startVAD])

    const startListening = useCallback(async () => {
        if (modeRef.current === 'off') return
        if (isActiveRef.current) return

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            streamRef.current = stream
            isActiveRef.current = true

            const audioCtx = new AudioContext()
            audioCtxRef.current = audioCtx
            const source = audioCtx.createMediaStreamSource(stream)
            const analyser = audioCtx.createAnalyser()
            analyser.fftSize = 512
            source.connect(analyser)
            analyserRef.current = analyser

            setListening(true)
            startVAD()
        } catch (e: any) {
            console.error('[VAD] Mikrofon hatası:', e.name, e.message ?? e)
            modeRef.current = 'off'
            setModeState('off')
            setListening(false)
        }
    }, [startVAD])

    const setMode = useCallback((m: VoiceMode) => {
        modeRef.current = m
        setModeState(m)
        if (m === 'off') {
            stopListening()
        } else {
            stopListening()
            setTimeout(() => startListening(), 100)
        }
    }, [startListening, stopListening])

    const stopSpeaking = useCallback(() => {
        window.speechSynthesis.cancel()
        synthRef.current = null
    }, [])

    const speak = useCallback((text: string) => {
        // Pause VAD (keep stream open) to avoid echo
        pauseVAD()
        window.speechSynthesis.cancel()

        const sentence = text.slice(0, 500)
        const utt = new SpeechSynthesisUtterance(sentence)
        utt.lang = 'tr-TR'
        utt.rate = 1.05
        utt.pitch = 0.9

        const trVoice = voicesRef.current.find(v => v.lang.startsWith('tr'))
        if (trVoice) utt.voice = trVoice

        utt.onend = () => {
            synthRef.current = null
            // Resume VAD on same stream — no new getUserMedia needed
            if (modeRef.current !== 'off') setTimeout(() => resumeVAD(), 200)
        }

        synthRef.current = utt
        window.speechSynthesis.speak(utt)
    }, [pauseVAD, resumeVAD])

    useEffect(() => {
        return () => {
            modeRef.current = 'off'
            stopListening()
            window.speechSynthesis.cancel()
        }
    }, [stopListening])

    return { mode, setMode, listening, activated, capturing, speak, stopSpeaking }

}
