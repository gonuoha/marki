import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FileNode } from '@shared/types'
import { dirname } from '@/lib/path'
import './ContextMenu.css'

export interface ContextMenuItem {
  id: string
  label: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x, y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let nextX = x
    let nextY = y
    if (x + rect.width > window.innerWidth) nextX = window.innerWidth - rect.width - 8
    if (y + rect.height > window.innerHeight) nextY = window.innerHeight - rect.height - 8
    setPosition({ x: Math.max(8, nextX), y: Math.max(8, nextY) })
  }, [x, y, items.length])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const onScroll = () => onClose()

    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: position.x, top: position.y }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={`context-menu__item${item.danger ? ' context-menu__item--danger' : ''}`}
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return
            item.onSelect()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function buildFileContextItems(
  node: FileNode,
  actions: {
    createFile: (parent: string) => void
    createFolder: (parent: string) => void
    rename: (node: FileNode) => void
    duplicate: (node: FileNode) => void
    reveal: (node: FileNode) => void
    trash: (node: FileNode) => void
  }
): ContextMenuItem[] {
  const parent = node.kind === 'directory' ? node.path : dirname(node.path)

  const items: ContextMenuItem[] = [
    {
      id: 'new-file',
      label: 'New File',
      onSelect: () => actions.createFile(parent)
    },
    {
      id: 'new-folder',
      label: 'New Folder',
      onSelect: () => actions.createFolder(parent)
    },
    { id: 'rename', label: 'Rename', onSelect: () => actions.rename(node) },
    {
      id: 'duplicate',
      label: 'Duplicate',
      disabled: node.kind !== 'file',
      onSelect: () => actions.duplicate(node)
    },
    { id: 'reveal', label: 'Reveal in Finder', onSelect: () => actions.reveal(node) },
    {
      id: 'trash',
      label: 'Move to Trash',
      danger: true,
      onSelect: () => actions.trash(node)
    }
  ]

  return items
}
