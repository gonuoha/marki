import type { Node as ProseNode } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'
import type { NodeView } from 'prosemirror-view'

export function createHtmlBlockNodeView(
  node: ProseNode,
  view: EditorView,
  getPos: () => number | undefined
): NodeView {
  const dom = document.createElement('div')
  dom.className = 'marki-html-block'
  dom.setAttribute('data-node-view', 'html-block')

  const label = document.createElement('div')
  label.className = 'marki-html-block__label'
  label.textContent = 'raw HTML'

  const textarea = document.createElement('textarea')
  textarea.className = 'marki-html-block__source'
  textarea.value = String(node.attrs.html ?? '')
  textarea.setAttribute('aria-label', 'Raw HTML block')
  textarea.spellcheck = false

  dom.appendChild(label)
  dom.appendChild(textarea)

  textarea.addEventListener('input', () => {
    const pos = getPos()
    if (pos == null) return
    const tr = view.state.tr.setNodeMarkup(pos, undefined, { html: textarea.value })
    view.dispatch(tr)
  })

  return {
    dom,
    update(updated: ProseNode) {
      if (updated.type !== node.type) return false
      if (textarea.value !== String(updated.attrs.html ?? '')) {
        textarea.value = String(updated.attrs.html ?? '')
      }
      node = updated
      return true
    },
    ignoreMutation: () => true,
    stopEvent: () => true
  }
}
