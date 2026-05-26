import { describe, it, expect } from 'vitest'
import { assignWords } from './wordAssign'

const FONTS = [{ family: 'A', weight: 700 }, { family: 'B', weight: 400 }]
const PALETTE = { colors: ['#000', '#fff'] }

describe('assignWords', () => {
  it('produces one entry per name', () => {
    const out = assignWords(['x', 'y', 'z'], 1, FONTS, PALETTE)
    expect(out).toHaveLength(3)
  })

  it('is deterministic per seed', () => {
    const a = assignWords(['a', 'b', 'c'], 99, FONTS, PALETTE)
    const b = assignWords(['a', 'b', 'c'], 99, FONTS, PALETTE)
    expect(a).toEqual(b)
  })

  it('uses only configured fonts and palette colors', () => {
    const out = assignWords(['a', 'b', 'c', 'd', 'e', 'f'], 5, FONTS, PALETTE)
    for (const w of out) {
      expect(FONTS.map((f) => f.family)).toContain(w.fontFamily)
      expect(PALETTE.colors).toContain(w.color)
    }
  })

  it('rotation is one of 0, 90, 45', () => {
    const out = assignWords(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 5, FONTS, PALETTE)
    for (const w of out) expect([0, 45, 90]).toContain(w.rotation)
  })
})
