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
      const bob = reducedRef.current ? 0 : Math.sin(tMs / 320 + at.x) * scale * 0.12
      const s = scale
      ctx.fillStyle = color
      ctx.fillRect(at.x * s - s * 0.28, at.y * s - s * 1.3 + bob, s * 0.56, s * 0.56)
      ctx.fillRect(at.x * s - s * 0.42, at.y * s - s * 0.7 + bob, s * 0.84, s * 0.8)
      ctx.fillStyle = 'rgb(71 85 105)'
      const stride = (tMs / 140) % 2
      const legSwing = reducedRef.current ? 0 : scale * 0.14 * (stride < 1 ? 1 : -1)
      ctx.fillRect(at.x * s - s * 0.34 + legSwing * 0.5, at.y * s + bob, s * 0.28, s * 0.42)
      ctx.fillRect(at.x * s + s * 0.06 - legSwing * 0.5, at.y * s + bob, s * 0.28, s * 0.42)
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
          } else if (kind === 'desk') {
            ctx.fillStyle = `rgb(${raised} / 0.9)`
            ctx.fillRect(px, py, s, s)
            ctx.fillStyle = `rgb(${edge} / 0.7)`
            ctx.fillRect(px + s * 0.1, py + s * 0.4, s * 0.8, s * 0.08)
          } else if (kind === 'whiteboard') {
            ctx.fillStyle = `rgb(${raised} / 0.7)`
            ctx.fillRect(px, py, s, s)
            ctx.strokeStyle = `rgb(${accent} / 0.55)`
            ctx.lineWidth = 1
            ctx.strokeRect(px + s * 0.18, py + s * 0.18, s * 0.64, s * 0.64)
            ctx.fillStyle = `rgb(${inkMuted} / 0.5)`
            ctx.fillRect(px + s * 0.28, py + s * 0.34, s * 0.44, s * 0.05)
            ctx.fillRect(px + s * 0.28, py + s * 0.5, s * 0.3, s * 0.05)
          } else if (kind === 'server') {
            ctx.fillStyle = `rgb(${edge} / 0.4)`
            ctx.fillRect(px + s * 0.15, py + s * 0.2, s * 0.5, s * 0.34)
            ctx.fillRect(px + s * 0.15, py + s * 0.6, s * 0.5, s * 0.2)
          } else if (kind === 'coffee') {
            ctx.fillStyle = `rgb(${edge} / 0.6)`
            ctx.fillRect(px + s * 0.3, py + s * 0.5, s * 0.4, s * 0.32)
            ctx.fillStyle = `rgb(${accent} / 0.5)`
            ctx.fillRect(px + s * 0.4, py + s * 0.2, s * 0.06, s * 0.2)
          } else if (kind === 'plant') {
            ctx.fillStyle = 'rgb(34 197 94 / 0.55)'
            ctx.fillRect(px + s * 0.42, py + s * 0.2, s * 0.16, s * 0.5)
            ctx.fillRect(px + s * 0.2, py + s * 0.4, s * 0.16, s * 0.3)
            ctx.fillRect(px + s * 0.63, py + s * 0.4, s * 0.16, s * 0.3)
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

        ctx.font = `600 ${Math.max(9, Math.round(s * 0.55))}px "JetBrains Mono", monospace`
        ctx.textAlign = 'center'
        ctx.fillStyle = walking ? `rgb(${accent})` : `rgb(${inkMuted})`
        ctx.fillText(agent.title, agent.pos.x * s, agent.pos.y * s - s * 1.5)
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
      ctx.font = `600 ${Math.max(9, Math.round(s * 0.55))}px "JetBrains Mono", monospace`
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
