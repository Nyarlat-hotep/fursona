import { describe, it, expect } from 'vitest'
import { initialProject, projectReducer } from './projectStore'

describe('projectReducer', () => {
  it('starts at step 0 with an empty project', () => {
    expect(initialProject.step).toBe(0)
    expect(initialProject.names).toEqual([])
  })

  it('advances and rewinds the step', () => {
    const s1 = projectReducer(initialProject, { type: 'NEXT' })
    expect(s1.step).toBe(1)
    const s2 = projectReducer(s1, { type: 'BACK' })
    expect(s2.step).toBe(0)
  })

  it('does not advance past step 4 or rewind below 0', () => {
    const at4 = { ...initialProject, step: 4 }
    expect(projectReducer(at4, { type: 'NEXT' }).step).toBe(4)
    expect(projectReducer(initialProject, { type: 'BACK' }).step).toBe(0)
  })

  it('adds and removes nicknames', () => {
    const s1 = projectReducer(initialProject, { type: 'ADD_NAME', text: 'Biscuit' })
    expect(s1.names).toEqual([{ text: 'Biscuit', allowVertical: true }])
    const s2 = projectReducer(s1, { type: 'REMOVE_NAME', index: 0 })
    expect(s2.names).toEqual([])
  })

  it('rolls a new seed on REGENERATE', () => {
    const s1 = projectReducer({ ...initialProject, seed: 1 }, { type: 'REGENERATE' })
    expect(s1.seed).not.toBe(1)
  })
})
