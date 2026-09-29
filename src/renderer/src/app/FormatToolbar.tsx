import {
  Bold,
  ChevronUp,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Sigma,
  SquareCode,
  Strikethrough,
  Superscript,
  Table,
  TextQuote,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { editorKindForMode, type FormatCommand } from '@/editor/format-router'
import { COMMAND_MAP } from '@/features/palette/command-registry'
import { displayShortcut } from '@/lib/keys'
import { runCommand } from '@/state/commands'
import { useDocuments } from '@/state/document-store'
import { useFormatState, type BlockKind, type FormatSnapshot } from '@/state/format-store'
import './FormatToolbar.css'

interface ToolDef {
  id: FormatCommand
  icon: LucideIcon
  active?: (snapshot: FormatSnapshot) => boolean
  /** Inline formatting has no meaning inside a code block. */
  inline?: boolean
}

const GROUPS: ToolDef[][] = [
  [
    { id: 'format.bold', icon: Bold, active: (s) => s.strong, inline: true },
    { id: 'format.italic', icon: Italic, active: (s) => s.em, inline: true },
    { id: 'format.strikethrough', icon: Strikethrough, active: (s) => s.strikethrough, inline: true },
    { id: 'format.code', icon: Code, active: (s) => s.code, inline: true },
    { id: 'format.link', icon: Link, active: (s) => s.link, inline: true }
  ],
  [
    { id: 'format.bulletList', icon: List, active: (s) => s.bulletList },
    { id: 'format.orderedList', icon: ListOrdered, active: (s) => s.orderedList },
    { id: 'format.taskList', icon: ListChecks, active: (s) => s.taskList },
    { id: 'format.quote', icon: TextQuote, active: (s) => s.quote }
  ],
  [
    { id: 'format.codeBlock', icon: SquareCode, active: (s) => s.block === 'codeBlock' },
    { id: 'format.table', icon: Table },
    { id: 'format.image', icon: Image, inline: true },
    { id: 'format.math', icon: Sigma, inline: true },
    { id: 'format.footnote', icon: Superscript, inline: true },
    { id: 'format.horizontalRule', icon: Minus }
  ]
]

interface BlockOption {
  block: BlockKind
  id: FormatCommand
  label: string
  icon: LucideIcon
}

const BLOCK_OPTIONS: BlockOption[] = [
  { block: 'paragraph', id: 'format.paragraph', label: 'Paragraph', icon: Pilcrow },
  { block: 'heading1', id: 'format.heading1', label: 'Heading 1', icon: Heading1 },
  { block: 'heading2', id: 'format.heading2', label: 'Heading 2', icon: Heading2 },
  { block: 'heading3', id: 'format.heading3', label: 'Heading 3', icon: Heading3 },
  { block: 'heading4', id: 'format.heading4', label: 'Heading 4', icon: Heading4 },
  { block: 'heading5', id: 'format.heading5', label: 'Heading 5', icon: Heading5 },
  { block: 'heading6', id: 'format.heading6', label: 'Heading 6', icon: Heading6 }
]

function labelFor(id: FormatCommand): string {
  return COMMAND_MAP.get(id)?.label ?? id
}

function tooltipFor(id: FormatCommand): string {
  const shortcut = COMMAND_MAP.get(id)?.shortcut
  return shortcut ? `${labelFor(id)} (${displayShortcut(shortcut)})` : labelFor(id)
}

/** Keeps the editor's selection and focus when a toolbar control is pressed. */
function keepEditorFocus(event: MouseEvent): void {
  event.preventDefault()
}

function useActiveSnapshot(): FormatSnapshot {
  const mode = useDocuments((s) => s.documents.find((d) => d.id === s.activeId)?.mode ?? 'visual')
  return useFormatState((s) => s.snapshots[editorKindForMode(mode, s.focused)])
}

function BlockMenu({ block }: { block: BlockKind }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current =
    block === 'codeBlock'
      ? { label: 'Code block', icon: SquareCode }
      : (BLOCK_OPTIONS.find((option) => option.block === block) ?? BLOCK_OPTIONS[0])
  const CurrentIcon = current.icon

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="format-toolbar__block" ref={rootRef}>
      <button
        type="button"
        className={`format-toolbar__btn format-toolbar__btn--block${open ? ' format-toolbar__btn--open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Text style: ${current.label}`}
        title="Text style"
        onMouseDown={keepEditorFocus}
        onClick={() => setOpen((value) => !value)}
      >
        <CurrentIcon size={16} strokeWidth={1.9} />
        <ChevronUp size={12} strokeWidth={2.25} className="format-toolbar__chevron" />
      </button>

      {open && (
        <div className="format-toolbar__menu" role="menu" aria-label="Text style">
          {BLOCK_OPTIONS.map((option) => {
            const Icon = option.icon
            const shortcut = COMMAND_MAP.get(option.id)?.shortcut
            const checked = option.block === block
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                className={`format-toolbar__menu-item${checked ? ' format-toolbar__menu-item--checked' : ''}`}
                onMouseDown={keepEditorFocus}
                onClick={() => {
                  runCommand(option.id)
                  setOpen(false)
                }}
              >
                <Icon size={15} strokeWidth={1.9} />
                <span className={`format-toolbar__menu-label format-toolbar__menu-label--${option.block}`}>
                  {option.label}
                </span>
                {shortcut && <kbd className="format-toolbar__kbd">{displayShortcut(shortcut)}</kbd>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function FormatToolbar() {
  const snapshot = useActiveSnapshot()
  const inCode = snapshot.block === 'codeBlock'

  return (
    <div className="format-toolbar" role="toolbar" aria-label="Formatting">
      <BlockMenu block={snapshot.block} />
      {GROUPS.map((group, index) => (
        <div className="format-toolbar__group" key={index}>
          {group.map((tool) => {
            const Icon = tool.icon
            const active = tool.active?.(snapshot) ?? false
            return (
              <button
                key={tool.id}
                type="button"
                className={`format-toolbar__btn${active ? ' format-toolbar__btn--active' : ''}`}
                aria-label={labelFor(tool.id)}
                aria-pressed={tool.active ? active : undefined}
                title={tooltipFor(tool.id)}
                disabled={Boolean(tool.inline && inCode)}
                onMouseDown={keepEditorFocus}
                onClick={() => runCommand(tool.id)}
              >
                <Icon size={16} strokeWidth={1.9} />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
