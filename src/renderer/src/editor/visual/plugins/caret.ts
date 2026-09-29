import { useSettings } from '@/state/settings-store'
import type { CaretBlinkPattern, CaretSettings } from '@shared/types'
import { Plugin } from 'prosemirror-state'

function caretClass(pattern: CaretBlinkPattern, blink: boolean): string {
  if (!blink || pattern === 'solid') return 'marki-custom-caret--solid'
  return `marki-custom-caret--${pattern}`
}

function hdrSupported(): boolean {
  return window.matchMedia('(dynamic-range: high)').matches
}

/**
 * HDR caret: on `(dynamic-range: high)` displays we overlay a child layer using
 * `color(display-p3 1.45 1.42 1.2)` with `mix-blend-mode: screen` so the caret
 * reads brighter than SDR white. Falls back to the normal caret colour when HDR
 * is unavailable or `hdrBrightness` is off. Limited to CSS wide-gamut support;
 * actual peak brightness still depends on the panel and OS tone mapping.
 */
export function caretPlugin(): Plugin {
  let caretEl: HTMLDivElement | null = null
  let hdrEl: HTMLDivElement | null = null
  let raf = 0
  let settingsUnsub = () => {}
  let scrollParent: HTMLElement | null = null

  const schedule = (view: import('prosemirror-view').EditorView, run: () => void) => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      if (!view.dom.isConnected) return
      run()
    })
  }

  const applySettings = (settings: CaretSettings) => {
    if (!caretEl) return
    caretEl.style.background = settings.color
    caretEl.style.width = `${settings.thickness}px`
    caretEl.className = `marki-custom-caret ${caretClass(settings.blinkPattern, settings.blink)}${
      settings.hdrBrightness && hdrSupported() ? ' marki-custom-caret--hdr' : ''
    }`
  }

  const positionCaret = (view: import('prosemirror-view').EditorView) => {
    if (!caretEl) return
    const { from, to } = view.state.selection
    const settings = useSettings.getState().settings.editor.caret
    applySettings(settings)

    const hidden = !view.hasFocus() || from !== to || !view.editable

    if (hidden) {
      caretEl.style.opacity = '0'
      return
    }

    const coords = view.coordsAtPos(from)
    if (!coords) {
      caretEl.style.opacity = '0'
      return
    }

    const host = view.dom.offsetParent instanceof HTMLElement ? view.dom.offsetParent : view.dom.parentElement
    if (!host) return
    if (scrollParent !== host) {
      scrollParent = host
      if (!caretEl.isConnected) host.appendChild(caretEl)
    }

    const hostRect = host.getBoundingClientRect()
    const lineHeight = Math.max(4, coords.bottom - coords.top)
    caretEl.style.opacity = '1'
    caretEl.style.height = `${lineHeight}px`
    caretEl.style.left = `${coords.left - hostRect.left + host.scrollLeft}px`
    caretEl.style.top = `${coords.top - hostRect.top + host.scrollTop}px`
  }

  return new Plugin({
    view(view) {
      caretEl = document.createElement('div')
      caretEl.className = 'marki-custom-caret marki-custom-caret--solid'
      caretEl.style.position = 'absolute'
      caretEl.style.left = '0'
      caretEl.style.top = '0'
      caretEl.setAttribute('aria-hidden', 'true')
      hdrEl = document.createElement('div')
      hdrEl.className = 'marki-custom-caret__hdr'
      caretEl.appendChild(hdrEl)

      const onScrollOrResize = () => schedule(view, () => positionCaret(view))
      const onEditorFocus = () => schedule(view, () => positionCaret(view))
      const onEditorBlur = () => schedule(view, () => positionCaret(view))
      window.addEventListener('scroll', onScrollOrResize, true)
      window.addEventListener('resize', onScrollOrResize)
      view.dom.addEventListener('focus', onEditorFocus)
      view.dom.addEventListener('blur', onEditorBlur)

      settingsUnsub = useSettings.subscribe((state, prev) => {
        if (state.settings.editor.caret !== prev.settings.editor.caret) {
          schedule(view, () => positionCaret(view))
        }
      })

      schedule(view, () => positionCaret(view))

      return {
        update(nextView, prevState) {
          if (
            !nextView.state.selection.eq(prevState.selection) ||
            !nextView.state.doc.eq(prevState.doc)
          ) {
            schedule(nextView, () => positionCaret(nextView))
          }
        },
        destroy() {
          cancelAnimationFrame(raf)
          settingsUnsub()
          window.removeEventListener('scroll', onScrollOrResize, true)
          window.removeEventListener('resize', onScrollOrResize)
          view.dom.removeEventListener('focus', onEditorFocus)
          view.dom.removeEventListener('blur', onEditorBlur)
          caretEl?.remove()
        }
      }
    }
  })
}
