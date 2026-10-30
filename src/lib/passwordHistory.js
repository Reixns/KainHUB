/*
  Per-account password reuse guard, and the record of when an old password was
  replaced.

  Supabase Auth does not remember previous passwords, so without a local record a
  customer can change their password to one they used before and nothing stops
  them. This keeps a short, per-account list of recent password hashes in
  localStorage and refuses a new password that matches one of them.

  Each entry also carries `changedAt`, the moment that password stopped being the
  account's password. That is what lets the login screen say "this is an old
  password, changed on <date>" instead of only "invalid credentials".

  Only a salted SHA-256 digest is stored, never the password itself, and the list
  is capped so it cannot grow without bound. The list is per device: a password
  first replaced on another phone is not in this browser's history. That is a
  deliberate limit -- the alternative is a server-side history table, which this
  app's auth provider does not expose -- but it still stops the common case of
  rotating back to the password just replaced.
*/

const HISTORY_LIMIT = 5;
const SALT = 'kainhub-password-history-v1';

const storageKey = (userKey) => `lancaster_password_history_${userKey}`;

async function hashPassword(password, userKey) {
  const value = `${SALT}:${userKey}:${password}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // Not cryptographic, but a stable obfuscation for a storage/API that lacks
  // SubtleCrypto. Still avoids writing the plaintext password to disk.
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `fallback-${hash.toString(16)}`;
}

// Older builds stored a bare hash string; accept both so existing local history
// keeps working after the format changed.
function normalizeEntry(entry) {
  if (typeof entry === 'string') return { hash: entry, changedAt: null };
  if (entry && typeof entry.hash === 'string') {
    return { hash: entry.hash, changedAt: entry.changedAt || null };
  }
  return null;
}

function readHistory(userKey) {
  if (!userKey || typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(userKey)) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.map(normalizeEntry).filter(Boolean);
  } catch {
    return [];
  }
}

export function readPasswordHistory(userKey) {
  return readHistory(userKey);
}

export async function findPasswordHistoryEntry(userKey, password) {
  if (!userKey || !password) return null;
  const history = readHistory(userKey);
  if (!history.length) return null;
  const hash = await hashPassword(password, userKey);
  return history.find((entry) => entry.hash === hash) || null;
}

export async function isPasswordReused(userKey, password) {
  return Boolean(await findPasswordHistoryEntry(userKey, password));
}

export async function rememberPassword(userKey, password, { changedAt = null, limit = HISTORY_LIMIT } = {}) {
  if (!userKey || !password || typeof window === 'undefined') return;
  try {
    const key = storageKey(userKey);
    const hash = await hashPassword(password, userKey);
    const history = readHistory(userKey);
    const existing = history.find((entry) => entry.hash === hash);
    const entry = {
      hash,
      changedAt: changedAt || existing?.changedAt || null,
    };
    const next = [entry, ...history.filter((item) => item.hash !== hash)].slice(0, limit);
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // History is a convenience; a storage failure must not block a real change.
  }
}

export async function forgetPasswordHistoryEntry(userKey, password) {
  if (!userKey || !password || typeof window === 'undefined') return;
  try {
    const key = storageKey(userKey);
    const hash = await hashPassword(password, userKey);
    const history = readHistory(userKey);
    const next = history.filter((entry) => entry.hash !== hash);
    if (next.length !== history.length) {
      window.localStorage.setItem(key, JSON.stringify(next));
    }
  } catch {
    // History is a convenience; a storage failure must not block a real change.
  }
}

export function clearPasswordHistory(userKey) {
  if (!userKey || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(userKey));
  } catch {
    // Nothing to do; the next successful change will start a fresh list.
  }
}
