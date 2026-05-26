import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal'

const CONFIG = {
  model: 'isnet_fp16',
  output: { format: 'image/png', quality: 1 },
}

let _prefetched = null

export function prefetchModel() {
  if (_prefetched) return _prefetched
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  _prefetched = fetch(tinyPng)
    .then((r) => r.blob())
    .then((b) => imglyRemoveBackground(b, CONFIG))
    .catch(() => { _prefetched = null })
  return _prefetched
}

export async function removeBackground(blob, onProgress) {
  return await imglyRemoveBackground(blob, {
    ...CONFIG,
    progress: onProgress,
  })
}
