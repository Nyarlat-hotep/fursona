import { useEffect, useState } from 'react'
import { X, GoogleLogo } from '@phosphor-icons/react'
import { useAuth } from '../state/useAuth'
import './SignInModal.css'

export default function SignInModal({ open, onClose, onSuccess }) {
  const { signUp, signInWithPassword, signInWithGoogle, resetPassword } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (open) {
      setError(null)
      setBusy(false)
      setResetSent(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'reset') {
        await resetPassword(email)
        setResetSent(true)
      } else {
        if (mode === 'signup') await signUp(email, password)
        else await signInWithPassword(email, password)
        onSuccess?.()
        onClose()
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
      // OAuth redirects away; success handled on return.
    } catch (err) {
      setError(err.message || 'Google sign-in failed.')
      setBusy(false)
    }
  }

  return (
    <div className="signin-backdrop" onClick={onClose}>
      <div className="signin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="signin-close" onClick={onClose} aria-label="Close">
          <X size={18} weight="bold" />
        </button>
        <h2>
          {mode === 'signin' ? 'Sign in'
            : mode === 'signup' ? 'Create account'
            : 'Reset password'}
        </h2>
        <p className="signin-sub">
          {mode === 'reset'
            ? 'Enter your email and we’ll send you a link to set a new password.'
            : "Save your pet's word cloud to your account."}
        </p>

        {resetSent ? (
          <>
            <p className="signin-sub" style={{ color: '#0f172a' }}>
              ✓ Sent. Check your inbox for the reset link.
            </p>
            <button
              type="button"
              className="signin-primary"
              onClick={() => { setMode('signin'); setResetSent(false) }}
            >
              Back to sign in
            </button>
          </>
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
            {mode !== 'reset' && (
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </label>
            )}
            {error && <p className="signin-error">{error}</p>}
            <button type="submit" className="signin-primary" disabled={busy}>
              {busy ? '…'
                : mode === 'signin' ? 'Sign in'
                : mode === 'signup' ? 'Sign up'
                : 'Send reset link'}
            </button>
            {mode === 'signin' && (
              <button
                type="button"
                className="signin-forgot"
                onClick={() => { setMode('reset'); setError(null) }}
              >
                Forgot password?
              </button>
            )}
          </form>
        )}

        {mode !== 'reset' && !resetSent && (
          <>
            <div className="signin-divider"><span>or</span></div>
            <button className="signin-google" onClick={google} disabled={busy} type="button">
              <GoogleLogo size={18} weight="bold" />
              <span>Continue with Google</span>
            </button>
          </>
        )}

        <p className="signin-toggle">
          {mode === 'signin' && (
            <>No account? <button type="button" onClick={() => setMode('signup')}>Sign up</button></>
          )}
          {mode === 'signup' && (
            <>Already have one? <button type="button" onClick={() => setMode('signin')}>Sign in</button></>
          )}
          {mode === 'reset' && !resetSent && (
            <>Remembered it? <button type="button" onClick={() => setMode('signin')}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  )
}
