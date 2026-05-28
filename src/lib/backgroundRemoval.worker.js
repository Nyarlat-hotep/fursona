import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal'

self.onmessage = async (e) => {
  const { blob } = e.data
  try {
    const result = await imglyRemoveBackground(blob, {
      model: 'isnet_fp16',
      device: 'gpu',
      output: { format: 'image/png', quality: 1 },
      progress: (key, current, total) => {
        self.postMessage({ type: 'progress', key, current, total })
      },
    })
    self.postMessage({ type: 'done', result })
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) })
  }
}
