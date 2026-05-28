import { fetchPhotoBlob } from './savedProjects'
import { removeBackground } from './backgroundRemoval'
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
  const result = await removeBackground(blob, () => {})
  patch.maskBitmap = {
    mask: result.mask,
    width: result.width,
    height: result.height,
    previewUrl: URL.createObjectURL(result.previewBlob),
    bbox: result.bbox,
    imageWidth: result.imageWidth,
    imageHeight: result.imageHeight,
  }
  return patch
}
