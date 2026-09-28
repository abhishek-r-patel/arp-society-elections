// Admin endpoints. Every route except login/logout requires a valid signed
// session cookie (see security.ts's createAdminSession/verifyAdminSession) —
// there is no separate per-route permission model, one admin session can do
// everything below.
import type { Env, ElectionStatus, PositionInput } from '../types';
import { createStore } from '../store';
import { StoreError } from '../store/ElectionStore';
import { json, readJson, getCookie } from '../http';
import { createAdminSession, verifyAdminPassword, verifyAdminSession } from '../security';
import { parseFlatsCsv, csvCell } from '../csv';
import { ADMIN_SESSION_COOKIE_NAME, ELECTION_STATUSES, FLAT_CSV_HEADERS, REGISTRATION_KEY_CSV_HEADERS } from '../constants';

const SESSION_COOKIE = ADMIN_SESSION_COOKIE_NAME;

export async function handleAdminRequest(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === '/api/admin/login' && request.method === 'POST') {
    const body = await readJson<{ password?: string }>(request);
    if (!body.password || !(await verifyAdminPassword(body.password, env.ADMIN_PASSWORD_HASH))) {
      return json({ ok: false, reason: 'Incorrect password.' }, { status: 401 });
    }
    const token = await createAdminSession(env.ADMIN_SESSION_SECRET);
    const secure = url.protocol === 'https:' ? '; Secure' : '';
    return json(
      { ok: true },
      { headers: { 'set-cookie': `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax${secure}` } },
    );
  }

  if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
    return json({ ok: true }, { headers: { 'set-cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0` } });
  }

  const authed = await verifyAdminSession(env.ADMIN_SESSION_SECRET, getCookie(request, SESSION_COOKIE));
  if (!authed) return json({ ok: false, reason: 'Admin session required.' }, { status: 401 });

  const store = createStore(env);

  try {
    if (url.pathname === '/api/admin/me' && request.method === 'GET') {
      return json({ ok: true });
    }

    if (url.pathname === '/api/admin/election' && request.method === 'GET') {
      const election = await store.getElection();
      const turnout = election ? await store.getTurnout() : null;
      return json({ ok: true, election, turnout, activeBackend: env.STORAGE_BACKEND });
    }

    if (url.pathname === '/api/admin/election' && request.method === 'POST') {
      const body = await readJson<{ name?: string; positions?: PositionInput[] }>(request);
      if (!body.name?.trim() || !Array.isArray(body.positions) || body.positions.length === 0) {
        return json({ ok: false, reason: 'Provide an election name and at least one position.' }, { status: 400 });
      }
      const election = await store.createElection(body.name.trim(), body.positions);
      return json({ ok: true, election });
    }

    if (url.pathname === '/api/admin/election/schedule' && request.method === 'POST') {
      const body = await readJson<{ opensAt?: string; closesAt?: string }>(request);
      if (!body.opensAt) return json({ ok: false, reason: 'Provide a voting opening date/time.' }, { status: 400 });
      const election = await store.scheduleElection(body.opensAt, body.closesAt);
      return json({ ok: true, election });
    }

    if (url.pathname === '/api/admin/election/status' && request.method === 'POST') {
      const body = await readJson<{ status?: ElectionStatus }>(request);
      const allowedStatuses: ElectionStatus[] = [
        ELECTION_STATUSES.OPEN,
        ELECTION_STATUSES.CLOSED,
        ELECTION_STATUSES.CANCELLED,
      ];
      if (!body.status || !allowedStatuses.includes(body.status)) {
        return json({ ok: false, reason: 'Invalid status.' }, { status: 400 });
      }
      const election = await store.setElectionStatus(body.status);
      return json({ ok: true, election });
    }

    if (url.pathname === '/api/admin/flats' && request.method === 'POST') {
      const body = await readJson<{ csv?: string }>(request);
      if (!body.csv?.trim()) return json({ ok: false, reason: 'Provide a list of flat numbers.' }, { status: 400 });
      const flatNumbers = parseFlatsCsv(body.csv);
      if (flatNumbers.length === 0) {
        return json(
          { ok: false, reason: `No valid rows found. Expected a column named ${FLAT_CSV_HEADERS.FLAT_NO}.` },
          { status: 400 },
        );
      }
      const issued = await store.importFlats(flatNumbers);
      const registrationKeysCsv = [
        `${REGISTRATION_KEY_CSV_HEADERS.FLAT_NO},${REGISTRATION_KEY_CSV_HEADERS.REGISTRATION_KEY}`,
        ...issued.map((i) => `${csvCell(i.flatNo)},${i.registrationKey}`),
      ].join('\n');
      return json({ ok: true, count: issued.length, registrationKeysCsv });
    }

    if (url.pathname === '/api/admin/registrations' && request.method === 'GET') {
      return json({ ok: true, flats: await store.listRegistrations() });
    }

    if (url.pathname === '/api/admin/registrations' && request.method === 'POST') {
      const body = await readJson<{ flatNo?: string; voterName?: string; voterPhone?: string; voterEmail?: string }>(
        request,
      );
      if (!body.flatNo?.trim() || !body.voterName?.trim() || !body.voterPhone?.trim() || !body.voterEmail?.trim()) {
        return json({ ok: false, reason: 'Provide flat number, name, phone, and email.' }, { status: 400 });
      }
      const result = await store.adminRegisterVoter(body.flatNo, body.voterName, body.voterPhone, body.voterEmail);
      return json(result);
    }

    if (url.pathname === '/api/admin/registrations/revoke' && request.method === 'POST') {
      const body = await readJson<{ registrationId?: string }>(request);
      if (!body.registrationId) return json({ ok: false, reason: 'Provide registrationId.' }, { status: 400 });
      await store.revokeRegistration(body.registrationId);
      return json({ ok: true });
    }

    if (url.pathname === '/api/admin/turnout' && request.method === 'GET') {
      return json({ ok: true, turnout: await store.getTurnout() });
    }

    if (url.pathname === '/api/admin/results' && request.method === 'GET') {
      return json({ ok: true, results: await store.getResults() });
    }

    if (url.pathname === '/api/admin/declared-results' && request.method === 'GET') {
      return json({ ok: true, declared: await store.getDeclaredResults() });
    }

    if (url.pathname === '/api/admin/declared-results/decline' && request.method === 'POST') {
      const body = await readJson<{ positionId?: string; candidateId?: string }>(request);
      if (!body.positionId || !body.candidateId) {
        return json({ ok: false, reason: 'Provide positionId and candidateId.' }, { status: 400 });
      }
      const declared = await store.declineCandidacy(body.positionId, body.candidateId);
      return json({ ok: true, declared });
    }

    if (url.pathname === '/api/admin/declared-results/clear' && request.method === 'POST') {
      const declared = await store.clearDeclines();
      return json({ ok: true, declared });
    }

    if (url.pathname === '/api/admin/results/publish' && request.method === 'POST') {
      const election = await store.publishResults();
      return json({ ok: true, election });
    }

    if (url.pathname === '/api/admin/export' && request.method === 'GET') {
      const csvText = await store.exportAudit();
      return new Response(csvText, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="election-audit.csv"',
        },
      });
    }
  } catch (err) {
    if (err instanceof StoreError) return json({ ok: false, reason: err.message }, { status: 400 });
    throw err;
  }

  return json({ ok: false, reason: 'Not found' }, { status: 404 });
}
