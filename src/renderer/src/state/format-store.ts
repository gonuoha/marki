import { create } from 'zustand'

export type EditorKind = 'visual' | 'source'

export type BlockKind =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'codeBlock'
  | 'other'

/** What is in effect at the caret, as the formatting toolbar shows it. */
export interface FormatSnapshot {
  block: BlockKind
  strong: boolean
  em: boolean
  strikethrough: boolean
  code: boolean
  link: boolean
  bulletList: boolean
  orderedList: boolean
  taskList: boolean
  quote: boolean
}

export const EMPTY_FORMAT: FormatSnapshot = {
  block: 'paragraph',
  strong: false,
  em: false,
  strikethrough: false,
  code: false,
  link: false,
  bulletList: false,
  orderedList: false,
  taskList: false,
  quote: false
}

interface FormatState {
  /** The editor that last had focus; decides the target in split mode. */
  focused: EditorKind
  snapshots: Record<EditorKind, FormatSnapshot>
  report(kind: EditorKind, snapshot: FormatSnapshot): void
  focus(kind: EditorKind): void
}

function sameSnapshot(a: FormatSnapshot, b: FormatSnapshot): boolean {
  return (Object.keys(a) as (keyof FormatSnapshot)[]).every((key) => a[key] === b[key])
}

export const useFormatState = create<FormatState>((set, get) => ({
  focused: 'visual',
  snapshots: { visual: EMPTY_FORMAT, source: EMPTY_FORMAT },

  report(kind, snapshot) {
    if (sameSnapshot(get().snapshots[kind], snapshot)) return
    set((state) => ({ snapshots: { ...state.snapshots, [kind]: snapshot } }))
  },

  focus(kind) {
    if (get().focused !== kind) set({ focused: kind })
  }
}))
