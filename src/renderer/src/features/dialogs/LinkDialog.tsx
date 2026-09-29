import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useUi } from '@/state/ui-store'
import { applyLinkMark } from '@/editor/visual/commands'

interface LinkPayload {
  href?: string
  title?: string | null
  text?: string
  from: number
  to: number
}

interface LinkDialogProps {
  payload: LinkPayload
  onClose: () => void
}

function hasScheme(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url)
}

export function LinkDialog({ payload, onClose }: LinkDialogProps): ReactElement {
  const [href, setHref] = useState(payload.href ?? '')
  const [title, setTitle] = useState(payload.title ?? '')
  const [text, setText] = useState(payload.text ?? '')
  const urlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    urlRef.current?.focus()
    urlRef.current?.select()
  }, [])

  const warnNoScheme = href.trim() && !hasScheme(href.trim())

  const confirm = () => {
    const url = href.trim()
    if (!url) {
      useUi.getState().toast('error', 'URL is required')
      return
    }
    applyLinkMark(payload.from, payload.to, url, title.trim() || null, text)
    onClose()
  }

  const remove = () => {
    applyLinkMark(payload.from, payload.to, '', null, text)
    onClose()
  }

  return (
    <div className="marki-dialog" role="dialog" aria-labelledby="link-dialog-title">
      <h2 id="link-dialog-title" className="marki-dialog__title">Link</h2>
      <div className="marki-dialog__field">
        <label htmlFor="link-url">URL</label>
        <input
          id="link-url"
          ref={urlRef}
          type="url"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm()
          }}
        />
      </div>
      {warnNoScheme && (
        <p className="marki-dialog__warning" role="status">
          This URL has no scheme — it may not open correctly in a browser.
        </p>
      )}
      <div className="marki-dialog__field">
        <label htmlFor="link-text">Text</label>
        <input
          id="link-text"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="marki-dialog__field">
        <label htmlFor="link-title">Title (optional)</label>
        <input
          id="link-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="marki-dialog__actions">
        <button type="button" className="marki-dialog__btn marki-dialog__btn--danger" onClick={remove}>
          Remove Link
        </button>
        <button type="button" className="marki-dialog__btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="marki-dialog__btn marki-dialog__btn--primary" onClick={confirm}>
          Apply
        </button>
      </div>
    </div>
  )
}
