# Marki — Feature specification

Target: feature parity with a distraction-free Markdown studio, plus a few
additions. Everything below is implemented against the contracts in
`src/shared/types.ts` and `src/shared/ipc.ts`.

## F1 — Post-syntax visual editing

Open any `.md` and edit it as formatted text. No preview pane, no compile step.
Supported constructs, all editable in place:

- Headings 1–6, paragraphs, blockquotes (nestable), horizontal rules
- Bold, italic, strikethrough, inline code, links, autolinks
- Bullet / ordered / task lists, arbitrarily nested, with tight-vs-loose preserved
- Fenced code blocks with language selection and syntax highlighting
- Tables (GFM) with per-column alignment
- Images, including sizing and alignment
- Footnotes (`[^1]` with a definition block)
- Math, inline `$x$` and block `$$…$$`
- Raw HTML blocks and inline HTML, edited as source
- YAML / TOML / JSON front matter, edited as a folded, highlighted block

Markers are hidden until the caret enters the node (post-syntax behaviour): a
heading shows as a heading, but placing the caret inside reveals the `##` prefix
in a dimmed gutter affordance rather than mutating the text.

**Input rules** (type-to-format): `# ` … `###### `, `- `, `* `, `1. `, `- [ ] `,
`> `, ` ``` `, `---`, `**bold**`, `_italic_`, `` `code` ``, `~~strike~~`,
`$math$`. Emphasis rules need a non-word character before the opening
delimiter, so `snake_case_name` is left alone. Smart typography (curly quotes,
`--` to em dash, ellipsis) when `editor.smartTypography` is on. Backspace right
after a rule fires undoes it.

**Backspace at the start of a block** unwraps it before joining: a heading
becomes a paragraph, a list item is lifted out of its list, and only then does
the next Backspace merge with the block above. Deleting every character of
`# Some Header` therefore takes one extra Backspace to remove the heading
itself.

## F2 — Source view

- `view.modeSource` shows the raw Markdown in CodeMirror 6 with Markdown
  highlighting; `view.modeSplit` shows visual and source side by side.
- Split mode keeps both in sync: the source is regenerated on visual edits
  (debounced 150 ms) and the visual doc is re-parsed from the source (debounced
  250 ms), with the caret position preserved by mapping character offsets.
- Returning to visual mode restores the caret to the equivalent position.
- Whatever the mode, the file written to disk is standard Markdown.

### Round-trip guarantees

`serializeMarkdown(parseMarkdown(text)) === text` holds for every fixture in
`tests/fixtures`, so opening and saving a file that is already in Marki's
canonical form leaves the bytes untouched. Front matter is preserved verbatim,
including invalid YAML.

A file that is *not* in canonical form is rewritten to it on the first save.
These normalisations are deliberate, because carrying the original form through
the document model would cost more than it is worth:

- Paragraphs are reflowed. A soft line break means nothing in markdown, so it
  becomes a space, and where lines fall on save is decided by
  `markdown.wrapColumn` (0, the default, writes one line per paragraph).
  Preserving the author's wrap points is not an option: the editor needs
  `white-space: pre-wrap`, which would render them as hard line breaks.
- Table delimiter rows collapse to their shortest form (`| :--- | ---: |`), and
  cells are padded only when `markdown.prettyTables` is on.
- Footnote definitions move to the end of the document, in first-reference
  order, with continuation lines indented four spaces.
- Bullet, emphasis and strong markers follow the configured style rather than
  whatever the file used.

## F3 — Tables

- Insert via `format.table` with a size picker.
- Row/column add, delete, move; column alignment (left/center/right).
- Cell contents accept inline Markdown (links, code, images, emphasis).
- Tab/Shift-Tab move between cells, Enter adds a row at the end.
- On serialise, when `markdown.prettyTables` is on, pad cells with spaces so the
  source columns align.

## F4 — Images

- Drag and drop from Finder, paste from clipboard, or the image dialog.
- Dropped files are copied into `<doc dir>/<files.imageFolder>/`, deduplicated by
  name, and referenced with a path relative to the document.
- The image dialog edits: source path or URL, alt text, title, width, and
  alignment (inline / left / center / right / float-right).
- Plain `![alt](src "title")` is emitted whenever it is sufficient; width and
  alignment fall back to an `<img>` tag with inline style, which round-trips.

## F5 — Code blocks

- Nested CodeMirror instance per block with highlighting for the common
  languages (js/ts, python, html, css, json, markdown) via `@codemirror/language-data`.
- A language picker on the block; `Mod-Enter` or arrow-down at the end exits the
  block; Backspace in an empty block removes it.

## F6 — Front matter

- Detected only at position 0: `---` (YAML), `+++` (TOML), `{ … }` (JSON).
- Rendered as a distinct card at the top of the document, highlighted, collapsed
  by default, expandable for editing. Never re-ordered or reformatted on save.

## F7 — Typewriter mode

- Keeps the caret on a fixed horizontal line, scrolling the document under it.
- The insertion guide is draggable: `editor.typewriter.anchor` (0..1) positions
  it, defaulting to 0.45 so there is more context above than below.
- Optional faint guide rule, optional smooth scrolling.
- Must not fight native scrolling: only re-anchors on selection change or input,
  never during an explicit user scroll.

## F8 — Focus mode

- `sentence`, `paragraph` or `line` granularity; everything else is dimmed to
  `editor.focus.dimOpacity`.
- Sentence detection handles `.`, `?`, `!`, closing quotes/brackets, and common
  abbreviations (`e.g.`, `i.e.`, `Mr.`, `Dr.`, `etc.`) so it does not split mid-sentence.
- Implemented as ProseMirror decorations; transitions are animated over 120 ms.

## F9 — Caret

- Configurable colour, thickness, blink on/off and blink pattern
  (`solid`, `smooth`, `phase`, `expand`).
- **HDR brightness**: when enabled on an HDR-capable display the caret is
  rendered brighter than `#FFFFFF` by clipping an HDR image to the caret shape.
  Detect with `matchMedia('(dynamic-range: high)')` and degrade silently.
- The native caret is hidden (`caret-color: transparent`) and a custom element
  is positioned from `EditorView.coordsAtPos`.

## F10 — Folder pane

- Open a folder as a workspace; lazy-loaded tree, markdown files highlighted.
- New file / new folder / rename / duplicate / reveal in Finder / move to trash
  via context menu; inline rename.
- Live updates from the file watcher; external edits to an open, clean document
  are reloaded, and to a dirty document raise a conflict prompt.
- Filter box that matches on file name.

## F11 — Documents & tabs

- Multiple open documents in a tab strip, with dirty indicators.
- Autosave after `files.autosaveDelay` ms of inactivity (0 disables), plus
  `Mod-S`. Save-as, close-tab with discard confirmation, recent files.
- The window proxy icon and edited dot reflect the active document.

## F12 — Command palette, find, settings

- `Mod-K` palette listing every `AppCommand` with fuzzy matching and shortcuts.
  The palette, the native menu and both editors' keymaps share one set of
  shortcuts: `Mod-1`…`Mod-6` headings, `Mod-0` paragraph, `Mod-Shift-.` quote,
  `Mod-Shift-8/7/9` bullet/ordered/task list, `Mod-Shift-M` math (`Mod-M` is
  the system Minimize), `Mod-Shift-L` rule, `Mod-Alt-T` table. Tabs switch with
  `Ctrl-1`…`Ctrl-9` on macOS and `Alt-1`…`Alt-9` elsewhere.
- `Mod-F` find & replace in both views, with match highlighting and counts.
- A settings panel covering theme, typography, typewriter, focus, caret,
  Markdown serialisation and files; changes apply live.

## F13 — Themes & typography

- `system`, `light`, `dark`, `sepia`, `midnight`, driven entirely by the tokens
  in `styles/tokens.css`.
- Configurable body/mono font stacks, font size, line height and measure.
- Zoom in/out/reset adjusts font size in 1 px steps between 12 and 28.

## F14 — Bottom bar

A format toolbar centred at the bottom of the editor: a text-style menu
(paragraph, H1–H6), inline marks, lists and quote, and inserts (code block,
table, image, math, footnote, rule). Buttons reflect the formatting at the
caret and work in every mode: in source mode they edit the markdown syntax
(wrapping or unwrapping `**`, adding `## `, list markers and so on). In split
mode they apply to whichever pane was focused last. Clicking a button never
takes focus from the editor.

Either side of the toolbar, small and muted: word count and reading time
(character count on hover) on the left; caret line:column (source mode) and
the save state on the right. The side sections follow `showStatusBar` and are
hidden when the window is narrow.

---

# Shared renderer contracts

These interfaces are the integration surface between streams. Implement them
exactly; do not rename fields.

## `state/settings-store.ts`

```ts
interface SettingsState {
  settings: Settings            // always populated; starts as DEFAULT_SETTINGS
  loaded: boolean
  patch(patch: SettingsPatch): Promise<void>   // optimistic, then reconciles
  reset(): Promise<void>
  hydrate(): Promise<void>      // called once at boot; subscribes to onChange
}
export const useSettings: UseBoundStore<StoreApi<SettingsState>>
```

## `state/workspace-store.ts`

```ts
interface WorkspaceState {
  info: WorkspaceInfo | null
  tree: FileNode | null
  expanded: Set<string>          // directory paths
  selected: string | null
  filter: string
  openFolder(root?: string): Promise<void>   // no arg => native picker
  closeFolder(): Promise<void>
  toggleExpanded(path: string): Promise<void>
  setFilter(filter: string): void
  applyWatchEvent(event: WatchEvent): void
  refresh(path?: string): Promise<void>
}
export const useWorkspace: UseBoundStore<StoreApi<WorkspaceState>>
```

## `state/document-store.ts`

```ts
interface OpenDocument {
  id: string                 // uuid, stable across save-as
  path: string | null        // null => untitled
  title: string              // basename or "Untitled"
  text: string               // canonical markdown text
  savedText: string          // last text written to disk
  dirty: boolean
  mode: EditorMode           // per-document override of settings.editor.mode
  scrollTop: number
  selection: number | null   // character offset, used to restore on mode switch
}

interface DocumentState {
  documents: OpenDocument[]
  activeId: string | null
  open(path: string): Promise<string>        // returns document id
  newDocument(): string
  close(id: string): Promise<void>
  activate(id: string): void
  setText(id: string, text: string): void    // marks dirty, schedules autosave
  save(id: string): Promise<void>
  saveAs(id: string): Promise<void>
  setMode(id: string, mode: EditorMode): void
  reloadFromDisk(id: string): Promise<void>
  /** Editors report caret position so the bottom bar can show Ln/Col. */
  setSelection(id: string, offset: number | null): void
  /** Editors report scroll position so it survives a tab switch. */
  setScrollTop(id: string, scrollTop: number): void
  /** True while a write to disk is in flight; drives the "Saving…" indicator. */
  savingIds: string[]
}
export const useDocuments: UseBoundStore<StoreApi<DocumentState>>
```

## `state/ui-store.ts`

```ts
type DialogKind = 'link' | 'image' | 'table' | 'settings' | 'palette' | 'find' | null

interface Toast {
  id: string
  kind: 'info' | 'error'
  message: string
  /** Optional inline action, e.g. "Reload" on an external-change notice. */
  action?: { label: string; run(): void }
}

interface UiState {
  dialog: DialogKind
  dialogPayload: unknown
  toasts: Toast[]
  openDialog(kind: Exclude<DialogKind, null>, payload?: unknown): void
  closeDialog(): void
  toast(kind: 'info' | 'error', message: string, action?: Toast['action']): void
  dismissToast(id: string): void
}
export const useUi: UseBoundStore<StoreApi<UiState>>
```

## Command bus — `state/commands.ts`

A single dispatcher so the native menu, the palette and keybindings share one
path. Editor streams register handlers for the commands they own.

```ts
type CommandHandler = () => void | Promise<void>
export function registerCommand(id: AppCommand, handler: CommandHandler): () => void
export function runCommand(id: AppCommand): void
export function commandIsRegistered(id: AppCommand): boolean
```

`format.*` commands are the exception: both editors are mounted in split mode,
so each registers its handlers with `registerFormatTarget(kind, handlers)` in
`editor/format-router.ts`, which owns the commands and forwards each one to the
active editor.

## Editor component contracts

```tsx
// editor/visual/VisualEditor.tsx
interface VisualEditorProps {
  documentId: string
  text: string                          // markdown in
  onChange(text: string): void          // markdown out, debounced by caller
  /** Directory used to resolve relative image paths. */
  baseDir: string | null
  /**
   * Absolute path of the document, or null when untitled. Passed straight to
   * `assets.importImage` so dropped images land next to the real file — the
   * editor must not synthesise a path from `baseDir`.
   */
  documentPath: string | null
}

// editor/source/SourceEditor.tsx
interface SourceEditorProps {
  documentId: string
  text: string
  onChange(text: string): void
}
```

## Markdown core API — `editor/markdown/`

```ts
// schema.ts
export const schema: Schema          // includes tables, footnotes, math, raw html, front matter

// parse.ts
export function parseMarkdown(text: string): Node

// serialize.ts
export interface SerializeOptions {
  bullet?: '-' | '*' | '+'
  emphasis?: '_' | '*'
  strong?: '__' | '**'
  prettyTables?: boolean
}
export function serializeMarkdown(doc: Node, options?: SerializeOptions): string

// frontmatter.ts
export function splitFrontMatter(text: string): { frontMatter: FrontMatter | null; body: string }
export function joinFrontMatter(frontMatter: FrontMatter | null, body: string): string
```

`serializeMarkdown(parseMarkdown(text))` must equal `text` for all fixtures in
`tests/fixtures/`, modulo normalisation that is explicitly allowed (trailing
whitespace, final newline, list bullet style).
