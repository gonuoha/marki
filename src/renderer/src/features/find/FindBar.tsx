import { getActiveSourceView } from '@/editor/source/SourceEditor'
import { getActiveEditorView } from '@/editor/visual/commands'
import { registerCommand } from '@/state/commands'
import { useDocuments } from '@/state/document-store'
import { useUi } from '@/state/ui-store'
import {
  SearchQuery,
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  setSearchQuery
} from '@codemirror/search'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  scrollMatchIntoView,
  updateVisualFind,
  visualFindKey
} from './visual-find'
import './find.css'

export function FindBar() {
  const open = useUi((s) => s.dialog === 'find')
  const closeDialog = useUi((s) => s.closeDialog)
  const mode = useDocuments((s) => {
    const doc = s.documents.find((d) => d.id === s.activeId)
    return doc?.mode ?? 'visual'
  })

  const [query, setQuery] = useState('')
  const [replace, setReplace] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const findRef = useRef<HTMLInputElement>(null)

  const syncVisual = useCallback(
    (nextQuery: string, nextReplace: string, nextCase: boolean, nextWhole: boolean, index: number) => {
      const view = getActiveEditorView()
      if (!view || mode === 'source') return null
      const state = updateVisualFind(view, {
        query: nextQuery,
        replace: nextReplace,
        caseSensitive: nextCase,
        wholeWord: nextWhole,
        currentIndex: index
      })
      const count = state?.matches.length ?? 0
      setMatchCount(count)
      setCurrentIndex(state?.options.currentIndex ?? 0)
      scrollMatchIntoView(view, state?.matches[state.options.currentIndex])
      return state
    },
    [mode]
  )

  const syncSource = useCallback(
    (nextQuery: string, nextReplace: string, nextCase: boolean, nextWhole: boolean) => {
      const view = getActiveSourceView()
      if (!view || mode === 'visual') return
      const searchQuery = new SearchQuery({
        search: nextQuery,
        replace: nextReplace,
        caseSensitive: nextCase,
        wholeWord: nextWhole,
        regexp: false
      })
      view.dispatch({ effects: setSearchQuery.of(searchQuery) })
      if (!searchQuery.valid) {
        setMatchCount(0)
        return
      }
      const cursor = searchQuery.getCursor(view.state)
      let count = 0
      while (!cursor.next().done) count++
      setMatchCount(count)
    },
    [mode]
  )

  useEffect(() => {
    return registerCommand('edit.find', () => {
      useUi.getState().openDialog('find')
    })
  }, [])

  useEffect(() => {
    if (!open) return
    findRef.current?.focus()
    findRef.current?.select()
  }, [open])

  useEffect(() => {
    if (!open) return
    if (mode === 'source') syncSource(query, replace, caseSensitive, wholeWord)
    else syncVisual(query, replace, caseSensitive, wholeWord, currentIndex)
  }, [open, query, replace, caseSensitive, wholeWord, mode, syncSource, syncVisual, currentIndex])

  const goNext = (backwards = false) => {
    if (mode === 'source') {
      const view = getActiveSourceView()
      if (!view) return
      const command = backwards ? findPrevious : findNext
      command(view)
      return
    }
    const view = getActiveEditorView()
    if (!view) return
    const state = visualFindKey.getState(view.state)
    const count = state?.matches.length ?? 0
    if (count === 0) return
    const nextIndex = backwards
      ? (currentIndex - 1 + count) % count
      : (currentIndex + 1) % count
    setCurrentIndex(nextIndex)
    syncVisual(query, replace, caseSensitive, wholeWord, nextIndex)
  }

  const onReplace = () => {
    if (mode === 'source') {
      const view = getActiveSourceView()
      if (!view) return
      replaceNext(view)
      syncSource(query, replace, caseSensitive, wholeWord)
      return
    }
    const view = getActiveEditorView()
    if (!view) return
    const state = visualFindKey.getState(view.state)
    const match = state?.matches[state.options.currentIndex]
    if (!match) return
    view.dispatch(view.state.tr.insertText(replace, match.from, match.to))
    syncVisual(query, replace, caseSensitive, wholeWord, currentIndex)
  }

  const onReplaceAll = () => {
    if (mode === 'source') {
      const view = getActiveSourceView()
      if (!view) return
      replaceAll(view)
      syncSource(query, replace, caseSensitive, wholeWord)
      return
    }
    const view = getActiveEditorView()
    if (!view) return
    const state = visualFindKey.getState(view.state)
    if (!state?.matches.length) return
    let tr = view.state.tr
    for (const match of [...state.matches].reverse()) {
      tr = tr.insertText(replace, match.from, match.to)
    }
    view.dispatch(tr)
    syncVisual(query, replace, caseSensitive, wholeWord, 0)
  }

  if (!open) return null

  const countLabel =
    matchCount === 0 ? 'No results' : `${currentIndex + 1} of ${matchCount}`

  return (
    <div className="find-bar" role="dialog" aria-label="Find and replace">
      <div className="find-bar__field">
        <label htmlFor="find-query">Find</label>
        <input
          id="find-query"
          ref={findRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setCurrentIndex(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              closeDialog()
              if (mode === 'source') getActiveSourceView()?.focus()
              else getActiveEditorView()?.focus()
            } else if (event.key === 'Enter' && event.shiftKey) {
              event.preventDefault()
              goNext(true)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              goNext(false)
            }
          }}
        />
        <span className="find-bar__count" aria-live="polite">
          {countLabel}
        </span>
      </div>
      <div className="find-bar__field">
        <label htmlFor="find-replace">Replace</label>
        <input
          id="find-replace"
          type="text"
          value={replace}
          onChange={(event) => setReplace(event.target.value)}
        />
      </div>
      <label className="find-bar__toggle">
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={(event) => setCaseSensitive(event.target.checked)}
        />
        Case
      </label>
      <label className="find-bar__toggle">
        <input
          type="checkbox"
          checked={wholeWord}
          onChange={(event) => setWholeWord(event.target.checked)}
        />
        Words
      </label>
      <div className="find-bar__actions">
        <button type="button" className="find-bar__button" onClick={() => goNext(true)}>
          Previous
        </button>
        <button type="button" className="find-bar__button" onClick={() => goNext(false)}>
          Next
        </button>
        <button type="button" className="find-bar__button" onClick={onReplace}>
          Replace
        </button>
        <button type="button" className="find-bar__button" onClick={onReplaceAll}>
          Replace All
        </button>
      </div>
    </div>
  )
}
