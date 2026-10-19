/*
  Client-side fallback brute-force protection for the login portals.

  The authoritative lock now lives in the database (login_attempts plus the
  login_status / record_failed_login RPCs): three wrong passwords wait five
  minutes, the next three wait ten, and the ninth is a permanent lock that only
  the email recovery link clears. This module is what runs when that database
  migration is not present yet, and as a reload-resistant throttle on top of it.
  Its own tiers step by five minutes each (5, 10, 15, ... capped at an hour) and
  it never sees DB state, so the two are only ever used one at a time.

  The streak lives in localStorage keyed by role + email, so it survives a
  reload, a tab close, and switching between the three portals. Nothing here
  ever stores the attempted password.
*/

const STORAGE_KEY = 'lancaster_login_lockout';

// Wrong passwords tolerated per lockout tier.
export const MAX_LOGIN_ATTEMPTS = 3;

// Every further tier of consecutive wrong passwords waits this much longer.
export const LOCKOUT_STEP_SECONDS = 5 * 60;

// Safety valve so a genuine user who keeps fumbling cannot end up locked out for
// days and need a manual database edit to get back in.
export const MAX_LOCKOUT_SECONDS = 60 * 60;

// A challenge has to be answered reasonably promptly, otherwise an open tab left
// unattended for a long time becomes a free captcha to answer later.
export const CAPTCHA_TTL_SECONDS = 2 * 60;

const accountKey = (role, email) => `${role}:${String(email || '').trim().toLowerCase()}`;

const readAll = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('[security] unreadable login lockout store, treating it as empty', error);
    return {};
  }
};

const writeAll = (all) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (error) {
    console.warn('[security] login lockout store could not be written', error);
  }
};

export const lockoutTier = (fails) => Math.floor(Math.max(0, Number(fails) || 0) / MAX_LOGIN_ATTEMPTS);

export const lockoutSecondsForTier = (tier) =>
  Math.min(Math.max(0, Number(tier) || 0) * LOCKOUT_STEP_SECONDS, MAX_LOCKOUT_SECONDS);

export const lockoutSecondsRemaining = (lockUntil, now = Date.now()) =>
  Math.max(0, Math.ceil((Math.max(0, Number(lockUntil) || 0) - now) / 1000));

export const readLockout = (role, email) => {
  const entry = readAll()[accountKey(role, email)] || {};
  return {
    fails: Math.max(0, Number(entry.fails) || 0),
    lockUntil: Math.max(0, Number(entry.lockUntil) || 0),
  };
};

// Only a successful sign-in forgets the streak. Reaching the end of a lockout
// does not: otherwise every lockout would be worth exactly one tier.
export const clearLockout = (role, email) => {
  const all = readAll();
  delete all[accountKey(role, email)];
  writeAll(all);
};

/*
  Records one wrong password and returns the new state. Every
  MAX_LOGIN_ATTEMPTS failures trigger a lockout whose length is the tier number
  times LOCKOUT_STEP_SECONDS, so three wrong answers wait five minutes, the next
  three wait ten, then fifteen, and so on.
*/
export const registerFailedAttempt = (role, email, now = Date.now()) => {
  const all = readAll();
  const key = accountKey(role, email);
  const entry = all[key] || {};

  const fails = Math.max(0, Number(entry.fails) || 0) + 1;
  const tier = lockoutTier(fails);
  const lockedOut = fails % MAX_LOGIN_ATTEMPTS === 0;

  // A tier sets the lock relative to now, not to the old value, so a stale
  // lockout that already expired cannot shorten or extend the new one.
  const lockUntil = lockedOut ? now + lockoutSecondsForTier(tier) * 1000 : Math.max(0, Number(entry.lockUntil) || 0);

  all[key] = { fails, lockUntil };
  writeAll(all);

  return {
    fails,
    tier,
    lockedOut,
    lockUntil,
    // Wrong answers still owed before the next lockout.
    attemptsRemaining: lockedOut ? 0 : MAX_LOGIN_ATTEMPTS - (fails % MAX_LOGIN_ATTEMPTS),
  };
};
