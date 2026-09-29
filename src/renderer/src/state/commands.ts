import type { AppCommand } from '@shared/types'

export type CommandHandler = () => void | Promise<void>

const handlers = new Map<AppCommand, CommandHandler>()
const warned = new Set<AppCommand>()

export function registerCommand(id: AppCommand, handler: CommandHandler): () => void {
  handlers.set(id, handler)
  return () => {
    if (handlers.get(id) === handler) handlers.delete(id)
  }
}

export function runCommand(id: AppCommand): void {
  const handler = handlers.get(id)
  if (!handler) {
    if (!warned.has(id)) {
      warned.add(id)
      console.warn(`[commands] unregistered command: ${id}`)
    }
    return
  }
  void handler()
}

export function commandIsRegistered(id: AppCommand): boolean {
  return handlers.has(id)
}
