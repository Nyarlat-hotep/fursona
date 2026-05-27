import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Trash, CaretDown } from '@phosphor-icons/react'
import { useSavedProjects } from '../state/useSavedProjects'
import { deleteProject, getPreviewUrl, SAVE_CAP } from '../lib/savedProjects'
import { hydrateSavedProject } from '../lib/openProject'
import ConfirmDialog from './ConfirmDialog'
import './SavesDropdown.css'

function relTime(iso) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString()
}

function SaveRow({ project, onOpen, onDelete }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let cancelled = false
    getPreviewUrl(project.preview_path).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => { cancelled = true }
  }, [project.preview_path])

  return (
    <li className="save-row">
      <button
        type="button"
        className="save-open"
        onClick={() => onOpen(project)}
        title={`Open ${project.name}`}
      >
        <div className="save-thumb">
          {url && <img src={url} alt="" />}
        </div>
        <div className="save-meta">
          <div className="save-name">{project.name}</div>
          <div className="save-date">{relTime(project.updated_at || project.created_at)}</div>
        </div>
      </button>
      <button
        type="button"
        className="save-delete"
        onClick={() => onDelete(project)}
        title="Delete save"
        aria-label="Delete save"
      >
        <Trash size={16} weight="bold" />
      </button>
    </li>
  )
}

export default function SavesDropdown({ user, onOpenProject, refreshKey }) {
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { projects, loading, refresh, count } = useSavedProjects(user)
  const ref = useRef(null)

  useEffect(() => { refresh() }, [refreshKey, refresh])

  useEffect(() => {
    if (!open) return
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleOpen(row) {
    setOpening(true)
    setOpen(false)
    try {
      await onOpenProject(row)
    } catch (e) {
      console.error(e)
      alert(`Could not open: ${e.message || e}`)
    } finally {
      setOpening(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteProject(pendingDelete)
      await refresh()
      setPendingDelete(null)
    } catch (e) {
      alert(`Could not delete: ${e.message || e}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={`saves-dropdown ${open ? 'is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className="saves-trigger"
        onClick={() => setOpen((o) => !o)}
        disabled={opening}
      >
        <FolderOpen size={16} weight="bold" />
        <span>{opening ? 'Opening…' : `Saves (${count}/${SAVE_CAP})`}</span>
        <CaretDown size={12} weight="bold" className="saves-caret" />
      </button>
      {open && (
        <div className="saves-panel">
          {loading && <p className="saves-empty">Loading…</p>}
          {!loading && projects.length === 0 && (
            <p className="saves-empty">No saves yet — hit Save on a cloud to start.</p>
          )}
          {!loading && projects.length > 0 && (
            <ul className="saves-list">
              {projects.map((p) => (
                <SaveRow key={p.id} project={p} onOpen={handleOpen} onDelete={setPendingDelete} />
              ))}
            </ul>
          )}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this cloud?"
        message={pendingDelete && `"${pendingDelete.name}" will be permanently removed from your saves.`}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </div>
  )
}

export function useOpenSavedProject(dispatch) {
  return async function open(row) {
    const patch = await hydrateSavedProject(row)
    dispatch({ type: 'LOAD_PROJECT', patch })
  }
}
