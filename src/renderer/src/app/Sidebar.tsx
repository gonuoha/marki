import { FolderOpen, Search } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { FileTree } from '@/features/files/FileTree'
import { useSettings } from '@/state/settings-store'
import { useWorkspace } from '@/state/workspace-store'
import './Sidebar.css'

const MIN_WIDTH = 180
const MAX_WIDTH = 420

export function Sidebar() {
  const showSidebar = useSettings((s) => s.settings.editor.showSidebar)
  const sidebarWidth = useSettings((s) => s.settings.editor.sidebarWidth)
  const patch = useSettings((s) => s.patch)
  const info = useWorkspace((s) => s.info)
  const filter = useWorkspace((s) => s.filter)
  const setFilter = useWorkspace((s) => s.setFilter)
  const openFolder = useWorkspace((s) => s.openFolder)

  const resizing = useRef(false)
  const widthRef = useRef(sidebarWidth)

  useEffect(() => {
    widthRef.current = sidebarWidth
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`)
  }, [sidebarWidth])

  const onResizePointerDown = useCallback((event: React.PointerEvent) => {
    resizing.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onResizePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!resizing.current) return
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, event.clientX))
      widthRef.current = next
      document.documentElement.style.setProperty('--sidebar-width', `${next}px`)
    },
    []
  )

  const onResizePointerUp = useCallback(() => {
    if (!resizing.current) return
    resizing.current = false
    void patch({ editor: { sidebarWidth: widthRef.current } })
  }, [patch])

  return (
    <aside
      className={`sidebar${showSidebar ? '' : ' sidebar--collapsed'}`}
      style={{ width: showSidebar ? sidebarWidth : 0 }}
      aria-label="Workspace sidebar"
      aria-hidden={!showSidebar}
    >
      <div className="sidebar__header">
        <button
          type="button"
          className="sidebar__workspace"
          onClick={() => void openFolder()}
          aria-label={info ? `Switch workspace (${info.name})` : 'Open folder'}
        >
          <FolderOpen size={15} />
          <span className="sidebar__workspace-name">{info?.name ?? 'Open Folder'}</span>
        </button>
      </div>

      <div className="sidebar__filter">
        <Search size={14} className="sidebar__filter-icon" aria-hidden="true" />
        <input
          type="search"
          className="sidebar__filter-input"
          placeholder="Filter files"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Filter files"
        />
      </div>

      <FileTree />

      <div
        className="sidebar__resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
      />
    </aside>
  )
}
