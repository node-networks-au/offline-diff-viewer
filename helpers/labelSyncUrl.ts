export interface LocationParts {
  pathname: string
  search: string
}

/**
 * Decide the URL to write back when the user renames a pane label.
 *
 * On the plain (locally-encoded) diff path the URL hash carries the
 * gzipped diff payload, so we rewrite it with the freshly-encoded
 * payload (re-including the new labels).
 *
 * On the end-to-end-encrypted path (`?id=` present) the hash instead
 * carries the AES decryption KEY for the server-stored blob. Rewriting
 * it with the payload would destroy the key, so refreshing — or copying —
 * the link can no longer decrypt the diff ("We couldn't decrypt your
 * diff."). On that path we return `null` to signal "leave the URL alone".
 */
export function buildLabelSyncUrl(
  loc: LocationParts,
  payloadHash: string
): string | null {
  if (loc.search.includes('id=')) return null
  const hash = payloadHash.startsWith('#') ? payloadHash : `#${payloadHash}`
  return loc.pathname + hash
}
