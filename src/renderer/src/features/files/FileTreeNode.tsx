import { ChevronRight, FileText, Folder } from 'lucide-react'
import { memo, useEffect, useRef } from 'react'
import type { FileNode } from '@shared/types'
import './FileTree.css'

interface FileTreeNodeProps {
  node: FileNode
  depth: number
  selected: boolean
  expanded: boolean
  renaming: boolean
  renameValue: string
  onToggle: () => void
  onSelect: () => void
  onOpen: () => void
  onRenameChange: (value: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onContextMenu: (event: React.MouseEvent) => void
}

export const FileTreeNode = memo(function FileTreeNode({
  node,
  depth,
  selected,
  expanded,
  renaming,
  renameValue,
  onToggle,
  onSelect,
  onOpen,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onContextMenu
}: FileTreeNodeProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isDir = node.kind === 'directory'
  const isMarkdown = node.isMarkdown

  useEffect(() => {
    if (renaming) inputRef.current?.focus()
  }, [renaming])

  return (
    <div
      role="treeitem"
      aria-expanded={isDir ? expanded : undefined}
      aria-selected={selected}
      className={`file-tree__row${selected ? ' file-tree__row--selected' : ''}`}
      style={{ '--tree-depth': depth } as React.CSSProperties}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        className="file-tree__disclosure"
        aria-label={isDir ? (expanded ? 'Collapse' : 'Expand') : undefined}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation()
          if (isDir) onToggle()
        }}
      >
        {isDir ? (
          <ChevronRight className={`file-tree__chevron${expanded ? ' file-tree__chevron--open' : ''}`} size={14} />
        ) : (
          <span className="file-tree__spacer" />
        )}
      </button>

      <button
        type="button"
        className={`file-tree__label${isMarkdown ? ' file-tree__label--markdown' : ''}`}
        onClick={() => {
          onSelect()
          if (!isDir) onOpen()
        }}
        onDoubleClick={() => {
          if (isDir) onToggle()
          else onOpen()
        }}
      >
        {isDir ? <Folder size={14} className="file-tree__icon" /> : <FileText size={14} className="file-tree__icon" />}
        {renaming ? (
          <input
            ref={inputRef}
            className="file-tree__rename"
            value={renameValue}
            onChange={(event) => onRenameChange(event.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onRenameCommit()
              if (event.key === 'Escape') onRenameCancel()
            }}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Rename ${node.name}`}
          />
        ) : (
          <span className="file-tree__name">{node.name}</span>
        )}
      </button>
    </div>
  )
})
