import { useState } from 'react'
import { exportPng, listExportSizes } from '../lib/export'
import './DownloadStep.css'

const SIZES = listExportSizes()

export default function DownloadStep({ project, dispatch }) {
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
    <div className="download-step">
      <p className="lead">Pick a print size and download your pet's word cloud.</p>

      <label className="field">
        <span className="label">Print size</span>
        <select value={size} onChange={(e) => setSize(e.target.value)} disabled={busy}>
          {SIZES.map((s) => <option key={s} value={s}>{s} in @ 300 DPI</option>)}
        </select>
      </label>

      <button className="primary big" onClick={download} disabled={busy} type="button">
        {busy ? 'Rendering…' : `Download PNG (${size})`}
      </button>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button onClick={() => dispatch({ type: 'BACK' })} disabled={busy}>Back</button>
        <button
          onClick={() => { if (confirm('Start over from scratch?')) dispatch({ type: 'RESET' }) }}
          disabled={busy}
          className="link"
        >
          Start over
        </button>
      </div>
    </div>
  )
}
