import { renderWordCloudToCanvas } from './renderWordCloud'
import { resolvePalette } from '../styles/palettes'

const SIZES = {
  '5x7':   { wIn: 5,  hIn: 7  },
  '8x10':  { wIn: 8,  hIn: 10 },
  '11x14': { wIn: 11, hIn: 14 },
  '16x20': { wIn: 16, hIn: 20 },
}
const DPI = 300

export async function exportPng(project, sizeKey) {
  if (!project.maskBitmap) throw new Error('No silhouette to render.')
  const size = SIZES[sizeKey]
  if (!size) throw new Error(`Unknown size: ${sizeKey}`)

  const silAspect = project.maskBitmap.width / project.maskBitmap.height
  const portrait = silAspect <= 1
  const w = Math.round((portrait ? size.wIn : size.hIn) * DPI)
  const h = Math.round((portrait ? size.hIn : size.wIn) * DPI)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  await renderWordCloudToCanvas({
    canvas,
    mask: project.maskBitmap.mask,
    maskWidth: project.maskBitmap.width,
    maskHeight: project.maskBitmap.height,
    silhouetteImageUrl: project.maskBitmap.previewUrl,
    silhouetteSvg: project.maskBitmap.svgMarkup,
    silhouetteBbox: project.maskBitmap.bbox,
    silhouetteSourceWidth: project.maskBitmap.imageWidth,
    silhouetteSourceHeight: project.maskBitmap.imageHeight,
    names: project.names.map((n) => n.text),
    seed: project.seed,
    style: project.style,
    palette: resolvePalette(project.style),
  })

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode PNG.'))
    }, 'image/png')
  })
}

export function listExportSizes() {
  return Object.keys(SIZES)
}
