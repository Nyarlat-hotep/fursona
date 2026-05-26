import { makeRng, pick, weightedTier } from './rng'

const SIZE_TIERS = [
  { label: 'hero',   weight: 15, multiplier: 3.2 },
  { label: 'medium', weight: 35, multiplier: 1.6 },
  { label: 'small',  weight: 50, multiplier: 0.9 },
]

const FILL_TIERS = [
  { label: 'small', weight: 40, multiplier: 0.7 },
  { label: 'tiny',  weight: 60, multiplier: 0.45 },
]

const ROT_TIERS = [
  { label: 0,  weight: 70 },
  { label: 90, weight: 25 },
  { label: 45, weight: 5 },
]

export function assignWords(names, seed, fonts, palette, { fillPasses = 0 } = {}) {
  const rng = makeRng(seed)
  const assignOne = (text, tiers) => {
    const tierLabel = weightedTier(rng, tiers)
    const tier = tiers.find((t) => t.label === tierLabel)
    const font = pick(rng, fonts)
    return {
      text,
      fontFamily: font.family,
      fontWeight: font.weight,
      color: pick(rng, palette.colors),
      rotation: weightedTier(rng, ROT_TIERS),
      weight: tier.multiplier,
    }
  }

  const out = names.map((n) => assignOne(n, SIZE_TIERS))
  for (let p = 0; p < fillPasses; p++) {
    for (const n of names) out.push(assignOne(n, FILL_TIERS))
  }
  return out
}
