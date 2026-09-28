// Worker entrypoint: dispatches each request to the voter (public) or admin
// (session-cookie-gated) route module by path prefix, and turns any thrown
// error into a JSON 500 so callers always get a parseable response.
// NB: matching is by prefix, not exact path — a new public route under
// /api/election/* or /api/voter/* needs no dispatcher change, but a route
// under a new top-level prefix does (see the /api/election/results bug fixed
// earlier, where an exact-match check missed the new path).
//
// CORS: the frontend (Pages) and this Worker are served from different
// origins in production, so every response needs CORS headers, and browsers
// send a preflight OPTIONS request before the real one for the admin
// cookie-carrying calls — both are handled here, once, rather than in each
// route module.
import type { Env } from './types';
import { handleVoterRequest } from './routes/voter';
import { handleAdminRequest } from './routes/admin';
import { json, corsHeaders } from './http';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    let response: Response;
    try {
      if (url.pathname.startsWith('/api/election/') || url.pathname.startsWith('/api/voter/')) {
        response = await handleVoterRequest(request, env, url);
      } else if (url.pathname.startsWith('/api/admin/')) {
        response = await handleAdminRequest(request, env, url);
      } else {
        response = json({ ok: false, reason: 'Not found' }, { status: 404 });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected server error';
      response = json({ ok: false, reason: message }, { status: 500 });
    }
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  },
};
