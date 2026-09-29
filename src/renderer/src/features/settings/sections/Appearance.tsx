import { useSettings } from '@/state/settings-store'
import type { ThemeName } from '@shared/types'

const THEMES: Array<{ id: ThemeName; label: string; preview: [string, string] }> = [
  { id: 'system', label: 'System', preview: ['#f6f6f4', '#17181a'] },
  { id: 'light', label: 'Light', preview: ['#ffffff', '#f6f6f4'] },
  { id: 'dark', label: 'Dark', preview: ['#1e2022', '#17181a'] },
  { id: 'sepia', label: 'Sepia', preview: ['#faf3e4', '#f2e9d8'] },
  { id: 'midnight', label: 'Midnight', preview: ['#10131a', '#0b0d12'] }
]

export function AppearanceSection() {
  const theme = useSettings((s) => s.settings.theme)
  const patch = useSettings((s) => s.patch)

  return (
    <section className="settings-section" aria-labelledby="settings-appearance">
      <h2 id="settings-appearance">Appearance</h2>
      <div className="settings-field">
        <span id="theme-label">Theme</span>
        <div className="settings-swatches" role="group" aria-labelledby="theme-label">
          {THEMES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="settings-swatch"
              aria-pressed={theme === entry.id}
              aria-label={`${entry.label} theme`}
              onClick={() => void patch({ theme: entry.id })}
            >
              <div
                className="settings-swatch__preview"
                style={{ background: `linear-gradient(135deg, ${entry.preview[0]}, ${entry.preview[1]})` }}
              />
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
