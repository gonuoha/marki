# Marki — Architecture

Marki is a distraction-free Markdown studio: a WYSIWYG editor for Markdown that
never shows a preview pane, keeps every document as a plain `.md` file on disk,
and has no account, no cloud and no telemetry.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Shell | Electron 39 | Native menus, file system access, macOS window chrome |
| Build | electron-vite 5 + Vite 7 | One config for main / preload / renderer, fast HMR |
| UI | React 19 + TypeScript (strict) | Component model for chrome; the editor itself is imperative |
| Visual editor | ProseMirror | Document model that can round-trip to Markdown losslessly |
| Source editor | CodeMirror 6 | Syntax highlighting, large-document performance |
| Markdown | markdown-it (parse) + prosemirror-markdown (serialise) | CommonMark + GFM, customisable serialiser |
| State | Zustand | Small, no provider tree, works outside React for editor plugins |
| Math | KaTeX | Fast, synchronous, no network |

## Process model

```
┌───────────────────────── main process ─────────────────────────┐
│ window lifecycle · native menus · dialogs · fs · chokidar watch │
│ settings persistence (userData/settings.json)                   │
└───────────────┬────────────────────────────────────────────────┘
                │ ipcMain.handle / webContents.send
┌───────────────┴──── preload (contextIsolation: true) ──────────┐
│ contextBridge.exposeInMainWorld('marki', api)                   │
│ the ONLY surface the renderer can reach; no node in renderer    │
└───────────────┬────────────────────────────────────────────────┘
                │ window.marki (typed by src/shared/ipc.ts)
┌───────────────┴──────────── renderer ──────────────────────────┐
│ React chrome  ·  Zustand stores  ·  ProseMirror  ·  CodeMirror  │
└─────────────────────────────────────────────────────────────────┘
```

Security posture: `nodeIntegration: false`, `contextIsolation: true`,
`sandbox: false` (preload needs `fs` free helpers via ipc only), no remote
module, and a CSP that forbids remote script. All disk access happens in main.

## Source layout

```
src/
  shared/            # contracts — imported by BOTH sides, no runtime deps
    types.ts         # domain types (FileNode, Settings, AppCommand, …)
    ipc.ts           # channel names + the MarkiApi interface
    settings.ts      # defaults, merge, normalisation
  main/
    index.ts         # app lifecycle, window creation
    window.ts        # BrowserWindow factory, titlebar, state persistence
    menu.ts          # native menu -> AppCommand dispatch
    ipc/
      workspace.ts   # folder open, tree read, chokidar watching
      files.ts       # read/write/create/rename/trash/reveal/dialogs
      assets.ts      # image import into the document's asset folder
      settings.ts    # load/patch/reset + broadcast
      app.ts         # platform info, error + discard dialogs
    services/
      settings-store.ts
      watcher.ts
      tree.ts        # directory -> FileNode
  preload/
    index.ts         # the contextBridge implementation of MarkiApi
    index.d.ts       # window.marki typing
  renderer/
    index.html
    src/
      main.tsx
      app/
        App.tsx      # layout shell
        TitleBar.tsx  Sidebar.tsx  TabBar.tsx
        BottomBar.tsx       # stats | FormatToolbar | caret + save state
        FormatToolbar.tsx   # text-style menu and format buttons
      state/
        settings-store.ts   # mirrors main's settings, optimistic patches
        workspace-store.ts  # tree, selection, expansion
        document-store.ts   # open documents, dirty state, autosave
        ui-store.ts         # dialogs, palette, toasts
        format-store.ts     # focused editor + active formats, for the toolbar
      editor/
        format-router.ts    # routes format.* commands to the active editor
        markdown/           # PURE, no DOM: schema + parse + serialise
          schema.ts
          parse.ts
          serialize.ts
          frontmatter.ts
        visual/             # ProseMirror view layer
          VisualEditor.tsx
          plugins/          # typewriter, focus, caret, placeholder, dropimage
          nodeviews/        # code block, image, math, html, footnote
          commands.ts  keymap.ts  inputrules.ts
        source/
          SourceEditor.tsx  # CodeMirror 6
          source-format.ts  # format commands as markdown syntax edits
          markdown-theme.ts
      features/
        files/        # folder pane tree UI
        dialogs/      # link, image, table, settings
        palette/      # command palette
        find/         # find & replace
      styles/
        tokens.css    # design tokens + themes (authored up front)
        editor.css
tests/                # vitest: markdown round-trip, settings merge, commands
docs/
```

## Key design decisions

### 1. One document model, two views

The Markdown text is the source of truth on disk. In memory a document is held
as a ProseMirror `Node`. The source view is generated by serialising that node,
and edits in the source view are re-parsed back into it. Switching modes must be
lossless for any document Marki can represent; anything it cannot represent
round-trips through a `raw_html` or `raw_block` node that stores the original
text verbatim. **Round-trip fidelity is the single most important correctness
property in this app** — it is covered by `tests/markdown-roundtrip.test.ts`.

### 2. The markdown layer is pure

`src/renderer/src/editor/markdown/**` must not import React, ProseMirror view,
or anything DOM-bound. It is unit tested in isolation under Node. This keeps the
hardest logic (parse/serialise fidelity) testable without an editor instance.

### 3. Writing modes are ProseMirror plugins, not React

Typewriter and focus mode need per-keystroke access to selection geometry.
They are implemented as ProseMirror plugins that set decorations and adjust
`scrollTop`, reading settings from the Zustand store directly (stores are usable
outside React via `useStore.getState()` / `subscribe`).

### 4. Settings live in main, mirrored in the renderer

`settings.json` in `app.getPath('userData')` is authoritative. The renderer
patches through IPC and receives the merged result; main broadcasts changes to
every window so multiple windows stay consistent.

### 5. Assets are relative

Dropping an image copies it into `<document dir>/<files.imageFolder>/` and
writes a path relative to the document, so the folder stays portable. Images are
displayed via `file.readAsDataUrl` because the renderer cannot read disk.

## Module ownership (parallel implementation)

| Stream | Owns | Depends on |
| --- | --- | --- |
| `platform` | `src/main/**`, `src/preload/index.ts` | `src/shared/**` |
| `markdown-core` | `src/renderer/src/editor/markdown/**`, its tests | `src/shared/**` |
| `shell-ui` | `src/renderer/src/app/**`, `state/**`, `features/files/**`, `styles/**` | `src/shared/**` |
| `visual-editor` | `src/renderer/src/editor/visual/**`, `features/dialogs/**` | `markdown-core`, `shell-ui` |
| `source-and-modes` | `src/renderer/src/editor/source/**`, `visual/plugins/**`, `features/palette`, `features/find`, settings UI | `markdown-core`, `shell-ui` |

No two streams write the same file. Cross-stream integration happens only
through `src/shared/**`, the Zustand store interfaces, and the component props
documented in `docs/FEATURES.md`.
