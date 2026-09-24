import { useId } from 'react'
import { sparkPoints } from '../../state/systemHistory'

export interface SparklineProps {
  data: readonly number[]
  label?: string
  className?: string
}

const VIEW_W = 100
const VIEW_H = 32

export function Sparkline({ data, label, className }: SparklineProps): JSX.Element {
  const id = useId()
  const points = sparkPoints(data, VIEW_W, VIEW_H)
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={label ?? 'Sample history over the last readings'}
      aria-labelledby={id}
    >
      <title id={id}>{label ?? 'Sample history over the last readings'}</title>
      <polyline
        points={points}
        fill="none"
        stroke="rgb(var(--c-accent))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ opacity: points === '' ? 0 : 1 }}
      />
    </svg>
  )
}
