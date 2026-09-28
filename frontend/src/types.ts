// Hand-kept mirror of the response shapes worker/src/types.ts sends over the
// wire. Frontend and worker are separate build targets and can't literally
// share this file — if a worker response shape changes, update both.
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

export interface PositionInput {
  title: string;
  seats: number;
  candidateNames: string[];
}

export type ElectionStatus = 'draft' | 'scheduled' | 'open' | 'closed' | 'cancelled';

export interface Election {
  id: string;
  name: string;
  status: ElectionStatus;
  backend: string;
  positions: Position[];
  createdAt: string;
  opensAt?: string;
  closesAt?: string;
  resultsPublishedAt?: string;
}

export interface Turnout {
  totalFlats: number;
  registeredCount: number;
  votedCount: number;
}

export interface BallotSelection {
  positionId: string;
  candidateIds: string[];
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
  winners: DeclaredWinner[];
  vacantSeats: number;
}

export interface WinnerConflict {
  name: string;
  entries: { positionId: string; positionTitle: string; candidateId: string; votes: number }[];
}

export interface DeclaredResults {
  positions: PositionDeclaredResult[];
  conflicts: WinnerConflict[];
  declinedCandidacies: { positionId: string; positionTitle: string; candidateId: string; name: string }[];
}

export interface PublicResults {
  name: string;
  publishedAt: string;
  turnout: Turnout;
  positions: PositionDeclaredResult[];
}

export interface IssuedRegistrationKey {
  flatNo: string;
  registrationKey: string;
}

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

export interface FlatStatus {
  flatId: string;
  flatNo: string;
  registration: Registration | null;
}

