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

  // Fit silhouette into canvas preserving aspect, with a small safe margin.
  // Word packing always runs against a *centered* silhouette so alignment
  // just translates the result instead of re-rolling the layout.
  const padding = 0.04
  const padX = w * padding
  const padY = h * padding
  const availW = w - padX * 2
  const availH = h - padY * 2
  const scaleFit = Math.min(availW / maskWidth, availH / maskHeight)
  const silW = maskWidth * scaleFit
  const silH = maskHeight * scaleFit

  const centeredSilX = Math.round((w - silW) / 2)
  const centeredSilY = Math.round((h - silH) / 2)

  const alignH = style.alignH || 'center'
  const alignV = style.alignV || 'middle'
  let targetSilX, targetSilY
  if (alignH === 'left') targetSilX = Math.round(padX)
  else if (alignH === 'right') targetSilX = Math.round(w - silW - padX)
  else targetSilX = centeredSilX
  if (alignV === 'top') targetSilY = Math.round(padY)
  else if (alignV === 'bottom') targetSilY = Math.round(h - silH - padY)
  else targetSilY = centeredSilY
  const offsetX = targetSilX - centeredSilX
  const offsetY = targetSilY - centeredSilY

  // Centered scaled mask — drives both packing and tint rendering.
  const scaledMask = new Uint8Array(w * h)
  for (let y = centeredSilY; y < centeredSilY + silH; y++) {
    if (y < 0 || y >= h) continue
    for (let x = centeredSilX; x < centeredSilX + silW; x++) {
      if (x < 0 || x >= w) continue
      const ox = Math.min(maskWidth - 1, Math.floor((x - centeredSilX) / scaleFit))
      const oy = Math.min(maskHeight - 1, Math.floor((y - centeredSilY) / scaleFit))
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
    const pat = await loadPattern(style.backgroundValue, palette.colors)
    if (pat) {
      const cssScale = (w / 580) * (style.patternScale || 1) * pat.baseScale
      const pattern = ctx.createPattern(pat.source, 'repeat')
      if (pattern.setTransform) {
        pattern.setTransform(new DOMMatrix().scale(cssScale, cssScale))
      }
      ctx.fillStyle = pattern
    } else {
      ctx.fillStyle = '#f7f5f0'
    }
    ctx.fillRect(0, 0, w, h)
    // Apply pattern opacity by overlaying cream — since the pattern's own
    // background is cream, this fades only the marks without re-rasterizing.
    const opacity = Math.max(0, Math.min(1, style.patternOpacity ?? 1))
    if (opacity < 1) {
      ctx.save()
      ctx.globalAlpha = 1 - opacity
      ctx.fillStyle = '#f7f5f0'
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
    }
  } else {
    ctx.fillStyle = style.backgroundValue || '#f7f5f0'
    ctx.fillRect(0, 0, w, h)
  }

  // 2 & 3. Apply alignment translation, then render tint + words on top.
  ctx.save()
  ctx.translate(offsetX, offsetY)

  if ((style.silhouetteMode || 'tint') === 'tint') {
    const usingPattern = style.backgroundType === 'pattern' && style.backgroundValue
    const fillColor = usingPattern
      ? '#f7f5f0' // opaque cream so the pattern doesn't show through behind words
      : withAlpha(palette.colors[0] || '#1a1a1a', 0.04)
    paintSilhouetteFill(ctx, scaledMask, w, h, fillColor)
  }

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

  ctx.restore()
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

      // Sample bounding box for silhouette containment. Sample density
      // scales with box size (~one sample every 5px) so wide words can't
      // straddle gaps in multi-region shapes (e.g. between paw pads).
      const Nx = Math.max(5, Math.ceil(boxW / 5))
      const Ny = Math.max(5, Math.ceil(boxH / 5))
      let inMask = true
      for (let i = 0; i <= Nx && inMask; i++) {
        for (let j = 0; j <= Ny && inMask; j++) {
          const sx = Math.floor(x0 + (i / Nx) * boxW)
          const sy = Math.floor(y0 + (j / Ny) * boxH)
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
async function loadPattern(src, paletteColors) {
  const primary = withHexAlpha(paletteColors?.[0] || '#d0c8b8', 0.4)
  const secondary = withHexAlpha(paletteColors?.[1] || paletteColors?.[0] || '#e8e3d8', 0.22)
  const cacheKey = `${src}|${primary}|${secondary}`
  if (_patternCache.has(cacheKey)) return _patternCache.get(cacheKey)

  const HI_RES = 512
  const text = await fetch(src).then((r) => r.text()).catch(() => null)
  let entry = null

  if (text) {
    // Tint pattern marks (cream bg stays untouched).
    const tinted = text
      .replaceAll(/#d0c8b8/gi, primary)
      .replaceAll(/#e8e3d8/gi, secondary)
    const doc = new DOMParser().parseFromString(tinted, 'image/svg+xml')
    const svg = doc.documentElement
    const naturalSize = parseInt(
      svg.getAttribute('width') ||
        (svg.getAttribute('viewBox') || '').split(/\s+/)[2] ||
        '64',
      10,
    ) || 64
    svg.setAttribute('width', String(HI_RES))
    svg.setAttribute('height', String(HI_RES))
    const xml = new XMLSerializer().serializeToString(svg)
    const img = await loadImage(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
    )
    if (img) {
      const sourceSize = Math.max(img.naturalWidth || HI_RES, 1)
      entry = { source: img, baseScale: naturalSize / sourceSize }
    }
  }

  if (!entry) {
    // Fallback: load original SVG as-is (no tint, no upscale).
    const native = await loadImage(src)
    if (!native) return null
    entry = { source: native, baseScale: 1 }
  }

  _patternCache.set(cacheKey, entry)
  return entry
}

function withHexAlpha(color, alphaFraction) {
  if (!color || !color.startsWith('#')) return color
  const expanded = color.length === 4
    ? '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
    : color.slice(0, 7)
  const a = Math.round(Math.max(0, Math.min(1, alphaFraction)) * 255)
    .toString(16)
    .padStart(2, '0')
  return expanded + a
}

function loadImage(src) {
  return new Promise((resolve) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = () => resolve(null)
    i.src = src
  })
}

function paintSilhouetteFill(ctx, scaledMask, w, h, color) {
  // Render the binary silhouette to an offscreen canvas, then drawImage it
  // back through a small blur filter to anti-alias the staircase edge.
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const octx = off.getContext('2d')
  octx.fillStyle = color
  for (let y = 0; y < h; y++) {
    let runStart = -1
    for (let x = 0; x < w; x++) {
      const m = scaledMask[y * w + x]
      if (m && runStart === -1) runStart = x
      else if (!m && runStart !== -1) {
        octx.fillRect(runStart, y, x - runStart, 1)
        runStart = -1
      }
    }
    if (runStart !== -1) octx.fillRect(runStart, y, w - runStart, 1)
  }

  ctx.save()
  // Scale blur with canvas size so high-res exports get proportional smoothing.
  const blurPx = Math.max(0.6, w / 800)
  ctx.filter = `blur(${blurPx}px)`
  ctx.drawImage(off, 0, 0)
  ctx.restore()
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
