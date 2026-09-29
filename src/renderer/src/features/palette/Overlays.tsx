import { FindBar } from '@/features/find/FindBar'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { CommandPalette } from './CommandPalette'

export function Overlays() {
  return (
    <>
      <CommandPalette />
      <FindBar />
      <SettingsPanel />
    </>
  )
}
