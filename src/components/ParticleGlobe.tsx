import { useEffect, useRef } from 'react'
import type { CoreState } from './ArcReactor'

type P = { x: number; y: number; z: number }

// Fibonacci sphere — evenly distributed points on a sphere surface
function makeSphere(n: number): P[] {
  const pts: P[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const t = golden * i
    pts.push({ x: Math.cos(t) * r, y, z: Math.sin(t) * r })
  }
  return pts
}

function readHud(): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--hud').trim()
  const parts = v.split(',').map((s) => parseInt(s.trim(), 10))
  return parts.length === 3 && parts.every((n) => !isNaN(n)) ? (parts as [number, number, number]) : [34, 211, 238]
}

export default function ParticleGlobe({ state }: { state: CoreState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<CoreState>(state)
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let size = 0
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      size = Math.min(rect.width, rect.height)
      canvas.width = size * dpr
      canvas.height = size * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const sphere = makeSphere(520)
    // a few "connection nodes" — brighter dots that get linked
    const nodeIdx = Array.from({ length: 26 }, () => Math.floor(Math.random() * sphere.length))

    let rotY = 0
    let rotX = 0.32
    let raf = 0
    let last = performance.now()

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 3)
      last = now
      const st = stateRef.current
      const speed = st === 'thinking' ? 0.012 : st === 'speaking' ? 0.006 : 0.0035
      rotY += speed * dt

      const [r, g, b] = readHud()
      const cx = size / 2
      const cy = size / 2
      const radius = size * 0.4

      ctx.clearRect(0, 0, size, size)

      const cosY = Math.cos(rotY)
      const sinY = Math.sin(rotY)
      const cosX = Math.cos(rotX)
      const sinX = Math.sin(rotX)

      // project all points
      const proj = sphere.map((p) => {
        // rotate Y
        let x = p.x * cosY - p.z * sinY
        let z = p.x * sinY + p.z * cosY
        let y = p.y
        // rotate X
        const y2 = y * cosX - z * sinX
        const z2 = y * sinX + z * cosX
        y = y2
        z = z2
        const depth = (z + 1) / 2 // 0 (back) .. 1 (front)
        return { sx: cx + x * radius, sy: cy + y * radius, depth }
      })

      // links between nearby nodes (constellation feel)
      ctx.lineWidth = 0.6
      for (let i = 0; i < nodeIdx.length; i++) {
        for (let j = i + 1; j < nodeIdx.length; j++) {
          const a = proj[nodeIdx[i]]
          const c = proj[nodeIdx[j]]
          const dx = a.sx - c.sx
          const dy = a.sy - c.sy
          const dist = Math.hypot(dx, dy)
          if (dist < radius * 0.55) {
            const alpha = (1 - dist / (radius * 0.55)) * 0.25 * Math.min(a.depth, c.depth)
            ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
            ctx.beginPath()
            ctx.moveTo(a.sx, a.sy)
            ctx.lineTo(c.sx, c.sy)
            ctx.stroke()
          }
        }
      }

      // dots (sorted by depth: back first)
      const order = proj.map((_, i) => i).sort((i, j) => proj[i].depth - proj[j].depth)
      for (const i of order) {
        const pt = proj[i]
        const isNode = nodeIdx.includes(i)
        const dotR = (isNode ? 1.8 : 1.0) * (0.4 + pt.depth * 0.9)
        const alpha = 0.12 + pt.depth * 0.85
        if (isNode) {
          ctx.fillStyle = `rgba(180,220,255,${alpha})`
        } else {
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
        }
        ctx.beginPath()
        ctx.arc(pt.sx, pt.sy, dotR, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
