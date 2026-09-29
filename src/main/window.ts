import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  shell,
  type BrowserWindowConstructorOptions
} from 'electron'
import { IPC } from '@shared/ipc'
import type { WindowDocumentState } from '@shared/types'
import { clearWorkspaceForWindow } from './ipc/workspace'

const APP_BACKGROUND = '#f6f6f4'

function preloadPath(): string {
  const cjs = join(__dirname, '../preload/index.cjs')
  if (existsSync(cjs)) return cjs
  return join(__dirname, '../preload/index.js')
}
const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 800

interface PersistedWindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
}

interface MarkiBrowserWindow extends BrowserWindow {
  markiForceClose?: boolean
  markiDocumentState?: WindowDocumentState
}

const windowStatePath = (): string => join(app.getPath('userData'), 'window-state.json')

function clampBounds(state: PersistedWindowState): PersistedWindowState {
  const display = screen.getDisplayMatching({
    x: state.x ?? 0,
    y: state.y ?? 0,
    width: state.width,
    height: state.height
  })
  const area = display.workArea

  let width = Math.min(Math.max(state.width, 640), area.width)
  let height = Math.min(Math.max(state.height, 480), area.height)
  let x = state.x ?? area.x + Math.round((area.width - width) / 2)
  let y = state.y ?? area.y + Math.round((area.height - height) / 2)

  if (x < area.x) x = area.x
  if (y < area.y) y = area.y
  if (x + width > area.x + area.width) x = area.x + area.width - width
  if (y + height > area.y + area.height) y = area.y + area.height - height

  return { ...state, x, y, width, height }
}

async function loadWindowState(): Promise<PersistedWindowState> {
  try {
    const raw = await readFile(windowStatePath(), 'utf8')
    const parsed = JSON.parse(raw) as PersistedWindowState
    return clampBounds({
      width: parsed.width ?? DEFAULT_WIDTH,
      height: parsed.height ?? DEFAULT_HEIGHT,
      x: parsed.x,
      y: parsed.y,
      isMaximized: parsed.isMaximized
    })
  } catch {
    const display = screen.getPrimaryDisplay().workArea
    return clampBounds({
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      x: display.x + Math.round((display.width - DEFAULT_WIDTH) / 2),
      y: display.y + Math.round((display.height - DEFAULT_HEIGHT) / 2)
    })
  }
}

async function saveWindowState(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed()) return

  const bounds = win.getBounds()
  const state: PersistedWindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: win.isMaximized()
  }

  await writeFile(windowStatePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function buildLoadOptions(): BrowserWindowConstructorOptions {
  return {
    show: false,
    backgroundColor: APP_BACKGROUND,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: 640,
    minHeight: 480,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    // Vertically centred in the renderer's 40px title bar (--titlebar-height).
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 13 } : undefined,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true
    }
  }
}

function loadRenderer(win: BrowserWindow): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    void win.loadURL(rendererUrl)
    return
  }

  void win.loadFile(join(__dirname, '../renderer/index.html'))
}

function attachNavigationGuards(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    const isLocal =
      url.startsWith('file:') || (rendererUrl !== undefined && url.startsWith(rendererUrl))
    if (isLocal) return

    event.preventDefault()
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
  })
}

function attachCloseGuard(win: MarkiBrowserWindow): void {
  win.on('close', (event) => {
    if (win.markiForceClose) return
    if (win.markiDocumentState?.edited) {
      event.preventDefault()
      win.webContents.send(IPC.window.requestClose)
    }
  })
}

function attachPersistence(win: BrowserWindow): void {
  const persist = (): void => {
    void saveWindowState(win).catch((err) => console.error('[window] save state failed', err))
  }

  win.on('resize', persist)
  win.on('move', persist)
  win.on('close', persist)
}

export function registerWindowIpc(): void {
  ipcMain.on(IPC.window.setDocumentState, (event, state: WindowDocumentState) => {
    const win = BrowserWindow.fromWebContents(event.sender) as MarkiBrowserWindow | null
    if (!win) return
    win.markiDocumentState = state
  })

  ipcMain.on(IPC.window.confirmClose, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) as MarkiBrowserWindow | null
    if (!win) return
    win.markiForceClose = true
    win.close()
  })
}

export function forwardOpenFile(win: BrowserWindow, filePath: string): void {
  const deliver = (): void => {
    win.webContents.send(IPC.file.openPath, filePath)
  }

  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', deliver)
    return
  }
  deliver()
}

export async function createWindow(): Promise<BrowserWindow> {
  const saved = await loadWindowState()
  const win = new BrowserWindow({
    ...buildLoadOptions(),
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height
  }) as MarkiBrowserWindow

  if (saved.isMaximized) win.maximize()

  attachNavigationGuards(win)
  attachCloseGuard(win)
  attachPersistence(win)
  loadRenderer(win)

  win.once('ready-to-show', () => win.show())

  win.on('closed', () => {
    clearWorkspaceForWindow(win)
  })

  return win
}
