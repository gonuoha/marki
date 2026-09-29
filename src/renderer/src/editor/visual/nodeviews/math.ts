import katex from 'katex'
import 'katex/dist/katex.min.css'
import type { Node as ProseNode } from 'prosemirror-model'
import { NodeSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { NodeView } from 'prosemirror-view'

function renderLatex(el: HTMLElement, latex: string, displayMode: boolean): void {
  try {
    el.innerHTML = katex.renderToString(latex, { throwOnError: false, displayMode })
  } catch {
    el.textContent = latex
  }
}

export function createMathNodeView(
  node: ProseNode,
  view: EditorView,
  getPos: () => number | undefined,
  displayMode: boolean
): NodeView {
  const dom = document.createElement(displayMode ? 'div' : 'span')
  dom.className = displayMode ? 'marki-math marki-math--block' : 'marki-math marki-math--inline'
  dom.setAttribute('data-node-view', displayMode ? 'math-block' : 'math-inline')
  dom.setAttribute('role', 'math')
  dom.setAttribute('tabindex', '0')
  dom.setAttribute('aria-label', 'Math expression')

  const preview = document.createElement(displayMode ? 'div' : 'span')
  preview.className = 'marki-math__preview'
  dom.appendChild(preview)

  let editing = false
  let input: HTMLInputElement | null = null

  const showPreview = () => {
    editing = false
    if (input) {
      input.remove()
      input = null
    }
    preview.hidden = false
    renderLatex(preview, String(node.attrs.latex ?? ''), displayMode)
  }

  const startEdit = () => {
    if (editing) return
    editing = true
    preview.hidden = true
    input = document.createElement('input')
    input.className = 'marki-math__input'
    input.type = 'text'
    input.value = String(node.attrs.latex ?? '')
    input.setAttribute('aria-label', 'Edit math expression')
    dom.appendChild(input)
    input.focus()
    input.select()

    const commit = () => {
      const pos = getPos()
      if (pos == null) return
      const latex = input?.value ?? ''
      const tr = view.state.tr.setNodeMarkup(pos, undefined, { latex })
      view.dispatch(tr)
      node = view.state.doc.nodeAt(pos) ?? node
      showPreview()
    }

    input.addEventListener('blur', commit)
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commit()
        view.focus()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        showPreview()
        view.focus()
      }
    })
  }

  showPreview()

  dom.addEventListener('click', (event) => {
    event.preventDefault()
    const pos = getPos()
    if (pos == null) return
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)))
    startEdit()
  })

  return {
    dom,
    update(updated: ProseNode) {
      if (updated.type !== node.type) return false
      node = updated
      if (!editing) showPreview()
      else if (input) input.value = String(updated.attrs.latex ?? '')
      return true
    },
    ignoreMutation: () => true,
    stopEvent: () => editing
  }
}
