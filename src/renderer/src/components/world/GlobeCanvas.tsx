import { useEffect, useRef } from 'react'
import type { Hotspot } from '@shared/feed'
import { LAND_RINGS, type LandRing } from '../../state/land'
import {
  clamp,
  clampZoom,
  nightFactor,
  orthographicProject,
  ringCentroid,
  subsolarPoint,
  type Rotation
} from '../../state/geo'

interface GlobeCanvasProps {
  hotspots: Hotspot[]
  reduced: boolean
}

const ROTATE_DEG_PER_S = 8

const FALLBACK = {
  edge: '36 47 61',
  panel: '13 20 29',
  panelRaised: '20 29 41',
  ink: '203 213 225',
  inkMuted: '100 116 139',
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

export function GlobeCanvas({ hotspots, reduced }: GlobeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hotspotsRef = useRef(hotspots)
  hotspotsRef.current = hotspots
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const rotation: Rotation = { lon: -30, lat: 15 }
    let radiusScale = 1
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

    const onPointerDown = (event: PointerEvent): void => {
      pointerDown = true
      lastPointer = { x: event.clientX, y: event.clientY }
      canvas.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent): void => {
      if (!pointerDown) return
      rotation.lon = (((rotation.lon - (event.clientX - lastPointer.x) * 0.4) % 360) + 360) % 360
      rotation.lat = clamp(rotation.lat + (event.clientY - lastPointer.y) * 0.3, -85, 85)
      lastPointer = { x: event.clientX, y: event.clientY }
    }
    const endDrag = (): void => {
      pointerDown = false
    }
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      radiusScale = clampZoom(radiusScale * (event.deltaY > 0 ? 0.9 : 1.1), 0.7, 1.5)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointercancel', endDrag)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    let rafId = 0
    let last = 0
    let lastRotate = performance.now()

    const drawRing = (ring: LandRing, rot: Rotation, sunLat: number, sunLon: number): void => {
      const count = ring.length
      if (count < 3) return
      const xs = new Array<number>(count)
      const ys = new Array<number>(count)
      const vis = new Array<boolean>(count)
      for (let i = 0; i < count; i++) {
        const proj = orthographicProject(ring[i]![0], ring[i]![1], rot)
        xs[i] = proj.x
        ys[i] = proj.y
        vis[i] = proj.visible
      }

      let i = 0
      while (i < count) {
        if (!vis[i]) {
          i++
          continue
        }
        const start = i
        while (i < count && vis[i]) i++
        if (i - start < 3) continue
        ctx.beginPath()
        ctx.moveTo(xs[start]!, ys[start]!)
        for (let k = start + 1; k < i; k++) ctx.lineTo(xs[k]!, ys[k]!)
        ctx.closePath()
        ctx.lineJoin = 'round'
        ctx.fillStyle = 'rgb(72 88 108 / 0.75)'
        ctx.fill()
        ctx.strokeStyle = 'rgb(72 88 108 / 0.75)'
        ctx.lineWidth = 1
        ctx.stroke()
        const centroid = ringCentroid(ring)
        const night = nightFactor(centroid.lat, centroid.lon, { lat: sunLat, lon: sunLon })
        if (night > 0.02) {
          ctx.fillStyle = `rgba(4, 8, 14, ${0.72 * night})`
          ctx.fill()
        }
      }
    }

    const draw = (nowMs: number): void => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.w, size.h)

      const edge = cssRgb('--c-edge', FALLBACK.edge)
      const panel = cssRgb('--c-panel', FALLBACK.panel)
      const accent = cssRgb('--c-accent', FALLBACK.accent)

      const cx = size.w / 2
      const cy = size.h / 2
      const radius = (Math.min(size.w, size.h) / 2 - 8) * radiusScale
      const rot: Rotation = { lon: rotation.lon, lat: rotation.lat }
      const sun = subsolarPoint(new Date())

      ctx.fillStyle = `rgb(${panel})`
      ctx.fillRect(0, 0, size.w, size.h)

      ctx.fillStyle = `rgb(${edge} / 0.16)`
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgb(${edge} / 0.55)`
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.strokeStyle = `rgb(${edge} / 0.28)`
      for (let step = 0; step < 24; step++) {
        const lon = (step / 24) * 360 - 180
        ctx.beginPath()
        let started = false
        for (let s2 = 0; s2 <= 24; s2++) {
          const lat = (s2 / 24) * 180 - 90
          const p = orthographicProject(lon, lat, rot)
          if (!p.visible) {
            started = false
            continue
          }
          if (started) {
            ctx.lineTo(cx + p.x * radius, cy + p.y * radius)
          } else {
            ctx.moveTo(cx + p.x * radius, cy + p.y * radius)
            started = true
          }
        }
        ctx.stroke()
      }
      for (let stepLat = -75; stepLat <= 75; stepLat += 15) {
        ctx.beginPath()
        let started = false
        for (let s2 = 0; s2 <= 60; s2++) {
          const lon = (s2 / 60) * 360 - 180
          const p = orthographicProject(lon, stepLat, rot)
          if (!p.visible) {
            started = false
            continue
          }
          if (started) {
            ctx.lineTo(cx + p.x * radius, cy + p.y * radius)
          } else {
            ctx.moveTo(cx + p.x * radius, cy + p.y * radius)
            started = true
          }
        }
        ctx.stroke()
      }

      for (const ring of LAND_RINGS) {
        drawRing(ring, rot, sun.lat, sun.lon)
      }

      for (let i = 0; i < hotspotsRef.current.length; i++) {
        const hotspot = hotspotsRef.current[i]!
        const p = orthographicProject(hotspot.lon, hotspot.lat, rot)
        if (!p.visible) continue
        const px = cx + p.x * radius
        const py = cy + p.y * radius
        const pulse = reducedRef.current ? 0 : Math.sin(nowMs / 900 + i) * 0.35
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.arc(px, py, 2.6 + pulse, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${accent})`
        ctx.fill()
        ctx.stroke()
      }
    }

    const loop = (nowMs: number): void => {
      rafId = requestAnimationFrame(loop)
      if (document.hidden) return
      const now = performance.now()
      const dt = now - lastRotate
      lastRotate = now
      if (!reducedRef.current && !pointerDown) {
        rotation.lon = (rotation.lon + (ROTATE_DEG_PER_S * dt) / 1000) % 360
      }
      if (nowMs - last < 1000 / 60) return
      last = nowMs
      draw(nowMs)
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
        aria-label="Orthographic globe projection"
      />
    </div>
  )
}
