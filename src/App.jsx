import { useEffect, useReducer } from 'react'
import { initialProject, projectReducer } from './state/projectStore'
import { loadDraft, saveDraft } from './storage'
import UploadStep from './steps/UploadStep'
import ExtractStep from './steps/ExtractStep'
import NamesStep from './steps/NamesStep'
import StyleStep from './steps/StyleStep'
import DownloadStep from './steps/DownloadStep'
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
          <div className="step-body">
            {project.step === 0 && <UploadStep project={project} dispatch={dispatch} />}
            {project.step === 1 && <ExtractStep project={project} dispatch={dispatch} />}
            {project.step === 2 && <NamesStep project={project} dispatch={dispatch} />}
            {project.step === 3 && <StyleStep project={project} dispatch={dispatch} />}
            {project.step === 4 && <DownloadStep project={project} dispatch={dispatch} />}
          </div>
        </div>
      </main>
    </div>
  )
}
