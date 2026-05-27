# Fursona Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build and ship a browser-only pet-nickname word-cloud generator at `https://Nyarlat-hotep.github.io/fursona/`.

**Architecture:** React + Vite SPA, single-page with a step-index reducer (no router). All processing client-side: `@imgly/background-removal` extracts a silhouette mask, `wordcloud2.js` packs random-sized words across a curated font set into that mask, canvas exports a 300-DPI PNG. Deploys via GitHub Actions to `gh-pages`.

**Tech Stack:** React 18, Vite 5, plain CSS, `@imgly/background-removal`, `wordcloud2`, `@fontsource/*` (curated fonts), `seedrandom`, vanilla canvas, `gh-pages` workflow.

**Source of truth for design decisions:** [2026-05-26-fursona-design.md](./2026-05-26-fursona-design.md). Do not re-debate decisions in there — implement them.

**Testing reality check:** Most of this is canvas + UI work that doesn't unit-test well. The plan calls for tests *only* on pure utility modules (seeded RNG, mask binarization, per-word assignment function, font/palette selectors). Everything else is verified by running the app and visual inspection in the smoke-test task.

**Working dir for every task:** `/Users/taylorcornelius/Desktop/fursona`. Use absolute paths or `cd` into that dir per command.

---

## Phase A — Scaffold and first deploy

### Task 1: Vite + React scaffold

**Files:**
- Create: scaffolded by Vite (everything under `/Users/taylorcornelius/Desktop/fursona/`)

**Step 1:** Scaffold without overwriting existing `docs/` and `.git/`.

```bash
cd /tmp && rm -rf fursona-scaffold && npm create vite@latest fursona-scaffold -- --template react
# Copy everything except node_modules into the real project dir
rsync -a --exclude node_modules /tmp/fursona-scaffold/ /Users/taylorcornelius/Desktop/fursona/
rm -rf /tmp/fursona-scaffold
```

**Step 2:** Install deps.

```bash
cd /Users/taylorcornelius/Desktop/fursona && npm install
```

**Step 3:** Verify dev server starts.

```bash
cd /Users/taylorcornelius/Desktop/fursona && npm run dev
```

Expected: Vite prints `Local: http://localhost:5173/`. Kill it (Ctrl-C) after confirming.

**Step 4:** Commit.

```bash
cd /Users/taylorcornelius/Desktop/fursona && git add -A && git commit -m "chore: vite + react scaffold"
```

---

### Task 2: Configure Vite base path for GH Pages

**Files:**
- Modify: `/Users/taylorcornelius/Desktop/fursona/vite.config.js`

**Step 1:** Add `base: '/fursona/'`.

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/fursona/',
  plugins: [react()],
})
```

**Step 2:** Verify build emits with the right base.

```bash
cd /Users/taylorcornelius/Desktop/fursona && npm run build
grep -o '/fursona/assets/[^"]*' dist/index.html | head -3
```

Expected: paths like `/fursona/assets/index-abc123.js`.

**Step 3:** Commit.

```bash
git add vite.config.js && git commit -m "chore: set vite base to /fursona/ for gh-pages"
```

---

### Task 3: Create GitHub repo

**Step 1:** Create the public repo and push.

```bash
cd /Users/taylorcornelius/Desktop/fursona
gh repo create fursona --public --source=. --remote=origin --description "Pet-nickname word-cloud silhouette generator"
git push -u origin main
```

Expected: repo lives at `https://github.com/Nyarlat-hotep/fursona`.

---

### Task 4: GitHub Actions deploy workflow

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/.github/workflows/deploy.yml`

**Step 1:** Copy the proven workflow shape from an existing project.

```bash
cat /Users/taylorcornelius/Desktop/dice-roller/.github/workflows/deploy.yml
```

Use that as the template — same actions, same secrets pattern. If for any reason that file is different from what's below, prefer the existing file's structure.

**Step 2:** Write the workflow.

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run build

      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

**Step 3:** Commit and push to trigger the first run.

```bash
git add .github/workflows/deploy.yml && git commit -m "ci: add gh-pages deploy workflow" && git push
```

**Step 4:** Watch the run.

```bash
gh run watch
```

Expected: green run. After it finishes, enable Pages in repo settings (source: `gh-pages` branch, `/ (root)`).

```bash
gh api repos/Nyarlat-hotep/fursona/pages -X POST -f source[branch]=gh-pages -f source[path]=/ 2>/dev/null || \
  echo "If the API call failed (Pages already enabled or perms), set source manually in GitHub UI."
```

**Step 5:** Verify the URL loads the default Vite app.

Open `https://Nyarlat-hotep.github.io/fursona/` in a browser. Confirm the React+Vite default page renders. If 404, wait 1-2 min and retry. **STOP and debug** if it doesn't come up — do not proceed until live.

---

## Phase B — App skeleton and state

### Task 5: Strip default template, set up app shell

**Files:**
- Modify: `/Users/taylorcornelius/Desktop/fursona/src/App.jsx`
- Modify: `/Users/taylorcornelius/Desktop/fursona/src/App.css`
- Modify: `/Users/taylorcornelius/Desktop/fursona/src/index.css`
- Delete: `/Users/taylorcornelius/Desktop/fursona/src/assets/react.svg`

**Step 1:** Replace `App.jsx` with a minimal shell rendering "Fursona — coming soon" and a placeholder `<UserMenu />` slot (phase 2 seam).

```jsx
import './App.css'

function UserMenu() { return null }

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">fursona</h1>
        <UserMenu />
      </header>
      <main className="app-main">
        <p>Coming soon.</p>
      </main>
    </div>
  )
}
```

**Step 2:** Replace `App.css` and `index.css` with bare resets + brand styling. Keep it small — UI styling lands per-component later.

```css
/* index.css */
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  color: #1a1a1a;
  background: #f7f5f0;
}
button { font: inherit; cursor: pointer; }
```

```css
/* App.css */
.app { display: flex; flex-direction: column; min-height: 100%; }
.app-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; border-bottom: 1px solid #e8e3d8;
}
.brand { margin: 0; font-size: 20px; letter-spacing: 0.02em; }
.app-main {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
```

**Step 3:** Delete unused asset.

```bash
rm /Users/taylorcornelius/Desktop/fursona/src/assets/react.svg
```

**Step 4:** Verify dev server still runs and shows the new shell.

```bash
cd /Users/taylorcornelius/Desktop/fursona && npm run dev
```

**Step 5:** Commit.

```bash
git add -A && git commit -m "feat: minimal app shell with UserMenu seam"
```

---

### Task 6: Step-index reducer (single Project store)

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/src/state/projectStore.js`
- Create: `/Users/taylorcornelius/Desktop/fursona/src/state/projectStore.test.js` (Vitest)

**Step 1:** Install Vitest (dev).

```bash
cd /Users/taylorcornelius/Desktop/fursona && npm install -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`.

**Step 2:** Write the reducer test first.

```js
// src/state/projectStore.test.js
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

  it('does not advance past step 3 or rewind below 0', () => {
    const at3 = { ...initialProject, step: 3 }
    expect(projectReducer(at3, { type: 'NEXT' }).step).toBe(3)
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
```

**Step 3:** Run test, see it fail.

```bash
cd /Users/taylorcornelius/Desktop/fursona && npm test
```

Expected: fail — module missing.

**Step 4:** Implement.

```js
// src/state/projectStore.js
export const initialProject = {
  step: 0,           // 0=Upload 1=Extract 2=Names 3=Style+Download
  photoBlob: null,
  photoUrl: null,
  maskBitmap: null,
  names: [],
  style: { backgroundType: 'color', backgroundValue: '#f7f5f0', paletteId: 'mono' },
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
```

**Step 5:** Run tests — green.

```bash
npm test
```

**Step 6:** Commit.

```bash
git add -A && git commit -m "feat: project reducer with step navigation, names, seed"
```

---

### Task 7: Wire reducer into App, render placeholder per step

**Files:**
- Modify: `/Users/taylorcornelius/Desktop/fursona/src/App.jsx`

**Step 1:** Use `useReducer`, render a different placeholder per step plus Back/Next buttons.

```jsx
import { useReducer } from 'react'
import { initialProject, projectReducer } from './state/projectStore'
import './App.css'

const STEPS = ['Upload', 'Extract', 'Nicknames', 'Style & Download']

function UserMenu() { return null }

export default function App() {
  const [project, dispatch] = useReducer(projectReducer, initialProject)
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">fursona</h1>
        <UserMenu />
      </header>
      <main className="app-main">
        <div className="step-card">
          <p className="step-label">Step {project.step + 1} of {STEPS.length} — {STEPS[project.step]}</p>
          <div className="step-body">[{STEPS[project.step]} goes here]</div>
          <div className="step-nav">
            <button onClick={() => dispatch({ type: 'BACK' })} disabled={project.step === 0}>Back</button>
            <button onClick={() => dispatch({ type: 'NEXT' })} disabled={project.step === STEPS.length - 1}>Next</button>
          </div>
        </div>
      </main>
    </div>
  )
}
```

**Step 2:** Add styles for `.step-card`, `.step-label`, `.step-body`, `.step-nav` in `App.css`.

**Step 3:** `npm run dev`, click through. Buttons should advance/rewind the step label.

**Step 4:** Commit.

```bash
git add -A && git commit -m "feat: wire project reducer and step navigation"
```

---

### Task 8: Storage seam (no-op + localStorage autosave-one)

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/src/storage.js`

**Step 1:** Write the storage module. Phase 1 implementation persists a single in-progress project's *names + style + seed* to `localStorage` (not blobs — too big). Photo + mask are session-only.

```js
const KEY = 'fursona:autosave:v1'

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
  try { localStorage.removeItem(KEY) } catch {}
}

// Phase 2 hooks — stubbed
export async function loadProjects() { return [] }
export async function saveProject(p) { return p }
export async function deleteProject(_id) { return }
```

**Step 2:** In `App.jsx`, on every dispatch, autosave; on mount, hydrate.

```jsx
import { useEffect, useReducer } from 'react'
import { initialProject, projectReducer } from './state/projectStore'
import { loadDraft, saveDraft } from './storage'

// ...inside App:
const [project, dispatch] = useReducer(projectReducer, initialProject, (init) => {
  const draft = loadDraft()
  return draft ? { ...init, ...draft } : init
})
useEffect(() => { saveDraft(project) }, [project])
```

**Step 3:** Verify: dev server → advance to step 3 → reload → still on step 3.

**Step 4:** Commit.

```bash
git add -A && git commit -m "feat: localStorage autosave for draft (names, style, seed, step)"
```

---

## Phase C — Upload step

### Task 9: UploadStep component

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/src/steps/UploadStep.jsx`
- Create: `/Users/taylorcornelius/Desktop/fursona/src/steps/UploadStep.css`
- Modify: `/Users/taylorcornelius/Desktop/fursona/src/App.jsx` (render the step component when `project.step === 0`)

**Step 1:** Build a drop-zone + file-input component. Validates type (`image/*`), dispatches `SET_PHOTO` with a blob URL.

```jsx
import { useRef, useState } from 'react'
import './UploadStep.css'

export default function UploadStep({ project, dispatch }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)

  function handleFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.')
      return
    }
    setError(null)
    const url = URL.createObjectURL(file)
    dispatch({ type: 'SET_PHOTO', blob: file, url })
  }

  return (
    <div className="upload-step">
      <div
        className={`drop-zone ${dragOver ? 'is-over' : ''} ${project.photoUrl ? 'has-photo' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        onClick={() => inputRef.current?.click()}
      >
        {project.photoUrl ? (
          <img src={project.photoUrl} alt="Uploaded pet" className="preview" />
        ) : (
          <div className="prompt">
            <p><strong>Drop a photo of your pet here</strong></p>
            <p className="muted">or click to choose a file</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0])}
          hidden
        />
      </div>
      {error && <p className="error">{error}</p>}
      {project.photoUrl && (
        <button className="primary" onClick={() => dispatch({ type: 'NEXT' })}>Continue</button>
      )}
    </div>
  )
}
```

**Step 2:** Write `UploadStep.css` with a dashed drop zone, hover state, preview sizing (max-height 400px, object-fit contain).

**Step 3:** In `App.jsx`, render `<UploadStep project={project} dispatch={dispatch} />` when `project.step === 0`.

**Step 4:** Manual test. Upload an image, confirm preview shows + Continue advances to step 1.

**Step 5:** Commit.

```bash
git add -A && git commit -m "feat: upload step with drag-drop and preview"
```

---

## Phase D — Background removal + Extract step

### Task 10: Install background-removal and the prefetch helper

**Files:**
- Modify: `/Users/taylorcornelius/Desktop/fursona/package.json` (deps)
- Create: `/Users/taylorcornelius/Desktop/fursona/src/lib/backgroundRemoval.js`

**Step 1:** Install.

```bash
cd /Users/taylorcornelius/Desktop/fursona && npm install @imgly/background-removal
```

**Step 2:** Write a thin wrapper. The library auto-downloads its model on first use; we expose `prefetchModel()` (fire-and-forget) and `removeBackground(blob)` (returns a `Blob` of PNG with transparency).

```js
// src/lib/backgroundRemoval.js
import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal'

let _prefetched = null

export function prefetchModel() {
  if (_prefetched) return _prefetched
  // Tiny 1x1 transparent PNG triggers model load without producing real output.
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  _prefetched = fetch(tinyPng)
    .then((r) => r.blob())
    .then((b) => imglyRemoveBackground(b))
    .catch(() => { _prefetched = null })
  return _prefetched
}

export async function removeBackground(blob) {
  return await imglyRemoveBackground(blob)
}
```

**Step 3:** Call `prefetchModel()` from `UploadStep` mount (inside `useEffect(() => { prefetchModel() }, [])`).

**Step 4:** Manual test: open devtools network tab, load upload step, observe the model assets streaming in the background.

**Step 5:** Commit.

```bash
git add -A && git commit -m "feat: integrate @imgly/background-removal with prefetch on upload step"
```

---

### Task 11: Mask binarization utility (tested)

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/src/lib/mask.js`
- Create: `/Users/taylorcornelius/Desktop/fursona/src/lib/mask.test.js`

Purpose: given the RGBA `ImageData` from background-removal output, produce (a) a binary mask `Uint8Array` (1 = silhouette, 0 = background), (b) the silhouette bounding box, (c) a "blocked-pixels" canvas for `wordcloud2.js` (opaque outside the silhouette, transparent inside).

**Step 1:** Test the pure functions first.

```js
// src/lib/mask.test.js
import { describe, it, expect } from 'vitest'
import { binarize, boundingBox } from './mask'

function makeImageData(width, height, fill) {
  // fill: (x,y) => alpha 0..255
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = data[i+1] = data[i+2] = 0
      data[i+3] = fill(x, y)
    }
  }
  return { data, width, height }
}

describe('binarize', () => {
  it('treats alpha > threshold as silhouette', () => {
    const img = makeImageData(2, 2, (x) => (x === 0 ? 0 : 255))
    const mask = binarize(img, 128)
    expect(Array.from(mask)).toEqual([0, 1, 0, 1])
  })
})

describe('boundingBox', () => {
  it('finds tight bbox of silhouette pixels', () => {
    const img = makeImageData(4, 4, (x, y) => (x === 1 && y === 2) ? 255 : 0)
    const mask = binarize(img, 128)
    expect(boundingBox(mask, 4, 4)).toEqual({ x: 1, y: 2, w: 1, h: 1 })
  })

  it('returns null when no silhouette', () => {
    const img = makeImageData(2, 2, () => 0)
    const mask = binarize(img, 128)
    expect(boundingBox(mask, 2, 2)).toBeNull()
  })
})
```

**Step 2:** Run — fail.

```bash
npm test
```

**Step 3:** Implement.

```js
// src/lib/mask.js
export function binarize(imageData, threshold = 128) {
  const { data, width, height } = imageData
  const mask = new Uint8Array(width * height)
  for (let i = 0, j = 3; i < mask.length; i++, j += 4) {
    mask[i] = data[j] > threshold ? 1 : 0
  }
  return mask
}

export function boundingBox(mask, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/**
 * Build a canvas where pixels INSIDE the silhouette are transparent
 * (so wordcloud2 will pack words there) and pixels OUTSIDE are opaque
 * (so wordcloud2 treats them as obstacles).
 */
export function buildWordCloudMaskCanvas(mask, width, height) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(width, height)
  for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
    if (mask[i]) {
      img.data[j+3] = 0          // inside → transparent → fillable
    } else {
      img.data[j+0] = 255         // outside → opaque white → obstacle
      img.data[j+1] = 255
      img.data[j+2] = 255
      img.data[j+3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}
```

**Step 4:** Tests pass.

```bash
npm test
```

**Step 5:** Commit.

```bash
git add -A && git commit -m "feat: mask binarization, bounding box, wordcloud mask canvas"
```

---

### Task 12: ExtractStep component

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/src/steps/ExtractStep.jsx`
- Create: `/Users/taylorcornelius/Desktop/fursona/src/steps/ExtractStep.css`
- Modify: `/Users/taylorcornelius/Desktop/fursona/src/App.jsx` to render it on step 1

**Step 1:** Component flow:
- On mount, if there's a `project.photoBlob` and no `project.maskBitmap`, run `removeBackground(blob)` → resulting blob is a PNG with transparency.
- Decode it into `ImageData`, binarize, crop to bounding box, store the **cropped** mask data (the binary array + cropped width/height) and a preview `ImageBitmap` of the cropped silhouette PNG.
- While running, show a spinner + "Finding your pet…".
- On success: side-by-side preview (original vs. silhouette on transparent checker bg).
- Buttons: "Looks good" → `NEXT`, "Try another photo" → `GOTO` step 0.

**Step 2:** Store mask data structured as `{ mask: Uint8Array, width, height, previewUrl }` via a new action `SET_MASK`. The reducer already accepts an action shape; update it to carry the whole object: `dispatch({ type: 'SET_MASK', bitmap: { mask, width, height, previewUrl } })`.

Implementation sketch:

```jsx
import { useEffect, useState } from 'react'
import { removeBackground } from '../lib/backgroundRemoval'
import { binarize, boundingBox } from '../lib/mask'
import './ExtractStep.css'

export default function ExtractStep({ project, dispatch }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'working' | 'done' | 'error'
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!project.photoBlob || project.maskBitmap) {
      setStatus(project.maskBitmap ? 'done' : 'idle')
      return
    }
    setStatus('working')
    ;(async () => {
      try {
        const cutoutBlob = await removeBackground(project.photoBlob)
        if (cancelled) return
        const bmp = await createImageBitmap(cutoutBlob)
        // Draw to canvas to get ImageData
        const c = document.createElement('canvas')
        c.width = bmp.width; c.height = bmp.height
        const ctx = c.getContext('2d')
        ctx.drawImage(bmp, 0, 0)
        const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height)
        const fullMask = binarize(imgData, 64)
        const bbox = boundingBox(fullMask, bmp.width, bmp.height)
        if (!bbox) throw new Error('No silhouette detected. Try a clearer photo.')

        // Crop mask + preview to bbox
        const cropped = new Uint8Array(bbox.w * bbox.h)
        for (let y = 0; y < bbox.h; y++) {
          for (let x = 0; x < bbox.w; x++) {
            cropped[y * bbox.w + x] = fullMask[(y + bbox.y) * bmp.width + (x + bbox.x)]
          }
        }
        const previewCanvas = document.createElement('canvas')
        previewCanvas.width = bbox.w; previewCanvas.height = bbox.h
        previewCanvas.getContext('2d').drawImage(c, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h)
        const previewUrl = previewCanvas.toDataURL('image/png')

        dispatch({ type: 'SET_MASK', bitmap: { mask: cropped, width: bbox.w, height: bbox.h, previewUrl } })
        setStatus('done')
      } catch (e) {
        if (!cancelled) { setStatus('error'); setError(e.message || 'Background removal failed.') }
      }
    })()
    return () => { cancelled = true }
  }, [project.photoBlob, project.maskBitmap, dispatch])

  return (
    <div className="extract-step">
      {status === 'working' && <p className="spinner">Finding your pet…</p>}
      {status === 'error' && <p className="error">{error}</p>}
      {status === 'done' && (
        <div className="compare">
          <img src={project.photoUrl} alt="Original" className="thumb" />
          <img src={project.maskBitmap.previewUrl} alt="Silhouette" className="thumb checker" />
        </div>
      )}
      <div className="actions">
        <button onClick={() => dispatch({ type: 'GOTO', step: 0 })}>Try another photo</button>
        <button className="primary" onClick={() => dispatch({ type: 'NEXT' })} disabled={status !== 'done'}>
          Looks good
        </button>
      </div>
    </div>
  )
}
```

**Step 3:** CSS: side-by-side flex, checker pattern background for transparent preview.

**Step 4:** Manual test: upload → step 1 → wait 2–10 s on first run, faster on subsequent → confirm silhouette renders.

**Step 5:** Commit.

```bash
git add -A && git commit -m "feat: extract step runs background removal and shows silhouette preview"
```

---

## Phase E — Nicknames step

### Task 13: NamesStep with chip input

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/src/steps/NamesStep.jsx`
- Create: `/Users/taylorcornelius/Desktop/fursona/src/steps/NamesStep.css`
- Modify: `/Users/taylorcornelius/Desktop/fursona/src/App.jsx` to render on step 2

**Step 1:** Component:
- Controlled `<input>`, on Enter (or comma) dispatch `ADD_NAME`.
- Render chips as buttons (✕ on click → `REMOVE_NAME`).
- Show "Next" disabled until at least, say, 3 names entered.

```jsx
import { useState } from 'react'
import './NamesStep.css'

export default function NamesStep({ project, dispatch }) {
  const [draft, setDraft] = useState('')

  function add() {
    const text = draft.trim()
    if (!text) return
    dispatch({ type: 'ADD_NAME', text })
    setDraft('')
  }

  return (
    <div className="names-step">
      <p className="hint">Type a nickname and press Enter. Add as many as you like — more names = a denser cloud.</p>
      <input
        type="text"
        placeholder="e.g. Mr. Whiskers"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
        }}
        autoFocus
      />
      <ul className="chips">
        {project.names.map((n, i) => (
          <li key={i} className="chip">
            <span>{n.text}</span>
            <button aria-label={`Remove ${n.text}`} onClick={() => dispatch({ type: 'REMOVE_NAME', index: i })}>×</button>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button onClick={() => dispatch({ type: 'BACK' })}>Back</button>
        <button className="primary" onClick={() => dispatch({ type: 'NEXT' })} disabled={project.names.length < 3}>
          Continue ({project.names.length} {project.names.length === 1 ? 'name' : 'names'})
        </button>
      </div>
    </div>
  )
}
```

**Step 2:** Style chips: pill shape, soft background, small ✕ button.

**Step 3:** Manual test.

**Step 4:** Commit.

```bash
git add -A && git commit -m "feat: names step with chip input"
```

---

## Phase F — Style step (fonts, palettes, seed, word cloud render)

### Task 14: Bundle curated fonts via @fontsource

**Files:**
- Modify: `/Users/taylorcornelius/Desktop/fursona/package.json`
- Create: `/Users/taylorcornelius/Desktop/fursona/src/styles/fonts.js`
- Create: `/Users/taylorcornelius/Desktop/fursona/src/styles/fonts.css`

**Step 1:** Pick 8 fonts that contrast well. Recommended starting set:

```bash
cd /Users/taylorcornelius/Desktop/fursona && npm install \
  @fontsource/abril-fatface \
  @fontsource/dancing-script \
  @fontsource/playfair-display \
  @fontsource/roboto-slab \
  @fontsource/nunito \
  @fontsource/dm-sans \
  @fontsource/space-mono \
  @fontsource/caveat
```

**Step 2:** Create `src/styles/fonts.css` that imports all weights you need (start with 400 + 700 each):

```css
@import '@fontsource/abril-fatface/400.css';
@import '@fontsource/dancing-script/700.css';
@import '@fontsource/playfair-display/400.css';
@import '@fontsource/playfair-display/700.css';
@import '@fontsource/roboto-slab/700.css';
@import '@fontsource/nunito/700.css';
@import '@fontsource/dm-sans/700.css';
@import '@fontsource/space-mono/700.css';
@import '@fontsource/caveat/700.css';
```

Import once in `src/main.jsx`:

```js
import './styles/fonts.css'
```

**Step 3:** Create the font registry consumed by the word-cloud renderer.

```js
// src/styles/fonts.js
export const FONTS = [
  { family: 'Abril Fatface', weight: 400 },
  { family: 'Dancing Script', weight: 700 },
  { family: 'Playfair Display', weight: 700 },
  { family: 'Roboto Slab', weight: 700 },
  { family: 'Nunito', weight: 700 },
  { family: 'DM Sans', weight: 700 },
  { family: 'Space Mono', weight: 700 },
  { family: 'Caveat', weight: 700 },
]
```

**Step 4:** Verify fonts load: `npm run dev`, devtools → Network → filter "font" → confirm woff2s load.

**Step 5:** Commit.

```bash
git add -A && git commit -m "feat: bundle 8 curated fonts via @fontsource"
```

---

### Task 15: Palettes module

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/src/styles/palettes.js`

**Step 1:** Define the 5 palettes called out in the design doc.

```js
// src/styles/palettes.js
export const PALETTES = [
  { id: 'mono',    label: 'Mono',     colors: ['#111', '#333', '#555'] },
  { id: 'warm',    label: 'Warm',     colors: ['#a8442a', '#d97742', '#e6c08a', '#5a3a2b'] },
  { id: 'cool',    label: 'Cool',     colors: ['#1f3a5f', '#3d7068', '#8eb89e', '#0b1a2a'] },
  { id: 'pastel',  label: 'Pastel',   colors: ['#d8a7b1', '#b6e2d3', '#f6d6ad', '#a0c4ff'] },
  { id: 'ink',     label: 'Ink',      colors: ['#1a1a1a'] },
]

export function paletteById(id) {
  return PALETTES.find((p) => p.id === id) || PALETTES[0]
}
```

**Step 2:** Commit.

```bash
git add -A && git commit -m "feat: define color palettes"
```

---

### Task 16: Seeded RNG (tested)

**Files:**
- Modify: `/Users/taylorcornelius/Desktop/fursona/package.json` (add `seedrandom`)
- Create: `/Users/taylorcornelius/Desktop/fursona/src/lib/rng.js`
- Create: `/Users/taylorcornelius/Desktop/fursona/src/lib/rng.test.js`

**Step 1:** Install.

```bash
npm install seedrandom
```

**Step 2:** Test.

```js
// src/lib/rng.test.js
import { describe, it, expect } from 'vitest'
import { makeRng, pick, weightedTier } from './rng'

describe('makeRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = makeRng(42); const b = makeRng(42)
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
    expect(big).toBeGreaterThan(50)   // ~100 expected
    expect(big).toBeLessThan(200)
  })
})
```

**Step 3:** Implement.

```js
// src/lib/rng.js
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
```

**Step 4:** Tests pass.

```bash
npm test
```

**Step 5:** Commit.

```bash
git add -A && git commit -m "feat: seeded rng with pick and weightedTier helpers"
```

---

### Task 17: Word assignment function (tested)

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/src/lib/wordAssign.js`
- Create: `/Users/taylorcornelius/Desktop/fursona/src/lib/wordAssign.test.js`

Purpose: given `(names, seed, fonts, palette)`, return `[{ text, fontFamily, fontWeight, color, rotation, weight }]` where `weight` is the size multiplier wordcloud2 uses.

**Step 1:** Test.

```js
// src/lib/wordAssign.test.js
import { describe, it, expect } from 'vitest'
import { assignWords } from './wordAssign'

const FONTS = [{ family: 'A', weight: 700 }, { family: 'B', weight: 400 }]
const PALETTE = { colors: ['#000', '#fff'] }

describe('assignWords', () => {
  it('produces one entry per name', () => {
    const out = assignWords(['x','y','z'], 1, FONTS, PALETTE)
    expect(out).toHaveLength(3)
  })

  it('is deterministic per seed', () => {
    const a = assignWords(['a','b','c'], 99, FONTS, PALETTE)
    const b = assignWords(['a','b','c'], 99, FONTS, PALETTE)
    expect(a).toEqual(b)
  })

  it('uses only configured fonts and palette colors', () => {
    const out = assignWords(['a','b','c','d','e','f'], 5, FONTS, PALETTE)
    for (const w of out) {
      expect(FONTS.map(f => f.family)).toContain(w.fontFamily)
      expect(PALETTE.colors).toContain(w.color)
    }
  })

  it('rotation is one of 0, 90, 45', () => {
    const out = assignWords(['a','b','c','d','e','f','g','h','i','j'], 5, FONTS, PALETTE)
    for (const w of out) expect([0, 45, 90]).toContain(w.rotation)
  })
})
```

**Step 2:** Implement.

```js
// src/lib/wordAssign.js
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
    const tier = SIZE_TIERS.find(t => t.label === weightedTier(rng, SIZE_TIERS))
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
```

**Step 3:** Tests pass.

```bash
npm test
```

**Step 4:** Commit.

```bash
git add -A && git commit -m "feat: deterministic word assignment per seed"
```

---

### Task 18: WordCloudCanvas component (renders mask + words via wordcloud2)

**Files:**
- Modify: `/Users/taylorcornelius/Desktop/fursona/package.json` (add `wordcloud`)
- Create: `/Users/taylorcornelius/Desktop/fursona/src/components/WordCloudCanvas.jsx`
- Create: `/Users/taylorcornelius/Desktop/fursona/src/components/WordCloudCanvas.css`

**Step 1:** Install.

```bash
npm install wordcloud
```

(Note: the npm package is named `wordcloud` and exposes `wordcloud2.js` functionality.)

**Step 2:** Build the renderer. Strategy:

- Compute a target canvas size that fits the mask aspect into a max box (preview ~600×750; export uses larger).
- Paint the background (color or pattern) first.
- Overlay the `buildWordCloudMaskCanvas` mask on top (so wordcloud2 sees obstacles outside the silhouette but the background underneath shows through where words land).
- Configure wordcloud2 with `list`, per-word fontFamily/color/rotation callbacks, `weightFactor`, `gridSize`, `drawOutOfBound: false`, `shrinkToFit: true`.

```jsx
// src/components/WordCloudCanvas.jsx
import { useEffect, useRef } from 'react'
import WordCloud from 'wordcloud'
import { buildWordCloudMaskCanvas } from '../lib/mask'
import { assignWords } from '../lib/wordAssign'
import { FONTS } from '../styles/fonts'
import { paletteById } from '../styles/palettes'
import './WordCloudCanvas.css'

export default function WordCloudCanvas({ project, width, onRendered }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!project.maskBitmap || project.names.length === 0) return
    const { mask, width: mw, height: mh } = project.maskBitmap
    const scale = width / mw
    const w = Math.round(mw * scale)
    const h = Math.round(mh * scale)

    const canvas = canvasRef.current
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')

    // 1. Background fill
    const { style } = project
    if (style.backgroundType === 'color') {
      ctx.fillStyle = style.backgroundValue
      ctx.fillRect(0, 0, w, h)
    } else if (style.backgroundType === 'pattern') {
      // pattern path stored in style.backgroundValue
      const img = new Image()
      img.onload = () => {
        const pat = ctx.createPattern(img, 'repeat')
        ctx.fillStyle = pat
        ctx.fillRect(0, 0, w, h)
        renderMaskAndWords()
      }
      img.src = style.backgroundValue
      return
    }
    renderMaskAndWords()

    function renderMaskAndWords() {
      // 2. Paint mask as obstacle layer (wordcloud2 treats already-colored pixels as obstacles)
      const obstacleCanvas = buildWordCloudMaskCanvas(mask, mw, mh)
      // Scale obstacle layer
      const scaled = document.createElement('canvas')
      scaled.width = w; scaled.height = h
      scaled.getContext('2d').drawImage(obstacleCanvas, 0, 0, w, h)
      // Composite obstacles onto the working canvas. wordcloud2 reads the pixel
      // values to detect obstacles, then draws words into the empty regions.
      ctx.drawImage(scaled, 0, 0)

      // 3. Build word list
      const palette = paletteById(style.paletteId)
      const assigned = assignWords(project.names.map(n => n.text), project.seed, FONTS, palette)
      const list = assigned.map(a => [a.text, a.weight])
      const byText = new Map(assigned.map(a => [a.text, a]))

      // 4. Wait for fonts to be ready, then run wordcloud2
      document.fonts.ready.then(() => {
        WordCloud(canvas, {
          list,
          gridSize: Math.max(4, Math.round(8 * (w / 600))),
          weightFactor: (size) => size * (w / 30),
          fontFamily: (word) => byText.get(word)?.fontFamily || 'sans-serif',
          fontWeight: (word) => String(byText.get(word)?.fontWeight || 400),
          color: (word) => byText.get(word)?.color || '#000',
          rotateRatio: 0.3,
          rotationSteps: 2,
          minRotation: 0,
          maxRotation: Math.PI / 2,
          shrinkToFit: true,
          drawOutOfBound: false,
          clearCanvas: false,
          backgroundColor: 'transparent',
        })
        if (onRendered) requestAnimationFrame(onRendered)
      })
    }
  }, [project.maskBitmap, project.names, project.style, project.seed, width, onRendered])

  return <canvas ref={canvasRef} className="wordcloud-canvas" />
}
```

> **Caveat for the implementer:** wordcloud2's exact API for marking obstacles via pre-painted pixels can be finicky. If words land outside the silhouette or won't pack at all, **first try** these knobs in order: (a) increase `gridSize`, (b) use a stronger `weightFactor`, (c) verify the obstacle canvas has fully opaque pixels outside the silhouette. If still broken, switch to wordcloud2's `shape: 'cardioid'` plus the [shape mask alternative](https://github.com/timdream/wordcloud2.js#shape) — supply a custom function that returns the silhouette outline. Document whatever lands in a code comment.

**Step 3:** No automated test for this — it's canvas + a third-party lib. Manual verify in the next task.

**Step 4:** Commit.

```bash
git add -A && git commit -m "feat: word cloud canvas component using wordcloud2 with mask"
```

---

### Task 19: StyleStep (sidebar + live preview)

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/src/steps/StyleStep.jsx`
- Create: `/Users/taylorcornelius/Desktop/fursona/src/steps/StyleStep.css`
- Modify: `/Users/taylorcornelius/Desktop/fursona/src/App.jsx` to render on step 3

**Step 1:** Layout: left sidebar (~280px) with controls, right side a 600px-wide preview using `<WordCloudCanvas>`. Controls:

- **Background type radio:** Color / Pattern
- **Color picker** (`<input type="color">`) when Color selected
- **Pattern grid** (10 PNG thumbnails) when Pattern selected — each tile click sets `style.backgroundValue` to the pattern URL
- **Palette radio group** showing color swatches per palette
- **Regenerate** button (dispatches `REGENERATE`)

(Download controls — print-size dropdown, Fit/Crop toggle, **Download PNG** button — are added to this same sidebar in Task 22, after the export pipeline lands.)

```jsx
import { PALETTES } from '../styles/palettes'
import WordCloudCanvas from '../components/WordCloudCanvas'
import './StyleStep.css'

const PATTERNS = [
  '/fursona/patterns/paws.svg',
  '/fursona/patterns/dots.svg',
  '/fursona/patterns/gingham.svg',
  // …add all 10 once Task 20 lands; use import.meta.env.BASE_URL prefix to be safe
]

export default function StyleStep({ project, dispatch }) {
  const setStyle = (patch) => dispatch({ type: 'SET_STYLE', patch })
  return (
    <div className="style-step">
      <aside className="controls">
        <fieldset>
          <legend>Background</legend>
          <label><input type="radio" checked={project.style.backgroundType === 'color'} onChange={() => setStyle({ backgroundType: 'color', backgroundValue: '#f7f5f0' })} /> Color</label>
          <label><input type="radio" checked={project.style.backgroundType === 'pattern'} onChange={() => setStyle({ backgroundType: 'pattern', backgroundValue: PATTERNS[0] })} /> Pattern</label>
          {project.style.backgroundType === 'color' && (
            <input type="color" value={project.style.backgroundValue} onChange={(e) => setStyle({ backgroundValue: e.target.value })} />
          )}
          {project.style.backgroundType === 'pattern' && (
            <div className="pattern-grid">
              {PATTERNS.map(p => (
                <button key={p} className={`pattern-tile ${project.style.backgroundValue === p ? 'selected' : ''}`} onClick={() => setStyle({ backgroundValue: p })}>
                  <img src={p} alt="" />
                </button>
              ))}
            </div>
          )}
        </fieldset>
        <fieldset>
          <legend>Palette</legend>
          {PALETTES.map(p => (
            <label key={p.id} className="palette-row">
              <input type="radio" checked={project.style.paletteId === p.id} onChange={() => setStyle({ paletteId: p.id })} />
              <span>{p.label}</span>
              <span className="swatches">{p.colors.map(c => <i key={c} style={{ background: c }} />)}</span>
            </label>
          ))}
        </fieldset>
        <button onClick={() => dispatch({ type: 'REGENERATE' })}>Regenerate</button>
      </aside>
      <section className="preview">
        <WordCloudCanvas project={project} width={600} />
      </section>
    </div>
  )
}
```

**Step 2:** CSS for two-column layout, swatches, pattern tiles.

**Step 3:** Manual test — flip patterns, palettes, colors, regenerate. Confirm canvas re-renders.

**Step 4:** Commit.

```bash
git add -A && git commit -m "feat: style step with controls and live word-cloud preview"
```

---

### Task 20: Bundle 10 SVG patterns

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/public/patterns/*.svg` (10 files)

**Step 1:** Write or source 10 simple repeating SVG patterns. Each ~64×64 with `viewBox` so they tile cleanly. Suggested names: `paws.svg dots.svg gingham.svg stars.svg stripes.svg chevron.svg diamonds.svg lines.svg confetti.svg hearts.svg`. Keep colors neutral / single-color so they don't fight the word palette — e.g., `#e8e3d8` on transparent.

**Step 2:** Update `PATTERNS` array in `StyleStep.jsx` to reference all 10. Use `${import.meta.env.BASE_URL}patterns/paws.svg` so paths work both in dev (`/`) and on GH Pages (`/fursona/`).

**Step 3:** Manual test patterns render in the grid and tile correctly in the preview.

**Step 4:** Commit.

```bash
git add -A && git commit -m "feat: bundle 10 svg patterns for backgrounds"
```

---

## Phase G — Export & Download step

### Task 21: High-res export pipeline

**Files:**
- Create: `/Users/taylorcornelius/Desktop/fursona/src/lib/export.js`

**Step 1:** Refactor `WordCloudCanvas`'s render logic into a reusable async function `renderWordCloudToCanvas({ canvas, mask, width, height, names, seed, style, palette, fit })`. Then `export.js` exposes:

```js
// src/lib/export.js
import { renderWordCloudToCanvas } from './renderWordCloud' // extract from WordCloudCanvas
import { paletteById } from '../styles/palettes'

const SIZES = {
  '5x7':   { wIn: 5,  hIn: 7  },
  '8x10':  { wIn: 8,  hIn: 10 },
  '11x14': { wIn: 11, hIn: 14 },
  '16x20': { wIn: 16, hIn: 20 },
}

export async function exportPng(project, sizeKey, fit = 'fit') {
  const { wIn, hIn } = SIZES[sizeKey]
  const dpi = 300
  // Auto-rotate to match silhouette orientation
  const bbox = project.maskBitmap
  const silAspect = bbox.width / bbox.height
  const portrait = silAspect <= 1
  const w = Math.round((portrait ? wIn : hIn) * dpi)
  const h = Math.round((portrait ? hIn : wIn) * dpi)

  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const palette = paletteById(project.style.paletteId)

  await renderWordCloudToCanvas({
    canvas,
    mask: bbox.mask, maskWidth: bbox.width, maskHeight: bbox.height,
    names: project.names.map(n => n.text),
    seed: project.seed,
    style: project.style,
    palette,
    fit,
  })

  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
  return blob
}
```

**Step 2:** Refactor: move the canvas rendering core out of `WordCloudCanvas.jsx` into `src/lib/renderWordCloud.js`. Both the preview component and `export.js` import from it. Apply DRY ruthlessly.

**Step 3:** Smoke test in console: from the StyleStep page in dev, run `await import('./lib/export.js').then(m => m.exportPng(project, '5x7'))` (or wire a temporary debug button).

**Step 4:** Commit.

```bash
git add -A && git commit -m "feat: high-res png export pipeline"
```

---

### Task 22: Wire download controls into StyleStep

**Files:**
- Modify: `/Users/taylorcornelius/Desktop/fursona/src/steps/StyleStep.jsx`
- Modify: `/Users/taylorcornelius/Desktop/fursona/src/steps/StyleStep.css`

**Step 1:** Add download controls into the StyleStep sidebar (below the existing Background / Palette / Regenerate controls):
- Size dropdown (5×7, 8×10, 11×14, 16×20)
- Fit/Crop toggle
- Big "Download PNG" button (spinner state while rendering, inline error on failure)
- "Start over" link (`RESET` action)

```jsx
import { useState } from 'react'
import { PALETTES } from '../styles/palettes'
import WordCloudCanvas from '../components/WordCloudCanvas'
import { exportPng } from '../lib/export'
import './StyleStep.css'

const PATTERNS = [/* …as in Task 19 */]
const SIZES = ['5x7', '8x10', '11x14', '16x20']

export default function StyleStep({ project, dispatch }) {
  const setStyle = (patch) => dispatch({ type: 'SET_STYLE', patch })
  const [size, setSize] = useState('8x10')
  const [fit, setFit] = useState('fit')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function download() {
    setBusy(true); setError(null)
    try {
      const blob = await exportPng(project, size, fit)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pet-cloud-${size}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(`Could not render at ${size}. Try a smaller size.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="style-step">
      <aside className="controls">
        {/* …existing Background + Palette + Regenerate fieldsets… */}
        <fieldset>
          <legend>Download</legend>
          <label>Print size
            <select value={size} onChange={e => setSize(e.target.value)}>
              {SIZES.map(s => <option key={s} value={s}>{s} in @ 300 DPI</option>)}
            </select>
          </label>
          <label>Fit
            <select value={fit} onChange={e => setFit(e.target.value)}>
              <option value="fit">Fit (centered, background fills extra)</option>
              <option value="crop">Crop (silhouette fills, edges may crop)</option>
            </select>
          </label>
          <button className="primary big" onClick={download} disabled={busy}>
            {busy ? 'Rendering…' : 'Download PNG'}
          </button>
          {error && <p className="error">{error}</p>}
        </fieldset>
        <div className="actions">
          <button onClick={() => dispatch({ type: 'BACK' })}>Back</button>
          <button onClick={() => dispatch({ type: 'RESET' })}>Start over</button>
        </div>
      </aside>
      <section className="preview">
        <WordCloudCanvas project={project} width={600} />
      </section>
    </div>
  )
}
```

**Step 2:** CSS — make the Download fieldset visually distinct (slightly heavier separator above it) so it reads as a separate action zone within the same sidebar.

**Step 3:** Manual test: download 5×7 (fast), then 11×14 (slow but should work). Confirm regenerate + download produces a PNG matching the on-screen preview at the same seed.

**Step 4:** Commit.

```bash
git add -A && git commit -m "feat: merge download controls into style step"
```

---

## Phase H — Smoke test and first real deploy

### Task 23: End-to-end smoke test (manual)

**Step 1:** `npm run dev`. Walk through the full flow with a real pet photo (have one ready — Google "dog jpg" works fine for a test):
1. Upload — drop image, preview shows, Continue advances.
2. Extract — silhouette appears within ~10 s on first run.
3. Names — add 8–15 nicknames.
4. Style & Download — try color bg, switch to a pattern, switch palettes, click Regenerate 3×. Cloud should re-pack each time, deterministic per seed. Then pick `5x7` and click Download PNG → file downloads, opens, looks right.
5. Refresh page — autosave should restore names/style/seed/step (photo + mask are session-only and will require re-upload; that's expected for phase 1).

**Step 2:** Fix any bugs found. Commit each fix as its own commit.

**Step 3:** Test in Safari and Firefox in addition to Chrome. Background-removal and canvas behavior can differ.

**Step 4:** Final commit before deploy if any cleanup needed.

---

### Task 24: Production build + deploy

**Step 1:** Local production build sanity check.

```bash
cd /Users/taylorcornelius/Desktop/fursona && npm run build && npm run preview
```

Open the preview URL, repeat the smoke test against the production bundle.

**Step 2:** Push and let GH Actions deploy.

```bash
git push
gh run watch
```

**Step 3:** Open `https://Nyarlat-hotep.github.io/fursona/` and run the smoke test on the live site. Expect the first model load to take longer than dev (cold cache).

**Step 4:** If broken on production but works in `npm run preview`:
- Confirm `base: '/fursona/'` in `vite.config.js`.
- Confirm pattern paths use `import.meta.env.BASE_URL`.
- Confirm GH Actions is publishing to `gh-pages` (`gh api repos/Nyarlat-hotep/fursona/branches`).

**Step 5:** Update repo description with the live URL.

```bash
gh repo edit Nyarlat-hotep/fursona --homepage "https://Nyarlat-hotep.github.io/fursona/"
```

**Step 6:** Done. Tag the release.

```bash
git tag v0.1.0 && git push --tags
```

---

## Done criteria

- Live at `https://Nyarlat-hotep.github.io/fursona/`
- Upload → extract → name → style & download flow works end-to-end on Chrome + Safari + Firefox
- Generated PNG opens and looks like a pet-shaped word cloud
- `npm test` is green
- No paid APIs, no API keys, no backend
