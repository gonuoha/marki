import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { languages } from '@codemirror/language-data'
import { EditorState as CMState } from '@codemirror/state'
import { EditorView as CMView, keymap as cmKeymap } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import type { Node as ProseNode } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView, NodeView } from 'prosemirror-view'

const languageOptions = languages.map((lang) => ({
  label: lang.name,
  value: lang.name.toLowerCase()
}))

function cmTheme(): Extension {
  return CMView.theme({
    '&': {
      backgroundColor: 'var(--md-code-bg)',
      color: 'var(--text-primary)',
      fontSize: '0.9em'
    },
    '.cm-content': {
      fontFamily: 'var(--font-mono)',
      padding: 'var(--space-3) 0'
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--text-tertiary)'
    },
    '.cm-activeLine': { backgroundColor: 'var(--bg-hover)' },
    '.cm-cursor': { borderLeftColor: 'var(--text-primary)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--bg-selected) !important'
    },
    '.tok-keyword': { color: 'var(--syntax-keyword)' },
    '.tok-string': { color: 'var(--syntax-string)' },
    '.tok-number': { color: 'var(--syntax-number)' },
    '.tok-comment': { color: 'var(--syntax-comment)' },
    '.tok-definition': { color: 'var(--syntax-function)' },
    '.tok-variableName': { color: 'var(--syntax-variable)' },
    '.tok-punctuation': { color: 'var(--syntax-punctuation)' }
  })
}

export function createCodeBlockNodeView(
  node: ProseNode,
  view: EditorView,
  getPos: () => number | undefined
): NodeView {
  const dom = document.createElement('div')
  dom.className = 'marki-code-block'
  dom.setAttribute('data-node-view', 'code-block')

  const toolbar = document.createElement('div')
  toolbar.className = 'marki-code-block__toolbar'

  const select = document.createElement('select')
  select.className = 'marki-code-block__lang'
  select.setAttribute('aria-label', 'Code language')
  const auto = document.createElement('option')
  auto.value = ''
  auto.textContent = 'Plain text'
  select.appendChild(auto)
  for (const opt of languageOptions) {
    const el = document.createElement('option')
    el.value = opt.value
    el.textContent = opt.label
    select.appendChild(el)
  }
  select.value = node.attrs.params ? String(node.attrs.params).toLowerCase() : ''
  toolbar.appendChild(select)

  const editorHost = document.createElement('div')
  editorHost.className = 'marki-code-block__editor'

  dom.appendChild(toolbar)
  dom.appendChild(editorHost)

  let cmView: CMView | null = null
  let updating = false

  const loadLanguage = async (name: string): Promise<Extension | null> => {
    const lang = languages.find((l) => l.name.toLowerCase() === name.toLowerCase())
    if (!lang) return null
    return lang.load()
  }

  const buildCM = async (text: string, params: string) => {
    const extensions: Extension[] = [
      cmTheme(),
      history(),
      cmKeymap.of([...defaultKeymap, ...historyKeymap]),
      CMView.updateListener.of((update) => {
        if (!update.docChanged || updating) return
        const pos = getPos()
        if (pos == null) return
        const tr = view.state.tr
        const next = update.state.doc.toString()
        if (next !== node.textContent) {
          const from = pos + 1
          const to = pos + node.nodeSize - 1
          const content = next ? view.state.schema.text(next) : []
          tr.replaceWith(from, to, content)
          view.dispatch(tr)
        }
      }),
      CMView.domEventHandlers({
        keydown: (event, cm) => {
          if (event.key === 'Backspace' && cm.state.doc.length === 0) {
            const pos = getPos()
            if (pos == null) return false
            const tr = view.state.tr.delete(pos, pos + node.nodeSize)
            view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos)))
            view.focus()
            return true
          }
          if (event.key === 'ArrowUp' && cm.state.selection.main.head === 0) {
            const pos = getPos()
            if (pos == null) return false
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
            view.focus()
            return true
          }
          if (event.key === 'ArrowDown' && cm.state.selection.main.head === cm.state.doc.length) {
            const pos = getPos()
            if (pos == null) return false
            const after = pos + node.nodeSize
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, after)))
            view.focus()
            return true
          }
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            const pos = getPos()
            if (pos == null) return false
            const after = pos + node.nodeSize
            const para = view.state.schema.nodes.paragraph.create()
            const tr = view.state.tr.insert(after, para)
            view.dispatch(tr.setSelection(TextSelection.create(tr.doc, after + 1)))
            view.focus()
            return true
          }
          return false
        }
      })
    ]

    const langExt = params ? await loadLanguage(params) : null
    if (langExt) extensions.push(langExt)

    const state = CMState.create({ doc: text, extensions })
    if (cmView) {
      cmView.destroy()
    }
    cmView = new CMView({ state, parent: editorHost })
  }

  void buildCM(node.textContent, String(node.attrs.params ?? ''))

  select.addEventListener('change', () => {
    const pos = getPos()
    if (pos == null) return
    const params = select.value
    const tr = view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, params })
    view.dispatch(tr)
    void buildCM(node.textContent, params)
  })

  return {
    dom,
    contentDOM: undefined,
    ignoreMutation: () => true,
    update(updated: ProseNode) {
      if (updated.type !== node.type) return false
      node = updated
      if (select.value !== String(updated.attrs.params ?? '').toLowerCase()) {
        select.value = String(updated.attrs.params ?? '').toLowerCase()
        void buildCM(updated.textContent, String(updated.attrs.params ?? ''))
        return true
      }
      if (cmView && updated.textContent !== cmView.state.doc.toString()) {
        updating = true
        cmView.dispatch({
          changes: { from: 0, to: cmView.state.doc.length, insert: updated.textContent }
        })
        updating = false
      }
      return true
    },
    destroy() {
      cmView?.destroy()
      cmView = null
    },
    stopEvent(event: Event) {
      return event.target !== select
    }
  }
}
