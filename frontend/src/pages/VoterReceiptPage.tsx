// Post-vote confirmation ("/receipt"). Deliberately shows only a ballot ID
// and timestamp, never the candidate choice — that separation is what keeps
// the receipt from doubling as proof of how someone voted.
import { useLocation, Link } from 'react-router-dom';

interface ReceiptState {
  ballotIds?: string[];
  castAt?: string;
}

export default function VoterReceiptPage() {
  const location = useLocation();
  const state = (location.state as ReceiptState | null) ?? {};

  return (
    <main className="page voter-page">
      <h1>Thank you for voting</h1>
      <p>Your ballot has been recorded.</p>
      {state.ballotIds && state.ballotIds.length > 0 && (
        <dl className="receipt">
          <dt>Receipt ID{state.ballotIds.length > 1 ? 's' : ''}</dt>
          <dd>{state.ballotIds.join(', ')}</dd>
          <dt>Recorded at</dt>
          <dd>{state.castAt ? new Date(state.castAt).toLocaleString() : '—'}</dd>
        </dl>
      )}
      <p className="hint">This receipt does not show your selections — that keeps your vote private.</p>
      <p>
        <Link to="/">Back to start</Link>
      </p>
    </main>
  );
}

