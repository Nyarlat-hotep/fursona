import { useState } from 'react'
import { useAuth } from '../state/useAuth'
import './SignInModal.css'

export default function PasswordResetModal({ open, onDone }) {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
      onDone?.()
    } catch (err) {
      setError(err.message || 'Could not update password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="signin-backdrop">
      <div className="signin-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Set a new password</h2>
        <p className="signin-sub">
          You clicked the reset link in your email. Choose a new password to finish.
        </p>
        <form onSubmit={submit} className="signin-form">
          <label>
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error && <p className="signin-error">{error}</p>}
          <button type="submit" className="signin-primary" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
