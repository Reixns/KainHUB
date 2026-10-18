import { getSupabaseClient } from '@/lib/supabase/client';

const BUCKET = 'marketplace-media';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function uploadMedia(file, folder, userId, role = 'customer') {
  const client = getSupabaseClient(role);
  if (!client || !file || !userId) return { data: null, error: new Error('Media upload is unavailable.') };
  if (!file.type.startsWith('image/')) return { data: null, error: new Error('Please select an image file.') };
  if (file.size > MAX_IMAGE_BYTES) return { data: null, error: new Error('Images must be 4 MB or smaller.') };
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const uniqueId = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${userId}/${folder}/${uniqueId}.${extension}`;
  try {
    const upload = await client.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) {
      const message = upload.error.message || '';
      if (/bucket not found|not found/i.test(message)) {
        return { data: null, error: new Error(`Storage bucket "${BUCKET}" is missing. Run the storage setup in supabase/schema.sql, then try again.`) };
      }
      return { data: null, error: upload.error };
    }
    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    return { data: { path, url: data.publicUrl }, error: null };
  } catch (error) {
    console.error('[supabase] media upload failed:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Image upload failed. Check your connection and try again.'),
    };
  }
}
