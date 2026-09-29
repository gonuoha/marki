import { Braces, Columns2, Eye, Focus, PanelLeft, Type, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AppCommand, EditorMode } from '@shared/types'
import { COMMAND_MAP } from '@/features/palette/command-registry'
import { displayShortcut } from '@/lib/keys'
import { runCommand } from '@/state/commands'
import { useDocuments } from '@/state/document-store'
import { useSettings } from '@/state/settings-store'
import './TitleBar.css'

const MODES: { id: EditorMode; command: AppCommand; label: string; icon: LucideIcon }[] = [
  { id: 'visual', command: 'view.modeVisual', label: 'Visual', icon: Eye },
  { id: 'source', command: 'view.modeSource', label: 'Source', icon: Braces },
  { id: 'split', command: 'view.modeSplit', label: 'Split', icon: Columns2 }
]

function tooltip(label: string, command: AppCommand): string {
  const shortcut = COMMAND_MAP.get(command)?.shortcut
  return shortcut ? `${label} (${displayShortcut(shortcut)})` : label
}

interface IconButtonProps {
  label: string
  command: AppCommand
  icon: LucideIcon
  active: boolean
}

function IconButton({ label, command, icon: Icon, active }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`title-bar__icon-btn${active ? ' title-bar__icon-btn--active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={tooltip(label, command)}
      onClick={() => runCommand(command)}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  )
}

export function TitleBar() {
  const [inset, setInset] = useState(78)
  const editor = useSettings((s) => s.settings.editor)
  const document = useDocuments((s) => s.documents.find((d) => d.id === s.activeId) ?? null)

  useEffect(() => {
    void window.marki.app.platform().then((info) => setInset(info.titleBarInset))
  }, [])

  const mode = document?.mode ?? editor.mode
  const focusOn = editor.focus.mode !== 'off'

  return (
    <header className="title-bar" aria-label="Window title bar">
      <div className="title-bar__leading" style={{ paddingLeft: inset }}>
        <IconButton
          label="Toggle sidebar"
          command="view.toggleSidebar"
          icon={PanelLeft}
          active={editor.showSidebar}
        />
      </div>

      <div className="title-bar__title" title={document?.path ?? undefined}>
        <span className="title-bar__name">{document ? document.title : 'Marki'}</span>
        {document?.dirty && <span className="title-bar__dirty" aria-label="Unsaved changes" />}
      </div>

      <div className="title-bar__controls">
        {document && (
          <>
            <div className="title-bar__group" role="group" aria-label="Editor mode">
              {MODES.map((item) => (
                <IconButton
                  key={item.id}
                  label={`${item.label} mode`}
                  command={item.command}
                  icon={item.icon}
                  active={mode === item.id}
                />
              ))}
            </div>
            <span className="title-bar__divider" aria-hidden="true" />
          </>
        )}
        <IconButton
          label="Typewriter mode"
          command="view.toggleTypewriter"
          icon={Type}
          active={editor.typewriter.enabled}
        />
        <IconButton
          label={focusOn ? 'Focus mode off' : 'Focus mode'}
          command={focusOn ? 'view.focusOff' : 'view.focusParagraph'}
          icon={Focus}
          active={focusOn}
        />
      </div>
    </header>
  )
}
