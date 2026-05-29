const KEY = 'petprint:autosave:v1'

export function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function saveDraft(project) {
  try {
    const { names, style, seed, step } = project
    localStorage.setItem(KEY, JSON.stringify({ names, style, seed, step }))
  } catch { /* quota — ignore */ }
}

export function clearDraft() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

// Phase 2 hooks — stubbed
export async function loadProjects() { return [] }
export async function saveProject(p) { return p }
// eslint-disable-next-line no-unused-vars
export async function deleteProject(_id) { return }
