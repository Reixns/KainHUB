import { createClient } from '@supabase/supabase-js';

// VITE_SUPABASE_ANON_KEY is intentionally the public browser key. Never put a
// service_role key in Vite env files or client code.
const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
const supabaseUrl = configuredUrl.replace(/\/rest\/v1\/?$/, '');

export let supabaseConfigError = '';

if (configuredUrl || supabaseAnonKey) {
  if (!configuredUrl || !supabaseAnonKey) {
    supabaseConfigError = 'Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the project-root .env file.';
  } else if (/service_role|secret/i.test(supabaseAnonKey)) {
    supabaseConfigError = 'Use the Supabase anon/publishable key in the browser app. Never use a service_role or secret key.';
  } else {
    try {
      const parsedUrl = new URL(supabaseUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash) {
        supabaseConfigError = 'VITE_SUPABASE_URL must be the Supabase project URL, not a REST endpoint or URL with a path.';
      }
    } catch {
      supabaseConfigError = 'VITE_SUPABASE_URL is not a valid URL.';
    }
  }
}

export const isSupabaseConfigured = Boolean(
  !supabaseConfigError && supabaseUrl && supabaseAnonKey
);

const clients = {};
const roleStorageKey = (role) => `lancaster_${role}_supabase_session`;

export const getAuthRedirectUrl = (role, path = 'login') => {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/${role}/${path}`;
};

/*
  Each role has an independent SDK session in tab-scoped storage. Its access
  and refresh values are opaque placeholders; the BFF substitutes the encrypted
  server-held Supabase credentials and never accepts a browser bearer token.
*/
const clearUnusableSession = async (role) => {
  try {
    const client = getSupabaseClient(role);
    if (!client) return;
    const { data } = await client.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;
    const [, payload] = token.split('.');
    if (!payload) return;
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    // exp is seconds since the epoch; 30s of slack absorbs clock skew.
    if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now() + 30_000) {
      await client.auth.signOut({ scope: 'local' });
      console.warn(`[supabase] cleared an expired "${role}" session; sign in again.`);
    }
  } catch {
    // A session we cannot read is a session we cannot use.
    try {
      await getSupabaseClient(role)?.auth.signOut({ scope: 'local' });
    } catch {
      // Nothing further to do; the client will report the failure on use.
    }
  }
};

/*
  A 401 from PostgREST means the credential it was given is not usable. When the
  cause is a dead session rather than a bad key, clearing storage and letting
  the app ask for a sign-in is correct; silently retrying with the same token
  just reproduces the same 401.
*/
const isAuthCredentialError = (error) => {
  const status = error?.status ?? error?.statusCode;
  const message = String(error?.message ?? '');
  return status === 401 || /invalid.*jwt|jwt.*expired|token.*expired|authorization header/i.test(message);
};

export function getSupabaseClient(role = 'customer') {
  if (!isSupabaseConfigured) return null;
  if (!clients[role]) {
    clients[role] = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Reset callbacks exchange their one-time PKCE code in AppContext so
        // the recovery session is ready before the password form is rendered.
        detectSessionInUrl: typeof window === 'undefined' || window.location.pathname !== '/reset-password',
        // The default implicit flow returns a token in the URL fragment, which
        // expires sooner and leaves the credential in browser history. PKCE
        // keeps long-lived sessions from lapsing while a tab sits open.
        flowType: 'pkce',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: roleStorageKey(role),
      },
      global: {
        fetch: async (input, init) => {
          const requestUrl = input instanceof Request ? input.url : String(input);
          const request = new Request(input, init);
          const options = {
            method: request.method,
            headers: request.headers,
            signal: request.signal,
          };
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            options.body = await request.arrayBuffer();
          }
          const response = await fetch(request.url, options);
          if (response.status === 401 && requestUrl.includes('/rest/v1/')) {
            await clearUnusableSession(role);
          }
          return response;
        },
      },
    });
    clearUnusableSession(role);
    clients[role].auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED is the healthy path and must not be interrupted, and
      // SIGNED_OUT is the result of the cleanup above rather than a new fault.
      if (event === 'USER_UPDATED' && !session?.access_token) {
        void clearUnusableSession(role);
      }
    });
  }
  return clients[role];
}

export { isAuthCredentialError };

export const supabase = getSupabaseClient('customer');
