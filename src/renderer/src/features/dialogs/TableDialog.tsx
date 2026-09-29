import { useEffect, useState, type ReactElement } from 'react'
import type { EditorView } from 'prosemirror-view'
import { getActiveEditorView } from '@/editor/visual/commands'
import { insertTable } from '@/editor/visual/commands'

interface TablePayload {
  view?: EditorView
}

interface TableDialogProps {
  payload: TablePayload
  onClose: () => void
}

export function TableDialog({ payload, onClose }: TableDialogProps): ReactElement {
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [headerRow, setHeaderRow] = useState(true)
  const [hover, setHover] = useState({ r: 3, c: 3 })

  useEffect(() => {
    setRows(hover.r)
    setCols(hover.c)
  }, [hover])

  const confirm = () => {
    const view = payload.view ?? getActiveEditorView()
    if (!view) return
    insertTable(rows, cols, headerRow)(view.state, view.dispatch, view)
    view.focus()
    onClose()
  }

  return (
    <div className="marki-dialog" role="dialog" aria-labelledby="table-dialog-title">
      <h2 id="table-dialog-title" className="marki-dialog__title">Insert Table</h2>
      <p className="marki-dialog__field" style={{ marginBottom: 'var(--space-2)' }}>
        {hover.r} × {hover.c}
      </p>
      <div className="marki-dialog__grid" role="grid" aria-label="Table size">
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8) + 1
          const c = (i % 8) + 1
          const active = r <= hover.r && c <= hover.c
          return (
            <button
              key={i}
              type="button"
              className={`marki-dialog__grid-cell${active ? ' marki-dialog__grid-cell--active' : ''}`}
              aria-label={`${r} by ${c} table`}
              onMouseEnter={() => setHover({ r, c })}
              onClick={() => {
                const view = payload.view ?? getActiveEditorView()
                if (!view) return
                insertTable(r, c, headerRow)(view.state, view.dispatch, view)
                view.focus()
                onClose()
              }}
            />
          )
        })}
      </div>
      <label className="marki-dialog__row">
        <input
          type="checkbox"
          checked={headerRow}
          onChange={(e) => setHeaderRow(e.target.checked)}
        />
        Header row
      </label>
      <div className="marki-dialog__actions">
        <button type="button" className="marki-dialog__btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="marki-dialog__btn marki-dialog__btn--primary" onClick={confirm}>
          Insert
        </button>
      </div>
    </div>
  )
}
