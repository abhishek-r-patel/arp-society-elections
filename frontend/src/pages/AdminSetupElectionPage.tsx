// Election setup ("/admin/setup-election"). Split out from the dashboard so
// that page only ever shows the current election's status; this page is only
// reachable (and only useful) while there is no election configured yet.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createElection } from '../api';
import { MAX_SEATS_PER_POSITION, MIN_SEATS_PER_POSITION, STANDARD_POSITIONS } from '../constants';
import type { PositionInput } from '../types';

interface PositionDraft {
  title: string;
  seats: number;
  candidateNames: string[];
}

function emptyPosition(): PositionDraft {
  return { title: '', seats: MIN_SEATS_PER_POSITION, candidateNames: [''] };
}

export default function AdminSetupElectionPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [positions, setPositions] = useState<PositionDraft[]>([emptyPosition()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function useStandardPositions() {
    setPositions(STANDARD_POSITIONS.map((title) => ({ title, seats: MIN_SEATS_PER_POSITION, candidateNames: [''] })));
  }

  function updatePosition(index: number, patch: Partial<PositionDraft>) {
    setPositions((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }
  function updateCandidate(posIndex: number, candIndex: number, value: string) {
    setPositions((prev) =>
      prev.map((p, i) =>
        i !== posIndex ? p : { ...p, candidateNames: p.candidateNames.map((c, ci) => (ci === candIndex ? value : c)) },
      ),
    );
  }
  function addCandidate(posIndex: number) {
    setPositions((prev) =>
      prev.map((p, i) => (i !== posIndex ? p : { ...p, candidateNames: [...p.candidateNames, ''] })),
    );
  }
  function removeCandidate(posIndex: number, candIndex: number) {
    setPositions((prev) =>
      prev.map((p, i) =>
        i !== posIndex ? p : { ...p, candidateNames: p.candidateNames.filter((_, ci) => ci !== candIndex) },
      ),
    );
  }
  function addPosition() {
    setPositions((prev) => [...prev, emptyPosition()]);
  }
  function removePosition(index: number) {
    setPositions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleaned: PositionInput[] = positions.map((p) => ({
      title: p.title.trim(),
      seats: p.seats,
      candidateNames: p.candidateNames.map((c) => c.trim()).filter(Boolean),
    }));
    if (!name.trim()) {
      setError('Enter an election name.');
      return;
    }
    if (cleaned.length === 0 || cleaned.some((p) => !p.title || p.candidateNames.length === 0)) {
      setError('Every position needs a title and at least one candidate.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await createElection(name.trim(), cleaned);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page admin-page">
      <header className="admin-header">
        <h1>Set up a new election</h1>
        <button onClick={() => navigate('/admin/dashboard')}>Back to dashboard</button>
      </header>
      <section className="panel">
        <form onSubmit={handleSubmit}>
          <label htmlFor="election-name">Election name</label>
          <input id="election-name" value={name} onChange={(e) => setName(e.target.value)} required />

          <button type="button" onClick={useStandardPositions}>
            Use standard society positions
          </button>

          {positions.map((position, posIndex) => (
            <fieldset key={posIndex} className="position-editor">
              <legend>Position {posIndex + 1}</legend>
              <input
                value={position.title}
                onChange={(e) => updatePosition(posIndex, { title: e.target.value })}
                placeholder="Position title, e.g. President"
              />
              <label>
                Seats
                <input
                  type="number"
                  min={MIN_SEATS_PER_POSITION}
                  max={MAX_SEATS_PER_POSITION}
                  value={position.seats}
                  onChange={(e) => updatePosition(posIndex, { seats: Math.max(MIN_SEATS_PER_POSITION, Number(e.target.value) || MIN_SEATS_PER_POSITION) })}
                />
              </label>
              <div className="candidates-header">
                <p className="hint">Candidates (a "NOTA" option is added automatically)</p>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => addCandidate(posIndex)}
                  title="Add candidate"
                  aria-label="Add candidate"
                >
                  +
                </button>
              </div>
              {position.candidateNames.map((c, candIndex) => (
                <div key={candIndex} className="candidate-row">
                  <input
                    value={c}
                    onChange={(e) => updateCandidate(posIndex, candIndex, e.target.value)}
                    placeholder={`Candidate ${candIndex + 1}`}
                  />
                  {position.candidateNames.length > 1 && (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeCandidate(posIndex, candIndex)}
                      title="Remove candidate"
                      aria-label="Remove candidate"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {positions.length > 1 && (
                <div className="position-actions">
                  <button
                    type="button"
                    className="danger icon-button"
                    onClick={() => removePosition(posIndex)}
                    title="Remove position"
                    aria-label="Remove position"
                  >
                    🗑
                  </button>
                </div>
              )}
            </fieldset>
          ))}
          <button type="button" onClick={addPosition}>
            Add another position
          </button>

          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create election'}
          </button>
        </form>
      </section>
    </main>
  );
}
