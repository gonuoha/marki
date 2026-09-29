import { DEFAULT_SETTINGS, mergeSettings, structuredCloneSettings } from '@shared/settings'
import type { Settings, SettingsPatch } from '@shared/types'
import { create } from 'zustand'

export interface SettingsState {
  settings: Settings
  loaded: boolean
  patch(patch: SettingsPatch): Promise<void>
  reset(): Promise<void>
  hydrate(): Promise<void>
}

let unsubscribe: (() => void) | null = null

export const useSettings = create<SettingsState>((set, get) => ({
  settings: structuredCloneSettings(DEFAULT_SETTINGS),
  loaded: false,

  async patch(patch) {
    const optimistic = mergeSettings(get().settings, patch)
    set({ settings: optimistic })
    try {
      const reconciled = await window.marki.settings.patch(patch)
      set({ settings: reconciled })
    } catch (err) {
      console.error('[settings] patch failed', err)
      const current = await window.marki.settings.get()
      set({ settings: current })
    }
  },

  async reset() {
    const next = await window.marki.settings.reset()
    set({ settings: next })
  },

  async hydrate() {
    const settings = await window.marki.settings.get()
    set({ settings, loaded: true })

    if (!unsubscribe) {
      unsubscribe = window.marki.settings.onChange((next) => {
        set({ settings: next })
      })
    }
  }
}))
