import { useEffect, useState } from 'react'
import { removeBackground } from '../lib/backgroundRemoval'
import { binarize, boundingBox, cropMask } from '../lib/mask'
import './ExtractStep.css'

export default function ExtractStep({ project, dispatch }) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

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
    ;(async () => {
      try {
        const cutoutBlob = await removeBackground(project.photoBlob)
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
          bitmap: { mask: cropped, width: bbox.w, height: bbox.h, previewUrl },
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

  return (
    <div className="extract-step">
      {status === 'working' && <p className="spinner">Finding your pet…</p>}
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
        <button className="primary" onClick={() => dispatch({ type: 'NEXT' })} disabled={status !== 'done'}>
          Looks good
        </button>
      </div>
    </div>
  )
}
