import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileNode } from '@shared/types'
import { matchShortcut } from '@/lib/keys'
import { useDocuments } from '@/state/document-store'
import { useWorkspace, collectVisiblePaths } from '@/state/workspace-store'
import { buildFileContextItems, ContextMenu } from './ContextMenu'
import { FileTreeNode } from './FileTreeNode'
import { useFileActions } from './use-file-actions'
import './FileTree.css'

interface FileTreeProps {
  onRequestRename?: (path: string) => void
}

export function FileTree({ onRequestRename }: FileTreeProps) {
  const tree = useWorkspace((s) => s.tree)
  const filter = useWorkspace((s) => s.filter)
  const expanded = useWorkspace((s) => s.expanded)
  const selected = useWorkspace((s) => s.selected)
  const toggleExpanded = useWorkspace((s) => s.toggleExpanded)
  const openDoc = useDocuments((s) => s.open)
  const actions = useFileActions()

  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => {
    if (!tree) return []
    return collectVisiblePaths(tree, filter, expanded)
  }, [tree, filter, expanded])

  const nodeByPath = useMemo(() => {
    const map = new Map<string, FileNode>()
    for (const row of rows) map.set(row.node.path, row.node)
    return map
  }, [rows])

  const startRename = useCallback((node: FileNode) => {
    setRenamingPath(node.path)
    setRenameValue(node.name)
  }, [])

  const commitRename = useCallback(async () => {
    if (!renamingPath) return
    const node = nodeByPath.get(renamingPath)
    if (!node) {
      setRenamingPath(null)
      return
    }
    await actions.rename(node, renameValue)
    setRenamingPath(null)
  }, [actions, nodeByPath, renameValue, renamingPath])

  const moveSelection = useCallback(
    (delta: number) => {
      if (rows.length === 0) return
      const currentIndex = selected ? rows.findIndex((r) => r.node.path === selected) : -1
      const nextIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + delta))
      useWorkspace.setState({ selected: rows[nextIndex].node.path })
    },
    [rows, selected]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) &&
          document.activeElement !== containerRef.current &&
          !containerRef.current?.querySelector(':focus-within')) {
        return
      }

      const node = selected ? nodeByPath.get(selected) : null

      if (matchShortcut(event, ['Mod', 'n'])) {
        event.preventDefault()
        const parent = actions.parentFor(node ?? null)
        if (parent) void actions.createFile(parent)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveSelection(1)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveSelection(-1)
        return
      }
      if (!node) return

      if (event.key === 'ArrowRight' && node.kind === 'directory') {
        event.preventDefault()
        if (!expanded.has(node.path)) void toggleExpanded(node.path)
        return
      }
      if (event.key === 'ArrowLeft' && node.kind === 'directory') {
        event.preventDefault()
        if (expanded.has(node.path)) void toggleExpanded(node.path)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        if (renamingPath) return
        if (event.metaKey || event.ctrlKey) {
          startRename(node)
          return
        }
        if (node.kind === 'file') void openDoc(node.path)
        else void toggleExpanded(node.path)
        return
      }
      if (event.key === 'F2') {
        event.preventDefault()
        startRename(node)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        const confirmed = window.confirm(`Move "${node.name}" to Trash?`)
        if (confirmed) void actions.trash(node)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    actions,
    expanded,
    moveSelection,
    nodeByPath,
    openDoc,
    renamingPath,
    selected,
    startRename,
    toggleExpanded
  ])

  useEffect(() => {
    if (onRequestRename && selected) onRequestRename(selected)
  }, [onRequestRename, selected])

  if (!tree) return null

  return (
    <div
      ref={containerRef}
      className="file-tree"
      role="tree"
      aria-label="Workspace files"
      tabIndex={0}
      onClick={() => containerRef.current?.focus()}
    >
      {rows.map(({ node, depth }) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={depth}
          selected={selected === node.path}
          expanded={expanded.has(node.path)}
          renaming={renamingPath === node.path}
          renameValue={renameValue}
          onToggle={() => void toggleExpanded(node.path)}
          onSelect={() => useWorkspace.setState({ selected: node.path })}
          onOpen={() => void openDoc(node.path)}
          onRenameChange={setRenameValue}
          onRenameCommit={() => void commitRename()}
          onRenameCancel={() => setRenamingPath(null)}
          onContextMenu={(event) => {
            event.preventDefault()
            useWorkspace.setState({ selected: node.path })
            setMenu({ x: event.clientX, y: event.clientY, node })
          }}
        />
      ))}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={buildFileContextItems(menu.node, {
            createFile: (parent) => void actions.createFile(parent),
            createFolder: (parent) => void actions.createFolder(parent),
            rename: (node) => startRename(node),
            duplicate: (node) => void actions.duplicate(node),
            reveal: (node) => void actions.reveal(node),
            trash: (node) => void actions.trash(node)
          })}
        />
      )}
    </div>
  )
}
