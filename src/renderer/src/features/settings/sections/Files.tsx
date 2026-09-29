import { useSettings } from '@/state/settings-store'

export function FilesSection() {
  const files = useSettings((s) => s.settings.files)
  const patch = useSettings((s) => s.patch)

  return (
    <section className="settings-section" aria-labelledby="settings-files">
      <h2 id="settings-files">Files</h2>
      <div className="settings-field">
        <label htmlFor="autosave-delay">Autosave delay (ms)</label>
        <input
          id="autosave-delay"
          type="number"
          min={0}
          step={100}
          value={files.autosaveDelay}
          onChange={(event) =>
            void patch({ files: { autosaveDelay: Number(event.target.value) } })
          }
        />
      </div>
      <div className="settings-field">
        <label htmlFor="image-folder">Image folder</label>
        <input
          id="image-folder"
          type="text"
          value={files.imageFolder}
          onChange={(event) => void patch({ files: { imageFolder: event.target.value } })}
        />
      </div>
      <div className="settings-field">
        <label htmlFor="restore-session">Restore session on launch</label>
        <input
          id="restore-session"
          type="checkbox"
          checked={files.restoreSession}
          onChange={(event) =>
            void patch({ files: { restoreSession: event.target.checked } })
          }
        />
      </div>
    </section>
  )
}
