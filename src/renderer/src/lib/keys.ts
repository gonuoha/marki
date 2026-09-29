const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform)

const MOD = IS_MAC ? '⌘' : 'Ctrl'

export function isMac(): boolean {
  return IS_MAC
}

export function modKey(): string {
  return MOD
}

const MAC_SYMBOLS: Record<string, string> = {
  Mod: '⌘',
  Shift: '⇧',
  Alt: '⌥',
  Enter: '↵',
  Delete: '⌫'
}

const PC_NAMES: Record<string, string> = {
  Mod: 'Ctrl',
  Enter: 'Enter',
  Delete: 'Backspace'
}

export function formatShortcut(parts: string[]): string {
  const names = IS_MAC ? MAC_SYMBOLS : PC_NAMES
  return parts
    .map((part) => names[part] ?? (part.length === 1 ? part.toUpperCase() : part))
    .join(IS_MAC ? '' : '+')
}

/** Splits a registry shortcut such as `Mod-Shift-K` or `Mod--` into its parts. */
export function shortcutParts(shortcut: string): string[] {
  if (shortcut.endsWith('--')) return [...shortcut.slice(0, -2).split('-'), '-']
  return shortcut.split('-')
}

export function displayShortcut(shortcut: string): string {
  return formatShortcut(shortcutParts(shortcut))
}

export interface KeyEventLike {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export function matchShortcut(event: KeyEventLike, parts: string[]): boolean {
  const mod = event.metaKey || event.ctrlKey
  let needsMod = false
  let needsShift = false
  let needsAlt = false
  let key = ''

  for (const part of parts) {
    if (part === 'Mod') needsMod = true
    else if (part === 'Shift') needsShift = true
    else if (part === 'Alt') needsAlt = true
    else key = part
  }

  if (needsMod !== mod) return false
  if (needsShift !== event.shiftKey) return false
  if (needsAlt !== event.altKey) return false
  if (!key) return true

  const normalized = key.length === 1 ? key.toLowerCase() : key
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
  return eventKey === normalized
}
