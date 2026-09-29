import {
  inputRules,
  InputRule,
  textblockTypeInputRule,
  wrappingInputRule
} from 'prosemirror-inputrules'
import type { MarkType } from 'prosemirror-model'
import { TextSelection, type EditorState } from 'prosemirror-state'
import { findWrapping } from 'prosemirror-transform'
import { useSettings } from '@/state/settings-store'
import { schema } from '@/editor/markdown'

function smartTypographyEnabled(): boolean {
  return useSettings.getState().settings.editor.smartTypography
}

/**
 * Replaces the match (or only its first group, when there is one) with
 * `replacement`, mirroring prosemirror-inputrules' string handler but gated on
 * the smart typography setting.
 */
function typographyRule(pattern: RegExp, replacement: string): InputRule {
  return new InputRule(
    pattern,
    (state, match, start, end) => {
      if (!smartTypographyEnabled()) return null
      let insert = replacement
      let from = start
      if (match[1]) {
        const offset = match[0].lastIndexOf(match[1])
        insert += match[0].slice(offset + match[1].length)
        from += offset
        const cutOff = from - end
        if (cutOff > 0) {
          insert = match[0].slice(offset - cutOff, offset) + insert
          from = end
        }
      }
      return state.tr.insertText(insert, from, end)
    },
    { inCodeMark: false }
  )
}

/**
 * `**text**`-style rules. The delimiters must hug non-space text, as in
 * CommonMark, and the character before the opener must not be the delimiter
 * itself — otherwise `*bold*` inside a half-typed `**bold**` would fire first.
 * U+FFFC stands in for inline atoms (images, math), which a rule must not eat.
 */
function delimited(delimiter: string, guard: string): RegExp {
  const d = delimiter.replace(/[*~$^]/g, '\\$&')
  const c = delimiter[0] === '*' ? '\\*' : delimiter[0] === '$' ? '\\$' : delimiter[0]
  const body = `[^${c}\\s\\ufffc](?:[^${c}\\ufffc]*[^${c}\\s\\ufffc])?`
  return new RegExp(`(?<![${guard}\\\\])${d}(${body})${d}$`)
}

function markRule(pattern: RegExp, markType: MarkType): InputRule {
  return new InputRule(
    pattern,
    (state, match, start, end) => {
      const text = match[1]
      if (!text) return null
      const $start = state.doc.resolve(start)
      if (!$start.parent.type.allowsMarkType(markType)) return null
      const marks = markType.create().addToSet($start.marks())
      const tr = state.tr.replaceWith(start, end, schema.text(text, marks))
      // Typing on after the closing delimiter should produce plain text.
      return tr.removeStoredMark(markType)
    },
    { inCodeMark: false }
  )
}

function mathInlineRule(): InputRule {
  return new InputRule(
    delimited('$', '$'),
    (state, match, start, end) => {
      const latex = match[1] ?? ''
      return state.tr.replaceWith(start, end, schema.nodes.math_inline.create({ latex }))
    },
    { inCodeMark: false }
  )
}

function checkedFrom(match: RegExpMatchArray): boolean {
  return (match[1] ?? ' ') !== ' '
}

/**
 * `[ ] ` or `[x] ` at the start of a bullet item turns it into a task. Typing
 * `- [ ] ` in a paragraph reaches here too: `- ` has already made the bullet.
 */
function taskRule(): InputRule {
  return new InputRule(/^\[([ xX])\]\s$/, (state, match, start, end) => {
    const checked = checkedFrom(match)
    const $start = state.doc.resolve(start)
    const { list_item, bullet_list } = schema.nodes

    if (
      $start.depth >= 3 &&
      $start.node(-1).type === list_item &&
      $start.index(-1) === 0 &&
      $start.node(-2).type === bullet_list
    ) {
      const itemPos = $start.before(-1)
      const item = $start.node(-1)
      return state.tr.delete(start, end).setNodeMarkup(itemPos, undefined, { ...item.attrs, checked })
    }

    const tr = state.tr.delete(start, end)
    const range = tr.doc.resolve(start).blockRange()
    const wrapping = range && findWrapping(range, bullet_list, { bullet: '-', tight: true })
    if (!range || !wrapping) return null
    return tr.wrap(range, [wrapping[0], { type: list_item, attrs: { checked } }])
  })
}

/**
 * A paragraph holding only `---`, `***` or `___` becomes a rule. With smart
 * typography on, the first two dashes have already become an em dash by the
 * time the third arrives, so `—-` counts as well.
 */
function horizontalRuleRule(): InputRule {
  return new InputRule(/^(?:---|—-|\*\*\*|___)$/, (state: EditorState, _match, start, end) => {
    const $start = state.doc.resolve(start)
    const paragraph = schema.nodes.paragraph
    if ($start.parent.type !== paragraph || end !== $start.end()) return null
    const from = $start.before()
    const to = $start.after()
    const tr = state.tr.replaceWith(from, to, [
      schema.nodes.horizontal_rule.create(),
      paragraph.create()
    ])
    return tr.setSelection(TextSelection.create(tr.doc, from + 2)).scrollIntoView()
  })
}

export function createInputRules(): ReturnType<typeof inputRules> {
  const { marks, nodes } = schema
  const rules: InputRule[] = [
    horizontalRuleRule(),
    textblockTypeInputRule(/^(#{1,6})\s$/, nodes.heading, (match) => ({
      level: match[1]?.length ?? 1
    })),
    wrappingInputRule(/^\s*>\s$/, nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, nodes.bullet_list, (match) => ({
      bullet: match[1] ?? '-',
      tight: true
    })),
    wrappingInputRule(
      /^(\d+)\.\s$/,
      nodes.ordered_list,
      (match) => ({ order: Number(match[1]), tight: true }),
      (match, node) => node.childCount + Number(node.attrs.order) === Number(match[1])
    ),
    taskRule(),
    textblockTypeInputRule(/^```([\w-]*)\s$/, nodes.code_block, (match) => ({
      params: match[1] ?? ''
    })),
    markRule(delimited('**', '*'), marks.strong),
    markRule(delimited('__', '_\\w'), marks.strong),
    markRule(delimited('~~', '~'), marks.strikethrough),
    markRule(delimited('*', '*'), marks.em),
    markRule(delimited('_', '_\\w'), marks.em),
    markRule(/(?<![`\\])`([^`\ufffc]+)`$/, marks.code),
    mathInlineRule(),
    typographyRule(/(?:^|[\s{[(<'"\u2018\u201C])(")$/, '“'),
    typographyRule(/"$/, '”'),
    typographyRule(/(?:^|[\s{[(<'"\u2018\u201C])(')$/, '‘'),
    typographyRule(/'$/, '’'),
    typographyRule(/--$/, '—'),
    typographyRule(/\.\.\.$/, '…')
  ]

  return inputRules({ rules })
}
