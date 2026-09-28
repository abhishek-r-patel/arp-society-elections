import type { Env } from '../types';
import { STORAGE_BACKENDS } from '../constants';
import { D1Store } from './d1Store';
import { GoogleSheetStore } from './googleSheetStore';
import type { ElectionStore } from './ElectionStore';

/** Backend is chosen once per request from config — never mixed at runtime. */
export function createStore(env: Env): ElectionStore {
  if (env.STORAGE_BACKEND === STORAGE_BACKENDS.D1) {
    if (!env.DB) throw new Error('STORAGE_BACKEND is D1 but no DB binding is configured in wrangler.toml.');
    return new D1Store(env.DB, env.CREDENTIAL_PEPPER);
  }
  if (env.STORAGE_BACKEND === STORAGE_BACKENDS.GOOGLE_SHEET) {
    return new GoogleSheetStore(env.GAS_URL ?? '', env.GAS_SHARED_SECRET ?? '');
  }
  throw new Error(`Unknown STORAGE_BACKEND "${env.STORAGE_BACKEND}". Expected "D1" or "GOOGLE_SHEET".`);
}

