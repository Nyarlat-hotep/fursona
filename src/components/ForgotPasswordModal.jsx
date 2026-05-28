import { useEffect, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { useAuth } from '../state/useAuth'
import './SignInModal.css'

export default function ForgotPasswordModal({ open, initialEmail = '', onClose }) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail(initialEmail)
      setBusy(false)
      setError(null)
      setSent(false)
    }
  }, [open, initialEmail])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Could not send reset email.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="signin-backdrop" onClick={() => !busy && onClose()}>
      <div className="signin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="signin-close" onClick={onClose} aria-label="Close" disabled={busy}>
          <X size={18} weight="bold" />
        </button>
        <h2>Reset password</h2>
        <p className="signin-sub">
          {sent
            ? 'Done — check your inbox for a link to set a new password.'
            : 'Enter your email and we’ll send you a link to set a new password.'}
        </p>
        {sent ? (
          <button type="button" className="signin-primary" onClick={onClose}>
            Done
          </button>
        ) : (
          <form onSubmit={submit} className="signin-form">
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
              />
            </label>
            {error && <p className="signin-error">{error}</p>}
            <button type="submit" className="signin-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
