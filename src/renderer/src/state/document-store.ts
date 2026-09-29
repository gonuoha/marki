import type { EditorMode } from '@shared/types'
import { create } from 'zustand'
import { titleFromPath } from '@/lib/format'
import { basename } from '@/lib/path'
import { useSettings } from './settings-store'
import { useUi } from './ui-store'

export interface OpenDocument {
  id: string
  path: string | null
  title: string
  text: string
  savedText: string
  dirty: boolean
  mode: EditorMode
  scrollTop: number
  selection: number | null
}

export interface DocumentState {
  documents: OpenDocument[]
  activeId: string | null
  savingIds: string[]
  open(path: string): Promise<string>
  newDocument(): string
  close(id: string): Promise<void>
  activate(id: string): void
  setText(id: string, text: string): void
  save(id: string): Promise<void>
  saveAs(id: string): Promise<void>
  setMode(id: string, mode: EditorMode): void
  reloadFromDisk(id: string): Promise<void>
  setSelection(id: string, offset: number | null): void
  setScrollTop(id: string, scrollTop: number): void
}

const autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const recentlySavedPaths = new Map<string, number>()
const SELF_SAVE_TOLERANCE_MS = 2000

function clearAutosave(id: string): void {
  const timer = autosaveTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    autosaveTimers.delete(id)
  }
}

function scheduleAutosave(id: string): void {
  clearAutosave(id)
  const delay = useSettings.getState().settings.files.autosaveDelay
  if (delay <= 0) return

  const timer = setTimeout(() => {
    autosaveTimers.delete(id)
    const current = useDocuments.getState().documents.find((d) => d.id === id)
    if (current?.dirty && current.path) {
      void useDocuments.getState().save(id)
    }
  }, delay)
  autosaveTimers.set(id, timer)
}

function markRecentlySaved(path: string): void {
  recentlySavedPaths.set(path, Date.now())
}

function syncWindowDocumentState(documents: OpenDocument[], activeId: string | null): void {
  const active = documents.find((d) => d.id === activeId) ?? null
  window.marki.window.setDocumentState({
    path: active?.path ?? null,
    edited: active?.dirty ?? false
  })
}

function createBlankDocument(mode: EditorMode): OpenDocument {
  const id = crypto.randomUUID()
  return {
    id,
    path: null,
    title: 'Untitled',
    text: '',
    savedText: '',
    dirty: false,
    mode,
    scrollTop: 0,
    selection: null
  }
}

function addSavingId(savingIds: string[], id: string): string[] {
  return savingIds.includes(id) ? savingIds : [...savingIds, id]
}

function removeSavingId(savingIds: string[], id: string): string[] {
  return savingIds.filter((sid) => sid !== id)
}

function applyWrittenSnapshot(
  documents: OpenDocument[],
  id: string,
  writtenText: string
): OpenDocument[] {
  return documents.map((d) => {
    if (d.id !== id) return d
    const dirty = d.text !== writtenText
    return {
      ...d,
      savedText: writtenText,
      dirty,
      title: titleFromPath(d.path)
    }
  })
}

function saveFailureToast(id: string, title: string): void {
  useUi.getState().toast('error', `Could not save ${title}.`, {
    label: 'Retry',
    run: () => {
      void useDocuments.getState().save(id)
    }
  })
}

export const useDocuments = create<DocumentState>((set, get) => ({
  documents: [],
  activeId: null,
  savingIds: [],

  async open(path) {
    const existing = get().documents.find((d) => d.path === path)
    if (existing) {
      set({ activeId: existing.id })
      syncWindowDocumentState(get().documents, existing.id)
      return existing.id
    }

    const result = await window.marki.file.read(path)
    if (!result.ok) {
      useUi.getState().toast(
        'error',
        `Could not open ${basename(path)}: file is not valid UTF-8 text.`
      )
      throw new Error('file is not valid UTF-8 text')
    }

    const mode = useSettings.getState().settings.editor.mode
    const doc: OpenDocument = {
      id: crypto.randomUUID(),
      path: result.path,
      title: titleFromPath(result.path),
      text: result.content,
      savedText: result.content,
      dirty: false,
      mode,
      scrollTop: 0,
      selection: null
    }

    set((state) => {
      const documents = [...state.documents, doc]
      syncWindowDocumentState(documents, doc.id)
      return { documents, activeId: doc.id }
    })

    return doc.id
  },

  newDocument() {
    const mode = useSettings.getState().settings.editor.mode
    const doc = createBlankDocument(mode)
    set((state) => {
      const documents = [...state.documents, doc]
      syncWindowDocumentState(documents, doc.id)
      return { documents, activeId: doc.id }
    })
    return doc.id
  },

  async close(id) {
    const doc = get().documents.find((d) => d.id === id)
    if (!doc) return

    if (doc.dirty) {
      const result = await window.marki.app.confirmDiscard({ fileName: doc.title })
      if (result === 'cancel') return
      if (result === 'save') {
        await get().save(id)
        const stillDirty = get().documents.find((d) => d.id === id)?.dirty
        if (stillDirty) return
      }
    }

    clearAutosave(id)
    if (doc.path) recentlySavedPaths.delete(doc.path)

    set((state) => {
      const closedIndex = state.documents.findIndex((d) => d.id === id)
      const documents = state.documents.filter((d) => d.id !== id)
      let activeId = state.activeId
      if (state.activeId === id) {
        const next = documents[closedIndex] ?? documents[closedIndex - 1]
        activeId = next?.id ?? null
      }
      syncWindowDocumentState(documents, activeId)
      return {
        documents,
        activeId,
        savingIds: removeSavingId(state.savingIds, id)
      }
    })
  },

  activate(id) {
    if (!get().documents.some((d) => d.id === id)) return
    set({ activeId: id })
    syncWindowDocumentState(get().documents, id)
  },

  setText(id, text) {
    set((state) => {
      const documents = state.documents.map((d) =>
        d.id === id ? { ...d, text, dirty: d.savedText !== text } : d
      )
      const active = documents.find((d) => d.id === id)
      if (active && state.activeId === id) {
        syncWindowDocumentState(documents, id)
      }
      return { documents }
    })

    scheduleAutosave(id)
  },

  async save(id) {
    const doc = get().documents.find((d) => d.id === id)
    if (!doc) return

    if (!doc.path) {
      await get().saveAs(id)
      return
    }

    if (!doc.dirty) return

    clearAutosave(id)
    const writtenText = doc.text
    const writtenPath = doc.path

    set((state) => ({ savingIds: addSavingId(state.savingIds, id) }))

    try {
      await window.marki.file.write(writtenPath, writtenText)
      markRecentlySaved(writtenPath)

      set((state) => {
        const documents = applyWrittenSnapshot(state.documents, id, writtenText)
        const updated = documents.find((d) => d.id === id)
        if (updated?.dirty) scheduleAutosave(id)
        if (state.activeId === id) syncWindowDocumentState(documents, id)
        return {
          documents,
          savingIds: removeSavingId(state.savingIds, id)
        }
      })
    } catch (err) {
      console.error('[document] save failed', err)
      set((state) => ({ savingIds: removeSavingId(state.savingIds, id) }))
      saveFailureToast(id, doc.title)
    }
  },

  async saveAs(id) {
    const doc = get().documents.find((d) => d.id === id)
    if (!doc) return

    const suggested = doc.path ? titleFromPath(doc.path) : 'Untitled.md'
    const picked = await window.marki.file.pickSave(suggested)
    if (!picked) return

    const writtenText = doc.text

    set((state) => ({ savingIds: addSavingId(state.savingIds, id) }))

    try {
      await window.marki.file.write(picked, writtenText)
      markRecentlySaved(picked)

      set((state) => {
        const documents = state.documents.map((d) => {
          if (d.id !== id) return d
          const dirty = d.text !== writtenText
          return {
            ...d,
            path: picked,
            title: titleFromPath(picked),
            savedText: writtenText,
            dirty
          }
        })
        const updated = documents.find((d) => d.id === id)
        if (updated?.dirty) scheduleAutosave(id)
        if (state.activeId === id) syncWindowDocumentState(documents, id)
        return {
          documents,
          savingIds: removeSavingId(state.savingIds, id)
        }
      })
    } catch (err) {
      console.error('[document] saveAs failed', err)
      set((state) => ({ savingIds: removeSavingId(state.savingIds, id) }))
      saveFailureToast(id, doc.title)
    }
  },

  setMode(id, mode) {
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, mode } : d))
    }))
  },

  async reloadFromDisk(id) {
    const doc = get().documents.find((d) => d.id === id)
    if (!doc?.path) return

    const result = await window.marki.file.read(doc.path)
    if (!result.ok) {
      useUi.getState().toast('error', `Could not reload ${doc.title}: file is not valid UTF-8 text.`)
      return
    }

    clearAutosave(id)
    set((state) => {
      const documents = state.documents.map((d) =>
        d.id === id
          ? {
              ...d,
              text: result.content,
              savedText: result.content,
              dirty: false,
              title: titleFromPath(d.path)
            }
          : d
      )
      if (state.activeId === id) syncWindowDocumentState(documents, id)
      return { documents }
    })
  },

  setSelection(id, offset) {
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, selection: offset } : d))
    }))
  },

  setScrollTop(id, scrollTop) {
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, scrollTop } : d))
    }))
  }
}))

export function handleExternalFileChange(path: string): void {
  const savedAt = recentlySavedPaths.get(path)
  if (savedAt !== undefined) {
    recentlySavedPaths.delete(path)
    if (Date.now() - savedAt < SELF_SAVE_TOLERANCE_MS) return
  }

  const { documents, reloadFromDisk } = useDocuments.getState()
  const doc = documents.find((d) => d.path === path)
  if (!doc) return

  if (!doc.dirty) {
    void reloadFromDisk(doc.id)
    return
  }

  useUi.getState().toast('info', `${doc.title} changed on disk.`, {
    label: 'Reload',
    run: () => {
      void reloadFromDisk(doc.id)
    }
  })
}
