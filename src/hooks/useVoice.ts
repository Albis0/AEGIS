import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceMode = 'off' | 'always-on' | 'wake-word'

const WAKE_RE = /\bjarvis[',!?.]*\b/i

// Web Speech API types not always present in DOM lib
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  abort(): void
  onstart: ((e: Event) => void) | null
  onend: ((e: Event) => void) | null
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
}
interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

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

  const modeRef = useRef<VoiceMode>('off')
  const activatedRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices() }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  const stopListening = useCallback(() => {
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setListening(false)
    setActivated(false)
    activatedRef.current = false
  }, [])

  const startListening = useCallback(() => {
    if (modeRef.current === 'off') return
    const SR: SpeechRecognitionConstructor | undefined = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) { console.warn('SpeechRecognition desteklenmiyor'); return }

    recognitionRef.current?.abort()
    recognitionRef.current = null

    const rec = new SR()
    rec.lang = 'tr-TR'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onstart = () => {
      setListening(true)
      window.speechSynthesis.cancel()
    }

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
      }
      if (!final.trim()) return

      const lower = final.toLowerCase().trim()

      if (modeRef.current === 'always-on') {
        if (!isBusyRef.current) onTranscript(final.trim())
        return
      }

      // wake-word mode
      if (!activatedRef.current) {
        if (WAKE_RE.test(lower)) {
          const after = lower.replace(/^.*\bjarvis[',!?.]*\s*/i, '').trim()
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
        if (!isBusyRef.current && lower) onTranscript(final.trim())
        activatedRef.current = false
        setActivated(false)
      }
    }

    rec.onend = () => {
      recognitionRef.current = null
      if (modeRef.current !== 'off') {
        restartTimerRef.current = setTimeout(startListening, 150)
      } else {
        setListening(false)
      }
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech') return // onend will restart
      if (e.error === 'not-allowed' || e.error === 'service-not-available') {
        console.warn('Mikrofon erişimi reddedildi:', e.error)
        modeRef.current = 'off'
        setModeState('off')
        setListening(false)
        return
      }
      console.warn('SpeechRecognition hatası:', e.error)
    }

    recognitionRef.current = rec
    try { rec.start() } catch { /* zaten başlatılmış olabilir */ }
  }, [isBusyRef, onTranscript])

  const setMode = useCallback((m: VoiceMode) => {
    modeRef.current = m
    setModeState(m)
    if (m === 'off') {
      stopListening()
    } else {
      stopListening()
      setTimeout(startListening, 50)
    }
  }, [startListening, stopListening])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    synthRef.current = null
  }, [])

  const speak = useCallback((text: string) => {
    stopListening()
    window.speechSynthesis.cancel()

    const sentence = text.match(/^[^.!?]+[.!?]/)?.[0] ?? text.slice(0, 220)
    const utt = new SpeechSynthesisUtterance(sentence)
    utt.lang = 'tr-TR'
    utt.rate = 1.05
    utt.pitch = 0.9

    const trVoice = voicesRef.current.find(v => v.lang.startsWith('tr'))
    if (trVoice) utt.voice = trVoice

    utt.onend = () => {
      synthRef.current = null
      if (modeRef.current !== 'off') setTimeout(startListening, 100)
    }

    synthRef.current = utt
    window.speechSynthesis.speak(utt)
  }, [startListening, stopListening, stopSpeaking])

  useEffect(() => {
    return () => {
      modeRef.current = 'off'
      stopListening()
      window.speechSynthesis.cancel()
      if (activationTimerRef.current) clearTimeout(activationTimerRef.current)
    }
  }, [stopListening])

  return { mode, setMode, listening, activated, speak, stopSpeaking }
}
