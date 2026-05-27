import { useCallback, useEffect, useState } from 'react'
import { listProjects } from '../lib/savedProjects'

export function useSavedProjects(user) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setProjects([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await listProjects(user.id)
      setProjects(rows)
    } catch (e) {
      setError(e.message || 'Could not load saves.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return { projects, loading, error, refresh, count: projects.length }
}
