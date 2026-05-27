import { supabase } from './supabase'
import { renderWordCloudToCanvas } from './renderWordCloud'
import { resolvePalette } from '../styles/palettes'

export const SAVE_CAP = 5

export async function listProjects(userId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(SAVE_CAP)
  if (error) throw error
  return data
}

export async function deleteProject(project) {
  if (project.photo_path) {
    await supabase.storage.from('photos').remove([project.photo_path])
  }
  if (project.preview_path) {
    await supabase.storage.from('previews').remove([project.preview_path])
  }
  const { error } = await supabase.from('projects').delete().eq('id', project.id)
  if (error) throw error
}

export async function getPreviewUrl(path) {
  if (!path) return null
  const { data, error } = await supabase
    .storage.from('previews')
    .createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}

/**
 * Save (insert or update) a project. Pass `currentProjectId` to overwrite,
 * else a new row is created and returned.
 */
export async function saveProject({ user, name, project, currentProjectId }) {
  const projectId = currentProjectId || crypto.randomUUID()
  let photoPath = null

  if (project.photoBlob) {
    const compressed = await downscaleAndEncode(project.photoBlob, 1600, 0.85)
    photoPath = `${user.id}/${projectId}.jpg`
    const { error } = await supabase.storage
      .from('photos')
      .upload(photoPath, compressed, { contentType: 'image/jpeg', upsert: true })
    if (error) throw error
  }

  const previewBlob = await renderPreview(project)
  const previewPath = `${user.id}/${projectId}.png`
  const { error: prevErr } = await supabase.storage
    .from('previews')
    .upload(previewPath, previewBlob, { contentType: 'image/png', upsert: true })
  if (prevErr) throw prevErr

  const row = {
    id: projectId,
    user_id: user.id,
    name,
    photo_path: photoPath,
    shape_id: project.shapeId ?? null,
    names: project.names,
    style: project.style,
    seed: project.seed,
    preview_path: previewPath,
    updated_at: new Date().toISOString(),
  }

  if (currentProjectId) {
    const { data, error } = await supabase
      .from('projects')
      .update(row)
      .eq('id', currentProjectId)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(row)
    .select()
    .single()
  if (error) {
    // Clean up uploaded files if the row insert failed (e.g. cap trigger)
    if (photoPath) await supabase.storage.from('photos').remove([photoPath])
    await supabase.storage.from('previews').remove([previewPath])
    throw error
  }
  return data
}

export async function fetchPhotoBlob(path) {
  const { data, error } = await supabase.storage.from('photos').download(path)
  if (error) throw error
  return data
}

// --- Image helpers ---

export function isHeic(file) {
  if (!file) return false
  const type = (file.type || '').toLowerCase()
  if (type === 'image/heic' || type === 'image/heif') return true
  const name = (file.name || '').toLowerCase()
  return name.endsWith('.heic') || name.endsWith('.heif')
}

async function downscaleAndEncode(blob, maxDim, quality) {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode photo.'))),
      'image/jpeg',
      quality,
    )
  })
}

async function renderPreview(project) {
  const size = 400
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  if (project.maskBitmap) {
    await renderWordCloudToCanvas({
      canvas,
      mask: project.maskBitmap.mask,
      maskWidth: project.maskBitmap.width,
      maskHeight: project.maskBitmap.height,
      names: project.names.map((n) => n.text),
      seed: project.seed,
      style: project.style,
      palette: resolvePalette(project.style),
    })
  }
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode preview.'))),
      'image/png',
    )
  })
}
