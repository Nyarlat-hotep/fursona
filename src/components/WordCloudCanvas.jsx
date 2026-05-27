import { useEffect, useRef } from 'react'
import { renderWordCloudToCanvas } from '../lib/renderWordCloud'
import { paletteById } from '../styles/palettes'
import './WordCloudCanvas.css'

export default function WordCloudCanvas({ project, width }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!project.maskBitmap || project.names.length === 0) return
    const { mask, width: mw, height: mh } = project.maskBitmap
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    // Square canvas so silhouette has room to move horizontally and vertically.
    const cssW = width
    const cssH = width
    const renderW = Math.round(cssW * dpr)
    const renderH = Math.round(cssH * dpr)

    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = renderW
    canvas.height = renderH
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'

    let cancelled = false
    renderWordCloudToCanvas({
      canvas,
      mask,
      maskWidth: mw,
      maskHeight: mh,
      names: project.names.map((n) => n.text),
      seed: project.seed,
      style: project.style,
      palette: paletteById(project.style.paletteId),
    }).catch((e) => {
      if (!cancelled) console.error('Word cloud render failed:', e)
    })
    return () => { cancelled = true }
  }, [project.maskBitmap, project.names, project.style, project.seed, width])

  return <canvas ref={canvasRef} className="wordcloud-canvas" />
}
