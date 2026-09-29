import type { AppCommand, EditorMode } from '@shared/types'
import { registerCommand } from '@/state/commands'
import { useDocuments } from '@/state/document-store'
import { useFormatState, type EditorKind } from '@/state/format-store'

export type FormatCommand = Extract<AppCommand, `format.${string}`>

export type FormatHandlers = Record<FormatCommand, () => void>

export const FORMAT_COMMANDS: FormatCommand[] = [
  'format.bold',
  'format.italic',
  'format.strikethrough',
  'format.code',
  'format.link',
  'format.image',
  'format.table',
  'format.codeBlock',
  'format.quote',
  'format.bulletList',
  'format.orderedList',
  'format.taskList',
  'format.footnote',
  'format.math',
  'format.horizontalRule',
  'format.heading1',
  'format.heading2',
  'format.heading3',
  'format.heading4',
  'format.heading5',
  'format.heading6',
  'format.paragraph'
]

const targets = new Map<EditorKind, FormatHandlers>()
let unregisterCommands: (() => void) | null = null

/** Which editor formatting applies to for a document shown in `mode`. */
export function editorKindForMode(mode: EditorMode, focused: EditorKind): EditorKind {
  if (mode === 'split') return focused
  return mode === 'source' ? 'source' : 'visual'
}

function focusedEditorKind(): EditorKind {
  const active = document.activeElement
  if (active?.closest('.marki-source-editor')) return 'source'
  if (active?.closest('.ProseMirror')) return 'visual'
  return useFormatState.getState().focused
}

export function activeEditorKind(): EditorKind | null {
  const { documents, activeId } = useDocuments.getState()
  const mode = documents.find((d) => d.id === activeId)?.mode
  if (!mode) return null
  return editorKindForMode(mode, focusedEditorKind())
}

function dispatchFormat(id: FormatCommand): void {
  const kind = activeEditorKind()
  const target = (kind && targets.get(kind)) ?? targets.values().next().value
  target?.[id]()
}

/**
 * Both editors are mounted in split mode, so they cannot each own the format
 * commands: whichever registered last would win for good. Each editor
 * registers as a target instead, and the command goes to the active one.
 */
export function registerFormatTarget(kind: EditorKind, handlers: FormatHandlers): () => void {
  targets.set(kind, handlers)
  if (!unregisterCommands) {
    const unsubs = FORMAT_COMMANDS.map((id) => registerCommand(id, () => dispatchFormat(id)))
    unregisterCommands = () => unsubs.forEach((unsub) => unsub())
  }

  return () => {
    if (targets.get(kind) === handlers) targets.delete(kind)
    if (targets.size === 0 && unregisterCommands) {
      unregisterCommands()
      unregisterCommands = null
    }
  }
}
