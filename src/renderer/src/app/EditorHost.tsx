import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { OpenDocument } from '@/state/document-store'
import { useDocuments } from '@/state/document-store'
import { dirname } from '@/lib/path'
import { sourceLoader, visualLoader } from './editor-loaders'
import './EditorHost.css'

function EditorPlaceholder({ text }: { text: string }) {
  return (
    <pre className="editor-placeholder" aria-label="Document preview">
      {text}
    </pre>
  )
}

const VisualEditor = lazy(visualLoader)
const SourceEditor = lazy(sourceLoader)

interface EditorPaneProps {
  document: OpenDocument
}

function VisualPane({ document }: EditorPaneProps) {
  const setText = useDocuments((s) => s.setText)
  const baseDir = document.path ? dirname(document.path) : null

  return (
    <Suspense fallback={<EditorPlaceholder text={document.text} />}>
      <VisualEditor
        documentId={document.id}
        text={document.text}
        onChange={(text) => setText(document.id, text)}
        baseDir={baseDir}
        documentPath={document.path}
      />
    </Suspense>
  )
}

function SourcePane({ document }: EditorPaneProps) {
  const setText = useDocuments((s) => s.setText)

  return (
    <Suspense fallback={<EditorPlaceholder text={document.text} />}>
      <SourceEditor
        documentId={document.id}
        text={document.text}
        onChange={(text) => setText(document.id, text)}
      />
    </Suspense>
  )
}

interface SplitEditorProps {
  document: OpenDocument
}

function SplitEditor({ document }: SplitEditorProps) {
  const [ratio, setRatio] = useState(0.5)
  const splitRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const onPointerDown = useCallback(() => {
    dragging.current = true
  }, [])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current || !splitRef.current) return
      const rect = splitRef.current.getBoundingClientRect()
      const next = (event.clientX - rect.left) / rect.width
      setRatio(Math.min(0.75, Math.max(0.25, next)))
    }
    const onPointerUp = () => {
      dragging.current = false
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  return (
    <div
      ref={splitRef}
      className="editor-host__split"
      style={{ '--split-ratio': ratio } as React.CSSProperties}
    >
      <div className="editor-host__pane editor-host__pane--visual">
        <VisualPane document={document} />
      </div>
      <div
        className="editor-host__divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        onPointerDown={onPointerDown}
      />
      <div className="editor-host__pane editor-host__pane--source">
        <SourcePane document={document} />
      </div>
    </div>
  )
}

interface EditorHostProps {
  document: OpenDocument
}

export function EditorHost({ document }: EditorHostProps) {
  if (document.mode === 'source') {
    return (
      <div className="editor-host">
        <SourcePane document={document} />
      </div>
    )
  }

  if (document.mode === 'split') {
    return (
      <div className="editor-host">
        <SplitEditor document={document} />
      </div>
    )
  }

  return (
    <div className="editor-host">
      <VisualPane document={document} />
    </div>
  )
}
