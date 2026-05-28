import BackgroundRemovalWorker from './backgroundRemoval.worker.js?worker'

export function prefetchModel() {
  // No-op — kept for API compatibility. The worker fetches the model on first
  // use; browser HTTP cache covers subsequent runs.
  return Promise.resolve()
}

export function removeBackground(blob, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new BackgroundRemovalWorker()
    let settled = false
    function cleanup() {
      settled = true
      try { worker.terminate() } catch {} // eslint-disable-line no-empty
    }
    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') {
        onProgress?.(msg.key, msg.current, msg.total)
      } else if (msg.type === 'done') {
        if (!settled) { cleanup(); resolve(msg.result) }
      } else if (msg.type === 'error') {
        if (!settled) { cleanup(); reject(new Error(msg.message)) }
      }
    }
    worker.onerror = (err) => {
      if (!settled) { cleanup(); reject(err instanceof Error ? err : new Error(err.message || 'Worker error')) }
    }
    worker.postMessage({ blob })
  })
}
