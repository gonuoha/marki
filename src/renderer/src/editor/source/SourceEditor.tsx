import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, Prec, Transaction, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { registerFormatTarget, type FormatHandlers } from '@/editor/format-router'
import { useDocuments } from '@/state/document-store'
import { useFormatState } from '@/state/format-store'
import { getMarkdownTheme, invalidateMarkdownTheme, observeMarkdownTheme } from './markdown-theme'
import {
  createSourceFormatHandlers,
  sourceFormatKeymap,
  sourceFormatSnapshot
} from './source-format'
import './source.css'

const SELECTION_REPORT_MS = 80

export interface SourceEditorProps {
  documentId: string
  text: string
  onChange(text: string): void
}

let activeSourceView: EditorView | null = null

export function getActiveSourceView(): EditorView | null {
  return activeSourceView
}

function minimalChange(
  oldText: string,
  newText: string
): { from: number; to: number; insert: string } | null {
  if (oldText === newText) return null
  let start = 0
  const oldLen = oldText.length
  const newLen = newText.length
  while (start < oldLen && start < newLen && oldText[start] === newText[start]) start++
  let endOld = oldLen
  let endNew = newLen
  while (endOld > start && endNew > start && oldText[endOld - 1] === newText[endNew - 1]) {
    endOld--
    endNew--
  }
  return { from: start, to: endOld, insert: newText.slice(start, endNew) }
}

const themeCompartment = new Compartment()

function buildExtensions(onUpdate: Extension, formatHandlers: FormatHandlers): Extension[] {
  return [
    onUpdate,
    Prec.high(keymap.of(sourceFormatKeymap(formatHandlers))),
    history(),
    indentOnInput(),
    bracketMatching(),
    search({ top: true }),
    markdown({
      base: markdownLanguage,
      codeLanguages: languages
    }),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    themeCompartment.of(getMarkdownTheme())
  ]
}

export default function SourceEditor({ documentId, text, onChange }: SourceEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const docIdRef = useRef(documentId)
  const lastEmittedRef = useRef(text)
  const onChangeRef = useRef(onChange)
  const debounceRef = useRef<number | null>(null)
  const selectionTimerRef = useRef<number | null>(null)

  onChangeRef.current = onChange

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const reportSelection = (head: number) => {
      if (selectionTimerRef.current) window.clearTimeout(selectionTimerRef.current)
      selectionTimerRef.current = window.setTimeout(() => {
        useDocuments.getState().setSelection(docIdRef.current, head)
      }, SELECTION_REPORT_MS)
    }

    const onUpdate = EditorView.updateListener.of((update) => {
      const format = useFormatState.getState()
      if (update.view.hasFocus && format.focused !== 'source') format.focus('source')
      if (update.selectionSet || update.docChanged || update.focusChanged) {
        useFormatState.getState().report('source', sourceFormatSnapshot(update.state))
      }
      if (update.selectionSet || update.docChanged) reportSelection(update.state.selection.main.head)
    })

    const formatHandlers = createSourceFormatHandlers(() => viewRef.current)

    const state = EditorState.create({
      doc: text,
      extensions: buildExtensions(onUpdate, formatHandlers)
    })

    const view = new EditorView({
      state,
      parent: host,
      dispatch(tr) {
        view.update([tr])
        if (!tr.docChanged) return
        const next = view.state.doc.toString()
        lastEmittedRef.current = next
        if (debounceRef.current) window.clearTimeout(debounceRef.current)
        debounceRef.current = window.setTimeout(() => {
          onChangeRef.current(next)
        }, 120)
      }
    })

    viewRef.current = view
    docIdRef.current = documentId
    lastEmittedRef.current = text
    activeSourceView = view
    useFormatState.getState().report('source', sourceFormatSnapshot(view.state))

    const stopFormatTarget = registerFormatTarget('source', formatHandlers)

    const stopThemeWatch = observeMarkdownTheme(() => {
      invalidateMarkdownTheme()
      view.dispatch({
        effects: themeCompartment.reconfigure(getMarkdownTheme())
      })
    })

    return () => {
      stopThemeWatch()
      stopFormatTarget()
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      if (selectionTimerRef.current) window.clearTimeout(selectionTimerRef.current)
      if (activeSourceView === view) activeSourceView = null
      view.destroy()
      viewRef.current = null
    }
  }, [documentId])

  useEffect(() => {
    const view = viewRef.current
    if (!view || docIdRef.current !== documentId) return
    if (text === lastEmittedRef.current) return

    const current = view.state.doc.toString()
    if (text === current) {
      lastEmittedRef.current = text
      return
    }

    const change = minimalChange(current, text)
    if (!change) return
    view.dispatch({
      changes: change,
      annotations: Transaction.userEvent.of('external')
    })
    lastEmittedRef.current = text
  }, [documentId, text])

  return (
    <div className="marki-source-editor" data-document-id={documentId}>
      <div ref={hostRef} className="marki-source-editor__host" aria-label="Markdown source editor" />
    </div>
  )
}
