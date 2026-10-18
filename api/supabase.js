import { handleSupabaseProxy } from '../server/supabaseProxy.js';

const API_ROLE_PARAM = '__kainhub_role';
const API_PATH_PARAM = '__kainhub_path';

export default {
  async fetch(request) {
    try {
      const requestUrl = new URL(request.url);
      const role = requestUrl.searchParams.get(API_ROLE_PARAM);
      const apiPath = requestUrl.searchParams.get(API_PATH_PARAM);
      if (!['admin', 'vendor', 'customer'].includes(role) || !apiPath) {
        return Response.json({ error: 'Unsupported Supabase proxy path.' }, { status: 404 });
      }

      requestUrl.pathname = `/api/supabase/${role}/${apiPath.replace(/^\/+/, '')}`;
      requestUrl.searchParams.delete(API_ROLE_PARAM);
      requestUrl.searchParams.delete(API_PATH_PARAM);

      const init = {
        method: request.method,
        headers: request.headers,
        signal: request.signal,
      };
      if (!['GET', 'HEAD'].includes(request.method)) {
        init.body = await request.arrayBuffer();
      }

      return await handleSupabaseProxy(new Request(requestUrl, init));
    } catch (error) {
      console.error('[bff] Supabase function request failed:', error);
      return Response.json({ error: 'The Supabase proxy request failed.' }, {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  },
};
