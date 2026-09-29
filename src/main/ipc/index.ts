import { BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { registerAppIpc } from './app'
import { registerAssetsIpc } from './assets'
import { registerFilesIpc } from './files'
import { registerSettingsIpc } from './settings'
import { registerWorkspaceIpc } from './workspace'

export function wrapHandler<T extends unknown[], R>(
  channel: string,
  handler: (...args: T) => R | Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[IPC ${channel}]`, err)
      throw new Error(message)
    }
  }
}

export function senderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error('No window associated with this request')
  return win
}

export function registerAllIpc(): void {
  registerAppIpc()
  registerAssetsIpc()
  registerFilesIpc()
  registerSettingsIpc()
  registerWorkspaceIpc()
}
