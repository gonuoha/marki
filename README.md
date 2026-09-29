# Marki

A distraction-free **markdown studio** for the desktop. Edit Markdown visually — no preview pane, no compile step — or drop into a syntax-highlighted source view whenever you want the raw text. Documents stay as plain `.md` files in a folder you choose. No account, no cloud, no telemetry.

## Running it

```bash
npm install
npm run dev
```

Then use **Open Folder…** (`Cmd-Shift-O`) and point Marki at `examples/` for a demo workspace.

## Scripts

| Command             | What it does                                   |
| ---                 | ---                                            |
| `npm run dev`       | Electron + Vite with hot reload                |
| `npm run build`     | Typecheck and build main, preload and renderer |
| `npm run typecheck` | `tsc --noEmit` over both project references    |
| `npm test`          | Vitest — markdown round-trip and unit tests    |
| `npm run package`   | Unpacked macOS app via electron-builder        |

## What's inside

- **Visual editing** of headings, emphasis, links, lists, task lists, tables, images, code blocks, footnotes, math and raw HTML
- **Source view** with Markdown highlighting, and a synced split mode
- **Front matter** in YAML, TOML or JSON, highlighted and editable
- **Typewriter mode** that pins the caret to one line and scrolls under it
- **Focus mode** that dims everything except the current sentence or paragraph
- **Configurable caret**, including an HDR mode that renders brighter than white
- **Folder pane** with live file watching, rename, trash and reveal
- **Command palette**, find & replace, five themes and configurable typography

## Layout

```
src/shared/     contracts shared by every process (types, IPC, settings)
src/main/       Electron main: windows, menus, file system, watching
src/preload/    the contextBridge surface, the renderer's only way out
src/renderer/   React chrome, Zustand stores, ProseMirror + CodeMirror editors
tests/          markdown round-trip and unit tests
docs/           ARCHITECTURE.md and FEATURES.md
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the process model and [docs/FEATURES.md](docs/FEATURES.md) for the full feature specification.
