export const PALETTES = [
  { id: 'mono',   label: 'Mono',   colors: ['#111', '#333', '#555'] },
  { id: 'warm',   label: 'Warm',   colors: ['#a8442a', '#d97742', '#e6c08a', '#5a3a2b'] },
  { id: 'cool',   label: 'Cool',   colors: ['#1f3a5f', '#3d7068', '#8eb89e', '#0b1a2a'] },
  { id: 'pastel', label: 'Pastel', colors: ['#d8a7b1', '#b6e2d3', '#f6d6ad', '#a0c4ff'] },
  { id: 'ink',    label: 'Ink',    colors: ['#1a1a1a'] },
]

export function paletteById(id) {
  return PALETTES.find((p) => p.id === id) || PALETTES[0]
}
