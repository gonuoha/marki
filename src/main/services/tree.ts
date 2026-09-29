import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { isMarkdownPath } from '@shared/settings'
import type { FileNode } from '@shared/types'

const SKIP_DIRS = new Set(['node_modules', '.git'])
const SKIP_FILES = new Set(['.DS_Store'])

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function shouldSkipEntry(name: string, isDirectory: boolean): boolean {
  if (SKIP_FILES.has(name)) return true
  if (isDirectory && (SKIP_DIRS.has(name) || name.startsWith('.'))) return true
  return false
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return naturalCompare(a.name, b.name)
  })
}

async function readChildren(
  dirPath: string,
  maxDepth: number,
  currentDepth: number
): Promise<FileNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries) {
    if (shouldSkipEntry(entry.name, entry.isDirectory())) continue

    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      const child: FileNode = {
        path: fullPath,
        name: entry.name,
        kind: 'directory'
      }
      if (currentDepth < maxDepth) {
        child.children = await readChildren(fullPath, maxDepth, currentDepth + 1)
      }
      nodes.push(child)
      continue
    }

    if (!entry.isFile()) continue

    const fileStat = await stat(fullPath)
    nodes.push({
      path: fullPath,
      name: entry.name,
      kind: 'file',
      size: fileStat.size,
      modifiedAt: fileStat.mtimeMs,
      isMarkdown: isMarkdownPath(fullPath)
    })
  }

  return sortNodes(nodes)
}

/** Builds a directory tree, loading descendants eagerly up to `maxDepth`. */
export async function readTree(root: string, maxDepth: number): Promise<FileNode> {
  const rootStat = await stat(root)
  if (!rootStat.isDirectory()) {
    throw new Error('Workspace root must be a directory')
  }

  const node: FileNode = {
    path: root,
    name: basename(root),
    kind: 'directory',
    modifiedAt: rootStat.mtimeMs
  }

  if (maxDepth > 0) {
    node.children = await readChildren(root, maxDepth - 1, 0)
  }

  return node
}

/** Loads only the immediate children of a directory. */
export async function readDirectory(dirPath: string): Promise<FileNode[]> {
  const dirStat = await stat(dirPath)
  if (!dirStat.isDirectory()) {
    throw new Error('Path is not a directory')
  }
  return readChildren(dirPath, -1, 0)
}
