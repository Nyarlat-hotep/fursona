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
  let w = Math.round((portrait ? size.wIn : size.hIn) * DPI)
  let h = Math.round((portrait ? size.hIn : size.wIn) * DPI)

  // Memory guard: canvases this large can crash low-memory devices (especially
  // mobile). Each pixel = 4 bytes, so a 4800×6000 canvas = ~115 MB. Scale the
  // canvas down (preserving aspect) when device memory is limited or when the
  // canvas exceeds an absolute safety ceiling. The downloaded PNG will be
  // smaller than the print spec but still usable.
  const deviceMemoryGB = navigator.deviceMemory ?? 8
  const maxPixels = deviceMemoryGB < 4
    ? 18_000_000  // ~4242 × 4242 — caps an 11×14 at 300 DPI on low-mem devices
    : 60_000_000  // ~7745 × 7745 — well under a 16×20 ceiling on desktop
  if (w * h > maxPixels) {
    const scale = Math.sqrt(maxPixels / (w * h))
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  // Some browsers silently fail to allocate huge canvases — detect early.
  if (canvas.width !== w || canvas.height !== h) {
    throw new Error(`Image is too large for this device. Try a smaller print size.`)
  }

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
    names: project.names.map((n) => ({ text: n.text, favorite: !!n.favorite })),
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
