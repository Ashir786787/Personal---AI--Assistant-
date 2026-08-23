import { useEffect, useRef } from 'react'

export type OrbState = 'idle' | 'listening' | 'thinking'

interface VoiceOrbProps {
  state: OrbState
  level: number
  onToggle: () => void
}

interface Particle {
  x: number
  y: number
  z: number
  size: number
}

const PARTICLE_COUNT = 240
const TILT = -0.45

function buildSphere(count: number): Particle[] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (i / (count - 1)) * 2
    const radiusAtY = Math.sqrt(1 - y * y)
    const theta = golden * i
    return {
      x: Math.cos(theta) * radiusAtY,
      y,
      z: Math.sin(theta) * radiusAtY,
      size: 0.9 + Math.random() * 1.4
    }
  })
}

export function VoiceOrb({ state, level, onToggle }: VoiceOrbProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<OrbState>(state)
  const levelRef = useRef(level)
  stateRef.current = state
  const latestLevel = level
  levelRef.current = latestLevel

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const readAccent = (): string =>
      getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() ||
      '76 224 210'
    let accentTriplet = readAccent()
    const accentTimer = window.setInterval(() => {
      accentTriplet = readAccent()
    }, 700)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssSize = 340
    canvas.width = cssSize * dpr
    canvas.height = cssSize * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const particles = buildSphere(PARTICLE_COUNT)
    const center = cssSize / 2
    let rotation = 0
    let lastTime = performance.now()
    let rafId = 0
    let running = true

    const onVisibility = (): void => {
      running = !document.hidden
      if (running) {
        lastTime = performance.now()
        rafId = requestAnimationFrame(draw)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const draw = (now: number): void => {
      if (!running) return
      const dt = Math.min(now - lastTime, 50)
      lastTime = now
      const tSec = now / 1000
      const current = stateRef.current
      const micLevel = Math.max(0, Math.min(1, levelRef.current))

      const speed = current === 'thinking' ? 0.0032 : current === 'listening' ? 0.0012 : 0.0006
      rotation += speed * dt

      const baseRadius =
        current === 'thinking'
          ? 74
          : current === 'listening'
            ? 84 + micLevel * 46
            : 86 + Math.sin(tSec * 1.1) * 6

      ctx.clearRect(0, 0, cssSize, cssSize)

      const glowAlpha =
        current === 'thinking' ? 0.26 : current === 'listening' ? 0.18 + micLevel * 0.14 : 0.12
      const coreGradient = ctx.createRadialGradient(center, center, 0, center, center, baseRadius)
      coreGradient.addColorStop(0, `rgb(${accentTriplet} / ${glowAlpha})`)
      coreGradient.addColorStop(0.7, `rgb(${accentTriplet} / ${glowAlpha * 0.35})`)
      coreGradient.addColorStop(1, `rgb(${accentTriplet} / 0)`)
      ctx.fillStyle = coreGradient
      ctx.beginPath()
      ctx.arc(center, center, baseRadius, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = `rgb(${accentTriplet} / 0.22)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(center, center, baseRadius + 14, 0, Math.PI * 2)
      ctx.stroke()

      if (current === 'thinking') {
        const dashOffset = -(tSec * 60) % 24
        ctx.setLineDash([10, 14])
        ctx.lineDashOffset = dashOffset
        ctx.strokeStyle = `rgb(${accentTriplet} / 0.4)`
        ctx.beginPath()
        ctx.arc(center, center, baseRadius + 26, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }

      const cosR = Math.cos(rotation)
      const sinR = Math.sin(rotation)
      const cosT = Math.cos(TILT)
      const sinT = Math.sin(TILT)

      for (const p of particles) {
        const rx = p.x * cosR - p.z * sinR
        const rz = p.x * sinR + p.z * cosR
        const ry = p.y * cosT - rz * sinT
        const depth = p.y * sinT + rz * cosT

        const wobble =
          current === 'thinking'
            ? Math.sin(tSec * 6 + p.size * 9) * 5
            : current === 'listening'
              ? micLevel * Math.sin(tSec * 8 + p.size * 7) * 6
              : Math.sin(tSec * 2 + p.y * 5) * 2.2

        const r = baseRadius + wobble
        const perspective = 320 / (320 - depth * r * 0.55)
        const sx = center + rx * r * perspective
        const sy = center + ry * r * perspective

        const front = (depth + 1) / 2
        const alpha = 0.15 + front * (current === 'idle' ? 0.5 : 0.75)
        ctx.beginPath()
        ctx.arc(sx, sy, p.size * perspective, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${accentTriplet} / ${alpha.toFixed(3)})`
        ctx.fill()
      }

      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.clearInterval(accentTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={state === 'listening' ? 'Stop listening' : 'Start listening'}
      className="orb-stage relative block cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ width: 340, height: 340 }}
    >
      <canvas ref={canvasRef} style={{ width: 340, height: 340 }} aria-hidden="true" />
    </button>
  )
}
