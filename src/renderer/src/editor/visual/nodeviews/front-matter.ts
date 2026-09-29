import type { Node as ProseNode } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'
import type { NodeView } from 'prosemirror-view'

function summaryFromRaw(raw: string): string {
  const titleMatch = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m)
  if (titleMatch?.[1]) return titleMatch[1]
  const first = raw.split('\n').find((line) => line.trim())
  return first?.trim() ?? 'Front matter'
}

export function createFrontMatterNodeView(
  node: ProseNode,
  view: EditorView,
  getPos: () => number | undefined
): NodeView {
  const dom = document.createElement('div')
  dom.className = 'marki-front-matter'
  dom.setAttribute('data-node-view', 'front-matter')
  dom.setAttribute('data-format', String(node.attrs.format ?? 'yaml'))

  const header = document.createElement('button')
  header.type = 'button'
  header.className = 'marki-front-matter__header'
  header.setAttribute('aria-expanded', 'false')

  const badge = document.createElement('span')
  badge.className = 'marki-front-matter__badge'
  badge.textContent = String(node.attrs.format ?? 'yaml').toUpperCase()

  const summary = document.createElement('span')
  summary.className = 'marki-front-matter__summary'

  header.appendChild(badge)
  header.appendChild(summary)

  const body = document.createElement('div')
  body.className = 'marki-front-matter__body'
  body.hidden = true

  const textarea = document.createElement('textarea')
  textarea.className = 'marki-front-matter__source'
  textarea.value = String(node.attrs.raw ?? '')
  textarea.setAttribute('aria-label', 'Front matter source')
  textarea.spellcheck = false
  body.appendChild(textarea)

  dom.appendChild(header)
  dom.appendChild(body)

  let expanded = false

  const refreshSummary = () => {
    summary.textContent = summaryFromRaw(String(node.attrs.raw ?? ''))
  }

  refreshSummary()

  header.addEventListener('click', () => {
    expanded = !expanded
    body.hidden = !expanded
    header.setAttribute('aria-expanded', String(expanded))
    if (expanded) textarea.focus()
  })

  textarea.addEventListener('input', () => {
    const pos = getPos()
    if (pos == null) return
    const tr = view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, raw: textarea.value })
    view.dispatch(tr)
    node = view.state.doc.nodeAt(pos) ?? node
    refreshSummary()
  })

  return {
    dom,
    update(updated: ProseNode) {
      if (updated.type !== node.type) return false
      node = updated
      badge.textContent = String(updated.attrs.format ?? 'yaml').toUpperCase()
      dom.setAttribute('data-format', String(updated.attrs.format ?? 'yaml'))
      if (textarea.value !== String(updated.attrs.raw ?? '')) {
        textarea.value = String(updated.attrs.raw ?? '')
      }
      refreshSummary()
      return true
    },
    ignoreMutation: () => true,
    stopEvent: (event) => {
      const target = event.target as HTMLElement
      return target === header || target === textarea || body.contains(target)
    }
  }
}
