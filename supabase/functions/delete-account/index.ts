// Supabase Edge Function: delete-account
//
// Deletes the authenticated user along with their storage objects (photos +
// previews) and database rows (cascades from auth.users via the FK in the
// projects table).
//
// Deploy with:
//   supabase functions deploy delete-account --no-verify-jwt
//
// We disable JWT verification at the gateway because we verify the caller
// ourselves with the service role client below — this lets the function
// return clean 401s and lets it work consistently with the bearer-token
// pattern used from the client.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  const accessToken = authHeader.replace(/^Bearer\s+/i, '')
  if (!accessToken) return json({ error: 'Missing bearer token' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Server misconfigured' }, 500)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Verify the caller and pull their user id from their access token.
  const { data: { user }, error: authErr } = await admin.auth.getUser(accessToken)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)
  const userId = user.id

  // Best-effort cleanup of storage objects in the user's folders.
  for (const bucket of ['photos', 'previews']) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 })
      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`)
        await admin.storage.from(bucket).remove(paths)
      }
    } catch (_) { /* keep going so we still delete the user row */ }
  }

  // Delete the auth user — cascades to projects via the FK constraint.
  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) return json({ error: delErr.message || 'Delete failed' }, 500)

  return json({ ok: true })
})
