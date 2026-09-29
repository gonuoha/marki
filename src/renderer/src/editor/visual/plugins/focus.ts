import { findSentenceRange } from '@/lib/sentences'
import { useSettings } from '@/state/settings-store'
import type { FocusMode } from '@shared/types'
import type { Node as ProseNode } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

const focusKey = new PluginKey<{ deco: DecorationSet; rangeKey: string }>('markiFocus')

const BLOCK_TYPES = new Set([
  'code_block',
  'image',
  'table',
  'math_block',
  'html_block',
  'front_matter'
])

function getTextblockContext(
  doc: ProseNode,
  pos: number
): { blockStart: number; blockEnd: number; blockText: string } | null {
  const $pos = doc.resolve(Math.max(1, Math.min(pos, doc.content.size)))
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (node.isTextblock) {
      const blockStart = $pos.start(d)
      const blockEnd = $pos.end(d)
      const blockText = doc.textBetween(blockStart, blockEnd, '\n', '\n')
      return { blockStart, blockEnd, blockText }
    }
  }
  return null
}

function walkTextblockContent(
  doc: ProseNode,
  blockStart: number,
  blockEnd: number,
  visitor: (node: ProseNode, pos: number) => false | void
): void {
  doc.descendants((node, pos) => {
    if (pos < blockStart) return
    if (pos >= blockEnd) return false
    const stop = visitor(node, pos)
    if (stop === false) return false
  })
}

function blockLocalOffset(
  doc: ProseNode,
  blockStart: number,
  blockEnd: number,
  pos: number
): number {
  let offset = 0
  walkTextblockContent(doc, blockStart, blockEnd, (node, nodePos) => {
    if (node.isText && node.text) {
      const len = node.text.length
      if (pos <= nodePos + len) {
        offset += Math.max(0, pos - nodePos)
        return false
      }
      offset += len
      return
    }
    if (node.type.name === 'hard_break') {
      if (pos <= nodePos + 1) return false
      offset += 1
    }
  })
  return offset
}

function mapBlockTextRangeToDoc(
  doc: ProseNode,
  blockStart: number,
  blockEnd: number,
  start: number,
  end: number
): { from: number; to: number } {
  let textOffset = 0
  let from = blockEnd
  let to = blockEnd

  walkTextblockContent(doc, blockStart, blockEnd, (node, pos) => {
    if (node.isText && node.text) {
      const len = node.text.length
      if (from === blockEnd && start < textOffset + len) {
        from = pos + (start - textOffset)
      }
      if (to === blockEnd && end <= textOffset + len) {
        to = pos + (end - textOffset)
      }
      textOffset += len
      return
    }
    if (node.type.name === 'hard_break') {
      if (from === blockEnd && start <= textOffset) from = pos
      if (to === blockEnd && end <= textOffset + 1) to = pos + 1
      textOffset += 1
    }
  })

  return { from, to }
}

export function getFocusRange(
  mode: FocusMode,
  doc: ProseNode,
  pos: number
): { from: number; to: number } | null {
  if (mode === 'off') return null

  if (mode === 'paragraph') {
    return getParagraphRange(doc, pos)
  }

  const block = getTextblockContext(doc, pos)
  if (!block) return null

  const { blockStart, blockEnd, blockText } = block
  const localOffset = blockLocalOffset(doc, blockStart, blockEnd, pos)

  if (mode === 'sentence') {
    const { start, end } = findSentenceRange(blockText, localOffset)
    return mapBlockTextRangeToDoc(doc, blockStart, blockEnd, start, end)
  }

  const lineStart = blockText.lastIndexOf('\n', Math.max(0, localOffset - 1)) + 1
  const nextBreak = blockText.indexOf('\n', localOffset)
  const lineEnd = nextBreak === -1 ? blockText.length : nextBreak
  return mapBlockTextRangeToDoc(doc, blockStart, blockEnd, lineStart, lineEnd)
}

function getParagraphRange(doc: ProseNode, pos: number): { from: number; to: number } {
  const $pos = doc.resolve(Math.max(1, Math.min(pos, doc.content.size)))
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (node.isBlock) {
      return { from: $pos.start(d), to: $pos.end(d) }
    }
  }
  return { from: $pos.start($pos.depth), to: $pos.end($pos.depth) }
}

function buildDecorations(
  doc: ProseNode,
  focus: { from: number; to: number },
  dimBlocks: boolean
): DecorationSet {
  const decos: Decoration[] = []

  decos.push(
    Decoration.inline(focus.from, focus.to, { class: 'marki-focus-inline' }, { inclusiveStart: true, inclusiveEnd: true })
  )

  const dimRange = (from: number, to: number) => {
    if (to <= from) return
    if (to <= focus.from || from >= focus.to) {
      decos.push(
        Decoration.inline(from, to, { class: 'marki-dim' }, { inclusiveStart: true, inclusiveEnd: true })
      )
      return
    }
    if (from < focus.from) dimRange(from, Math.min(to, focus.from))
    if (to > focus.to) dimRange(Math.max(from, focus.to), to)
  }

  doc.descendants((node, pos) => {
    if (node.isText) {
      dimRange(pos, pos + node.nodeSize)
      return false
    }
    if (node.isBlock && node.type.name !== 'doc') {
      const from = pos
      const to = pos + node.nodeSize
      const overlaps = to > focus.from && from < focus.to
      if (!overlaps && dimBlocks && BLOCK_TYPES.has(node.type.name)) {
        decos.push(Decoration.node(from, to, { class: 'marki-dim' }))
      }
    }
    return undefined
  })

  return DecorationSet.create(doc, decos)
}

export function focusPlugin(): Plugin {
  let settingsUnsub = () => {}

  return new Plugin({
    key: focusKey,
    state: {
      init() {
        return { deco: DecorationSet.empty, rangeKey: 'off' }
      },
      apply(tr, pluginState, oldState, newState) {
        const force = Boolean(tr.getMeta(focusKey)?.refresh)
        const { mode, dimBlocks } = useSettings.getState().settings.editor.focus
        if (mode === 'off') return { deco: DecorationSet.empty, rangeKey: 'off' }

        const range = getFocusRange(mode, newState.doc, newState.selection.from)
        if (!range) return { deco: DecorationSet.empty, rangeKey: 'off' }

        const rangeKey = `${mode}:${range.from}:${range.to}:${dimBlocks}`
        if (
          !force &&
          rangeKey === pluginState.rangeKey &&
          !tr.docChanged &&
          tr.selection.eq(oldState.selection)
        ) {
          return pluginState
        }

        return {
          rangeKey,
          deco: buildDecorations(newState.doc, range, dimBlocks)
        }
      }
    },
    props: {
      decorations(state) {
        return focusKey.getState(state)?.deco ?? DecorationSet.empty
      }
    },
    view(view) {
      settingsUnsub = useSettings.subscribe((state, prev) => {
        const next = state.settings.editor.focus
        const before = prev.settings.editor.focus
        if (
          next.mode !== before.mode ||
          next.dimOpacity !== before.dimOpacity ||
          next.dimBlocks !== before.dimBlocks
        ) {
          view.dispatch(view.state.tr.setMeta(focusKey, { refresh: true }))
        }
      })
      return {
        destroy() {
          settingsUnsub()
        }
      }
    }
  })
}
