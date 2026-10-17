import { getSupabaseClient } from '@/lib/supabase/client';
import { writeTolerant } from '@/lib/supabase/tolerantWrite';

/*
  `upsertProfile` is called on every state save. A missing `cover_image` column
  made Postgres reject the entire statement, so full_name, mobile and address
  were all discarded too. The write now skips only the columns this server does
  not have and still logs the reason plus the migration that fixes it.
*/
export async function getProfile(userId, role = 'customer') {
  const client = getSupabaseClient(role);
  if (!client || !userId) return null;
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    console.error(`[supabase] select on "profiles" failed: ${error.code || ''} ${error.message || ''}`.trim());
    return null;
  }
  return data;
}

export async function upsertProfile(userId, values, role = 'customer') {
  const client = getSupabaseClient(role);
  if (!client || !userId) return null;
  const result = await writeTolerant({
    table: 'profiles',
    values: { id: userId, ...values },
    run: (row) => client.from('profiles').upsert(row).select().single(),
  });
  return result?.data || null;
}
