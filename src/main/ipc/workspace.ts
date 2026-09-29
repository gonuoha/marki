import type { BrowserWindow } from 'electron'
import { dialog, ipcMain } from 'electron'
import { basename } from 'node:path'
import { IPC } from '@shared/ipc'
import type { FileNode, WorkspaceInfo } from '@shared/types'
import { noteRecentWorkspace } from '../services/settings-store'
import { readDirectory, readTree } from '../services/tree'
import { startWatching, stopWatching, stopAllWatchersForWindow } from '../services/watcher'
import { assertSafeAbsolutePath } from './files'
import { senderWindow, wrapHandler } from './index'

const windowRoots = new WeakMap<BrowserWindow, string>()

export function getWorkspaceRoot(window: BrowserWindow): string | null {
  return windowRoots.get(window) ?? null
}

export function registerWorkspaceIpc(): void {
  ipcMain.handle(
    IPC.workspace.pickFolder,
    wrapHandler(IPC.workspace.pickFolder, async (event): Promise<string | null> => {
      const win = senderWindow(event)
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory', 'createDirectory']
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0] ?? null
    })
  )

  ipcMain.handle(
    IPC.workspace.open,
    wrapHandler(
      IPC.workspace.open,
      async (
        event,
        root: string
      ): Promise<{ info: WorkspaceInfo; tree: FileNode }> => {
        const safeRoot = assertSafeAbsolutePath(root, 'workspace root')
        const win = senderWindow(event)

        const previous = windowRoots.get(win)
        if (previous && previous !== safeRoot) stopWatching(previous)

        const tree = await readTree(safeRoot, 2)
        const info: WorkspaceInfo = { root: safeRoot, name: basename(safeRoot) }

        windowRoots.set(win, safeRoot)
        startWatching(safeRoot, win)
        await noteRecentWorkspace(safeRoot)

        return { info, tree }
      }
    )
  )

  ipcMain.handle(
    IPC.workspace.readDir,
    wrapHandler(IPC.workspace.readDir, async (_event, path: string): Promise<FileNode[]> => {
      const safePath = assertSafeAbsolutePath(path, 'directory path')
      return readDirectory(safePath)
    })
  )

  ipcMain.handle(
    IPC.workspace.close,
    wrapHandler(IPC.workspace.close, async (event, root: string): Promise<void> => {
      const safeRoot = assertSafeAbsolutePath(root, 'workspace root')
      const win = senderWindow(event)
      stopWatching(safeRoot)
      if (windowRoots.get(win) === safeRoot) windowRoots.delete(win)
    })
  )
}

export function clearWorkspaceForWindow(window: BrowserWindow): void {
  stopAllWatchersForWindow(window)
  windowRoots.delete(window)
}
