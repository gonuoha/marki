import { syntaxTree } from '@codemirror/language'
import { EditorSelection, type ChangeSpec, type EditorState, type Line } from '@codemirror/state'
import type { EditorView, KeyBinding } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import type { FormatCommand, FormatHandlers } from '@/editor/format-router'
import type { BlockKind, FormatSnapshot } from '@/state/format-store'
import { useSettings } from '@/state/settings-store'

type InlineKind = 'strong' | 'em' | 'strikethrough' | 'code'

/** Lezer markdown node names for each inline construct and its delimiters. */
const INLINE_NODES: Record<InlineKind, { node: string; mark: string }> = {
  strong: { node: 'StrongEmphasis', mark: 'EmphasisMark' },
  em: { node: 'Emphasis', mark: 'EmphasisMark' },
  strikethrough: { node: 'Strikethrough', mark: 'StrikethroughMark' },
  code: { node: 'InlineCode', mark: 'CodeMark' }
}

const HEADING_RE = /^(#{1,6})\s+/
const QUOTE_RE = /^(\s*)>\s?/
const LIST_RE = /^(\s*)([-+*]|\d+[.)])\s+(\[[ xX]\]\s+)?/

type ListKind = 'bullet' | 'ordered' | 'task'

function delimiterFor(kind: InlineKind): string {
  const { markdown } = useSettings.getState().settings
  if (kind === 'strong') return markdown.strong
  if (kind === 'em') return markdown.emphasis
  if (kind === 'strikethrough') return '~~'
  return '`'
}

function ancestorNamed(state: EditorState, pos: number, name: string): SyntaxNode | null {
  const tree = syntaxTree(state)
  for (const side of [-1, 1] as const) {
    for (let node: SyntaxNode | null = tree.resolveInner(pos, side); node; node = node.parent) {
      if (node.name === name) return node
    }
  }
  return null
}

function toggleInline(view: EditorView, kind: InlineKind): void {
  const { state } = view
  const range = state.selection.main
  const { node: nodeName, mark: markName } = INLINE_NODES[kind]
  const node = ancestorNamed(state, range.from, nodeName)

  if (node && node.to >= range.to) {
    const marks = node.getChildren(markName)
    if (marks.length >= 2) {
      const open = marks[0]
      const close = marks[marks.length - 1]
      view.dispatch({
        changes: [
          { from: open.from, to: open.to },
          { from: close.from, to: close.to }
        ],
        userEvent: 'input.format'
      })
      view.focus()
      return
    }
  }

  wrapSelection(view, delimiterFor(kind))
}

function wrapSelection(view: EditorView, delimiter: string): void {
  view.dispatch(
    view.state.changeByRange((range) => ({
      changes: [
        { from: range.from, insert: delimiter },
        { from: range.to, insert: delimiter }
      ],
      range: EditorSelection.range(range.from + delimiter.length, range.to + delimiter.length)
    })),
    { userEvent: 'input.format' }
  )
  view.focus()
}

/** Replaces the selection and selects `select` within the inserted text. */
function insertTemplate(view: EditorView, text: string, select?: [number, number]): void {
  const range = view.state.selection.main
  const [start, end] = select ?? [text.length, text.length]
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: EditorSelection.range(range.from + start, range.from + end),
    userEvent: 'input.format'
  })
  view.focus()
}

function insertLink(view: EditorView, image: boolean): void {
  const { state } = view
  const range = state.selection.main
  const selected = state.sliceDoc(range.from, range.to)
  const bang = image ? '!' : ''

  if (/^(https?:\/\/|\.{0,2}\/)\S+$/.test(selected)) {
    const text = `${bang}[](${selected})`
    insertTemplate(view, text, [bang.length + 1, bang.length + 1])
    return
  }

  const label = selected || (image ? 'alt text' : 'link text')
  const target = image ? 'image.png' : 'https://'
  const text = `${bang}[${label}](${target})`
  const targetStart = bang.length + label.length + 3
  insertTemplate(view, text, [targetStart, targetStart + target.length])
}

/**
 * Puts `block` on lines of its own after the caret's line, or in place of the
 * caret's line when that line is blank, with blank lines around it.
 */
function insertBlock(view: EditorView, block: string, caret: number): void {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const blank = line.text.trim() === ''
  const from = blank ? line.from : line.to
  const before = blank ? '' : '\n\n'
  const atEnd = line.to >= state.doc.length
  const nextBlank = !atEnd && state.doc.line(line.number + 1).text.trim() === ''
  const after = atEnd ? '\n' : nextBlank ? '' : '\n'
  const insert = before + block + after
  view.dispatch({
    changes: { from, to: line.to, insert },
    selection: EditorSelection.cursor(from + before.length + caret),
    scrollIntoView: true,
    userEvent: 'input.format'
  })
  view.focus()
}

function selectedLines(state: EditorState): Line[] {
  const range = state.selection.main
  const first = state.doc.lineAt(range.from).number
  // A selection ending at column 0 does not really include that line.
  let last = state.doc.lineAt(range.to).number
  if (last > first && state.doc.lineAt(range.to).from === range.to) last--
  const lines: Line[] = []
  for (let n = first; n <= last; n++) lines.push(state.doc.line(n))
  return lines
}

function applyLineChanges(view: EditorView, changes: ChangeSpec[]): void {
  const { state } = view
  const changeSet = state.changes(changes)
  view.dispatch({
    changes: changeSet,
    selection: state.selection.map(changeSet, 1),
    userEvent: 'input.format'
  })
  view.focus()
}

function listKindOf(text: string): ListKind | null {
  const match = LIST_RE.exec(text.replace(QUOTE_RE, ''))
  if (!match) return null
  if (/\d/.test(match[2])) return 'ordered'
  return match[3] ? 'task' : 'bullet'
}

function toggleList(view: EditorView, kind: ListKind): void {
  const lines = selectedLines(view.state)
  const content = lines.filter((line) => line.text.trim() !== '')
  const targets = content.length > 0 ? content : lines
  const remove = targets.every((line) => listKindOf(line.text) === kind)
  const bullet = useSettings.getState().settings.markdown.bullet

  const changes = targets.map((line, index) => {
    const match = LIST_RE.exec(line.text)
    const indent = /^\s*/.exec(line.text)?.[0] ?? ''
    const heading = match ? null : HEADING_RE.exec(line.text.slice(indent.length))
    const marker =
      kind === 'ordered' ? `${index + 1}. ` : kind === 'task' ? `${bullet} [ ] ` : `${bullet} `
    return {
      from: line.from,
      to: line.from + (match ? match[0].length : indent.length + (heading?.[0].length ?? 0)),
      insert: remove ? indent : indent + marker
    }
  })
  applyLineChanges(view, changes)
}

function toggleQuote(view: EditorView): void {
  const lines = selectedLines(view.state)
  const remove = lines.every((line) => QUOTE_RE.test(line.text) || line.text.trim() === '')
  const changes = lines.map((line) => {
    const match = QUOTE_RE.exec(line.text)
    if (remove) return match ? { from: line.from, to: line.from + match[0].length } : { from: line.from }
    return { from: line.from, insert: '> ' }
  })
  applyLineChanges(view, changes)
}

function setHeading(view: EditorView, level: number): void {
  const changes = selectedLines(view.state).map((line) => {
    const match = HEADING_RE.exec(line.text) ?? (level > 0 ? LIST_RE.exec(line.text) : null)
    return {
      from: line.from,
      to: line.from + (match ? match[0].length : 0),
      insert: level > 0 ? `${'#'.repeat(level)} ` : ''
    }
  })
  applyLineChanges(view, changes)
}

function insertCodeBlock(view: EditorView): void {
  const { state } = view
  const range = state.selection.main
  if (range.empty) {
    insertBlock(view, '```\n\n```', 4)
    return
  }
  const lines = selectedLines(state)
  const first = lines[0]
  const last = lines[lines.length - 1]
  applyLineChanges(view, [
    { from: first.from, insert: '```\n' },
    { from: last.to, insert: '\n```' }
  ])
}

function insertFootnote(view: EditorView): void {
  const { state } = view
  const text = state.doc.toString()
  const labels = new Set([...text.matchAll(/\[\^([^\]\s]+)\]/g)].map((m) => m[1]))
  let n = 1
  while (labels.has(String(n))) n++
  const label = String(n)

  const cursor = state.selection.main.to
  const end = state.doc.length
  const separator = text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n'
  const definition = `${separator}[^${label}]: `
  const reference = `[^${label}]`
  view.dispatch({
    changes: [
      { from: cursor, insert: reference },
      { from: end, insert: definition }
    ],
    selection: EditorSelection.cursor(end + reference.length + definition.length),
    scrollIntoView: true,
    userEvent: 'input.format'
  })
  view.focus()
}

const TABLE_TEMPLATE = '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |'

export function createSourceFormatHandlers(getView: () => EditorView | null): FormatHandlers {
  const run = (fn: (view: EditorView) => void) => () => {
    const view = getView()
    if (view) fn(view)
  }

  return {
    'format.bold': run((view) => toggleInline(view, 'strong')),
    'format.italic': run((view) => toggleInline(view, 'em')),
    'format.strikethrough': run((view) => toggleInline(view, 'strikethrough')),
    'format.code': run((view) => toggleInline(view, 'code')),
    'format.link': run((view) => insertLink(view, false)),
    'format.image': run((view) => insertLink(view, true)),
    'format.table': run((view) => insertBlock(view, TABLE_TEMPLATE, 2)),
    'format.codeBlock': run(insertCodeBlock),
    'format.quote': run(toggleQuote),
    'format.bulletList': run((view) => toggleList(view, 'bullet')),
    'format.orderedList': run((view) => toggleList(view, 'ordered')),
    'format.taskList': run((view) => toggleList(view, 'task')),
    'format.footnote': run(insertFootnote),
    'format.math': run((view) => wrapSelection(view, '$')),
    'format.horizontalRule': run((view) => insertBlock(view, '---', 3)),
    'format.heading1': run((view) => setHeading(view, 1)),
    'format.heading2': run((view) => setHeading(view, 2)),
    'format.heading3': run((view) => setHeading(view, 3)),
    'format.heading4': run((view) => setHeading(view, 4)),
    'format.heading5': run((view) => setHeading(view, 5)),
    'format.heading6': run((view) => setHeading(view, 6)),
    'format.paragraph': run((view) => setHeading(view, 0))
  }
}

/**
 * The format shortcuts, bound ahead of CodeMirror's defaults: several of them
 * (Mod-I, Mod-Shift-K, Mod-Shift-L) otherwise select or delete text.
 */
export function sourceFormatKeymap(handlers: FormatHandlers): KeyBinding[] {
  const bind = (key: string, id: FormatCommand): KeyBinding => ({
    key,
    preventDefault: true,
    run: () => {
      handlers[id]()
      return true
    }
  })
  return [
    bind('Mod-b', 'format.bold'),
    bind('Mod-i', 'format.italic'),
    bind('Mod-Shift-x', 'format.strikethrough'),
    bind('Mod-e', 'format.code'),
    bind('Mod-Shift-k', 'format.link'),
    bind('Mod-Shift-i', 'format.image'),
    bind('Mod-Alt-t', 'format.table'),
    bind('Mod-Shift-c', 'format.codeBlock'),
    bind('Mod-Shift-.', 'format.quote'),
    bind('Mod-Shift-8', 'format.bulletList'),
    bind('Mod-Shift-7', 'format.orderedList'),
    bind('Mod-Shift-9', 'format.taskList'),
    bind('Mod-Shift-m', 'format.math'),
    bind('Mod-Shift-l', 'format.horizontalRule'),
    bind('Mod-1', 'format.heading1'),
    bind('Mod-2', 'format.heading2'),
    bind('Mod-3', 'format.heading3'),
    bind('Mod-4', 'format.heading4'),
    bind('Mod-5', 'format.heading5'),
    bind('Mod-6', 'format.heading6'),
    bind('Mod-0', 'format.paragraph')
  ]
}

export function sourceFormatSnapshot(state: EditorState): FormatSnapshot {
  const head = state.selection.main.head
  const text = state.doc.lineAt(head).text
  const heading = HEADING_RE.exec(text)

  let block: BlockKind = 'paragraph'
  if (heading) block = `heading${heading[1].length}` as BlockKind
  else if (ancestorNamed(state, head, 'FencedCode')) block = 'codeBlock'

  const list = listKindOf(text)
  const inside = (kind: InlineKind) => ancestorNamed(state, head, INLINE_NODES[kind].node) !== null

  return {
    block,
    strong: inside('strong'),
    em: inside('em'),
    strikethrough: inside('strikethrough'),
    code: inside('code'),
    link: ancestorNamed(state, head, 'Link') !== null,
    bulletList: list === 'bullet',
    orderedList: list === 'ordered',
    taskList: list === 'task',
    quote: QUOTE_RE.test(text)
  }
}
