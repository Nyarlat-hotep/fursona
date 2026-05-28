import { useEffect, useRef } from 'react'
import { renderWordCloudToCanvas } from '../lib/renderWordCloud'
import { resolvePalette } from '../styles/palettes'
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
    if (canvas.width !== renderW) canvas.width = renderW
    if (canvas.height !== renderH) canvas.height = renderH
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'

    // Render to an offscreen buffer first, then swap it in on completion —
    // keeps the previous frame painted while async work (pattern load, packer)
    // runs, so dragging style sliders doesn't flash a blank canvas.
    const off = document.createElement('canvas')
    off.width = renderW
    off.height = renderH

    let cancelled = false
    renderWordCloudToCanvas({
      canvas: off,
      mask,
      maskWidth: mw,
      maskHeight: mh,
      silhouetteImageUrl: project.maskBitmap.previewUrl,
      silhouetteSvg: project.maskBitmap.svgMarkup,
      silhouetteBbox: project.maskBitmap.bbox,
      silhouetteSourceWidth: project.maskBitmap.imageWidth,
      silhouetteSourceHeight: project.maskBitmap.imageHeight,
      names: project.names.map((n) => n.text),
      seed: project.seed,
      style: project.style,
      palette: resolvePalette(project.style),
    }).then(() => {
      if (cancelled) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(off, 0, 0)
    }).catch((e) => {
      if (!cancelled) console.error('Word cloud render failed:', e)
    })
    return () => { cancelled = true }
  }, [project.maskBitmap, project.names, project.style, project.seed, width])

  return <canvas ref={canvasRef} className="wordcloud-canvas" />
}
