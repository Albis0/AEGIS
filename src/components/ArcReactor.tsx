import ParticleGlobe from './ParticleGlobe'

export type CoreState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

const LABEL: Record<CoreState, string> = {
  idle: 'STANDBY',
  listening: 'LISTENING',
  thinking: 'PROCESSING',
  speaking: 'RESPONDING',
  error: 'ERROR',
}

export default function ArcReactor({ state, capturing }: { state: CoreState; capturing?: boolean }) {
  const active = state !== 'idle'
  const midSpin = state === 'thinking' ? 'spin-fast' : state === 'listening' ? 'breathe-fast' : 'spin-3'

  return (
    <div className="relative grid place-items-center w-full h-full hud" style={{ color: 'rgb(var(--hud))' }}>
      {/* Ambient halo */}
      <div
        className={`absolute rounded-full blur-3xl transition-all duration-700 ${active ? 'w-[80%] h-[80%] opacity-50' : 'w-[64%] h-[64%] opacity-25'}`}
        style={{ background: 'radial-gradient(circle, rgba(var(--hud),0.45), transparent 65%)' }}
      />

      {/* Outer dashed ring */}
      <svg className="absolute w-[98%] h-[98%] spin-1" viewBox="0 0 200 200" fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="97" strokeWidth="0.4" strokeOpacity="0.35" strokeDasharray="1 5" />
      </svg>

      {/* Tick ring with 60 ticks */}
      <svg className="absolute w-[90%] h-[90%] spin-2" viewBox="0 0 200 200" fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="92" strokeWidth="0.3" strokeOpacity="0.18" />
        {Array.from({ length: 60 }).map((_, i) => (
          <line
            key={i}
            x1="100" y1="8"
            x2="100" y2={i % 5 === 0 ? '15' : '12'}
            strokeWidth={i % 5 === 0 ? '0.7' : '0.35'}
            strokeOpacity={i % 5 === 0 ? '0.55' : '0.28'}
            transform={`rotate(${i * 6} 100 100)`}
          />
        ))}
      </svg>

      {/* Bracket arcs */}
      <svg className="absolute w-[80%] h-[80%] spin-2" viewBox="0 0 200 200" fill="none" stroke="currentColor">
        {[0, 90, 180, 270].map((a) => (
          <path key={a} d="M 100 18 A 82 82 0 0 1 158 42" strokeWidth="1.4" strokeOpacity="0.5" strokeLinecap="round" transform={`rotate(${a} 100 100)`} />
        ))}
      </svg>

      {/* Thin segmented accent ring (speeds up when thinking) */}
      <svg className={`absolute w-[74%] h-[74%] ${midSpin}`} viewBox="0 0 200 200" fill="none" stroke="currentColor">
        {Array.from({ length: 3 }).map((_, i) => (
          <circle key={i} cx="100" cy="100" r="80" strokeWidth="1.5" strokeOpacity="0.45" strokeDasharray="80 87.5" strokeDashoffset={-i * 167.5} strokeLinecap="round" />
        ))}
      </svg>

      {/* Particle globe — the centerpiece */}
      <div className="absolute w-[70%] h-[70%]">
        <ParticleGlobe state={state} capturing={capturing} />
      </div>

      {/* State label */}
      <div className="absolute bottom-[2%] text-[10px] tracking-[0.5em] glow-text flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
        {LABEL[state]}
        {active && <span className="flick">●</span>}
      </div>
    </div>
  )
}
