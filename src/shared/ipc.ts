/**
 * The IPC contract between the renderer and the main process.
 *
 * `IPC` holds the channel names. `MarkiApi` is the shape exposed on
 * `window.marki` by the preload script. Renderer code MUST only talk to the
 * main process through `window.marki` — `ipcRenderer` is never exposed.
 */

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
} from './types'

export const IPC = {
  workspace: {
    pickFolder: 'workspace:pickFolder',
    open: 'workspace:open',
    readDir: 'workspace:readDir',
    close: 'workspace:close',
    /** main -> renderer */
    watchEvent: 'workspace:watchEvent'
  },
  file: {
    read: 'file:read',
    write: 'file:write',
    create: 'file:create',
    createFolder: 'file:createFolder',
    rename: 'file:rename',
    trash: 'file:trash',
    reveal: 'file:reveal',
    pickOpen: 'file:pickOpen',
    pickSave: 'file:pickSave',
    exists: 'file:exists',
    /** Read a local image and return a data URL the renderer can display. */
    readAsDataUrl: 'file:readAsDataUrl',
    /**
     * main -> renderer. Sent for Finder "Open With", a dock drop, or an
     * Open Recent menu pick — anything where the OS or the menu, rather than
     * the renderer, decides a document should open.
     */
    openPath: 'file:openPath',
    /**
     * Files the app was launched with, drained by the renderer once it is ready
     * to open them. Pulling rather than pushing is what makes launch-time
     * delivery reliable: a push can arrive while the renderer is still
     * hydrating and be dropped.
     */
    takePendingOpen: 'file:takePendingOpen'
  },
  assets: {
    importImage: 'assets:importImage'
  },
  settings: {
    get: 'settings:get',
    patch: 'settings:patch',
    reset: 'settings:reset',
    /** main -> renderer */
    changed: 'settings:changed'
  },
  window: {
    setDocumentState: 'window:setDocumentState',
    /** main -> renderer, sent when the user tries to close a dirty window. */
    requestClose: 'window:requestClose',
    confirmClose: 'window:confirmClose'
  },
  app: {
    /** main -> renderer */
    menuCommand: 'app:menuCommand',
    confirmDiscard: 'app:confirmDiscard',
    showError: 'app:showError',
    platform: 'app:platform',
    openLink: 'app:openLink'
  }
} as const

/* ------------------------------------------------------------------ */

export interface ConfirmDiscardRequest {
  fileName: string
}

/** 'save' writes and closes, 'discard' closes, 'cancel' aborts. */
export type ConfirmDiscardResult = 'save' | 'discard' | 'cancel'

/** 'invalid' means the href has no safe browser-openable scheme. */
export type OpenLinkResult = 'opened' | 'invalid'

export interface PlatformInfo {
  platform: NodeJS.Platform
  /** macOS traffic-light inset, used to pad the custom title bar. */
  titleBarInset: number
  version: string
}

export type Unsubscribe = () => void

/**
 * The full renderer-facing API. Implemented in `src/preload/index.ts`,
 * consumed everywhere in the renderer as `window.marki`.
 */
export interface MarkiApi {
  workspace: {
    /** Opens the native folder picker. Resolves null when cancelled. */
    pickFolder(): Promise<string | null>
    /** Opens a root, starts watching it and returns the top level tree. */
    open(root: string): Promise<{ info: WorkspaceInfo; tree: FileNode }>
    /** Lazily loads the children of one directory. */
    readDir(path: string): Promise<FileNode[]>
    close(root: string): Promise<void>
    onWatchEvent(handler: (event: WatchEvent) => void): Unsubscribe
  }
  file: {
    read(path: string): Promise<FileReadResult>
    write(path: string, content: string): Promise<FileWriteResult>
    create(path: string, content?: string): Promise<FileNode>
    createFolder(path: string): Promise<FileNode>
    rename(from: string, to: string): Promise<FileNode>
    trash(path: string): Promise<void>
    reveal(path: string): Promise<void>
    exists(path: string): Promise<boolean>
    /** Native open panel filtered to markdown/text files. */
    pickOpen(): Promise<string[]>
    /** Native save panel. `suggestedName` seeds the filename field. */
    pickSave(suggestedName?: string): Promise<string | null>
    /** Resolves an image path (absolute or relative to `baseDir`) to a data URL. */
    readAsDataUrl(path: string, baseDir?: string | null): Promise<string | null>
    /** Fires when the OS or the native menu asks for a document to be opened. */
    onOpenPath(handler: (path: string) => void): Unsubscribe
    /**
     * Returns the files the app was launched with and clears them, so a reload
     * does not reopen them. Call once the renderer can actually open documents.
     */
    takePendingOpen(): Promise<string[]>
  }
  assets: {
    importImage(request: ImportImageRequest): Promise<ImportImageResult>
  }
  settings: {
    get(): Promise<Settings>
    patch(patch: SettingsPatch): Promise<Settings>
    reset(): Promise<Settings>
    onChange(handler: (settings: Settings) => void): Unsubscribe
  }
  window: {
    setDocumentState(state: WindowDocumentState): void
    onRequestClose(handler: () => void): Unsubscribe
    /** Tell main it is safe to close the window. */
    confirmClose(): void
  }
  app: {
    onMenuCommand(handler: (payload: MenuCommandPayload) => void): Unsubscribe
    confirmDiscard(request: ConfirmDiscardRequest): Promise<ConfirmDiscardResult>
    showError(title: string, message: string): void
    platform(): Promise<PlatformInfo>
    /** Opens an http(s) or mailto link in the system default handler. */
    openLink(href: string): Promise<OpenLinkResult>
  }
}
