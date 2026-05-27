import { useEffect, useRef, useState } from 'react'
import { Camera, CaretDown } from '@phosphor-icons/react'
import { prefetchModel } from '../lib/backgroundRemoval'
import './UploadStep.css'

export default function UploadStep({ project, dispatch }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [tipsOpen, setTipsOpen] = useState(false)

  useEffect(() => { prefetchModel() }, [])

  function handleFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.')
      return
    }
    setError(null)
    const url = URL.createObjectURL(file)
    dispatch({ type: 'SET_PHOTO', blob: file, url })
  }

  return (
    <div className="upload-step">
      <div
        className={`drop-zone ${dragOver ? 'is-over' : ''} ${project.photoUrl ? 'has-photo' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        onClick={() => inputRef.current?.click()}
      >
        {project.photoUrl ? (
          <img src={project.photoUrl} alt="Uploaded pet" className="preview" />
        ) : (
          <div className="prompt">
            <p><strong>Drop a photo of your pet here</strong></p>
            <p className="muted">or click to choose a file</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0])}
          hidden
        />
      </div>
      {error && <p className="error">{error}</p>}

      <div className={`tips ${tipsOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="tips-summary"
          onClick={() => setTipsOpen((o) => !o)}
          aria-expanded={tipsOpen}
        >
          <span className="tips-title">
            <Camera size={18} weight="bold" />
            Tips for the best silhouette
          </span>
          <span className="tips-chevron" aria-hidden="true">
            <CaretDown size={16} weight="bold" />
          </span>
        </button>
        <div className="tips-content">
          <div className="tips-inner">
            <ul>
              <li>Pick a photo with one clear subject — your pet, centered</li>
              <li>A plain, uncluttered background works best (grass, wall, floor)</li>
              <li>Good lighting helps — avoid backlit shots and deep shadows</li>
              <li>The whole pet should be in frame, ideally not cropped at edges</li>
              <li>Side or 3/4 profiles often look better than head-on shots</li>
            </ul>
          </div>
        </div>
      </div>

      {project.photoUrl && (
        <button className="primary" onClick={() => dispatch({ type: 'NEXT' })}>Continue</button>
      )}
    </div>
  )
}
