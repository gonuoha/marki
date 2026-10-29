export { normalizeExternalUrl, urlAtLineIndex } from '@shared/open-link'

import type { EditorState } from 'prosemirror-state'
import { useUi } from '@/state/ui-store'

export function findLinkAnchor(target: EventTarget | null, root: HTMLElement): HTMLAnchorElement | null {
  const el = target instanceof Element ? target : null
  if (!el) return null
  const anchor = el.closest('a[href]')
  if (anchor instanceof HTMLAnchorElement && root.contains(anchor)) return anchor
  return null
}

export function linkHrefAtPos(state: EditorState, pos: number): string | null {
  const $pos = state.doc.resolve(Math.max(1, Math.min(pos, state.doc.content.size)))
  const linkType = state.schema.marks.link
  if (!linkType) return null
  const mark = linkType.isInSet($pos.marks())
  if (!mark) return null
  const href = String(mark.attrs.href ?? '').trim()
  return href || null
}

export async function openLinkInBrowser(href: string): Promise<void> {
  const result = await window.marki.app.openLink(href)
  if (result === 'invalid') {
    useUi.getState().toast('error', 'This link cannot be opened in a browser')
  }
}
