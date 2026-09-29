import type { MarkType } from 'prosemirror-model'
import type { EditorState } from 'prosemirror-state'
import { schema } from '@/editor/markdown'
import type { BlockKind, FormatSnapshot } from '@/state/format-store'

function hasMark(state: EditorState, type: MarkType): boolean {
  const { from, to, empty, $from } = state.selection
  if (empty) return Boolean(type.isInSet(state.storedMarks ?? $from.marks()))
  return state.doc.rangeHasMark(from, to, type)
}

export function visualFormatSnapshot(state: EditorState): FormatSnapshot {
  const { nodes, marks } = schema
  const { $from } = state.selection
  const parent = $from.parent

  let block: BlockKind = 'other'
  if (parent.type === nodes.paragraph) block = 'paragraph'
  else if (parent.type === nodes.heading) block = `heading${parent.attrs.level}` as BlockKind
  else if (parent.type === nodes.code_block) block = 'codeBlock'

  let bulletList = false
  let orderedList = false
  let taskList = false
  let quote = false
  let listSeen = false

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type === nodes.blockquote) quote = true
    if (listSeen) continue
    if (node.type === nodes.ordered_list) {
      orderedList = true
      listSeen = true
    } else if (node.type === nodes.bullet_list) {
      const item = $from.node(d + 1)
      if (item?.attrs.checked != null) taskList = true
      else bulletList = true
      listSeen = true
    }
  }

  return {
    block,
    strong: hasMark(state, marks.strong),
    em: hasMark(state, marks.em),
    strikethrough: hasMark(state, marks.strikethrough),
    code: hasMark(state, marks.code),
    link: hasMark(state, marks.link),
    bulletList,
    orderedList,
    taskList,
    quote
  }
}
