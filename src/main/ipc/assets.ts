import { access, copyFile, mkdir, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, sep } from 'node:path'
import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { ImportImageRequest, ImportImageResult } from '@shared/types'
import { getSettings } from '../services/settings-store'
import { getWorkspaceRoot } from './workspace'
import { assertSafeAbsolutePath } from './files'
import { senderWindow, wrapHandler } from './index'

function toPosixPath(path: string): string {
  return path.split(sep).join('/')
}

async function uniqueDestination(dir: string, fileName: string): Promise<string> {
  const ext = basename(fileName).includes('.') ? `.${fileName.split('.').pop()}` : ''
  const stem = ext ? fileName.slice(0, -ext.length) : fileName

  let candidate = join(dir, fileName)
  let index = 1
  while (await pathExists(candidate)) {
    candidate = join(dir, `${stem}-${index}${ext}`)
    index += 1
  }
  return candidate
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function resolveAssetDirectory(
  documentPath: string | null,
  workspaceRoot: string | null
): { baseDir: string; markdownBase: string } {
  if (documentPath) {
    const safeDocument = assertSafeAbsolutePath(documentPath, 'document path')
    const baseDir = dirname(safeDocument)
    return { baseDir, markdownBase: baseDir }
  }
  if (workspaceRoot) {
    const safeRoot = assertSafeAbsolutePath(workspaceRoot, 'workspace root')
    return { baseDir: safeRoot, markdownBase: safeRoot }
  }
  const temp = tmpdir()
  return { baseDir: temp, markdownBase: temp }
}

export function registerAssetsIpc(): void {
  ipcMain.handle(
    IPC.assets.importImage,
    wrapHandler(
      IPC.assets.importImage,
      async (event, request: ImportImageRequest): Promise<ImportImageResult> => {
        if (!request?.fileName || request.fileName.includes('\0')) {
          throw new Error('Invalid image file name')
        }
        if (!request.sourcePath && !request.bytes) {
          throw new Error('Image import requires sourcePath or bytes')
        }

        const win = senderWindow(event)
        const workspaceRoot = getWorkspaceRoot(win)
        const { baseDir, markdownBase } = resolveAssetDirectory(
          request.documentPath,
          workspaceRoot
        )

        const imageFolder = getSettings().files.imageFolder
        const assetDir = join(baseDir, imageFolder)
        await mkdir(assetDir, { recursive: true })

        const destination = await uniqueDestination(assetDir, request.fileName)
        if (request.bytes) {
          await writeFile(destination, Buffer.from(request.bytes))
        } else {
          const source = assertSafeAbsolutePath(request.sourcePath!, 'source path')
          await copyFile(source, destination)
        }

        const relativePath = toPosixPath(relative(markdownBase, destination))
        const markdownPath =
          request.documentPath || workspaceRoot ? relativePath : destination

        return {
          absolutePath: destination,
          markdownPath
        }
      }
    )
  )
}
