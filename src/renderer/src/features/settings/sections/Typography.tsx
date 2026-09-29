import { useSettings } from '@/state/settings-store'

export function TypographySection() {
  const typography = useSettings((s) => s.settings.editor.typography)
  const patch = useSettings((s) => s.patch)

  return (
    <section className="settings-section" aria-labelledby="settings-typography">
      <h2 id="settings-typography">Typography</h2>
      <div className="settings-field">
        <label htmlFor="body-font">Body font</label>
        <input
          id="body-font"
          type="text"
          value={typography.bodyFont}
          onChange={(event) => void patch({ editor: { typography: { bodyFont: event.target.value } } })}
        />
      </div>
      <div className="settings-field">
        <label htmlFor="mono-font">Monospace font</label>
        <input
          id="mono-font"
          type="text"
          value={typography.monoFont}
          onChange={(event) => void patch({ editor: { typography: { monoFont: event.target.value } } })}
        />
      </div>
      <div className="settings-field">
        <label htmlFor="font-size">Font size ({typography.fontSize}px)</label>
        <input
          id="font-size"
          type="range"
          min={12}
          max={28}
          step={1}
          value={typography.fontSize}
          onChange={(event) =>
            void patch({ editor: { typography: { fontSize: Number(event.target.value) } } })
          }
        />
      </div>
      <div className="settings-field">
        <label htmlFor="line-height">Line height ({typography.lineHeight})</label>
        <input
          id="line-height"
          type="range"
          min={1.2}
          max={2.2}
          step={0.05}
          value={typography.lineHeight}
          onChange={(event) =>
            void patch({ editor: { typography: { lineHeight: Number(event.target.value) } } })
          }
        />
      </div>
      <div className="settings-field">
        <label htmlFor="measure">Measure ({typography.measure}px)</label>
        <input
          id="measure"
          type="range"
          min={480}
          max={960}
          step={10}
          value={typography.measure}
          onChange={(event) =>
            void patch({ editor: { typography: { measure: Number(event.target.value) } } })
          }
        />
      </div>
      <div
        className="settings-sample"
        style={{
          fontFamily: typography.bodyFont,
          fontSize: `${typography.fontSize}px`,
          lineHeight: typography.lineHeight,
          maxWidth: `${typography.measure}px`
        }}
      >
        The quick brown fox jumps over the lazy dog. Typography changes apply live across the editor.
      </div>
    </section>
  )
}
