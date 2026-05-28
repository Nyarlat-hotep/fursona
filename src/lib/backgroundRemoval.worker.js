import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal'
import { binarize, boundingBox, cropMask } from './mask'

self.onmessage = async (e) => {
  const { blob } = e.data
  try {
    const cutoutBlob = await imglyRemoveBackground(blob, {
      model: 'isnet_fp16',
      device: 'gpu',
      output: { format: 'image/png', quality: 1 },
      progress: (key, current, total) => {
        self.postMessage({ type: 'progress', key, current, total })
      },
    })

    // Post-process here so the main thread never touches the full-resolution
    // ImageData. Returns a structured bitmap ready for the project store.
    const bmp = await createImageBitmap(cutoutBlob)
    const full = new OffscreenCanvas(bmp.width, bmp.height)
    const fctx = full.getContext('2d')
    fctx.drawImage(bmp, 0, 0)
    const imgData = fctx.getImageData(0, 0, bmp.width, bmp.height)
    const fullMask = binarize(imgData, 64)
    const bbox = boundingBox(fullMask, bmp.width, bmp.height)
    if (!bbox) {
      throw new Error('No silhouette detected. Try a clearer photo.')
    }
    const cropped = cropMask(fullMask, bmp.width, bbox)

    const preview = new OffscreenCanvas(bbox.w, bbox.h)
    preview.getContext('2d').drawImage(
      full, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h,
    )
    const previewBlob = await preview.convertToBlob({ type: 'image/png' })

    // Transfer the cropped mask buffer to avoid a copy.
    self.postMessage(
      {
        type: 'done',
        result: {
          mask: cropped,
          width: bbox.w,
          height: bbox.h,
          previewBlob,
          bbox,
          imageWidth: bmp.width,
          imageHeight: bmp.height,
        },
      },
      [cropped.buffer],
    )
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) })
  }
}
