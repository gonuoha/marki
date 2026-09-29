import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

function readToken(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function readTokens() {
  return {
    textPrimary: readToken('--text-primary', '#1b1b1a'),
    textSecondary: readToken('--text-secondary', '#5c5b57'),
    textLink: readToken('--text-link', '#1f6feb'),
    mdMarker: readToken('--md-marker', '#b9b8b2'),
    mdHeading: readToken('--md-heading', '#1b1b1a'),
    mdCodeBg: readToken('--md-code-bg', '#f1f0ec'),
    syntaxKeyword: readToken('--syntax-keyword', '#a626a4'),
    syntaxString: readToken('--syntax-string', '#50a14f'),
    syntaxNumber: readToken('--syntax-number', '#986801'),
    syntaxComment: readToken('--syntax-comment', '#a0a1a7'),
    syntaxFunction: readToken('--syntax-function', '#4078f2'),
    syntaxVariable: readToken('--syntax-variable', '#e45649'),
    syntaxPunctuation: readToken('--syntax-punctuation', '#6b6b6b'),
    fontMono: readToken('--font-mono', 'monospace'),
    fontSizeBody: readToken('--font-size-body', '17px'),
    bgPane: readToken('--bg-app', '#f6f6f4')
  }
}

let themeObserver: MutationObserver | null = null
let cachedTheme: ReturnType<typeof buildTheme> | null = null

function buildTheme() {
  const tokens = readTokens()

  const highlight = HighlightStyle.define([
    { tag: t.heading1, fontWeight: '700', fontSize: '1.55em', color: tokens.mdHeading },
    { tag: t.heading2, fontWeight: '700', fontSize: '1.35em', color: tokens.mdHeading },
    { tag: t.heading3, fontWeight: '650', fontSize: '1.18em', color: tokens.mdHeading },
    { tag: t.heading4, fontWeight: '650', fontSize: '1.05em', color: tokens.mdHeading },
    { tag: t.heading5, fontWeight: '600', color: tokens.mdHeading },
    { tag: t.heading6, fontWeight: '600', color: tokens.textSecondary },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strong, fontWeight: '700' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: tokens.textLink, textDecoration: 'underline' },
    { tag: t.url, color: tokens.textLink },
    { tag: t.monospace, fontFamily: tokens.fontMono, backgroundColor: tokens.mdCodeBg },
    { tag: t.quote, color: tokens.textSecondary, fontStyle: 'italic' },
    { tag: t.meta, color: tokens.mdMarker },
    { tag: t.keyword, color: tokens.syntaxKeyword },
    { tag: t.string, color: tokens.syntaxString },
    { tag: t.number, color: tokens.syntaxNumber },
    { tag: t.comment, color: tokens.syntaxComment, fontStyle: 'italic' },
    { tag: t.function(t.variableName), color: tokens.syntaxFunction },
    { tag: t.variableName, color: tokens.syntaxVariable },
    { tag: t.punctuation, color: tokens.syntaxPunctuation }
  ])

  const theme = EditorView.theme(
    {
      '&': {
        color: tokens.textPrimary,
        backgroundColor: tokens.bgPane,
        fontFamily: tokens.fontMono,
        fontSize: tokens.fontSizeBody,
        height: '100%'
      },
      '.cm-content': {
        fontFamily: tokens.fontMono,
        fontSize: tokens.fontSizeBody,
        caretColor: tokens.textPrimary,
        padding: 'var(--space-6) var(--space-5)'
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'inherit'
      },
      '.cm-gutters': {
        display: 'none'
      },
      '.cm-activeLine': {
        backgroundColor: 'transparent'
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--accent-soft) !important'
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: tokens.textPrimary
      },
      '.cm-line': {
        padding: '0'
      }
    },
    { dark: false }
  )

  return [theme, syntaxHighlighting(highlight)]
}

export function getMarkdownTheme() {
  if (!cachedTheme) cachedTheme = buildTheme()
  return cachedTheme
}

export function observeMarkdownTheme(onChange: () => void): () => void {
  if (!themeObserver) {
    themeObserver = new MutationObserver((records) => {
      for (const record of records) {
        if (record.attributeName === 'data-theme') {
          cachedTheme = null
          onChange()
          break
        }
      }
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
  }

  return () => undefined
}

export function invalidateMarkdownTheme(): void {
  cachedTheme = null
}
