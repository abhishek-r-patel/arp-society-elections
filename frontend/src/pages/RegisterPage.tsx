// Self-service registration ("/register"). Requires a flat number and its
// registration key (distributed by the admin to the whole flat, not to one
// person) — whoever from that household registers first claims the flat's
// one vote. On success shows the generated voting code once, then offers to
// go straight to voting without retyping it.
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerVoter, verifyVoterCode } from '../api';
import InfoTooltip from '../components/InfoTooltip';
import { FLAT_NO_HINT, PHONE_HINT, isValidEmail, isValidFlatNo, isValidPhone } from '../validation';

export default function RegisterPage() {
  const [flatNo, setFlatNo] = useState('');
  const [registrationKey, setRegistrationKey] = useState('');
  const [voterName, setVoterName] = useState('');
  const [voterPhone, setVoterPhone] = useState('');
  const [voterEmail, setVoterEmail] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidFlatNo(flatNo)) {
      setError(`Enter a valid flat number. ${FLAT_NO_HINT}.`);
      return;
    }
    if (!isValidPhone(voterPhone)) {
      setError(`Enter a valid phone number. ${PHONE_HINT}.`);
      return;
    }
    if (!isValidEmail(voterEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await registerVoter(flatNo, registrationKey, voterName, voterPhone, voterEmail);
      setCode(result.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleContinueToVote() {
    if (!code) return;
    setError(null);
    setLoading(true);
    try {
      const { election } = await verifyVoterCode(code);
      navigate('/vote', { state: { code: code.trim().toUpperCase(), electionName: election.name, positions: election.positions } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  if (code) {
    return (
      <main className="page voter-page">
        <h1>You're registered</h1>
        <div className="panel receipt">
          <p>Your one-time voting code:</p>
          <dl className="receipt">
            <dt>Voting code</dt>
            <dd>{code}</dd>
          </dl>
          <p className="hint">
            Save this somewhere private — it won't be shown again. Anyone with this code can cast this flat's vote.
          </p>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button onClick={handleContinueToVote} disabled={loading}>
          {loading ? 'Checking…' : 'Continue to vote now'}
        </button>
        <p>
          <Link to="/">Or come back later and enter the code on the start page</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="page voter-page">
      <h1>Register to vote</h1>
      <p>
        Enter your flat number and the registration key given to your flat by the election admin (e.g. on the
        notice board or the society group). The first household member to register becomes this flat's voter.
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="flat-no">
          Flat number<span className="required-mark">*</span> <InfoTooltip text={`${FLAT_NO_HINT}.`} />
        </label>
        <input id="flat-no" value={flatNo} onChange={(e) => setFlatNo(e.target.value)} placeholder="e.g. C-201" required />

        <label htmlFor="registration-key">
          Registration key<span className="required-mark">*</span>
        </label>
        <input
          id="registration-key"
          value={registrationKey}
          onChange={(e) => setRegistrationKey(e.target.value)}
          required
        />

        <label htmlFor="voter-name">
          Your name<span className="required-mark">*</span>
        </label>
        <input id="voter-name" value={voterName} onChange={(e) => setVoterName(e.target.value)} required />

        <label htmlFor="voter-phone">
          Phone number<span className="required-mark">*</span> <InfoTooltip text={`${PHONE_HINT}.`} />
        </label>
        <input id="voter-phone" value={voterPhone} onChange={(e) => setVoterPhone(e.target.value)} placeholder="9876543210" required />

        <label htmlFor="voter-email">
          Email<span className="required-mark">*</span>
        </label>
        <input id="voter-email" type="email" value={voterEmail} onChange={(e) => setVoterEmail(e.target.value)} required />

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading}>
          {loading ? 'Registering…' : 'Register'}
        </button>
      </form>
      <p>
        <Link to="/">Already have a voting code?</Link>
      </p>
    </main>
  );
}
