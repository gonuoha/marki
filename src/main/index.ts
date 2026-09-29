import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { registerAllIpc } from './ipc'
import { buildApplicationMenu } from './menu'
import { initSettingsStore, onSettingsChange } from './services/settings-store'
import { enqueueOpenFiles } from './services/open-queue'
import { createWindow, forwardOpenFile, registerWindowIpc } from './window'

let menuBootstrapped = false

/**
 * Paths passed on the command line, as in `marki notes.md`. The argument list
 * also holds the executable, Electron's own switches and, in development, the
 * app directory, so anything that is not an existing file is discarded.
 */
function fileArgs(argv: string[]): string[] {
  return argv
    .slice(1)
    .filter((arg) => !arg.startsWith('-'))
    .map((arg) => resolve(arg))
    .filter((path) => {
      try {
        return statSync(path).isFile()
      } catch {
        return false
      }
    })
}

enqueueOpenFiles(fileArgs(process.argv))

function setupApplicationMenu(): void {
  buildApplicationMenu({
    onNewWindow: () => {
      void createWindow()
    }
  })
  menuBootstrapped = true
}

function rebuildMenu(): void {
  if (!menuBootstrapped) return
  setupApplicationMenu()
}

async function bootstrap(): Promise<void> {
  await initSettingsStore()
  registerAllIpc()
  registerWindowIpc()

  onSettingsChange(() => {
    rebuildMenu()
  })

  setupApplicationMenu()

  // Launch files stay in the queue; the renderer drains them when it is ready.
  await createWindow()
}

void app.whenReady().then(bootstrap)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow()
  }
})

app.on('open-file', (event, filePath) => {
  event.preventDefault()

  const windows = BrowserWindow.getAllWindows()
  if (windows.length === 0) {
    // Before `whenReady` this event can fire with no window; bootstrap creates
    // one and the renderer then drains the queue.
    enqueueOpenFiles([filePath])
    if (app.isReady()) void createWindow()
    return
  }

  const target = BrowserWindow.getFocusedWindow() ?? windows[0]
  forwardOpenFile(target, filePath)
})
