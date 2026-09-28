// Thin fetch wrapper around the Worker's /api/* routes (proxied to it in dev
// by vite.config.ts). One function per endpoint; see worker/src/routes for
// the server-side handler each of these calls.
import type {
  BallotSelection,
  DeclaredResults,
  Election,
  FlatStatus,
  Position,
  PositionInput,
  PositionResult,
  PublicResults,
  Turnout,
} from './types';

// Empty in local dev (relative URL, same-origin through the Vite proxy in
// vite.config.ts); set to the deployed Worker's absolute origin in production
// builds (see .github/workflows/deploy-frontend.yml), since Pages and the
// Worker are served from different origins there.
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// Failures throw with the server's human-readable `reason`/`error` message,
// so callers only need a single try/catch rather than checking `ok` twice.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    // Required cross-origin so the admin session cookie is sent/stored —
    // harmless for the local same-origin dev proxy too.
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body as { ok?: boolean }).ok === false) {
    const message = (body as { reason?: string; error?: string }).reason
      ?? (body as { reason?: string; error?: string }).error
      ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}


export function getElectionPublicStatus() {
  return request<{
    election: { name: string; status: string; opensAt?: string; closesAt?: string } | null;
  }>('/election/status');
}

export function verifyVoterCode(code: string) {
  return request<{ election: { name: string; positions: Position[] } }>('/voter/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function castBallot(code: string, selections: BallotSelection[]) {
  return request<{ ballotIds: string[]; castAt: string }>('/voter/ballot', {
    method: 'POST',
    body: JSON.stringify({ code, selections }),
  });
}

export function adminLogin(password: string) {
  return request<Record<string, never>>('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function adminLogout() {
  return request<Record<string, never>>('/admin/logout', { method: 'POST' });
}

export function getAdminElection() {
  return request<{ election: Election | null; turnout: Turnout | null; activeBackend: string }>(
    '/admin/election',
  );
}

export function createElection(name: string, positions: PositionInput[]) {
  return request<{ election: Election }>('/admin/election', {
    method: 'POST',
    body: JSON.stringify({ name, positions }),
  });
}

export function scheduleElection(opensAt: string, closesAt?: string) {
  return request<{ election: Election }>('/admin/election/schedule', {
    method: 'POST',
    body: JSON.stringify({ opensAt, closesAt }),
  });
}

export function setElectionStatus(status: 'open' | 'closed' | 'cancelled') {
  return request<{ election: Election }>('/admin/election/status', {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export function importFlats(csv: string) {
  return request<{ count: number; registrationKeysCsv: string }>('/admin/flats', {
    method: 'POST',
    body: JSON.stringify({ csv }),
  });
}

export function listRegistrations() {
  return request<{ flats: FlatStatus[] }>('/admin/registrations');
}

export function adminRegisterVoter(flatNo: string, voterName: string, voterPhone: string, voterEmail: string) {
  return request<{ ok: boolean; reason?: string; code?: string }>('/admin/registrations', {
    method: 'POST',
    body: JSON.stringify({ flatNo, voterName, voterPhone, voterEmail }),
  });
}

export function revokeRegistration(registrationId: string) {
  return request<Record<string, never>>('/admin/registrations/revoke', {
    method: 'POST',
    body: JSON.stringify({ registrationId }),
  });
}

/** Public self-service registration — no admin session involved. */
export function registerVoter(
  flatNo: string,
  registrationKey: string,
  voterName: string,
  voterPhone: string,
  voterEmail: string,
) {
  return request<{ code: string }>('/voter/register', {
    method: 'POST',
    body: JSON.stringify({ flatNo, registrationKey, voterName, voterPhone, voterEmail }),
  });
}

export function getResults() {
  return request<{ results: PositionResult[] }>('/admin/results');
}

export function getDeclaredResults() {
  return request<{ declared: DeclaredResults }>('/admin/declared-results');
}

export function declineCandidacy(positionId: string, candidateId: string) {
  return request<{ declared: DeclaredResults }>('/admin/declared-results/decline', {
    method: 'POST',
    body: JSON.stringify({ positionId, candidateId }),
  });
}

export function clearDeclines() {
  return request<{ declared: DeclaredResults }>('/admin/declared-results/clear', { method: 'POST' });
}

export function publishResults() {
  return request<{ election: Election }>('/admin/results/publish', { method: 'POST' });
}

export function getPublicResults() {
  return request<{ results: PublicResults | null }>('/election/results');
}

