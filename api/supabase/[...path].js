import { handleSupabaseProxy } from '../../server/supabaseProxy.js';
import { handleNodeRequest } from '../../server/nodeAdapter.js';
import { Buffer } from 'node:buffer';

export default async function handler(req, res) {
  const response = await handleSupabaseProxy(await handleNodeRequest(req));
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export const config = {
  api: {
    bodyParser: false,
  },
};
