import { useEffect, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { saveProject } from '../lib/savedProjects'
import './SignInModal.css'

function autoName(project) {
  const first = project.names?.[0]?.text
  if (first) return `${first}'s cloud`
  return 'Untitled cloud'
}

export default function SaveDialog({ open, project, user, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setName(autoName(project))
      setError(null)
      setBusy(false)
    }
  }, [open, project])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, busy])

  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const trimmed = name.trim() || autoName(project)
      const saved = await saveProject({
        user,
        name: trimmed,
        project,
        currentProjectId: project.currentProjectId,
      })
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const isUpdate = Boolean(project.currentProjectId)

  return (
    <div className="signin-backdrop" onClick={() => !busy && onClose()}>
      <div className="signin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="signin-close" onClick={onClose} aria-label="Close" disabled={busy}>
          <X size={18} weight="bold" />
        </button>
        <h2>{isUpdate ? 'Update save' : 'Save cloud'}</h2>
        <p className="signin-sub">
          {isUpdate
            ? 'Overwrites the saved version with the current cloud.'
            : 'Stores this cloud to your account so you can come back to it.'}
        </p>
        <form onSubmit={submit} className="signin-form">
          <label>
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </label>
          {error && <p className="signin-error">{error}</p>}
          <button type="submit" className="signin-primary" disabled={busy}>
            {busy ? 'Saving…' : isUpdate ? 'Update' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}
