// Admin dashboard ("/admin/dashboard"). Shows only the current election's
// status; when there is no election yet, it redirects to the dedicated setup
// page ("/admin/setup-election"). Each status panel is its own function below
// so this file reads top-to-bottom as the election lifecycle itself:
// DraftOrScheduledPanel -> OpenElectionPanel -> ClosedElectionPanel
// (+ WinnerResolutionPanel, CancelElectionButton).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  API_BASE,
  adminLogout,
  adminRegisterVoter,
  clearDeclines,
  declineCandidacy,
  getAdminElection,
  getDeclaredResults,
  getResults,
  importFlats,
  listRegistrations,
  publishResults,
  revokeRegistration,
  scheduleElection,
  setElectionStatus,
} from '../api';
import Countdown from '../components/Countdown';
import InfoTooltip from '../components/InfoTooltip';
import { FLAT_CSV_TEMPLATE } from '../constants';
import { FLAT_NO_HINT, PHONE_HINT, isValidEmail, isValidFlatNo, isValidPhone } from '../validation';
import type { DeclaredResults, Election, FlatStatus, PositionResult, Turnout } from '../types';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [election, setElection] = useState<Election | null>(null);
  const [turnout, setTurnout] = useState<Turnout | null>(null);
  const [backend, setBackend] = useState('');
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getAdminElection();
      setElection(data.election);
      setTurnout(data.turnout);
      setBackend(data.activeBackend);
    } catch {
      navigate('/admin', { replace: true });
    } finally {
      setLoaded(true);
    }
  }, [navigate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (loaded && !election) {
      navigate('/admin/setup-election', { replace: true });
    }
  }, [loaded, election, navigate]);

  async function handleLogout() {
    await adminLogout().catch(() => undefined);
    navigate('/admin');
  }

  if (!loaded || !election) {
    return (
      <main className="page admin-page">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="page admin-page">
      <header className="admin-header">
        <h1>Election administration</h1>
        <button onClick={handleLogout}>Log out</button>
      </header>
      <p className="backend-badge">
        Storage backend: <strong>{backend}</strong>
      </p>

      {(election.status === 'draft' || election.status === 'scheduled') && (
        <DraftOrScheduledPanel election={election} turnout={turnout} onChanged={refresh} />
      )}
      {election.status === 'open' && (
        <OpenElectionPanel election={election} turnout={turnout} onChanged={refresh} />
      )}
      {(election.status === 'closed' || election.status === 'cancelled') && (
        <ClosedElectionPanel election={election} turnout={turnout} onChanged={refresh} />
      )}
    </main>
  );
}

function DraftOrScheduledPanel({
  election,
  turnout,
  onChanged,
}: {
  election: Election;
  turnout: Turnout | null;
  onChanged: () => void;
}) {
  const [opensAtLocal, setOpensAtLocal] = useState('');
  const [closesAtLocal, setClosesAtLocal] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleOpenNow() {
    setError(null);
    try {
      await setElectionStatus('open');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  async function handleSchedule(e: FormEvent) {
    e.preventDefault();
    if (!opensAtLocal) {
      setError('Choose a voting start date/time.');
      return;
    }
    setError(null);
    try {
      // datetime-local has no timezone; the browser's Date correctly treats it as local time.
      const opensIso = new Date(opensAtLocal).toISOString();
      const closesIso = closesAtLocal ? new Date(closesAtLocal).toISOString() : undefined;
      await scheduleElection(opensIso, closesIso);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  const hasRegistrations = (turnout?.registeredCount ?? 0) > 0;

  return (
    <section className="panel">
      <h2>
        {election.name} — {election.status === 'scheduled' ? 'scheduled' : 'draft'}
      </h2>
      <ul className="positions-summary">
        {election.positions.map((p) => (
          <li key={p.id}>
            <strong>{p.title}</strong> ({p.seats} seat{p.seats > 1 ? 's' : ''}):{' '}
            {p.candidates
              .filter((c) => !c.isNota)
              .map((c) => c.name)
              .join(', ')}
          </li>
        ))}
      </ul>

      <RegistrationsPanel onChanged={onChanged} />

      {election.status === 'scheduled' && election.opensAt && (
        <div className="panel countdown-panel">
          <p>Voting opens in:</p>
          <Countdown target={election.opensAt} onReached={onChanged} />
          <p className="hint">
            Opens at {new Date(election.opensAt).toLocaleString()}
            {election.closesAt ? `, closes at ${new Date(election.closesAt).toLocaleString()}` : ''}
          </p>
        </div>
      )}

      <form id="schedule-form" onSubmit={handleSchedule}>
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="opens-at">Voting opens at</label>
            <input
              id="opens-at"
              type="datetime-local"
              value={opensAtLocal}
              onChange={(e) => setOpensAtLocal(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label htmlFor="closes-at">Voting closes at (optional)</label>
            <input
              id="closes-at"
              type="datetime-local"
              value={closesAtLocal}
              onChange={(e) => setClosesAtLocal(e.target.value)}
            />
          </div>
        </div>
      </form>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <div className="button-row">
        <button type="submit" form="schedule-form" disabled={!hasRegistrations}>
          {election.status === 'scheduled' ? 'Update schedule' : 'Schedule voting'}
        </button>
        <button className="success" onClick={handleOpenNow} disabled={!hasRegistrations}>
          Open voting now
        </button>
        <CancelElectionButton onChanged={onChanged} />
      </div>
    </section>
  );
}

function OpenElectionPanel({
  election,
  turnout,
  onChanged,
}: {
  election: Election;
  turnout: Turnout | null;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleClose() {
    setError(null);
    try {
      await setElectionStatus('closed');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <section className="panel">
      <h2>{election.name} — voting is open</h2>
      <p className="warning">
        Do not change the STORAGE_BACKEND setting while voting is open. If a different backend is needed,
        cancel this election and start a new one instead.
      </p>
      {election.closesAt && (
        <p>
          Closes automatically in <Countdown target={election.closesAt} onReached={onChanged} /> (
          {new Date(election.closesAt).toLocaleString()})
        </p>
      )}
      <p>
        Turnout: {turnout?.votedCount ?? 0} voted, out of {turnout?.registeredCount ?? 0} registered
        ({turnout?.totalFlats ?? 0} eligible flats)
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="button-row">
        <button onClick={onChanged}>Refresh turnout</button>
        <button className="success" onClick={handleClose}>
          Close voting
        </button>
        <CancelElectionButton onChanged={onChanged} />
      </div>

      <RegistrationsPanel onChanged={onChanged} />
    </section>
  );
}

function ClosedElectionPanel({
  election,
  turnout,
  onChanged,
}: {
  election: Election;
  turnout: Turnout | null;
  onChanged: () => void;
}) {
  const [results, setResults] = useState<PositionResult[] | null>(null);
  const [declared, setDeclared] = useState<DeclaredResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const refreshDeclared = useCallback(() => {
    if (election.status !== 'closed') return;
    getDeclaredResults()
      .then((r) => setDeclared(r.declared))
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong.'));
  }, [election.status]);

  useEffect(() => {
    if (election.status !== 'closed') return;
    getResults()
      .then((r) => setResults(r.results))
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong.'));
    refreshDeclared();
  }, [election.status, refreshDeclared]);

  async function handlePublish() {
    setError(null);
    setPublishing(true);
    try {
      await publishResults();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPublishing(false);
    }
  }

  const winnerIds = new Set(
    declared?.positions.flatMap((p) => p.winners.map((w) => w.candidateId)) ?? [],
  );

  return (
    <section className="panel">
      <h2>
        {election.name} — {election.status === 'cancelled' ? 'cancelled' : 'closed'}
      </h2>
      <p>
        Turnout: {turnout?.votedCount ?? 0} voted, out of {turnout?.registeredCount ?? 0} registered
        ({turnout?.totalFlats ?? 0} eligible flats)
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {election.status === 'cancelled' && <p>This election was cancelled. No results are published.</p>}
      {declared && (declared.conflicts.length > 0 || declared.declinedCandidacies.length > 0) && (
        <WinnerResolutionPanel declared={declared} onChanged={refreshDeclared} />
      )}
      {results?.map((position) => (
        <div key={position.positionId} className="position-results">
          <h3>
            {position.title} ({position.seats} seat{position.seats > 1 ? 's' : ''})
          </h3>
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Votes</th>
              </tr>
            </thead>
            <tbody>
              {[...position.candidates]
                .sort((a, b) => b.votes - a.votes)
                .map((c) => (
                  <tr key={c.candidateId}>
                    <td>{winnerIds.has(c.candidateId) ? `🏆 ${c.name}` : c.name}</td>
                    <td>{c.votes}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
      {election.status === 'closed' && (
        <div className="publish-box">
          {election.resultsPublishedAt ? (
            <p>Results published to voters at {new Date(election.resultsPublishedAt).toLocaleString()}.</p>
          ) : (
            <>
              <button
                onClick={handlePublish}
                disabled={publishing || (declared?.conflicts.length ?? 0) > 0}
              >
                {publishing ? 'Publishing…' : 'Publish results to voters'}
              </button>
              {(declared?.conflicts.length ?? 0) > 0 && (
                <p className="hint">Resolve the winner conflict(s) above before publishing.</p>
              )}
            </>
          )}
        </div>
      )}
      <a href={`${API_BASE}/api/admin/export`}>Download audit CSV</a>
      <p>
        To run another election, <Link to="/admin/setup-election">set up a new one</Link> — this record is retained
        for audit.
      </p>
    </section>
  );
}

function WinnerResolutionPanel({ declared, onChanged }: { declared: DeclaredResults; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleKeep(conflict: DeclaredResults['conflicts'][number], keepPositionId: string) {
    setError(null);
    setLoading(true);
    try {
      for (const entry of conflict.entries) {
        if (entry.positionId !== keepPositionId) {
          await declineCandidacy(entry.positionId, entry.candidateId);
        }
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetDeclines() {
    if (!window.confirm('Clear all decline decisions and recompute winners from raw vote counts?')) return;
    setError(null);
    try {
      await clearDeclines();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  const hasVacancy = declared.positions.some((p) => p.vacantSeats > 0);

  return (
    <div className="panel conflict-panel">
      <h3>Winner resolution</h3>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {declared.conflicts.map((conflict) => (
        <div key={conflict.name} className="conflict-card">
          <p>
            <strong>{conflict.name}</strong> is the top vote-getter for {conflict.entries.length} positions:{' '}
            {conflict.entries.map((e) => e.positionTitle).join(', ')}. Which position do they take?
          </p>
          {conflict.entries.map((entry) => (
            <button key={entry.positionId} disabled={loading} onClick={() => handleKeep(conflict, entry.positionId)}>
              Keep {entry.positionTitle}
            </button>
          ))}
        </div>
      ))}
      {declared.declinedCandidacies.length > 0 && (
        <div className="declined-list">
          <p className="hint">Declined (promoted the runner-up in that position):</p>
          <ul>
            {declared.declinedCandidacies.map((d) => (
              <li key={`${d.positionId}-${d.candidateId}`}>
                {d.name} — {d.positionTitle}
              </li>
            ))}
          </ul>
          <button onClick={handleResetDeclines}>Reset all declines</button>
        </div>
      )}
      {hasVacancy && (
        <p className="warning">
          One or more positions have no eligible candidate left to fill a seat (vacant). Reset declines above if
          this wasn't intended.
        </p>
      )}
    </div>
  );
}

function RegistrationsPanel({ onChanged }: { onChanged: () => void }) {
  const [flats, setFlats] = useState<FlatStatus[] | null>(null);
  const [csv, setCsv] = useState(FLAT_CSV_TEMPLATE);
  const [registrationKeysCsv, setRegistrationKeysCsv] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assistFlatNo, setAssistFlatNo] = useState('');
  const [assistName, setAssistName] = useState('');
  const [assistPhone, setAssistPhone] = useState('');
  const [assistEmail, setAssistEmail] = useState('');
  const [assistError, setAssistError] = useState<string | null>(null);
  const [assistCode, setAssistCode] = useState<string | null>(null);
  const [assistLoading, setAssistLoading] = useState(false);

  const refreshFlats = useCallback(() => {
    listRegistrations()
      .then((r) => setFlats(r.flats))
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong.'));
  }, []);

  useEffect(() => {
    refreshFlats();
  }, [refreshFlats]);

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await importFlats(csv);
      setRegistrationKeysCsv(result.registrationKeysCsv);
      refreshFlats();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(registrationId: string) {
    if (!window.confirm("Revoke this registration? Their voting code will stop working immediately, and the flat can then be re-registered.")) {
      return;
    }
    setError(null);
    try {
      await revokeRegistration(registrationId);
      refreshFlats();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  async function handleAssistSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidFlatNo(assistFlatNo)) {
      setAssistError(`Enter a valid flat number. ${FLAT_NO_HINT}.`);
      return;
    }
    if (!isValidPhone(assistPhone)) {
      setAssistError(`Enter a valid phone number. ${PHONE_HINT}.`);
      return;
    }
    if (!isValidEmail(assistEmail)) {
      setAssistError('Enter a valid email address.');
      return;
    }
    setAssistError(null);
    setAssistCode(null);
    setAssistLoading(true);
    try {
      const result = await adminRegisterVoter(assistFlatNo, assistName, assistPhone, assistEmail);
      setAssistCode(result.code ?? null);
      setAssistFlatNo('');
      setAssistName('');
      setAssistPhone('');
      setAssistEmail('');
      refreshFlats();
      onChanged();
    } catch (err) {
      setAssistError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setAssistLoading(false);
    }
  }

  return (
    <div className="panel registrations-panel">
      <h3>Flats &amp; registrations</h3>

      <form onSubmit={handleImport}>
        <label htmlFor="flats-csv">Add eligible flats (one flat number per line, or a "flat_no" column)</label>
        <textarea id="flats-csv" rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} />
        <button type="submit" disabled={loading}>
          {loading ? 'Adding…' : 'Add flats'}
        </button>
      </form>

      {registrationKeysCsv && (
        <div className="credentials-output">
          <p>
            Registration keys generated. Post or share these per flat — anyone from that household can use the key
            to register (only the first person to register claims the flat's vote).
          </p>
          <a
            download="registration-keys.csv"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(registrationKeysCsv)}`}
          >
            Download registration-keys.csv
          </a>
        </div>
      )}

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {flats && flats.length > 0 && (
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Flat</th>
              <th>Voter</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Registered</th>
              <th>Voted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {flats.map((f) => (
              <tr key={f.flatId}>
                <td>{f.flatNo}</td>
                <td>{f.registration ? f.registration.voterName : <span className="hint">Not yet registered</span>}</td>
                <td>{f.registration?.voterPhone ?? ''}</td>
                <td>{f.registration?.voterEmail ?? ''}</td>
                <td>{f.registration ? new Date(f.registration.registeredAt).toLocaleString() : ''}</td>
                <td>{f.registration ? (f.registration.hasVoted ? 'Yes' : 'No') : ''}</td>
                <td>
                  {f.registration && (
                    <button
                      className="danger icon-button"
                      disabled={f.registration.hasVoted}
                      title={f.registration.hasVoted ? 'Cannot revoke — already voted' : 'Revoke this registration'}
                      aria-label="Revoke this registration"
                      onClick={() => handleRevoke(f.registration!.id)}
                    >
                      🗑
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <h4>Register someone on their behalf</h4>
      <form onSubmit={handleAssistSubmit}>
        <label htmlFor="assist-flat">
          Flat number<span className="required-mark">*</span> <InfoTooltip text={`${FLAT_NO_HINT}.`} />
        </label>
        <input id="assist-flat" value={assistFlatNo} onChange={(e) => setAssistFlatNo(e.target.value)} placeholder="e.g. C-201" required />
        <label htmlFor="assist-name">
          Name<span className="required-mark">*</span>
        </label>
        <input id="assist-name" value={assistName} onChange={(e) => setAssistName(e.target.value)} required />
        <label htmlFor="assist-phone">
          Phone<span className="required-mark">*</span> <InfoTooltip text={`${PHONE_HINT}.`} />
        </label>
        <input id="assist-phone" value={assistPhone} onChange={(e) => setAssistPhone(e.target.value)} placeholder="9876543210" required />
        <label htmlFor="assist-email">
          Email<span className="required-mark">*</span>
        </label>
        <input id="assist-email" type="email" value={assistEmail} onChange={(e) => setAssistEmail(e.target.value)} required />
        {assistError && (
          <p role="alert" className="error">
            {assistError}
          </p>
        )}
        <button type="submit" disabled={assistLoading}>
          {assistLoading ? 'Registering…' : 'Register'}
        </button>
      </form>
      {assistCode && (
        <div className="credentials-output">
          <p>Registered. Give this one-time voting code to the voter — it won't be shown again:</p>
          <p>
            <strong>{assistCode}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

function CancelElectionButton({ onChanged }: { onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!window.confirm('Cancel this election? Any votes cast so far will not count.')) return;
    setError(null);
    try {
      await setElectionStatus('cancelled');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="danger" onClick={handleCancel}>
        Cancel election
      </button>
    </>
  );
}
