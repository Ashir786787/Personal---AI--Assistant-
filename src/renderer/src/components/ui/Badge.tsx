import type { ReactNode } from 'react'

export type BadgeVariant = 'accent' | 'ok' | 'warn' | 'danger' | 'muted'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const VARIANTS: Record<BadgeVariant, string> = {
  accent: 'bg-accent/15 text-accent',
  ok: 'bg-[rgb(var(--c-ok))]/15 text-[rgb(var(--c-ok))]',
  warn: 'bg-[rgb(var(--c-warn))]/15 text-[rgb(var(--c-warn))]',
  danger: 'bg-[rgb(var(--c-danger))]/15 text-[rgb(var(--c-danger))]',
  muted: 'bg-ink/5 text-ink-muted'
}

export function Badge({ children, variant = 'muted', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
