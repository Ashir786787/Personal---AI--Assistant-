import type { ReactNode } from 'react'

export type ToastVariant = 'info' | 'ok' | 'danger'

interface ToastProps {
  children: ReactNode
  variant?: ToastVariant
  onDismiss?: () => void
}

const VARIANTS: Record<ToastVariant, string> = {
  info: 'border-edge bg-panel-raised text-ink',
  ok: 'border-[rgb(var(--c-ok))]/50 bg-[rgb(var(--c-ok))]/15 text-[rgb(var(--c-ok))]',
  danger:
    'border-[rgb(var(--c-danger))]/50 bg-[rgb(var(--c-danger))]/15 text-[rgb(var(--c-danger))]'
}

export function Toast({ children, variant = 'info', onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-3 rounded-full border px-4 py-2 text-sm shadow-lg ${VARIANTS[variant]}`}
    >
      <span>{children}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="text-current opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  )
}
