/**
 * Domain types shared by the main process, the preload bridge and the renderer.
 * This file is the single source of truth: neither side may redeclare these shapes.
 */

/* ------------------------------------------------------------------ */
/* Workspace / files                                                    */
/* ------------------------------------------------------------------ */

export type FileKind = 'file' | 'directory'

export interface FileNode {
  /** Absolute path on disk. Stable identity for a node. */
  path: string
  /** Basename including extension, e.g. `notes.md`. */
  name: string
  kind: FileKind
  /** Directories only. Undefined means "not yet loaded". */
  children?: FileNode[]
  /** Files only, bytes. */
  size?: number
  /** Epoch millis of last modification. */
  modifiedAt?: number
  /** True for markdown documents Marki can open in the visual editor. */
  isMarkdown?: boolean
}

export interface WorkspaceInfo {
  /** Absolute path of the opened root folder. */
  root: string
  name: string
}

export type WatchEventKind = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'

export interface WatchEvent {
  kind: WatchEventKind
  path: string
  root: string
}

/* ------------------------------------------------------------------ */
/* Documents                                                            */
/* ------------------------------------------------------------------ */

export interface FileReadResult {
  path: string
  content: string
  modifiedAt: number
  /** True when the file was decoded as UTF-8 text without replacement chars. */
  ok: boolean
}

export interface FileWriteResult {
  path: string
  modifiedAt: number
}

/** Front matter detected at the top of a markdown document. */
export type FrontMatterFormat = 'yaml' | 'toml' | 'json'

export interface FrontMatter {
  format: FrontMatterFormat
  /** Raw text between the fences, excluding the fences themselves. */
  raw: string
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type ThemeName = 'system' | 'light' | 'dark' | 'sepia' | 'midnight'

export type FocusMode = 'off' | 'sentence' | 'paragraph' | 'line'

export type CaretBlinkPattern = 'solid' | 'smooth' | 'phase' | 'expand'

export type EditorMode = 'visual' | 'source' | 'split'

export interface CaretSettings {
  /** CSS color. */
  color: string
  /** Pixels. */
  thickness: number
  blink: boolean
  blinkPattern: CaretBlinkPattern
  /**
   * Render the caret brighter than #FFFFFF on HDR-capable displays.
   * Implemented by clipping an HDR image to the caret shape.
   */
  hdrBrightness: boolean
}

export interface TypewriterSettings {
  enabled: boolean
  /**
   * Vertical anchor of the insertion guide as a fraction of the viewport
   * height. 0.5 is dead centre; smaller values leave more room below.
   */
  anchor: number
  /** Draw a faint horizontal rule at the insertion guide. */
  showGuide: boolean
  /** Animate the document scroll instead of jumping. */
  smoothScroll: boolean
}

export interface FocusSettings {
  mode: FocusMode
  /** Opacity applied to out-of-focus text, 0..1. */
  dimOpacity: number
  /** Also dim images, tables and code blocks outside focus. */
  dimBlocks: boolean
}

export interface TypographySettings {
  /** CSS font-family stack for body text in the visual editor. */
  bodyFont: string
  /** CSS font-family stack for code and the source editor. */
  monoFont: string
  /** Pixels. */
  fontSize: number
  lineHeight: number
  /** Max width of the text column in pixels. */
  measure: number
}

export interface EditorSettings {
  mode: EditorMode
  typewriter: TypewriterSettings
  focus: FocusSettings
  caret: CaretSettings
  typography: TypographySettings
  /** Show the folder pane. */
  showSidebar: boolean
  /** Width of the folder pane in pixels, clamped to the tokens' min/max. */
  sidebarWidth: number
  /** Show the status bar with word/char counts. */
  showStatusBar: boolean
  /** Spell check in the visual editor. */
  spellCheck: boolean
  /** Smart quotes, dashes and ellipses as you type. */
  smartTypography: boolean
}

export interface MarkdownSettings {
  /** Bullet character used when serialising unordered lists. */
  bullet: '-' | '*' | '+'
  /** Character used for emphasis. */
  emphasis: '_' | '*'
  /** Character used for strong emphasis. */
  strong: '__' | '**'
  /** `atx` => `# Heading`, `setext` => underlined headings. */
  headingStyle: 'atx' | 'setext'
  /** Pad table cells so source columns line up. */
  prettyTables: boolean
  /** Hard-wrap paragraphs at this column on save. 0 disables wrapping. */
  wrapColumn: number
}

export interface FilesSettings {
  /** Autosave debounce in milliseconds. 0 disables autosave. */
  autosaveDelay: number
  /** Directory (relative to the document) used for dropped images. */
  imageFolder: string
  /** Most recently opened workspace roots, newest first. */
  recentWorkspaces: string[]
  /** Most recently opened files, newest first. */
  recentFiles: string[]
  /** Reopen the last workspace and documents on launch. */
  restoreSession: boolean
}

export interface Settings {
  theme: ThemeName
  editor: EditorSettings
  markdown: MarkdownSettings
  files: FilesSettings
}

/**
 * A patch applied over the current settings. Nested sections merge; arrays and
 * primitives are replaced wholesale, so `{ editor: { focus: { mode: 'off' } } }`
 * is a legal patch that leaves the rest of `editor.focus` untouched.
 */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export type SettingsPatch = DeepPartial<Settings>

/* ------------------------------------------------------------------ */
/* Menu / application commands                                          */
/* ------------------------------------------------------------------ */

/**
 * Commands emitted by the native menu and consumed by the renderer.
 * The renderer registers the same ids in its command palette.
 */
export type AppCommand =
  | 'file.new'
  | 'file.open'
  | 'file.openFolder'
  | 'file.save'
  | 'file.saveAs'
  | 'file.closeTab'
  | 'file.revealInFinder'
  | 'edit.find'
  | 'view.modeVisual'
  | 'view.modeSource'
  | 'view.modeSplit'
  | 'view.toggleSidebar'
  | 'view.toggleTypewriter'
  | 'view.focusOff'
  | 'view.focusSentence'
  | 'view.focusParagraph'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.zoomReset'
  | 'format.bold'
  | 'format.italic'
  | 'format.strikethrough'
  | 'format.code'
  | 'format.link'
  | 'format.image'
  | 'format.table'
  | 'format.codeBlock'
  | 'format.quote'
  | 'format.bulletList'
  | 'format.orderedList'
  | 'format.taskList'
  | 'format.footnote'
  | 'format.math'
  | 'format.horizontalRule'
  | 'format.heading1'
  | 'format.heading2'
  | 'format.heading3'
  | 'format.heading4'
  | 'format.heading5'
  | 'format.heading6'
  | 'format.paragraph'
  | 'app.settings'
  | 'app.commandPalette'

export interface MenuCommandPayload {
  command: AppCommand
}

/* ------------------------------------------------------------------ */
/* Asset import                                                        */
/* ------------------------------------------------------------------ */

export interface ImportImageRequest {
  /** Absolute path of the document the image is being dropped into. */
  documentPath: string | null
  /** Absolute source path when the file came from disk. */
  sourcePath?: string
  /** Raw bytes when the image came from the clipboard or a data transfer. */
  bytes?: Uint8Array
  /** Preferred file name, e.g. `screenshot.png`. */
  fileName: string
}

export interface ImportImageResult {
  /** Absolute path of the stored asset. */
  absolutePath: string
  /** Path to write into the markdown, relative to the document when possible. */
  markdownPath: string
}

/* ------------------------------------------------------------------ */
/* Window state                                                        */
/* ------------------------------------------------------------------ */

export interface WindowDocumentState {
  /** Absolute path, or null for an unsaved scratch document. */
  path: string | null
  /** Drives the macOS proxy icon and the close-confirmation dot. */
  edited: boolean
}
