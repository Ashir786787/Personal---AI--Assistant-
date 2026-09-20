import { Fragment, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface TooltipProps {
  label: string
  children: ReactNode
}

export function Tooltip({ label, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  const triggerRef = useRef<HTMLSpanElement>(null)

  return (
    <Fragment>
      <span
        ref={triggerRef}
        aria-describedby={visible ? id : undefined}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {children}
      </span>
      {visible && (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute z-50 mt-1 whitespace-nowrap rounded-md border border-edge bg-panel-raised px-2 py-1 text-xs text-ink shadow-lg"
        >
          {label}
        </span>
      )}
    </Fragment>
  )
}
