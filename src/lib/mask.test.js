import { describe, it, expect } from 'vitest'
import { binarize, boundingBox, cropMask } from './mask'

function makeImageData(width, height, fill) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = data[i + 1] = data[i + 2] = 0
      data[i + 3] = fill(x, y)
    }
  }
  return { data, width, height }
}

describe('binarize', () => {
  it('treats alpha > threshold as silhouette', () => {
    const img = makeImageData(2, 2, (x) => (x === 0 ? 0 : 255))
    const mask = binarize(img, 128)
    expect(Array.from(mask)).toEqual([0, 1, 0, 1])
  })
})

describe('boundingBox', () => {
  it('finds tight bbox of silhouette pixels', () => {
    const img = makeImageData(4, 4, (x, y) => (x === 1 && y === 2) ? 255 : 0)
    const mask = binarize(img, 128)
    expect(boundingBox(mask, 4, 4)).toEqual({ x: 1, y: 2, w: 1, h: 1 })
  })

  it('returns null when no silhouette', () => {
    const img = makeImageData(2, 2, () => 0)
    const mask = binarize(img, 128)
    expect(boundingBox(mask, 2, 2)).toBeNull()
  })
})

describe('cropMask', () => {
  it('extracts the bbox region from a full mask', () => {
    const img = makeImageData(4, 4, (x, y) => (x >= 1 && x <= 2 && y === 1) ? 255 : 0)
    const mask = binarize(img, 128)
    const bbox = boundingBox(mask, 4, 4)
    const cropped = cropMask(mask, 4, bbox)
    expect(Array.from(cropped)).toEqual([1, 1])
    expect(bbox).toEqual({ x: 1, y: 1, w: 2, h: 1 })
  })
})
