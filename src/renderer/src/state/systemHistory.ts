export const SPARK_MAX_SAMPLES = 60

export function appendSample(
  samples: readonly number[],
  value: number,
  cap: number = SPARK_MAX_SAMPLES
): number[] {
  const next = samples.length >= cap ? samples.slice(samples.length - cap + 1) : samples.slice()
  next.push(value)
  return next
}

export function sparkPoints(
  data: readonly number[],
  viewWidth: number,
  viewHeight: number,
  padY = 4,
  padX = 2
): string {
  if (data.length < 2) return ''
  let min = data[0] as number
  let max = data[0] as number
  for (const value of data) {
    if (value < min) min = value
    if (value > max) max = value
  }
  const innerHeight = viewHeight - padY * 2
  const yFor = (value: number): number => {
    if (max === min) return viewHeight / 2
    return padY + ((max - value) / (max - min)) * innerHeight
  }
  const n = data.length
  const span = viewWidth - padX * 2
  const step = n > 1 ? span / (n - 1) : 0
  const points = data.map((value, index) => `${padX + index * step},${yFor(value)}`)
  return points.join(' ')
}
