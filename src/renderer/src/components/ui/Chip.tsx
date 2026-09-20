import type { ReactNode } from 'react'

export type ChipVariant = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'

interface ChipProps {
  children: ReactNode
  variant?: ChipVariant
  className?: string
  onClick?: () => void
  title?: string
}

const VARIANTS: Record<ChipVariant, string> = {
  neutral: 'border-edge bg-panel/60 text-ink-muted',
  accent: 'border-accent/50 bg-accent/10 text-accent',
  ok: 'border-[rgb(var(--c-ok))] bg-[rgb(var(--c-ok))]/10 text-[rgb(var(--c-ok))]',
  warn: 'border-[rgb(var(--c-warn))] bg-[rgb(var(--c-warn))]/10 text-[rgb(var(--c-warn))]',
  danger: 'border-[rgb(var(--c-danger))] bg-[rgb(var(--c-danger))]/10 text-[rgb(var(--c-danger))]'
}

export function Chip({ children, variant = 'neutral', className = '', onClick, title }: ChipProps) {
  const interactive = onClick !== undefined
  return (
    <span
      title={title}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] tracking-wide ${
        VARIANTS[variant]
      } ${interactive ? 'cursor-pointer select-none hover:brightness-125' : ''} ${className}`}
    >
      {children}
    </span>
  )
}
