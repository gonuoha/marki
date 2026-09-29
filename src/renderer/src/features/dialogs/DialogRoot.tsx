import { useCallback, useEffect, useRef, type ReactElement } from 'react'
import { useUi } from '@/state/ui-store'
import { getActiveEditorView } from '@/editor/visual/commands'
import { ImageDialog } from './ImageDialog'
import { LinkDialog } from './LinkDialog'
import { TableDialog } from './TableDialog'
import './dialogs.css'

export function DialogRoot(): ReactElement | null {
  const dialog = useUi((s) => s.dialog)
  const payload = useUi((s) => s.dialogPayload)
  const closeDialog = useUi((s) => s.closeDialog)
  const scrimRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    closeDialog()
    requestAnimationFrame(() => {
      getActiveEditorView()?.focus()
    })
  }, [closeDialog])

  useEffect(() => {
    if (!dialog) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialog, close])

  useEffect(() => {
    if (!dialog || !scrimRef.current) return
    const focusable = scrimRef.current.querySelector<HTMLElement>(
      'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    focusable?.focus()
  }, [dialog])

  if (!dialog || dialog === 'settings' || dialog === 'palette' || dialog === 'find') {
    return null
  }

  const trapFocus = (event: React.FocusEvent) => {
    if (!scrimRef.current) return
    const focusable = scrimRef.current.querySelectorAll<HTMLElement>(
      'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.relatedTarget === last) {
      first.focus()
    } else if (event.relatedTarget === first) {
      last.focus()
    }
  }

  return (
    <div
      className="marki-dialog-scrim"
      ref={scrimRef}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === scrimRef.current) close()
      }}
    >
      <div onFocus={trapFocus}>
        {dialog === 'link' && <LinkDialog payload={payload as never} onClose={close} />}
        {dialog === 'image' && <ImageDialog payload={(payload ?? {}) as never} onClose={close} />}
        {dialog === 'table' && <TableDialog payload={(payload ?? {}) as never} onClose={close} />}
      </div>
    </div>
  )
}
