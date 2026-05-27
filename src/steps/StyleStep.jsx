import { PALETTES } from '../styles/palettes'
import { PATTERNS } from '../styles/patterns'
import WordCloudCanvas from '../components/WordCloudCanvas'
import './StyleStep.css'

export default function StyleStep({ project, dispatch }) {
  const setStyle = (patch) => dispatch({ type: 'SET_STYLE', patch })
  const { backgroundType, backgroundValue, paletteId } = project.style

  return (
    <div className="style-step">
      <aside className="controls">
        <fieldset>
          <legend>Background</legend>
          <div className="bg-type">
            <label>
              <input
                type="radio"
                checked={backgroundType === 'color'}
                onChange={() => setStyle({ backgroundType: 'color', backgroundValue: '#f7f5f0' })}
              />
              Color
            </label>
            <label>
              <input
                type="radio"
                checked={backgroundType === 'pattern'}
                onChange={() => setStyle({ backgroundType: 'pattern', backgroundValue: PATTERNS[0].url })}
              />
              Pattern
            </label>
          </div>

          {backgroundType === 'color' && (
            <input
              type="color"
              value={backgroundValue}
              onChange={(e) => setStyle({ backgroundValue: e.target.value })}
              className="color-input"
            />
          )}

          {backgroundType === 'pattern' && (
            <div className="pattern-grid">
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  className={`pattern-tile ${backgroundValue === p.url ? 'selected' : ''}`}
                  onClick={() => setStyle({ backgroundValue: p.url })}
                  title={p.label}
                  type="button"
                >
                  <img src={p.url} alt={p.label} />
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>Palette</legend>
          {PALETTES.map((p) => (
            <label key={p.id} className="palette-row">
              <input
                type="radio"
                checked={paletteId === p.id}
                onChange={() => setStyle({ paletteId: p.id })}
              />
              <span className="palette-name">{p.label}</span>
              <span className="swatches">
                {p.colors.map((c) => <i key={c} style={{ background: c }} />)}
              </span>
            </label>
          ))}
        </fieldset>

        <button
          className="regenerate"
          onClick={() => dispatch({ type: 'REGENERATE' })}
          type="button"
        >
          🎲 Regenerate
        </button>

        <div className="actions">
          <button onClick={() => dispatch({ type: 'BACK' })}>Back</button>
          <button className="primary" onClick={() => dispatch({ type: 'NEXT' })}>
            Continue to download
          </button>
        </div>
      </aside>

      <section className="preview">
        <div className="preview-toolbar">
          <button
            type="button"
            className="center-toggle"
            onClick={() => setStyle({ centered: !project.style.centered })}
            title={project.style.centered ? 'Switch to silhouette-shaped canvas' : 'Center silhouette on a square canvas'}
          >
            {project.style.centered ? '⤧ Fill canvas' : '↔↕ Center on canvas'}
          </button>
        </div>
        <WordCloudCanvas project={project} width={580} />
      </section>
    </div>
  )
}
