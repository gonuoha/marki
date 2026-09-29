import { useUi } from '@/state/ui-store'
import { useState } from 'react'
import { AppearanceSection } from './sections/Appearance'
import { FilesSection } from './sections/Files'
import { MarkdownSection } from './sections/Markdown'
import { TypographySection } from './sections/Typography'
import { WritingSection } from './sections/Writing'
import '@/editor/visual/plugins/modes.css'
import './settings.css'

const SECTIONS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'typography', label: 'Typography' },
  { id: 'writing', label: 'Writing' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'files', label: 'Files' }
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function SettingsPanel() {
  const open = useUi((s) => s.dialog === 'settings')
  const closeDialog = useUi((s) => s.closeDialog)
  const [section, setSection] = useState<SectionId>('appearance')

  if (!open) return null

  return (
    <div
      className="settings-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog()
      }}
    >
      <div className="settings-panel" role="dialog" aria-label="Settings">
        <nav className="settings-panel__nav" aria-label="Settings sections">
          {SECTIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-current={section === entry.id ? 'page' : undefined}
              onClick={() => setSection(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <div className="settings-panel__content">
          <div className="settings-panel__header">
            <span />
            <button type="button" className="settings-panel__close" onClick={closeDialog}>
              Close
            </button>
          </div>
          {section === 'appearance' ? <AppearanceSection /> : null}
          {section === 'typography' ? <TypographySection /> : null}
          {section === 'writing' ? <WritingSection /> : null}
          {section === 'markdown' ? <MarkdownSection /> : null}
          {section === 'files' ? <FilesSection /> : null}
        </div>
      </div>
    </div>
  )
}
