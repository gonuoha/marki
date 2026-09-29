import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { EditorView } from 'prosemirror-view'
import { getActiveEditorView, insertImage, updateImageNode } from '@/editor/visual/commands'

type ImageAlign = 'none' | 'left' | 'center' | 'right' | 'float-right'

interface ImagePayload {
  view?: EditorView
  pos?: number
  attrs?: {
    src?: string
    alt?: string | null
    title?: string | null
    width?: string | null
    align?: string
  }
}

interface ImageDialogProps {
  payload: ImagePayload
  onClose: () => void
}

const alignOptions: { value: ImageAlign; label: string }[] = [
  { value: 'none', label: 'Inline' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'float-right', label: 'Float' }
]

export function ImageDialog({ payload, onClose }: ImageDialogProps): ReactElement {
  const [src, setSrc] = useState(payload.attrs?.src ?? '')
  const [alt, setAlt] = useState(payload.attrs?.alt ?? '')
  const [title, setTitle] = useState(payload.attrs?.title ?? '')
  const [width, setWidth] = useState(payload.attrs?.width ?? '')
  const [align, setAlign] = useState<ImageAlign>((payload.attrs?.align as ImageAlign) ?? 'none')
  const [preview, setPreview] = useState<string | null>(null)
  const srcRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    srcRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!src) {
      setPreview(null)
      return
    }
    if (/^(https?:|data:)/i.test(src)) {
      setPreview(src)
      return
    }
    void window.marki.file.readAsDataUrl(src).then(setPreview)
  }, [src])

  const chooseFile = async () => {
    const paths = await window.marki.file.pickOpen()
    if (paths[0]) setSrc(paths[0])
  }

  const confirm = () => {
    const view = payload.view ?? getActiveEditorView()
    if (!view || !src.trim()) return
    const attrs = {
      src: src.trim(),
      alt: alt.trim() || null,
      title: title.trim() || null,
      width: width.trim() || null,
      align
    }
    if (payload.pos != null) {
      updateImageNode(payload.pos, attrs)
    } else {
      insertImage(attrs)(view.state, view.dispatch, view)
      view.focus()
    }
    onClose()
  }

  return (
    <div className="marki-dialog" role="dialog" aria-labelledby="image-dialog-title">
      <h2 id="image-dialog-title" className="marki-dialog__title">Image</h2>
      <div className="marki-dialog__field">
        <label htmlFor="image-src">Source</label>
        <div className="marki-dialog__row">
          <input
            id="image-src"
            ref={srcRef}
            type="text"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm()
            }}
          />
          <button type="button" className="marki-dialog__btn" onClick={() => void chooseFile()}>
            Choose…
          </button>
        </div>
      </div>
      <div className="marki-dialog__field">
        <label htmlFor="image-alt">Alt text</label>
        <input id="image-alt" type="text" value={alt} onChange={(e) => setAlt(e.target.value)} />
      </div>
      <div className="marki-dialog__field">
        <label htmlFor="image-title">Title</label>
        <input id="image-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="marki-dialog__field">
        <label htmlFor="image-width">Width</label>
        <input id="image-width" type="text" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="e.g. 400" />
      </div>
      <div className="marki-dialog__field">
        <span id="image-align-label">Alignment</span>
        <div className="marki-dialog__segmented" role="group" aria-labelledby="image-align-label">
          {alignOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={align === opt.value}
              onClick={() => setAlign(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="marki-dialog__preview" aria-label="Image preview">
        {preview ? <img src={preview} alt={alt || 'Preview'} /> : <span>No preview</span>}
      </div>
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
