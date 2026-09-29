import { access, readFile, rename, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { app } from 'electron'
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  normalizeSettings,
  structuredCloneSettings
} from '@shared/settings'
import type { Settings, SettingsPatch } from '@shared/types'

const MAX_RECENT = 12
const WRITE_DEBOUNCE_MS = 200

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

let settings: Settings = structuredCloneSettings(DEFAULT_SETTINGS)
let writeTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<(next: Settings) => void>()

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function pruneRecent(paths: string[]): Promise<string[]> {
  const kept: string[] = []
  for (const entry of paths) {
    if (await pathExists(entry)) kept.push(entry)
  }
  return kept
}

function pushRecent(list: string[], path: string): string[] {
  return [path, ...list.filter((entry) => entry !== path)].slice(0, MAX_RECENT)
}

async function persistNow(): Promise<void> {
  const target = settingsPath()
  const tmp = `${target}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  await rename(tmp, target)
}

function schedulePersist(): void {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = null
    void persistNow().catch((err) => console.error('[settings-store] persist failed', err))
  }, WRITE_DEBOUNCE_MS)
}

function notifyListeners(): void {
  for (const listener of listeners) listener(settings)
}

export async function initSettingsStore(): Promise<void> {
  try {
    const raw = await readFile(settingsPath(), 'utf8')
    settings = normalizeSettings(JSON.parse(raw) as unknown)
  } catch {
    settings = structuredCloneSettings(DEFAULT_SETTINGS)
  }

  const prunedWorkspaces = await pruneRecent(settings.files.recentWorkspaces)
  const prunedFiles = await pruneRecent(settings.files.recentFiles)
  if (
    prunedWorkspaces.length !== settings.files.recentWorkspaces.length ||
    prunedFiles.length !== settings.files.recentFiles.length
  ) {
    settings = mergeSettings(settings, {
      files: { recentWorkspaces: prunedWorkspaces, recentFiles: prunedFiles }
    })
    schedulePersist()
  }
}

export function getSettings(): Settings {
  return settings
}

export function onSettingsChange(listener: (next: Settings) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function patchSettings(patch: SettingsPatch): Promise<Settings> {
  settings = mergeSettings(settings, patch)
  schedulePersist()
  notifyListeners()
  return settings
}

export async function resetSettings(): Promise<Settings> {
  settings = structuredCloneSettings(DEFAULT_SETTINGS)
  schedulePersist()
  notifyListeners()
  return settings
}

export async function noteRecentWorkspace(path: string): Promise<void> {
  const recentWorkspaces = pushRecent(
    await pruneRecent(settings.files.recentWorkspaces),
    path
  )
  settings = mergeSettings(settings, { files: { recentWorkspaces } })
  schedulePersist()
  notifyListeners()
}

export async function noteRecentFile(path: string): Promise<void> {
  app.addRecentDocument(path)
  const recentFiles = pushRecent(await pruneRecent(settings.files.recentFiles), path)
  settings = mergeSettings(settings, { files: { recentFiles } })
  schedulePersist()
  notifyListeners()
}

export async function clearRecentFiles(): Promise<void> {
  settings = mergeSettings(settings, { files: { recentFiles: [] } })
  schedulePersist()
  notifyListeners()
}
