import { countLines, computeLineStats, formatDelta } from './lineStats'

describe('countLines', () => {
  it('counts lines the way Monaco gutter does (newlines + 1)', () => {
    expect(countLines('a')).toBe(1)
    expect(countLines('a\nb')).toBe(2)
    expect(countLines('a\nb\nc')).toBe(3)
  })

  it('treats a trailing newline as a final (empty) line, matching the gutter', () => {
    expect(countLines('a\n')).toBe(2)
  })

  it('reports an empty string as a single line (matches Monaco model)', () => {
    expect(countLines('')).toBe(1)
  })
})

describe('computeLineStats', () => {
  it('reports per-side counts and the b-minus-a delta', () => {
    expect(computeLineStats('a\nb\nc', 'a\nb\nc\nd\ne')).toEqual({
      a: 3,
      b: 5,
      delta: 2,
    })
  })

  it('reports a negative delta when the right side is shorter', () => {
    expect(computeLineStats('a\nb\nc\nd', 'a\nb')).toEqual({
      a: 4,
      b: 2,
      delta: -2,
    })
  })

  it('reports a zero delta for equal-length sides', () => {
    expect(computeLineStats('a\nb', 'x\ny')).toEqual({ a: 2, b: 2, delta: 0 })
  })
})

describe('formatDelta', () => {
  it('prefixes a positive delta with +', () => {
    expect(formatDelta(15)).toBe('+15')
  })

  it('keeps the native minus sign for a negative delta', () => {
    expect(formatDelta(-15)).toBe('-15')
  })

  it('renders zero without a sign', () => {
    expect(formatDelta(0)).toBe('0')
  })
})
