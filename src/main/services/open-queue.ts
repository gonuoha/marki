/**
 * Files the app has been asked to open before a renderer was ready to receive
 * them: command-line arguments at launch, and `open-file` events that arrive
 * while no window exists yet.
 *
 * The renderer drains this queue itself once it is able to open documents. That
 * ordering matters — pushing the paths at `did-finish-load` races the renderer's
 * own async boot and the message is silently lost if it arrives first.
 */

const pending: string[] = []

export function enqueueOpenFiles(paths: string[]): void {
  for (const path of paths) {
    if (!pending.includes(path)) pending.push(path)
  }
}

export function takePendingOpenFiles(): string[] {
  return pending.splice(0)
}
