import { displayShortcut } from '@/lib/keys'
import { commandIsRegistered, runCommand } from '@/state/commands'
import { useUi } from '@/state/ui-store'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { COMMAND_REGISTRY, type CommandDefinition } from './command-registry'
import './palette.css'

interface ScoredCommand {
  command: CommandDefinition
  score: number
  ranges: Array<[number, number]>
}

function fuzzyScore(label: string, query: string): { score: number; ranges: Array<[number, number]> } | null {
  const target = label.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return { score: 1, ranges: [] }

  let ti = 0
  let score = 0
  let lastMatch = -1
  const ranges: Array<[number, number]> = []

  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    let found = -1
    for (let i = ti; i < target.length; i++) {
      if (target[i] === ch) {
        found = i
        break
      }
    }
    if (found === -1) return null
    if (found === 0 || /[\s/_-]/.test(target[found - 1] ?? '')) score += 8
    if (found === ti) score += 6
    else score += Math.max(1, 4 - (found - ti))
    if (lastMatch === found - 1) score += 4
    ranges.push([found, found + 1])
    lastMatch = found
    ti = found + 1
  }

  score -= target.length * 0.05
  return { score, ranges }
}

function highlightLabel(label: string, ranges: Array<[number, number]>) {
  if (ranges.length === 0) return label
  const merged = [...ranges].sort((a, b) => a[0] - b[0])
  const parts: Array<string | ReactNode> = []
  let cursor = 0
  merged.forEach(([start, end], index) => {
    if (start > cursor) parts.push(label.slice(cursor, start))
    parts.push(<mark key={`${start}-${index}`}>{label.slice(start, end)}</mark>)
    cursor = end
  })
  if (cursor < label.length) parts.push(label.slice(cursor))
  return parts
}

export function CommandPalette() {
  const open = useUi((s) => s.dialog === 'palette')
  const closeDialog = useUi((s) => s.closeDialog)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const scored: ScoredCommand[] = []
    for (const command of COMMAND_REGISTRY) {
      const match = fuzzyScore(command.label, query)
      if (!match) continue
      scored.push({ command, score: match.score, ranges: match.ranges })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored
  }, [query])

  const grouped = useMemo(() => {
    const map = new Map<string, ScoredCommand[]>()
    for (const item of results) {
      const list = map.get(item.command.category) ?? []
      list.push(item)
      map.set(item.command.category, list)
    }
    return [...map.entries()]
  }, [results])

  const flat = useMemo(() => grouped.flatMap(([, items]) => items), [grouped])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  if (!open) return null

  const runActive = () => {
    const item = flat[activeIndex]
    if (!item || !commandIsRegistered(item.command.id)) return
    closeDialog()
    runCommand(item.command.id)
  }

  return (
    <div
      className="palette-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog()
      }}
    >
      <div className="palette" role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          className="palette__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a command…"
          aria-label="Filter commands"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              closeDialog()
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActiveIndex((index) => Math.min(flat.length - 1, index + 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((index) => Math.max(0, index - 1))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              runActive()
            }
          }}
        />
        <div className="palette__list" role="listbox" aria-label="Commands">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <div className="palette__group-label">{category}</div>
              {items.map((item) => {
                const index = flat.indexOf(item)
                const enabled = commandIsRegistered(item.command.id)
                return (
                  <button
                    key={item.command.id}
                    type="button"
                    className={`palette__item${index === activeIndex ? ' palette__item--active' : ''}`}
                    disabled={!enabled}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      if (!enabled) return
                      closeDialog()
                      runCommand(item.command.id)
                    }}
                  >
                    <span className="palette__item-label">
                      {highlightLabel(item.command.label, item.ranges)}
                    </span>
                    {item.command.shortcut ? (
                      <span className="palette__shortcut">{displayShortcut(item.command.shortcut)}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
