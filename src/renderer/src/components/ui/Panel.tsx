import type { ReactNode } from 'react'

interface PanelProps {
  children: ReactNode
  className?: string
}

export function Panel({ children, className = '' }: PanelProps) {
  return <section className={`glass rounded-xl ${className}`}>{children}</section>
}
