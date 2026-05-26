import { useEffect, useReducer } from 'react'
import { initialProject, projectReducer } from './state/projectStore'
import { loadDraft, saveDraft } from './storage'
import './App.css'

const STEPS = ['Upload', 'Extract', 'Nicknames', 'Style', 'Download']

function UserMenu() { return null }

export default function App() {
  const [project, dispatch] = useReducer(projectReducer, initialProject, (init) => {
    const draft = loadDraft()
    return draft ? { ...init, ...draft } : init
  })

  useEffect(() => { saveDraft(project) }, [project])

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">fursona</h1>
        <UserMenu />
      </header>
      <main className="app-main">
        <div className="step-card">
          <p className="step-label">Step {project.step + 1} of {STEPS.length} — {STEPS[project.step]}</p>
          <div className="step-body">[{STEPS[project.step]} goes here]</div>
          <div className="step-nav">
            <button onClick={() => dispatch({ type: 'BACK' })} disabled={project.step === 0}>Back</button>
            <button onClick={() => dispatch({ type: 'NEXT' })} disabled={project.step === STEPS.length - 1}>Next</button>
          </div>
        </div>
      </main>
    </div>
  )
}
