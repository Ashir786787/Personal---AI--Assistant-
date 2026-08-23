import { useEffect, useRef } from 'react'
import { THEME_ACCENT, type ThemeId } from '../../theme'

export interface AgentStatus {
  id: string
  name: string
  domain: string
  busy: boolean
}

const AGENTS: AgentStatus[] = [
  { id: 'alice', name: 'ALICE', domain: 'FILES', busy: false },
  { id: 'bob', name: 'BOB', domain: 'SYSTEM', busy: false },
  { id: 'carol', name: 'CAROL', domain: 'ROUTINES', busy: false },
  { id: 'dave', name: 'DAVE', domain: 'RESEARCH', busy: false }
]

interface TownProps {
  theme: ThemeId
  activity: 'files' | 'system' | 'routines' | 'research' | null
}

interface AgentRender {
  x: number
  y: number
  targetX: number
  targetY: number
  bobPhase: number
}

const DESKS = [
  { x: 0.16, y: 0.42 },
  { x: 0.38, y: 0.42 },
  { x: 0.6, y: 0.42 },
  { x: 0.82, y: 0.42 }
]

export function AgentTown({ theme, activity }: TownProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef(activity)
  activeRef.current = activity

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = canvas.parentElement?.clientWidth ?? 800
    let height = canvas.parentElement?.clientHeight ?? 480

    const resize = (): void => {
      width = canvas.parentElement?.clientWidth ?? 800
      height = canvas.parentElement?.clientHeight ?? 480
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    if (canvas.parentElement) observer.observe(canvas.parentElement)

    const accentOf = (): string =>
      getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() ||
      THEME_ACCENT[theme]
        .replace('#', '')
        .match(/.{2}/g)!
        .map((h) => parseInt(h, 16))
        .join(' ')

    const renders: AgentRender[] = DESKS.map((desk) => ({
      x: desk.x,
      y: desk.y + 0.12,
      targetX: desk.x,
      targetY: desk.y + 0.12,
      bobPhase: Math.random() * Math.PI * 2
    }))

    let rafId = 0
    let lastTime = performance.now()

    const draw = (now: number): void => {
      const dt = Math.min(now - lastTime, 50)
      lastTime = now
      const tSec = now / 1000
      const accentTriplet = accentOf()
      const edgeRgb =
        getComputedStyle(document.documentElement).getPropertyValue('--c-edge').trim() || '36 47 61'

      ctx.clearRect(0, 0, width, height)

      // floor grid
      ctx.strokeStyle = `rgb(${edgeRgb} / 0.35)`
      ctx.lineWidth = 1
      const gridStep = 44
      const offsetY = height * 0.28
      for (let gx = -gridStep; gx < width + gridStep; gx += gridStep) {
        ctx.beginPath()
        ctx.moveTo(gx, offsetY)
        ctx.lineTo(gx + (height - offsetY) * 0.35, height)
        ctx.stroke()
      }
      for (let gy = offsetY; gy < height; gy += gridStep * 0.6) {
        ctx.beginPath()
        ctx.moveTo(-50 + (gy - offsetY) * 0.35, gy)
        ctx.lineTo(width + 50 + (gy - offsetY) * 0.35, gy)
        ctx.stroke()
      }

      // coffee point
      const coffeeX = width * 0.5
      const coffeeY = height * 0.78

      // desks + monitors + agents
      AGENTS.forEach((agent, index) => {
        const render = renders[index]
        const desk = DESKS[index]
        if (!render || !desk) return
        const isBusy =
          activeRef.current !== null && agent.domain.toLowerCase() === activeRef.current
        if (!isBusy && Math.random() < dt * 0.00008) {
          const goCoffee = Math.abs(render.targetX - desk.x) < 0.001
          render.targetX = goCoffee ? coffeeX + (index - 1.5) * 26 : desk.x
          render.targetY = goCoffee ? coffeeY / height : desk.y + 0.12
        }

        const targetPxX = render.targetX * width
        void targetPxX
        const px = render.x * width
        const py = render.y * height
        const dx = targetPxX - px
        const dy = render.targetY * height - py
        const dist = Math.hypot(dx, dy)
        if (dist > 2) {
          const speed = 0.055 * dt
          render.x += ((dx / dist) * speed) / width
          render.y += ((dy / dist) * speed) / height
        }

        // desk
        const deskPx = desk.x * width
        const deskPy = desk.y * height
        const deskW = width * 0.09
        const deskH = 10
        ctx.fillStyle = `rgb(${edgeRgb} / 0.8)`
        ctx.fillRect(deskPx - deskW / 2, deskPy, deskW, deskH)
        // monitor glow
        const monitorActive = isBusy || Math.sin(tSec * 0.7 + index) > 0.4
        ctx.fillStyle = monitorActive
          ? `rgb(${accentTriplet} / 0.75)`
          : `rgb(${accentTriplet} / 0.18)`
        ctx.fillRect(deskPx - 9, deskPy - 14, 18, 11)

        // agent sprite (pixel person)
        const agentPx = render.x * width
        const agentPy = render.y * height
        const bob = Math.sin(tSec * 3 + render.bobPhase) * 1.5
        const bodyColor = isBusy ? `rgb(${accentTriplet})` : 'rgb(148 163 184)'
        ctx.fillStyle = bodyColor
        // head
        ctx.fillRect(agentPx - 4, agentPy - 22 + bob, 8, 8)
        // torso
        ctx.fillRect(agentPx - 6, agentPy - 13 + bob, 12, 13)
        // legs
        ctx.fillStyle = 'rgb(71 85 105)'
        ctx.fillRect(agentPx - 5, agentPy + bob, 4, 7)
        ctx.fillRect(agentPx + 1, agentPy + bob, 4, 7)

        // status bubble
        ctx.font = '9px "JetBrains Mono", monospace'
        const label = isBusy ? `${agent.name} · ${agent.domain}` : agent.name
        const labelWidth = ctx.measureText(label).width
        const bubbleY = agentPy - 40 + bob
        ctx.fillStyle = isBusy ? `rgb(${accentTriplet} / 0.15)` : 'rgb(255 255 255 / 0.04)'
        ctx.strokeStyle = isBusy ? `rgb(${accentTriplet} / 0.6)` : `rgb(${edgeRgb})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(agentPx - labelWidth / 2 - 6, bubbleY, labelWidth + 12, 15, 7)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = isBusy ? `rgb(${accentTriplet})` : 'rgb(138 151 163)'
        ctx.textAlign = 'center'
        ctx.fillText(label, agentPx, bubbleY + 10.5)

        // role tag under feet
        ctx.font = '8px "JetBrains Mono", monospace'
        ctx.fillStyle = 'rgb(100 116 139)'
        ctx.fillText(agent.domain, deskPx, deskPy + 24)
      })

      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [theme])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} aria-label="Agent town" />
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.3em] text-ink-muted opacity-60">
        Agent Town · four helpers at their desks
      </div>
    </div>
  )
}
