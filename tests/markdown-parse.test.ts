import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '@/editor/markdown/parse'

describe('parseMarkdown structure', () => {
  it('parses task list items with checked state', () => {
    const doc = parseMarkdown('- [ ] Todo\n- [x] Done\n')
    const items: boolean[] = []
    doc.forEach((block) => {
      if (block.type.name === 'bullet_list') {
        block.forEach((item) => {
          if (item.attrs.checked !== null) items.push(item.attrs.checked)
        })
      }
    })
    expect(items).toEqual([false, true])
  })

  it('parses table cell alignment', () => {
    const doc = parseMarkdown('| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |\n')
    const alignments: (string | null)[] = []
    doc.forEach((block) => {
      if (block.type.name === 'table') {
        const row = block.child(0)
        row.forEach((cell) => alignments.push(cell.attrs.alignment))
      }
    })
    expect(alignments).toEqual(['left', 'center', 'right'])
  })

  it('places footnote definitions at doc level', () => {
    const doc = parseMarkdown('Ref[^note].\n\n[^note]: Definition text.\n')
    const defs = doc.content.content.filter((n) => n.type.name === 'footnote_definition')
    expect(defs).toHaveLength(1)
    expect(defs[0].attrs.label).toBe('note')
  })

  it('parses inline and block math latex', () => {
    const doc = parseMarkdown('Inline $E=mc^2$ here.\n\n$$\n\\int_0^1 x\\,dx\n$$\n')
    let inline = ''
    let block = ''
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') inline = node.attrs.latex
      if (node.type.name === 'math_block') block = node.attrs.latex
    })
    expect(inline).toBe('E=mc^2')
    expect(block).toBe('\\int_0^1 x\\,dx')
  })

  it('parses sized floated img tags', () => {
    const doc = parseMarkdown('<img src="pic.png" width="320" style="float: right" alt="diagram">\n')
    let image: { width: string | null; align: string } | null = null
    doc.descendants((node) => {
      if (node.type.name === 'image') {
        image = { width: node.attrs.width, align: node.attrs.align }
      }
    })
    expect(image).toEqual({ width: '320', align: 'float-right' })
  })
})
