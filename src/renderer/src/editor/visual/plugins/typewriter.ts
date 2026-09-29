import { useSettings } from '@/state/settings-store'
import { Plugin } from 'prosemirror-state'

const SCROLL_SUPPRESS_MS = 400

function findScrollParent(el: HTMLElement): HTMLElement {
  let node: HTMLElement | null = el
  while (node) {
    const style = getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY)) return node
    node = node.parentElement
  }
  return document.documentElement
}

export function typewriterPlugin(): Plugin {
  let scrollParent: HTMLElement | null = null
  let guideEl: HTMLDivElement | null = null
  let suppressUntil = 0
  let settingsUnsub = () => {}
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const suppressScroll = () => {
    suppressUntil = performance.now() + SCROLL_SUPPRESS_MS
  }

  const onWheel = () => suppressScroll()
  const onTouchMove = () => suppressScroll()
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.buttons === 4) suppressScroll()
  }

  const readSettings = () => useSettings.getState().settings.editor.typewriter

  const applyPadding = (view: import('prosemirror-view').EditorView) => {
    const { enabled, anchor } = readSettings()
    if (!enabled || !scrollParent) {
      view.dom.style.paddingTop = ''
      view.dom.style.paddingBottom = ''
      return
    }
    const viewport = scrollParent.clientHeight
    const padTop = Math.round(viewport * anchor)
    const padBottom = Math.round(viewport * (1 - anchor))
    view.dom.style.paddingTop = `${padTop}px`
    view.dom.style.paddingBottom = `${padBottom}px`
  }

  const anchorCaret = (view: import('prosemirror-view').EditorView) => {
    const { enabled, anchor, smoothScroll } = readSettings()
    if (!enabled || !scrollParent) return
    if (performance.now() < suppressUntil) return

    const viewport = scrollParent.clientHeight
    const targetY = viewport * anchor
    const coords = view.coordsAtPos(view.state.selection.from)
    if (!coords) return

    const scrollRect = scrollParent.getBoundingClientRect()
    const caretY = coords.top - scrollRect.top + scrollParent.scrollTop
    const nextTop = caretY - targetY
    const behavior: ScrollBehavior =
      smoothScroll && !reducedMotion ? 'smooth' : 'auto'
    scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior })
  }

  const updateGuide = (view: import('prosemirror-view').EditorView) => {
    const { enabled, anchor, showGuide } = readSettings()
    if (!guideEl || !scrollParent) return
    if (!enabled || !showGuide) {
      guideEl.style.display = 'none'
      return
    }
    guideEl.style.display = 'block'
    const viewport = scrollParent.clientHeight
    const y = viewport * anchor
    const scrollRect = scrollParent.getBoundingClientRect()
    const editorRect = view.dom.getBoundingClientRect()
    guideEl.style.top = `${y + editorRect.top - scrollRect.top}px`
  }

  return new Plugin({
    view(view) {
      scrollParent = findScrollParent(view.dom)
      guideEl = document.createElement('div')
      guideEl.className = 'marki-typewriter-guide'
      guideEl.setAttribute('aria-hidden', 'true')
      scrollParent.appendChild(guideEl)

      scrollParent.addEventListener('wheel', onWheel, { passive: true })
      scrollParent.addEventListener('touchmove', onTouchMove, { passive: true })
      scrollParent.addEventListener('pointerdown', onPointerDown)

      settingsUnsub = useSettings.subscribe(() => {
        applyPadding(view)
        updateGuide(view)
        anchorCaret(view)
      })

      applyPadding(view)
      updateGuide(view)
      anchorCaret(view)

      return {
        update(nextView, prevState) {
          applyPadding(nextView)
          updateGuide(nextView)
          const selectionChanged = !nextView.state.selection.eq(prevState.selection)
          const docChanged = !nextView.state.doc.eq(prevState.doc)
          if (selectionChanged || docChanged) anchorCaret(nextView)
        },
        destroy() {
          settingsUnsub()
          scrollParent?.removeEventListener('wheel', onWheel)
          scrollParent?.removeEventListener('touchmove', onTouchMove)
          scrollParent?.removeEventListener('pointerdown', onPointerDown)
          guideEl?.remove()
          view.dom.style.paddingTop = ''
          view.dom.style.paddingBottom = ''
        }
      }
    }
  })
}
