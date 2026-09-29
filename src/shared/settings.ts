import type { Settings, SettingsPatch } from './types'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  editor: {
    mode: 'visual',
    typewriter: {
      enabled: false,
      anchor: 0.45,
      showGuide: false,
      smoothScroll: true
    },
    focus: {
      mode: 'off',
      dimOpacity: 0.28,
      dimBlocks: true
    },
    caret: {
      color: '#a594f9',
      thickness: 2,
      blink: true,
      blinkPattern: 'smooth',
      hdrBrightness: false
    },
    typography: {
      bodyFont: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
      monoFont: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
      fontSize: 17,
      lineHeight: 1.7,
      measure: 720
    },
    showSidebar: true,
    sidebarWidth: 248,
    showStatusBar: true,
    spellCheck: true,
    smartTypography: true
  },
  markdown: {
    bullet: '-',
    emphasis: '_',
    strong: '**',
    headingStyle: 'atx',
    prettyTables: true,
    wrapColumn: 0
  },
  files: {
    autosaveDelay: 900,
    imageFolder: 'assets',
    recentWorkspaces: [],
    recentFiles: [],
    restoreSession: true
  }
}

/** Recursive merge: objects are merged, arrays and primitives are replaced. */
export function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  const merged = mergeDeep(
    base as unknown as Record<string, unknown>,
    patch as Record<string, unknown>
  )
  return merged as unknown as Settings
}

function mergeDeep(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const current = out[key]
    out[key] =
      isPlainObject(current) && isPlainObject(value) ? mergeDeep(current, value) : value
  }
  return out
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Fills in anything missing or malformed in a persisted settings blob. */
export function normalizeSettings(raw: unknown): Settings {
  if (!isPlainObject(raw)) return structuredCloneSettings(DEFAULT_SETTINGS)
  return mergeSettings(structuredCloneSettings(DEFAULT_SETTINGS), raw as SettingsPatch)
}

export function structuredCloneSettings(settings: Settings): Settings {
  return JSON.parse(JSON.stringify(settings)) as Settings
}

export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt']

export function isMarkdownPath(path: string): boolean {
  const lower = path.toLowerCase()
  return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext))
}
