// Shared request/response and domain shapes used across store implementations
// and routes. NOT imported by the frontend (separate build target/package) —
// frontend/src/types.ts is a hand-kept mirror; update both when a shape changes.
import type { ELECTION_STATUSES, STORAGE_BACKENDS } from './constants';

export type ElectionStatus = (typeof ELECTION_STATUSES)[keyof typeof ELECTION_STATUSES];
export type StorageBackend = (typeof STORAGE_BACKENDS)[keyof typeof STORAGE_BACKENDS];

export interface Candidate {
  id: string;
  name: string;
  isNota: boolean;
}

export interface Position {
  id: string;
  title: string;
  seats: number;
  candidates: Candidate[];
}

/** Input shape for creating a position; NOTA is added automatically by the store. */
export interface PositionInput {
  title: string;
  seats: number;
  candidateNames: string[];
}

export interface Election {
  id: string;
  name: string;
  status: ElectionStatus;
  backend: StorageBackend;
  positions: Position[];
  createdAt: string;
  opensAt?: string;
  closesAt?: string;
  resultsPublishedAt?: string;
}

/** Admin-defined eligible flat, imported before self-registration opens. */
export interface IssuedRegistrationKey {
  flatNo: string;
  registrationKey: string;
}

/** A self- (or admin-assisted) registered voter for one flat. */
export interface Registration {
  id: string;
  flatNo: string;
  voterName: string;
  voterPhone: string;
  voterEmail: string;
  registeredAt: string;
  hasVoted: boolean;
  votedAt?: string;
}

/** Admin's view of every eligible flat and who (if anyone) has registered against it. */
export interface FlatStatus {
  flatId: string;
  flatNo: string;
  registration: Registration | null;
}

export interface RegisterResult {
  ok: boolean;
  reason?: string;
  code?: string;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  election?: { name: string; positions: Position[] };
}

/** One position's selection: 1 to `seats` distinct candidate/NOTA IDs. */
export interface BallotSelection {
  positionId: string;
  candidateIds: string[];
}

export interface CastResult {
  ok: boolean;
  reason?: string;
  ballotIds?: string[];
  castAt?: string;
}

export interface Turnout {
  totalFlats: number;
  registeredCount: number;
  votedCount: number;
}

export interface PositionResult {
  positionId: string;
  title: string;
  seats: number;
  candidates: { candidateId: string; name: string; isNota: boolean; votes: number }[];
}

export interface DeclaredWinner {
  candidateId: string;
  name: string;
  votes: number;
}

export interface PositionDeclaredResult extends PositionResult {
  winners: DeclaredWinner[]; // top `seats` eligible (non-NOTA, non-declined) candidates
  vacantSeats: number; // seats not filled because too few eligible candidates remain
}

/**
 * Same name topping the vote count in 2+ positions. Matching is by
 * trimmed/lowercased name only — there is no canonical candidate identity
 * across positions, so two unrelated people who share a name would show up
 * as a false conflict (admin should sanity-check before resolving).
 */
export interface WinnerConflict {
  name: string;
  entries: { positionId: string; positionTitle: string; candidateId: string; votes: number }[];
}

export interface DeclaredResults {
  positions: PositionDeclaredResult[];
  conflicts: WinnerConflict[];
  declinedCandidacies: { positionId: string; positionTitle: string; candidateId: string; name: string }[];
}

/** What voters see at GET /api/election/results — only returned once admin publishes. */
export interface PublicResults {
  name: string;
  publishedAt: string;
  turnout: Turnout;
  positions: PositionDeclaredResult[];
}

export interface Env {
  STORAGE_BACKEND: string;
  DB?: D1Database;
  GAS_URL?: string;
  GAS_SHARED_SECRET?: string;
  ADMIN_PASSWORD_HASH: string;
  ADMIN_SESSION_SECRET: string;
  CREDENTIAL_PEPPER: string;
}

