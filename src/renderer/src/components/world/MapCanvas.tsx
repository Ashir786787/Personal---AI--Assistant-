import { useEffect, useRef } from 'react'
import type { Hotspot } from '@shared/feed'
import { LAND_RINGS, GAZETTEER } from '../../state/land'
import { clamp, clampZoom } from '../../state/geo'
import { planCountryLabels } from '../../state/labels'

interface MapCanvasProps {
  hotspots: Hotspot[]
}

const MIN_ZOOM = 1
const MAX_ZOOM = 8

const FALLBACK = {
  edge: '36 47 61',
  panel: '13 20 29',
  inkMuted: '148 163 184',
  accent: '56 189 248'
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

export function MapCanvas({ hotspots }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hotspotsRef = useRef(hotspots)
  hotspotsRef.current = hotspots

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let lon = 0
    let lat = 0
    let zoom = 1
    let pointerDown = false
    let lastPointer = { x: 0, y: 0 }
    let size = { w: 320, h: 240 }

    const resize = (): void => {
      const parent = canvas.parentElement
      if (!parent) return
      size = { w: parent.clientWidth || 320, h: parent.clientHeight || 240 }
      canvas.width = Math.max(1, Math.round(size.w * dpr))
      canvas.height = Math.max(1, Math.round(size.h * dpr))
      canvas.style.width = `${size.w}px`
      canvas.style.height = `${size.h}px`
    }
    resize()
    const observer = new ResizeObserver(resize)
    if (canvas.parentElement) observer.observe(canvas.parentElement)

    const toScreen = (l: number, a: number): { x: number; y: number } => {
      const cxp = (lon + 180) / 360
      const cyp = (90 - lat) / 180
      const wx = (l + 180) / 360
      const wy = (90 - a) / 180
      return {
        x: (wx - cxp) * size.w * zoom + size.w / 2,
        y: (wy - cyp) * size.h * zoom + size.h / 2
      }
    }

    const onPointerDown = (event: PointerEvent): void => {
      pointerDown = true
      lastPointer = { x: event.clientX, y: event.clientY }
      canvas.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent): void => {
      if (!pointerDown) return
      lon = lon - ((event.clientX - lastPointer.x) / (size.w * zoom)) * 360
      lat = clamp(lat + ((event.clientY - lastPointer.y) / (size.h * zoom)) * 180, -85, 85)
      lastPointer = { x: event.clientX, y: event.clientY }
    }
    const endDrag = (): void => {
      pointerDown = false
    }
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const before = clampZoom(zoom, MIN_ZOOM, MAX_ZOOM)
      const next = clampZoom(before * (event.deltaY > 0 ? 0.88 : 1.14), MIN_ZOOM, MAX_ZOOM)
      if (next === before) return
      const wx = (px / size.w - 0.5) / before + (lon + 180) / 360
      const wy = (py / size.h - 0.5) / before + (90 - lat) / 180
      lon = wx * 360 - 180
      lat = 90 - wy * 180
      zoom = next
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointercancel', endDrag)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    let rafId = 0
    let last = 0

    const draw = (): void => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.w, size.h)

      const edge = cssRgb('--c-edge', FALLBACK.edge)
      const panel = cssRgb('--c-panel', FALLBACK.panel)
      const accent = cssRgb('--c-accent', FALLBACK.accent)

      ctx.fillStyle = `rgb(${panel})`
      ctx.fillRect(0, 0, size.w, size.h)

      ctx.strokeStyle = `rgb(${edge} / 0.22)`
      ctx.lineWidth = 1
      for (const graticuleLon of [-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]) {
        const from = toScreen(graticuleLon, -90)
        const to = toScreen(graticuleLon, 90)
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
        ctx.stroke()
      }
      for (const graticuleLat of [-60, -30, 0, 30, 60]) {
        const from = toScreen(-180, graticuleLat)
        const to = toScreen(180, graticuleLat)
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
        ctx.stroke()
      }

      for (const ring of LAND_RINGS) {
        ctx.beginPath()
        let started = false
        for (const point of ring) {
          const px = toScreen(point[0], point[1])
          if (started) {
            ctx.lineTo(px.x, px.y)
          } else {
            ctx.moveTo(px.x, px.y)
            started = true
          }
        }
        ctx.closePath()
        ctx.lineJoin = 'round'
        ctx.fillStyle = 'rgb(72 88 108 / 0.75)'
        ctx.fill()
        ctx.strokeStyle = 'rgb(72 88 108 / 0.75)'
        ctx.stroke()
      }

      const fontPx = Math.round(clamp(zoom * 10.5, 9, 30))
      const inkMuted = cssRgb('--c-ink-muted', FALLBACK.inkMuted)
      const labels = planCountryLabels(
        GAZETTEER.countries.map((country) => {
          const p = toScreen(country.lon, country.lat)
          return {
            name: country.name,
            x: p.x,
            y: p.y,
            visible: p.x >= 0 && p.x <= size.w && p.y >= 0 && p.y <= size.h
          }
        }),
        { fontPx, width: size.w, height: size.h }
      )
      ctx.font = `600 ${fontPx}px "JetBrains Mono", monospace`
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgb(${inkMuted} / 0.85)`
      for (const label of labels) {
        ctx.fillText(label.name, label.x, label.y + fontPx / 3)
      }

      for (const hotspot of hotspotsRef.current) {
        const p = toScreen(hotspot.lon, hotspot.lat)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${accent})`
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
    }

    const loop = (nowMs: number): void => {
      rafId = requestAnimationFrame(loop)
      if (document.hidden) return
      if (nowMs - last < 1000 / 60) return
      last = nowMs
      draw()
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endDrag)
      canvas.removeEventListener('pointercancel', endDrag)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <div className="h-full w-full">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        aria-label="Equirectangular world map"
      />
    </div>
  )
}
