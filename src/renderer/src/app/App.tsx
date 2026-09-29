import { useDocuments } from '@/state/document-store'
import { Toasts } from '@/components/Toasts'
import { DialogRoot } from '@/features/dialogs/DialogRoot'
import { Overlays } from '@/features/palette/Overlays'
import { BottomBar } from './BottomBar'
import { EditorHost } from './EditorHost'
import { EmptyState } from './EmptyState'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { TitleBar } from './TitleBar'
import './App.css'

export function App() {
  const document = useDocuments((s) => s.documents.find((d) => d.id === s.activeId) ?? null)

  return (
    <div className="app">
      <TitleBar />
      <div className="app__body">
        <Sidebar />
        <main className="app__main">
          <TabBar />
          {document ? (
            <>
              <EditorHost document={document} />
              <BottomBar document={document} />
            </>
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
      <Toasts />
      <Overlays />
      <DialogRoot />
    </div>
  )
}
