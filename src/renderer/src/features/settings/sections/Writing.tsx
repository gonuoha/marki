import { useSettings } from '@/state/settings-store'
import type { CaretBlinkPattern, FocusMode } from '@shared/types'

function hdrSupported(): boolean {
  return window.matchMedia('(dynamic-range: high)').matches
}

export function WritingSection() {
  const editor = useSettings((s) => s.settings.editor)
  const patch = useSettings((s) => s.patch)
  const { typewriter, focus, caret } = editor

  return (
    <section className="settings-section" aria-labelledby="settings-writing">
      <h2 id="settings-writing">Writing</h2>

      <div className="settings-field">
        <label htmlFor="typewriter-enabled">Typewriter mode</label>
        <input
          id="typewriter-enabled"
          type="checkbox"
          checked={typewriter.enabled}
          onChange={(event) =>
            void patch({ editor: { typewriter: { enabled: event.target.checked } } })
          }
        />
      </div>
      <div className="settings-field">
        <label htmlFor="typewriter-anchor">Anchor ({Math.round(typewriter.anchor * 100)}%)</label>
        <input
          id="typewriter-anchor"
          type="range"
          min={0.2}
          max={0.8}
          step={0.01}
          value={typewriter.anchor}
          onChange={(event) =>
            void patch({ editor: { typewriter: { anchor: Number(event.target.value) } } })
          }
        />
      </div>
      <div className="settings-field">
        <label htmlFor="typewriter-guide">Show guide</label>
        <input
          id="typewriter-guide"
          type="checkbox"
          checked={typewriter.showGuide}
          onChange={(event) =>
            void patch({ editor: { typewriter: { showGuide: event.target.checked } } })
          }
        />
      </div>
      <div className="settings-field">
        <label htmlFor="typewriter-smooth">Smooth scroll</label>
        <input
          id="typewriter-smooth"
          type="checkbox"
          checked={typewriter.smoothScroll}
          onChange={(event) =>
            void patch({ editor: { typewriter: { smoothScroll: event.target.checked } } })
          }
        />
      </div>

      <div className="settings-field">
        <label htmlFor="focus-mode">Focus mode</label>
        <select
          id="focus-mode"
          value={focus.mode}
          onChange={(event) =>
            void patch({ editor: { focus: { mode: event.target.value as FocusMode } } })
          }
        >
          <option value="off">Off</option>
          <option value="sentence">Sentence</option>
          <option value="paragraph">Paragraph</option>
          <option value="line">Line</option>
        </select>
      </div>
      <div className="settings-field">
        <label htmlFor="focus-dim">Dim opacity ({focus.dimOpacity})</label>
        <input
          id="focus-dim"
          type="range"
          min={0.05}
          max={0.8}
          step={0.01}
          value={focus.dimOpacity}
          onChange={(event) =>
            void patch({ editor: { focus: { dimOpacity: Number(event.target.value) } } })
          }
        />
      </div>
      <div className="settings-field">
        <label htmlFor="focus-blocks">Dim blocks</label>
        <input
          id="focus-blocks"
          type="checkbox"
          checked={focus.dimBlocks}
          onChange={(event) =>
            void patch({ editor: { focus: { dimBlocks: event.target.checked } } })
          }
        />
      </div>

      <div className="settings-field">
        <label htmlFor="caret-color">Caret colour</label>
        <input
          id="caret-color"
          type="color"
          value={caret.color}
          onChange={(event) => void patch({ editor: { caret: { color: event.target.value } } })}
        />
      </div>
      <div className="settings-field">
        <label htmlFor="caret-thickness">Thickness ({caret.thickness}px)</label>
        <input
          id="caret-thickness"
          type="range"
          min={1}
          max={6}
          step={1}
          value={caret.thickness}
          onChange={(event) =>
            void patch({ editor: { caret: { thickness: Number(event.target.value) } } })
          }
        />
      </div>
      <div className="settings-field">
        <label htmlFor="caret-blink">Blink</label>
        <input
          id="caret-blink"
          type="checkbox"
          checked={caret.blink}
          onChange={(event) => void patch({ editor: { caret: { blink: event.target.checked } } })}
        />
      </div>
      <div className="settings-field">
        <label htmlFor="caret-pattern">Blink pattern</label>
        <select
          id="caret-pattern"
          value={caret.blinkPattern}
          onChange={(event) =>
            void patch({
              editor: { caret: { blinkPattern: event.target.value as CaretBlinkPattern } }
            })
          }
        >
          <option value="solid">Solid</option>
          <option value="smooth">Smooth</option>
          <option value="phase">Phase</option>
          <option value="expand">Expand</option>
        </select>
      </div>
      <div className="settings-field">
        <label htmlFor="caret-hdr">HDR brightness</label>
        <input
          id="caret-hdr"
          type="checkbox"
          checked={caret.hdrBrightness}
          disabled={!hdrSupported()}
          onChange={(event) =>
            void patch({ editor: { caret: { hdrBrightness: event.target.checked } } })
          }
        />
      </div>
      {!hdrSupported() ? (
        <p className="settings-note">
          HDR brightness requires a display that reports high dynamic range support.
        </p>
      ) : null}
      <div className="settings-caret-preview" aria-hidden="true">
        <div
          className={`settings-caret-preview__caret marki-custom-caret marki-custom-caret--${caret.blink ? caret.blinkPattern : 'solid'}${caret.hdrBrightness && hdrSupported() ? ' marki-custom-caret--hdr' : ''}`}
          style={{ width: `${caret.thickness}px`, background: caret.color }}
        >
          {caret.hdrBrightness && hdrSupported() ? <div className="marki-custom-caret__hdr" /> : null}
        </div>
      </div>
    </section>
  )
}
