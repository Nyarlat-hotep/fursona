import { useEffect, useRef, useState } from 'react'
import { ArrowsClockwise, ArrowLeft, CaretDown, Check, FloppyDisk } from '@phosphor-icons/react'
import { useAuth } from '../state/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { SAVE_CAP } from '../lib/savedProjects'
import { useSavedProjects } from '../state/useSavedProjects'
import SignInModal from '../components/SignInModal'
import SaveDialog from '../components/SaveDialog'
import Snackbar from '../components/Snackbar'
import DonationModal from '../components/DonationModal'
import { PALETTES } from '../styles/palettes'
import { PATTERNS } from '../styles/patterns'
import WordCloudCanvas from '../components/WordCloudCanvas'
import { exportPng, listExportSizes } from '../lib/export'
import './StyleStep.css'

const EXPORT_SIZES = listExportSizes()

function SizeDropdown({ value, onChange, options, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`size-dropdown ${open ? 'is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className="size-trigger"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{value} in @ 300 DPI</span>
        <CaretDown size={14} weight="bold" className="size-caret" />
      </button>
      <ul className="size-menu" role="listbox">
        {options.map((s) => (
          <li key={s}>
            <button
              type="button"
              role="option"
              aria-selected={s === value}
              className={`size-option ${s === value ? 'is-selected' : ''}`}
              onClick={() => { onChange(s); setOpen(false) }}
            >
              <span>{s} in @ 300 DPI</span>
              {s === value && <Check size={14} weight="bold" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

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
  const silhouetteMode = project.style.silhouetteMode === 'none' ? 'none' : 'tint'

  const [size, setSize] = useState('8x10')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [signInOpen, setSignInOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [donationOpen, setDonationOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [canvasWidth, setCanvasWidth] = useState(580)
  const canvasWrapRef = useRef(null)

  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      if (w > 0) setCanvasWidth(Math.min(580, w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { user } = useAuth()
  const { count, refresh: refreshSaves } = useSavedProjects(user)
  const isEditingExisting = Boolean(project.currentProjectId)
  const atSaveLimit = count >= SAVE_CAP && !isEditingExisting

  async function runDownload() {
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
      setDonationOpen(false)
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
                onChange={() => {
                  const currentPalette = PALETTES.find((p) => p.id === paletteId)
                  setStyle({ backgroundType: 'color', backgroundValue: currentPalette?.bg || '#eef4ff' })
                }}
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
            <>
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
              <label className="pattern-scale">
                <span className="pattern-scale-label">
                  <span>Pattern scale</span>
                  <span className="pattern-scale-value">{(project.style.patternScale ?? 1).toFixed(2)}×</span>
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.25"
                  value={project.style.patternScale ?? 1}
                  onChange={(e) => setStyle({ patternScale: parseFloat(e.target.value) })}
                />
              </label>
              <label className="pattern-scale">
                <span className="pattern-scale-label">
                  <span>Pattern opacity</span>
                  <span className="pattern-scale-value">{Math.round((project.style.patternOpacity ?? 1) * 100)}%</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={project.style.patternOpacity ?? 1}
                  onChange={(e) => setStyle({ patternOpacity: parseFloat(e.target.value) })}
                />
              </label>
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>Silhouette</legend>
          <div className="silhouette-modes">
            {[
              { id: 'tint', label: 'Tinted fill' },
              { id: 'none', label: 'None' },
            ].map((m) => (
              <label key={m.id} className="silhouette-mode">
                <input
                  type="radio"
                  checked={silhouetteMode === m.id}
                  onChange={() => setStyle({ silhouetteMode: m.id })}
                />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
          {silhouetteMode === 'tint' && (
            <>
              <label className="pattern-scale">
                <span className="pattern-scale-label">
                  <span>Fill opacity</span>
                  <span className="pattern-scale-value">{Math.round((project.style.silhouetteOpacity ?? 1) * 100)}%</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={project.style.silhouetteOpacity ?? 1}
                  onChange={(e) => setStyle({ silhouetteOpacity: parseFloat(e.target.value) })}
                />
              </label>
              <label className="pattern-scale">
                <span className="pattern-scale-label">
                  <span>Smooth edges</span>
                  <span className="pattern-scale-value">{(project.style.silhouetteFeather ?? 0).toFixed(1)}px</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={project.style.silhouetteFeather ?? 0}
                  onChange={(e) => setStyle({ silhouetteFeather: parseFloat(e.target.value) })}
                />
              </label>
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>Palette</legend>
          {PALETTES.map((p) => (
            <label key={p.id} className="palette-row">
              <input
                type="radio"
                checked={paletteId === p.id}
                onChange={() => {
                  const patch = { paletteId: p.id }
                  if (project.style.backgroundType === 'color' && p.bg) {
                    patch.backgroundValue = p.bg
                  }
                  setStyle(patch)
                }}
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
          <SizeDropdown
            value={size}
            onChange={setSize}
            options={EXPORT_SIZES}
            disabled={busy}
          />
          {error && <p className="download-error">{error}</p>}
        </fieldset>
        </aside>

        <section className="preview">
          <AlignmentBar
            style={project.style}
            setStyle={setStyle}
            onRegenerate={() => dispatch({ type: 'REGENERATE' })}
          />
          <div className="preview-canvas-wrap" ref={canvasWrapRef}>
            <WordCloudCanvas project={project} width={canvasWidth} />
          </div>
        </section>
      </div>

      <div className="step-footer">
        <button className="back" onClick={() => dispatch({ type: 'BACK' })} disabled={busy}>
          <ArrowLeft size={16} weight="bold" />
          <span>Back</span>
        </button>
        <div className="footer-right">
          {isSupabaseConfigured && (
            <button
              className="secondary"
              onClick={() => (user ? setSaveOpen(true) : setSignInOpen(true))}
              disabled={busy || atSaveLimit}
              title={atSaveLimit ? `${SAVE_CAP} of ${SAVE_CAP} saves used — delete one to save another.` : undefined}
              type="button"
            >
              <FloppyDisk size={16} weight="bold" />
              <span>{isEditingExisting ? 'Update' : 'Save'}</span>
            </button>
          )}
          <button
            className="primary"
            onClick={() => setDonationOpen(true)}
            disabled={busy}
            type="button"
          >
            {busy ? 'Rendering…' : `Download PNG (${size})`}
          </button>
        </div>
      </div>

      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        onSuccess={() => setSaveOpen(true)}
      />
      <SaveDialog
        open={saveOpen && Boolean(user)}
        project={project}
        user={user}
        onClose={() => setSaveOpen(false)}
        onSaved={(saved) => {
          const wasUpdate = Boolean(project.currentProjectId)
          dispatch({ type: 'SET_CURRENT_PROJECT_ID', id: saved.id })
          refreshSaves()
          setToast(wasUpdate ? 'Cloud updated' : 'Cloud saved')
        }}
      />
      <DonationModal
        open={donationOpen}
        busy={busy}
        onDownload={runDownload}
        onSkip={() => setDonationOpen(false)}
      />
      <Snackbar message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
