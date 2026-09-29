import { setBlockType, toggleMark, wrapIn } from 'prosemirror-commands'
import type { Mark, MarkType, Node as ProseNode, ResolvedPos } from 'prosemirror-model'
import type { Command, EditorState, Transaction } from 'prosemirror-state'
import { TextSelection } from 'prosemirror-state'
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list'
import type { EditorView } from 'prosemirror-view'
import { useUi } from '@/state/ui-store'
import { schema } from '@/editor/markdown'

let activeView: EditorView | null = null

export function setActiveEditorView(view: EditorView | null): void {
  activeView = view
}

export function getActiveEditorView(): EditorView | null {
  return activeView
}

function dispatchCommand(command: Command): boolean {
  const view = activeView
  if (!view) return false
  // Commands arrive from the menu, palette and toolbar as well as the keyboard;
  // the caret belongs back in the document afterwards.
  if (!view.hasFocus()) view.focus()
  return command(view.state, view.dispatch.bind(view), view)
}

function findFootnoteLabel(doc: ProseNode): string {
  const labels = new Set<string>()
  doc.descendants((node) => {
    if (node.type.name === 'footnote_reference' || node.type.name === 'footnote_definition') {
      labels.add(String(node.attrs.label))
    }
  })
  let n = 1
  while (labels.has(String(n))) n++
  return String(n)
}

export function toggleStrong(): Command {
  return toggleMark(schema.marks.strong)
}

export function toggleEm(): Command {
  return toggleMark(schema.marks.em)
}

export function toggleStrikethrough(): Command {
  return toggleMark(schema.marks.strikethrough)
}

export function toggleCode(): Command {
  return toggleMark(schema.marks.code)
}

/** The run of inline content around `$pos` carrying the same `type` mark. */
function markRangeAt(
  $pos: ResolvedPos,
  type: MarkType
): { from: number; to: number; mark: Mark } | null {
  const { parent } = $pos
  let startIndex = $pos.index()
  let mark = type.isInSet(parent.maybeChild(startIndex)?.marks ?? [])
  if (!mark && startIndex > 0) {
    startIndex--
    mark = type.isInSet(parent.child(startIndex).marks)
  }
  if (!mark) return null

  let endIndex = startIndex + 1
  while (startIndex > 0 && mark.isInSet(parent.child(startIndex - 1).marks)) startIndex--
  while (endIndex < parent.childCount && mark.isInSet(parent.child(endIndex).marks)) endIndex++

  let from = $pos.start()
  for (let i = 0; i < startIndex; i++) from += parent.child(i).nodeSize
  let to = from
  for (let i = startIndex; i < endIndex; i++) to += parent.child(i).nodeSize
  return { from, to, mark }
}

export function toggleLink(): Command {
  return (state, _dispatch, view) => {
    const { from, to, empty } = state.selection
    const linkType = schema.marks.link
    const existing = empty ? markRangeAt(state.selection.$from, linkType) : null

    let href = ''
    let title: string | null = null
    let rangeFrom = from
    let rangeTo = to

    if (!empty) {
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isText) return
        const mark = linkType?.isInSet(node.marks)
        if (mark) {
          href = String(mark.attrs.href ?? '')
          title = mark.attrs.title ? String(mark.attrs.title) : null
          rangeFrom = Math.min(rangeFrom, pos)
          rangeTo = Math.max(rangeTo, pos + node.nodeSize)
        }
      })
    } else if (existing) {
      href = String(existing.mark.attrs.href ?? '')
      title = existing.mark.attrs.title ? String(existing.mark.attrs.title) : null
      rangeFrom = existing.from
      rangeTo = existing.to
    }

    const text = state.doc.textBetween(rangeFrom, rangeTo, '')
    useUi.getState().openDialog('link', {
      href,
      title,
      text,
      from: rangeFrom,
      to: rangeTo,
      view
    })
    return true
  }
}

export function setHeading(level: number): Command {
  return setBlockType(schema.nodes.heading, { level })
}

export function setParagraph(): Command {
  return setBlockType(schema.nodes.paragraph)
}

export function toggleBlockquote(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    const blockquote = schema.nodes.blockquote
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === blockquote) {
        return unwrapBlockquote(state, dispatch)
      }
    }
    return wrapIn(blockquote)(state, dispatch)
  }
}

function unwrapBlockquote(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const { $from, $to } = state.selection
  const blockquote = schema.nodes.blockquote
  const range = $from.blockRange($to, (node) => node.type === blockquote)
  if (!range) return false
  if (!dispatch) return true
  dispatch(state.tr.lift(range, range.depth - 1))
  return true
}

function toggleList(listType: 'bullet_list' | 'ordered_list'): Command {
  return (state, dispatch) => {
    const list = schema.nodes[listType]
    const listItem = schema.nodes.list_item
    const { $from } = state.selection

    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === list) {
        return liftListItem(listItem)(state, dispatch)
      }
    }

    return wrapInList(list, { tight: true })(state, dispatch)
  }
}

export function toggleBulletList(): Command {
  return toggleList('bullet_list')
}

export function toggleOrderedList(): Command {
  return toggleList('ordered_list')
}

function markTaskItems(tr: Transaction, from: number, to: number): Transaction {
  const listItem = schema.nodes.list_item
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type === listItem && node.attrs.checked == null) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: false })
    }
  })
  return tr
}

export function toggleTaskList(): Command {
  return (state, dispatch) => {
    const bullet = schema.nodes.bullet_list
    const listItem = schema.nodes.list_item
    const { $from, $to } = state.selection

    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type !== bullet) continue
      const item = $from.node(d + 1)
      if (item?.attrs.checked != null) return liftListItem(listItem)(state, dispatch)
      // A plain bullet item becomes a task in place rather than nesting a list.
      if (dispatch) dispatch(markTaskItems(state.tr, $from.before(d + 1), $to.after(d + 1)))
      return true
    }

    let wrapped: Transaction | null = null
    if (!wrapInList(bullet, { tight: true })(state, (tr) => (wrapped = tr))) return false
    if (!dispatch || !wrapped) return true
    const tr: Transaction = wrapped
    dispatch(markTaskItems(tr, tr.mapping.map($from.pos), tr.mapping.map($to.pos)).scrollIntoView())
    return true
  }
}

export function insertHorizontalRule(): Command {
  return (state, dispatch) => {
    const hr = schema.nodes.horizontal_rule
    const { $from } = state.selection
    if (!dispatch) return true
    const tr = state.tr.replaceSelectionWith(hr.create())
    dispatch(tr.scrollIntoView())
    return true
  }
}

export function insertCodeBlock(): Command {
  return (state, dispatch) => {
    const code = schema.nodes.code_block
    if (!dispatch) return true
    const tr = state.tr.replaceSelectionWith(code.create({ params: '' }))
    dispatch(tr.scrollIntoView())
    return true
  }
}

export function insertTable(rows: number, cols: number, headerRow = false): Command {
  return (state, dispatch) => {
    const {
      table,
      table_row,
      table_cell,
      table_header
    } = schema.nodes
    if (!table || !table_row || !table_cell) return false

    const rowNodes: ProseNode[] = []
    for (let r = 0; r < rows; r++) {
      const cells: ProseNode[] = []
      for (let c = 0; c < cols; c++) {
        const cellType = headerRow && r === 0 ? table_header : table_cell
        cells.push(cellType.create(null, schema.nodes.paragraph.create()))
      }
      rowNodes.push(table_row.create(null, cells))
    }

    if (!dispatch) return true
    const tr = state.tr.replaceSelectionWith(table.create(null, rowNodes))
    dispatch(tr.scrollIntoView())
    return true
  }
}

export function insertImage(attrs: {
  src: string
  alt?: string | null
  title?: string | null
  width?: string | null
  align?: string
}): Command {
  return (state, dispatch) => {
    const image = schema.nodes.image
    if (!dispatch) return true
    const node = image.create({
      src: attrs.src,
      alt: attrs.alt ?? null,
      title: attrs.title ?? null,
      width: attrs.width ?? null,
      align: attrs.align ?? 'none'
    })
    const tr = state.tr.replaceSelectionWith(node)
    dispatch(tr.scrollIntoView())
    return true
  }
}

export function insertFootnote(): Command {
  return (state, dispatch) => {
    const ref = schema.nodes.footnote_reference
    const def = schema.nodes.footnote_definition
    if (!ref || !def) return false
    const label = findFootnoteLabel(state.doc)
    if (!dispatch) return true
    const refNode = ref.create({ label })
    const defNode = def.create({ label }, schema.nodes.paragraph.create())
    const tr = state.tr.replaceSelectionWith(refNode)
    tr.insert(state.doc.content.size, defNode)
    dispatch(tr.scrollIntoView())
    return true
  }
}

export function insertMath(inline = true): Command {
  return (state, dispatch) => {
    const type = inline ? schema.nodes.math_inline : schema.nodes.math_block
    if (!type) return false
    if (!dispatch) return true
    const tr = state.tr.replaceSelectionWith(type.create({ latex: '' }))
    dispatch(tr.scrollIntoView())
    return true
  }
}

export function splitListItemCommand(): Command {
  return splitListItem(schema.nodes.list_item)
}

export function sinkListItemCommand(): Command {
  return sinkListItem(schema.nodes.list_item)
}

export function liftListItemCommand(): Command {
  return liftListItem(schema.nodes.list_item)
}

export function openImageDialog(): Command {
  return (_state, _dispatch, view) => {
    useUi.getState().openDialog('image', { view })
    return true
  }
}

export function openTableDialog(): Command {
  return (_state, _dispatch, view) => {
    useUi.getState().openDialog('table', { view })
    return true
  }
}

export function runEditorCommand(command: Command): void {
  dispatchCommand(command)
}

export function applyLinkMark(
  from: number,
  to: number,
  href: string,
  title: string | null,
  text?: string
): void {
  const view = activeView
  if (!view) return
  const link = schema.marks.link
  let tr = view.state.tr
  if (text !== undefined && text !== view.state.doc.textBetween(from, to, '')) {
    tr = tr.insertText(text, from, to)
    to = from + text.length
  }
  tr = tr.removeMark(from, to, link)
  if (href) {
    tr = tr.addMark(from, to, link.create({ href, title }))
  }
  view.dispatch(tr.scrollIntoView())
  view.focus()
}

export function updateImageNode(
  pos: number,
  attrs: Record<string, unknown>
): void {
  const view = activeView
  if (!view) return
  const tr = view.state.tr.setNodeMarkup(pos, undefined, attrs)
  view.dispatch(tr.scrollIntoView())
  view.focus()
}
