// Public results view ("/results"), no login required. Mirrors the admin
// results table but omits winner-resolution controls; returns null from the
// API until an admin explicitly publishes (see AdminDashboardPage's publish button).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPublicResults } from '../api';
import type { PublicResults } from '../types';

export default function ResultsPage() {
  const [results, setResults] = useState<PublicResults | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicResults()
      .then((r) => setResults(r.results))
      .catch((err) => setError(err instanceof Error ? err.message : 'Something went wrong.'));
  }, []);

  return (
    <main className="page voter-page">
      <h1>Election results</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {results === undefined && !error && <p>Loading…</p>}
      {results === null && !error && <p>Results have not been published yet. Check back later.</p>}
      {results && (
        <>
          <h2>{results.name}</h2>
          <p className="hint">
            Published {new Date(results.publishedAt).toLocaleString()} · Turnout: {results.turnout.votedCount} of{' '}
            {results.turnout.registeredCount} registered voted
          </p>
          {results.positions.map((position) => (
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
                    .map((c) => {
                      const isWinner = position.winners.some((w) => w.candidateId === c.candidateId);
                      return (
                        <tr key={c.candidateId}>
                          <td>{isWinner ? `🏆 ${c.name}` : c.name}</td>
                          <td>{c.votes}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
      <p>
        <Link to="/">Back to start</Link>
      </p>
    </main>
  );
}
