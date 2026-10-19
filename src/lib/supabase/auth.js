import { getSupabaseClient, getAuthRedirectUrl, getProbeClient } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/supabase/password';
import { fetchProfileRecord, getProfile, upsertProfile } from '@/lib/supabase/profile';

/*
  Calls a lockout RPC without letting a missing database migration take sign-in
  down with it. The functions are additive, so a deployment whose schema has not
  been upgraded yet should behave exactly like the old client: the local
  localStorage lockout in RoleLogin still applies. A missing function surfaces as
  Postgres 42883 or PostgREST PGRST202.
*/
async function callLockoutRpc(client, fn, args) {
  try {
    const { data, error } = await client.rpc(fn, args);
    if (error) {
      const missing = error.code === '42883'
        || error.code === 'PGRST202'
        || /could not find the function|function .* does not exist/i.test(error.message || '');
      if (!missing) console.warn(`[auth] ${fn} failed`, error);
      return null;
    }
    return data;
  } catch (error) {
    console.warn(`[auth] ${fn} failed`, error);
    return null;
  }
}

export async function signIn(email, password, requestedRole) {
  const client = getSupabaseClient(requestedRole);
  if (!client) return { data: null, error: new Error('Supabase is not configured.') };
  const normalizedEmail = email.trim().toLowerCase();

  // Refuse a locked account before checking the password, so the user sees the
  // wait time (tier 1/2) or the "reset by email" instruction (permanent lock)
  // instead of "invalid credentials" on a password that is actually correct.
  const lockState = await callLockoutRpc(client, 'login_status', { p_email: normalizedEmail });
  if (lockState?.locked) {
    const permanent = lockState.permanent === true;
    return {
      data: null,
      error: new Error(permanent
        ? 'This account is locked after too many failed sign-in attempts. Use "Forgot password" to send a recovery link to your email and unlock it.'
        : 'Too many failed attempts. Please wait for the lock to expire.'),
      locked: true,
      permanent,
      secondsRemaining: Number(lockState.secondsRemaining) || 0,
      countAttempt: false,
      failedAttempts: lockState.failedAttempts,
    };
  }

  const result = await client.auth.signInWithPassword({ email: normalizedEmail, password });
  if (result.error) {
    const error = result.error;
    const invalidCredentials = error.code === 'invalid_credentials'
      || /invalid login credentials/i.test(error.message || '');
    if (!invalidCredentials) return { ...result, countAttempt: false };

    const attemptState = await callLockoutRpc(client, 'record_failed_login', { p_email: normalizedEmail });
    if (attemptState?.locked) {
      const permanent = attemptState.permanent === true;
      return {
        data: null,
        error: new Error(permanent
          ? 'Too many failed attempts. This account is now locked — reset your password by email to unlock it.'
          : 'Too many failed attempts. Please wait for the lock to expire.'),
        countAttempt: true,
        locked: true,
        permanent,
        secondsRemaining: Number(attemptState.secondsRemaining) || 0,
        failedAttempts: attemptState.failedAttempts,
      };
    }
    const attempts = Number(attemptState?.failedAttempts);
    /*
      `record_failed_login` reports 0 for an address it has no row for, because
      there is no account to count against. Treating that as a database-streak
      would let an attacker hammer a non-existent email with the counter pinned
      at zero while the local fallback never runs. An untracked address is
      reported the same way as an un-migrated database, so the localStorage
      throttle still applies.
    */
    return {
      ...result,
      countAttempt: true,
      locked: false,
      permanent: false,
      failedAttempts: attempts > 0 ? attemptState.failedAttempts : undefined,
      attemptsRemaining: Number.isFinite(attempts) && attempts % 3 !== 0
        ? 3 - (attempts % 3)
        : undefined,
    };
  }

  // Successful sign-in forgets the streak. Best effort: if the database has not
  // been migrated the call is a no-op and local clearing still happens.
  await callLockoutRpc(client, 'clear_login_attempts', { p_user_id: result.data.user.id });
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
  if (profileError) {
    // The OTP already signed the user in; leaving that session behind with no
    // usable profile would strand a half-signed-in visitor.
    await client.auth.signOut();
    return { data: null, error: profileError };
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
  if (profileError) {
    // See verifyPhoneOtp: the OTP already produced a session, so it has to go
    // when the profile behind it cannot be read.
    await client.auth.signOut();
    return { data: null, error: profileError };
  }
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

  /*
    A reset has to actually change the password, so refuse one that matches the
    current password. Supabase keeps only the password hash and the anon key
    cannot read it, so the comparison is done by trying the new password as a
    sign-in for the same account: if GoTrue accepts it, the password was not
    changed. The probe runs on a throwaway client with no listeners and no
    persistence, so a rejected reuse never signs the real session out, never
    counts toward the failed-login lock, and never replaces the recovery
    session this page is holding.
  */
  let email;
  try {
    const { data } = await client.auth.getUser();
    email = data?.user?.email;
  } catch {
    email = undefined;
  }

  if (email) {
    const probe = getProbeClient();
    if (probe) {
      const { error } = await probe.auth.signInWithPassword({ email, password });
      if (!error) {
        return { error: new Error('Your new password must be different from your current password.') };
      }
    }
  }

  return client.auth.updateUser({ password });
}

/*
  Clears the failed-login lock using the recovery session obtained from the
  email link. The database refuses the call without auth.uid(), so this is the
  "confirm it was really you via email" half of the unlock flow. A database that
  has not been migrated simply reports nothing to unlock.
*/
export async function unlockAccount(role = 'customer') {
  const client = getSupabaseClient(role);
  if (!client) return { success: false, error: new Error('Unlocking requires a configured Supabase account.') };
  try {
    const { error } = await client.rpc('unlock_account');
    if (!error) return { success: true };
    const missing = error.code === '42883'
      || error.code === 'PGRST202'
      || /could not find the function|function .* does not exist/i.test(error.message || '');
    if (missing) return { success: true, skipped: true };
    return { success: false, error };
  } catch (error) {
    return { success: false, error };
  }
}
