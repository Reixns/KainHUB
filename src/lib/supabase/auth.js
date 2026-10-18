import { getSupabaseClient, getAuthRedirectUrl } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/supabase/password';
import { fetchProfileRecord, getProfile, upsertProfile } from '@/lib/supabase/profile';

export async function signIn(email, password, requestedRole) {
  const client = getSupabaseClient(requestedRole);
  if (!client) return { data: null, error: new Error('Supabase is not configured.') };
  const result = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (result.error) {
    const error = result.error;
    const invalidCredentials = error.code === 'invalid_credentials'
      || /invalid login credentials/i.test(error.message || '');
    return { ...result, countAttempt: invalidCredentials };
  }
  const { data: profile, error: profileError } = await fetchProfileRecord(client, result.data.user.id);
  if (profileError) {
    await client.auth.signOut();
    return { data: null, error: new Error(`Account profile could not be loaded: ${profileError.message}`) };
  }
  const { data: vendor, error: vendorError } = await client
    .from('vendors')
    .select('*')
    .eq('owner_id', result.data.user.id)
    .maybeSingle();
  if (vendorError) {
    await client.auth.signOut();
    return { data: null, error: new Error(`Vendor profile could not be loaded: ${vendorError.message}`) };
  }
  const role = profile?.role === 'admin'
    ? 'admin'
    : vendor
      ? 'vendor'
      : (profile?.role || result.data.user.user_metadata?.role || (requestedRole === 'customer' ? 'customer' : null));
  if (!role) {
    await client.auth.signOut();
    return { data: null, error: new Error('Account profile is missing a role. Contact an administrator.') };
  }
  if (requestedRole && role !== requestedRole) {
    await client.auth.signOut();
    return { data: null, error: new Error(`This account is registered as ${role}, not as ${requestedRole}.`) };
  }
  let resolvedProfile = profile;
  if (!profile && role === 'customer') {
    resolvedProfile = await upsertProfile(result.data.user.id, {
      email: result.data.user.email,
      full_name: result.data.user.user_metadata?.fullName || null,
    }, role);
  }
  return { ...result, profile: resolvedProfile, vendor, role };
}

export async function sendPhoneOtp(phone, role) {
  const client = getSupabaseClient(role);
  if (!client) return { error: new Error('Phone login requires a configured Supabase account.') };
  const normalizedPhone = phone.trim().replace(/\s+/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
    return { error: new Error('Use international format, for example +639171234567.') };
  }
  return client.auth.signInWithOtp({ phone: normalizedPhone, options: { shouldCreateUser: false } });
}

export async function verifyPhoneOtp(phone, token, requestedRole) {
  const client = getSupabaseClient(requestedRole);
  if (!client) return { data: null, error: new Error('Phone login requires a configured Supabase account.') };
  const normalizedPhone = phone.trim().replace(/\s+/g, '');
  const result = await client.auth.verifyOtp({ phone: normalizedPhone, token: token.trim(), type: 'sms' });
  if (result.error || !result.data?.user) return result;
  const { data: profile, error: profileError } = await fetchProfileRecord(client, result.data.user.id);
  if (profileError) return { data: null, error: profileError };
  const { data: vendor, error: vendorError } = await client
    .from('vendors')
    .select('*')
    .eq('owner_id', result.data.user.id)
    .maybeSingle();
  if (vendorError) {
    await client.auth.signOut();
    return { data: null, error: new Error(`Vendor profile could not be loaded: ${vendorError.message}`) };
  }
  const role = profile?.role === 'admin' ? 'admin' : vendor ? 'vendor' : profile?.role || 'customer';
  if (role !== requestedRole) {
    await client.auth.signOut();
    return { data: null, error: new Error(`This number is registered as ${role}, not as ${requestedRole}.`) };
  }
  return { ...result, profile, vendor, role };
}

export async function sendEmailOtp(email, role) {
  const client = getSupabaseClient(role);
  if (!client) return { error: new Error('Email login requires a configured Supabase account.') };
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { error: new Error('Enter a valid email address.') };
  }
  return client.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: getAuthRedirectUrl(role, 'login'),
    },
  });
}

export async function verifyEmailOtp(email, token, requestedRole) {
  const client = getSupabaseClient(requestedRole);
  if (!client) return { data: null, error: new Error('Email login requires a configured Supabase account.') };
  const normalizedEmail = email.trim().toLowerCase();
  const result = await client.auth.verifyOtp({ email: normalizedEmail, token: token.trim(), type: 'email' });
  if (result.error || !result.data?.user) return result;
  const { data: profile, error: profileError } = await fetchProfileRecord(client, result.data.user.id);
  if (profileError) return { data: null, error: profileError };
  const { data: vendor, error: vendorError } = await client.from('vendors').select('*').eq('owner_id', result.data.user.id).maybeSingle();
  if (vendorError) {
    await client.auth.signOut();
    return { data: null, error: new Error(`Vendor profile could not be loaded: ${vendorError.message}`) };
  }
  const role = profile?.role === 'admin' ? 'admin' : vendor ? 'vendor' : profile?.role || 'customer';
  if (role !== requestedRole) {
    await client.auth.signOut();
    return { data: null, error: new Error(`This account is registered as ${role}, not as ${requestedRole}.`) };
  }
  return { ...result, profile, vendor, role };
}

export async function signUp(data, role) {
  const client = getSupabaseClient(role);
  if (!client) return { data: null, error: new Error('Supabase is not configured.') };
  const passwordCheck = validatePassword(data.password, {
    email: data.email,
    fullName: data.fullName || data.ownerName,
  });
  if (!passwordCheck.valid) {
    return { data: null, error: new Error(passwordCheck.message) };
  }
  const metadata = {
    fullName: data.fullName || data.ownerName,
    role,
    mobile: data.mobile || null,
    address: data.address || data.shopAddress || null,
    shopName: data.shopName || null,
    category: data.category || null,
    operatingHours: data.operatingHours || null,
    description: data.description || '',
  };
  const result = await client.auth.signUp({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    options: {
      data: metadata,
      emailRedirectTo: getAuthRedirectUrl(role, 'login'),
    },
  });
  if (result.error) return result;
  if (result.data.user) {
    // The database trigger creates the profile/vendor row. Client-side inserts
    // would fail when email confirmation is enabled because there is no session.
    const profile = result.data.session ? await getProfile(result.data.user.id, role) : null;
    return { ...result, profile };
  }
  return result;
}

export async function resetPassword(email, role = 'customer') {
  const client = getSupabaseClient(role);
  if (!client) return { error: new Error('Password reset is unavailable while Supabase is not configured.') };
  const redirectUrl = new URL('/reset-password', window.location.origin);
  redirectUrl.searchParams.set('role', role);
  return client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: redirectUrl.toString(),
  });
}

export async function updatePassword(password, role = 'customer') {
  const client = getSupabaseClient(role);
  if (!client) return { error: new Error('Password updates require a configured Supabase account.') };
  return client.auth.updateUser({ password });
}
