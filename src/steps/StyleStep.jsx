import { useState } from 'react'
import { ArrowsClockwise, ArrowLeft } from '@phosphor-icons/react'
import { PALETTES } from '../styles/palettes'
import { PATTERNS } from '../styles/patterns'
import WordCloudCanvas from '../components/WordCloudCanvas'
import { exportPng, listExportSizes } from '../lib/export'
import './StyleStep.css'

const EXPORT_SIZES = listExportSizes()

function AlignIcon({ axis, pos }) {
  // 18×18 viewbox: outer rounded square, inner filled rect positioned per axis+pos
  const inner = (() => {
    if (axis === 'h') {
      if (pos === 'left')   return { x: 3,  y: 5, w: 5,  h: 8 }
      if (pos === 'center') return { x: 6.5, y: 5, w: 5, h: 8 }
      if (pos === 'right')  return { x: 10, y: 5, w: 5,  h: 8 }
    } else {
      if (pos === 'top')    return { x: 5, y: 3,  w: 8, h: 5 }
      if (pos === 'middle') return { x: 5, y: 6.5, w: 8, h: 5 }
      if (pos === 'bottom') return { x: 5, y: 10, w: 8, h: 5 }
    }
    return { x: 0, y: 0, w: 0, h: 0 }
  })()
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <rect x="1" y="1" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx="1" fill="currentColor" />
    </svg>
  )
}

function AlignmentBar({ style, setStyle, onRegenerate }) {
  const { alignH, alignV } = style
  const hOpts = [
    { id: 'left',   label: 'Align left' },
    { id: 'center', label: 'Align horizontal center' },
    { id: 'right',  label: 'Align right' },
  ]
  const vOpts = [
    { id: 'top',    label: 'Align top' },
    { id: 'middle', label: 'Align vertical middle' },
    { id: 'bottom', label: 'Align bottom' },
  ]
  return (
    <div className="align-bar" role="toolbar" aria-label="Alignment">
      <div className="align-group" role="radiogroup" aria-label="Horizontal alignment">
        <span className="align-label">H</span>
        {hOpts.map((o) => (
          <button
            key={o.id}
            type="button"
            className={alignH === o.id ? 'align-btn active' : 'align-btn'}
            onClick={() => setStyle({ alignH: o.id })}
            title={o.label}
            aria-label={o.label}
            aria-pressed={alignH === o.id}
          >
            <AlignIcon axis="h" pos={o.id} />
          </button>
        ))}
      </div>
      <div className="align-group" role="radiogroup" aria-label="Vertical alignment">
        <span className="align-label">V</span>
        {vOpts.map((o) => (
          <button
            key={o.id}
            type="button"
            className={alignV === o.id ? 'align-btn active' : 'align-btn'}
            onClick={() => setStyle({ alignV: o.id })}
            title={o.label}
            aria-label={o.label}
            aria-pressed={alignV === o.id}
          >
            <AlignIcon axis="v" pos={o.id} />
          </button>
        ))}
      </div>
      <button
        type="button"
        className="regen-btn"
        onClick={onRegenerate}
        title="Regenerate cloud"
        aria-label="Regenerate cloud"
      >
        <ArrowsClockwise size={18} weight="bold" />
      </button>
    </div>
  )
}

export default function StyleStep({ project, dispatch }) {
  const setStyle = (patch) => dispatch({ type: 'SET_STYLE', patch })
  const { backgroundType, backgroundValue, paletteId } = project.style

  const [size, setSize] = useState('8x10')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      const blob = await exportPng(project, size)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pet-cloud-${size}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(`Could not render at ${size}. Try a smaller size. (${e.message})`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="style-step">
      <div className="style-grid">
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
              {p.custom ? (
                <span className="swatches custom-swatches">
                  {(project.style.customPaletteColors || []).map((c, i) => (
                    <input
                      key={i}
                      type="color"
                      value={c}
                      onChange={(e) => {
                        const next = [...(project.style.customPaletteColors || [])]
                        next[i] = e.target.value
                        setStyle({ paletteId: 'custom', customPaletteColors: next })
                      }}
                      aria-label={`Custom color ${i + 1}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ))}
                </span>
              ) : (
                <span className="swatches">
                  {p.colors.map((c) => <i key={c} style={{ background: c }} />)}
                </span>
              )}
            </label>
          ))}
        </fieldset>

        <fieldset className="download-fieldset">
          <legend>Print size</legend>
          <label className="size-field">
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              disabled={busy}
            >
              {EXPORT_SIZES.map((s) => (
                <option key={s} value={s}>{s} in @ 300 DPI</option>
              ))}
            </select>
          </label>
          {error && <p className="download-error">{error}</p>}
        </fieldset>
        </aside>

        <section className="preview">
          <AlignmentBar
            style={project.style}
            setStyle={setStyle}
            onRegenerate={() => dispatch({ type: 'REGENERATE' })}
          />
          <WordCloudCanvas project={project} width={580} />
        </section>
      </div>

      <div className="step-footer">
        <button className="back" onClick={() => dispatch({ type: 'BACK' })} disabled={busy}>
          <ArrowLeft size={16} weight="bold" />
          <span>Back</span>
        </button>
        <button
          className="primary"
          onClick={download}
          disabled={busy}
          type="button"
        >
          {busy ? 'Rendering…' : `Download PNG (${size})`}
        </button>
      </div>
    </div>
  )
}
