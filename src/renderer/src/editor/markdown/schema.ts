/**
 * ProseMirror document schema for Marki markdown.
 * Extends prosemirror-markdown's CommonMark schema with tables, footnotes, math,
 * raw HTML, images with alignment, and front matter.
 *
 * Modelling decisions:
 * - Task lists reuse `list_item` with optional `checked: boolean | null` (null = regular item).
 * - `bullet_list` stores the bullet character in `bullet` (default "-").
 * - Table cell alignment lives on `table_cell` / `table_header` via `alignment`.
 * - `front_matter` is an optional first child of `doc` only.
 */

import { Schema, type MarkSpec, type NodeSpec } from 'prosemirror-model'
import { tableNodes } from 'prosemirror-tables'
import type { FrontMatterFormat } from '@shared/types'

const alignValues = ['none', 'left', 'center', 'right', 'float-right'] as const
type ImageAlign = (typeof alignValues)[number]

function imageAttrs(dom: HTMLElement): Record<string, unknown> {
  const src = dom.getAttribute('src') ?? ''
  const alt = dom.getAttribute('alt')
  const title = dom.getAttribute('title')
  const width = dom.getAttribute('width')
  const style = dom.getAttribute('style') ?? ''
  let align: ImageAlign = 'none'

  if (/float:\s*right/i.test(style)) align = 'float-right'
  else if (/margin:\s*0\s+auto/i.test(style) || /display:\s*block[^;]*;\s*margin:\s*0\s+auto/i.test(style))
    align = 'center'
  else if (/float:\s*left/i.test(style)) align = 'left'
  else if (dom.getAttribute('data-align')) {
    const dataAlign = dom.getAttribute('data-align') as ImageAlign
    if (alignValues.includes(dataAlign)) align = dataAlign
  }

  return {
    src,
    alt,
    title,
    width,
    align
  }
}

const tableNodeSpecs = tableNodes({
  tableGroup: 'block',
  cellContent: 'block+',
  cellAttributes: {
    alignment: {
      default: null,
      getFromDOM(dom) {
        const el = dom as HTMLElement
        const data = el.getAttribute('data-alignment')
        if (data === 'left' || data === 'center' || data === 'right') return data
        const style = el.getAttribute('style') ?? ''
        if (/text-align:\s*center/i.test(style)) return 'center'
        if (/text-align:\s*right/i.test(style)) return 'right'
        if (/text-align:\s*left/i.test(style)) return 'left'
        return null
      },
      setDOMAttr(value, attrs) {
        if (value === 'left' || value === 'center' || value === 'right') {
          attrs['data-alignment'] = value
        }
      }
    }
  }
})

const nodes: Record<string, NodeSpec> = {
  doc: {
    content: 'front_matter? block+'
  },

  front_matter: {
    attrs: {
      format: {},
      raw: {}
    },
    group: 'block',
    atom: true,
    selectable: false,
    parseDOM: [
      {
        tag: 'div[data-front-matter]',
        getAttrs(dom) {
          const el = dom as HTMLElement
          return {
            format: el.getAttribute('data-format') as FrontMatterFormat,
            raw: el.getAttribute('data-raw') ?? ''
          }
        }
      }
    ],
    toDOM(node) {
      return [
        'div',
        {
          'data-front-matter': 'true',
          'data-format': node.attrs.format,
          'data-raw': node.attrs.raw
        }
      ]
    }
  },

  paragraph: {
    content: 'inline*',
    group: 'block',
    parseDOM: [{ tag: 'p' }],
    toDOM() {
      return ['p', 0]
    }
  },

  blockquote: {
    content: 'block+',
    group: 'block',
    parseDOM: [{ tag: 'blockquote' }],
    toDOM() {
      return ['blockquote', 0]
    }
  },

  horizontal_rule: {
    group: 'block',
    parseDOM: [{ tag: 'hr' }],
    toDOM() {
      return ['div', ['hr']]
    }
  },

  heading: {
    attrs: { level: { default: 1 } },
    content: 'inline*',
    group: 'block',
    defining: true,
    parseDOM: [
      { tag: 'h1', attrs: { level: 1 } },
      { tag: 'h2', attrs: { level: 2 } },
      { tag: 'h3', attrs: { level: 3 } },
      { tag: 'h4', attrs: { level: 4 } },
      { tag: 'h5', attrs: { level: 5 } },
      { tag: 'h6', attrs: { level: 6 } }
    ],
    toDOM(node) {
      return ['h' + node.attrs.level, 0]
    }
  },

  code_block: {
    content: 'text*',
    group: 'block',
    code: true,
    defining: true,
    marks: '',
    attrs: { params: { default: '' } },
    parseDOM: [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs(node) {
          return { params: (node as HTMLElement).getAttribute('data-params') || '' }
        }
      }
    ],
    toDOM(node) {
      const attrs: Record<string, string> = {}
      if (node.attrs.params) attrs['data-params'] = node.attrs.params
      return ['pre', attrs, ['code', 0]]
    }
  },

  bullet_list: {
    content: 'list_item+',
    group: 'block',
    attrs: {
      tight: { default: false },
      bullet: { default: '-' }
    },
    parseDOM: [
      {
        tag: 'ul',
        getAttrs(dom) {
          const el = dom as HTMLElement
          return {
            tight: el.hasAttribute('data-tight'),
            bullet: el.getAttribute('data-bullet') || '-'
          }
        }
      }
    ],
    toDOM(node) {
      return [
        'ul',
        {
          'data-tight': node.attrs.tight ? 'true' : null,
          'data-bullet': node.attrs.bullet !== '-' ? node.attrs.bullet : null
        },
        0
      ]
    }
  },

  ordered_list: {
    content: 'list_item+',
    group: 'block',
    attrs: {
      order: { default: 1 },
      tight: { default: false }
    },
    parseDOM: [
      {
        tag: 'ol',
        getAttrs(dom) {
          const el = dom as HTMLElement
          return {
            order: el.hasAttribute('start') ? +(el.getAttribute('start') ?? '1') : 1,
            tight: el.hasAttribute('data-tight')
          }
        }
      }
    ],
    toDOM(node) {
      return [
        'ol',
        {
          start: node.attrs.order === 1 ? null : node.attrs.order,
          'data-tight': node.attrs.tight ? 'true' : null
        },
        0
      ]
    }
  },

  list_item: {
    content: 'block+',
    defining: true,
    attrs: {
      checked: { default: null }
    },
    parseDOM: [
      {
        tag: 'li',
        getAttrs(dom) {
          const el = dom as HTMLElement
          const checkedAttr = el.getAttribute('data-checked')
          if (checkedAttr === 'true') return { checked: true }
          if (checkedAttr === 'false') return { checked: false }
          return { checked: null }
        }
      }
    ],
    toDOM(node) {
      const attrs: Record<string, string | null> = {}
      if (node.attrs.checked === true) attrs['data-checked'] = 'true'
      else if (node.attrs.checked === false) attrs['data-checked'] = 'false'
      return ['li', attrs, 0]
    }
  },

  text: {
    group: 'inline'
  },

  image: {
    inline: true,
    attrs: {
      src: {},
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      align: { default: 'none' }
    },
    group: 'inline',
    draggable: true,
    parseDOM: [
      {
        tag: 'img[src]',
        getAttrs: imageAttrs
      }
    ],
    toDOM(node) {
      const attrs: Record<string, string | null> = {
        src: node.attrs.src,
        alt: node.attrs.alt,
        title: node.attrs.title,
        width: node.attrs.width
      }
      if (node.attrs.align && node.attrs.align !== 'none') {
        attrs['data-align'] = node.attrs.align
      }
      return ['img', attrs]
    }
  },

  hard_break: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM() {
      return ['br']
    }
  },

  footnote_reference: {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { label: {} },
    parseDOM: [
      {
        tag: 'span[data-footnote-ref]',
        getAttrs(dom) {
          return { label: (dom as HTMLElement).getAttribute('data-label') ?? '' }
        }
      }
    ],
    toDOM(node) {
      return ['span', { 'data-footnote-ref': 'true', 'data-label': node.attrs.label }]
    }
  },

  footnote_definition: {
    content: 'block+',
    group: 'block',
    attrs: { label: {} },
    parseDOM: [
      {
        tag: 'div[data-footnote-def]',
        getAttrs(dom) {
          return { label: (dom as HTMLElement).getAttribute('data-label') ?? '' }
        }
      }
    ],
    toDOM(node) {
      return ['div', { 'data-footnote-def': 'true', 'data-label': node.attrs.label }, 0]
    }
  },

  math_inline: {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { latex: {} },
    parseDOM: [
      {
        tag: 'span[data-math-inline]',
        getAttrs(dom) {
          return { latex: (dom as HTMLElement).getAttribute('data-latex') ?? '' }
        }
      }
    ],
    toDOM(node) {
      return ['span', { 'data-math-inline': 'true', 'data-latex': node.attrs.latex }]
    }
  },

  math_block: {
    group: 'block',
    atom: true,
    attrs: { latex: {} },
    parseDOM: [
      {
        tag: 'div[data-math-block]',
        getAttrs(dom) {
          return { latex: (dom as HTMLElement).getAttribute('data-latex') ?? '' }
        }
      }
    ],
    toDOM(node) {
      return ['div', { 'data-math-block': 'true', 'data-latex': node.attrs.latex }]
    }
  },

  html_block: {
    group: 'block',
    atom: true,
    attrs: { html: {} },
    parseDOM: [
      {
        tag: 'div[data-html-block]',
        getAttrs(dom) {
          return { html: (dom as HTMLElement).getAttribute('data-html') ?? '' }
        }
      }
    ],
    toDOM(node) {
      return ['div', { 'data-html-block': 'true', 'data-html': node.attrs.html }]
    }
  },

  ...tableNodeSpecs
}

const marks: Record<string, MarkSpec> = {
  em: {
    parseDOM: [
      { tag: 'i' },
      { tag: 'em' },
      { style: 'font-style=italic' },
      { style: 'font-style=normal', clearMark: (m) => m.type.name === 'em' }
    ],
    toDOM() {
      return ['em']
    }
  },

  strong: {
    parseDOM: [
      { tag: 'strong' },
      {
        tag: 'b',
        getAttrs(node) {
          return (node as HTMLElement).style.fontWeight !== 'normal' ? null : false
        }
      },
      { style: 'font-weight=400', clearMark: (m) => m.type.name === 'strong' },
      {
        style: 'font-weight',
        getAttrs(value) {
          return /^(bold(er)?|[5-9]\d{2,})$/.test(value) ? null : false
        }
      }
    ],
    toDOM() {
      return ['strong']
    }
  },

  link: {
    attrs: {
      href: {},
      title: { default: null }
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs(dom) {
          return {
            href: (dom as HTMLElement).getAttribute('href'),
            title: dom.getAttribute('title')
          }
        }
      }
    ],
    toDOM(node) {
      return ['a', node.attrs]
    }
  },

  code: {
    code: true,
    parseDOM: [{ tag: 'code' }],
    toDOM() {
      return ['code']
    }
  },

  strikethrough: {
    parseDOM: [{ tag: 's' }, { tag: 'del' }, { style: 'text-decoration=line-through' }],
    toDOM() {
      return ['s']
    }
  },

  /**
   * A paired inline HTML tag wrapping text, e.g. `<kbd>Ctrl</kbd>`. Both tags
   * live on the one mark: a mark that covers no text cannot exist, so the
   * closing tag has nowhere else to be stored.
   */
  html_inline: {
    attrs: {
      html: {},
      closeHtml: { default: '' }
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'span[data-html-inline]',
        getAttrs(dom) {
          const el = dom as HTMLElement
          return {
            html: el.getAttribute('data-html') ?? '',
            closeHtml: el.getAttribute('data-html-close') ?? ''
          }
        }
      }
    ],
    toDOM(mark) {
      return [
        'span',
        {
          'data-html-inline': 'true',
          'data-html': mark.attrs.html,
          'data-html-close': mark.attrs.closeHtml
        }
      ]
    }
  }
}

export const schema = new Schema({ nodes, marks })
