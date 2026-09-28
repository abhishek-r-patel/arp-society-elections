import type {
  BallotSelection,
  CastResult,
  DeclaredResults,
  Election,
  ElectionStatus,
  FlatStatus,
  IssuedRegistrationKey,
  Position,
  PositionDeclaredResult,
  PositionInput,
  PositionResult,
  PublicResults,
  RegisterResult,
  Turnout,
  VerifyResult,
  WinnerConflict,
} from '../types';
import { generateCredentialCode, hashCredential } from '../security';
import { csvCell } from '../csv';
import { ELECTION_STATUSES, MIN_SEATS_PER_POSITION, NOTA_CANDIDATE_NAME, STORAGE_BACKENDS } from '../constants';
import { StoreError, type ElectionStore } from './ElectionStore';

interface ElectionRow {
  id: string;
  name: string;
  status: ElectionStatus;
  created_at: string;
  opens_at: string | null;
  closes_at: string | null;
  results_published_at: string | null;
}

/** Cloudflare D1 (SQLite) implementation. Runs locally via `wrangler dev` / D1 local persistence. */
export class D1Store implements ElectionStore {
  constructor(
    private db: D1Database,
    private pepper: string,
  ) {}

  async getElection(): Promise<Election | null> {
    const row = await this.db
      .prepare('SELECT * FROM elections ORDER BY created_at DESC LIMIT 1')
      .first<ElectionRow>();
    if (!row) return null;
    const status = await this.applyScheduledTransition(row);
    const positions = await this.loadPositions(row.id);
    return {
      id: row.id,
      name: row.name,
      status,
      backend: STORAGE_BACKENDS.D1,
      positions,
      createdAt: row.created_at,
      opensAt: row.opens_at ?? undefined,
      closesAt: row.closes_at ?? undefined,
      resultsPublishedAt: row.results_published_at ?? undefined,
    };
  }

  /** Lazily flips scheduled->open->closed once the clock passes opens_at/closes_at, persisting the change. */
  private async applyScheduledTransition(row: ElectionRow): Promise<ElectionStatus> {
    const now = new Date().toISOString();
    let status = row.status;
    if (status === 'scheduled' && row.opens_at && row.opens_at <= now) {
      await this.db
        .prepare('UPDATE elections SET status = ?, opened_at = ? WHERE id = ?')
        .bind('open', now, row.id)
        .run();
      status = 'open';
    }
    if (status === 'open' && row.closes_at && row.closes_at <= now) {
      await this.db
        .prepare('UPDATE elections SET status = ?, closed_at = ? WHERE id = ?')
        .bind('closed', now, row.id)
        .run();
      status = 'closed';
    }
    return status;
  }

  private async loadPositions(electionId: string): Promise<Position[]> {
    const positionRows = await this.db
      .prepare('SELECT id, title, seats FROM positions WHERE election_id = ? ORDER BY sort_order')
      .bind(electionId)
      .all<{ id: string; title: string; seats: number }>();
    const candidateRows = await this.db
      .prepare(
        'SELECT id, position_id, name, is_nota FROM candidates WHERE election_id = ? ORDER BY sort_order',
      )
      .bind(electionId)
      .all<{ id: string; position_id: string; name: string; is_nota: number }>();
    return positionRows.results.map((position) => ({
      id: position.id,
      title: position.title,
      seats: position.seats,
      candidates: candidateRows.results
        .filter((c) => c.position_id === position.id)
        .map((c) => ({ id: c.id, name: c.name, isNota: !!c.is_nota })),
    }));
  }

  async createElection(name: string, positions: PositionInput[]): Promise<Election> {
    const existing = await this.getElection();
    if (existing && (existing.status === 'draft' || existing.status === 'scheduled' || existing.status === 'open')) {
      throw new StoreError('An election is already in progress. Close or cancel it first.');
    }
    // Validate everything before the first INSERT so a bad position never leaves behind an orphaned election row.
    if (positions.length === 0) throw new StoreError('Add at least one position.');
    for (const position of positions) {
      if (!position.title.trim()) throw new StoreError('Each position needs a title.');
      if (!Number.isInteger(position.seats) || position.seats < MIN_SEATS_PER_POSITION) {
        throw new StoreError(`Position "${position.title}" needs at least ${MIN_SEATS_PER_POSITION} seat.`);
      }
      if (position.candidateNames.length === 0) {
        throw new StoreError(`Position "${position.title}" needs at least one candidate.`);
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db
      .prepare('INSERT INTO elections (id, name, status, backend, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, name, ELECTION_STATUSES.DRAFT, STORAGE_BACKENDS.D1, now)
      .run();

    const stmts: D1PreparedStatement[] = [];
    positions.forEach((position, posIndex) => {
      const positionId = crypto.randomUUID();
      stmts.push(
        this.db
          .prepare('INSERT INTO positions (id, election_id, title, seats, sort_order) VALUES (?, ?, ?, ?, ?)')
          .bind(positionId, id, position.title.trim(), position.seats, posIndex),
      );
      position.candidateNames.forEach((candidateName, cIndex) => {
        stmts.push(
          this.db
            .prepare(
              'INSERT INTO candidates (id, election_id, position_id, name, is_nota, sort_order) VALUES (?, ?, ?, ?, 0, ?)',
            )
            .bind(crypto.randomUUID(), id, positionId, candidateName, cIndex),
        );
      });
      // Every position gets its own NOTA candidate row — it's per-position, not a single global option.
      stmts.push(
        this.db
          .prepare(
            'INSERT INTO candidates (id, election_id, position_id, name, is_nota, sort_order) VALUES (?, ?, ?, ?, 1, ?)',
          )
          .bind(crypto.randomUUID(), id, positionId, NOTA_CANDIDATE_NAME, position.candidateNames.length),
      );
    });
    await this.db.batch(stmts);
    return (await this.getElection())!;
  }

  async scheduleElection(opensAt: string, closesAt?: string): Promise<Election> {
    const election = await this.requireElection();
    if (election.status !== 'draft' && election.status !== 'scheduled') {
      throw new StoreError(`Cannot schedule an election in status "${election.status}".`);
    }
    const opensDate = new Date(opensAt);
    if (Number.isNaN(opensDate.getTime())) throw new StoreError('Invalid opening date/time.');
    let closesIso: string | null = null;
    if (closesAt) {
      const closesDate = new Date(closesAt);
      if (Number.isNaN(closesDate.getTime())) throw new StoreError('Invalid closing date/time.');
      if (closesDate <= opensDate) throw new StoreError('Closing time must be after opening time.');
      closesIso = closesDate.toISOString();
    }
    await this.db
      .prepare('UPDATE elections SET status = ?, opens_at = ?, closes_at = ? WHERE id = ?')
      .bind('scheduled', opensDate.toISOString(), closesIso, election.id)
      .run();
    return (await this.getElection())!;
  }

  async setElectionStatus(status: ElectionStatus): Promise<Election> {
    const election = await this.requireElection();
    if (status === 'open' && election.status !== 'draft' && election.status !== 'scheduled') {
      throw new StoreError(`Cannot open an election in status "${election.status}".`);
    }
    if (status === 'closed' && election.status !== 'open') {
      throw new StoreError(`Cannot close an election in status "${election.status}".`);
    }
    if (status === 'cancelled' && (election.status === 'closed' || election.status === 'cancelled')) {
      throw new StoreError(`Cannot cancel an election in status "${election.status}".`);
    }
    const timestampColumn = status === 'open' ? 'opened_at' : status === 'closed' ? 'closed_at' : null;
    if (timestampColumn) {
      await this.db
        .prepare(`UPDATE elections SET status = ?, ${timestampColumn} = ? WHERE id = ?`)
        .bind(status, new Date().toISOString(), election.id)
        .run();
    } else {
      await this.db.prepare('UPDATE elections SET status = ? WHERE id = ?').bind(status, election.id).run();
    }
    return (await this.getElection())!;
  }

  async importFlats(flatNumbers: string[]): Promise<IssuedRegistrationKey[]> {
    const election = await this.requireElection();
    if (election.status !== 'draft' && election.status !== 'scheduled') {
      throw new StoreError('Flats can only be imported before voting opens.');
    }
    const existing = await this.db
      .prepare('SELECT flat_no FROM flats WHERE election_id = ?')
      .bind(election.id)
      .all<{ flat_no: string }>();
    const existingSet = new Set(existing.results.map((r) => r.flat_no.toLowerCase()));
    const seen = new Set<string>();
    const issued: IssuedRegistrationKey[] = [];
    const stmts: D1PreparedStatement[] = [];
    for (const rawFlatNo of flatNumbers) {
      const flatNo = rawFlatNo.trim();
      const key = flatNo.toLowerCase();
      if (!flatNo || existingSet.has(key) || seen.has(key)) continue; // skip blanks/dupes/already-imported flats
      seen.add(key);
      const registrationKey = generateCredentialCode();
      const hash = await hashCredential(registrationKey, this.pepper);
      stmts.push(
        this.db
          .prepare(
            'INSERT INTO flats (id, election_id, flat_no, registration_key_hash, created_at) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(crypto.randomUUID(), election.id, flatNo, hash, new Date().toISOString()),
      );
      issued.push({ flatNo, registrationKey });
    }
    if (stmts.length > 0) await this.db.batch(stmts);
    return issued;
  }

  async registerVoter(
    flatNo: string,
    registrationKey: string,
    voterName: string,
    voterPhone: string,
    voterEmail: string,
  ): Promise<RegisterResult> {
    const election = await this.getElection();
    if (!election) return { ok: false, reason: 'No election has been set up yet.' };
    if (election.status === 'closed' || election.status === 'cancelled') {
      return { ok: false, reason: 'Registration is closed for this election.' };
    }
    const flat = await this.db
      .prepare('SELECT id, registration_key_hash FROM flats WHERE election_id = ? AND flat_no = ?')
      .bind(election.id, flatNo.trim())
      .first<{ id: string; registration_key_hash: string }>();
    if (!flat) return { ok: false, reason: 'Unknown flat number. Contact the election admin.' };
    const keyHash = await hashCredential(registrationKey, this.pepper);
    if (keyHash !== flat.registration_key_hash) {
      return { ok: false, reason: 'Incorrect registration key for this flat.' };
    }
    return this.createRegistration(election.id, flat.id, voterName, voterPhone, voterEmail);
  }

  async adminRegisterVoter(
    flatNo: string,
    voterName: string,
    voterPhone: string,
    voterEmail: string,
  ): Promise<RegisterResult> {
    const election = await this.requireElection();
    if (election.status === 'closed' || election.status === 'cancelled') {
      throw new StoreError('Registration is closed for this election.');
    }
    const flat = await this.db
      .prepare('SELECT id FROM flats WHERE election_id = ? AND flat_no = ?')
      .bind(election.id, flatNo.trim())
      .first<{ id: string }>();
    if (!flat) throw new StoreError('Unknown flat number.');
    const result = await this.createRegistration(election.id, flat.id, voterName, voterPhone, voterEmail);
    if (!result.ok) throw new StoreError(result.reason ?? 'Registration failed.');
    return result;
  }

  /** Shared by registerVoter/adminRegisterVoter once the flat itself has been resolved. */
  private async createRegistration(
    electionId: string,
    flatId: string,
    voterName: string,
    voterPhone: string,
    voterEmail: string,
  ): Promise<RegisterResult> {
    if (!voterName.trim()) return { ok: false, reason: 'Name is required.' };
    if (!voterPhone.trim()) return { ok: false, reason: 'Phone number is required.' };
    if (!voterEmail.trim()) return { ok: false, reason: 'Email is required.' };
    const existing = await this.db
      .prepare('SELECT 1 FROM registrations WHERE flat_id = ? AND revoked_at IS NULL')
      .bind(flatId)
      .first();
    if (existing) {
      return { ok: false, reason: 'This flat is already registered. Contact the election admin if this needs to change.' };
    }
    const code = generateCredentialCode();
    const hash = await hashCredential(code, this.pepper);
    try {
      await this.db
        .prepare(
          'INSERT INTO registrations (id, election_id, flat_id, voter_name, voter_phone, voter_email, credential_hash, has_voted, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
        )
        .bind(
          crypto.randomUUID(),
          electionId,
          flatId,
          voterName.trim(),
          voterPhone.trim(),
          voterEmail.trim(),
          hash,
          new Date().toISOString(),
        )
        .run();
    } catch {
      // Partial unique index closes the check-then-act race above: two people
      // registering the same flat at nearly the same moment can't both succeed.
      return { ok: false, reason: 'This flat is already registered. Contact the election admin if this needs to change.' };
    }
    return { ok: true, code };
  }

  async listRegistrations(): Promise<FlatStatus[]> {
    const election = await this.requireElection();
    const flats = await this.db
      .prepare('SELECT id, flat_no FROM flats WHERE election_id = ? ORDER BY flat_no')
      .bind(election.id)
      .all<{ id: string; flat_no: string }>();
    const registrations = await this.db
      .prepare(
        'SELECT id, flat_id, voter_name, voter_phone, voter_email, has_voted, voted_at, registered_at FROM registrations WHERE election_id = ? AND revoked_at IS NULL',
      )
      .bind(election.id)
      .all<{
        id: string;
        flat_id: string;
        voter_name: string;
        voter_phone: string;
        voter_email: string;
        has_voted: number;
        voted_at: string | null;
        registered_at: string;
      }>();
    return flats.results.map((flat) => {
      const r = registrations.results.find((row) => row.flat_id === flat.id);
      return {
        flatId: flat.id,
        flatNo: flat.flat_no,
        registration: r
          ? {
              id: r.id,
              flatNo: flat.flat_no,
              voterName: r.voter_name,
              voterPhone: r.voter_phone,
              voterEmail: r.voter_email,
              registeredAt: r.registered_at,
              hasVoted: !!r.has_voted,
              votedAt: r.voted_at ?? undefined,
            }
          : null,
      };
    });
  }

  async revokeRegistration(registrationId: string): Promise<void> {
    const election = await this.requireElection();
    const registration = await this.db
      .prepare('SELECT has_voted, revoked_at FROM registrations WHERE id = ? AND election_id = ?')
      .bind(registrationId, election.id)
      .first<{ has_voted: number; revoked_at: string | null }>();
    if (!registration) throw new StoreError('Unknown registration.');
    if (registration.revoked_at) throw new StoreError('This registration has already been revoked.');
    if (registration.has_voted) {
      throw new StoreError(
        'Cannot revoke a registration that has already voted \u2014 doing so would let this flat vote twice.',
      );
    }
    await this.db
      .prepare('UPDATE registrations SET revoked_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), registrationId)
      .run();
  }

  async verifyCredential(code: string): Promise<VerifyResult> {
    const election = await this.getElection();
    if (!election) return { ok: false, reason: 'No election has been set up yet.' };
    if (election.status === 'scheduled') {
      return { ok: false, reason: `Voting has not opened yet. Opens at ${election.opensAt}.` };
    }
    if (election.status !== 'open') {
      return { ok: false, reason: `Voting is not currently open (status: ${election.status}).` };
    }
    const hash = await hashCredential(code, this.pepper);
    const registration = await this.db
      .prepare('SELECT has_voted FROM registrations WHERE election_id = ? AND credential_hash = ? AND revoked_at IS NULL')
      .bind(election.id, hash)
      .first<{ has_voted: number }>();
    if (!registration) return { ok: false, reason: 'Invalid voting code.' };
    if (registration.has_voted) return { ok: false, reason: 'This voting code has already been used.' };
    return { ok: true, election: { name: election.name, positions: election.positions } };
  }

  async castBallot(code: string, selections: BallotSelection[]): Promise<CastResult> {
    const election = await this.getElection();
    if (!election) return { ok: false, reason: 'No election has been set up yet.' };
    if (election.status !== 'open') return { ok: false, reason: 'Voting is not currently open.' };

    const validation = validateSelections(election.positions, selections);
    if (validation) return { ok: false, reason: validation };

    const hash = await hashCredential(code, this.pepper);
    // Atomic guard: this UPDATE only affects a row if has_voted was still 0 and
    // the registration isn't revoked, so concurrent duplicate submissions (or a
    // vote racing a revoke) for the same credential cannot both succeed.
    const update = await this.db
      .prepare(
        'UPDATE registrations SET has_voted = 1, voted_at = ? WHERE election_id = ? AND credential_hash = ? AND has_voted = 0 AND revoked_at IS NULL',
      )
      .bind(new Date().toISOString(), election.id, hash)
      .run();
    if (!update.meta.changes) {
      const stillExists = await this.db
        .prepare('SELECT 1 FROM registrations WHERE election_id = ? AND credential_hash = ? AND revoked_at IS NULL')
        .bind(election.id, hash)
        .first();
      return { ok: false, reason: stillExists ? 'This voting code has already been used.' : 'Invalid voting code.' };
    }

    const castAt = new Date().toISOString();
    const ballotIds: string[] = [];
    const stmts = selections.flatMap((selection) =>
      selection.candidateIds.map((candidateId) => {
        const ballotId = crypto.randomUUID();
        ballotIds.push(ballotId);
        return this.db
          .prepare('INSERT INTO ballots (id, election_id, position_id, candidate_id, cast_at) VALUES (?, ?, ?, ?, ?)')
          .bind(ballotId, election.id, selection.positionId, candidateId, castAt);
      }),
    );
    await this.db.batch(stmts);
    return { ok: true, ballotIds, castAt };
  }

  async getTurnout(): Promise<Turnout> {
    const election = await this.requireElection();
    const flatRow = await this.db
      .prepare('SELECT COUNT(*) as total FROM flats WHERE election_id = ?')
      .bind(election.id)
      .first<{ total: number }>();
    const regRow = await this.db
      .prepare(
        'SELECT COUNT(*) as registered, SUM(has_voted) as voted FROM registrations WHERE election_id = ? AND revoked_at IS NULL',
      )
      .bind(election.id)
      .first<{ registered: number; voted: number | null }>();
    return {
      totalFlats: flatRow?.total ?? 0,
      registeredCount: regRow?.registered ?? 0,
      votedCount: regRow?.voted ?? 0,
    };
  }

  async getResults(): Promise<PositionResult[]> {
    const election = await this.requireElection();
    if (election.status !== 'closed' && election.status !== 'cancelled') {
      throw new StoreError('Results are only available once the election is closed.');
    }
    const rows = await this.db
      .prepare(
        `SELECT c.id as candidateId, c.position_id as positionId, c.name as name, c.is_nota as isNota, COUNT(b.id) as votes
         FROM candidates c LEFT JOIN ballots b ON b.candidate_id = c.id
         WHERE c.election_id = ? GROUP BY c.id ORDER BY c.sort_order`,
      )
      .bind(election.id)
      .all<{ candidateId: string; positionId: string; name: string; isNota: number; votes: number }>();
    return election.positions.map((position) => ({
      positionId: position.id,
      title: position.title,
      seats: position.seats,
      candidates: rows.results
        .filter((r) => r.positionId === position.id)
        .map((r) => ({ candidateId: r.candidateId, name: r.name, isNota: !!r.isNota, votes: r.votes })),
    }));
  }

  async getDeclaredResults(): Promise<DeclaredResults> {
    const election = await this.requireElection();
    if (election.status !== 'closed' && election.status !== 'cancelled') {
      throw new StoreError('Results are only available once the election is closed.');
    }
    const rawResults = await this.getResults();
    const declinedIds = await this.loadDeclinedIds(election.id);
    return buildDeclaredResults(rawResults, declinedIds);
  }

  async declineCandidacy(positionId: string, candidateId: string): Promise<DeclaredResults> {
    const election = await this.requireElection();
    if (election.status !== 'closed' && election.status !== 'cancelled') {
      throw new StoreError('Winners can only be resolved once the election is closed.');
    }
    const position = election.positions.find((p) => p.id === positionId);
    const candidate = position?.candidates.find((c) => c.id === candidateId);
    if (!position || !candidate) throw new StoreError('Unknown position or candidate.');
    if (candidate.isNota) throw new StoreError('NOTA cannot be declined.');
    await this.db
      .prepare(
        'INSERT OR IGNORE INTO declined_candidacies (id, election_id, position_id, candidate_id, declined_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(crypto.randomUUID(), election.id, positionId, candidateId, new Date().toISOString())
      .run();
    return this.getDeclaredResults();
  }

  async clearDeclines(): Promise<DeclaredResults> {
    const election = await this.requireElection();
    await this.db.prepare('DELETE FROM declined_candidacies WHERE election_id = ?').bind(election.id).run();
    return this.getDeclaredResults();
  }

  async publishResults(): Promise<Election> {
    const election = await this.requireElection();
    if (election.status !== 'closed') {
      throw new StoreError('Only a closed election\u2019s results can be published.');
    }
    const declared = await this.getDeclaredResults();
    if (declared.conflicts.length > 0) {
      throw new StoreError('Resolve all winner conflicts before publishing results.');
    }
    await this.db
      .prepare('UPDATE elections SET results_published_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), election.id)
      .run();
    return (await this.getElection())!;
  }

  async getPublicResults(): Promise<PublicResults | null> {
    const election = await this.getElection();
    if (!election || election.status !== 'closed' || !election.resultsPublishedAt) return null;
    const declared = await this.getDeclaredResults();
    const turnout = await this.getTurnout();
    return {
      name: election.name,
      publishedAt: election.resultsPublishedAt,
      turnout,
      positions: declared.positions,
    };
  }

  private async loadDeclinedIds(electionId: string): Promise<Set<string>> {
    const rows = await this.db
      .prepare('SELECT candidate_id FROM declined_candidacies WHERE election_id = ?')
      .bind(electionId)
      .all<{ candidate_id: string }>();
    return new Set(rows.results.map((r) => r.candidate_id));
  }

  async exportAudit(): Promise<string> {
    const election = await this.requireElection();
    const rows = await this.db
      .prepare(
        `SELECT f.flat_no as flat_no, r.voter_name as voter_name, r.voter_phone as voter_phone,
                r.voter_email as voter_email, r.has_voted as has_voted, r.voted_at as voted_at,
                r.revoked_at as revoked_at
         FROM flats f LEFT JOIN registrations r ON r.flat_id = f.id AND r.revoked_at IS NULL
         WHERE f.election_id = ? ORDER BY f.flat_no`,
      )
      .bind(election.id)
      .all<{
        flat_no: string;
        voter_name: string | null;
        voter_phone: string | null;
        voter_email: string | null;
        has_voted: number | null;
        voted_at: string | null;
        revoked_at: string | null;
      }>();
    const isFinal = election.status === 'closed' || election.status === 'cancelled';
    const results = isFinal ? await this.getResults() : [];
    const declared = isFinal ? await this.getDeclaredResults() : null;

    const lines = ['section,flat_no,voter_name,voter_phone,voter_email,has_voted,voted_at'];
    for (const r of rows.results) {
      lines.push(
        `attendance,${csvCell(r.flat_no)},${csvCell(r.voter_name ?? '')},${csvCell(r.voter_phone ?? '')},${csvCell(r.voter_email ?? '')},${r.has_voted ? 'yes' : 'no'},${csvCell(r.voted_at ?? '')}`,
      );
    }
    lines.push('');
    lines.push('section,position,candidate,votes');
    for (const position of results) {
      for (const c of position.candidates) {
        lines.push(`results,${csvCell(position.title)},${csvCell(c.name)},${c.votes}`);
      }
    }
    if (declared) {
      lines.push('');
      lines.push('section,position,declared_winner,votes');
      for (const position of declared.positions) {
        if (position.winners.length === 0) {
          lines.push(`declared,${csvCell(position.title)},VACANT,0`);
        } else {
          for (const w of position.winners) {
            lines.push(`declared,${csvCell(position.title)},${csvCell(w.name)},${w.votes}`);
          }
        }
      }
      if (declared.conflicts.length > 0) {
        lines.push('');
        lines.push('section,note');
        for (const c of declared.conflicts) {
          const positionsList = c.entries.map((e) => e.positionTitle).join(' and ');
          lines.push(`unresolved_conflict,${csvCell(`${c.name} is the top vote-getter in multiple positions: ${positionsList}`)}`);
        }
      }
    }
    return lines.join('\n');
  }

  private async requireElection(): Promise<Election> {
    const election = await this.getElection();
    if (!election) throw new StoreError('No election has been set up yet.');
    return election;
  }
}

/** Shared between D1 and Google Sheet stores so both enforce identical ballot rules. */
export function validateSelections(positions: Position[], selections: BallotSelection[]): string | null {
  if (selections.length !== positions.length) return 'Please make a selection for every position.';
  for (const position of positions) {
    const selection = selections.find((s) => s.positionId === position.id);
    if (!selection) return `Missing selection for "${position.title}".`;
    const { candidateIds } = selection;
    if (candidateIds.length === 0) return `Please choose at least one option for "${position.title}".`;
    if (candidateIds.length > position.seats) {
      return `"${position.title}" allows at most ${position.seats} selection(s).`;
    }
    if (new Set(candidateIds).size !== candidateIds.length) {
      return `Duplicate selection for "${position.title}".`;
    }
    for (const candidateId of candidateIds) {
      if (!position.candidates.some((c) => c.id === candidateId)) {
        return `Invalid candidate selection for "${position.title}".`;
      }
    }
  }
  return null;
}

/**
 * Turns raw vote counts into declared per-position winners plus cross-position
 * conflicts (same name topping the count in 2+ positions). Shared with
 * apps-script/Code.gs's mirrored `buildDeclaredResults_` — keep both in sync.
 */
export function buildDeclaredResults(rawResults: PositionResult[], declinedIds: Set<string>): DeclaredResults {
  const declinedCandidacies: DeclaredResults['declinedCandidacies'] = [];
  const positions: PositionDeclaredResult[] = rawResults.map((position) => {
    const eligible = position.candidates
      .filter((c) => !c.isNota && !declinedIds.has(c.candidateId))
      .sort((a, b) => b.votes - a.votes);
    const winners = eligible
      .slice(0, position.seats)
      .map((c) => ({ candidateId: c.candidateId, name: c.name, votes: c.votes }));
    for (const c of position.candidates) {
      if (declinedIds.has(c.candidateId)) {
        declinedCandidacies.push({
          positionId: position.positionId,
          positionTitle: position.title,
          candidateId: c.candidateId,
          name: c.name,
        });
      }
    }
    return { ...position, winners, vacantSeats: position.seats - winners.length };
  });

  const byName = new Map<string, WinnerConflict['entries']>();
  for (const position of positions) {
    for (const winner of position.winners) {
      const key = winner.name.trim().toLowerCase();
      const entries = byName.get(key) ?? [];
      entries.push({
        positionId: position.positionId,
        positionTitle: position.title,
        candidateId: winner.candidateId,
        votes: winner.votes,
      });
      byName.set(key, entries);
    }
  }
  const conflicts: WinnerConflict[] = [];
  for (const entries of byName.values()) {
    if (new Set(entries.map((e) => e.positionId)).size > 1) {
      conflicts.push({ name: findOriginalName(positions, entries[0].candidateId), entries });
    }
  }
  return { positions, conflicts, declinedCandidacies };
}

function findOriginalName(positions: PositionDeclaredResult[], candidateId: string): string {
  for (const position of positions) {
    const winner = position.winners.find((w) => w.candidateId === candidateId);
    if (winner) return winner.name;
  }
  return '';
}
