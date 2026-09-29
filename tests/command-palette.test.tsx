import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CommandPalette } from '@/features/palette/CommandPalette'
import { COMMAND_REGISTRY } from '@/features/palette/command-registry'
import { registerCommand } from '@/state/commands'
import { useUi } from '@/state/ui-store'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let container: HTMLDivElement
let root: Root

function render(): void {
  act(() => {
    root.render(<CommandPalette />)
  })
}

function open(): void {
  act(() => {
    useUi.getState().openDialog('palette')
  })
}

// React tracks the previous value on the node itself, so assigning `value`
// directly is ignored. Going through the prototype setter is what makes the
// change look real to it.
const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
  .set as (this: HTMLInputElement, value: string) => void

function type(value: string): void {
  const input = container.querySelector('input') as HTMLInputElement
  act(() => {
    setInputValue.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function optionLabels(): string[] {
  return [...container.querySelectorAll('[role="option"]')].map((el) =>
    (el.querySelector('.palette__item-label')?.textContent ?? '').trim()
  )
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    useUi.getState().closeDialog()
    root.unmount()
  })
  container.remove()
})

describe('command palette', () => {
  it('renders nothing until it is opened', () => {
    render()
    expect(container.innerHTML).toBe('')
  })

  it('lists the command registry when opened', () => {
    render()
    open()

    expect(container.querySelector('input')?.placeholder).toBe('Type a command…')
    expect(optionLabels().length).toBe(COMMAND_REGISTRY.length)
  })

  it('filters commands by fuzzy match', () => {
    render()
    open()
    type('sveas')

    const labels = optionLabels()
    expect(labels).toContain('Save As…')
    expect(labels).not.toContain('Toggle Sidebar')
  })

  it('ranks an exact prefix above a scattered match', () => {
    render()
    open()
    type('save')

    expect(optionLabels()[0]).toMatch(/^Save/)
  })

  it('disables commands that have no handler registered', () => {
    registerCommand('file.save', () => {})
    render()
    open()

    const rows = [...container.querySelectorAll('[role="option"]')] as HTMLButtonElement[]
    const save = rows.find((row) => row.textContent?.includes('Save'))
    const unregistered = rows.find((row) => row.textContent?.includes('Reveal in Finder'))

    expect(save?.disabled).toBe(false)
    expect(unregistered?.disabled).toBe(true)
  })
})

describe('command registry', () => {
  it('gives every command a unique id', () => {
    const ids = COMMAND_REGISTRY.map((command) => command.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  /**
   * Two commands sharing an accelerator means one of them is dead: the native
   * menu binds the first and silently ignores the second.
   */
  it('does not bind one shortcut to two commands', () => {
    const byShortcut = new Map<string, string[]>()
    for (const command of COMMAND_REGISTRY) {
      if (!command.shortcut) continue
      const owners = byShortcut.get(command.shortcut) ?? []
      owners.push(command.id)
      byShortcut.set(command.shortcut, owners)
    }

    const clashes = [...byShortcut.entries()].filter(([, owners]) => owners.length > 1)
    expect(clashes).toEqual([])
  })
})
