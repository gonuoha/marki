import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '@/editor/markdown/parse'
import { serializeMarkdown } from '@/editor/markdown/serialize'

const fixturesDir = join(__dirname, 'fixtures')
const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith('.md'))

describe('markdown round-trip fixtures', () => {
  for (const file of fixtures) {
    it(`round-trips ${file}`, () => {
      const text = readFileSync(join(fixturesDir, file), 'utf8')
      const once = serializeMarkdown(parseMarkdown(text))
      expect(once).toBe(text)

      const twice = serializeMarkdown(parseMarkdown(once))
      expect(twice).toBe(once)
    })
  }
})

describe('paragraph wrapping', () => {
  const prose =
    'A soft line break carries no meaning in markdown, so the parser turns it ' +
    'into a space and the serialiser decides where the lines fall.'

  it('leaves paragraphs on one line by default', () => {
    const out = serializeMarkdown(parseMarkdown(prose + '\n'))
    expect(out).toBe(prose + '\n')
  })

  it('wraps at the configured column and reads back as the same paragraph', () => {
    const wrapped = serializeMarkdown(parseMarkdown(prose + '\n'), { wrapColumn: 40 })
    const lines = wrapped.trimEnd().split('\n')

    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(40)
    expect(serializeMarkdown(parseMarkdown(wrapped))).toBe(prose + '\n')
  })

  it('keeps wrapped lines inside a list item indented', () => {
    const source = `- ${prose}\n`
    const wrapped = serializeMarkdown(parseMarkdown(source), { wrapColumn: 40 })

    const [first, ...rest] = wrapped.trimEnd().split('\n')
    expect(first.startsWith('- ')).toBe(true)
    expect(rest.length).toBeGreaterThan(0)
    for (const line of rest) expect(line.startsWith('  ')).toBe(true)
    expect(serializeMarkdown(parseMarkdown(wrapped))).toBe(source)
  })

  it('never starts a wrapped line with a character that would open a block', () => {
    const risky = 'word '.repeat(6) + '- not a bullet ' + 'word '.repeat(6) + '# not a heading'
    const wrapped = serializeMarkdown(parseMarkdown(risky.trim() + '\n'), { wrapColumn: 20 })

    for (const line of wrapped.trimEnd().split('\n')) {
      expect(line).not.toMatch(/^(?:[-*+>#]|\d+[.)])/)
    }
  })
})
