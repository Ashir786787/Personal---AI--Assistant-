import { useState } from 'react'
import type { ToolStatus } from '@shared/chat'
import { Chip, type ChipVariant } from '../ui'

const STATUS: Record<ToolStatus, { label: string; variant: ChipVariant }> = {
  queued: { label: 'queued', variant: 'neutral' },
  awaiting_approval: { label: 'awaiting approval', variant: 'warn' },
  running: { label: 'running', variant: 'accent' },
  done: { label: 'done', variant: 'ok' },
  failed: { label: 'failed', variant: 'danger' },
  cancelled: { label: 'cancelled', variant: 'neutral' }
}

interface ToolCardProps {
  name: string
  status: ToolStatus | undefined
  detail: string | undefined
  statusDetail: string | undefined
  kind: 'tool' | 'agent' | undefined
}

export function ToolCard({ name, status, detail, statusDetail, kind }: ToolCardProps) {
  const [open, setOpen] = useState(false)
  const meta = STATUS[status ?? 'queued']
  const glyph = kind === 'agent' ? '🧑‍💻' : '⚙'
  const hasDetails = Boolean(detail || statusDetail)

  return (
    <div className="w-full max-w-[78%] rounded-lg border border-accent-dim/40 bg-panel-raised/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-accent-dim">
          {glyph}
        </span>
        <span className="truncate font-mono text-[11px] text-ink">{name}</span>
        <Chip variant={meta.variant}>{meta.label}</Chip>
        {hasDetails && (
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            className="ml-auto font-mono text-[11px] text-ink-muted hover:text-ink"
          >
            {open ? 'Hide' : 'Details'}
          </button>
        )}
      </div>
      {open && hasDetails && (
        <dl className="mt-2 space-y-1 border-t border-edge pt-2 font-mono text-[11px] text-ink-muted">
          {detail && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-muted/70">args</dt>
              <dd className="min-w-0 break-words">{detail}</dd>
            </div>
          )}
          {statusDetail && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-muted/70">note</dt>
              <dd className="min-w-0 break-words">{statusDetail}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}
