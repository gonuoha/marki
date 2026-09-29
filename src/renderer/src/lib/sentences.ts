const CLOSING = /^[\]"')}\u2019\u201d\u00bb]+/

function isDecimalPoint(text: string, index: number): boolean {
  const before = text[index - 1]
  const after = text[index + 1]
  return before !== undefined && after !== undefined && /\d/.test(before) && /\d/.test(after)
}

function isEllipsisDot(text: string, index: number): boolean {
  if (text[index] !== '.') return false
  return text[index - 1] === '.' || text[index + 1] === '.'
}

function tokenEndingAt(text: string, index: number): string {
  let end = index
  while (end > 0 && /[\s]/.test(text[end - 1] ?? '')) end--
  let start = end
  while (start > 0 && !/[\s]/.test(text[start - 1] ?? '')) start--
  return text.slice(start, end)
}

function nextContentChar(text: string, index: number): string | null {
  for (let i = index + 1; i < text.length; i++) {
    const ch = text[i]
    if (ch && !/\s/.test(ch)) return ch
  }
  return null
}

const ALWAYS_ABBREV = /\b(?:e\.g|i\.e|vs|fig|approx|mr|mrs|dr|ms|mx|al|jr|sr|st|prof|rev|hon)\.$/i
const ETC_ABBREV = /\betc\.$/i

function isMidAbbreviationDot(text: string, index: number): boolean {
  const around = text.slice(Math.max(0, index - 2), index + 3).toLowerCase()
  return /e\.g/.test(around) || /i\.e/.test(around)
}

function isAbbreviationPeriod(text: string, index: number): boolean {
  if (isMidAbbreviationDot(text, index)) return true
  const slice = text.slice(Math.max(0, index - 12), index + 1)
  if (ALWAYS_ABBREV.test(slice)) return true
  if (ETC_ABBREV.test(slice)) {
    const next = nextContentChar(text, index)
    if (!next) return false
    return /[a-z,0-9]/.test(next)
  }
  const token = tokenEndingAt(text, index)
  if (/^[A-Z]$/.test(token.replace(/\.$/, ''))) return true
  return false
}

function isInitialsRun(text: string, index: number): boolean {
  if (text[index] !== '.') return false
  const before = text.slice(0, index + 1)
  if (!/(?:[A-Z]\.\s*)+$/.test(before.slice(Math.max(0, before.length - 8)))) return false
  const after = text.slice(index + 1).match(/^\s*([A-Za-z])/)
  if (!after) return false
  return after[1] === after[1]?.toUpperCase()
}

function isSentenceEnd(text: string, index: number): boolean {
  const ch = text[index]
  if (!ch || !/[.!?]/.test(ch)) return false
  if (ch === '.' && (isDecimalPoint(text, index) || isEllipsisDot(text, index))) return false
  if (ch === '.' && (isAbbreviationPeriod(text, index) || isInitialsRun(text, index))) return false
  return true
}

function endAfterPunctuation(text: string, index: number): number {
  let end = index + 1
  while (end < text.length && CLOSING.test(text[end] ?? '')) end++
  return end
}

export function splitSentences(text: string): Array<{ start: number; end: number }> {
  if (text.length === 0) return []

  const ranges: Array<{ start: number; end: number }> = []
  let pos = 0

  while (pos < text.length) {
    while (pos < text.length && /\s/.test(text[pos] ?? '')) pos++
    if (pos >= text.length) break

    const start = pos
    let end = start

    while (end < text.length) {
      const ch = text[end]
      if (ch && /[.!?]/.test(ch) && isSentenceEnd(text, end)) {
        end = endAfterPunctuation(text, end)
        break
      }
      end++
    }

    if (end >= text.length) end = text.length
    ranges.push({ start, end })
    pos = end
  }

  return ranges
}

export function findSentenceRange(text: string, offset: number): { start: number; end: number } {
  const clamped = Math.max(0, Math.min(offset, text.length))
  const ranges = splitSentences(text)
  if (ranges.length === 0) return { start: 0, end: text.length }

  for (const range of ranges) {
    if (clamped >= range.start && clamped <= range.end) return range
  }

  const last = ranges[ranges.length - 1]
  if (clamped >= last.end) return last
  return ranges[0] ?? { start: 0, end: text.length }
}
