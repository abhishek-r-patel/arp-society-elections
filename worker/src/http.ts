// Small HTTP helpers shared by both route modules: consistent JSON responses,
// a JSON body parser that throws a user-facing error on malformed input, and
// cookie reading (used for the admin session cookie).
export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json<T>();
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  const match = header
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * The frontend and Worker are deployed to different origins (Pages vs
 * Workers subdomains, or a custom domain proxying both) — see index.ts,
 * which adds these headers to every response and answers preflight OPTIONS
 * requests. Credentials mode requires an exact origin, never "*".
 */
export function corsHeaders(allowedOrigin: string): HeadersInit {
  return {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  };
}
