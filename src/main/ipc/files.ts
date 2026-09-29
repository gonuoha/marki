import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, normalize, resolve, sep } from 'node:path'
import { dialog, ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc'
import { MARKDOWN_EXTENSIONS } from '@shared/settings'
import type { FileNode, FileReadResult, FileWriteResult } from '@shared/types'
import { takePendingOpenFiles } from '../services/open-queue'
import { noteRecentFile } from '../services/settings-store'
import { senderWindow, wrapHandler } from './index'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'])

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif'
}

export function assertSafeAbsolutePath(path: string, label = 'path'): string {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error(`Invalid ${label}: path is required`)
  }
  if (path.includes('\0')) {
    throw new Error(`Invalid ${label}: path contains null bytes`)
  }
  if (!isAbsolute(path)) {
    throw new Error(`Invalid ${label}: path must be absolute`)
  }
  return path
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

async function writeAtomic(targetPath: string, content: string | Buffer): Promise<void> {
  const dir = dirname(targetPath)
  await mkdir(dir, { recursive: true })
  const tmp = join(dir, `.${basename(targetPath)}.${randomBytes(4).toString('hex')}.tmp`)
  await writeFile(tmp, content)
  await rename(tmp, targetPath)
}

async function buildFileNode(path: string): Promise<FileNode> {
  const fileStat = await stat(path)
  return {
    path,
    name: basename(path),
    kind: 'file',
    size: fileStat.size,
    modifiedAt: fileStat.mtimeMs
  }
}

function isInsideDirectory(target: string, root: string): boolean {
  const normalizedTarget = normalize(target)
  const normalizedRoot = normalize(root)
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(normalizedRoot + sep)
  )
}

export function registerFilesIpc(): void {
  ipcMain.handle(
    IPC.file.read,
    wrapHandler(IPC.file.read, async (_event, path: string): Promise<FileReadResult> => {
      const safePath = assertSafeAbsolutePath(path, 'file path')
      const raw = await readFile(safePath)
      const text = stripBom(raw.toString('utf8'))
      const ok = !text.includes('\uFFFD')
      const fileStat = await stat(safePath)
      if (ok) await noteRecentFile(safePath)
      return { path: safePath, content: text, modifiedAt: fileStat.mtimeMs, ok }
    })
  )

  ipcMain.handle(
    IPC.file.write,
    wrapHandler(
      IPC.file.write,
      async (_event, path: string, content: string): Promise<FileWriteResult> => {
        const safePath = assertSafeAbsolutePath(path, 'file path')
        await writeAtomic(safePath, content)
        const fileStat = await stat(safePath)
        return { path: safePath, modifiedAt: fileStat.mtimeMs }
      }
    )
  )

  ipcMain.handle(
    IPC.file.create,
    wrapHandler(
      IPC.file.create,
      async (_event, path: string, content = ''): Promise<FileNode> => {
        const safePath = assertSafeAbsolutePath(path, 'file path')
        await writeAtomic(safePath, content)
        return buildFileNode(safePath)
      }
    )
  )

  ipcMain.handle(
    IPC.file.createFolder,
    wrapHandler(IPC.file.createFolder, async (_event, path: string): Promise<FileNode> => {
      const safePath = assertSafeAbsolutePath(path, 'folder path')
      await mkdir(safePath, { recursive: true })
      const folderStat = await stat(safePath)
      return {
        path: safePath,
        name: basename(safePath),
        kind: 'directory',
        modifiedAt: folderStat.mtimeMs
      }
    })
  )

  ipcMain.handle(
    IPC.file.rename,
    wrapHandler(IPC.file.rename, async (_event, from: string, to: string): Promise<FileNode> => {
      const safeFrom = assertSafeAbsolutePath(from, 'source path')
      const safeTo = assertSafeAbsolutePath(to, 'destination path')
      await rename(safeFrom, safeTo)
      return buildFileNode(safeTo)
    })
  )

  ipcMain.handle(
    IPC.file.trash,
    wrapHandler(IPC.file.trash, async (_event, path: string): Promise<void> => {
      const safePath = assertSafeAbsolutePath(path, 'file path')
      await shell.trashItem(safePath)
    })
  )

  ipcMain.handle(
    IPC.file.reveal,
    wrapHandler(IPC.file.reveal, async (_event, path: string): Promise<void> => {
      const safePath = assertSafeAbsolutePath(path, 'file path')
      shell.showItemInFolder(safePath)
    })
  )

  ipcMain.handle(
    IPC.file.exists,
    wrapHandler(IPC.file.exists, async (_event, path: string): Promise<boolean> => {
      const safePath = assertSafeAbsolutePath(path, 'file path')
      try {
        await stat(safePath)
        return true
      } catch {
        return false
      }
    })
  )

  ipcMain.handle(
    IPC.file.pickOpen,
    wrapHandler(IPC.file.pickOpen, async (event): Promise<string[]> => {
      const win = senderWindow(event)
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Markdown',
            extensions: MARKDOWN_EXTENSIONS.map((ext) => ext.slice(1))
          }
        ]
      })
      if (result.canceled || result.filePaths.length === 0) return []
      for (const filePath of result.filePaths) {
        await noteRecentFile(filePath)
      }
      return result.filePaths
    })
  )

  ipcMain.handle(
    IPC.file.pickSave,
    wrapHandler(
      IPC.file.pickSave,
      async (event, suggestedName?: string): Promise<string | null> => {
        const win = senderWindow(event)
        const result = await dialog.showSaveDialog(win, {
          defaultPath: suggestedName,
          filters: [
            {
              name: 'Markdown',
              extensions: MARKDOWN_EXTENSIONS.map((ext) => ext.slice(1))
            }
          ]
        })
        if (result.canceled || !result.filePath) return null
        const filePath = result.filePath.endsWith('.md')
          ? result.filePath
          : `${result.filePath}.md`
        return filePath
      }
    )
  )

  ipcMain.handle(
    IPC.file.readAsDataUrl,
    wrapHandler(
      IPC.file.readAsDataUrl,
      async (_event, path: string, baseDir?: string | null): Promise<string | null> => {
        if (typeof path !== 'string' || path.includes('\0')) {
          throw new Error('Invalid image path')
        }

        let resolved: string
        if (isAbsolute(path)) {
          resolved = normalize(assertSafeAbsolutePath(path, 'image path'))
        } else if (baseDir) {
          const safeBase = assertSafeAbsolutePath(baseDir, 'base directory')
          resolved = normalize(resolve(safeBase, path))
        } else {
          throw new Error('Relative image paths require a base directory')
        }

        if (baseDir) {
          const safeBase = normalize(assertSafeAbsolutePath(baseDir, 'base directory'))
          const home = normalize(homedir())
          const outsideBase = !isInsideDirectory(resolved, safeBase)
          const outsideHome = !isInsideDirectory(resolved, home)
          if (outsideBase && outsideHome) {
            throw new Error('Image path is outside the allowed directories')
          }
        } else if (!isAbsolute(path)) {
          throw new Error('Relative image paths require a base directory')
        }

        try {
          const fileStat = await stat(resolved)
          if (!fileStat.isFile()) return null
        } catch {
          return null
        }

        const ext = extname(resolved).toLowerCase()
        if (!IMAGE_EXTENSIONS.has(ext)) return null

        const mime = MIME_BY_EXT[ext]
        if (!mime) return null

        const bytes = await readFile(resolved)
        return `data:${mime};base64,${bytes.toString('base64')}`
      }
    )
  )

  ipcMain.handle(
    IPC.file.takePendingOpen,
    wrapHandler(IPC.file.takePendingOpen, async (): Promise<string[]> => takePendingOpenFiles())
  )
}
