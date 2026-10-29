import { app, dialog, ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  ConfirmDiscardRequest,
  ConfirmDiscardResult,
  OpenLinkResult,
  PlatformInfo
} from '@shared/ipc'
import { normalizeExternalUrl } from '@shared/open-link'
import { senderWindow, wrapHandler } from './index'

export function registerAppIpc(): void {
  ipcMain.handle(
    IPC.app.platform,
    wrapHandler(IPC.app.platform, async (): Promise<PlatformInfo> => ({
      platform: process.platform,
      titleBarInset: process.platform === 'darwin' ? 78 : 0,
      version: app.getVersion()
    }))
  )

  ipcMain.handle(
    IPC.app.confirmDiscard,
    wrapHandler(
      IPC.app.confirmDiscard,
      async (event, request: ConfirmDiscardRequest): Promise<ConfirmDiscardResult> => {
        const win = senderWindow(event)
        const { response } = await dialog.showMessageBox(win, {
          type: 'warning',
          message: `Do you want to save the changes made to the document "${request.fileName}"?`,
          detail: "Your changes will be lost if you don't save them.",
          buttons: ['Save', "Don't Save", 'Cancel'],
          defaultId: 0,
          cancelId: 2
        })

        if (response === 0) return 'save'
        if (response === 1) return 'discard'
        return 'cancel'
      }
    )
  )

  ipcMain.handle(
    IPC.app.showError,
    wrapHandler(IPC.app.showError, async (_event, title: string, message: string): Promise<void> => {
      dialog.showErrorBox(title, message)
    })
  )

  ipcMain.handle(
    IPC.app.openLink,
    wrapHandler(IPC.app.openLink, async (_event, href: string): Promise<OpenLinkResult> => {
      const url = normalizeExternalUrl(String(href ?? ''))
      if (!url) return 'invalid'
      await shell.openExternal(url)
      return 'opened'
    })
  )
}
