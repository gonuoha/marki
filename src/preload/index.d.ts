import type { MarkiApi } from '../shared/ipc'

declare global {
  interface Window {
    marki: MarkiApi
  }
}

export {}
