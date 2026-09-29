/**
 * ProseMirror → Markdown serialiser for Marki.
 * Extends prosemirror-markdown's MarkdownSerializer with GFM tables, footnotes,
 * task lists, math, raw HTML, images with alignment, and front matter.
 */

import { MarkdownSerializer, MarkdownSerializerState } from 'prosemirror-markdown'
import type { Mark, Node } from 'prosemirror-model'
import { joinFrontMatter } from './frontmatter'
import type { FrontMatter } from '@shared/types'

/**
 * `out`, `delim` and `inAutolink` are part of prosemirror-markdown's serialiser
 * state at runtime but are absent from its published types, and its constructor
 * is undeclared too. Both are unavoidable when extending the serialiser: the
 * table and footnote serialisers need the accumulated output, and the link mark
 * needs to know whether it is inside an autolink. Declared here once so no cast
 * is needed at the call sites.
 */
declare module 'prosemirror-markdown' {
  interface MarkdownSerializerState {
    out: string
    delim: string
    inAutolink: boolean | undefined
  }
}

type SerializerStateOptions = {
  tightLists?: boolean
  escapeExtraCharacters?: RegExp
  hardBreakNodeName?: string
}

const SerializerStateBase = MarkdownSerializerState as unknown as new (
  nodes: MarkdownSerializer['nodes'],
  marks: MarkdownSerializer['marks'],
  options: SerializerStateOptions
) => MarkdownSerializerState
export interface SerializeOptions {
  bullet?: '-' | '*' | '+'
  emphasis?: '_' | '*'
  strong?: '__' | '**'
  prettyTables?: boolean
  /** Hard-wrap paragraph text at this column. 0 leaves paragraphs on one line. */
  wrapColumn?: number
}

/** A line starting with one of these would be read back as a new block. */
const BLOCK_STARTER = /^(?:[-*+>#]|\d+[.)]|={2,}|-{2,}|`{3,}|~{3,}|\|)/

/**
 * Re-wraps rendered paragraph text at `width`. Breaks happen at spaces only, so
 * inline constructs stay intact, and never where the next line would start with
 * something markdown reads as a block marker.
 */
function wrapParagraph(text: string, width: number, delim: string): string {
  if (width <= 0 || text.length === 0) return text

  const limit = Math.max(1, width - delim.length)
  const lines: string[] = []
  let line = ''

  for (const word of text.split(' ')) {
    if (line.length === 0) {
      line = word
      continue
    }
    if (line.length + 1 + word.length <= limit && !BLOCK_STARTER.test(word)) {
      line += ' ' + word
      continue
    }
    if (BLOCK_STARTER.test(word)) {
      // Breaking here would turn the word into a list bullet or a heading.
      line += ' ' + word
      continue
    }
    lines.push(line)
    line = word
  }
  if (line.length > 0) lines.push(line)

  return lines.join('\n' + delim)
}

const footnoteDefs: { label: string; node: Node }[] = []

function backticksFor(node: Node, side: number) {
  let ticks = /`+/g
  let m: RegExpExecArray | null
  let len = 0
  if (node.isText) {
    while ((m = ticks.exec(node.text!))) len = Math.max(len, m[0].length)
  }
  let result = len > 0 && side > 0 ? ' `' : '`'
  for (let i = 0; i < len; i++) result += '`'
  if (len > 0 && side < 0) result += ' '
  return result
}

function isPlainURL(link: Mark, parent: Node, index: number) {
  if (link.attrs.title || !/^\w+:/.test(link.attrs.href)) return false
  const content = parent.child(index)
  if (!content.isText || content.text !== link.attrs.href || content.marks[content.marks.length - 1] !== link)
    return false
  return index === parent.childCount - 1 || !link.isInSet(parent.child(index + 1).marks)
}

function imageStyle(align: string): string {
  switch (align) {
    case 'float-right':
      return 'float: right'
    case 'left':
      return 'float: left'
    case 'center':
      return 'display: block; margin: 0 auto'
    case 'right':
      return 'display: block; margin-left: auto'
    default:
      return ''
  }
}

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|')
}

function alignmentDelimiter(align: string | null): string {
  switch (align) {
    case 'center':
      return ':---:'
    case 'right':
      return '---:'
    case 'left':
      return ':---'
    default:
      return '---'
  }
}

function stringWidth(str: string): number {
  return Array.from(str).length
}

function padCell(text: string, width: number): string {
  const w = stringWidth(text)
  if (w >= width) return text
  return text + ' '.repeat(width - w)
}

class MarkiSerializerState extends SerializerStateBase {
  inTable = false
  serializeOptions: SerializeOptions = {}
  private readonly serializer: MarkdownSerializer

  constructor(serializer: MarkdownSerializer, options: SerializerStateOptions = {}) {
    super(serializer.nodes, serializer.marks, options)
    this.serializer = serializer
  }

  serializeInlineFragment(parent: Node): string {
    const inner = new MarkiSerializerState(this.serializer, {
      tightLists: true,
      hardBreakNodeName: 'hard_break'
    })
    inner.serializeOptions = this.serializeOptions
    inner.inTable = this.inTable
    inner.renderInline(parent)
    return inner.out
  }

  serializeBlockFragment(parent: Node): string {
    const inner = new MarkiSerializerState(this.serializer, {
      tightLists: true,
      hardBreakNodeName: 'hard_break'
    })
    inner.serializeOptions = this.serializeOptions
    inner.renderContent(parent)
    return inner.out.trim()
  }

  override esc(str: string, startOfLine = false) {
    let result = str.replace(
      /[`*\\~\[\]_]/g,
      (m, _offset, full) => {
        const i = full.indexOf(m)
        if (m === '_' && i > 0 && i + 1 < full.length && /\w/.test(full[i - 1]) && /\w/.test(full[i + 1]))
          return m
        return '\\' + m
      }
    )
    if (startOfLine) {
      result = result
        .replace(/^(\+[ ]|[\-*>])/, '\\$&')
        .replace(/^(\s*)(#{1,6})(\s|$)/, '$1\\$2$3')
        .replace(/^(\s*\d+)\.\s/, '$1\\. ')
    }
    if (this.inTable) result = result.replace(/\|/g, '\\|')
    if (this.options.escapeExtraCharacters) {
      result = result.replace(this.options.escapeExtraCharacters, '\\$&')
    }
    return result
  }
}

function createSerializer(options: SerializeOptions): MarkdownSerializer {
  const bullet = options.bullet ?? '-'
  const emphasis = options.emphasis ?? '_'
  const strong = options.strong ?? '**'

  return new MarkdownSerializer(
    {
      front_matter() {},

      blockquote(state, node) {
        state.wrapBlock('> ', null, node, () => state.renderContent(node))
      },

      code_block(state, node) {
        const backticks = node.textContent.match(/`{3,}/gm)
        const fence = backticks ? backticks.sort().slice(-1)[0] + '`' : '```'
        state.write(fence + (node.attrs.params || '') + '\n')
        state.text(node.textContent, false)
        state.write('\n')
        state.write(fence)
        state.closeBlock(node)
      },

      heading(state, node) {
        state.write(state.repeat('#', node.attrs.level) + ' ')
        state.renderInline(node, false)
        state.closeBlock(node)
      },

      horizontal_rule(state, node) {
        state.write('---')
        state.closeBlock(node)
      },

      bullet_list(state, node) {
        const b = node.attrs.bullet || bullet
        state.renderList(node, '  ', () => b + ' ')
      },

      ordered_list(state, node) {
        const start = node.attrs.order ?? 1
        const maxW = String(start + node.childCount - 1).length
        const space = state.repeat(' ', maxW + 2)
        state.renderList(node, space, (i) => {
          const nStr = String(start + i)
          return state.repeat(' ', maxW - nStr.length) + nStr + '. '
        })
      },

      list_item(state, node) {
        if (node.attrs.checked !== null && node.attrs.checked !== undefined) {
          const checked = node.attrs.checked ? 'x' : ' '
          state.write(`[${checked}]`)
          state.text(' ', false)
          state.renderContent(node)
        } else {
          state.renderContent(node)
        }
      },

      paragraph(state, node) {
        const ms = state as MarkiSerializerState
        const wrapColumn = ms.serializeOptions.wrapColumn ?? 0
        const start = state.out.length
        state.renderInline(node)
        if (wrapColumn > 0) {
          const rendered = state.out.slice(start)
          state.out = state.out.slice(0, start) + wrapParagraph(rendered, wrapColumn, state.delim)
        }
        state.closeBlock(node)
      },

      image(state, node) {
        const { src, alt, title, width, align } = node.attrs
        const needsHtml =
          (width !== null && width !== undefined && width !== '') ||
          (align && align !== 'none')

        if (!needsHtml) {
          state.write(
            '![' +
              state.esc(alt || '') +
              '](' +
              String(src).replace(/[()]/g, '\\$&') +
              (title ? ' "' + String(title).replace(/"/g, '\\"') + '"' : '') +
              ')'
          )
        } else {
          const style = imageStyle(align ?? 'none')
          let tag = `<img src="${src}"`
          if (alt) tag += ` alt="${alt}"`
          if (title) tag += ` title="${title}"`
          if (width) tag += ` width="${width}"`
          if (style) tag += ` style="${style}"`
          tag += '>'
          state.write(tag)
        }
      },

      hard_break(state, node, parent, index) {
        for (let i = index + 1; i < parent.childCount; i++) {
          if (parent.child(i).type !== node.type) {
            state.write('\\\n')
            return
          }
        }
      },

      text(state, node) {
        state.text(node.text!, !state.inAutolink)
      },

      footnote_reference(state, node) {
        state.write(`[^${node.attrs.label}]`)
      },

      footnote_definition(state, node) {
        footnoteDefs.push({ label: node.attrs.label, node })
      },

      math_inline(state, node) {
        state.write('$' + node.attrs.latex + '$')
      },

      math_block(state, node) {
        state.write('$$\n' + node.attrs.latex + '\n$$')
        state.closeBlock(node)
      },

      html_block(state, node) {
        state.write(node.attrs.html)
        state.closeBlock(node)
      },

      table(state, node) {
        const ms = state as MarkiSerializerState
        const pretty = ms.serializeOptions.prettyTables ?? false
        ms.inTable = true

        const cellTexts: string[][] = []
        const alignments: (string | null)[] = []

        // ProseMirror's forEach yields (node, offset, index) — the second
        // argument is a document offset, not a column number.
        node.forEach((row, _rowOffset, rowIndex) => {
          const rowTexts: string[] = []
          row.forEach((cell, _cellOffset, colIndex) => {
            const para =
              cell.childCount === 1 && cell.firstChild?.type.name === 'paragraph'
                ? cell.firstChild!
                : cell
            rowTexts.push(ms.serializeInlineFragment(para))
            if (rowIndex === 0) alignments[colIndex] = cell.attrs.alignment ?? null
          })
          cellTexts.push(rowTexts)
        })

        if (!cellTexts.length || !cellTexts[0]?.length) {
          ms.inTable = false
          state.closeBlock(node)
          return
        }

        const colCount = cellTexts[0].length
        const colWidths: number[] = []
        for (let c = 0; c < colCount; c++) {
          let max = 3
          for (const row of cellTexts) {
            if (row[c]) max = Math.max(max, stringWidth(row[c]))
          }
          colWidths.push(max)
        }

        const formatRow = (cells: string[], isAlignRow = false) => {
          const parts = cells.map((cell, i) => {
            const content = isAlignRow ? cell : escapeTableCell(cell)
            if (pretty) return ' ' + padCell(content, colWidths[i]) + ' '
            return ' ' + content + ' '
          })
          state.write('|' + parts.join('|') + '|')
        }

        const hasHeader = node.child(0).child(0)?.type.name === 'table_header'

        formatRow(cellTexts[0])
        state.ensureNewLine()
        formatRow(
          hasHeader ? alignments.map((a) => alignmentDelimiter(a)) : alignments.map(() => '---'),
          true
        )
        for (let r = 1; r < cellTexts.length; r++) {
          state.ensureNewLine()
          formatRow(cellTexts[r])
        }

        ms.inTable = false
        state.closeBlock(node)
      },

      table_row() {},
      table_cell(state, node) {
        state.renderContent(node)
      },
      table_header(state, node) {
        state.renderContent(node)
      }
    },
    {
      em: { open: emphasis, close: emphasis, mixable: true, expelEnclosingWhitespace: true },
      strong: { open: strong, close: strong, mixable: true, expelEnclosingWhitespace: true },
      link: {
        open(state, mark, parent, index) {
          state.inAutolink = isPlainURL(mark, parent, index)
          return state.inAutolink ? '<' : '['
        },
        close(state, mark, parent, index) {
          const { inAutolink } = state
          state.inAutolink = undefined
          return inAutolink
            ? '>'
            : '](' +
                mark.attrs.href.replace(/[()"]/g, '\\$&') +
                (mark.attrs.title ? ` "${mark.attrs.title.replace(/"/g, '\\"')}"` : '') +
                ')'
        },
        mixable: true
      },
      code: {
        open(_state, _mark, parent, index) {
          return backticksFor(parent.child(index), -1)
        },
        close(_state, _mark, parent, index) {
          return backticksFor(parent.child(index - 1), 1)
        },
        escape: false
      },
      strikethrough: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
      html_inline: {
        open(_state, mark) {
          return String(mark.attrs.html)
        },
        close(_state, mark) {
          return String(mark.attrs.closeHtml ?? '')
        },
        escape: false
      }
    },
    { hardBreakNodeName: 'hard_break' }
  )
}

export function serializeMarkdown(doc: Node, options?: SerializeOptions): string {
  const opts: SerializeOptions = options ?? {}
  footnoteDefs.length = 0

  let frontMatter: FrontMatter | null = null
  const bodyChildren: Node[] = []

  doc.forEach((child) => {
    if (child.type.name === 'front_matter') {
      frontMatter = { format: child.attrs.format, raw: child.attrs.raw }
    } else if (child.type.name === 'footnote_definition') {
      footnoteDefs.push({ label: child.attrs.label, node: child })
    } else {
      bodyChildren.push(child)
    }
  })

  const serializer = createSerializer(opts)
  const bodyDoc = doc.type.create(null, bodyChildren)
  const state = new MarkiSerializerState(serializer, {
    tightLists: false,
    hardBreakNodeName: 'hard_break'
  })
  state.serializeOptions = opts
  state.renderContent(bodyDoc)

  let out = state.out

  if (footnoteDefs.length) {
    if (out && !out.endsWith('\n')) out += '\n'
    for (const def of footnoteDefs) {
      // Render the definition as a whole so its blocks keep their marks; then
      // indent every line after the first, which is what makes a continuation
      // line (or a second paragraph) part of the footnote.
      const [first = '', ...rest] = state.serializeBlockFragment(def.node).split('\n')
      const continuation = rest.map((line) => (line.length > 0 ? `    ${line}` : line))
      out += `\n[^${def.label}]: ${[first, ...continuation].join('\n')}\n`
    }
  }

  const bodyText = out.replace(/\n+$/, '')
  let result = joinFrontMatter(frontMatter, bodyText)
  if (!result.endsWith('\n')) result += '\n'
  return result
}
