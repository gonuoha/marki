import { EditorState, TextSelection, type Transaction } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { describe, expect, it } from 'vitest'
import { parseMarkdown, schema, serializeMarkdown } from '@/editor/markdown'
import { toggleTaskList } from '@/editor/visual/commands'
import { createInputRules } from '@/editor/visual/inputrules'
import { backspace } from '@/editor/visual/keymap'

/**
 * Just enough of an EditorView for the input rules plugin and commands: typing
 * goes through `handleTextInput` exactly as prosemirror-view would call it.
 */
function harness(markdown = '') {
  const plugin = createInputRules()
  const doc = markdown ? parseMarkdown(markdown) : schema.node('doc', null, [schema.node('paragraph')])
  let state = EditorState.create({ doc, plugins: [plugin] })
  state = state.apply(state.tr.setSelection(TextSelection.atEnd(state.doc)))

  const view = {
    composing: false,
    get state() {
      return state
    },
    dispatch(tr: Transaction) {
      state = state.apply(tr)
    }
  }
  const dispatch = (tr: Transaction) => view.dispatch(tr)

  return {
    get state() {
      return state
    },
    markdown: () => serializeMarkdown(state.doc, { emphasis: '_', strong: '**' }).trim(),
    type(text: string) {
      for (const ch of text) {
        const { from, to } = state.selection
        const handled = plugin.props.handleTextInput?.call(
          plugin,
          view as unknown as EditorView,
          from,
          to,
          ch,
          () => state.tr.insertText(ch, from, to)
        )
        if (!handled) dispatch(state.tr.insertText(ch, from, to))
      }
    },
    enter() {
      dispatch(state.tr.split(state.selection.from))
    },
    /** Backspace as the keymap runs it; unhandled presses delete natively. */
    backspace(times = 1) {
      for (let i = 0; i < times; i++) {
        if (backspace(state, dispatch)) continue
        const { $from } = state.selection
        if ($from.parentOffset > 0) dispatch(state.tr.delete($from.pos - 1, $from.pos))
      }
    },
    run(command: (s: EditorState, d?: (tr: Transaction) => void) => boolean) {
      return command(state, dispatch)
    }
  }
}

describe('backspace', () => {
  it('removes a heading once its text is gone', () => {
    const h = harness()
    h.type('# Some Header')
    expect(h.state.doc.firstChild?.type.name).toBe('heading')

    h.backspace('Some Header'.length)
    expect(h.state.doc.firstChild?.type.name).toBe('heading')
    expect(h.state.doc.firstChild?.textContent).toBe('')

    h.backspace()
    expect(h.state.doc.firstChild?.type.name).toBe('paragraph')
    expect(h.markdown()).toBe('')
  })

  it('then merges the emptied line into the block above', () => {
    const h = harness('Intro\n\n## Title\n')
    h.backspace('Title'.length + 2)
    expect(h.state.doc.childCount).toBe(1)
    expect(h.markdown()).toBe('Intro')
  })

  it('turns a heading with text into a paragraph when the caret is at its start', () => {
    const h = harness('# Keep this text\n')
    h.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 1)))
      return true
    })
    h.backspace()
    expect(h.markdown()).toBe('Keep this text')
  })

  it('lifts a list item out of its list at the start of the item', () => {
    const h = harness()
    h.type('- item')
    h.backspace('item'.length + 1)
    expect(h.state.doc.firstChild?.type.name).toBe('paragraph')
  })

  it('undoes an input rule immediately after it fires', () => {
    const h = harness()
    h.type('# ')
    h.backspace()
    expect(h.state.doc.firstChild?.type.name).toBe('paragraph')
    expect(h.state.doc.textContent).toBe('# ')
  })
})

describe('input rules', () => {
  it('makes **bold** strong without italicising the half-typed form', () => {
    const h = harness()
    h.type('a **bold** word')
    expect(h.markdown()).toBe('a **bold** word')
  })

  it('makes _italic_ and *italic* emphasis', () => {
    const h = harness()
    h.type('an _it_ and *em* here')
    expect(h.markdown()).toBe('an _it_ and _em_ here')
  })

  it('leaves snake_case_words and spaced asterisks alone', () => {
    const h = harness()
    h.type('snake_case_word and 2 * 3 * 4')
    expect(h.state.doc.firstChild?.firstChild?.marks).toEqual([])
    expect(h.state.doc.textContent).toBe('snake_case_word and 2 * 3 * 4')
  })

  it('curls double and single quotes', () => {
    const h = harness()
    h.type('"quoted" and it\'s')
    expect(h.state.doc.textContent).toBe('“quoted” and it’s')
  })

  it('turns -- into an em dash', () => {
    const h = harness()
    h.type('a -- b')
    expect(h.state.doc.textContent).toBe('a — b')
  })

  it('turns --- into a horizontal rule even with smart dashes on', () => {
    const h = harness()
    h.type('---')
    expect(h.state.doc.firstChild?.type.name).toBe('horizontal_rule')
    expect(h.state.doc.lastChild?.type.name).toBe('paragraph')
  })

  it('makes - [ ] a task item', () => {
    const h = harness()
    h.type('- [ ] task')
    expect(h.markdown()).toBe('- [ ] task')
  })

  it('makes 1. an ordered list without splitting the paragraph', () => {
    const h = harness()
    h.type('1. one')
    expect(h.state.doc.childCount).toBe(1)
    expect(h.markdown()).toBe('1. one')
  })

  it('keeps lists typed in the editor tight', () => {
    const h = harness()
    h.type('- a')
    h.run((state, dispatch) => {
      const { $from } = state.selection
      dispatch?.(state.tr.split($from.pos, 2))
      return true
    })
    h.type('b')
    expect(h.markdown()).toBe('- a\n- b')
  })
})

describe('task list command', () => {
  it('wraps a paragraph as an unchecked task', () => {
    const h = harness('Buy milk\n')
    expect(h.run(toggleTaskList())).toBe(true)
    expect(h.markdown()).toBe('- [ ] Buy milk')
  })

  it('converts a plain bullet item in place', () => {
    const h = harness('- Buy milk\n')
    h.run(toggleTaskList())
    expect(h.markdown()).toBe('- [ ] Buy milk')
  })
})
