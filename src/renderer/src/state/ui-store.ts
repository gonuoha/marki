import { create } from 'zustand'

export type DialogKind = 'link' | 'image' | 'table' | 'settings' | 'palette' | 'find' | null

export interface Toast {
  id: string
  kind: 'info' | 'error'
  message: string
  action?: { label: string; run(): void }
}

export interface UiState {
  dialog: DialogKind
  dialogPayload: unknown
  toasts: Toast[]
  openDialog(kind: Exclude<DialogKind, null>, payload?: unknown): void
  closeDialog(): void
  toast(kind: 'info' | 'error', message: string, action?: Toast['action']): void
  dismissToast(id: string): void
}

export const useUi = create<UiState>((set, get) => ({
  dialog: null,
  dialogPayload: undefined,
  toasts: [],

  openDialog(kind, payload) {
    set({ dialog: kind, dialogPayload: payload })
  },

  closeDialog() {
    set({ dialog: null, dialogPayload: undefined })
  },

  toast(kind, message, action) {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [...state.toasts, { id, kind, message, action }]
    }))

    if (kind === 'info' && !action) {
      window.setTimeout(() => {
        get().dismissToast(id)
      }, 4000)
    }
  },

  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  }
}))
