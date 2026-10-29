/**
 * Normalize a user-authored href for opening in the system browser.
 * Returns null when the URL cannot be opened safely.
 */
export function normalizeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase()
    if (scheme === 'http' || scheme === 'https' || scheme === 'mailto') return trimmed
    return null
  }

  return `https://${trimmed}`
}

/**
 * Returns a URL when `index` is on link text, a markdown link target, or a plain URL in `line`.
 */
export function urlAtLineIndex(line: string, index: number): string | null {
  if (index < 0 || index > line.length) return null

  const mdRe = /\[([^\]]*)\]\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = mdRe.exec(line))) {
    const full = match[0]
    const url = match[2].trim()
    const openParen = full.lastIndexOf('(')
    const urlStart = match.index + openParen + 1
    const urlEnd = match.index + full.length - 1
    const textStart = match.index + 1
    const textEnd = textStart + match[1].length
    if ((index >= urlStart && index < urlEnd) || (index >= textStart && index < textEnd)) {
      return url || null
    }
  }

  const angleRe = /<((?:https?:\/\/|mailto:)[^>]+)>/g
  while ((match = angleRe.exec(line))) {
    if (index >= match.index && index < match.index + match[0].length) {
      return match[1].trim()
    }
  }

  const urlRe =
    /(?:https?:\/\/|mailto:)[^\s<>")\]]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>")\]]*)?/gi
  while ((match = urlRe.exec(line))) {
    if (index >= match.index && index < match.index + match[0].length) {
      return match[0]
    }
  }

  return null
}
