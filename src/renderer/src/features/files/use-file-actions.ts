import { useCallback } from 'react'
import { basename, dirname, join } from '@/lib/path'
import { useDocuments } from '@/state/document-store'
import { useUi } from '@/state/ui-store'
import { useWorkspace } from '@/state/workspace-store'
import type { FileNode } from '@shared/types'

async function ensureUniquePath(parent: string, baseName: string): Promise<string> {
  const ext = baseName.includes('.') ? `.${baseName.split('.').pop()}` : ''
  const stem = ext ? baseName.slice(0, -ext.length) : baseName
  let candidate = baseName
  for (let i = 1; i < 200; i++) {
    const path = join(parent, candidate)
    const exists = await window.marki.file.exists(path)
    if (!exists) return path
    candidate = `${stem} ${i}${ext}`
  }
  return join(parent, baseName)
}

export function useFileActions() {
  const info = useWorkspace((s) => s.info)
  const refresh = useWorkspace((s) => s.refresh)
  const open = useDocuments((s) => s.open)
  const toast = useUi((s) => s.toast)

  const parentFor = useCallback(
    (node: FileNode | null): string | null => {
      if (!info) return null
      if (!node) return info.root
      return node.kind === 'directory' ? node.path : dirname(node.path)
    },
    [info]
  )

  const selectPath = (path: string) => {
    useWorkspace.setState({ selected: path })
  }

  const createFile = useCallback(
    async (parentPath: string, name = 'Untitled.md') => {
      try {
        const path = await ensureUniquePath(parentPath, name)
        const node = await window.marki.file.create(path, '')
        await refresh(parentPath)
        selectPath(node.path)
        await open(node.path)
      } catch (err) {
        console.error('[files] create failed', err)
        toast('error', 'Could not create file.')
      }
    },
    [open, refresh, toast]
  )

  const createFolder = useCallback(
    async (parentPath: string, name = 'New Folder') => {
      try {
        const path = await ensureUniquePath(parentPath, name)
        await window.marki.file.createFolder(path)
        await refresh(parentPath)
        selectPath(path)
        await useWorkspace.getState().toggleExpanded(parentPath)
      } catch (err) {
        console.error('[files] create folder failed', err)
        toast('error', 'Could not create folder.')
      }
    },
    [refresh, toast]
  )

  const rename = useCallback(
    async (node: FileNode, newName: string) => {
      const trimmed = newName.trim()
      if (!trimmed || trimmed === node.name) return
      const nextPath = join(dirname(node.path), trimmed)
      try {
        await window.marki.file.rename(node.path, nextPath)
        await refresh(dirname(node.path))
        selectPath(nextPath)
        const docs = useDocuments.getState().documents
        const doc = docs.find((d) => d.path === node.path)
        if (doc) {
          useDocuments.setState((state) => ({
            documents: state.documents.map((d) =>
              d.id === doc.id ? { ...d, path: nextPath, title: basename(nextPath) } : d
            )
          }))
        }
      } catch (err) {
        console.error('[files] rename failed', err)
        toast('error', 'Could not rename item.')
      }
    },
    [refresh, toast]
  )

  const duplicate = useCallback(
    async (node: FileNode) => {
      if (node.kind !== 'file') return
      const parent = dirname(node.path)
      const stem = node.name.replace(/(\.[^.]+)?$/, ' copy$1')
      try {
        const result = await window.marki.file.read(node.path)
        const path = await ensureUniquePath(parent, stem)
        await window.marki.file.create(path, result.content)
        await refresh(parent)
      } catch (err) {
        console.error('[files] duplicate failed', err)
        toast('error', 'Could not duplicate file.')
      }
    },
    [refresh, toast]
  )

  const reveal = useCallback(async (node: FileNode) => {
    try {
      await window.marki.file.reveal(node.path)
    } catch (err) {
      console.error('[files] reveal failed', err)
    }
  }, [])

  const trash = useCallback(
    async (node: FileNode) => {
      try {
        await window.marki.file.trash(node.path)
        await refresh(dirname(node.path))
        const docs = useDocuments.getState().documents
        const doc = docs.find((d) => d.path === node.path)
        if (doc) await useDocuments.getState().close(doc.id)
      } catch (err) {
        console.error('[files] trash failed', err)
        toast('error', 'Could not move item to trash.')
      }
    },
    [refresh, toast]
  )

  return {
    parentFor,
    createFile,
    createFolder,
    rename,
    duplicate,
    reveal,
    trash
  }
}
