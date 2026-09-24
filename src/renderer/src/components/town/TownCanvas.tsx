import { useEffect, useRef } from 'react'
import type { AgentId } from '@shared/agents'
import { GRID_H, GRID_W, buildTownMap, type Pt } from '../../state/townGrid'
import type { AgentPose } from '../../state/townTasks'

export interface TownAgentSprite {
  id: AgentId
  title: string
  connected: boolean
  pos: Pt
  pose: AgentPose
}

interface TownCanvasProps {
  player: Pt
  agents: TownAgentSprite[]
  accentTriplet: string
  reduced: boolean
}

const FALLBACK = {
  edge: '36 47 61',
  panel: '13 20 29',
  panelRaised: '20 29 41',
  ink: '203 213 225',
  inkMuted: '100 116 139'
}

function cssRgb(name: string, fallback: string): string {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    if (value.startsWith('#')) {
      const hex = value.replace('#', '')
      return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')
    }
    return value || fallback
  } catch {
    return fallback
  }
}

export function TownCanvas({ player, agents, accentTriplet, reduced }: TownCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const agentRef = useRef(agents)
  agentRef.current = agents
  const playerRef = useRef(player)
  playerRef.current = player
  const accentRef = useRef(accentTriplet)
  accentRef.current = accentTriplet
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const map = buildTownMap()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = (): void => {
      const parent = canvas.parentElement
      if (!parent) return
      const w = parent.clientWidth || 420
      const h = parent.clientHeight || 250
      const tile = Math.max(2, Math.min(Math.floor(w / GRID_W), Math.floor(h / GRID_H)))
      canvas.width = GRID_W * tile * dpr
      canvas.height = GRID_H * tile * dpr
      canvas.style.width = `${GRID_W * tile}px`
      canvas.style.height = `${GRID_H * tile}px`
    }
    resize()
    const observer = new ResizeObserver(resize)
    if (canvas.parentElement) observer.observe(canvas.parentElement)

    let rafId = 0
    let last = 0

    const sprite = (at: Pt, color: string, tMs: number, scale: number, dir: 1 | -1): void => {
      const bob = reducedRef.current ? 0 : Math.sin(tMs / 320 + at.x) * scale * 0.1
      const s = scale
      const cx = at.x * s
      const foot = at.y * s + s * 0.34
      const stagger = (tMs / 150) % 2
      const legSwing = reducedRef.current ? 0 : s * 0.16 * (stagger < 1 ? 1 : -1)
      ctx.fillStyle = 'rgb(71 85 105)'
      ctx.fillRect(cx - s * 0.32 + legSwing * 0.5, foot, s * 0.24, s * 0.2)
      ctx.fillRect(cx + s * 0.08 - legSwing * 0.5, foot, s * 0.24, s * 0.2)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(cx - s * 0.4, at.y * s - s * 1.28 + bob, s * 0.8, s * 0.78, s * 0.22)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, at.y * s - s * 1.5 + bob, s * 0.3, 0, Math.PI * 2)
      ctx.fill()
      void dir
    }

    const draw = (now: number): void => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const edge = cssRgb('--c-edge', FALLBACK.edge)
      const panel = cssRgb('--c-panel', FALLBACK.panel)
      const raised = cssRgb('--c-panel-raised', FALLBACK.panelRaised)
      const inkMuted = cssRgb('--c-ink-muted', FALLBACK.inkMuted)
      const accent = accentRef.current || edge

      const parent = canvas.parentElement
      const tile = Math.max(
        2,
        Math.min(
          Math.floor((parent?.clientWidth ?? 420) / GRID_W),
          Math.floor((parent?.clientHeight ?? 250) / GRID_H)
        )
      )
      const s = tile

      ctx.fillStyle = `rgb(${panel})`
      ctx.fillRect(0, 0, GRID_W * s, GRID_H * s)

      for (let y = 0; y < GRID_H; y++) {
        const row = map[y]
        if (!row) continue
        for (let x = 0; x < GRID_W; x++) {
          const tile = row[x]
          if (!tile) continue
          const kind = tile.kind
          const px = x * s
          const py = y * s
          if ((x + y) % 2 === 0) {
            ctx.fillStyle = `rgb(${panel})`
            ctx.fillRect(px, py, s, s)
          }
          ctx.fillStyle = `rgb(${edge} / 0.28)`
          ctx.fillRect(px, py, s, 1)
          ctx.fillRect(px, py, 1, s)

          if (kind === 'wall') {
            ctx.fillStyle = `rgb(${edge} / 0.55)`
            ctx.fillRect(px, py, s, s)
            ctx.fillStyle = `rgb(${edge} / 0.25)`
            ctx.fillRect(px + s * 0.18, py + s * 0.18, s * 0.64, s * 0.64)
          } else if (kind === 'desk') {
            ctx.fillStyle = `rgb(${raised} / 0.92)`
            ctx.fillRect(px, py, s, s)
            ctx.fillStyle = `rgb(${edge} / 0.75)`
            ctx.fillRect(px + s * 0.08, py + s * 0.42, s * 0.84, s * 0.09)
            ctx.fillStyle = `rgb(${inkMuted} / 0.55)`
            ctx.fillRect(px + s * 0.28, py + s * 0.26, s * 0.44, s * 0.1)
            ctx.fillRect(px + s * 0.4, py + s * 0.1, s * 0.2, s * 0.16)
          } else if (kind === 'whiteboard') {
            ctx.fillStyle = `rgb(${raised} / 0.7)`
            ctx.fillRect(px, py, s, s)
            ctx.strokeStyle = `rgb(${accent} / 0.6)`
            ctx.lineWidth = 1
            ctx.strokeRect(px + s * 0.14, py + s * 0.12, s * 0.72, s * 0.76)
            ctx.strokeStyle = `rgb(${accent} / 0.35)`
            ctx.beginPath()
            ctx.moveTo(px + s * 0.26, py + s * 0.7)
            ctx.lineTo(px + s * 0.42, py + s * 0.5)
            ctx.lineTo(px + s * 0.54, py + s * 0.62)
            ctx.lineTo(px + s * 0.72, py + s * 0.34)
            ctx.stroke()
          } else if (kind === 'server') {
            ctx.fillStyle = `rgb(${edge} / 0.42)`
            ctx.fillRect(px + s * 0.14, py + s * 0.16, s * 0.52, s * 0.68)
            for (let ring = 0; ring < 3; ring++) {
              ctx.fillStyle = `rgb(${edge} / 0.7)`
              ctx.fillRect(px + s * 0.2, py + s * 0.26 + ring * s * 0.2, s * 0.4, s * 0.06)
              ctx.fillStyle = `rgb(${accent} / 0.7)`
              ctx.fillRect(px + s * 0.2, py + s * 0.26 + ring * s * 0.2, s * 0.06, s * 0.06)
            }
          } else if (kind === 'coffee') {
            ctx.fillStyle = `rgb(${edge} / 0.6)`
            ctx.fillRect(px + s * 0.28, py + s * 0.46, s * 0.44, s * 0.38)
            ctx.fillStyle = `rgb(${raised})`
            ctx.fillRect(px + s * 0.38, py + s * 0.5, s * 0.24, s * 0.28)
            ctx.fillStyle = `rgb(${accent} / 0.55)`
            ctx.fillRect(px + s * 0.62, py + s * 0.54, s * 0.06, s * 0.2)
            ctx.fillRect(px + s * 0.4, py + s * 0.24, s * 0.05, s * 0.14)
            ctx.fillRect(px + s * 0.5, py + s * 0.18, s * 0.05, s * 0.18)
          } else if (kind === 'plant') {
            ctx.fillStyle = 'rgb(34 197 94 / 0.6)'
            ctx.beginPath()
            ctx.arc(px + s * 0.5, py + s * 0.36, s * 0.24, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = `rgb(${edge} / 0.6)`
            ctx.fillRect(px + s * 0.34, py + s * 0.62, s * 0.32, s * 0.24)
          }
        }
      }

      for (const agent of agentRef.current) {
        const busy = agent.pose === 'working' || agent.pose === 'needs-approval'
        const walking = agent.pose === 'walking'
        const flash = agent.pose === 'done' || agent.pose === 'failed' || agent.pose === 'cancelled'
        const color =
          busy || flash
            ? `rgb(${accent})`
            : agent.connected
              ? 'rgb(148 163 184)'
              : 'rgb(100 116 139 / 0.45)'
        if (!agent.connected) {
          ctx.globalAlpha = 0.45
        }
        sprite(agent.pos, color, now, s, 1)
        ctx.globalAlpha = 1

        ctx.font = `600 ${Math.max(11, Math.round(s * 0.55))}px "JetBrains Mono", monospace`
        ctx.textAlign = 'center'
        const labelY = agent.pos.y * s - s * 1.8
        const labelW = ctx.measureText(agent.title).width + s * 0.7
        ctx.fillStyle = `rgb(${panel} / 0.92)`
        ctx.beginPath()
        ctx.roundRect(agent.pos.x * s - labelW / 2, labelY - s * 0.32, labelW, s * 0.66, s * 0.2)
        ctx.fill()
        ctx.fillStyle = walking ? `rgb(${accent})` : `rgb(${inkMuted})`
        ctx.fillText(agent.title, agent.pos.x * s, labelY + s * 0.12)
        ctx.fillStyle = agent.connected ? `rgb(${accent})` : 'rgb(100 116 139)'
        ctx.beginPath()
        ctx.arc(
          agent.pos.x * s - labelW / 2 + s * 0.2,
          labelY - s * 0.01,
          Math.max(1.5, s * 0.06),
          0,
          Math.PI * 2
        )
        ctx.fill()
        if (agent.pose === 'done') {
          ctx.fillStyle = `rgb(${accent})`
          ctx.fillText('✓ done', agent.pos.x * s, agent.pos.y * s + s * 1.9)
        } else if (agent.pose === 'failed') {
          ctx.fillStyle = 'rgb(239 68 68)'
          ctx.fillText('✗ failed', agent.pos.x * s, agent.pos.y * s + s * 1.9)
        } else if (agent.pose === 'cancelled') {
          ctx.fillStyle = `rgb(${inkMuted})`
          ctx.fillText('cancelled', agent.pos.x * s, agent.pos.y * s + s * 1.9)
        } else if (busy) {
          ctx.fillStyle = `rgb(${accent} / 0.12)`
          ctx.beginPath()
          ctx.roundRect(
            agent.pos.x * s - s * 0.6,
            agent.pos.y * s - s * 1.9,
            s * 1.2,
            s * 0.62,
            s * 0.2
          )
          ctx.fill()
        }
      }

      const p = playerRef.current
      sprite(p, accent, now, s, 1)
      ctx.strokeStyle = `rgb(${accent} / 0.9)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(p.x * s - s * 0.72, p.y * s - s * 1.75, s * 1.44, s * 1.35, s * 0.3)
      ctx.stroke()
      ctx.font = `600 ${Math.max(11, Math.round(s * 0.55))}px "JetBrains Mono", monospace`
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgb(${accent})`
      ctx.fillText('YOU', p.x * s, p.y * s - s * 2.4)
    }

    const loop = (nowMs: number): void => {
      rafId = requestAnimationFrame(loop)
      if (document.hidden) return
      if (nowMs - last < 1000 / 30) return
      last = nowMs
      draw(nowMs)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [])

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        className="max-h-full max-w-full"
        style={{ imageRendering: 'pixelated' }}
        aria-label="Agent town grid"
      />
    </div>
  )
}
