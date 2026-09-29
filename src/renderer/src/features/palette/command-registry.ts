import type { AppCommand } from '@shared/types'

export interface CommandDefinition {
  id: AppCommand
  label: string
  category: string
  shortcut?: string
  icon?: string
}

/**
 * Shortcuts here are display strings and must match the accelerators in
 * `src/main/menu.ts` and the bindings in `editor/visual/keymap.ts`.
 */
export const COMMAND_REGISTRY: CommandDefinition[] = [
  { id: 'file.new', label: 'New Document', category: 'File', shortcut: 'Mod-N', icon: 'file-plus' },
  { id: 'file.open', label: 'Open…', category: 'File', shortcut: 'Mod-O', icon: 'folder-open' },
  { id: 'file.openFolder', label: 'Open Folder…', category: 'File', shortcut: 'Mod-Shift-O', icon: 'folder' },
  { id: 'file.save', label: 'Save', category: 'File', shortcut: 'Mod-S', icon: 'save' },
  { id: 'file.saveAs', label: 'Save As…', category: 'File', shortcut: 'Mod-Shift-S', icon: 'save' },
  { id: 'file.closeTab', label: 'Close Tab', category: 'File', shortcut: 'Mod-W', icon: 'x' },
  { id: 'file.revealInFinder', label: 'Reveal in Finder', category: 'File', shortcut: 'Mod-Alt-R', icon: 'folder-search' },
  { id: 'edit.find', label: 'Find & Replace', category: 'Edit', shortcut: 'Mod-F', icon: 'search' },
  { id: 'view.modeVisual', label: 'Visual Mode', category: 'View', shortcut: 'Mod-Alt-1', icon: 'eye' },
  { id: 'view.modeSource', label: 'Source Mode', category: 'View', shortcut: 'Mod-Alt-2', icon: 'code' },
  { id: 'view.modeSplit', label: 'Split Mode', category: 'View', shortcut: 'Mod-Alt-3', icon: 'columns' },
  { id: 'view.toggleSidebar', label: 'Toggle Sidebar', category: 'View', shortcut: 'Mod-Alt-S', icon: 'panel-left' },
  { id: 'view.toggleTypewriter', label: 'Toggle Typewriter Mode', category: 'View', shortcut: 'Mod-Alt-W', icon: 'type' },
  { id: 'view.focusOff', label: 'Focus Mode Off', category: 'View', icon: 'focus' },
  { id: 'view.focusSentence', label: 'Focus Sentence', category: 'View', icon: 'focus' },
  { id: 'view.focusParagraph', label: 'Focus Paragraph', category: 'View', icon: 'focus' },
  { id: 'view.zoomIn', label: 'Zoom In', category: 'View', shortcut: 'Mod-=', icon: 'zoom-in' },
  { id: 'view.zoomOut', label: 'Zoom Out', category: 'View', shortcut: 'Mod--', icon: 'zoom-out' },
  { id: 'view.zoomReset', label: 'Reset Zoom', category: 'View', shortcut: 'Mod-Shift-0', icon: 'zoom-out' },
  { id: 'format.bold', label: 'Bold', category: 'Format', shortcut: 'Mod-B', icon: 'bold' },
  { id: 'format.italic', label: 'Italic', category: 'Format', shortcut: 'Mod-I', icon: 'italic' },
  { id: 'format.strikethrough', label: 'Strikethrough', category: 'Format', shortcut: 'Mod-Shift-X', icon: 'strikethrough' },
  { id: 'format.code', label: 'Inline Code', category: 'Format', shortcut: 'Mod-E', icon: 'code' },
  { id: 'format.link', label: 'Insert Link', category: 'Format', shortcut: 'Mod-Shift-K', icon: 'link' },
  { id: 'format.image', label: 'Insert Image', category: 'Format', shortcut: 'Mod-Shift-I', icon: 'image' },
  { id: 'format.table', label: 'Insert Table', category: 'Format', shortcut: 'Mod-Alt-T', icon: 'table' },
  { id: 'format.codeBlock', label: 'Code Block', category: 'Format', shortcut: 'Mod-Shift-C', icon: 'square-code' },
  { id: 'format.quote', label: 'Blockquote', category: 'Format', shortcut: 'Mod-Shift-.', icon: 'quote' },
  { id: 'format.bulletList', label: 'Bullet List', category: 'Format', shortcut: 'Mod-Shift-8', icon: 'list' },
  { id: 'format.orderedList', label: 'Ordered List', category: 'Format', shortcut: 'Mod-Shift-7', icon: 'list-ordered' },
  { id: 'format.taskList', label: 'Task List', category: 'Format', shortcut: 'Mod-Shift-9', icon: 'list-checks' },
  { id: 'format.footnote', label: 'Footnote', category: 'Format', icon: 'asterisk' },
  { id: 'format.math', label: 'Math', category: 'Format', shortcut: 'Mod-Shift-M', icon: 'sigma' },
  { id: 'format.horizontalRule', label: 'Horizontal Rule', category: 'Format', shortcut: 'Mod-Shift-L', icon: 'minus' },
  { id: 'format.heading1', label: 'Heading 1', category: 'Format', shortcut: 'Mod-1', icon: 'heading-1' },
  { id: 'format.heading2', label: 'Heading 2', category: 'Format', shortcut: 'Mod-2', icon: 'heading-2' },
  { id: 'format.heading3', label: 'Heading 3', category: 'Format', shortcut: 'Mod-3', icon: 'heading-3' },
  { id: 'format.heading4', label: 'Heading 4', category: 'Format', shortcut: 'Mod-4', icon: 'heading-4' },
  { id: 'format.heading5', label: 'Heading 5', category: 'Format', shortcut: 'Mod-5', icon: 'heading-5' },
  { id: 'format.heading6', label: 'Heading 6', category: 'Format', shortcut: 'Mod-6', icon: 'heading-6' },
  { id: 'format.paragraph', label: 'Paragraph', category: 'Format', shortcut: 'Mod-0', icon: 'pilcrow' },
  { id: 'app.settings', label: 'Settings', category: 'App', shortcut: 'Mod-,', icon: 'settings' },
  { id: 'app.commandPalette', label: 'Command Palette', category: 'App', shortcut: 'Mod-K', icon: 'command' }
]

export const COMMAND_MAP = new Map(COMMAND_REGISTRY.map((entry) => [entry.id, entry]))
