import { FilePlus, FolderOpen, FileText } from 'lucide-react'
import { formatShortcut, modKey } from '@/lib/keys'
import { useDocuments } from '@/state/document-store'
import { useSettings } from '@/state/settings-store'
import { useWorkspace } from '@/state/workspace-store'
import './EmptyState.css'

export function EmptyState() {
  const recentFiles = useSettings((s) => s.settings.files.recentFiles)
  const openFolder = useWorkspace((s) => s.openFolder)
  const newDocument = useDocuments((s) => s.newDocument)
  const open = useDocuments((s) => s.open)

  return (
    <div className="empty-state">
      <h1 className="empty-state__title">Marki</h1>
      <p className="empty-state__subtitle">A distraction-free Markdown studio</p>

      <div className="empty-state__actions">
        <button type="button" className="empty-state__action" onClick={() => void openFolder()}>
          <FolderOpen size={22} />
          <span className="empty-state__action-label">Open Folder</span>
          <span className="empty-state__shortcut">{formatShortcut(['Mod', 'Shift', 'O'])}</span>
        </button>

        <button type="button" className="empty-state__action" onClick={() => newDocument()}>
          <FilePlus size={22} />
          <span className="empty-state__action-label">New Document</span>
          <span className="empty-state__shortcut">{formatShortcut(['Mod', 'N'])}</span>
        </button>

        <button
          type="button"
          className="empty-state__action"
          onClick={async () => {
            const paths = await window.marki.file.pickOpen()
            for (const path of paths) await open(path)
          }}
        >
          <FileText size={22} />
          <span className="empty-state__action-label">Open File</span>
          <span className="empty-state__shortcut">{formatShortcut(['Mod', 'O'])}</span>
        </button>
      </div>

      {recentFiles.length > 0 && (
        <div className="empty-state__recent">
          <h2 className="empty-state__recent-title">Open Recent</h2>
          <ul className="empty-state__recent-list">
            {recentFiles.slice(0, 8).map((path) => (
              <li key={path}>
                <button
                  type="button"
                  className="empty-state__recent-item"
                  onClick={() => void open(path)}
                >
                  {path.split('/').pop() ?? path}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="empty-state__hint">Press {modKey()}K for the command palette</p>
    </div>
  )
}
