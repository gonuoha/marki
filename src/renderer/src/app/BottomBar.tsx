import { useMemo } from 'react'
import { editorKindForMode } from '@/editor/format-router'
import { countCharacters, countWords, offsetToLineColumn, readingTimeMinutes } from '@/lib/format'
import type { OpenDocument } from '@/state/document-store'
import { useDocuments } from '@/state/document-store'
import { useFormatState } from '@/state/format-store'
import { useSettings } from '@/state/settings-store'
import { FormatToolbar } from './FormatToolbar'
import './BottomBar.css'

function saveStateLabel(dirty: boolean, saving: boolean): string {
  if (saving) return 'Saving…'
  if (dirty) return 'Unsaved'
  return 'Saved'
}

export function BottomBar({ document }: { document: OpenDocument }) {
  const showStats = useSettings((s) => s.settings.editor.showStatusBar)
  const saving = useDocuments((s) => s.savingIds.includes(document.id))
  const sourceActive = useFormatState(
    (s) => editorKindForMode(document.mode, s.focused) === 'source'
  )

  const stats = useMemo(
    () => ({
      words: countWords(document.text),
      chars: countCharacters(document.text),
      reading: readingTimeMinutes(document.text)
    }),
    [document.text]
  )

  // Offsets are only reported by the source editor, where Ln/Col is exact.
  const position = sourceActive ? offsetToLineColumn(document.text, document.selection) : null

  return (
    <footer className="bottom-bar" aria-label="Formatting and document status">
      <div className="bottom-bar__side bottom-bar__side--start">
        {showStats && (
          <span title={`${stats.chars.toLocaleString()} characters`}>
            {stats.words.toLocaleString()} {stats.words === 1 ? 'word' : 'words'}
            <span className="bottom-bar__sep" aria-hidden="true">·</span>
            {stats.reading} min read
          </span>
        )}
      </div>

      <FormatToolbar />

      <div className="bottom-bar__side bottom-bar__side--end">
        {showStats && (
          <>
            {position && (
              <span>
                Ln {position.line}, Col {position.col}
                <span className="bottom-bar__sep" aria-hidden="true">·</span>
              </span>
            )}
            <span
              className={`bottom-bar__save${document.dirty ? ' bottom-bar__save--dirty' : ''}`}
              aria-live="polite"
            >
              {saveStateLabel(document.dirty, saving)}
            </span>
          </>
        )}
      </div>
    </footer>
  )
}
