import { createDecipheriv, createCipheriv, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';

const SESSION_COOKIE = {
  admin: 'kainhub_admin_session',
  vendor: 'kainhub_vendor_session',
  customer: 'kainhub_customer_session',
};
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOWED_API_PREFIXES = ['/auth/v1/', '/rest/v1/', '/storage/v1/'];
const MAX_COOKIE_LENGTH = 3800;
function getEnvironment() {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const supabaseKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const encryptionSecret = process.env.SESSION_ENCRYPTION_KEY?.trim();
  if (!supabaseUrl || !supabaseKey || !encryptionSecret) {
    throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, and SESSION_ENCRYPTION_KEY in the server environment.');
  }
  if (/service_role|secret/i.test(supabaseKey)) {
    throw new Error('SUPABASE_ANON_KEY must be the public anon/publishable key, never a service_role or secret key.');
  }
  const normalizedUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const key = Buffer.from(encryptionSecret, 'base64');
  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error('SUPABASE_URL must be a valid project URL.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash) {
    throw new Error('SUPABASE_URL must be the project URL, not a REST endpoint or URL with a path.');
  }
  if (key.length !== 32 || key.toString('base64') !== encryptionSecret) {
    throw new Error('SESSION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return { supabaseUrl: normalizedUrl, supabaseKey, encryptionKey: key };
}

function cookieFlags(request, name, value, role, clear = false) {
  const secure = process.env.NODE_ENV === 'production' || new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${value}; Path=/api/supabase/${role}; HttpOnly; SameSite=Lax${secure}${clear ? '; Max-Age=0' : ''}`;
}

function readCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key]) => key));
}

function encryptSession(session, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

function decryptSession(value, key) {
  try {
    const payload = Buffer.from(value, 'base64url');
    if (payload.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    const json = Buffer.concat([
      decipher.update(payload.subarray(28)),
      decipher.final(),
    ]).toString('utf8');
    const session = JSON.parse(json);
    return typeof session.access_token === 'string'
      && typeof session.refresh_token === 'string'
      && typeof session.csrf_token === 'string'
      ? session
      : null;
  } catch {
    return null;
  }
}

function setSessionCookie(headers, request, cookieName, session, encryptionKey) {
  const value = encryptSession(session, encryptionKey);
  if (value.length > MAX_COOKIE_LENGTH) {
    throw new Error('The encrypted session exceeds the secure cookie size limit.');
  }
  headers.append('Set-Cookie', cookieFlags(request, cookieName, value, session.role));
}

function isAllowedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return SAFE_METHODS.has(request.method);
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function jsonError(message, status = 500) {
  return Response.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function readUpstreamBody(response) {
  const body = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json') || body.byteLength === 0) {
    return { body, session: null };
  }
  try {
    const json = JSON.parse(new TextDecoder().decode(body));
    const session = json && typeof json.access_token === 'string' && typeof json.refresh_token === 'string'
      ? {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_at: json.expires_at || Math.floor(Date.now() / 1000) + (json.expires_in || 3600),
      }
      : null;
    if (session) {
      json.access_token = randomBytes(32).toString('base64url');
      json.refresh_token = randomBytes(32).toString('base64url');
      return { body: new TextEncoder().encode(JSON.stringify(json)), session };
    }
  } catch {
    return { body, session: null };
  }
  return { body, session: null };
}

function buildResponse(upstream, body, setCookie, csrfToken, method) {
  const headers = new Headers();
  for (const name of ['content-type', 'content-range', 'accept-ranges', 'etag', 'cache-control', 'preference-applied']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('Cache-Control', 'no-store');
  if (setCookie) headers.append('Set-Cookie', setCookie);
  if (csrfToken) headers.set('x-kainhub-csrf', csrfToken);
  const responseBody = method === 'HEAD' || [204, 205, 304].includes(upstream.status) ? null : body;
  return new Response(responseBody, { status: upstream.status, headers });
}

export async function handleSupabaseProxy(request) {
  let environment;
  try {
    environment = getEnvironment();
  } catch (error) {
    return jsonError(error.message, 500);
  }

  const requestUrl = new URL(request.url);
  const match = requestUrl.pathname.match(/^\/api\/supabase\/(admin|vendor|customer)(\/.*)$/);
  if (!match) return jsonError('Unsupported Supabase proxy path.', 404);
  const [, role, apiPath] = match;
  if (!ALLOWED_API_PREFIXES.some((prefix) => apiPath.startsWith(prefix))) {
    return jsonError('This Supabase API is not available through the server proxy.', 404);
  }
  if (!['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return jsonError('Unsupported request method.', 405);
  }
  if (!isAllowedOrigin(request)) return jsonError('Cross-origin requests are not allowed.', 403);

  const cookieName = SESSION_COOKIE[role];
  const cookies = readCookies(request.headers.get('cookie') || '');
  const rawSessionCookie = cookies[cookieName];
  const currentSession = cookies[cookieName]
    ? decryptSession(cookies[cookieName], environment.encryptionKey)
    : null;
  const isAuthTokenEndpoint = apiPath === '/auth/v1/token';
  const grantType = new URLSearchParams(requestUrl.search).get('grant_type');
  const isFreshLogin = isAuthTokenEndpoint && grantType !== 'refresh_token';
  if (currentSession && !isFreshLogin && request.headers.get('x-kainhub-csrf') !== currentSession.csrf_token) {
    return jsonError('Session verification failed. Reload the page and sign in again.', 403);
  }
  let outgoingBody;
  try {
    outgoingBody = request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();
  } catch (error) {
    console.error('[bff] Unable to read incoming request body:', error);
    return jsonError('Unable to read the request body.', 400);
  }

  if (isAuthTokenEndpoint && grantType === 'refresh_token') {
    if (!currentSession) return jsonError('Session expired. Please sign in again.', 401);
    outgoingBody = new TextEncoder().encode(JSON.stringify({
      refresh_token: currentSession.refresh_token,
    }));
  }

  const headers = new Headers();
  for (const name of ['accept', 'accept-encoding', 'content-type', 'prefer', 'range', 'x-client-info', 'x-upsert']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('apikey', environment.supabaseKey);
  if (currentSession && !isAuthTokenEndpoint) {
    headers.set('Authorization', 'Bearer ' + currentSession.access_token);
  } else {
    headers.set('Authorization', 'Bearer ' + environment.supabaseKey);
  }

  const upstreamUrl = new URL(`${environment.supabaseUrl}${apiPath}${requestUrl.search}`);
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: outgoingBody,
      redirect: 'manual',
    });
  } catch (error) {
    console.error('[bff] Supabase request failed:', error);
    return jsonError('Unable to reach the authentication and data service.', 502);
  }

  const clearSession = apiPath === '/auth/v1/logout'
    || (upstream.status === 401 && currentSession)
    || Boolean(rawSessionCookie && !currentSession);
  const { body, session } = await readUpstreamBody(upstream);
  const responseHeaders = new Headers();
  let cookie;
  try {
    if (session) {
      session.role = role;
      session.csrf_token = !isFreshLogin && currentSession?.csrf_token
        ? currentSession.csrf_token
        : randomBytes(32).toString('base64url');
      responseHeaders.set('x-kainhub-csrf', session.csrf_token);
      setSessionCookie(responseHeaders, request, cookieName, session, environment.encryptionKey);
    } else if (clearSession) {
      cookie = cookieFlags(request, cookieName, '', role, true);
    }
  } catch (error) {
    return jsonError(error.message, 500);
  }

  if (cookie) responseHeaders.append('Set-Cookie', cookie);
  return buildResponse(
    upstream,
    body,
    responseHeaders.get('Set-Cookie'),
    responseHeaders.get('x-kainhub-csrf'),
    request.method,
  );
}
