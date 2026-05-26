import WordCloud from 'wordcloud'
import { buildWordCloudMaskCanvas } from './mask'
import { assignWords } from './wordAssign'
import { FONTS } from '../styles/fonts'

/**
 * Render a word cloud into the given canvas. The pet silhouette mask is used
 * as an obstacle layer so wordcloud2 packs words only inside the silhouette.
 * After packing, we clip the result to the silhouette and paint the background
 * underneath.
 *
 * @param {object} args
 * @param {HTMLCanvasElement} args.canvas    Target canvas (sized by caller)
 * @param {Uint8Array}        args.mask      1=silhouette pixel, 0=background
 * @param {number}            args.maskWidth Width of the cropped mask
 * @param {number}            args.maskHeight Height of the cropped mask
 * @param {string[]}          args.names     Nicknames
 * @param {number}            args.seed      RNG seed
 * @param {object}            args.style     { backgroundType, backgroundValue }
 * @param {object}            args.palette   { colors: string[] }
 * @returns {Promise<void>}
 */
export async function renderWordCloudToCanvas({
  canvas, mask, maskWidth, maskHeight, names, seed, style, palette,
}) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')

  // Scale obstacle canvas to target size
  const obstacleSrc = buildWordCloudMaskCanvas(mask, maskWidth, maskHeight)
  const obstacle = document.createElement('canvas')
  obstacle.width = w
  obstacle.height = h
  obstacle.getContext('2d').drawImage(obstacleSrc, 0, 0, w, h)

  // Paint obstacle layer into target so wordcloud2 sees obstacles
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(obstacle, 0, 0)

  // Wait for fonts so canvas measureText is correct
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready
  }

  const assigned = assignWords(names, seed, FONTS, palette)
  const list = assigned.map((a) => [a.text, a.weight])
  const byText = new Map(assigned.map((a) => [a.text, a]))

  await new Promise((resolve) => {
    WordCloud(canvas, {
      list,
      gridSize: Math.max(4, Math.round(6 * (w / 600))),
      weightFactor: (size) => size * (w / 30),
      fontFamily: (word) => byText.get(word)?.fontFamily || 'sans-serif',
      fontWeight: (word) => String(byText.get(word)?.fontWeight || 400),
      color: (word) => byText.get(word)?.color || '#000',
      rotateRatio: 0.3,
      rotationSteps: 2,
      minRotation: 0,
      maxRotation: Math.PI / 2,
      shrinkToFit: true,
      drawOutOfBound: false,
      clearCanvas: false,
      backgroundColor: 'transparent',
      hover: null,
      click: null,
    })
    // wordcloud2 is synchronous when invoked this way
    requestAnimationFrame(resolve)
  })

  // Now `canvas` contains: opaque-white obstacle outside silhouette,
  // packed-word pixels inside, transparent where no words placed.
  // We want: background (solid color or pattern) outside silhouette boundary
  // PLUS inside the silhouette wherever words weren't placed.
  //
  // Strategy: build a composite to a working canvas:
  //   1. paint background full-bleed
  //   2. clip to silhouette
  //   3. inside silhouette, paint the word pixels (extracted from current canvas)
  //   4. copy result back

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const octx = out.getContext('2d')

  // 1. Background full-bleed
  if (style.backgroundType === 'pattern' && style.backgroundValue) {
    const pat = await loadPattern(style.backgroundValue)
    if (pat) {
      const fill = octx.createPattern(pat, 'repeat')
      octx.fillStyle = fill
    } else {
      octx.fillStyle = '#f7f5f0'
    }
  } else {
    octx.fillStyle = style.backgroundValue || '#f7f5f0'
  }
  octx.fillRect(0, 0, w, h)

  // 2. Extract just the word pixels from current canvas:
  //    Current canvas: opaque-white outside silhouette + colored words inside.
  //    Remove the white obstacle so we keep only the word strokes.
  const cloudImage = ctx.getImageData(0, 0, w, h)
  const cloudData = cloudImage.data
  // Build a silhouette mask scaled to target size
  const silMask = scaleMaskToCanvas(mask, maskWidth, maskHeight, w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const m = silMask[y * w + x]
      if (!m) {
        // Outside silhouette: make transparent (will show background)
        cloudData[i + 3] = 0
      } else {
        // Inside silhouette: if pixel is opaque-white obstacle (255,255,255,255), drop it
        if (cloudData[i] === 255 && cloudData[i + 1] === 255 && cloudData[i + 2] === 255 && cloudData[i + 3] === 255) {
          cloudData[i + 3] = 0
        }
      }
    }
  }
  // Put cleaned cloud onto out canvas on top of background
  const cleanCloud = document.createElement('canvas')
  cleanCloud.width = w
  cleanCloud.height = h
  cleanCloud.getContext('2d').putImageData(cloudImage, 0, 0)
  octx.drawImage(cleanCloud, 0, 0)

  // Copy back to original target canvas
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(out, 0, 0)
}

const _patternCache = new Map()
async function loadPattern(src) {
  if (_patternCache.has(src)) return _patternCache.get(src)
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = src
  }).catch(() => null)
  if (img) _patternCache.set(src, img)
  return img
}

function scaleMaskToCanvas(mask, mw, mh, tw, th) {
  // Nearest-neighbor scale of binary mask to target canvas dims
  const out = new Uint8Array(tw * th)
  for (let y = 0; y < th; y++) {
    const sy = Math.min(mh - 1, Math.floor((y * mh) / th))
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(mw - 1, Math.floor((x * mw) / tw))
      out[y * tw + x] = mask[sy * mw + sx]
    }
  }
  return out
}
