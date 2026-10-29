import { useEffect, useRef, type ReactElement } from 'react'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { history } from 'prosemirror-history'
import type { Node as ProseNode } from 'prosemirror-model'
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { EditorState } from 'prosemirror-state'
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import { parseMarkdown, serializeMarkdown, type SerializeOptions } from '@/editor/markdown'
import { registerFormatTarget } from '@/editor/format-router'
import { useFormatState } from '@/state/format-store'
import { useSettings } from '@/state/settings-store'
import {
  insertCodeBlock,
  insertFootnote,
  insertHorizontalRule,
  insertMath,
  openImageDialog,
  openTableDialog,
  runEditorCommand,
  setActiveEditorView,
  setHeading,
  setParagraph,
  toggleBlockquote,
  toggleBulletList,
  toggleCode,
  toggleEm,
  toggleLink,
  toggleOrderedList,
  toggleStrikethrough,
  toggleStrong,
  toggleTaskList
} from './commands'
import { visualFormatSnapshot } from './format-state'
import { createInputRules } from './inputrules'
import { createKeymap } from './keymap'
import { createNodeViews } from './nodeviews'
import { importAndInsertImage } from './nodeviews/image'
import { createModePlugins } from './plugins'
import { linkClickPlugin } from './plugins/link-click'
import { columnResizing, createTableControlsPlugin, tableEditing } from './table-controls'
import './editor-content.css'

interface VisualEditorProps {
  documentId: string
  text: string
  onChange: (text: string) => void
  baseDir: string | null
  documentPath: string | null
}

const DEBOUNCE_MS = 120
const activeBlockKey = new PluginKey('marki-active-block')
const protectFrontMatterKey = new PluginKey('marki-protect-front-matter')

function activeBlockPlugin(): Plugin {
  return new Plugin({
    key: activeBlockKey,
    props: {
      decorations(state) {
        const { $from } = state.selection
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d)
          if (!node.isBlock || node.type.name === 'doc') continue
          const name = node.type.name
          if (
            name === 'heading' ||
            name === 'blockquote' ||
            name === 'bullet_list' ||
            name === 'ordered_list'
          ) {
            const from = $from.before(d)
            const to = $from.after(d)
            return DecorationSet.create(state.doc, [
              Decoration.node(from, to, { 'data-active': 'true' })
            ])
          }
        }
        return DecorationSet.empty
      }
    }
  })
}

function protectFrontMatterPlugin(): Plugin {
  return new Plugin({
    key: protectFrontMatterKey,
    filterTransaction(tr, state) {
      if (!tr.docChanged) return true
      const hadFront = state.doc.firstChild?.type.name === 'front_matter'
      if (!hadFront) return true
      // Reject deletion or reordering of front matter; allow attribute edits.
      return tr.doc.firstChild?.type.name === 'front_matter'
    }
  })
}

function posToTextOffset(doc: ProseNode, pos: number): number {
  if (pos <= 0) return 0
  return doc.textBetween(0, pos, '\n', '\n').length
}

function textOffsetToPos(doc: ProseNode, target: number): number {
  if (target <= 0) return 1

  let offset = 0
  let foundPos = doc.content.size

  doc.nodesBetween(0, doc.content.size, (node, pos, parent, index) => {
    if (offset >= target) return false

    if (node.isBlock && parent && index > 0) {
      offset += 1
      if (offset >= target) {
        foundPos = pos
        return false
      }
    }

    if (node.isText) {
      const text = node.text ?? ''
      const next = offset + text.length
      if (next >= target) {
        foundPos = pos + (target - offset)
        offset = target
        return false
      }
      offset = next
    }
  })

  return Math.max(1, Math.min(foundPos, doc.content.size))
}

function buildPlugins(): Plugin[] {
  return [
    createInputRules(),
    createKeymap(),
    history(),
    dropCursor(),
    gapCursor(),
    columnResizing(),
    tableEditing(),
    activeBlockPlugin(),
    protectFrontMatterPlugin(),
    createTableControlsPlugin(),
    linkClickPlugin(),
    ...createModePlugins()
  ]
}

export default function VisualEditor({
  documentId,
  text,
  onChange,
  baseDir,
  documentPath
}: VisualEditorProps): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const textRef = useRef(text)
  const lastEmittedRef = useRef(text)
  textRef.current = text
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const onChangeRef = useRef(onChange)
  const serializeOptionsRef = useRef<SerializeOptions>({
    bullet: '-',
    emphasis: '_',
    strong: '**',
    prettyTables: false
  })
  const baseDirRef = useRef(baseDir)
  const documentPathRef = useRef(documentPath)
  const spellCheckRef = useRef(false)

  const spellCheck = useSettings((s) => s.settings.editor.spellCheck)
  const markdownOptions = useSettings((s) => s.settings.markdown)

  onChangeRef.current = onChange
  serializeOptionsRef.current = {
    bullet: markdownOptions.bullet,
    emphasis: markdownOptions.emphasis,
    strong: markdownOptions.strong,
    prettyTables: markdownOptions.prettyTables,
    wrapColumn: markdownOptions.wrapColumn
  }
  baseDirRef.current = baseDir
  documentPathRef.current = documentPath
  spellCheckRef.current = spellCheck

  useEffect(() => {
    mountedRef.current = true
    const host = hostRef.current
    if (!host) return

    const scheduleOnChange = (view: EditorView) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        if (!mountedRef.current) return
        const serialized = serializeMarkdown(view.state.doc, serializeOptionsRef.current)
        lastEmittedRef.current = serialized
        onChangeRef.current(serialized)
      }, DEBOUNCE_MS)
    }

    const initialText = textRef.current
    lastEmittedRef.current = initialText
    const doc = parseMarkdown(initialText)
    const state = EditorState.create({ doc, plugins: buildPlugins() })

    const view = new EditorView(host, {
      state,
      nodeViews: createNodeViews(baseDirRef.current),
      editable: () => true,
      attributes: {
        class: 'marki-doc',
        spellcheck: spellCheckRef.current ? 'true' : 'false'
      },
      dispatchTransaction(tr) {
        const next = view.state.apply(tr)
        view.updateState(next)
        if (tr.docChanged) {
          scheduleOnChange(view)
        }
        const format = useFormatState.getState()
        if (view.hasFocus() && format.focused !== 'visual') format.focus('visual')
        format.report('visual', visualFormatSnapshot(next))
      },
      handleDOMEvents: {
        focus(view) {
          useFormatState.getState().focus('visual')
          useFormatState.getState().report('visual', visualFormatSnapshot(view.state))
          return false
        },
        drop(view, event) {
          const dt = event.dataTransfer
          if (!dt?.files?.length) return false
          const file = dt.files[0]
          if (!file.type.startsWith('image/')) return false
          event.preventDefault()
          void file.arrayBuffer().then((buf) => {
            void importAndInsertImage(view, {
              documentPath: documentPathRef.current,
              bytes: new Uint8Array(buf),
              fileName: file.name
            })
          })
          return true
        },
        paste(view, event) {
          const items = event.clipboardData?.items
          if (!items) return false
          for (const item of items) {
            if (!item.type.startsWith('image/')) continue
            const file = item.getAsFile()
            if (!file) continue
            event.preventDefault()
            void file.arrayBuffer().then((buf) => {
              void importAndInsertImage(view, {
                documentPath: documentPathRef.current,
                bytes: new Uint8Array(buf),
                fileName: file.name || 'pasted-image.png'
              })
            })
            return true
          }
          return false
        }
      }
    })

    viewRef.current = view
    setActiveEditorView(view)
    useFormatState.getState().report('visual', visualFormatSnapshot(view.state))

    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      view.destroy()
      viewRef.current = null
      setActiveEditorView(null)
    }
  }, [documentId])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    if (text === lastEmittedRef.current) return

    const offset = posToTextOffset(view.state.doc, view.state.selection.from)
    const doc = parseMarkdown(text)
    const pos = textOffsetToPos(doc, offset)
    lastEmittedRef.current = text
    const state = EditorState.create({
      doc,
      plugins: view.state.plugins,
      selection: TextSelection.create(doc, Math.max(1, Math.min(pos, doc.content.size)))
    })
    view.updateState(state)
    useFormatState.getState().report('visual', visualFormatSnapshot(state))
  }, [text])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dom.setAttribute('spellcheck', spellCheck ? 'true' : 'false')
  }, [spellCheck])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.setProps({ nodeViews: createNodeViews(baseDir) })
  }, [baseDir])

  useEffect(() => {
    return registerFormatTarget('visual', {
      'format.bold': () => runEditorCommand(toggleStrong()),
      'format.italic': () => runEditorCommand(toggleEm()),
      'format.strikethrough': () => runEditorCommand(toggleStrikethrough()),
      'format.code': () => runEditorCommand(toggleCode()),
      'format.link': () => runEditorCommand(toggleLink()),
      'format.image': () => runEditorCommand(openImageDialog()),
      'format.table': () => runEditorCommand(openTableDialog()),
      'format.codeBlock': () => runEditorCommand(insertCodeBlock()),
      'format.quote': () => runEditorCommand(toggleBlockquote()),
      'format.bulletList': () => runEditorCommand(toggleBulletList()),
      'format.orderedList': () => runEditorCommand(toggleOrderedList()),
      'format.taskList': () => runEditorCommand(toggleTaskList()),
      'format.footnote': () => runEditorCommand(insertFootnote()),
      'format.math': () => runEditorCommand(insertMath(true)),
      'format.horizontalRule': () => runEditorCommand(insertHorizontalRule()),
      'format.heading1': () => runEditorCommand(setHeading(1)),
      'format.heading2': () => runEditorCommand(setHeading(2)),
      'format.heading3': () => runEditorCommand(setHeading(3)),
      'format.heading4': () => runEditorCommand(setHeading(4)),
      'format.heading5': () => runEditorCommand(setHeading(5)),
      'format.heading6': () => runEditorCommand(setHeading(6)),
      'format.paragraph': () => runEditorCommand(setParagraph())
    })
  }, [])

  return <div className="marki-visual-editor" ref={hostRef} />
}
