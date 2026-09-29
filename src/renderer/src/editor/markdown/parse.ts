/**
 * Markdown → ProseMirror parser for Marki.
 * Builds on prosemirror-markdown's MarkdownParser with markdown-it (GFM tables,
 * strikethrough, footnotes, task lists) plus custom math rules and front matter.
 */

import MarkdownIt from 'markdown-it'
import footnotePlugin from 'markdown-it-footnote'
import taskListsPlugin from 'markdown-it-task-lists'
import type Token from 'markdown-it/lib/token.mjs'
import { MarkdownParser, type ParseSpec } from 'prosemirror-markdown'
import { Mark, type Attrs, type Node, type NodeType } from 'prosemirror-model'
import { schema } from './schema'
import { splitFrontMatter } from './frontmatter'

function maybeMerge(a: Node, b: Node): Node | undefined {
  if (a.isText && b.isText && Mark.sameSet(a.marks, b.marks)) {
    return schema.text(a.text! + b.text!, a.marks)
  }
}

class MarkdownParseState {
  stack: { type: NodeType; attrs: Attrs | null; content: Node[]; marks: readonly Mark[] }[]
  readonly tokenHandlers: Record<
    string,
    (stat: MarkdownParseState, token: Token, tokens: Token[], i: number) => void
  >

  constructor(
    tokenHandlers: Record<
      string,
      (stat: MarkdownParseState, token: Token, tokens: Token[], i: number) => void
    >
  ) {
    this.tokenHandlers = tokenHandlers
    this.stack = [{ type: schema.topNodeType, attrs: null, content: [], marks: Mark.none }]
  }

  top() {
    return this.stack[this.stack.length - 1]
  }

  push(elt: Node) {
    if (this.stack.length) this.top().content.push(elt)
  }

  addText(text: string) {
    if (!text) return
    const top = this.top()
    const nodes = top.content
    const last = nodes[nodes.length - 1]
    const node = schema.text(text, top.marks)
    const merged = last ? maybeMerge(last, node) : undefined
    if (merged) nodes[nodes.length - 1] = merged
    else nodes.push(node)
  }

  openMark(mark: Mark) {
    const top = this.top()
    top.marks = mark.addToSet(top.marks)
  }

  closeMark(markType: Mark['type']) {
    const top = this.top()
    top.marks = markType.removeFromSet(top.marks)
  }

  parseTokens(toks: Token[]) {
    for (let i = 0; i < toks.length; i++) {
      const tok = toks[i]
      const handler = this.tokenHandlers[tok.type]
      if (!handler) continue
      handler(this, tok, toks, i)
    }
  }

  addNode(type: NodeType, attrs: Attrs | null, content?: readonly Node[]) {
    const top = this.top()
    const node = type.createAndFill(attrs, content, top ? top.marks : [])
    if (!node) return null
    this.push(node)
    return node
  }

  openNode(type: NodeType, attrs: Attrs | null) {
    this.stack.push({ type, attrs, content: [], marks: Mark.none })
  }

  closeNode() {
    const info = this.stack.pop()!
    return this.addNode(info.type, info.attrs, info.content)
  }
}

function attrs(spec: ParseSpec, token: Token, tokens: Token[], i: number): Attrs | null {
  if (spec.getAttrs) return spec.getAttrs(token, tokens, i)
  if (spec.attrs instanceof Function) return spec.attrs(token)
  return spec.attrs ?? null
}

function noCloseToken(spec: ParseSpec, type: string) {
  return spec.noCloseToken || type === 'code_inline' || type === 'code_block' || type === 'fence'
}

function withoutTrailingNewline(str: string) {
  return str.endsWith('\n') ? str.slice(0, -1) : str
}

function noOp() {}

function listIsTight(tokens: readonly Token[], i: number) {
  let j = i
  while (++j < tokens.length) {
    if (tokens[j].type !== 'list_item_open') return tokens[j].hidden
  }
  return false
}

function listItemIsTask(tokens: Token[], i: number): boolean {
  const open = tokens[i]
  const classIdx = open.attrIndex('class')
  if (classIdx >= 0) {
    const cls = open.attrs![classIdx][1]
    if (cls.includes('task-list-item')) return true
  }
  return false
}

function taskCheckedFromTokens(tokens: Token[], itemOpenIndex: number): boolean | null {
  if (!listItemIsTask(tokens, itemOpenIndex)) return null
  for (let j = itemOpenIndex + 1; j < tokens.length; j++) {
    const tok = tokens[j]
    if (tok.type === 'list_item_close') break
    if (tok.type === 'inline' && tok.children) {
      for (const child of tok.children) {
        if (child.type === 'html_inline' && child.content.includes('task-list-item-checkbox')) {
          return child.content.includes('checked')
        }
      }
    }
  }
  return false
}

function parseImgTag(html: string): Attrs | null {
  const match = html.match(/^<img\s+([^>]+)>/i)
  if (!match) return null
  const attrStr = match[1]
  const getAttr = (name: string): string | null => {
    const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
    const m = attrStr.match(re)
    if (!m) return null
    return m[1] ?? m[2] ?? m[3] ?? null
  }
  const src = getAttr('src')
  if (!src) return null
  const style = getAttr('style') ?? ''
  let align: string = 'none'
  if (/float:\s*right/i.test(style)) align = 'float-right'
  else if (/margin:\s*0\s+auto/i.test(style)) align = 'center'
  else if (/float:\s*left/i.test(style)) align = 'left'

  return {
    src,
    alt: getAttr('alt'),
    title: getAttr('title'),
    width: getAttr('width'),
    align
  }
}

function tryMergeHtmlTokens(tokens: Token[], start: number): { html: string; end: number } | null {
  const open = tokens[start]
  if (open.type !== 'html_inline') return null
  const openMatch = open.content.match(/^<([a-zA-Z][\w-]*)\b[^>]*>$/)
  if (!openMatch) return null
  const tag = openMatch[1]
  const closeTag = `</${tag}>`
  let inner = ''
  let i = start + 1
  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok.type === 'html_inline' && tok.content === closeTag) {
      return { html: open.content + inner + closeTag, end: i }
    }
    if (tok.type === 'text') {
      inner += tok.content
      i++
      continue
    }
    break
  }
  return null
}

function parseInlineContent(state: MarkdownParseState, tokens: Token[]) {
  let trimLeadingSpace = false
  for (let i = 0; i < tokens.length; i++) {
    const merged = tryMergeHtmlTokens(tokens, i)
    if (merged) {
      const paired = merged.html.match(/^<([a-zA-Z][\w-]*)[^>]*>([\s\S]*)<\/\1>$/)
      if (paired && paired[2]) {
        const openTag = merged.html.slice(0, merged.html.indexOf('>') + 1)
        state.openMark(
          schema.marks.html_inline.create({ html: openTag, closeHtml: `</${paired[1]}>` })
        )
        state.addText(paired[2])
        state.closeMark(schema.marks.html_inline)
      } else {
        emitHtmlSnippet(state, merged.html)
      }
      i = merged.end
      continue
    }
    const tok = tokens[i]
    if (tok.type === 'html_inline' && tok.content.includes('task-list-item-checkbox')) {
      trimLeadingSpace = true
      continue
    }
    if (tok.type === 'text' && trimLeadingSpace) {
      trimLeadingSpace = false
      state.addText(tok.content.replace(/^\s/, ''))
      continue
    }
    trimLeadingSpace = false
    const handler = state.tokenHandlers[tok.type]
    if (handler) handler(state, tok, tokens, i)
  }
}

function buildTokenHandlers(
  tokens: Record<string, ParseSpec>
): Record<string, (stat: MarkdownParseState, token: Token, tokens: Token[], i: number) => void> {
  const handlers: Record<string, (stat: MarkdownParseState, token: Token, tokens: Token[], i: number) => void> =
    Object.create(null)

  for (const type in tokens) {
    const spec = tokens[type]
    if (spec.block) {
      const nodeType = schema.nodes[spec.block]
      if (noCloseToken(spec, type)) {
        handlers[type] = (state, tok, toks, idx) => {
          state.openNode(nodeType, attrs(spec, tok, toks, idx))
          state.addText(withoutTrailingNewline(tok.content))
          state.closeNode()
        }
      } else {
        handlers[type + '_open'] = (state, tok, toks, idx) =>
          state.openNode(nodeType, attrs(spec, tok, toks, idx))
        handlers[type + '_close'] = (state) => state.closeNode()
      }
    } else if (spec.node) {
      const nodeType = schema.nodes[spec.node]
      handlers[type] = (state, tok, toks, idx) => state.addNode(nodeType, attrs(spec, tok, toks, idx))
    } else if (spec.mark) {
      const markType = schema.marks[spec.mark]
      if (noCloseToken(spec, type)) {
        handlers[type] = (state, tok, toks, idx) => {
          state.openMark(markType.create(attrs(spec, tok, toks, idx)))
          state.addText(withoutTrailingNewline(tok.content))
          state.closeMark(markType)
        }
      } else {
        handlers[type + '_open'] = (state, tok, toks, idx) =>
          state.openMark(markType.create(attrs(spec, tok, toks, idx)))
        handlers[type + '_close'] = (state) => state.closeMark(markType)
      }
    } else if (spec.ignore) {
      if (noCloseToken(spec, type)) handlers[type] = noOp
      else {
        handlers[type + '_open'] = noOp
        handlers[type + '_close'] = noOp
      }
    }
  }

  handlers.text = (state, tok) => state.addText(tok.content)
  handlers.inline = (state, tok) => parseInlineContent(state, tok.children ?? [])
  // A soft line break carries no meaning in markdown, so it becomes a space and
  // the paragraph reflows to the width of the editor. Keeping the newline would
  // show the author's wrap points as hard line breaks, because the editor needs
  // `white-space: pre-wrap`. Saving can re-wrap via `markdown.wrapColumn`.
  handlers.softbreak = (state) => state.addText(' ')

  return handlers
}

function tableCellAlignment(tok: Token): 'left' | 'center' | 'right' | null {
  const align = tok.attrGet('align')
  if (align === 'left' || align === 'center' || align === 'right') return align
  const style = tok.attrGet('style') ?? ''
  const match = /text-align:\s*(left|center|right)/i.exec(style)
  if (match) return match[1] as 'left' | 'center' | 'right'
  return null
}

/**
 * Inline HTML with no text to attach to — a void tag like `<br>`, or an unpaired
 * fragment. Marks cannot exist over an empty range, so the snippet is kept as
 * literal text. Markdown does not escape `<`, so it round-trips byte for byte
 * and re-parses to the same thing.
 */
function emitHtmlSnippet(state: MarkdownParseState, html: string) {
  state.addText(html)
}

const tokenSpecs: Record<string, ParseSpec> = {
  blockquote: { block: 'blockquote' },
  paragraph: { block: 'paragraph' },
  list_item: {
    block: 'list_item',
    getAttrs(_tok, tokens, i) {
      return { checked: taskCheckedFromTokens(tokens, i) }
    }
  },
  bullet_list: {
    block: 'bullet_list',
    getAttrs(tok, tokens, i) {
      const marker = tok.markup || '-'
      return { tight: listIsTight(tokens, i), bullet: marker }
    }
  },
  ordered_list: {
    block: 'ordered_list',
    getAttrs(tok, tokens, i) {
      return {
        order: +(tok.attrGet('start') ?? '1') || 1,
        tight: listIsTight(tokens, i)
      }
    }
  },
  heading: {
    block: 'heading',
    getAttrs(tok) {
      return { level: +tok.tag.slice(1) }
    }
  },
  code_block: { block: 'code_block', noCloseToken: true },
  fence: {
    block: 'code_block',
    getAttrs(tok) {
      return { params: tok.info || '' }
    },
    noCloseToken: true
  },
  hr: { node: 'horizontal_rule' },
  image: {
    node: 'image',
    getAttrs(tok) {
      return {
        src: tok.attrGet('src'),
        title: tok.attrGet('title') || null,
        alt: tok.children?.[0]?.content || null,
        width: null,
        align: 'none'
      }
    }
  },
  hardbreak: { node: 'hard_break' },

  em: { mark: 'em' },
  strong: { mark: 'strong' },
  s: { mark: 'strikethrough' },
  link: {
    mark: 'link',
    getAttrs(tok) {
      return {
        href: tok.attrGet('href'),
        title: tok.attrGet('title') || null
      }
    }
  },
  code_inline: { mark: 'code', noCloseToken: true },

  footnote_ref: {
    node: 'footnote_reference',
    getAttrs(tok) {
      const label = tok.meta?.label as string | undefined
      const id = tok.meta?.id as number | undefined
      return { label: label ?? String((id ?? 0) + 1) }
    }
  },

  footnote_block_open: { ignore: true },
  footnote_block_close: { ignore: true },
  footnote_open: { ignore: true },
  footnote_close: { ignore: true },
  footnote_anchor: { ignore: true },

  math_inline: {
    node: 'math_inline',
    getAttrs(tok) {
      return { latex: tok.content }
    }
  },
  math_block: {
    node: 'math_block',
    getAttrs(tok) {
      return { latex: withoutTrailingNewline(tok.content) }
    }
  },

  html_block: {
    node: 'html_block',
    getAttrs(tok) {
      return { html: tok.content }
    },
    noCloseToken: true
  },
  html_inline: {
    mark: 'html_inline',
    getAttrs(tok) {
      return { html: tok.content }
    },
    noCloseToken: true
  },

  table: { block: 'table' },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: 'table_row' },
  th: { ignore: true },
  td: { ignore: true }
}

function createMarkdownIt(): MarkdownIt {
  const md = MarkdownIt('commonmark', { html: true, linkify: true, breaks: false })
    .enable(['table', 'strikethrough'])
    .use(footnotePlugin)
    .use(taskListsPlugin)

  md.inline.ruler.before('escape', 'math_inline', (state, silent) => {
    const start = state.pos
    if (state.src.charCodeAt(start) !== 0x24) return false
    if (state.src.charCodeAt(start + 1) === 0x24) return false
    if (start > 0 && /\d/.test(state.src[start - 1])) return false

    let pos = start + 1
    while (pos < state.posMax) {
      if (state.src.charCodeAt(pos) === 0x24 && state.src.charCodeAt(pos - 1) !== 0x5c) {
        if (pos === start + 1) return false
        if (!silent) {
          const token = state.push('math_inline', 'math', 0)
          token.content = state.src.slice(start + 1, pos)
        }
        state.pos = pos + 1
        return true
      }
      if (state.src.charCodeAt(pos) === 0x0a) return false
      pos++
    }
    return false
  })

  md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
    const pos = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    if (pos + 2 > max) return false
    if (state.src.slice(pos, pos + 2) !== '$$') return false

    let next = startLine
    let found = false
    while (++next < endLine) {
      const linePos = state.bMarks[next] + state.tShift[next]
      const lineMax = state.eMarks[next]
      if (linePos < lineMax && state.src.slice(linePos, linePos + 2) === '$$') {
        found = true
        break
      }
    }
    if (!found) return false
    if (silent) return true

    const contentLines: string[] = []
    for (let line = startLine + 1; line < next; line++) {
      const lineStart = state.bMarks[line] + state.tShift[line]
      const lineEnd = state.eMarks[line]
      contentLines.push(state.src.slice(lineStart, lineEnd))
    }
    const token = state.push('math_block', 'math', 0)
    token.map = [startLine, next + 1]
    token.content = contentLines.join('\n')
    state.line = next + 1
    return true
  })

  const defaultHtmlInline = md.renderer.rules.html_inline
  md.renderer.rules.html_inline = (tokens, idx, options, env, self) => {
    const content = tokens[idx].content
    if (content.startsWith('<input') && content.includes('task-list-item-checkbox')) {
      return ''
    }
    if (content === '<label>' || content === '</label>') return ''
    return defaultHtmlInline ? defaultHtmlInline(tokens, idx, options, env, self) : content
  }

  return md
}

const markdownIt = createMarkdownIt()
const tokenHandlers = buildTokenHandlers(tokenSpecs)

// Custom handlers for html_inline that should become images or marks
tokenHandlers.html_inline = (state, tok) => {
  const content = tok.content
  if (content.startsWith('<img')) {
    const imgAttrs = parseImgTag(content)
    if (imgAttrs) {
      state.addNode(schema.nodes.image, imgAttrs)
      return
    }
  }
  if (content.startsWith('<input') && content.includes('task-list-item-checkbox')) return
  if (content === '<label>' || content === '</label>') return
  emitHtmlSnippet(state, content)
}

tokenHandlers.html_block = (state, tok) => {
  const content = tok.content
  const imgAttrs = parseImgTag(content.trim())
  if (imgAttrs && content.trim().match(/^<img\s+[^>]+>\s*$/i)) {
    state.openNode(schema.nodes.paragraph, null)
    state.addNode(schema.nodes.image, imgAttrs)
    state.closeNode()
    return
  }
  state.addNode(schema.nodes.html_block, { html: content })
}

tokenHandlers.footnote_open = (state, tok) => {
  const label = (tok.meta?.label as string | undefined) ?? String(((tok.meta?.id as number | undefined) ?? 0) + 1)
  state.openNode(schema.nodes.footnote_definition, { label })
}

tokenHandlers.footnote_close = (state) => {
  state.closeNode()
}

function openTableCell(
  state: MarkdownParseState,
  type: 'table_cell' | 'table_header',
  tok: Token
) {
  state.openNode(schema.nodes[type], { alignment: tableCellAlignment(tok) })
  state.openNode(schema.nodes.paragraph, null)
}

function closeTableCell(state: MarkdownParseState) {
  state.closeNode()
  state.closeNode()
}

tokenHandlers.th_open = (state, tok) => openTableCell(state, 'table_header', tok)
tokenHandlers.th_close = (state) => closeTableCell(state)
tokenHandlers.td_open = (state, tok) => openTableCell(state, 'table_cell', tok)
tokenHandlers.td_close = (state) => closeTableCell(state)

tokenHandlers.image = (state, tok) => {
  state.addNode(schema.nodes.image, {
    src: tok.attrGet('src'),
    title: tok.attrGet('title') || null,
    alt: tok.children?.[0]?.content || null,
    width: null,
    align: 'none'
  })
}

function parseBody(text: string): Node {
  const env: Record<string, unknown> = {}
  const state = new MarkdownParseState(tokenHandlers)
  const tokens = markdownIt.parse(text, env)
  state.parseTokens(tokens)
  let doc: Node | null = null
  do {
    doc = state.closeNode()
  } while (state.stack.length)
  return doc ?? schema.nodes.doc.createAndFill()!
}

export function parseMarkdown(text: string): Node {
  try {
    const { frontMatter, body } = splitFrontMatter(text)
    const children: Node[] = []

    if (frontMatter) {
      children.push(
        schema.nodes.front_matter.create({
          format: frontMatter.format,
          raw: frontMatter.raw
        })
      )
    }

    const bodyDoc = parseBody(body || (frontMatter ? '' : text))
    children.push(...bodyDoc.content.content)

    if (children.length === 0) {
      return schema.nodes.doc.createAndFill(schema.nodes.paragraph.create())!
    }

    return schema.nodes.doc.create(null, children)
  } catch {
    return schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text(text))
    ])
  }
}
