-- D1 schema for the society election system.
-- Ballots intentionally carry no reference back to a voter row.

CREATE TABLE IF NOT EXISTS elections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | scheduled | open | closed | cancelled
  backend TEXT NOT NULL,                -- backend this election was created under
  created_at TEXT NOT NULL,
  opens_at TEXT,                        -- scheduled voting start (set by "schedule voting")
  closes_at TEXT,                       -- optional scheduled voting end
  opened_at TEXT,                       -- actual time voting opened (manual or auto)
  closed_at TEXT,                       -- actual time voting closed (manual or auto)
  results_published_at TEXT             -- when admin made results visible to voters
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  election_id TEXT NOT NULL REFERENCES elections(id),
  title TEXT NOT NULL,   -- e.g. President, Secretary, Joint Treasurer
  seats INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  election_id TEXT NOT NULL REFERENCES elections(id),
  position_id TEXT NOT NULL REFERENCES positions(id),
  name TEXT NOT NULL,
  is_nota INTEGER NOT NULL DEFAULT 0, -- 1 for the auto-added "None of the Above" option
  sort_order INTEGER NOT NULL
);

-- Eligible flats, defined by admin. This is what stops someone self-registering
-- with a flat number that doesn't belong to the society (registration_key_hash
-- gates who from that household can claim the flat's one vote).
CREATE TABLE IF NOT EXISTS flats (
  id TEXT PRIMARY KEY,
  election_id TEXT NOT NULL REFERENCES elections(id),
  flat_no TEXT NOT NULL,
  registration_key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(election_id, flat_no)
);

-- One row per self-registered (or admin-registered) person. `revoked_at` is a
-- soft delete (see revokeRegistration): a revoked row's credential stops
-- working, but is never deleted, and revoking is blocked once has_voted=1 so
-- a flat can never be made to vote twice under two different names.
CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  election_id TEXT NOT NULL REFERENCES elections(id),
  flat_id TEXT NOT NULL REFERENCES flats(id),
  voter_name TEXT NOT NULL,
  voter_phone TEXT NOT NULL,
  voter_email TEXT NOT NULL,
  credential_hash TEXT NOT NULL,
  has_voted INTEGER NOT NULL DEFAULT 0,
  voted_at TEXT,
  registered_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(election_id, credential_hash)
);

-- Enforces "one active registration per flat" at the database level, not just
-- in application code (SQLite/D1 supports partial/filtered unique indexes).
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_active_per_flat
  ON registrations(flat_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS ballots (
  id TEXT PRIMARY KEY,
  election_id TEXT NOT NULL REFERENCES elections(id),
  position_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  cast_at TEXT NOT NULL
);

-- Post-close winner resolution: when a person's name tops the vote count in
-- more than one position, admin picks one and declines the others here,
-- which promotes the next-highest eligible candidate for that position.
CREATE TABLE IF NOT EXISTS declined_candidacies (
  id TEXT PRIMARY KEY,
  election_id TEXT NOT NULL REFERENCES elections(id),
  position_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  declined_at TEXT NOT NULL,
  UNIQUE(election_id, position_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_positions_election ON positions(election_id);
CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates(election_id);
CREATE INDEX IF NOT EXISTS idx_flats_election ON flats(election_id);
CREATE INDEX IF NOT EXISTS idx_registrations_election ON registrations(election_id);
CREATE INDEX IF NOT EXISTS idx_registrations_flat ON registrations(flat_id);
CREATE INDEX IF NOT EXISTS idx_ballots_election ON ballots(election_id);
CREATE INDEX IF NOT EXISTS idx_declined_election ON declined_candidacies(election_id);
