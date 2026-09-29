import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { Settings, SettingsPatch } from '@shared/types'
import {
  getSettings,
  patchSettings,
  resetSettings
} from '../services/settings-store'
import { wrapHandler } from './index'

function broadcastSettings(settings: Settings): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.settings.changed, settings)
    }
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle(
    IPC.settings.get,
    wrapHandler(IPC.settings.get, async (): Promise<Settings> => getSettings())
  )

  ipcMain.handle(
    IPC.settings.patch,
    wrapHandler(IPC.settings.patch, async (_event, patch: SettingsPatch): Promise<Settings> => {
      const settings = await patchSettings(patch)
      broadcastSettings(settings)
      return settings
    })
  )

  ipcMain.handle(
    IPC.settings.reset,
    wrapHandler(IPC.settings.reset, async (): Promise<Settings> => {
      const settings = await resetSettings()
      broadcastSettings(settings)
      return settings
    })
  )
}
