import { useEffect, useReducer, useRef, useState } from 'react'
import { ArrowCounterClockwise, List, X } from '@phosphor-icons/react'
import { initialProject, projectReducer } from './state/projectStore'
import { loadDraft, saveDraft } from './storage'
import { useAuth } from './state/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { hydrateSavedProject } from './lib/openProject'
import UploadStep from './steps/UploadStep'
import ExtractStep from './steps/ExtractStep'
import NamesStep from './steps/NamesStep'
import StyleStep from './steps/StyleStep'
import UserMenu from './components/UserMenu'
import SavesDropdown from './components/SavesDropdown'
import SplashScreen from './components/SplashScreen'
import './App.css'

const STEPS = ['Pick', 'Extract', 'Nicknames', 'Style & Download']

function HeaderActions({ project, dispatch, user, onOpenProject, refreshKey }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const showStartOver =
    project.step > 0 ||
    project.photoUrl ||
    project.shapeId ||
    project.currentProjectId

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div className="header-actions">
      <div className="header-collapsible" ref={menuRef}>
        <button
          type="button"
          className="header-menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
        </button>
        <div className={`header-actions-list${menuOpen ? ' is-open' : ''}`}>
          {showStartOver && (
            <button
              className="start-over"
              onClick={() => { setMenuOpen(false); dispatch({ type: 'RESET' }) }}
              type="button"
            >
              <ArrowCounterClockwise size={16} weight="bold" />
              <span>Start over</span>
            </button>
          )}
          {user && isSupabaseConfigured && (
            <SavesDropdown user={user} onOpenProject={onOpenProject} refreshKey={refreshKey} />
          )}
        </div>
      </div>
      <UserMenu />
    </div>
  )
}

export default function App() {
  const [project, dispatch] = useReducer(projectReducer, initialProject, (init) => {
    // When auth-gated, always start fresh on step 1 — cloud saves are the
    // persistence layer, not localStorage. Anonymous mode still uses drafts.
    if (isSupabaseConfigured) return init
    const draft = loadDraft()
    return draft ? { ...init, ...draft } : init
  })
  const [openingStatus, setOpeningStatus] = useState(null)
  const [savesRefreshKey, setSavesRefreshKey] = useState(0)

  useEffect(() => {
    if (!isSupabaseConfigured) saveDraft(project)
  }, [project])

  const { user, loading: authLoading } = useAuth()

  async function handleOpenProject(row) {
    setOpeningStatus('Loading…')
    try {
      const patch = await hydrateSavedProject(row, (msg) => setOpeningStatus(msg))
      dispatch({ type: 'LOAD_PROJECT', patch })
    } finally {
      setOpeningStatus(null)
    }
  }

  // Bump savesRefreshKey whenever a save happens so the dropdown re-fetches.
  useEffect(() => {
    if (project.currentProjectId) setSavesRefreshKey((k) => k + 1)
  }, [project.currentProjectId])

  if (isSupabaseConfigured && !authLoading && !user) {
    return <SplashScreen />
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">fursona</h1>
        <HeaderActions
          project={project}
          dispatch={dispatch}
          user={user}
          onOpenProject={handleOpenProject}
          refreshKey={savesRefreshKey}
        />
      </header>
      <main className="app-main">
        <div className="step-card">
          <p className="step-label">Step {project.step + 1} of {STEPS.length} — {STEPS[project.step]}</p>
          <div className="step-body">
            {project.step === 0 && <UploadStep project={project} dispatch={dispatch} />}
            {project.step === 1 && <ExtractStep project={project} dispatch={dispatch} />}
            {project.step === 2 && <NamesStep project={project} dispatch={dispatch} />}
            {project.step === 3 && <StyleStep project={project} dispatch={dispatch} />}
          </div>
        </div>
      </main>
      {openingStatus && (
        <div className="opening-overlay">
          <div className="opening-card">
            <div className="paw-loader"><span /><span /><span /><span /></div>
            <p>{openingStatus}</p>
          </div>
        </div>
      )}
    </div>
  )
}
