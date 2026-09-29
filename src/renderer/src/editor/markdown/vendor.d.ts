/**
 * Ambient declarations for the two markdown-it plugins that ship without types.
 * Both are ordinary markdown-it plugins: they mutate the instance and return
 * nothing.
 */

declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it'

  const footnotePlugin: (md: MarkdownIt) => void
  export default footnotePlugin
}

declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'

  interface TaskListsOptions {
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }

  const taskListsPlugin: (md: MarkdownIt, options?: TaskListsOptions) => void
  export default taskListsPlugin
}
