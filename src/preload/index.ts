import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type MarkiApi, type Unsubscribe } from '@shared/ipc'
import type {
  FileNode,
  FileReadResult,
  FileWriteResult,
  ImportImageRequest,
  ImportImageResult,
  MenuCommandPayload,
  Settings,
  SettingsPatch,
  WatchEvent,
  WindowDocumentState,
  WorkspaceInfo
} from '@shared/types'
import type { ConfirmDiscardRequest, ConfirmDiscardResult, PlatformInfo } from '@shared/ipc'

function onChannel<T>(channel: string, handler: (payload: T) => void): Unsubscribe {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => {
    handler(payload)
  }
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: MarkiApi = {
  workspace: {
    pickFolder: () => ipcRenderer.invoke(IPC.workspace.pickFolder),
    open: (root: string) =>
      ipcRenderer.invoke(IPC.workspace.open, root) as Promise<{ info: WorkspaceInfo; tree: FileNode }>,
    readDir: (path: string) => ipcRenderer.invoke(IPC.workspace.readDir, path) as Promise<FileNode[]>,
    close: (root: string) => ipcRenderer.invoke(IPC.workspace.close, root),
    onWatchEvent: (handler) => onChannel<WatchEvent>(IPC.workspace.watchEvent, handler)
  },
  file: {
    read: (path: string) => ipcRenderer.invoke(IPC.file.read, path) as Promise<FileReadResult>,
    write: (path: string, content: string) =>
      ipcRenderer.invoke(IPC.file.write, path, content) as Promise<FileWriteResult>,
    create: (path: string, content?: string) =>
      ipcRenderer.invoke(IPC.file.create, path, content) as Promise<FileNode>,
    createFolder: (path: string) => ipcRenderer.invoke(IPC.file.createFolder, path) as Promise<FileNode>,
    rename: (from: string, to: string) =>
      ipcRenderer.invoke(IPC.file.rename, from, to) as Promise<FileNode>,
    trash: (path: string) => ipcRenderer.invoke(IPC.file.trash, path),
    reveal: (path: string) => ipcRenderer.invoke(IPC.file.reveal, path),
    exists: (path: string) => ipcRenderer.invoke(IPC.file.exists, path) as Promise<boolean>,
    pickOpen: () => ipcRenderer.invoke(IPC.file.pickOpen) as Promise<string[]>,
    pickSave: (suggestedName?: string) =>
      ipcRenderer.invoke(IPC.file.pickSave, suggestedName) as Promise<string | null>,
    readAsDataUrl: (path: string, baseDir?: string | null) =>
      ipcRenderer.invoke(IPC.file.readAsDataUrl, path, baseDir) as Promise<string | null>,
    onOpenPath: (handler) => onChannel<string>(IPC.file.openPath, handler),
    takePendingOpen: () => ipcRenderer.invoke(IPC.file.takePendingOpen) as Promise<string[]>
  },
  assets: {
    importImage: (request: ImportImageRequest) => {
      const payload: ImportImageRequest = { ...request }
      if (request.bytes) {
        payload.bytes = Uint8Array.from(request.bytes)
      }
      return ipcRenderer.invoke(IPC.assets.importImage, payload) as Promise<ImportImageResult>
    }
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settings.get) as Promise<Settings>,
    patch: (patch: SettingsPatch) =>
      ipcRenderer.invoke(IPC.settings.patch, patch) as Promise<Settings>,
    reset: () => ipcRenderer.invoke(IPC.settings.reset) as Promise<Settings>,
    onChange: (handler) => onChannel<Settings>(IPC.settings.changed, handler)
  },
  window: {
    setDocumentState: (state: WindowDocumentState) => {
      ipcRenderer.send(IPC.window.setDocumentState, state)
    },
    onRequestClose: (handler) => onChannel(IPC.window.requestClose, () => handler()),
    confirmClose: () => {
      ipcRenderer.send(IPC.window.confirmClose)
    }
  },
  app: {
    onMenuCommand: (handler) => onChannel<MenuCommandPayload>(IPC.app.menuCommand, handler),
    confirmDiscard: (request: ConfirmDiscardRequest) =>
      ipcRenderer.invoke(IPC.app.confirmDiscard, request) as Promise<ConfirmDiscardResult>,
    showError: (title: string, message: string) => {
      void ipcRenderer.invoke(IPC.app.showError, title, message)
    },
    platform: () => ipcRenderer.invoke(IPC.app.platform) as Promise<PlatformInfo>
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('marki', api)
} else {
  ;(globalThis as unknown as { marki: MarkiApi }).marki = api
}
