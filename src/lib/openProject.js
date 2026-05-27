import { fetchPhotoBlob } from './savedProjects'
import { removeBackground } from './backgroundRemoval'
import { binarize, boundingBox, cropMask } from './mask'
import { shapeToMaskBitmap } from './shapeMask'
import { SHAPES } from '../styles/shapes'

/**
 * Hydrate a saved project row into a state patch the reducer can consume
 * via `LOAD_PROJECT`. Heavy: downloads the photo + re-runs background
 * removal (or rasterizes the shape). Caller should show a loading state.
 */
export async function hydrateSavedProject(row, onProgress) {
  const patch = {
    currentProjectId: row.id,
    names: row.names || [],
    style: row.style || {},
    seed: row.seed,
    shapeId: row.shape_id || null,
    photoBlob: null,
    photoUrl: null,
    maskBitmap: null,
    step: 3,
  }

  if (row.shape_id) {
    const shape = SHAPES.find((s) => s.id === row.shape_id)
    if (!shape) throw new Error(`Unknown shape: ${row.shape_id}`)
    patch.maskBitmap = await shapeToMaskBitmap(shape.Icon)
    return patch
  }

  if (!row.photo_path) {
    throw new Error('Saved project has no photo and no shape.')
  }

  onProgress?.('Loading photo…')
  const blob = await fetchPhotoBlob(row.photo_path)
  patch.photoBlob = blob
  patch.photoUrl = URL.createObjectURL(blob)

  onProgress?.('Finding your pet…')
  const cutout = await removeBackground(blob, () => {})
  const bmp = await createImageBitmap(cutout)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const ctx = c.getContext('2d')
  ctx.drawImage(bmp, 0, 0)
  const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height)
  const fullMask = binarize(imgData, 64)
  const bbox = boundingBox(fullMask, bmp.width, bmp.height)
  if (!bbox) throw new Error('Could not re-extract silhouette from saved photo.')
  const cropped = cropMask(fullMask, bmp.width, bbox)

  const previewCanvas = document.createElement('canvas')
  previewCanvas.width = bbox.w
  previewCanvas.height = bbox.h
  previewCanvas.getContext('2d').drawImage(c, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h)
  patch.maskBitmap = {
    mask: cropped,
    width: bbox.w,
    height: bbox.h,
    previewUrl: previewCanvas.toDataURL('image/png'),
    bbox,
    imageWidth: bmp.width,
    imageHeight: bmp.height,
  }
  return patch
}
