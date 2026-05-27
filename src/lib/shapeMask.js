import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { binarize, boundingBox, cropMask } from './mask'

const RASTER_SIZE = 600

/**
 * Rasterize a Phosphor icon component to a binary silhouette mask, in the
 * same shape used by the photo flow (see ExtractStep.jsx) so the downstream
 * preview / packer / export pipeline works unchanged.
 */
export async function shapeToMaskBitmap(Icon) {
  const svg = renderToStaticMarkup(
    createElement(Icon, { weight: 'fill', size: RASTER_SIZE, color: '#000' })
  )
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Could not load shape'))
    i.src = dataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = RASTER_SIZE
  canvas.height = RASTER_SIZE
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, RASTER_SIZE, RASTER_SIZE)

  const imgData = ctx.getImageData(0, 0, RASTER_SIZE, RASTER_SIZE)
  const fullMask = binarize(imgData, 64)
  const bbox = boundingBox(fullMask, RASTER_SIZE, RASTER_SIZE)
  if (!bbox) throw new Error('No shape detected')

  const cropped = cropMask(fullMask, RASTER_SIZE, bbox)

  const previewCanvas = document.createElement('canvas')
  previewCanvas.width = bbox.w
  previewCanvas.height = bbox.h
  previewCanvas.getContext('2d').drawImage(
    canvas, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h,
  )
  const previewUrl = previewCanvas.toDataURL('image/png')

  return {
    mask: cropped,
    width: bbox.w,
    height: bbox.h,
    previewUrl,
    bbox,
    imageWidth: RASTER_SIZE,
    imageHeight: RASTER_SIZE,
  }
}
