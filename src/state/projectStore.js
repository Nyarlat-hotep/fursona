export const initialProject = {
  step: 0,           // 0=Upload 1=Extract 2=Names 3=Style+Download
  photoBlob: null,
  photoUrl: null,
  maskBitmap: null,
  names: [],
  style: {
    backgroundType: 'color',
    backgroundValue: '#f7f5f0',
    paletteId: 'mono',
    customPaletteColors: ['#a8442a', '#d97742', '#e6c08a', '#5a3a2b'],
    alignH: 'center',  // 'left' | 'center' | 'right'
    alignV: 'middle',  // 'top'  | 'middle' | 'bottom'
  },
  seed: 1,
  lastExportedAt: null,
}

const MAX_STEP = 3

export function projectReducer(state, action) {
  switch (action.type) {
    case 'NEXT': return { ...state, step: Math.min(state.step + 1, MAX_STEP) }
    case 'BACK': return { ...state, step: Math.max(state.step - 1, 0) }
    case 'GOTO': return { ...state, step: Math.max(0, Math.min(action.step, MAX_STEP)) }
    case 'SET_PHOTO': return { ...state, photoBlob: action.blob, photoUrl: action.url }
    case 'SET_MASK': return { ...state, maskBitmap: action.bitmap }
    case 'ADD_NAME': {
      const text = String(action.text || '').trim()
      if (!text) return state
      return { ...state, names: [...state.names, { text, allowVertical: true }] }
    }
    case 'REMOVE_NAME': return { ...state, names: state.names.filter((_, i) => i !== action.index) }
    case 'TOGGLE_VERTICAL': return {
      ...state,
      names: state.names.map((n, i) => i === action.index ? { ...n, allowVertical: !n.allowVertical } : n),
    }
    case 'SET_STYLE': return { ...state, style: { ...state.style, ...action.patch } }
    case 'REGENERATE': return { ...state, seed: Math.floor(Math.random() * 2 ** 31) }
    case 'RESET': return { ...initialProject, seed: Math.floor(Math.random() * 2 ** 31) }
    default: return state
  }
}
