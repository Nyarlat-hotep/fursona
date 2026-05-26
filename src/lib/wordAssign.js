import { makeRng, pick, weightedTier } from './rng'

const SIZE_TIERS = [
  { label: 'hero',   weight: 15, multiplier: 3.2 },
  { label: 'medium', weight: 35, multiplier: 1.6 },
  { label: 'small',  weight: 50, multiplier: 0.9 },
]

const ROT_TIERS = [
  { label: 0,  weight: 70 },
  { label: 90, weight: 25 },
  { label: 45, weight: 5 },
]

export function assignWords(names, seed, fonts, palette) {
  const rng = makeRng(seed)
  return names.map((text) => {
    const tierLabel = weightedTier(rng, SIZE_TIERS)
    const tier = SIZE_TIERS.find((t) => t.label === tierLabel)
    const font = pick(rng, fonts)
    return {
      text,
      fontFamily: font.family,
      fontWeight: font.weight,
      color: pick(rng, palette.colors),
      rotation: weightedTier(rng, ROT_TIERS),
      weight: tier.multiplier,
    }
  })
}
