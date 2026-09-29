import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import type { FormatCommand } from '@/editor/format-router'
import { createSourceFormatHandlers } from '@/editor/source/source-format'

/** A document with `[` and `]` marking the selection (or `|` for a caret). */
function harness(marked: string) {
  const caret = marked.indexOf('|')
  const from = caret >= 0 ? caret : marked.indexOf('[')
  const to = caret >= 0 ? caret : marked.indexOf(']') - 1
  const doc = marked.replace(/[|[\]]/g, '')

  let state = EditorState.create({
    doc,
    selection: EditorSelection.range(from, to),
    extensions: markdown({ base: markdownLanguage })
  })
  ensureSyntaxTree(state, state.doc.length, 5000)

  const view = {
    get state() {
      return state
    },
    dispatch(...specs: TransactionSpec[]) {
      state = state.update(...specs).state
      ensureSyntaxTree(state, state.doc.length, 5000)
    },
    focus() {}
  }
  const handlers = createSourceFormatHandlers(() => view as unknown as EditorView)

  return {
    run(command: FormatCommand) {
      handlers[command]()
      return this
    },
    get text() {
      return state.doc.toString()
    },
    get selected() {
      const range = state.selection.main
      return state.sliceDoc(range.from, range.to)
    }
  }
}

describe('source formatting', () => {
  it('wraps and unwraps bold around the selection', () => {
    const editor = harness('plain [word]')
    editor.run('format.bold')
    expect(editor.text).toBe('plain **word**')
    expect(editor.selected).toBe('word')
    editor.run('format.bold')
    expect(editor.text).toBe('plain word')
  })

  it('sets, changes and clears a heading', () => {
    const editor = harness('Title|')
    expect(editor.run('format.heading2').text).toBe('## Title')
    expect(editor.run('format.heading4').text).toBe('#### Title')
    expect(editor.run('format.paragraph').text).toBe('Title')
  })

  it('toggles list markers on every selected line', () => {
    const editor = harness('[one\ntwo]')
    expect(editor.run('format.orderedList').text).toBe('1. one\n2. two')
    expect(editor.run('format.bulletList').text).toBe('- one\n- two')
    expect(editor.run('format.bulletList').text).toBe('one\ntwo')
  })

  it('keeps headings and list markers exclusive', () => {
    const editor = harness('## Title|')
    expect(editor.run('format.taskList').text).toBe('- [ ] Title')
    expect(editor.run('format.heading1').text).toBe('# Title')
  })

  it('toggles a blockquote', () => {
    const editor = harness('[a\nb]')
    expect(editor.run('format.quote').text).toBe('> a\n> b')
    expect(editor.run('format.quote').text).toBe('a\nb')
  })
})
