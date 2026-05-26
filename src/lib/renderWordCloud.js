import WordCloud from 'wordcloud'
import { buildWordCloudMaskCanvas } from './mask'
import { assignWords } from './wordAssign'
import { FONTS } from '../styles/fonts'

/**
 * Render a word cloud into the given canvas. The pet silhouette mask is used
 * as an obstacle layer so wordcloud2 packs words only inside the silhouette.
 * After packing, we composite a background underneath plus an optional faint
 * silhouette tint so the pet shape is always visible.
 */
export async function renderWordCloudToCanvas({
  canvas, mask, maskWidth, maskHeight, names, seed, style, palette,
}) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')

  // Scale mask to render dims with nearest-neighbor (no edge smoothing), then
  // build the obstacle canvas at the final size. Smoothing during scale would
  // produce semi-transparent edges that wordcloud2 treats as obstacles.
  const scaledMaskInline = scaleMaskToCanvas(mask, maskWidth, maskHeight, w, h)
  const obstacle = buildWordCloudMaskCanvas(scaledMaskInline, w, h)
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(obstacle, 0, 0)

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready
  }

  // wordcloud2 dedupes list entries by text string, so each occurrence gets a
  // varying number of zero-width spaces (U+200B) appended — invisible but
  // textually distinct, so every occurrence is placed separately.
  const ZWSP = '​'
  const occurrences = assignWords(names, seed, FONTS, palette, { fillPasses: 6 })
  const styles = new Map()
  const list = occurrences.map((a, i) => {
    const uniqueText = a.text + ZWSP.repeat(i + 1)
    styles.set(uniqueText, a)
    return [uniqueText, a.weight]
  })
  // Largest first so big words anchor before fill words crowd in
  list.sort((a, b) => b[1] - a[1])

  await new Promise((resolve) => {
    WordCloud(canvas, {
      list,
      gridSize: Math.max(4, Math.round(8 * (w / 600))),
      weightFactor: (size) => size * (w / 24),
      fontFamily: (word) => styles.get(word)?.fontFamily || 'sans-serif',
      fontWeight: (word) => String(styles.get(word)?.fontWeight || 400),
      color: (word) => styles.get(word)?.color || '#000',
      rotateRatio: 0.3,
      rotationSteps: 2,
      minRotation: 0,
      maxRotation: Math.PI / 2,
      // Allow shrinking so xlarge words still place inside the silhouette
      // instead of being silently dropped.
      shrinkToFit: true,
      drawOutOfBound: false,
      clearCanvas: false,
      backgroundColor: 'transparent',
      hover: null,
      click: null,
    })
    requestAnimationFrame(resolve)
  })

  // Build output canvas with background + faint silhouette tint + words
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

  // 2. Faint silhouette tint underneath words — gives the pet shape
  // a visible "ghost" outline so it reads even when words are sparse.
  const silMask = scaledMaskInline
  const tintColor = palette.colors[0] || '#1a1a1a'
  octx.save()
  octx.fillStyle = withAlpha(tintColor, 0.08)
  for (let y = 0; y < h; y++) {
    let runStart = -1
    for (let x = 0; x < w; x++) {
      const m = silMask[y * w + x]
      if (m && runStart === -1) runStart = x
      else if (!m && runStart !== -1) {
        octx.fillRect(runStart, y, x - runStart, 1)
        runStart = -1
      }
    }
    if (runStart !== -1) octx.fillRect(runStart, y, w - runStart, 1)
  }
  octx.restore()

  // 3. Extract word pixels (drop obstacle-white and anything outside silhouette)
  const cloudImage = ctx.getImageData(0, 0, w, h)
  const cloudData = cloudImage.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const m = silMask[y * w + x]
      if (!m) {
        cloudData[i + 3] = 0
      } else if (cloudData[i] === 255 && cloudData[i + 1] === 255 && cloudData[i + 2] === 255 && cloudData[i + 3] === 255) {
        cloudData[i + 3] = 0
      }
    }
  }
  const cleanCloud = document.createElement('canvas')
  cleanCloud.width = w
  cleanCloud.height = h
  cleanCloud.getContext('2d').putImageData(cloudImage, 0, 0)
  octx.drawImage(cleanCloud, 0, 0)

  // Copy back to target
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

function withAlpha(color, alpha) {
  // Accept #rgb, #rrggbb, or rgb()/rgba() — return rgba(...)
  if (color.startsWith('#')) {
    let r, g, b
    if (color.length === 4) {
      r = parseInt(color[1] + color[1], 16)
      g = parseInt(color[2] + color[2], 16)
      b = parseInt(color[3] + color[3], 16)
    } else {
      r = parseInt(color.slice(1, 3), 16)
      g = parseInt(color.slice(3, 5), 16)
      b = parseInt(color.slice(5, 7), 16)
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}
