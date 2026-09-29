import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export interface VisualFindOptions {
  query: string
  replace: string
  caseSensitive: boolean
  wholeWord: boolean
  currentIndex: number
}

export interface VisualFindState {
  options: VisualFindOptions
  matches: Array<{ from: number; to: number }>
  deco: DecorationSet
}

export const visualFindKey = new PluginKey<VisualFindState>('markiVisualFind')

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function computeMatches(
  doc: import('prosemirror-model').Node,
  options: Pick<VisualFindOptions, 'query' | 'caseSensitive' | 'wholeWord'>
): Array<{ from: number; to: number }> {
  if (!options.query) return []
  const flags = options.caseSensitive ? 'g' : 'gi'
  const body = options.wholeWord ? `\\b${escapeRegExp(options.query)}\\b` : escapeRegExp(options.query)
  const regex = new RegExp(body, flags)
  const matches: Array<{ from: number; to: number }> = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(node.text)) !== null) {
      matches.push({ from: pos + match.index, to: pos + match.index + match[0].length })
      if (match[0].length === 0) regex.lastIndex++
    }
  })

  return matches
}

function buildFindDecorations(
  doc: import('prosemirror-model').Node,
  matches: Array<{ from: number; to: number }>,
  currentIndex: number
): DecorationSet {
  const decos = matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class: index === currentIndex ? 'marki-find-current' : 'marki-find-match'
    })
  )
  return DecorationSet.create(doc, decos)
}

export function createVisualFindPlugin(): Plugin {
  return new Plugin({
    key: visualFindKey,
    state: {
      init(): VisualFindState {
        return {
          options: {
            query: '',
            replace: '',
            caseSensitive: false,
            wholeWord: false,
            currentIndex: 0
          },
          matches: [],
          deco: DecorationSet.empty
        }
      },
      apply(tr, value) {
        const meta = tr.getMeta(visualFindKey) as Partial<VisualFindOptions> | undefined
        if (!meta) return value
        const options = { ...value.options, ...meta }
        const matches = computeMatches(tr.doc, options)
        const currentIndex = Math.min(options.currentIndex, Math.max(0, matches.length - 1))
        return {
          options: { ...options, currentIndex },
          matches,
          deco: buildFindDecorations(tr.doc, matches, currentIndex)
        }
      }
    },
    props: {
      decorations(state) {
        return visualFindKey.getState(state)?.deco ?? DecorationSet.empty
      }
    }
  })
}

export function ensureVisualFindPlugin(view: import('prosemirror-view').EditorView): void {
  if (visualFindKey.getState(view.state)) return
  view.updateState(
    view.state.reconfigure({
      plugins: [...view.state.plugins, createVisualFindPlugin()]
    })
  )
}

export function updateVisualFind(
  view: import('prosemirror-view').EditorView,
  patch: Partial<VisualFindOptions>
): VisualFindState | null {
  ensureVisualFindPlugin(view)
  view.dispatch(view.state.tr.setMeta(visualFindKey, patch))
  return visualFindKey.getState(view.state) ?? null
}

export function scrollMatchIntoView(
  view: import('prosemirror-view').EditorView,
  match: { from: number; to: number } | undefined
): void {
  if (!match) return
  const dom = view.domAtPos(match.from)
  const node = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement
  node?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
