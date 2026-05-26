import { useEffect, useRef, useState } from 'react'
import { prefetchModel } from '../lib/backgroundRemoval'
import './UploadStep.css'

export default function UploadStep({ project, dispatch }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)

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
      {project.photoUrl && (
        <button className="primary" onClick={() => dispatch({ type: 'NEXT' })}>Continue</button>
      )}
    </div>
  )
}
