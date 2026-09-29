import type { ComponentType } from 'react'

function EditorPlaceholder({ text }: { text: string }) {
  return (
    <pre className="editor-placeholder" aria-label="Document preview">
      {text}
    </pre>
  )
}

type VisualProps = {
  documentId: string
  text: string
  onChange: (text: string) => void
  baseDir: string | null
  documentPath: string | null
}

type SourceProps = {
  documentId: string
  text: string
  onChange: (text: string) => void
}

const visualModules = import.meta.glob<{ default: ComponentType<VisualProps> }>(
  '../editor/visual/VisualEditor.tsx'
)
const sourceModules = import.meta.glob<{ default: ComponentType<SourceProps> }>(
  '../editor/source/SourceEditor.tsx'
)

export function visualLoader() {
  const entry = Object.values(visualModules)[0]
  if (!entry) {
    return Promise.resolve({
      default: function VisualPlaceholder({ text }: VisualProps) {
        return <EditorPlaceholder text={text} />
      }
    })
  }
  return entry()
}

export function sourceLoader() {
  const entry = Object.values(sourceModules)[0]
  if (!entry) {
    return Promise.resolve({
      default: function SourcePlaceholder({ text }: SourceProps) {
        return <EditorPlaceholder text={text} />
      }
    })
  }
  return entry()
}
