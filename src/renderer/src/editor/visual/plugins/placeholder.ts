import { Plugin } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export function placeholderPlugin(): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const doc = state.doc
        if (doc.childCount !== 1 || doc.firstChild?.type.name !== 'paragraph') {
          return DecorationSet.empty
        }
        const block = doc.firstChild
        if (!block || block.content.size > 0) return DecorationSet.empty

        const widget = Decoration.widget(1, () => {
          const el = document.createElement('span')
          el.className = 'marki-placeholder'
          el.textContent = 'Start writing…'
          el.setAttribute('aria-hidden', 'true')
          return el
        })

        return DecorationSet.create(doc, [widget])
      }
    }
  })
}
