import { findLinkAnchor, linkHrefAtPos, openLinkInBrowser } from '@/lib/open-link'
import { Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

function hrefAtEvent(view: EditorView, event: MouseEvent): string | null {
  const anchor = findLinkAnchor(event.target, view.dom)
  if (!anchor) return null

  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
  const hrefFromDoc = coords ? linkHrefAtPos(view.state, coords.pos) : null
  return hrefFromDoc ?? anchor.getAttribute('href')
}

/** Click opens a link in the browser; Shift+click places the caret inside it instead. */
export function linkClickPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (event.button !== 0 || event.shiftKey) return false
          if (!hrefAtEvent(view, event)) return false
          event.preventDefault()
          return true
        },
        click(view, event) {
          if (event.button !== 0 || event.shiftKey) return false
          const href = hrefAtEvent(view, event)
          if (!href) return false
          event.preventDefault()
          void openLinkInBrowser(href)
          return true
        }
      }
    }
  })
}
