import { buildLabelSyncUrl } from './labelSyncUrl'

describe('buildLabelSyncUrl', () => {
  it('rewrites the hash with the gzipped payload on the plain (non-id) path', () => {
    const url = buildLabelSyncUrl(
      { pathname: '/diff', search: '' },
      'H4sIPAYLOAD'
    )
    expect(url).toBe('/diff#H4sIPAYLOAD')
  })

  it('tolerates a payload that already carries its leading #', () => {
    const url = buildLabelSyncUrl(
      { pathname: '/diff', search: '' },
      '#H4sIPAYLOAD'
    )
    expect(url).toBe('/diff#H4sIPAYLOAD')
  })

  it('returns null on the E2E (?id=) path so the decryption key in the hash is never clobbered', () => {
    const url = buildLabelSyncUrl(
      { pathname: '/diff', search: '?id=diff-123' },
      'H4sIPAYLOAD'
    )
    expect(url).toBeNull()
  })

  it('also skips when id= is one of several query params', () => {
    const url = buildLabelSyncUrl(
      { pathname: '/diff/', search: '?foo=1&id=diff-123' },
      'H4sIPAYLOAD'
    )
    expect(url).toBeNull()
  })
})
