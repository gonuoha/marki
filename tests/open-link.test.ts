import { describe, expect, it } from 'vitest'
import { normalizeExternalUrl, urlAtLineIndex } from '@shared/open-link'

describe('normalizeExternalUrl', () => {
  it('accepts http and https URLs', () => {
    expect(normalizeExternalUrl('https://example.com/path')).toBe('https://example.com/path')
    expect(normalizeExternalUrl('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('accepts mailto links', () => {
    expect(normalizeExternalUrl('mailto:hello@example.com')).toBe('mailto:hello@example.com')
  })

  it('adds https when no scheme is present', () => {
    expect(normalizeExternalUrl('example.com')).toBe('https://example.com')
  })

  it('rejects unsafe schemes', () => {
    expect(normalizeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeExternalUrl('file:///etc/passwd')).toBeNull()
  })

  it('rejects empty input', () => {
    expect(normalizeExternalUrl('   ')).toBeNull()
  })
})

describe('urlAtLineIndex', () => {
  it('finds markdown link text and targets', () => {
    const line = 'See [docs](https://example.com/docs) for more.'
    expect(urlAtLineIndex(line, line.indexOf('docs'))).toBe('https://example.com/docs')
    expect(urlAtLineIndex(line, line.indexOf('https'))).toBe('https://example.com/docs')
  })

  it('finds plain and angle-bracket URLs', () => {
    expect(urlAtLineIndex('Visit https://example.com now', 7)).toBe('https://example.com')
    expect(urlAtLineIndex('Go to <https://example.com/path>', 8)).toBe('https://example.com/path')
  })
})
