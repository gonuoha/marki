import { describe, expect, it } from 'vitest'
import { joinFrontMatter, splitFrontMatter } from '@/editor/markdown/frontmatter'

describe('splitFrontMatter', () => {
  it('parses YAML front matter at offset 0', () => {
    const text = '---\ntitle: Hello\nauthor: Marki\n---\n\n# Body\n'
    const { frontMatter, body } = splitFrontMatter(text)
    expect(frontMatter).toEqual({
      format: 'yaml',
      raw: 'title: Hello\nauthor: Marki'
    })
    expect(body).toBe('# Body\n')
  })

  it('parses TOML front matter', () => {
    const text = '+++\ntitle = "Notes"\n+++\nBody text\n'
    const { frontMatter, body } = splitFrontMatter(text)
    expect(frontMatter).toEqual({
      format: 'toml',
      raw: 'title = "Notes"'
    })
    expect(body).toBe('Body text\n')
  })

  it('parses JSON front matter', () => {
    const text = '{"title":"Draft","tags":["a","b"]}\n\nParagraph.\n'
    const { frontMatter, body } = splitFrontMatter(text)
    expect(frontMatter).toEqual({
      format: 'json',
      raw: '"title":"Draft","tags":["a","b"]'
    })
    expect(body).toBe('Paragraph.\n')
  })

  it('returns null front matter when absent', () => {
    const text = '# Just markdown\n\nNo front matter here.\n'
    const { frontMatter, body } = splitFrontMatter(text)
    expect(frontMatter).toBeNull()
    expect(body).toBe(text)
  })

  it('does not treat --- later in the document as front matter', () => {
    const text = '# Title\n\n---\n\nNot front matter.\n'
    const { frontMatter, body } = splitFrontMatter(text)
    expect(frontMatter).toBeNull()
    expect(body).toBe(text)
  })

  it('preserves malformed YAML as front matter', () => {
    const text = '---\ntitle: [unclosed\n---\n\nStill valid body.\n'
    const { frontMatter, body } = splitFrontMatter(text)
    expect(frontMatter).toEqual({
      format: 'yaml',
      raw: 'title: [unclosed'
    })
    expect(body).toBe('Still valid body.\n')
  })
})

describe('joinFrontMatter', () => {
  it('is the inverse of splitFrontMatter for YAML', () => {
    const text = '---\ntitle: Round Trip\n---\n\nContent.\n'
    const split = splitFrontMatter(text)
    expect(joinFrontMatter(split.frontMatter, split.body)).toBe('---\ntitle: Round Trip\n---\n\nContent.\n')
  })

  it('is the inverse of splitFrontMatter for JSON', () => {
    const text = '{"ok":true}\n\nHello.\n'
    const split = splitFrontMatter(text)
    expect(joinFrontMatter(split.frontMatter, split.body)).toBe(text)
  })
})
