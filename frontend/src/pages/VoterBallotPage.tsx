// Ballot form ("/vote"). Requires the code/positions passed via router state
// from VoterLoginPage — a direct navigation or refresh here has no state, so
// it bounces back to "/" rather than trying to re-fetch (see the null check
// below). Renders each position as radios (seats=1) or capped checkboxes.
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { castBallot } from '../api';
import type { BallotSelection, Position } from '../types';

interface BallotState {
  code: string;
  electionName: string;
  positions: Position[];
}

export default function VoterBallotPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as BallotState | null;
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!state) {
    navigate('/', { replace: true });
    return null;
  }
  const { code, electionName, positions } = state;

  function toggleCandidate(positionId: string, candidateId: string, seats: number) {
    setSelections((prev) => {
      const current = prev[positionId] ?? [];
      if (seats === 1) return { ...prev, [positionId]: [candidateId] };
      if (current.includes(candidateId)) {
        return { ...prev, [positionId]: current.filter((id) => id !== candidateId) };
      }
      if (current.length >= seats) return prev; // at cap — checkbox is disabled anyway
      return { ...prev, [positionId]: [...current, candidateId] };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const missing = positions.find((p) => !(selections[p.id]?.length > 0));
    if (missing) {
      setError(`Please make a selection for "${missing.title}" (choose NOTA if you prefer).`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload: BallotSelection[] = positions.map((p) => ({
        positionId: p.id,
        candidateIds: selections[p.id] ?? [],
      }));
      const result = await castBallot(code, payload);
      navigate('/receipt', { state: { ballotIds: result.ballotIds, castAt: result.castAt } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page voter-page">
      <h1>{electionName}</h1>
      <p>Make a selection for every position, then submit. You can only vote once.</p>
      <form onSubmit={handleSubmit}>
        {positions.map((position) => {
          const current = selections[position.id] ?? [];
          return (
            <fieldset key={position.id} className="position-group">
              <legend>
                {position.title}
                {position.seats > 1 ? ` — select up to ${position.seats}` : ''}
              </legend>
              {position.candidates.map((c) => {
                const checked = current.includes(c.id);
                const atCap = position.seats > 1 && !checked && current.length >= position.seats;
                return (
                  <label key={c.id} className={`candidate-option${c.isNota ? ' nota-option' : ''}`}>
                    <input
                      type={position.seats === 1 ? 'radio' : 'checkbox'}
                      name={`position-${position.id}`}
                      checked={checked}
                      disabled={atCap}
                      onChange={() => toggleCandidate(position.id, c.id, position.seats)}
                    />
                    {c.name}
                  </label>
                );
              })}
            </fieldset>
          );
        })}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading}>
          {loading ? 'Submitting…' : 'Submit vote'}
        </button>
      </form>
    </main>
  );
}
