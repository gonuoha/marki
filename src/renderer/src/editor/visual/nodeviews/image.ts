import type { Node as ProseNode } from 'prosemirror-model'
import { NodeSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { NodeView } from 'prosemirror-view'
import { useUi } from '@/state/ui-store'

const dataUrlCache = new Map<string, string | null>()

export function clearImageCache(): void {
  dataUrlCache.clear()
}

async function resolveImageSrc(src: string, baseDir: string | null): Promise<string | null> {
  const key = `${baseDir ?? ''}::${src}`
  if (dataUrlCache.has(key)) {
    return dataUrlCache.get(key) ?? null
  }
  if (/^(https?:|data:)/i.test(src)) {
    dataUrlCache.set(key, src)
    return src
  }
  try {
    const dataUrl = await window.marki.file.readAsDataUrl(src, baseDir)
    dataUrlCache.set(key, dataUrl)
    return dataUrl
  } catch {
    dataUrlCache.set(key, null)
    return null
  }
}

function alignClass(align: string): string {
  switch (align) {
    case 'left':
      return 'marki-image--left'
    case 'center':
      return 'marki-image--center'
    case 'right':
      return 'marki-image--right'
    case 'float-right':
      return 'marki-image--float-right'
    default:
      return ''
  }
}

export function createImageNodeView(
  node: ProseNode,
  view: EditorView,
  getPos: () => number | undefined,
  baseDir: string | null
): NodeView {
  const dom = document.createElement('span')
  dom.className = `marki-image ${alignClass(String(node.attrs.align ?? 'none'))}`
  dom.setAttribute('data-node-view', 'image')
  dom.contentEditable = 'false'

  const img = document.createElement('img')
  img.alt = node.attrs.alt ? String(node.attrs.alt) : ''
  if (node.attrs.title) img.title = String(node.attrs.title)
  if (node.attrs.width) {
    const w = Number(node.attrs.width)
    if (w) img.setAttribute('width', String(w))
  }
  img.draggable = true

  const broken = document.createElement('span')
  broken.className = 'marki-image__broken'
  broken.textContent = 'Image unavailable'
  broken.hidden = true

  dom.appendChild(img)
  dom.appendChild(broken)

  const load = async (src: string) => {
    const resolved = await resolveImageSrc(src, baseDir)
    if (resolved) {
      img.src = resolved
      img.hidden = false
      broken.hidden = true
    } else {
      img.hidden = true
      broken.hidden = false
    }
  }

  void load(String(node.attrs.src ?? ''))

  dom.addEventListener('click', (event) => {
    event.preventDefault()
    const pos = getPos()
    if (pos == null) return
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)))
  })

  dom.addEventListener('dblclick', (event) => {
    event.preventDefault()
    const pos = getPos()
    if (pos == null) return
    useUi.getState().openDialog('image', {
      view,
      pos,
      attrs: { ...node.attrs }
    })
  })

  return {
    dom,
    selectNode() {
      dom.classList.add('marki-image--selected')
    },
    deselectNode() {
      dom.classList.remove('marki-image--selected')
    },
    update(updated: ProseNode) {
      if (updated.type !== node.type) return false
      node = updated
      img.alt = updated.attrs.alt ? String(updated.attrs.alt) : ''
      img.title = updated.attrs.title ? String(updated.attrs.title) : ''
      if (updated.attrs.width) {
        const w = Number(updated.attrs.width)
        if (w) img.setAttribute('width', String(w))
        else img.removeAttribute('width')
      } else {
        img.removeAttribute('width')
      }
      dom.className = `marki-image ${alignClass(String(updated.attrs.align ?? 'none'))}`
      void load(String(updated.attrs.src ?? ''))
      return true
    },
    ignoreMutation: () => true,
    stopEvent: () => true
  }
}

export async function importAndInsertImage(
  view: EditorView,
  request: {
    documentPath: string | null
    sourcePath?: string
    bytes?: Uint8Array
    fileName: string
  }
): Promise<void> {
  const result = await window.marki.assets.importImage(request)
  const image = view.state.schema.nodes.image.create({
    src: result.markdownPath,
    alt: null,
    title: null,
    width: null,
    align: 'none'
  })
  const tr = view.state.tr.replaceSelectionWith(image)
  view.dispatch(tr.scrollIntoView())
}
