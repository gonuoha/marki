import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import {
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  goToNextCell,
  isInTable,
  selectedRect,
  tableEditing
} from 'prosemirror-tables'
import type { EditorView } from 'prosemirror-view'
import { columnResizing } from 'prosemirror-tables'

export { columnResizing, tableEditing }

const tableControlsKey = new PluginKey('marki-table-controls')

function createControlButton(
  label: string,
  editorView: EditorView,
  onClick: (view: EditorView) => void
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'marki-table-control'
  btn.setAttribute('aria-label', label)
  btn.textContent = label
  btn.addEventListener('mousedown', (event) => {
    event.preventDefault()
  })
  btn.addEventListener('click', () => onClick(editorView))
  return btn
}

function alignmentControl(editorView: EditorView, col: number): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'marki-table-align'
  wrap.setAttribute('role', 'group')
  wrap.setAttribute('aria-label', 'Column alignment')

  for (const align of ['left', 'center', 'right'] as const) {
    const btn = createControlButton(align, editorView, (v) => {
      const rect = selectedRect(v.state)
      const { table, map, tableStart } = rect
      let tr = v.state.tr
      for (let row = 0; row < map.height; row++) {
        const index = row * map.width + col
        const cellPos = map.map[index]
        const cell = table.nodeAt(cellPos)
        if (!cell) continue
        const pos = tableStart + cellPos
        tr = tr.setNodeMarkup(pos, undefined, { ...cell.attrs, alignment: align })
      }
      v.dispatch(tr)
    })
    btn.dataset.align = align
    wrap.appendChild(btn)
  }
  return wrap
}

export function createTableControlsPlugin(): Plugin {
  let editorView: EditorView | null = null
  return new Plugin({
    key: tableControlsKey,
    view(view) {
      editorView = view
      return {
        destroy() {
          editorView = null
        }
      }
    },
    props: {
      handleKeyDown(view, event) {
        if (!isInTable(view.state)) return false
        if (event.key === 'Enter' && !event.shiftKey) {
          const rect = selectedRect(view.state)
          const lastRow = rect.top === rect.map.height - 1
          const lastCol = rect.left === rect.map.width - 1
          if (lastRow && lastCol) {
            addRowAfter(view.state, view.dispatch)
            goToNextCell(1)(view.state, view.dispatch)
            return true
          }
        }
        return false
      },
      decorations(state) {
        if (!isInTable(state)) return DecorationSet.empty
        const rect = selectedRect(state)
        const decorations: Decoration[] = []
        const tablePos = rect.tableStart - 1
        decorations.push(
          Decoration.widget(
            tablePos,
            () => {
              const bar = document.createElement('div')
              bar.className = 'marki-table-toolbar'
              bar.contentEditable = 'false'

              const addRow = createControlButton('Add row', editorView!, (v) => addRowAfter(v.state, v.dispatch))
              const delRow = createControlButton('Remove row', editorView!, (v) => deleteRow(v.state, v.dispatch))
              const addCol = createControlButton('Add column', editorView!, (v) =>
                addColumnBefore(v.state, v.dispatch)
              )
              const delCol = createControlButton('Remove column', editorView!, (v) =>
                deleteColumn(v.state, v.dispatch)
              )

              bar.append(addRow, delRow, addCol, delCol)
              if (editorView) {
                bar.appendChild(alignmentControl(editorView, rect.left))
              }
              return bar
            },
            { side: -1, key: `table-controls-${tablePos}` }
          )
        )
        return DecorationSet.create(state.doc, decorations)
      }
    }
  })
}

export function appendTableRowAtEnd(view: EditorView): void {
  if (!isInTable(view.state)) return
  addRowAfter(view.state, view.dispatch)
  const tr = view.state.tr
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, tr.selection.from)))
}
