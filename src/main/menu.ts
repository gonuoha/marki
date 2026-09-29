import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { IPC } from '@shared/ipc'
import type { AppCommand, MenuCommandPayload } from '@shared/types'
import { clearRecentFiles, getSettings } from './services/settings-store'
import { forwardOpenFile } from './window'

export interface MenuCallbacks {
  onNewWindow(): void
}

function sendCommand(win: BrowserWindow, command: AppCommand): void {
  const payload: MenuCommandPayload = { command }
  win.webContents.send(IPC.app.menuCommand, payload)
}

function focusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow()
}

function commandItem(
  label: string,
  command: AppCommand,
  accelerator?: string
): MenuItemConstructorOptions {
  return {
    label,
    accelerator,
    click: () => {
      const win = focusedWindow()
      if (win) sendCommand(win, command)
    }
  }
}

function buildOpenRecentMenu(): MenuItemConstructorOptions[] {
  const recent = getSettings().files.recentFiles
  const items: MenuItemConstructorOptions[] = recent.map((filePath) => ({
    label: filePath,
    click: () => {
      const win = focusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win) return
      forwardOpenFile(win, filePath)
    }
  }))

  if (items.length === 0) {
    items.push({ label: 'No Recent Files', enabled: false })
  }

  items.push({ type: 'separator' })
  items.push({
    label: 'Clear Menu',
    enabled: recent.length > 0,
    click: () => {
      void clearRecentFiles()
    }
  })

  return items
}

function buildViewMenu(): MenuItemConstructorOptions {
  return {
    label: 'View',
    submenu: [
      commandItem('Visual', 'view.modeVisual', 'CmdOrCtrl+Alt+1'),
      commandItem('Source', 'view.modeSource', 'CmdOrCtrl+Alt+2'),
      commandItem('Split', 'view.modeSplit', 'CmdOrCtrl+Alt+3'),
      { type: 'separator' },
      commandItem('Toggle Sidebar', 'view.toggleSidebar', 'CmdOrCtrl+Alt+S'),
      commandItem('Typewriter Mode', 'view.toggleTypewriter', 'CmdOrCtrl+Alt+W'),
      { type: 'separator' },
      {
        label: 'Focus',
        submenu: [
          commandItem('Off', 'view.focusOff'),
          commandItem('Sentence', 'view.focusSentence'),
          commandItem('Paragraph', 'view.focusParagraph')
        ]
      },
      { type: 'separator' },
      commandItem('Zoom In', 'view.zoomIn', 'CmdOrCtrl+='),
      commandItem('Zoom Out', 'view.zoomOut', 'CmdOrCtrl+-'),
      // CmdOrCtrl+0 is Paragraph in the Format menu.
      commandItem('Zoom Reset', 'view.zoomReset', 'CmdOrCtrl+Shift+0'),
      { type: 'separator' },
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
}

function buildFormatMenu(): MenuItemConstructorOptions {
  return {
    label: 'Format',
    submenu: [
      commandItem('Bold', 'format.bold', 'CmdOrCtrl+B'),
      commandItem('Italic', 'format.italic', 'CmdOrCtrl+I'),
      commandItem('Strikethrough', 'format.strikethrough', 'CmdOrCtrl+Shift+X'),
      commandItem('Code', 'format.code', 'CmdOrCtrl+E'),
      { type: 'separator' },
      // CmdOrCtrl+K opens the command palette; a duplicate accelerator would
      // leave one of the two menu items dead.
      commandItem('Link', 'format.link', 'CmdOrCtrl+Shift+K'),
      commandItem('Image', 'format.image', 'CmdOrCtrl+Shift+I'),
      commandItem('Table', 'format.table', 'CmdOrCtrl+Alt+T'),
      commandItem('Code Block', 'format.codeBlock', 'CmdOrCtrl+Shift+C'),
      commandItem('Quote', 'format.quote', 'CmdOrCtrl+Shift+.'),
      { type: 'separator' },
      commandItem('Bullet List', 'format.bulletList', 'CmdOrCtrl+Shift+8'),
      commandItem('Ordered List', 'format.orderedList', 'CmdOrCtrl+Shift+7'),
      commandItem('Task List', 'format.taskList', 'CmdOrCtrl+Shift+9'),
      commandItem('Footnote', 'format.footnote'),
      // CmdOrCtrl+M is Window > Minimize on macOS.
      commandItem('Math', 'format.math', 'CmdOrCtrl+Shift+M'),
      commandItem('Horizontal Rule', 'format.horizontalRule', 'CmdOrCtrl+Shift+L'),
      { type: 'separator' },
      commandItem('Heading 1', 'format.heading1', 'CmdOrCtrl+1'),
      commandItem('Heading 2', 'format.heading2', 'CmdOrCtrl+2'),
      commandItem('Heading 3', 'format.heading3', 'CmdOrCtrl+3'),
      commandItem('Heading 4', 'format.heading4', 'CmdOrCtrl+4'),
      commandItem('Heading 5', 'format.heading5', 'CmdOrCtrl+5'),
      commandItem('Heading 6', 'format.heading6', 'CmdOrCtrl+6'),
      commandItem('Paragraph', 'format.paragraph', 'CmdOrCtrl+0')
    ]
  }
}

export function buildApplicationMenu(callbacks: MenuCallbacks): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              commandItem('Settings…', 'app.settings', 'CmdOrCtrl+,'),
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          } as MenuItemConstructorOptions
        ]
      : []),
    {
      label: 'File',
      submenu: [
        commandItem('New', 'file.new', 'CmdOrCtrl+N'),
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => callbacks.onNewWindow()
        },
        { type: 'separator' },
        commandItem('Open…', 'file.open', 'CmdOrCtrl+O'),
        commandItem('Open Folder…', 'file.openFolder', 'CmdOrCtrl+Shift+O'),
        {
          label: 'Open Recent',
          submenu: buildOpenRecentMenu()
        },
        { type: 'separator' },
        commandItem('Save', 'file.save', 'CmdOrCtrl+S'),
        commandItem('Save As…', 'file.saveAs', 'CmdOrCtrl+Shift+S'),
        commandItem('Close Tab', 'file.closeTab', 'CmdOrCtrl+W'),
        { type: 'separator' },
        commandItem('Reveal in Finder', 'file.revealInFinder', 'CmdOrCtrl+Alt+R'),
        ...(!isMac ? [{ type: 'separator' as const }, { role: 'quit' as const }] : [])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        commandItem('Find…', 'edit.find', 'CmdOrCtrl+F')
      ]
    },
    buildFormatMenu(),
    buildViewMenu(),
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }])
      ]
    },
    {
      label: 'Help',
      submenu: [
        ...(!isMac ? [commandItem('Settings…', 'app.settings', 'CmdOrCtrl+,')] : []),
        commandItem('Command Palette…', 'app.commandPalette', 'CmdOrCtrl+K')
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
