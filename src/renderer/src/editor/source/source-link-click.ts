import { openLinkInBrowser, urlAtLineIndex } from '@/lib/open-link'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

function hrefAtEvent(view: EditorView, event: MouseEvent): string | null {
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos == null) return null
  const line = view.state.doc.lineAt(pos)
  return urlAtLineIndex(line.text, pos - line.from)
}

function hasOpenModifier(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey
}

/** Source text stays editable on plain click; Cmd/Ctrl+click opens the link under the pointer. */
export function sourceLinkClick(): Extension {
  return EditorView.domEventHandlers({
    mousemove(event, view) {
      const href = hasOpenModifier(event) ? hrefAtEvent(view, event) : null
      view.dom.style.cursor = href ? 'pointer' : ''
      return false
    },
    mouseleave(_event, view) {
      view.dom.style.cursor = ''
      return false
    },
    mousedown(event, view) {
      if (event.button !== 0 || !hasOpenModifier(event)) return false
      const href = hrefAtEvent(view, event)
      if (!href) return false
      event.preventDefault()
      void openLinkInBrowser(href)
      return true
    }
  })
}
