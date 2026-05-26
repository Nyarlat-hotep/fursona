# Fursona — Design Doc

**Date:** 2026-05-26
**Status:** Approved, ready for implementation planning
**Project dir:** `/Users/taylorcornelius/Desktop/fursona`
**Repo:** `fursona` (to be created on GitHub)
**Public URL:** `https://Nyarlat-hotep.github.io/fursona/`

---

## What we are building

A free, browser-only tool where a user uploads a photo of their pet, types in the pet's nicknames, and gets back a printable word cloud shaped like the pet's silhouette. Custom backgrounds, multiple print sizes, PNG download. No account required in phase 1.

## Goals

- Ship a complete, polished single-user experience first
- Zero backend, zero API keys, zero recurring cost
- GitHub Pages hosting with the same auto-deploy pattern as the other Desktop projects
- Architectural seams in place so phase 2 (accounts, saved pets) is additive

## Non-goals (phase 1)

- Auth, accounts, persistence across sessions
- Sharing, public links, social embedding
- Physical print ordering / Printify-style integration
- Manual silhouette cleanup (brush tools)
- Theme/style packs, full font picker
- Social-aspect exports (Instagram sizes)
- Mobile-app wrapper

---

## Stack

- **React + Vite** (matches existing Desktop projects)
- Plain CSS, no Tailwind
- **`@imgly/background-removal`** — in-browser ONNX background removal. ~30 MB model, cached after first load. No API key.
- **`wordcloud2.js`** — mask-aware word cloud packing with per-word font/color/rotation callbacks.
- **`@fontsource/*`** — bundled Google Fonts for offline-safe canvas rendering (avoids FOUT on canvas).
- **`html-to-image`** (or direct `canvas.toBlob`) — PNG export.
- **GitHub Actions → `gh-pages`** branch deploy on push to `main`.

## User flow (5 steps, single-page, step index in state — no router)

1. **Upload** — drop zone + file picker (JPG/PNG/HEIC). Show preview. Prefetch the background-removal model while user is on this screen.
2. **Extract** — show original + auto-extracted silhouette side by side. "Looks good" / "Try another photo".
3. **Nicknames** — chip-style input. Enter to add, ✕ to remove. (Optional per-chip rotation toggle.)
4. **Style** — sidebar: background color picker, ~10 bundled pattern tiles, 4–5 curated color palettes for words, **Regenerate** button (re-rolls RNG seed). Live preview canvas at ~600×750.
5. **Download** — pick print size, click Download PNG. Re-renders to high-res off-screen canvas with the same seed.

Back button on every step except Upload. State preserved across steps.

## Word cloud algorithm

- Convert RGBA bitmap from background removal to a **binary mask** (alpha > threshold = fillable).
- Auto-crop to silhouette bounding box + margin.
- Pre-paint a canvas with "blocked" pixels everywhere *outside* the silhouette, hand to `wordcloud2.js`.
- Per-word random assignments, seeded:
  - **Size tiers:** ~15% hero / 35% medium / 50% small fill
  - **Font:** uniform random from 6–10 curated set
  - **Color:** uniform random from active palette
  - **Rotation:** 70% horizontal / 25% vertical / 5% 45°
- If significant silhouette area is still empty after first pass, run a second pass with smaller min font and a reshuffled name list.

**Font set (initial picks, refine in implementation):** one bold display, one script, one serif, one slab, one rounded sans, one geometric sans, one mono, one handwritten.

**Palettes (initial picks):** mono-black, warm (rust/cream/terracotta), cool (navy/teal/sage), pastel, monochrome-on-pattern.

## Export

| Print size | Pixels @ 300 DPI |
|---|---|
| 5 × 7 | 1500 × 2100 |
| 8 × 10 | 2400 × 3000 |
| 11 × 14 | 3300 × 4200 |
| 16 × 20 | 4800 × 6000 |

- Off-screen canvas at target dims.
- Background painted first → mask resampled → wordcloud2 re-runs with the **same seed** so output matches preview.
- `canvas.toBlob('image/png')` → blob URL → `<a download>` click. File named `<pet>-cloud-<size>.png` (default `pet` if no name given).
- Aspect-fit options: **Fit** (default, centered, bg fills) or **Crop** (silhouette scaled to fill, edges cropped). Auto-swap to landscape if silhouette bbox is wider than tall.
- Gracefully catch render failures on the largest sizes ("Try a smaller size") — old phones may hit memory limits at 16×20.

## State model (seam for phase 2)

```js
Project = {
  id,            // uuid
  photoBlob,     // original upload, kept as Blob URL
  maskBitmap,    // ImageBitmap of the binary mask
  names: [{ text, allowVertical }],
  style: { backgroundType, backgroundValue, palette },
  seed,          // RNG seed driving all per-word randomness
  lastExportedAt
}
```

Phase 1 holds one in-memory `Project`. Optional `localStorage` autosave so refresh doesn't wipe work.

## Persistence seam

Single `src/storage.js` module:

```js
loadProjects()   // -> Project[]
saveProject(p)   // -> Project (with id)
deleteProject(id)
```

Phase 1 implementation: localStorage (single project). Phase 2 swap: Supabase (auth + `projects` table + storage bucket for photo/mask). Component code stays unchanged.

## UI seams reserved for phase 2

- `<UserMenu />` slot in the top-right of the app chrome — renders `null` in phase 1.
- `<ProjectGallery />` route stub — not mounted in phase 1.

## Deploy

- New repo `fursona` on GitHub via `gh repo create` (public).
- `.github/workflows/deploy.yml` modeled on the dice-roller / House-numbers workflow: on push to `main`, install + `npm run build`, deploy `dist/` to `gh-pages` via `peaceiris/actions-gh-pages`.
- Vite config: `base: '/fursona/'`.
- GitHub Pages: Deploy from branch → `gh-pages` / root.
- Never push directly to `gh-pages`. Never run `npm run deploy` manually.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `@imgly/background-removal` model is ~30 MB on first visit | Prefetch on Upload screen; show progress; cache by service worker (Vite PWA plugin, optional v1.1) |
| Silhouette extraction fails on busy backgrounds | "Try another photo" link on Extract step; document phase-1 best-result tips in a small help link |
| wordcloud2 packing leaves big gaps for some shapes | Second-pass with smaller min font; tune size tier weights |
| 16×20 @ 300 DPI canvas (115 MB RGBA) crashes mobile | Render with spinner + try/catch; toast suggesting smaller size on failure |
| Font flash / wrong font on first paint to canvas | Bundle via `@fontsource`, await `document.fonts.ready` before any canvas render |
| GH Pages base path breaks asset URLs | Set `base: '/fursona/'` in `vite.config.js`; verify against deployed URL pre-launch |

## Out-of-scope but worth remembering for v1.5+

- Manual silhouette refine (brush erase/restore)
- Theme/style packs (font + palette combos by vibe)
- Transparent PNG, SVG, and social-format exports
- Multiple pets per image
- Per-name size weighting UI (if random feels too chaotic)
- PWA / install-to-home-screen
