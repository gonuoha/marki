import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  isMarkdownPath,
  mergeSettings,
  normalizeSettings,
  structuredCloneSettings
} from '@shared/settings'

describe('mergeSettings', () => {
  it('merges a nested section without discarding its siblings', () => {
    const next = mergeSettings(DEFAULT_SETTINGS, { editor: { focus: { mode: 'sentence' } } })

    expect(next.editor.focus.mode).toBe('sentence')
    expect(next.editor.focus.dimOpacity).toBe(DEFAULT_SETTINGS.editor.focus.dimOpacity)
    expect(next.editor.typewriter).toEqual(DEFAULT_SETTINGS.editor.typewriter)
    expect(next.markdown).toEqual(DEFAULT_SETTINGS.markdown)
  })

  it('does not mutate the base settings', () => {
    const base = structuredCloneSettings(DEFAULT_SETTINGS)
    mergeSettings(base, { editor: { caret: { thickness: 6 } } })

    expect(base.editor.caret.thickness).toBe(DEFAULT_SETTINGS.editor.caret.thickness)
  })

  it('replaces arrays wholesale rather than merging by index', () => {
    const withRecents = mergeSettings(DEFAULT_SETTINGS, {
      files: { recentFiles: ['/a.md', '/b.md'] }
    })
    const next = mergeSettings(withRecents, { files: { recentFiles: ['/c.md'] } })

    expect(next.files.recentFiles).toEqual(['/c.md'])
  })

  it('ignores undefined leaves so a partial patch cannot erase a value', () => {
    const next = mergeSettings(DEFAULT_SETTINGS, { theme: undefined })

    expect(next.theme).toBe(DEFAULT_SETTINGS.theme)
  })

  it('replaces a top-level primitive', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { theme: 'midnight' }).theme).toBe('midnight')
  })
})

describe('normalizeSettings', () => {
  it('falls back to the defaults for junk input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(42)).toEqual(DEFAULT_SETTINGS)
  })

  it('fills in fields missing from a partially written settings file', () => {
    const restored = normalizeSettings({ theme: 'dark', editor: { showSidebar: false } })

    expect(restored.theme).toBe('dark')
    expect(restored.editor.showSidebar).toBe(false)
    expect(restored.editor.caret).toEqual(DEFAULT_SETTINGS.editor.caret)
    expect(restored.files.autosaveDelay).toBe(DEFAULT_SETTINGS.files.autosaveDelay)
  })

  it('returns a fresh object each time so callers cannot share state', () => {
    const first = normalizeSettings({})
    first.editor.typography.fontSize = 99

    expect(normalizeSettings({}).editor.typography.fontSize).toBe(
      DEFAULT_SETTINGS.editor.typography.fontSize
    )
  })
})

describe('isMarkdownPath', () => {
  it.each(['/notes/a.md', '/a.MARKDOWN', '/a.mdx', '/a.txt'])('accepts %s', (path) => {
    expect(isMarkdownPath(path)).toBe(true)
  })

  it.each(['/a.png', '/a.mdb', '/markdown', '/a.md.zip'])('rejects %s', (path) => {
    expect(isMarkdownPath(path)).toBe(false)
  })
})
