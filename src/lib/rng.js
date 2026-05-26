import seedrandom from 'seedrandom'

export function makeRng(seed) {
  return seedrandom(String(seed))
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

export function weightedTier(rng, tiers) {
  const total = tiers.reduce((s, t) => s + t.weight, 0)
  let r = rng() * total
  for (const t of tiers) {
    r -= t.weight
    if (r <= 0) return t.label
  }
  return tiers[tiers.length - 1].label
}
