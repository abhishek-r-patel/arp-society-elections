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
import { StoreError, type ElectionStore } from './ElectionStore';

interface GasResponse<T> {
  ok: boolean;
  error?: string;
  result?: T;
}

/**
 * Delegates all logic to a Google Apps Script Web App bound to a Google Sheet
 * (see apps-script/Code.gs). The script owns credential hashing and uses
 * LockService to make vote-casting atomic, mirroring the D1 implementation.
 */
export class GoogleSheetStore implements ElectionStore {
  constructor(
    private gasUrl: string,
    private sharedSecret: string,
  ) {}

  private async call<T>(action: string, payload: unknown = {}): Promise<T> {
    if (!this.gasUrl) {
      throw new StoreError('GAS_URL is not configured for the Google Sheet backend.');
    }
    const response = await fetch(this.gasUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, secret: this.sharedSecret, payload }),
    });
    const body = (await response.json()) as GasResponse<T>;
    if (!response.ok || !body.ok) {
      throw new StoreError(body.error ?? `Google Sheet backend error (HTTP ${response.status}).`);
    }
    return body.result as T;
  }

  getElection(): Promise<Election | null> {
    return this.call('getElection');
  }

  createElection(name: string, positions: PositionInput[]): Promise<Election> {
    return this.call('createElection', { name, positions });
  }

  scheduleElection(opensAt: string, closesAt?: string): Promise<Election> {
    return this.call('scheduleElection', { opensAt, closesAt });
  }

  setElectionStatus(status: ElectionStatus): Promise<Election> {
    return this.call('setElectionStatus', { status });
  }

  importFlats(flatNumbers: string[]): Promise<IssuedRegistrationKey[]> {
    return this.call('importFlats', { flatNumbers });
  }

  registerVoter(
    flatNo: string,
    registrationKey: string,
    voterName: string,
    voterPhone: string,
    voterEmail: string,
  ): Promise<RegisterResult> {
    return this.call('registerVoter', { flatNo, registrationKey, voterName, voterPhone, voterEmail });
  }

  adminRegisterVoter(
    flatNo: string,
    voterName: string,
    voterPhone: string,
    voterEmail: string,
  ): Promise<RegisterResult> {
    return this.call('adminRegisterVoter', { flatNo, voterName, voterPhone, voterEmail });
  }

  listRegistrations(): Promise<FlatStatus[]> {
    return this.call('listRegistrations');
  }

  revokeRegistration(registrationId: string): Promise<void> {
    return this.call('revokeRegistration', { registrationId });
  }

  verifyCredential(code: string): Promise<VerifyResult> {
    return this.call('verifyCredential', { code });
  }

  castBallot(code: string, selections: BallotSelection[]): Promise<CastResult> {
    return this.call('castBallot', { code, selections });
  }

  getTurnout(): Promise<Turnout> {
    return this.call('getTurnout');
  }

  getResults(): Promise<PositionResult[]> {
    return this.call('getResults');
  }

  getDeclaredResults(): Promise<DeclaredResults> {
    return this.call('getDeclaredResults');
  }

  declineCandidacy(positionId: string, candidateId: string): Promise<DeclaredResults> {
    return this.call('declineCandidacy', { positionId, candidateId });
  }

  clearDeclines(): Promise<DeclaredResults> {
    return this.call('clearDeclines');
  }

  publishResults(): Promise<Election> {
    return this.call('publishResults');
  }

  getPublicResults(): Promise<PublicResults | null> {
    return this.call('getPublicResults');
  }

  exportAudit(): Promise<string> {
    return this.call('exportAudit');
  }
}

