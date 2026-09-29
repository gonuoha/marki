import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { ThemeName } from '@shared/types'
import { App } from '@/app/App'
import { basename } from '@/lib/path'
import { registerCommand, runCommand } from '@/state/commands'
import { handleExternalFileChange, useDocuments } from '@/state/document-store'
import { useSettings } from '@/state/settings-store'
import { useUi } from '@/state/ui-store'
import { useWorkspace } from '@/state/workspace-store'
import '@/styles/tokens.css'

function resolveTheme(theme: ThemeName): string {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = resolveTheme(theme)
}

function applyTypography(): void {
  const { typography, focus } = useSettings.getState().settings.editor
  const root = document.documentElement.style
  root.setProperty('--font-body', typography.bodyFont)
  root.setProperty('--font-mono', typography.monoFont)
  root.setProperty('--font-size-body', `${typography.fontSize}px`)
  root.setProperty('--line-height-body', String(typography.lineHeight))
  root.setProperty('--measure', `${typography.measure}px`)
  root.setProperty('--focus-dim-opacity', String(focus.dimOpacity))
}

function registerShellCommands(): void {
  registerCommand('file.new', () => {
    useDocuments.getState().newDocument()
  })

  registerCommand('file.open', async () => {
    const paths = await window.marki.file.pickOpen()
    for (const path of paths) await useDocuments.getState().open(path)
  })

  registerCommand('file.openFolder', async () => {
    await useWorkspace.getState().openFolder()
  })

  registerCommand('file.save', async () => {
    const { activeId, save } = useDocuments.getState()
    if (activeId) await save(activeId)
  })

  registerCommand('file.saveAs', async () => {
    const { activeId, saveAs } = useDocuments.getState()
    if (activeId) await saveAs(activeId)
  })

  registerCommand('file.closeTab', async () => {
    const { activeId, close } = useDocuments.getState()
    if (activeId) await close(activeId)
  })

  registerCommand('file.revealInFinder', async () => {
    const { activeId, documents } = useDocuments.getState()
    const doc = documents.find((d) => d.id === activeId)
    if (doc?.path) await window.marki.file.reveal(doc.path)
  })

  registerCommand('view.modeVisual', () => setActiveMode('visual'))
  registerCommand('view.modeSource', () => setActiveMode('source'))
  registerCommand('view.modeSplit', () => setActiveMode('split'))

  registerCommand('view.toggleSidebar', () => {
    const { settings, patch } = useSettings.getState()
    void patch({ editor: { showSidebar: !settings.editor.showSidebar } })
  })

  registerCommand('view.toggleTypewriter', () => {
    const { settings, patch } = useSettings.getState()
    void patch({
      editor: { typewriter: { enabled: !settings.editor.typewriter.enabled } }
    })
  })

  registerCommand('view.focusOff', () => {
    void useSettings.getState().patch({ editor: { focus: { mode: 'off' } } })
  })

  registerCommand('view.focusSentence', () => {
    void useSettings.getState().patch({ editor: { focus: { mode: 'sentence' } } })
  })

  registerCommand('view.focusParagraph', () => {
    void useSettings.getState().patch({ editor: { focus: { mode: 'paragraph' } } })
  })

  registerCommand('view.zoomIn', () => adjustZoom(1))
  registerCommand('view.zoomOut', () => adjustZoom(-1))
  registerCommand('view.zoomReset', () => {
    const { settings, patch } = useSettings.getState()
    void patch({ editor: { typography: { fontSize: 17 } } })
  })

  registerCommand('app.settings', () => {
    useUi.getState().openDialog('settings')
  })

  registerCommand('app.commandPalette', () => {
    useUi.getState().openDialog('palette')
  })
}

function setActiveMode(mode: 'visual' | 'source' | 'split'): void {
  const { activeId, setMode } = useDocuments.getState()
  if (activeId) setMode(activeId, mode)
  void useSettings.getState().patch({ editor: { mode } })
}

function adjustZoom(delta: number): void {
  const { settings, patch } = useSettings.getState()
  const next = Math.min(28, Math.max(12, settings.editor.typography.fontSize + delta))
  void patch({ editor: { typography: { fontSize: next } } })
}

function ThemeSync() {
  const theme = useSettings((s) => s.settings.theme)

  useEffect(() => {
    applyTheme(theme)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (useSettings.getState().settings.theme === 'system') applyTheme('system')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  useEffect(() => {
    return useSettings.subscribe((state, prev) => {
      if (state.settings.theme !== prev.settings.theme) applyTheme(state.settings.theme)
      if (
        state.settings.editor.typography !== prev.settings.editor.typography ||
        state.settings.editor.focus.dimOpacity !== prev.settings.editor.focus.dimOpacity
      ) {
        applyTypography()
      }
    })
  }, [])

  return null
}

async function boot(): Promise<void> {
  await useSettings.getState().hydrate()
  applyTheme(useSettings.getState().settings.theme)
  applyTypography()
  registerShellCommands()

  window.marki.app.onMenuCommand(({ command }) => runCommand(command))

  window.marki.file.onOpenPath((path) => {
    void useDocuments
      .getState()
      .open(path)
      .catch((err) => {
        console.error('[boot] open path failed', err)
        if (err instanceof Error && err.message === 'file is not valid UTF-8 text') return
        useUi.getState().toast('error', `Could not open ${basename(path)}.`)
      })
  })

  window.marki.workspace.onWatchEvent((event) => {
    useWorkspace.getState().applyWatchEvent(event)
    if (event.kind === 'change') handleExternalFileChange(event.path)
  })

  window.marki.window.onRequestClose(async () => {
    const { documents, close } = useDocuments.getState()
    if (documents.length === 0) {
      window.marki.window.confirmClose()
      return
    }

    for (const doc of [...documents]) {
      if (!doc.dirty) continue
      await close(doc.id)
      if (useDocuments.getState().documents.some((d) => d.id === doc.id)) return
    }

    if (!useDocuments.getState().documents.some((d) => d.dirty)) {
      window.marki.window.confirmClose()
    }
  })

  // Files the app was launched with. Drained here, after the handler above is in
  // place, so nothing depends on main and the renderer winning a race.
  const launchFiles = await window.marki.file.takePendingOpen()
  for (const path of launchFiles) {
    try {
      await useDocuments.getState().open(path)
    } catch (err) {
      console.error('[boot] open launch file failed', err)
      useUi.getState().toast('error', `Could not open ${basename(path)}.`)
    }
  }

  const { settings } = useSettings.getState()
  if (settings.files.restoreSession && settings.files.recentWorkspaces[0]) {
    try {
      await useWorkspace.getState().openFolder(settings.files.recentWorkspaces[0])
    } catch (err) {
      console.error('[boot] restore workspace failed', err)
    }
  }
}

const root = createRoot(document.getElementById('root')!)

void boot().then(() => {
  root.render(
    <StrictMode>
      <ThemeSync />
      <App />
    </StrictMode>
  )
})
