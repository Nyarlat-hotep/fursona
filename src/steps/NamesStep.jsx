import { useState } from 'react'
import './NamesStep.css'

export default function NamesStep({ project, dispatch }) {
  const [draft, setDraft] = useState('')

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
            <button aria-label={`Remove ${n.text}`} onClick={() => dispatch({ type: 'REMOVE_NAME', index: i })}>×</button>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button onClick={() => dispatch({ type: 'BACK' })}>Back</button>
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
