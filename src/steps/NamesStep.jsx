import { useEffect, useRef, useState } from 'react'
import { X, ArrowLeft } from '@phosphor-icons/react'
import './NamesStep.css'

// TODO(testing): remove auto-fill before production
const TEST_NAMES = [
  'Biscuit', 'Mr. Whiskers', 'Pumpkin', 'Bear', 'Noodle',
  'Peanut', 'Pickle', 'Bandit', 'Mochi', 'Luna',
  'Ziggy', 'Toast', 'Marble', 'Pepper', 'Cinnamon',
  'Olive', 'Mango', 'Cooper', 'Daisy', 'Finn',
  'Hazel', 'Milo', 'Ruby', 'Tilly', 'Waffles',
]

export default function NamesStep({ project, dispatch }) {
  const [draft, setDraft] = useState('')
  const autoFilledRef = useRef(false)

  useEffect(() => {
    if (autoFilledRef.current) return
    if (project.names.length === 0) {
      autoFilledRef.current = true
      for (const text of TEST_NAMES) dispatch({ type: 'ADD_NAME', text })
    }
  }, [project.names.length, dispatch])

  function add() {
    const text = draft.trim()
    if (!text) return
    dispatch({ type: 'ADD_NAME', text })
    setDraft('')
  }

  return (
    <div className="names-step">
      <p className="hint">Type a nickname and press Enter. Add as many as you like — more names = a denser cloud.</p>
      <input
        type="text"
        placeholder="e.g. Mr. Whiskers"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
        }}
        autoFocus
      />
      <ul className="chips">
        {project.names.map((n, i) => (
          <li key={i} className="chip">
            <span>{n.text}</span>
            <button aria-label={`Remove ${n.text}`} onClick={() => dispatch({ type: 'REMOVE_NAME', index: i })}>
              <X size={12} weight="bold" />
            </button>
          </li>
        ))}
      </ul>
      <div className="step-footer">
        <button
          className="back"
          onClick={() =>
            project.photoBlob
              ? dispatch({ type: 'BACK' })
              : dispatch({ type: 'GOTO', step: 0 })
          }
        >
          <ArrowLeft size={16} weight="bold" />
          <span>Back</span>
        </button>
        <button
          className="primary"
          onClick={() => dispatch({ type: 'NEXT' })}
          disabled={project.names.length < 3}
        >
          Continue ({project.names.length} {project.names.length === 1 ? 'name' : 'names'})
        </button>
      </div>
    </div>
  )
}
