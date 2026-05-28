import { useDeferredValue, useEffect, useRef } from 'react'
import { renderWordCloudToCanvas } from '../lib/renderWordCloud'
import { resolvePalette } from '../styles/palettes'
import './WordCloudCanvas.css'

export default function WordCloudCanvas({ project, width }) {
  const canvasRef = useRef(null)
  // Deferring style/seed lets React coalesce rapid slider drags so the
  // expensive word packer doesn't run on every input event.
  const deferredStyle = useDeferredValue(project.style)
  const deferredSeed = useDeferredValue(project.seed)
  const deferredNames = useDeferredValue(project.names)

  useEffect(() => {
    if (!project.maskBitmap || deferredNames.length === 0) return
    const { mask, width: mw, height: mh } = project.maskBitmap
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    // Canvas aspect follows the silhouette bbox so tall/narrow shapes (e.g. a
    // standing cat) don't leave large empty bands on the sides. Clamp to a
    // sensible range so extreme aspects don't make the canvas absurdly tall.
    const rawAspect = mh > 0 ? mw / mh : 1
    const aspect = Math.max(0.6, Math.min(1.6, rawAspect))
    const cssW = width
    const cssH = Math.round(width / aspect)
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
      names: deferredNames.map((n) => n.text),
      seed: deferredSeed,
      style: deferredStyle,
      palette: resolvePalette(deferredStyle),
    }).then(() => {
      if (cancelled) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(off, 0, 0)
    }).catch((e) => {
      if (!cancelled) console.error('Word cloud render failed:', e)
    })
    return () => { cancelled = true }
  }, [project.maskBitmap, deferredNames, deferredStyle, deferredSeed, width])

  return <canvas ref={canvasRef} className="wordcloud-canvas" />
}
