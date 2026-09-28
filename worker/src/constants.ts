/**
 * Single place for tunable values used across the worker. Anything here
 * duplicated in apps-script/Code.gs (which can't import this file) is
 * flagged in a comment there too — keep both sides in sync by hand.
 */

export const STORAGE_BACKENDS = {
  D1: 'D1',
  GOOGLE_SHEET: 'GOOGLE_SHEET',
} as const;

export const ELECTION_STATUSES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  OPEN: 'open',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

/** Mirrored in apps-script/Code.gs's CODE_ALPHABET/generateCode_ — keep in sync. */
export const CREDENTIAL_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // no 0/O/1/I to avoid transcription errors
export const CREDENTIAL_CODE_LENGTH = 8;
export const CREDENTIAL_CODE_GROUP_SIZE = 4; // renders as e.g. "7K4M-9PQR"

/** Mirrored in apps-script/Code.gs's candidate insert calls — keep in sync. */
export const NOTA_CANDIDATE_NAME = 'NOTA (None of the Above)';

/** Mirrored in apps-script/Code.gs's votersSheet_/exportAudit_ — keep in sync. */
export const FLAT_CSV_HEADERS = {
  FLAT_NO: 'flat_no',
} as const;

/** Header row for the registration-key CSV admin downloads to distribute per flat. */
export const REGISTRATION_KEY_CSV_HEADERS = {
  FLAT_NO: 'flat_no',
  REGISTRATION_KEY: 'registration_key',
} as const;

export const MIN_POSITIONS_PER_ELECTION = 1;
export const MIN_CANDIDATES_PER_POSITION = 1;
export const MIN_SEATS_PER_POSITION = 1;
