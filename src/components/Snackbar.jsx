import { useEffect } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import './Snackbar.css'

export default function Snackbar({ message, onDismiss, duration = 2500 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => onDismiss?.(), duration)
    return () => clearTimeout(t)
  }, [message, duration, onDismiss])

  if (!message) return null

  return (
    <div className="snackbar" role="status" aria-live="polite">
      <CheckCircle size={18} weight="fill" />
      <span>{message}</span>
    </div>
  )
}
