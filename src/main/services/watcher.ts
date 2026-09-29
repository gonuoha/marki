import type { BrowserWindow } from 'electron'
import chokidar, { type FSWatcher } from 'chokidar'
import { basename, sep } from 'node:path'
import { IPC } from '@shared/ipc'
import type { WatchEvent } from '@shared/types'

const COALESCE_MS = 80

const SKIP_DIRS = new Set(['node_modules', '.git'])
const SKIP_FILES = new Set(['.DS_Store'])

interface WatcherEntry {
  watcher: FSWatcher
  root: string
  window: BrowserWindow
  pending: Map<string, WatchEvent>
  timer: ReturnType<typeof setTimeout> | null
}

const watchers = new Map<string, WatcherEntry>()

function shouldIgnore(watchedPath: string): boolean {
  const name = basename(watchedPath)
  if (SKIP_FILES.has(name)) return true

  for (const segment of watchedPath.split(sep)) {
    if (SKIP_DIRS.has(segment)) return true
    if (segment.startsWith('.') && segment !== '.' && segment !== '..') return true
  }
  return false
}

function flushEvents(entry: WatcherEntry): void {
  entry.timer = null
  if (entry.window.isDestroyed()) return

  for (const event of entry.pending.values()) {
    entry.window.webContents.send(IPC.workspace.watchEvent, event)
  }
  entry.pending.clear()
}

function queueEvent(entry: WatcherEntry, event: WatchEvent): void {
  entry.pending.set(event.path, event)
  if (!entry.timer) {
    entry.timer = setTimeout(() => flushEvents(entry), COALESCE_MS)
  }
}

export function startWatching(root: string, window: BrowserWindow): void {
  stopWatching(root)

  const entry: WatcherEntry = {
    watcher: chokidar.watch(root, {
      ignoreInitial: true,
      depth: 8,
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 30 },
      ignored: (watchedPath) => shouldIgnore(watchedPath)
    }),
    root,
    window,
    pending: new Map(),
    timer: null
  }

  const kinds = ['add', 'change', 'unlink', 'addDir', 'unlinkDir'] as const
  for (const kind of kinds) {
    entry.watcher.on(kind, (path) => {
      queueEvent(entry, { kind, path, root })
    })
  }

  watchers.set(root, entry)
}

export function stopWatching(root: string): void {
  const entry = watchers.get(root)
  if (!entry) return

  if (entry.timer) clearTimeout(entry.timer)
  void entry.watcher.close()
  watchers.delete(root)
}

export function stopAllWatchersForWindow(window: BrowserWindow): void {
  for (const [root, entry] of watchers) {
    if (entry.window === window) stopWatching(root)
  }
}
