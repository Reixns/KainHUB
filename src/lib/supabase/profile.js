import { getSupabaseClient } from '@/lib/supabase/client';
import { writeTolerant } from '@/lib/supabase/tolerantWrite';

const ROLE_PROFILE_TABLE = {
  customer: 'customer_profiles',
  vendor: 'vendor_profiles',
  admin: 'admin_profiles',
};

const PROFILE_DETAILS = ['full_name', 'mobile', 'address', 'avatar', 'cover_image'];

export async function fetchProfileRecord(client, userId) {
  const { data: account, error: accountError } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (accountError || !account) return { data: account, error: accountError };

  const table = ROLE_PROFILE_TABLE[account.role];
  if (!table) return { data: null, error: new Error(`Unsupported account role "${account.role}".`) };

  const { data: details, error } = await client
    .from(table)
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { data: null, error };
  if (!details) {
    return { data: null, error: new Error(`The ${account.role} profile is missing for account ${userId}.`) };
  }

  return { data: { ...account, ...details }, error: null };
}

export async function getProfile(userId, role = 'customer') {
  const client = getSupabaseClient(role);
  if (!client || !userId) return null;
  const { data, error } = await fetchProfileRecord(client, userId);
  if (error) {
    console.error(`[supabase] select on "profiles" failed: ${error.code || ''} ${error.message || ''}`.trim());
    return null;
  }
  return data;
}

export async function upsertProfile(userId, values, role = 'customer') {
  const client = getSupabaseClient(role);
  if (!client || !userId) return null;
  const table = ROLE_PROFILE_TABLE[role];
  if (!table) {
    console.error(`[supabase] cannot save a profile for unsupported role "${role}".`);
    return null;
  }
  const result = await writeTolerant({
    table: 'profiles',
    values: { id: userId, role, ...values },
    run: (row) => client.from('profiles').upsert(row).select().single(),
    onError: (error) => console.error(`[supabase] upsert on "profiles" failed: ${error.code || ''} ${error.message || ''}`.trim()),
  });
  if (!result?.data) return null;

  const details = Object.fromEntries(PROFILE_DETAILS
    .filter((column) => Object.hasOwn(values, column))
    .map((column) => [column, values[column] ?? null]));
  const { data: profileDetails, error } = await client
    .from(table)
    .upsert({ id: userId, ...details })
    .select()
    .single();
  if (error) {
    console.error(`[supabase] upsert on "${table}" failed: ${error.code || ''} ${error.message || ''}`.trim());
    return null;
  }
  return { ...result.data, ...profileDetails };
}
