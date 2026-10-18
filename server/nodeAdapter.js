import { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'expect',
  'host',
  'transfer-encoding',
]);

export async function handleNodeRequest(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined && !HOP_BY_HOP_HEADERS.has(name)) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
  }
  const method = req.method || 'GET';
  const hasBody = !['GET', 'HEAD'].includes(method);
  let body;
  if (hasBody) {
    if (req.body === undefined) {
      body = Readable.toWeb(req);
    } else if (Buffer.isBuffer(req.body) || req.body instanceof Uint8Array) {
      body = req.body;
    } else if (typeof req.body === 'string') {
      body = Buffer.from(req.body);
    } else {
      body = Buffer.from(JSON.stringify(req.body));
    }
  }
  return new Request(`${protocol}://${host}${req.url}`, {
    method,
    headers,
    body,
    duplex: hasBody ? 'half' : undefined,
  });
}
