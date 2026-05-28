import BackgroundRemovalWorker from './backgroundRemoval.worker.js?worker'

export function prefetchModel() {
  // No-op — kept for API compatibility. The worker fetches the model on first
  // use; browser HTTP cache covers subsequent runs.
  return Promise.resolve()
}

/**
 * Runs background removal in a worker. Returns a cancellable handle:
 *   const { promise, cancel } = removeBackground(blob, onProgress)
 *   ...later: cancel()  // terminates the worker if still running
 *
 * Calling `cancel()` after completion is a no-op. The returned promise
 * rejects with an Error tagged `aborted: true` so callers can distinguish
 * a deliberate cancellation from a real failure.
 */
export function removeBackground(blob, onProgress) {
  const worker = new BackgroundRemovalWorker()
  let settled = false
  let rejectFn = null

  function cleanup() {
    settled = true
    try { worker.terminate() } catch {} // eslint-disable-line no-empty
  }

  const promise = new Promise((resolve, reject) => {
    rejectFn = reject
    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') {
        if (!settled) onProgress?.(msg.key, msg.current, msg.total)
      } else if (msg.type === 'done') {
        if (!settled) { cleanup(); resolve(msg.result) }
      } else if (msg.type === 'error') {
        if (!settled) { cleanup(); reject(new Error(msg.message)) }
      }
    }
    worker.onerror = (err) => {
      if (!settled) {
        cleanup()
        reject(err instanceof Error ? err : new Error(err.message || 'Worker error'))
      }
    }
    worker.postMessage({ blob })
  })

  function cancel() {
    if (settled) return
    const err = new Error('Background removal cancelled.')
    err.aborted = true
    cleanup()
    rejectFn?.(err)
  }

  // Attach cancel to the promise itself for backward-compatible `await` callers,
  // and also expose the structured handle.
  promise.cancel = cancel
  return promise
}
