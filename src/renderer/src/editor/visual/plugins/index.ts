import type { Plugin } from 'prosemirror-state'
import { caretPlugin } from './caret'
import { focusPlugin } from './focus'
import { placeholderPlugin } from './placeholder'
import { typewriterPlugin } from './typewriter'
import './modes.css'

export function createModePlugins(): Plugin[] {
  return [typewriterPlugin(), focusPlugin(), caretPlugin(), placeholderPlugin()]
}
