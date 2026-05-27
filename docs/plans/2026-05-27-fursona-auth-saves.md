# Fursona Auth + Saved Projects Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add username/email + password auth, Google OAuth, and per-user saved word-cloud projects (up to 5 each). Anonymous use stays fully functional; login is only required at Save time.

**Stack:** Supabase (Auth + Postgres + Storage), `@supabase/supabase-js`. No backend code — RLS + a server-side trigger enforce data ownership and the 5-project cap.

---

## Architecture decisions (locked in)

- **What we save:** original photo (or shape id), nicknames, style object, seed, **rendered preview PNG** for thumbnails. Mask is *not* stored — regenerated on open.
- **Save trigger:** explicit Save button in step 4 footer, next to Download.
- **Auth gating:** anonymous browse + create allowed; login prompt only fires when user clicks Save.
- **Auth fields:** email + password. Auto-confirm enabled (no verification email).
- **Cap:** 5 projects per user, enforced by a Postgres trigger. UI disables Save with a tooltip when at limit.
- **Editing:** opening a saved project tracks its `id`; Save overwrites. "Start over" breaks the link to create new.
- **Header UI:** UserCircle icon button → sign-in modal or signed-in menu (email + Sign out). When logged in, a "Saves" dropdown replaces the existing "Start over" button and lists thumbnails.

---

## One-time setup (manual, outside the codebase)

### Supabase project
1. supabase.com → New project (`fursona`), strong DB password.
2. **Project Settings → API** — record Project URL + anon public key.
3. **Auth → Providers → Email** — enable, set "Confirm email" → OFF.
4. **Auth → URL Configuration:**
   - Site URL: `https://Nyarlat-hotep.github.io/fursona/`
   - Additional Redirect URLs: `http://localhost:5173/*, https://Nyarlat-hotep.github.io/fursona/*`

### Google OAuth
1. Google Cloud Console → project → **OAuth consent screen** (External, app name `Fursona`).
2. **Credentials → Create OAuth Client ID → Web application**:
   - Authorized JavaScript origins: `https://<ref>.supabase.co`
   - Authorized redirect URIs: `https://<ref>.supabase.co/auth/v1/callback`
3. Paste Client ID + Secret into **Supabase Auth → Providers → Google**.

### Schema + RLS (run in Supabase SQL Editor)

```sql
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  photo_path text,           -- null for shape-based
  shape_id text,             -- null for photo-based
  names jsonb not null,
  style jsonb not null,
  seed bigint not null,
  preview_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_updated_idx on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;
create policy "read own"   on public.projects for select using (auth.uid() = user_id);
create policy "insert own" on public.projects for insert with check (auth.uid() = user_id);
create policy "update own" on public.projects for update using (auth.uid() = user_id);
create policy "delete own" on public.projects for delete using (auth.uid() = user_id);

create function public.enforce_project_cap() returns trigger as $$
begin
  if (select count(*) from public.projects where user_id = new.user_id) >= 5 then
    raise exception 'Save limit reached (5 of 5).';
  end if;
  return new;
end $$ language plpgsql;

create trigger projects_cap before insert on public.projects
  for each row execute function public.enforce_project_cap();
```

### Storage buckets (Supabase → Storage)

Create `photos` (private) and `previews` (private). Then in **Storage → Policies**:

```sql
create policy "own files read"   on storage.objects for select
  using (bucket_id in ('photos','previews') and (auth.uid())::text = (storage.foldername(name))[1]);
create policy "own files write"  on storage.objects for insert
  with check (bucket_id in ('photos','previews') and (auth.uid())::text = (storage.foldername(name))[1]);
create policy "own files update" on storage.objects for update
  using (bucket_id in ('photos','previews') and (auth.uid())::text = (storage.foldername(name))[1]);
create policy "own files delete" on storage.objects for delete
  using (bucket_id in ('photos','previews') and (auth.uid())::text = (storage.foldername(name))[1]);
```

Path convention: `photos/{user_id}/{project_id}.jpg`, `previews/{user_id}/{project_id}.png`.

### Env vars
- Local: `.env.local` (already in Vite's gitignore):
  ```
  VITE_SUPABASE_URL=https://<ref>.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJh...
  ```
- GitHub: repo Settings → Secrets and variables → Actions → add both. Update `.github/workflows/deploy.yml` to expose them at build time.

The anon key is safe to ship publicly — RLS enforces ownership.

---

## Implementation phases

### Phase A — Plumbing
- `npm i @supabase/supabase-js`
- `src/lib/supabase.js` — single client reading env vars
- `src/state/useAuth.js` — hook exposing `user`, `signUp`, `signInWithPassword`, `signInWithGoogle`, `signOut`, listens to `onAuthStateChange`

### Phase B — Auth UI
- Header: replace `UserMenu` no-op with real `UserMenu` (Phosphor `UserCircle`)
  - Logged out → opens `SignInModal`
  - Logged in → small menu: email + Sign out
- `SignInModal`: email/password fields, Sign in / Sign up toggle, "Continue with Google" button, error states

### Phase C — Save flow
- Add `currentProjectId` to project state + reducer actions: `SET_CURRENT_PROJECT_ID`, plus include it in `RESET`/`SET_SHAPE`/`SET_PHOTO` to clear it (those start fresh)
- New "Save" button in step 4 footer (left of Download PNG)
  - Logged out → opens `SignInModal` first, then continues with save
  - Logged in → opens `SaveDialog`
- `SaveDialog`: auto-named text field ("<first-nickname>'s cloud" or "Untitled cloud"), Save / Cancel
- Save pipeline:
  1. If photo, downscale to max 1600px wide + re-encode as JPEG at 0.85 quality
  2. Upload photo to `photos/{user_id}/{project_id}.jpg`
  3. Render preview PNG (existing renderer at 400×400), upload to `previews/{user_id}/{project_id}.png`
  4. Upsert row into `projects`
  5. Set `currentProjectId` so future Saves overwrite
- HEIC handling: if file type is `image/heic` or `image/heif`, show user-friendly error suggesting export-as-JPEG (Chrome/Firefox can't decode HEIC; Safari can but we'd still need to handle re-encode reliably — punt for now)

### Phase D — Saved menu
- Header: `SavesDropdown` (only visible when logged in)
  - Lists rows (up to 5) — preview thumbnail, name, relative date, trash button
  - Hide existing "Start over" button when logged in (the Saves menu replaces it)
- Open flow:
  1. Click row → set loading state
  2. Fetch row from DB
  3. If `photo_path`: download photo from storage, run background-removal to regenerate mask
  4. If `shape_id`: call `shapeToMaskBitmap(SHAPES[shape_id].Icon)`
  5. Restore names, style, seed, set `currentProjectId`
  6. Jump to step 3 (Style+Download)
- Delete: confirm → delete photo + preview from storage → delete row → refresh list

### Phase E — Polish
- 5/5 tooltip on disabled Save button when limit reached
- Toast component for auth + save success/error
- Update `.github/workflows/deploy.yml` to pass `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from secrets to the build step
- Verify localStorage autosave still functions for anonymous in-progress drafts

---

## Gotchas being addressed

| Gotcha | Solution |
|---|---|
| Mask regen slow on open | Loading overlay during Phase D open flow |
| Photo files too large | 1600px-max downscale + JPEG re-encode at 0.85 quality on save |
| HEIC photos | Reject upfront in Phase C with friendly message; revisit if needed |
| Supabase auto-pause after 7d idle | Out of scope — operational, not code |

---

## Done criteria
- Anonymous flow still works end-to-end (upload/shape → names → style → download)
- Sign up with email/password + Google both work
- Save creates row + uploads photo + preview; saved menu shows it
- Re-opening a save restores everything and lands on step 4 ready to overwrite
- 5/5 cap enforced both client-side (tooltip) and server-side (trigger)
- Build deploys clean to GH Pages with secrets injected
