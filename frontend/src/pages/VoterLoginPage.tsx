// Voter entry point ("/"). Shows a live countdown while the election is
// scheduled, verifies the voting code, then hands off to /vote via router
// location state (code + positions) — nothing is persisted to storage.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getElectionPublicStatus, verifyVoterCode } from '../api';
import Countdown from '../components/Countdown';
import { SITE_TITLE } from '../constants';

interface PublicElection {
  name: string;
  status: string;
  opensAt?: string;
  closesAt?: string;
}

export default function VoterLoginPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publicElection, setPublicElection] = useState<PublicElection | null | undefined>(undefined);
  const navigate = useNavigate();

  const refreshStatus = useCallback(() => {
    getElectionPublicStatus()
      .then((data) => setPublicElection(data.election))
      .catch(() => setPublicElection(null));
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { election } = await verifyVoterCode(code);
      navigate('/vote', {
        state: { code: code.trim().toUpperCase(), electionName: election.name, positions: election.positions },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const votingIsOpen = publicElection?.status === 'open';

  return (
    <main className="page voter-page">
      <h1>{SITE_TITLE}</h1>

      {publicElection === null && <p>No election is currently set up.</p>}

      {publicElection && publicElection.status === 'scheduled' && publicElection.opensAt && (
        <div className="panel countdown-panel">
          <h2>{publicElection.name}</h2>
          <p>Voting opens in:</p>
          <Countdown target={publicElection.opensAt} onReached={refreshStatus} />
        </div>
      )}

      {publicElection && (publicElection.status === 'closed' || publicElection.status === 'cancelled') && (
        <p>
          Voting for {publicElection.name} is no longer open.{' '}
          {publicElection.status === 'closed' && <Link to="/results">View results</Link>}
        </p>
      )}

      {publicElection && votingIsOpen && <h2>{publicElection.name}</h2>}

      <p>Enter the voting code you were given to cast your ballot.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="code">Voting code</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. 7K4M-9PQR"
          autoComplete="off"
          autoFocus
          required
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading || !votingIsOpen}>
          {loading ? 'Checking…' : 'Continue'}
        </button>
      </form>
      {publicElection && (publicElection.status === 'draft' || publicElection.status === 'scheduled' || publicElection.status === 'open') && (
        <p>
          <Link to="/register">Not registered yet? Register your flat</Link>
        </p>
      )}
      <p className="admin-link">
        <Link to="/admin">Election administrator?</Link>
      </p>
    </main>
  );
}
