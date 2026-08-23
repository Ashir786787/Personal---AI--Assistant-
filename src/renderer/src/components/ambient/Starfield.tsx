import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  speed: number
  radius: number
  phase: number
}

interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export function Starfield(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let stars: Star[] = []
    const meteors: Meteor[] = []
    let nextMeteorAt = performance.now() + 5000
    let rafId = 0
    let running = true

    const readAccent = (): string =>
      getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() ||
      '76 224 210'
    let accentTriplet = readAccent()
    const accentTimer = window.setInterval(() => {
      accentTriplet = readAccent()
    }, 700)

    const seed = (): void => {
      const count = Math.floor((width * height) / 9000)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 0.02 + Math.random() * 0.12,
        radius: 0.4 + Math.random() * 1.3,
        phase: Math.random() * Math.PI * 2
      }))
    }

    const resize = (): void => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
    }
    resize()
    window.addEventListener('resize', resize)

    const onVisibility = (): void => {
      running = !document.hidden
      if (running) {
        lastTime = performance.now()
        rafId = requestAnimationFrame(draw)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    let lastTime = performance.now()

    const draw = (now: number): void => {
      if (!running) return
      const dt = Math.min(now - lastTime, 50)
      lastTime = now

      ctx.clearRect(0, 0, width, height)

      for (const star of stars) {
        star.x -= star.speed * dt * 0.06
        if (star.x < -2) {
          star.x = width + 2
          star.y = Math.random() * height
        }
        const twinkle = 0.3 + 0.5 * Math.abs(Math.sin(star.phase + now * 0.0007))
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${accentTriplet} / ${(twinkle * star.speed * 6).toFixed(3)})`
        ctx.fill()
      }

      if (now > nextMeteorAt) {
        meteors.push({
          x: width * (0.3 + Math.random() * 0.6),
          y: -20,
          vx: -(2 + Math.random() * 2),
          vy: 4 + Math.random() * 3,
          life: 1
        })
        nextMeteorAt = now + 8000 + Math.random() * 9000
      }

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        if (!m) {
          meteors.splice(i, 1)
          continue
        }
        m.x += m.vx * dt * 0.06
        m.y += m.vy * dt * 0.06
        m.life -= dt * 0.0009
        if (m.life <= 0) {
          meteors.splice(i, 1)
          continue
        }
        const grad = ctx.createLinearGradient(m.x - m.vx * 14, m.y - m.vy * 14, m.x, m.y)
        grad.addColorStop(0, `rgb(${accentTriplet} / 0)`)
        grad.addColorStop(1, `rgb(${accentTriplet} / ${0.6 * m.life})`)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(m.x - m.vx * 14, m.y - m.vy * 14)
        ctx.lineTo(m.x, m.y)
        ctx.stroke()
      }

      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.clearInterval(accentTimer)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />
  )
}
