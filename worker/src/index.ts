// Worker entrypoint: dispatches each request to the voter (public) or admin
// (session-cookie-gated) route module by path prefix, and turns any thrown
// error into a JSON 500 so callers always get a parseable response.
// NB: matching is by prefix, not exact path — a new public route under
// /api/election/* or /api/voter/* needs no dispatcher change, but a route
// under a new top-level prefix does (see the /api/election/results bug fixed
// earlier, where an exact-match check missed the new path).
import type { Env } from './types';
import { handleVoterRequest } from './routes/voter';
import { handleAdminRequest } from './routes/admin';
import { json } from './http';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/election/') || url.pathname.startsWith('/api/voter/')) {
        return await handleVoterRequest(request, env, url);
      }
      if (url.pathname.startsWith('/api/admin/')) {
        return await handleAdminRequest(request, env, url);
      }
      return json({ ok: false, reason: 'Not found' }, { status: 404 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected server error';
      return json({ ok: false, reason: message }, { status: 500 });
    }
  },
};
