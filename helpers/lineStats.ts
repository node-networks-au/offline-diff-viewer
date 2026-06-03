export interface LineStats {
  /** Line count of the left (original / "a") side. */
  a: number
  /** Line count of the right (modified / "b") side. */
  b: number
  /** Net line change, b - a (signed). */
  delta: number
}

/**
 * Count display lines the way Monaco's gutter does: the number of
 * `\n`-separated segments, i.e. (newline count + 1). An empty string is
 * one line and a trailing newline adds a final empty line — both match
 * `ITextModel.getLineCount()` exactly, so these numbers line up with the
 * line numbers the user sees in the diff gutter.
 */
export function countLines(text: string): number {
  return text.split('\n').length
}

/** Per-side line counts plus the b-minus-a delta for a diff. */
export function computeLineStats(lhs: string, rhs: string): LineStats {
  const a = countLines(lhs)
  const b = countLines(rhs)
  return { a, b, delta: b - a }
}

/** Render a delta with an explicit sign: "+15", "-15", or "0". */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta)
}
