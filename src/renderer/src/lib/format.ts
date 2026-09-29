import { basename, dirname, join } from './path'

export { basename, dirname, join }

const WORD_RE = /[\p{L}\p{N}'’-]+/gu

export function countWords(text: string): number {
  const matches = text.match(WORD_RE)
  return matches ? matches.length : 0
}

export function countCharacters(text: string): number {
  return text.length
}

export function readingTimeMinutes(text: string, wpm = 200): number {
  const words = countWords(text)
  if (words === 0) return 0
  return Math.ceil(words / wpm)
}

export function offsetToLineColumn(text: string, offset: number | null): { line: number; col: number } {
  const pos = offset ?? 0
  const clamped = Math.max(0, Math.min(pos, text.length))
  let line = 1
  let col = 1
  for (let i = 0; i < clamped; i++) {
    if (text[i] === '\n') {
      line++
      col = 1
    } else {
      col++
    }
  }
  return { line, col }
}

export function titleFromPath(path: string | null): string {
  if (!path) return 'Untitled'
  return basename(path)
}

export function formatRelativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp
  if (delta < 5000) return 'Edited just now'
  if (delta < 60_000) return 'Edited moments ago'
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 60) return `Edited ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Edited ${hours}h ago`
  return 'Saved'
}
