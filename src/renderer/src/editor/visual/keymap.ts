import {
  baseKeymap,
  chainCommands,
  createParagraphNear,
  deleteSelection,
  exitCode,
  joinBackward,
  liftEmptyBlock,
  newlineInCode,
  selectNodeBackward,
  setBlockType,
  splitBlock
} from 'prosemirror-commands'
import { TextSelection, type Command, type EditorState } from 'prosemirror-state'
import type { ResolvedPos } from 'prosemirror-model'
import { undo, redo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { goToNextCell, isInTable } from 'prosemirror-tables'
import { undoInputRule } from 'prosemirror-inputrules'
import { schema } from '@/editor/markdown'
import {
  insertCodeBlock,
  insertHorizontalRule,
  insertMath,
  liftListItemCommand,
  openImageDialog,
  openTableDialog,
  setHeading,
  setParagraph,
  sinkListItemCommand,
  splitListItemCommand,
  toggleBlockquote,
  toggleBulletList,
  toggleCode,
  toggleEm,
  toggleLink,
  toggleOrderedList,
  toggleStrikethrough,
  toggleStrong,
  toggleTaskList
} from './commands'

function cursorAtBlockStart(state: EditorState): ResolvedPos | null {
  const { selection } = state
  if (!(selection instanceof TextSelection)) return null
  const $cursor = selection.$cursor
  if (!$cursor || $cursor.parentOffset > 0) return null
  return $cursor
}

/**
 * Backspace at the start of a heading turns it back into a paragraph. Deleting
 * a heading's text and pressing Backspace once more therefore removes the
 * heading itself instead of leaving an empty one that cannot be deleted.
 */
const resetHeadingAtStart: Command = (state, dispatch) => {
  const $cursor = cursorAtBlockStart(state)
  if (!$cursor || $cursor.parent.type !== schema.nodes.heading) return false
  return setBlockType(schema.nodes.paragraph)(state, dispatch)
}

/**
 * Backspace at the start of a list item's first block lifts the item out of
 * the list (or out one nesting level), the way word processors remove a bullet.
 */
const liftListItemAtStart: Command = (state, dispatch) => {
  const $cursor = cursorAtBlockStart(state)
  if (!$cursor || $cursor.depth < 2) return false
  const item = $cursor.node(-1)
  if (item.type !== schema.nodes.list_item || $cursor.index(-1) !== 0) return false
  return liftListItemCommand()(state, dispatch)
}

/**
 * Replaces baseKeymap's Backspace, so it must keep that chain intact after the
 * Marki-specific steps; whatever it declines falls through to native deletion.
 */
export const backspace: Command = chainCommands(
  undoInputRule,
  resetHeadingAtStart,
  liftListItemAtStart,
  deleteSelection,
  joinBackward,
  selectNodeBackward
)

/**
 * Enter at the end of a heading starts a paragraph. Plain `splitBlock` would
 * open a second heading, which is never what someone wants after titling a
 * section.
 */
const splitHeadingIntoParagraph: Command = (state, dispatch) => {
  const { $from, empty } = state.selection
  if (!empty) return false
  const heading = state.schema.nodes.heading
  const paragraph = state.schema.nodes.paragraph
  if (!heading || !paragraph || $from.parent.type !== heading) return false
  if ($from.parentOffset < $from.parent.content.size) return false
  if (dispatch) {
    dispatch(state.tr.split($from.pos, 1, [{ type: paragraph }]).scrollIntoView())
  }
  return true
}

function buildKeymap() {
  const keys: { [key: string]: Command } = {
    ...baseKeymap,
    'Mod-z': undo,
    'Mod-y': redo,
    'Mod-Shift-z': redo,
    'Mod-b': toggleStrong(),
    'Mod-i': toggleEm(),
    'Mod-Shift-x': toggleStrikethrough(),
    'Mod-e': toggleCode(),
    // Mod-K belongs to the command palette (F12), so linking takes Mod-Shift-K.
    'Mod-Shift-k': toggleLink(),
    'Mod-Shift-i': openImageDialog(),
    'Mod-Alt-t': openTableDialog(),
    'Mod-Shift-c': insertCodeBlock(),
    'Mod-1': setHeading(1),
    'Mod-2': setHeading(2),
    'Mod-3': setHeading(3),
    'Mod-4': setHeading(4),
    'Mod-5': setHeading(5),
    'Mod-6': setHeading(6),
    'Mod-0': setParagraph(),
    'Mod-Shift-8': toggleBulletList(),
    'Mod-Shift-7': toggleOrderedList(),
    'Mod-Shift-9': toggleTaskList(),
    'Mod-Shift-.': toggleBlockquote(),
    'Mod-Shift-l': insertHorizontalRule(),
    // Mod-M is the macOS Minimize accelerator, which the native menu claims first.
    'Mod-Shift-m': insertMath(true),
    // This entry replaces baseKeymap's Enter, so it has to cover the ordinary
    // cases too: without splitBlock and friends, Enter does nothing in a plain
    // paragraph.
    Enter: chainCommands(
      (state, dispatch) => (isInTable(state) ? goToNextCell(1)(state, dispatch) : false),
      splitListItemCommand(),
      newlineInCode,
      splitHeadingIntoParagraph,
      createParagraphNear,
      liftEmptyBlock,
      splitBlock
    ),
    'Shift-Enter': chainCommands(
      (state, dispatch) => (isInTable(state) ? goToNextCell(-1)(state, dispatch) : false),
      exitCode,
      (state, dispatch) => {
        const hardBreak = state.schema.nodes.hard_break
        if (!hardBreak) return false
        if (dispatch) dispatch(state.tr.replaceSelectionWith(hardBreak.create()).scrollIntoView())
        return true
      }
    ),
    Tab: chainCommands(
      (state, dispatch) => {
        if (isInTable(state)) {
          return goToNextCell(1)(state, dispatch)
        }
        return sinkListItemCommand()(state, dispatch)
      }
    ),
    'Shift-Tab': chainCommands(
      (state, dispatch) => {
        if (isInTable(state)) {
          return goToNextCell(-1)(state, dispatch)
        }
        return liftListItemCommand()(state, dispatch)
      }
    ),
    Backspace: backspace
  }

  return keymap(keys)
}

export function createKeymap() {
  return buildKeymap()
}
