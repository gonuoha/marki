import { schema } from '@/editor/markdown'
import { getFocusRange } from '@/editor/visual/plugins/focus'
import type { Node as ProseNode } from 'prosemirror-model'

function buildFocusTestDoc(): ProseNode {
  return schema.node('doc', null, [
    schema.node('heading', { level: 1 }, [schema.text('Welcome')]),
    schema.node('paragraph', null, [schema.text('Alpha one. Alpha two here.')]),
    schema.node('paragraph', null, [schema.text('Beta starts. Beta ends now.')]),
    schema.node('bullet_list', { bullet: '-', tight: false }, [
      schema.node('list_item', { checked: null }, [
        schema.node('paragraph', null, [schema.text('Gamma first. Gamma second.')])
      ]),
      schema.node('list_item', { checked: null }, [
        schema.node('paragraph', null, [
          schema.text('Line A.'),
          schema.node('hard_break'),
          schema.text('Line B.')
        ])
      ])
    ])
  ])
}

function posAtText(doc: ProseNode, needle: string): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text?.includes(needle)) return
    found = pos + node.text.indexOf(needle) + Math.floor(needle.length / 2)
    return false
  })
  if (found < 0) throw new Error(`Text not found: ${needle}`)
  return found
}

function textblockStartForNeedle(doc: ProseNode, needle: string): number {
  const pos = posAtText(doc, needle)
  const $pos = doc.resolve(pos)
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).isTextblock) return $pos.start(d)
  }
  throw new Error(`No textblock for: ${needle}`)
}

function textblockEndForNeedle(doc: ProseNode, needle: string): number {
  const pos = posAtText(doc, needle)
  const $pos = doc.resolve(pos)
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).isTextblock) return $pos.end(d)
  }
  throw new Error(`No textblock for: ${needle}`)
}

function expectRangeText(
  doc: ProseNode,
  mode: 'sentence' | 'line',
  needle: string,
  expected: string
): void {
  const pos = posAtText(doc, needle)
  const range = getFocusRange(mode, doc, pos)
  expect(range).not.toBeNull()
  expect(doc.textBetween(range!.from, range!.to)).toBe(expected)
}

describe('getFocusRange block-local mapping', () => {
  const doc = buildFocusTestDoc()

  it('highlights the correct sentence in the second paragraph', () => {
    expectRangeText(doc, 'sentence', 'Beta starts', 'Beta starts.')
  })

  it('highlights the correct sentence in the third paragraph block', () => {
    expectRangeText(doc, 'sentence', 'Beta ends', 'Beta ends now.')
  })

  it('highlights the correct sentence inside a nested list item', () => {
    expectRangeText(doc, 'sentence', 'Gamma second', 'Gamma second.')
  })

  it('highlights the correct line after a hard break within a block', () => {
    expectRangeText(doc, 'line', 'Line B', 'Line B.')
  })

  it('treats a textblock without hard breaks as one line', () => {
    expectRangeText(doc, 'line', 'Gamma first', 'Gamma first. Gamma second.')
  })

  it('maps correctly from the heading textblock', () => {
    expectRangeText(doc, 'sentence', 'Welcome', 'Welcome')
  })

  it('handles the caret at the very start of a block', () => {
    const blockStart = textblockStartForNeedle(doc, 'Beta starts')
    const range = getFocusRange('sentence', doc, blockStart)
    expect(range).not.toBeNull()
    expect(doc.textBetween(range!.from, range!.to)).toBe('Beta starts.')
  })

  it('handles the caret at the end of a block', () => {
    const blockEnd = textblockEndForNeedle(doc, 'Beta ends now.')
    const range = getFocusRange('sentence', doc, blockEnd)
    expect(range).not.toBeNull()
    expect(doc.textBetween(range!.from, range!.to)).toBe('Beta ends now.')
  })
})
