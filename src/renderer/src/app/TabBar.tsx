import { Columns2, X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { isMac } from '@/lib/keys'
import { runCommand } from '@/state/commands'
import { useDocuments } from '@/state/document-store'
import './TabBar.css'

/**
 * Tab by index: Ctrl+1…9 on macOS (as in VS Code) and Alt+1…9 elsewhere.
 * Mod+1…6 belong to the heading commands.
 */
function isTabIndexShortcut(event: KeyboardEvent): boolean {
  if (event.shiftKey) return false
  if (isMac()) return event.ctrlKey && !event.metaKey && !event.altKey
  return event.altKey && !event.ctrlKey && !event.metaKey
}

export function TabBar() {
  const documents = useDocuments((s) => s.documents)
  const activeId = useDocuments((s) => s.activeId)
  const activeMode = useDocuments((s) => s.documents.find((d) => d.id === s.activeId)?.mode)
  const activate = useDocuments((s) => s.activate)
  const close = useDocuments((s) => s.close)
  const scrollRef = useRef<HTMLDivElement>(null)

  const onWheel = useCallback((event: React.WheelEvent) => {
    if (!scrollRef.current) return
    scrollRef.current.scrollLeft += event.deltaY
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isTabIndexShortcut(event)) return
      const digit = Number.parseInt(event.code.replace('Digit', ''), 10)
      if (digit >= 1 && digit <= 9 && digit - 1 < documents.length) {
        event.preventDefault()
        activate(documents[digit - 1].id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activate, documents])

  useEffect(() => {
    scrollRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId])

  if (documents.length === 0) return null

  const split = activeMode === 'split'

  return (
    <div className="tab-bar" onWheel={onWheel}>
      <div className="tab-bar__scroll" ref={scrollRef} role="tablist" aria-label="Open documents">
        {documents.map((doc) => {
          const active = doc.id === activeId
          return (
            <div
              key={doc.id}
              className={`tab-bar__tab${active ? ' tab-bar__tab--active' : ''}${doc.dirty ? ' tab-bar__tab--dirty' : ''}`}
              role="tab"
              aria-selected={active}
              title={doc.path ?? doc.title}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault()
                  void close(doc.id)
                }
              }}
            >
              <button
                type="button"
                className="tab-bar__label"
                onClick={() => activate(doc.id)}
                aria-label={`${doc.title}${doc.dirty ? ', unsaved' : ''}`}
              >
                <span className="tab-bar__title">{doc.title}</span>
              </button>
              <button
                type="button"
                className="tab-bar__close"
                aria-label={`Close ${doc.title}`}
                onClick={(event) => {
                  event.stopPropagation()
                  void close(doc.id)
                }}
              >
                <span className="tab-bar__dirty" aria-hidden="true" />
                <X size={12} strokeWidth={2.25} className="tab-bar__close-icon" />
              </button>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className={`tab-bar__action${split ? ' tab-bar__action--active' : ''}`}
        aria-label={split ? 'Close split view' : 'Split view'}
        aria-pressed={split}
        title={split ? 'Close split view' : 'Split view'}
        onClick={() => runCommand(split ? 'view.modeVisual' : 'view.modeSplit')}
      >
        <Columns2 size={15} strokeWidth={1.75} />
      </button>
    </div>
  )
}
