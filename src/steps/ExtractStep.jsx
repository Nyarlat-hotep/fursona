import { useEffect, useState } from 'react'
import { removeBackground } from '../lib/backgroundRemoval'
import { binarize, boundingBox, cropMask } from '../lib/mask'
import MaskEditor from '../components/MaskEditor'
import './ExtractStep.css'

export default function ExtractStep({ project, dispatch }) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!project.photoBlob) {
      setStatus('idle')
      return
    }
    if (project.maskBitmap) {
      setStatus('done')
      return
    }
    setStatus('working')
    setProgress(null)
    ;(async () => {
      try {
        const cutoutBlob = await removeBackground(project.photoBlob, (key, current, total) => {
          if (!cancelled && total > 0) setProgress({ key, current, total })
        })
        if (cancelled) return
        const bmp = await createImageBitmap(cutoutBlob)
        const c = document.createElement('canvas')
        c.width = bmp.width
        c.height = bmp.height
        const ctx = c.getContext('2d')
        ctx.drawImage(bmp, 0, 0)
        const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height)
        const fullMask = binarize(imgData, 64)
        const bbox = boundingBox(fullMask, bmp.width, bmp.height)
        if (!bbox) throw new Error('No silhouette detected. Try a clearer photo.')

        const cropped = cropMask(fullMask, bmp.width, bbox)
        const previewCanvas = document.createElement('canvas')
        previewCanvas.width = bbox.w
        previewCanvas.height = bbox.h
        previewCanvas.getContext('2d').drawImage(c, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h)
        const previewUrl = previewCanvas.toDataURL('image/png')

        dispatch({
          type: 'SET_MASK',
          bitmap: {
            mask: cropped,
            width: bbox.w,
            height: bbox.h,
            previewUrl,
            bbox,
            imageWidth: bmp.width,
            imageHeight: bmp.height,
          },
        })
        setStatus('done')
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setError(e.message || 'Background removal failed.')
        }
      }
    })()
    return () => { cancelled = true }
  }, [project.photoBlob, project.maskBitmap, dispatch])

  if (editing && project.maskBitmap?.bbox) {
    return (
      <MaskEditor
        photoUrl={project.photoUrl}
        bitmap={project.maskBitmap}
        onCancel={() => setEditing(false)}
        onCommit={(newBitmap) => {
          dispatch({ type: 'SET_MASK', bitmap: newBitmap })
          setEditing(false)
        }}
      />
    )
  }

  return (
    <div className="extract-step">
      {status === 'working' && (
        <div className="loading">
          <div className="paw-loader">
            <span /><span /><span /><span />
          </div>
          <p className="loading-text">Finding your pet…</p>
          {progress && progress.key === 'fetch' ? (
            <>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }} />
              </div>
              <p className="loading-sub">Downloading model ({Math.round((progress.current / progress.total) * 100)}%) — one-time wait, then cached.</p>
            </>
          ) : (
            <p className="loading-sub">First time? The model is downloading (~30 MB) — this is a one-time wait.</p>
          )}
        </div>
      )}
      {status === 'error' && <p className="error">{error}</p>}
      {status === 'done' && project.maskBitmap && (
        <div className="compare">
          <figure>
            <img src={project.photoUrl} alt="Original" className="thumb" />
            <figcaption>Original</figcaption>
          </figure>
          <figure>
            <img src={project.maskBitmap.previewUrl} alt="Silhouette" className="thumb checker" />
            <figcaption>Silhouette</figcaption>
          </figure>
        </div>
      )}
      <div className="actions">
        <button onClick={() => dispatch({ type: 'GOTO', step: 0 })}>Try another photo</button>
        <button
          onClick={() => setEditing(true)}
          disabled={status !== 'done' || !project.maskBitmap?.bbox}
        >
          ✎ Refine silhouette
        </button>
        <button className="primary" onClick={() => dispatch({ type: 'NEXT' })} disabled={status !== 'done'}>
          Looks good
        </button>
      </div>
    </div>
  )
}
