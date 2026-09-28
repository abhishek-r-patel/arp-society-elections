// Public, unauthenticated endpoints: election status/results lookup and the
// voter verify/ballot flow. No admin session is required or checked here.
import type { BallotSelection, Env } from '../types';
import { createStore } from '../store';
import { StoreError } from '../store/ElectionStore';
import { json, readJson } from '../http';

export async function handleVoterRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const store = createStore(env);

  if (url.pathname === '/api/election/status' && request.method === 'GET') {
    const election = await store.getElection();
    return json({
      ok: true,
      election: election
        ? { name: election.name, status: election.status, opensAt: election.opensAt, closesAt: election.closesAt }
        : null,
    });
  }

  if (url.pathname === '/api/election/results' && request.method === 'GET') {
    return json({ ok: true, results: await store.getPublicResults() });
  }

  if (url.pathname === '/api/voter/register' && request.method === 'POST') {
    const body = await readJson<{
      flatNo?: string;
      registrationKey?: string;
      voterName?: string;
      voterPhone?: string;
      voterEmail?: string;
    }>(request);
    if (
      !body.flatNo?.trim() ||
      !body.registrationKey?.trim() ||
      !body.voterName?.trim() ||
      !body.voterPhone?.trim() ||
      !body.voterEmail?.trim()
    ) {
      return json({ ok: false, reason: 'Provide flat number, registration key, name, phone, and email.' }, { status: 400 });
    }
    try {
      const result = await store.registerVoter(
        body.flatNo,
        body.registrationKey,
        body.voterName,
        body.voterPhone,
        body.voterEmail,
      );
      return json(result, { status: result.ok ? 200 : 409 });
    } catch (err) {
      return storeErrorResponse(err);
    }
  }

  if (url.pathname === '/api/voter/verify' && request.method === 'POST') {
    const body = await readJson<{ code?: string }>(request);
    const code = normalizeCode(body.code);
    if (!code) return json({ ok: false, reason: 'Enter your voting code.' }, { status: 400 });
    try {
      const result = await store.verifyCredential(code);
      return json(result, { status: result.ok ? 200 : 401 });
    } catch (err) {
      return storeErrorResponse(err);
    }
  }

  if (url.pathname === '/api/voter/ballot' && request.method === 'POST') {
    const body = await readJson<{ code?: string; selections?: BallotSelection[] }>(request);
    const code = normalizeCode(body.code);
    if (!code || !Array.isArray(body.selections) || body.selections.length === 0) {
      return json({ ok: false, reason: 'Missing code or candidate selections.' }, { status: 400 });
    }
    try {
      const result = await store.castBallot(code, body.selections);
      return json(result, { status: result.ok ? 200 : 409 });
    } catch (err) {
      return storeErrorResponse(err);
    }
  }

  return json({ ok: false, reason: 'Not found' }, { status: 404 });
}


function normalizeCode(code: string | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

function storeErrorResponse(err: unknown): Response {
  if (err instanceof StoreError) return json({ ok: false, reason: err.message }, { status: 400 });
  throw err;
}
