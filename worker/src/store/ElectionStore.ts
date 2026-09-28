import type {
  BallotSelection,
  CastResult,
  DeclaredResults,
  Election,
  ElectionStatus,
  FlatStatus,
  IssuedRegistrationKey,
  PositionInput,
  PositionResult,
  PublicResults,
  RegisterResult,
  Turnout,
  VerifyResult,
} from '../types';

/** Thrown for expected, user-facing failures (bad input, wrong election state, etc). */
export class StoreError extends Error {}

/**
 * Contract implemented identically by D1Store and GoogleSheetStore (and
 * mirrored by hand in apps-script/Code.gs's action router) so the rest of
 * the app never branches on which backend is active.
 */
export interface ElectionStore {
  /** Always returns the single most-recently-created election, or null if none exists yet. */
  getElection(): Promise<Election | null>;
  /** Fails if a draft/scheduled/open election already exists — only one election in flight at a time. */
  createElection(name: string, positions: PositionInput[]): Promise<Election>;
  /** Moves draft->scheduled; the actual open/close happens lazily the next time getElection() is called past the target time. */
  scheduleElection(opensAt: string, closesAt?: string): Promise<Election>;
  /** Manual lifecycle transition (open/closed/cancelled); see each implementation for the allowed-transition rules. */
  setElectionStatus(status: ElectionStatus): Promise<Election>;
  /** Registers each flat number as eligible and generates its registration key; only allowed before voting opens. */
  importFlats(flatNumbers: string[]): Promise<IssuedRegistrationKey[]>;
  /** Public self-service: proves the registrant knows the flat's registration key, then issues a one-time voting credential. */
  registerVoter(flatNo: string, registrationKey: string, voterName: string, voterPhone: string, voterEmail: string): Promise<RegisterResult>;
  /** Admin-assisted equivalent of registerVoter — no registration key required since the admin session is already trusted. */
  adminRegisterVoter(flatNo: string, voterName: string, voterPhone: string, voterEmail: string): Promise<RegisterResult>;
  /** Every eligible flat plus whoever (if anyone) is currently registered against it. Admin-only. */
  listRegistrations(): Promise<FlatStatus[]>;
  /** Soft-deletes a registration (invalidating its credential) so the flat can be re-registered; blocked once has_voted=1. */
  revokeRegistration(registrationId: string): Promise<void>;
  verifyCredential(code: string): Promise<VerifyResult>;
  /** Atomically marks the credential used and records the ballot(s); rejects a second call for the same code. */
  castBallot(code: string, selections: BallotSelection[]): Promise<CastResult>;
  getTurnout(): Promise<Turnout>;
  /** Raw per-candidate vote counts, no interpretation. Admin-only, only valid once closed/cancelled. */
  getResults(): Promise<PositionResult[]>;
  /** getResults() plus computed winners/vacancies and cross-position name-conflicts. Admin-only. */
  getDeclaredResults(): Promise<DeclaredResults>;
  /** Records that a candidate is giving up a position they'd otherwise win; recomputes the runner-up. */
  declineCandidacy(positionId: string, candidateId: string): Promise<DeclaredResults>;
  clearDeclines(): Promise<DeclaredResults>;
  /** Gate that makes getPublicResults() start returning data; blocked while conflicts remain unresolved. */
  publishResults(): Promise<Election>;
  /** What voters see at GET /api/election/results \u2014 null until publishResults() has been called. */
  getPublicResults(): Promise<PublicResults | null>;
  exportAudit(): Promise<string>;
}




