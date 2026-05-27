import { assignWords } from './wordAssign'
import { makeRng } from './rng'
import { FONTS } from '../styles/fonts'

/**
 * Render a pet-shaped word cloud onto the given canvas.
 *
 * Custom packer (replaces wordcloud2.js which was silently dropping or
 * uniformly shrinking words). Sorts words largest first, then for each word
 * randomly samples candidate positions inside the silhouette and accepts the
 * first one where the word's bounding box (a) fits inside the silhouette and
 * (b) doesn't overlap an already-placed word.
 */
export async function renderWordCloudToCanvas({
  canvas, mask, maskWidth, maskHeight, names, seed, style, palette,
}) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')

  await ensureFontsLoaded()

  // Fit silhouette into canvas with optional padding, preserving aspect.
  // When canvas aspect matches silhouette aspect, the silhouette fills the
  // canvas (minus padding). When they differ, the silhouette is centered
  // and the leftover space shows the background only.
  const padding = 0.04
  const availW = w * (1 - padding * 2)
  const availH = h * (1 - padding * 2)
  const scaleFit = Math.min(availW / maskWidth, availH / maskHeight)
  const silW = maskWidth * scaleFit
  const silH = maskHeight * scaleFit
  const silX = Math.round((w - silW) / 2)
  const silY = Math.round((h - silH) / 2)

  // Build canvas-sized mask: 1 inside the fit-and-centered silhouette, else 0.
  const scaledMask = new Uint8Array(w * h)
  for (let y = silY; y < silY + silH; y++) {
    if (y < 0 || y >= h) continue
    for (let x = silX; x < silX + silW; x++) {
      if (x < 0 || x >= w) continue
      const ox = Math.min(maskWidth - 1, Math.floor((x - silX) / scaleFit))
      const oy = Math.min(maskHeight - 1, Math.floor((y - silY) / scaleFit))
      scaledMask[y * w + x] = mask[oy * maskWidth + ox]
    }
  }

  // Word occurrences with assigned styles + size tier multipliers
  const occurrences = assignWords(names, seed, FONTS, palette, { fillPasses: 14 })
  // Convert weight multipliers into actual font sizes (canvas px)
  const baseFontUnit = w / 26
  const words = occurrences.map((a) => ({
    ...a,
    fontSize: a.weight * baseFontUnit,
  }))

  // Compute placements (no drawing yet; uses ctx only for text measurement)
  const placements = packWords(words, scaledMask, w, h, ctx, seed)

  // Compose final canvas: background → silhouette tint → words
  ctx.clearRect(0, 0, w, h)

  // 1. Background
  if (style.backgroundType === 'pattern' && style.backgroundValue) {
    const pat = await loadPattern(style.backgroundValue)
    if (pat) ctx.fillStyle = ctx.createPattern(pat, 'repeat')
    else ctx.fillStyle = '#f7f5f0'
  } else {
    ctx.fillStyle = style.backgroundValue || '#f7f5f0'
  }
  ctx.fillRect(0, 0, w, h)

  // 2. Faint silhouette tint (so pet shape reads even when packing is sparse)
  ctx.save()
  ctx.fillStyle = withAlpha(palette.colors[0] || '#1a1a1a', 0.04)
  for (let y = 0; y < h; y++) {
    let runStart = -1
    for (let x = 0; x < w; x++) {
      const m = scaledMask[y * w + x]
      if (m && runStart === -1) runStart = x
      else if (!m && runStart !== -1) {
        ctx.fillRect(runStart, y, x - runStart, 1)
        runStart = -1
      }
    }
    if (runStart !== -1) ctx.fillRect(runStart, y, w - runStart, 1)
  }
  ctx.restore()

  // 3. Words at their actual computed sizes
  for (const p of placements) {
    ctx.save()
    ctx.font = `${p.fontWeight} ${p.fontSize}px "${p.fontFamily}", sans-serif`
    ctx.fillStyle = p.color
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.translate(p.cx, p.cy)
    if (p.rotation) ctx.rotate((p.rotation * Math.PI) / 180)
    ctx.fillText(p.text, 0, 0)
    ctx.restore()
  }
}

function packWords(words, mask, maskW, maskH, ctx, seed) {
  const rng = makeRng(seed + 7)
  // Largest first so big anchors place before small ones crowd in
  const sorted = [...words].sort((a, b) => b.fontSize - a.fontSize)

  // Measure each word's natural dimensions
  for (const word of sorted) {
    ctx.font = `${word.fontWeight} ${word.fontSize}px "${word.fontFamily}", sans-serif`
    const m = ctx.measureText(word.text)
    word.mw = m.width
    word.mh = word.fontSize * 1.05
  }

  const placed = []
  const result = []

  for (const word of sorted) {
    const isRotated = word.rotation === 90
    const boxW = isRotated ? word.mh : word.mw
    const boxH = isRotated ? word.mw : word.mh

    let foundCx = null
    let foundCy = null
    const halfW = boxW / 2
    const halfH = boxH / 2
    const padding = 1

    const maxAttempts = 800
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const cx = halfW + rng() * (maskW - boxW)
      const cy = halfH + rng() * (maskH - boxH)
      const x0 = cx - halfW
      const y0 = cy - halfH
      const x1 = cx + halfW
      const y1 = cy + halfH

      if (x0 < padding || y0 < padding || x1 > maskW - padding || y1 > maskH - padding) continue

      // Sample bounding box for silhouette containment.
      // 5x5 grid + center + 4 midpoints = 25 points covering the box.
      let inMask = true
      const N = 5
      for (let i = 0; i < N && inMask; i++) {
        for (let j = 0; j < N && inMask; j++) {
          const sx = Math.floor(x0 + (i / (N - 1)) * boxW)
          const sy = Math.floor(y0 + (j / (N - 1)) * boxH)
          if (sx < 0 || sx >= maskW || sy < 0 || sy >= maskH || !mask[sy * maskW + sx]) {
            inMask = false
          }
        }
      }
      if (!inMask) continue

      // Reject if overlapping a placed word
      let overlaps = false
      for (const p of placed) {
        if (!(x1 + padding <= p.x0 || x0 >= p.x1 + padding || y1 + padding <= p.y0 || y0 >= p.y1 + padding)) {
          overlaps = true
          break
        }
      }
      if (overlaps) continue

      foundCx = cx
      foundCy = cy
      placed.push({ x0, y0, x1, y1 })
      break
    }

    if (foundCx !== null) {
      result.push({ ...word, cx: foundCx, cy: foundCy })
    }
  }

  return result
}

let _fontsLoadedPromise = null
async function ensureFontsLoaded() {
  if (_fontsLoadedPromise) return _fontsLoadedPromise
  if (!document.fonts || !document.fonts.load) return
  _fontsLoadedPromise = Promise.all(
    FONTS.map((f) => document.fonts.load(`${f.weight} 32px "${f.family}"`).catch(() => null)),
  )
  return _fontsLoadedPromise
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

function withAlpha(color, alpha) {
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
