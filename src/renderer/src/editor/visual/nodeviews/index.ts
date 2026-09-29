import type { NodeViewConstructor } from 'prosemirror-view'
import { createCodeBlockNodeView } from './code-block'
import { createFrontMatterNodeView } from './front-matter'
import { createHtmlBlockNodeView } from './html-block'
import { createImageNodeView } from './image'
import { createMathNodeView } from './math'

export function createNodeViews(baseDir: string | null): Record<string, NodeViewConstructor> {
  return {
    code_block: (node, view, getPos) => createCodeBlockNodeView(node, view, getPos),
    image: (node, view, getPos) => createImageNodeView(node, view, getPos, baseDir),
    math_inline: (node, view, getPos) => createMathNodeView(node, view, getPos, false),
    math_block: (node, view, getPos) => createMathNodeView(node, view, getPos, true),
    html_block: (node, view, getPos) => createHtmlBlockNodeView(node, view, getPos),
    front_matter: (node, view, getPos) => createFrontMatterNodeView(node, view, getPos)
  }
}
