import { useSettings } from '@/state/settings-store'

export function MarkdownSection() {
  const markdown = useSettings((s) => s.settings.markdown)
  const patch = useSettings((s) => s.patch)

  return (
    <section className="settings-section" aria-labelledby="settings-markdown">
      <h2 id="settings-markdown">Markdown</h2>
      <div className="settings-field">
        <label htmlFor="md-bullet">Bullet</label>
        <select
          id="md-bullet"
          value={markdown.bullet}
          onChange={(event) =>
            void patch({ markdown: { bullet: event.target.value as '-' | '*' | '+' } })
          }
        >
          <option value="-">-</option>
          <option value="*">*</option>
          <option value="+">+</option>
        </select>
      </div>
      <div className="settings-field">
        <label htmlFor="md-emphasis">Emphasis</label>
        <select
          id="md-emphasis"
          value={markdown.emphasis}
          onChange={(event) =>
            void patch({ markdown: { emphasis: event.target.value as '_' | '*' } })
          }
        >
          <option value="_">_</option>
          <option value="*">*</option>
        </select>
      </div>
      <div className="settings-field">
        <label htmlFor="md-strong">Strong</label>
        <select
          id="md-strong"
          value={markdown.strong}
          onChange={(event) =>
            void patch({ markdown: { strong: event.target.value as '__' | '**' } })
          }
        >
          <option value="**">**</option>
          <option value="__">__</option>
        </select>
      </div>
      <div className="settings-field">
        <label htmlFor="md-heading-style">Heading style</label>
        <select
          id="md-heading-style"
          value={markdown.headingStyle}
          onChange={(event) =>
            void patch({ markdown: { headingStyle: event.target.value as 'atx' | 'setext' } })
          }
        >
          <option value="atx">ATX (#)</option>
          <option value="setext">Setext</option>
        </select>
      </div>
      <div className="settings-field">
        <label htmlFor="md-pretty-tables">Pretty tables</label>
        <input
          id="md-pretty-tables"
          type="checkbox"
          checked={markdown.prettyTables}
          onChange={(event) =>
            void patch({ markdown: { prettyTables: event.target.checked } })
          }
        />
      </div>
      <div className="settings-field">
        <label htmlFor="md-wrap">Wrap column (0 disables)</label>
        <input
          id="md-wrap"
          type="number"
          min={0}
          max={120}
          value={markdown.wrapColumn}
          onChange={(event) =>
            void patch({ markdown: { wrapColumn: Number(event.target.value) } })
          }
        />
      </div>
    </section>
  )
}
