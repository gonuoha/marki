import type { FileNode, WatchEvent, WorkspaceInfo } from '@shared/types'
import { create } from 'zustand'
import { basename, dirname } from '@/lib/path'

export interface WorkspaceState {
  info: WorkspaceInfo | null
  tree: FileNode | null
  expanded: Set<string>
  selected: string | null
  filter: string
  openFolder(root?: string): Promise<void>
  closeFolder(): Promise<void>
  toggleExpanded(path: string): Promise<void>
  setFilter(filter: string): void
  applyWatchEvent(event: WatchEvent): void
  refresh(path?: string): Promise<void>
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function sortChildren(children: FileNode[]): FileNode[] {
  return [...children].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return naturalCompare(a.name, b.name)
  })
}

function insertSorted(children: FileNode[], node: FileNode): FileNode[] {
  return sortChildren([...children, node])
}

function cloneTree(node: FileNode): FileNode {
  return {
    ...node,
    children: node.children?.map(cloneTree)
  }
}

function findNode(root: FileNode, path: string): FileNode | null {
  if (root.path === path) return root
  if (!root.children) return null
  for (const child of root.children) {
    const found = findNode(child, path)
    if (found) return found
  }
  return null
}

function updateNode(root: FileNode, path: string, updater: (node: FileNode) => FileNode): FileNode {
  if (root.path === path) return updater(root)
  if (!root.children) return root
  return {
    ...root,
    children: root.children.map((child) => updateNode(child, path, updater))
  }
}

function removeNode(root: FileNode, path: string): FileNode {
  if (!root.children) return root
  return {
    ...root,
    children: root.children
      .filter((child) => child.path !== path)
      .map((child) => removeNode(child, path))
  }
}

function parentDir(path: string): string {
  const parent = dirname(path)
  return parent === path ? path : parent
}

function makeFileNode(path: string, kind: 'file' | 'directory'): FileNode {
  return {
    path,
    name: basename(path),
    kind,
    ...(kind === 'directory' ? {} : { isMarkdown: /\.(md|markdown|mdown|mkd|mdx|txt)$/i.test(path) })
  }
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  info: null,
  tree: null,
  expanded: new Set<string>(),
  selected: null,
  filter: '',

  async openFolder(root) {
    let folder = root
    if (!folder) {
      folder = await window.marki.workspace.pickFolder() ?? undefined
      if (!folder) return
    }

    const { info, tree } = await window.marki.workspace.open(folder)
    const expanded = new Set<string>([info.root])
    set({ info, tree, expanded, selected: null, filter: '' })
  },

  async closeFolder() {
    const { info } = get()
    if (!info) return
    await window.marki.workspace.close(info.root)
    set({ info: null, tree: null, expanded: new Set(), selected: null, filter: '' })
  },

  async toggleExpanded(path) {
    const { expanded, tree } = get()
    const next = new Set(expanded)
    if (next.has(path)) {
      next.delete(path)
      set({ expanded: next })
      return
    }

    next.add(path)
    const node = tree ? findNode(tree, path) : null
    if (node?.kind === 'directory' && node.children === undefined) {
      const children = await window.marki.workspace.readDir(path)
      set({
        expanded: next,
        tree: tree ? updateNode(tree, path, (n) => ({ ...n, children })) : tree
      })
      return
    }

    set({ expanded: next })
  },

  setFilter(filter) {
    set({ filter })
  },

  applyWatchEvent(event) {
    const { tree, info, expanded } = get()
    if (!tree || !info || event.root !== info.root) return

    let nextTree = cloneTree(tree)
    const parent = parentDir(event.path)

    switch (event.kind) {
      case 'add':
        nextTree = updateNode(nextTree, parent, (dir) => {
          if (dir.kind !== 'directory') return dir
          const children = dir.children ?? []
          if (children.some((c) => c.path === event.path)) return dir
          return { ...dir, children: insertSorted(children, makeFileNode(event.path, 'file')) }
        })
        break
      case 'addDir':
        nextTree = updateNode(nextTree, parent, (dir) => {
          if (dir.kind !== 'directory') return dir
          const children = dir.children ?? []
          if (children.some((c) => c.path === event.path)) return dir
          return { ...dir, children: insertSorted(children, makeFileNode(event.path, 'directory')) }
        })
        break
      case 'unlink':
      case 'unlinkDir':
        nextTree = removeNode(nextTree, event.path)
        if (expanded.has(event.path)) {
          const nextExpanded = new Set(expanded)
          nextExpanded.delete(event.path)
          set({ expanded: nextExpanded })
        }
        break
      case 'change':
        nextTree = updateNode(nextTree, event.path, (node) => ({
          ...node,
          modifiedAt: Date.now()
        }))
        break
      default:
        break
    }

    set({ tree: nextTree })
  },

  async refresh(path) {
    const { tree, info } = get()
    if (!tree || !info) return

    const target = path ?? info.root
    const children = await window.marki.workspace.readDir(target)
    set({
      tree: updateNode(tree, target, (node) => ({ ...node, children }))
    })
  }
}))

export function nodeMatchesFilter(node: FileNode, filter: string): boolean {
  if (!filter) return true
  return node.name.toLowerCase().includes(filter.toLowerCase())
}

export function collectVisiblePaths(
  node: FileNode,
  filter: string,
  expanded: Set<string>,
  depth = 0
): { node: FileNode; depth: number }[] {
  const trimmed = filter.trim().toLowerCase()
  if (!trimmed) {
    const rows: { node: FileNode; depth: number }[] = [{ node, depth }]
    if (node.kind === 'directory' && expanded.has(node.path) && node.children) {
      for (const child of node.children) {
        rows.push(...collectVisiblePaths(child, '', expanded, depth + 1))
      }
    }
    return rows
  }

  const subtreeMatches = (n: FileNode): boolean => {
    if (n.name.toLowerCase().includes(trimmed)) return true
    if (n.children) return n.children.some(subtreeMatches)
    return false
  }

  if (!subtreeMatches(node)) return []

  const rows: { node: FileNode; depth: number }[] = [{ node, depth }]
  if (node.kind === 'directory' && node.children) {
    const shouldExpand = expanded.has(node.path) || node.name.toLowerCase().includes(trimmed)
    if (shouldExpand) {
      for (const child of node.children) {
        rows.push(...collectVisiblePaths(child, filter, expanded, depth + 1))
      }
    }
  }
  return rows
}
