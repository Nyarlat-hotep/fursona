import { describe, it, expect } from 'vitest'
import { makeRng, pick, weightedTier } from './rng'

describe('makeRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = makeRng(42)
    const b = makeRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('pick', () => {
  it('returns an element from the array', () => {
    const rng = makeRng(1)
    const arr = ['x', 'y', 'z']
    expect(arr).toContain(pick(rng, arr))
  })
})

describe('weightedTier', () => {
  it('returns one of the tier labels', () => {
    const rng = makeRng(7)
    const tiers = [{ label: 'a', weight: 1 }, { label: 'b', weight: 1 }]
    expect(['a', 'b']).toContain(weightedTier(rng, tiers))
  })

  it('respects weight ratios over many samples', () => {
    const rng = makeRng(123)
    const tiers = [{ label: 'big', weight: 1 }, { label: 'small', weight: 9 }]
    let big = 0
    for (let i = 0; i < 1000; i++) if (weightedTier(rng, tiers) === 'big') big++
    expect(big).toBeGreaterThan(50)
    expect(big).toBeLessThan(200)
  })
})
