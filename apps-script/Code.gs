/**
 * Google Apps Script backend for the society election system.
 * Deploy as a Web App (see apps-script/README.md) and point the Worker's
 * GAS_URL / GAS_SHARED_SECRET at it when STORAGE_BACKEND=GOOGLE_SHEET.
 *
 * All election data lives in this spreadsheet's own tabs. Ballots never
 * store a reference back to a voter row (see castBallot_).
 *
 * Apps Script can't import worker/src/constants.ts, so the values below
 * (CODE_ALPHABET, code length/grouping, NOTA candidate name, roster CSV
 * column names) are hand-mirrored from that file. If you change one side,
 * change the other.
 */

const SHEET_ELECTIONS = 'Elections';
const SHEET_POSITIONS = 'Positions';
const SHEET_CANDIDATES = 'Candidates';
const SHEET_FLATS = 'Flats';
const SHEET_REGISTRATIONS = 'Registrations';
const SHEET_BALLOTS = 'Ballots';
const SHEET_DECLINED = 'DeclinedCandidacies';

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput_({ ok: false, error: 'Invalid JSON body.' });
  }

  const sharedSecret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  if (!sharedSecret || body.secret !== sharedSecret) {
    return jsonOutput_({ ok: false, error: 'Unauthorized.' });
  }

  try {
    const result = routeAction_(body.action, body.payload || {});
    return jsonOutput_({ ok: true, result: result });
  } catch (err) {
    return jsonOutput_({ ok: false, error: err.message || String(err) });
  }
}

function routeAction_(action, payload) {
  switch (action) {
    case 'getElection':
      return getElection_();
    case 'createElection':
      return createElection_(payload.name, payload.positions);
    case 'scheduleElection':
      return scheduleElection_(payload.opensAt, payload.closesAt);
    case 'setElectionStatus':
      return setElectionStatus_(payload.status);
    case 'importFlats':
      return importFlats_(payload.flatNumbers);
    case 'registerVoter':
      return registerVoter_(payload.flatNo, payload.registrationKey, payload.voterName, payload.voterPhone, payload.voterEmail);
    case 'adminRegisterVoter':
      return adminRegisterVoter_(payload.flatNo, payload.voterName, payload.voterPhone, payload.voterEmail);
    case 'listRegistrations':
      return listRegistrations_();
    case 'revokeRegistration':
      return revokeRegistration_(payload.registrationId);
    case 'verifyCredential':
      return verifyCredential_(payload.code);
    case 'castBallot':
      return castBallot_(payload.code, payload.selections);
    case 'getTurnout':
      return getTurnout_();
    case 'getResults':
      return getResults_();
    case 'getDeclaredResults':
      return getDeclaredResults_();
    case 'declineCandidacy':
      return declineCandidacy_(payload.positionId, payload.candidateId);
    case 'clearDeclines':
      return clearDeclines_();
    case 'publishResults':
      return publishResults_();
    case 'getPublicResults':
      return getPublicResults_();
    case 'exportAudit':
      return exportAudit_();
    default:
      throw new Error('Unknown action: ' + action);
  }
}

function jsonOutput_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// --- Sheet helpers -----------------------------------------------------

function sheet_(name, headerRow) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headerRow);
  }
  return sheet;
}

function electionsSheet_() {
  return sheet_(SHEET_ELECTIONS, ['id', 'name', 'status', 'backend', 'created_at', 'opens_at', 'closes_at', 'opened_at', 'closed_at', 'results_published_at']);
}
function positionsSheet_() {
  return sheet_(SHEET_POSITIONS, ['id', 'election_id', 'title', 'seats', 'sort_order']);
}
function candidatesSheet_() {
  return sheet_(SHEET_CANDIDATES, ['id', 'election_id', 'position_id', 'name', 'is_nota', 'sort_order']);
}
function flatsSheet_() {
  return sheet_(SHEET_FLATS, ['id', 'election_id', 'flat_no', 'registration_key_hash', 'created_at']);
}
function registrationsSheet_() {
  return sheet_(SHEET_REGISTRATIONS, ['id', 'election_id', 'flat_id', 'voter_name', 'voter_phone', 'voter_email', 'credential_hash', 'has_voted', 'voted_at', 'registered_at', 'revoked_at']);
}
function ballotsSheet_() {
  return sheet_(SHEET_BALLOTS, ['id', 'election_id', 'position_id', 'candidate_id', 'cast_at']);
}
function declinedSheet_() {
  return sheet_(SHEET_DECLINED, ['id', 'election_id', 'position_id', 'candidate_id', 'declined_at']);
}

function rowsAsObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  return values.slice(1).map(function (row, index) {
    const obj = { _row: index + 2 }; // 1-based, +1 for header
    header.forEach(function (key, i) {
      obj[key] = row[i];
    });
    return obj;
  });
}

function newId_() {
  return Utilities.getUuid();
}

function nowIso_() {
  return new Date().toISOString();
}

function pepper_() {
  const pepper = PropertiesService.getScriptProperties().getProperty('CREDENTIAL_PEPPER');
  if (!pepper) throw new Error('CREDENTIAL_PEPPER script property is not set.');
  return pepper;
}

function hashCredential_(code) {
  const raw = code.trim().toUpperCase();
  const digest = Utilities.computeHmacSha256Signature(raw, pepper_());
  return digest.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // mirrors CREDENTIAL_CODE_ALPHABET
const CODE_LENGTH = 8; // mirrors CREDENTIAL_CODE_LENGTH
const CODE_GROUP_SIZE = 4; // mirrors CREDENTIAL_CODE_GROUP_SIZE
const NOTA_CANDIDATE_NAME = 'NOTA (None of the Above)'; // mirrors NOTA_CANDIDATE_NAME

function generateCode_() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  }
  return code.slice(0, CODE_GROUP_SIZE) + '-' + code.slice(CODE_GROUP_SIZE);
}

// --- Election lifecycle --------------------------------------------------

function getElection_() {
  const elections = rowsAsObjects_(electionsSheet_());
  if (elections.length === 0) return null;
  const election = elections.reduce(function (latest, row) {
    return !latest || row.created_at > latest.created_at ? row : latest;
  }, null);
  const status = applyScheduledTransition_(election);
  return buildElection_(election, status);
}

/** Lazily flips scheduled->open->closed once the clock passes opens_at/closes_at, persisting the change. */
function applyScheduledTransition_(election) {
  const now = nowIso_();
  let status = election.status;
  if (status === 'scheduled' && election.opens_at && election.opens_at <= now) {
    updateElectionRow_(election.id, { status: 'open', opened_at: now });
    status = 'open';
  }
  if (status === 'open' && election.closes_at && election.closes_at <= now) {
    updateElectionRow_(election.id, { status: 'closed', closed_at: now });
    status = 'closed';
  }
  return status;
}

function updateElectionRow_(electionId, fields) {
  const sheet = electionsSheet_();
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const idCol = header.indexOf('id');
  for (let r = 1; r < values.length; r++) {
    if (values[r][idCol] === electionId) {
      Object.keys(fields).forEach(function (key) {
        const col = header.indexOf(key);
        if (col !== -1) sheet.getRange(r + 1, col + 1).setValue(fields[key]);
      });
      break;
    }
  }
}

function buildElection_(election, status) {
  const positions = rowsAsObjects_(positionsSheet_())
    .filter(function (p) { return p.election_id === election.id; })
    .sort(function (a, b) { return a.sort_order - b.sort_order; });
  const candidates = rowsAsObjects_(candidatesSheet_()).filter(function (c) { return c.election_id === election.id; });

  return {
    id: election.id,
    name: election.name,
    status: status,
    backend: 'GOOGLE_SHEET',
    createdAt: election.created_at,
    opensAt: election.opens_at || undefined,
    closesAt: election.closes_at || undefined,
    resultsPublishedAt: election.results_published_at || undefined,
    positions: positions.map(function (p) {
      return {
        id: p.id,
        title: p.title,
        seats: p.seats,
        candidates: candidates
          .filter(function (c) { return c.position_id === p.id; })
          .sort(function (a, b) { return a.sort_order - b.sort_order; })
          .map(function (c) { return { id: c.id, name: c.name, isNota: c.is_nota === true }; }),
      };
    }),
  };
}

function createElection_(name, positions) {
  const existing = getElection_();
  if (existing && (existing.status === 'draft' || existing.status === 'scheduled' || existing.status === 'open')) {
    throw new Error('An election is already in draft/scheduled/open state. Close or cancel it first.');
  }
  if (!positions || positions.length === 0) throw new Error('Add at least one position.');
  positions.forEach(function (position) {
    if (!position.title || !position.title.trim()) throw new Error('Each position needs a title.');
    if (!position.seats || position.seats < 1) throw new Error('Position "' + position.title + '" needs at least 1 seat.');
    if (!position.candidateNames || position.candidateNames.length === 0) {
      throw new Error('Position "' + position.title + '" needs at least one candidate.');
    }
  });

  const id = newId_();
  const now = nowIso_();
  electionsSheet_().appendRow([id, name, 'draft', 'GOOGLE_SHEET', now, '', '', '', '', '']);

  const pSheet = positionsSheet_();
  const cSheet = candidatesSheet_();
  positions.forEach(function (position, posIndex) {
    const positionId = newId_();
    pSheet.appendRow([positionId, id, position.title.trim(), position.seats, posIndex]);
    position.candidateNames.forEach(function (candidateName, cIndex) {
      cSheet.appendRow([newId_(), id, positionId, candidateName, false, cIndex]);
    });
    cSheet.appendRow([newId_(), id, positionId, NOTA_CANDIDATE_NAME, true, position.candidateNames.length]);
  });
  return getElection_();
}

function scheduleElection_(opensAt, closesAt) {
  const election = requireElection_();
  if (election.status !== 'draft' && election.status !== 'scheduled') {
    throw new Error('Cannot schedule an election in status "' + election.status + '".');
  }
  const opensDate = new Date(opensAt);
  if (isNaN(opensDate.getTime())) throw new Error('Invalid opening date/time.');
  let closesIso = '';
  if (closesAt) {
    const closesDate = new Date(closesAt);
    if (isNaN(closesDate.getTime())) throw new Error('Invalid closing date/time.');
    if (closesDate <= opensDate) throw new Error('Closing time must be after opening time.');
    closesIso = closesDate.toISOString();
  }
  updateElectionRow_(election.id, { status: 'scheduled', opens_at: opensDate.toISOString(), closes_at: closesIso });
  return getElection_();
}

function setElectionStatus_(status) {
  const election = requireElection_();
  if (status === 'open' && election.status !== 'draft' && election.status !== 'scheduled') {
    throw new Error('Cannot open an election in status "' + election.status + '".');
  }
  if (status === 'closed' && election.status !== 'open') {
    throw new Error('Cannot close an election in status "' + election.status + '".');
  }
  if (status === 'cancelled' && (election.status === 'closed' || election.status === 'cancelled')) {
    throw new Error('Cannot cancel an election in status "' + election.status + '".');
  }
  const fields = { status: status };
  if (status === 'open') fields.opened_at = nowIso_();
  if (status === 'closed') fields.closed_at = nowIso_();
  updateElectionRow_(election.id, fields);
  return getElection_();
}

function requireElection_() {
  const election = getElection_();
  if (!election) throw new Error('No election has been set up yet.');
  return election;
}

// --- Flats / self-service registration --------------------------------------

function importFlats_(flatNumbers) {
  const election = requireElection_();
  if (election.status !== 'draft' && election.status !== 'scheduled') {
    throw new Error('Flats can only be imported before voting opens.');
  }
  const sheet = flatsSheet_();
  const existing = rowsAsObjects_(sheet)
    .filter(function (f) { return f.election_id === election.id; })
    .map(function (f) { return String(f.flat_no).toLowerCase(); });
  const existingSet = {};
  existing.forEach(function (f) { existingSet[f] = true; });
  const seen = {};
  const issued = [];
  flatNumbers.forEach(function (raw) {
    const flatNo = String(raw).trim();
    const key = flatNo.toLowerCase();
    if (!flatNo || existingSet[key] || seen[key]) return; // skip blanks/dupes/already-imported flats
    seen[key] = true;
    const registrationKey = generateCode_();
    sheet.appendRow([newId_(), election.id, flatNo, hashCredential_(registrationKey), nowIso_()]);
    issued.push({ flatNo: flatNo, registrationKey: registrationKey });
  });
  return issued;
}

/**
 * LockService guards the "one active registration per flat" rule the same way
 * castBallot_ guards duplicate voting — a plain read-then-append here would
 * let two near-simultaneous registrations for the same flat both succeed.
 */
function createRegistration_(election, flatId, voterName, voterPhone, voterEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!voterName || !String(voterName).trim()) return { ok: false, reason: 'Name is required.' };
    if (!voterPhone || !String(voterPhone).trim()) return { ok: false, reason: 'Phone number is required.' };
    if (!voterEmail || !String(voterEmail).trim()) return { ok: false, reason: 'Email is required.' };
    const activeExists = rowsAsObjects_(registrationsSheet_()).some(function (r) {
      return r.flat_id === flatId && !r.revoked_at;
    });
    if (activeExists) {
      return { ok: false, reason: 'This flat is already registered. Contact the election admin if this needs to change.' };
    }
    const code = generateCode_();
    registrationsSheet_().appendRow([
      newId_(), election.id, flatId, String(voterName).trim(), String(voterPhone).trim(),
      String(voterEmail).trim(), hashCredential_(code), false, '', nowIso_(), '',
    ]);
    return { ok: true, code: code };
  } finally {
    lock.releaseLock();
  }
}

function findFlat_(election, flatNo) {
  return rowsAsObjects_(flatsSheet_()).find(function (f) {
    return f.election_id === election.id && String(f.flat_no).trim() === String(flatNo).trim();
  });
}

function registerVoter_(flatNo, registrationKey, voterName, voterPhone, voterEmail) {
  const election = getElection_();
  if (!election) return { ok: false, reason: 'No election has been set up yet.' };
  if (election.status === 'closed' || election.status === 'cancelled') {
    return { ok: false, reason: 'Registration is closed for this election.' };
  }
  const flat = findFlat_(election, flatNo);
  if (!flat) return { ok: false, reason: 'Unknown flat number. Contact the election admin.' };
  if (hashCredential_(registrationKey) !== flat.registration_key_hash) {
    return { ok: false, reason: 'Incorrect registration key for this flat.' };
  }
  return createRegistration_(election, flat.id, voterName, voterPhone, voterEmail);
}

function adminRegisterVoter_(flatNo, voterName, voterPhone, voterEmail) {
  const election = requireElection_();
  if (election.status === 'closed' || election.status === 'cancelled') {
    throw new Error('Registration is closed for this election.');
  }
  const flat = findFlat_(election, flatNo);
  if (!flat) throw new Error('Unknown flat number.');
  const result = createRegistration_(election, flat.id, voterName, voterPhone, voterEmail);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

function listRegistrations_() {
  const election = requireElection_();
  const flats = rowsAsObjects_(flatsSheet_()).filter(function (f) { return f.election_id === election.id; });
  const registrations = rowsAsObjects_(registrationsSheet_()).filter(function (r) {
    return r.election_id === election.id && !r.revoked_at;
  });
  return flats.map(function (flat) {
    const r = registrations.find(function (row) { return row.flat_id === flat.id; });
    return {
      flatId: flat.id,
      flatNo: flat.flat_no,
      registration: r ? {
        id: r.id,
        flatNo: flat.flat_no,
        voterName: r.voter_name,
        voterPhone: r.voter_phone,
        voterEmail: r.voter_email || undefined,
        registeredAt: r.registered_at,
        hasVoted: r.has_voted === true,
        votedAt: r.voted_at || undefined,
      } : null,
    };
  });
}

function revokeRegistration_(registrationId) {
  const sheet = registrationsSheet_();
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const idCol = header.indexOf('id');
  const hasVotedCol = header.indexOf('has_voted');
  const revokedAtCol = header.indexOf('revoked_at');
  for (let r = 1; r < values.length; r++) {
    if (values[r][idCol] === registrationId) {
      if (values[r][revokedAtCol]) throw new Error('This registration has already been revoked.');
      if (values[r][hasVotedCol] === true) {
        throw new Error('Cannot revoke a registration that has already voted \u2014 doing so would let this flat vote twice.');
      }
      sheet.getRange(r + 1, revokedAtCol + 1).setValue(nowIso_());
      return;
    }
  }
  throw new Error('Unknown registration.');
}

// --- Voting ----------------------------------------------------------------

function verifyCredential_(code) {
  const election = getElection_();
  if (!election) return { ok: false, reason: 'No election has been set up yet.' };
  if (election.status === 'scheduled') {
    return { ok: false, reason: 'Voting has not opened yet. Opens at ' + election.opensAt + '.' };
  }
  if (election.status !== 'open') {
    return { ok: false, reason: 'Voting is not currently open (status: ' + election.status + ').' };
  }
  const hash = hashCredential_(code);
  const registrations = rowsAsObjects_(registrationsSheet_());
  const registration = registrations.find(function (r) {
    return r.election_id === election.id && r.credential_hash === hash && !r.revoked_at;
  });
  if (!registration) return { ok: false, reason: 'Invalid voting code.' };
  if (registration.has_voted === true) return { ok: false, reason: 'This voting code has already been used.' };
  return { ok: true, election: { name: election.name, positions: election.positions } };
}

/** Mirrors worker/src/store/d1Store.ts validateSelections() — keep both in sync. */
function validateSelections_(positions, selections) {
  if (!selections || selections.length !== positions.length) return 'Please make a selection for every position.';
  for (let i = 0; i < positions.length; i++) {
    const position = positions[i];
    const selection = selections.find(function (s) { return s.positionId === position.id; });
    if (!selection) return 'Missing selection for "' + position.title + '".';
    const candidateIds = selection.candidateIds || [];
    if (candidateIds.length === 0) return 'Please choose at least one option for "' + position.title + '".';
    if (candidateIds.length > position.seats) return '"' + position.title + '" allows at most ' + position.seats + ' selection(s).';
    if (new Set(candidateIds).size !== candidateIds.length) return 'Duplicate selection for "' + position.title + '".';
    for (let j = 0; j < candidateIds.length; j++) {
      if (!position.candidates.some(function (c) { return c.id === candidateIds[j]; })) {
        return 'Invalid candidate selection for "' + position.title + '".';
      }
    }
  }
  return null;
}

/**
 * LockService serializes this across concurrent requests, so two near-
 * simultaneous submissions for the same credential cannot both succeed —
 * the same atomicity guarantee the D1 backend gets from a conditional UPDATE.
 */
function castBallot_(code, selections) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const election = getElection_();
    if (!election) return { ok: false, reason: 'No election has been set up yet.' };
    if (election.status !== 'open') return { ok: false, reason: 'Voting is not currently open.' };

    const validationError = validateSelections_(election.positions, selections);
    if (validationError) return { ok: false, reason: validationError };

    const hash = hashCredential_(code);
    const sheet = registrationsSheet_();
    const values = sheet.getDataRange().getValues();
    const header = values[0];
    const electionIdCol = header.indexOf('election_id');
    const hashCol = header.indexOf('credential_hash');
    const votedCol = header.indexOf('has_voted');
    const votedAtCol = header.indexOf('voted_at');
    const revokedAtCol = header.indexOf('revoked_at');

    let targetRow = -1;
    for (let r = 1; r < values.length; r++) {
      if (values[r][electionIdCol] === election.id && values[r][hashCol] === hash && !values[r][revokedAtCol]) {
        targetRow = r;
        break;
      }
    }
    if (targetRow === -1) return { ok: false, reason: 'Invalid voting code.' };
    if (values[targetRow][votedCol] === true) return { ok: false, reason: 'This voting code has already been used.' };

    const castAt = nowIso_();
    sheet.getRange(targetRow + 1, votedCol + 1).setValue(true);
    sheet.getRange(targetRow + 1, votedAtCol + 1).setValue(castAt);

    const ballotsSheet = ballotsSheet_();
    const ballotIds = [];
    selections.forEach(function (selection) {
      selection.candidateIds.forEach(function (candidateId) {
        const ballotId = newId_();
        ballotIds.push(ballotId);
        ballotsSheet.appendRow([ballotId, election.id, selection.positionId, candidateId, castAt]);
      });
    });
    return { ok: true, ballotIds: ballotIds, castAt: castAt };
  } finally {
    lock.releaseLock();
  }
}

// --- Reporting ---------------------------------------------------------

function getTurnout_() {
  const election = requireElection_();
  const flats = rowsAsObjects_(flatsSheet_()).filter(function (f) { return f.election_id === election.id; });
  const registrations = rowsAsObjects_(registrationsSheet_()).filter(function (r) {
    return r.election_id === election.id && !r.revoked_at;
  });
  const votedCount = registrations.filter(function (r) { return r.has_voted === true; }).length;
  return { totalFlats: flats.length, registeredCount: registrations.length, votedCount: votedCount };
}

function getResults_() {
  const election = requireElection_();
  if (election.status !== 'closed' && election.status !== 'cancelled') {
    throw new Error('Results are only available once the election is closed.');
  }
  const ballots = rowsAsObjects_(ballotsSheet_()).filter(function (b) { return b.election_id === election.id; });
  return election.positions.map(function (position) {
    return {
      positionId: position.id,
      title: position.title,
      seats: position.seats,
      candidates: position.candidates.map(function (c) {
        const votes = ballots.filter(function (b) { return b.candidate_id === c.id; }).length;
        return { candidateId: c.id, name: c.name, isNota: c.isNota, votes: votes };
      }),
    };
  });
}

function exportAudit_() {
  const election = requireElection_();
  const flats = rowsAsObjects_(flatsSheet_()).filter(function (f) { return f.election_id === election.id; });
  const registrations = rowsAsObjects_(registrationsSheet_()).filter(function (r) {
    return r.election_id === election.id && !r.revoked_at;
  });
  const isFinal = election.status === 'closed' || election.status === 'cancelled';
  const results = isFinal ? getResults_() : [];
  const declared = isFinal ? getDeclaredResults_() : null;

  const lines = ['section,flat_no,voter_name,voter_phone,voter_email,has_voted,voted_at'];
  flats.forEach(function (flat) {
    const r = registrations.find(function (row) { return row.flat_id === flat.id; });
    lines.push([
      'attendance', csvCell_(flat.flat_no), csvCell_(r ? r.voter_name : ''), csvCell_(r ? r.voter_phone : ''),
      csvCell_(r ? (r.voter_email || '') : ''), r && r.has_voted ? 'yes' : 'no', csvCell_(r ? (r.voted_at || '') : ''),
    ].join(','));
  });
  lines.push('');
  lines.push('section,position,candidate,votes');
  results.forEach(function (position) {
    position.candidates.forEach(function (c) {
      lines.push(['results', csvCell_(position.title), csvCell_(c.name), c.votes].join(','));
    });
  });
  if (declared) {
    lines.push('');
    lines.push('section,position,declared_winner,votes');
    declared.positions.forEach(function (position) {
      if (position.winners.length === 0) {
        lines.push(['declared', csvCell_(position.title), 'VACANT', 0].join(','));
      } else {
        position.winners.forEach(function (w) {
          lines.push(['declared', csvCell_(position.title), csvCell_(w.name), w.votes].join(','));
        });
      }
    });
    if (declared.conflicts.length > 0) {
      lines.push('');
      lines.push('section,note');
      declared.conflicts.forEach(function (c) {
        const positionsList = c.entries.map(function (e) { return e.positionTitle; }).join(' and ');
        lines.push(['unresolved_conflict', csvCell_(c.name + ' is the top vote-getter in multiple positions: ' + positionsList)].join(','));
      });
    }
  }
  return lines.join('\n');
}

// --- Winner resolution ---------------------------------------------------

/** Mirrors worker/src/store/d1Store.ts buildDeclaredResults() — keep both in sync. */
function getDeclaredResults_() {
  const election = requireElection_();
  if (election.status !== 'closed' && election.status !== 'cancelled') {
    throw new Error('Results are only available once the election is closed.');
  }
  const rawResults = getResults_();
  const declinedIds = {};
  rowsAsObjects_(declinedSheet_())
    .filter(function (d) { return d.election_id === election.id; })
    .forEach(function (d) { declinedIds[d.candidate_id] = true; });

  const declinedCandidacies = [];
  const positions = rawResults.map(function (position) {
    const eligible = position.candidates
      .filter(function (c) { return !c.isNota && !declinedIds[c.candidateId]; })
      .sort(function (a, b) { return b.votes - a.votes; });
    const winners = eligible.slice(0, position.seats).map(function (c) {
      return { candidateId: c.candidateId, name: c.name, votes: c.votes };
    });
    position.candidates.forEach(function (c) {
      if (declinedIds[c.candidateId]) {
        declinedCandidacies.push({ positionId: position.positionId, positionTitle: position.title, candidateId: c.candidateId, name: c.name });
      }
    });
    return { positionId: position.positionId, title: position.title, seats: position.seats, candidates: position.candidates, winners: winners, vacantSeats: position.seats - winners.length };
  });

  const byName = {};
  positions.forEach(function (position) {
    position.winners.forEach(function (winner) {
      const key = winner.name.trim().toLowerCase();
      if (!byName[key]) byName[key] = [];
      byName[key].push({ positionId: position.positionId, positionTitle: position.title, candidateId: winner.candidateId, votes: winner.votes, name: winner.name });
    });
  });
  const conflicts = [];
  Object.keys(byName).forEach(function (key) {
    const entries = byName[key];
    const distinctPositions = {};
    entries.forEach(function (e) { distinctPositions[e.positionId] = true; });
    if (Object.keys(distinctPositions).length > 1) {
      conflicts.push({ name: entries[0].name, entries: entries.map(function (e) { return { positionId: e.positionId, positionTitle: e.positionTitle, candidateId: e.candidateId, votes: e.votes }; }) });
    }
  });

  return { positions: positions, conflicts: conflicts, declinedCandidacies: declinedCandidacies };
}

function declineCandidacy_(positionId, candidateId) {
  const election = requireElection_();
  if (election.status !== 'closed' && election.status !== 'cancelled') {
    throw new Error('Winners can only be resolved once the election is closed.');
  }
  const position = election.positions.find(function (p) { return p.id === positionId; });
  const candidate = position && position.candidates.find(function (c) { return c.id === candidateId; });
  if (!position || !candidate) throw new Error('Unknown position or candidate.');
  if (candidate.isNota) throw new Error('NOTA cannot be declined.');

  const alreadyDeclined = rowsAsObjects_(declinedSheet_()).some(function (d) {
    return d.election_id === election.id && d.position_id === positionId && d.candidate_id === candidateId;
  });
  if (!alreadyDeclined) {
    declinedSheet_().appendRow([newId_(), election.id, positionId, candidateId, nowIso_()]);
  }
  return getDeclaredResults_();
}

function clearDeclines_() {
  const election = requireElection_();
  const sheet = declinedSheet_();
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const electionIdCol = header.indexOf('election_id');
  for (let r = values.length - 1; r >= 1; r--) {
    if (values[r][electionIdCol] === election.id) sheet.deleteRow(r + 1);
  }
  return getDeclaredResults_();
}

// --- Publishing results to voters -----------------------------------------

function publishResults_() {
  const election = requireElection_();
  if (election.status !== 'closed') {
    throw new Error('Only a closed election\u2019s results can be published.');
  }
  const declared = getDeclaredResults_();
  if (declared.conflicts.length > 0) {
    throw new Error('Resolve all winner conflicts before publishing results.');
  }
  updateElectionRow_(election.id, { results_published_at: nowIso_() });
  return getElection_();
}

function getPublicResults_() {
  const election = getElection_();
  if (!election || election.status !== 'closed' || !election.resultsPublishedAt) return null;
  const declared = getDeclaredResults_();
  const turnout = getTurnout_();
  return {
    name: election.name,
    publishedAt: election.resultsPublishedAt,
    turnout: turnout,
    positions: declared.positions,
  };
}

function csvCell_(value) {
  const str = String(value);
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}
