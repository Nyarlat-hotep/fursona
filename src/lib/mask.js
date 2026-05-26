export function binarize(imageData, threshold = 128) {
  const { data, width, height } = imageData
  const mask = new Uint8Array(width * height)
  for (let i = 0, j = 3; i < mask.length; i++, j += 4) {
    mask[i] = data[j] > threshold ? 1 : 0
  }
  return mask
}

export function boundingBox(mask, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export function cropMask(mask, width, bbox) {
  const out = new Uint8Array(bbox.w * bbox.h)
  for (let y = 0; y < bbox.h; y++) {
    for (let x = 0; x < bbox.w; x++) {
      out[y * bbox.w + x] = mask[(y + bbox.y) * width + (x + bbox.x)]
    }
  }
  return out
}

/**
 * Build a canvas where pixels INSIDE the silhouette are transparent
 * (so wordcloud2 will pack words there) and pixels OUTSIDE are opaque
 * (so wordcloud2 treats them as obstacles).
 */
export function buildWordCloudMaskCanvas(mask, width, height) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(width, height)
  for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
    if (mask[i]) {
      img.data[j + 3] = 0
    } else {
      img.data[j + 0] = 255
      img.data[j + 1] = 255
      img.data[j + 2] = 255
      img.data[j + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}
