# Google Sheets backend setup

Used only when the Worker's `STORAGE_BACKEND` is `GOOGLE_SHEET`. All election
data (roster, votes) is stored in tabs of one Google Sheet — the Worker never
touches the Sheet directly, it only calls this Apps Script Web App.

## 1. Create the Sheet and script

1. Create a new Google Sheet (any name, e.g. "Society Election Data").
2. **Extensions > Apps Script**.
3. Delete the default `Code.gs` content and paste in this repo's
   `apps-script/Code.gs`.

## 2. Set script properties (secrets)

**Project Settings (gear icon) > Script properties > Add script property**,
add both:

- `SHARED_SECRET` — a long random string. The Worker must send the same
  value as `GAS_SHARED_SECRET`.
- `CREDENTIAL_PEPPER` — a different long random string, used to hash voting
  codes before they're stored. Anyone with Sheet access sees only the hash,
  never the plaintext code.

Never put these values directly in the spreadsheet cells or in `Code.gs`.

## 3. Deploy as a Web App

1. **Deploy > New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone** (the shared secret is what actually protects
   it — Apps Script Web Apps don't support custom request headers for auth,
   so the secret travels in the JSON body instead).
5. Deploy, then copy the **Web app URL** — this is `GAS_URL`.

## 4. Point the Worker at it

In `worker/.dev.vars`:

```
STORAGE_BACKEND=GOOGLE_SHEET
GAS_URL=https://script.google.com/macros/s/XXXXXXXX/exec
GAS_SHARED_SECRET=<same value as the SHARED_SECRET script property>
```

Restart `wrangler dev` after changing `.dev.vars`.

## Notes

- The script creates its own tabs (`Elections`, `Positions`, `Candidates`,
  `Flats`, `Registrations`, `Ballots`, `DeclinedCandidacies`) the first time
  it runs — you don't need to create them by hand.
- `castBallot_` and self-registration both use `LockService` so two
  near-simultaneous submissions (two votes with the same code, or two
  registrations for the same flat) can't both succeed, mirroring the D1
  backend's guards.
- Anyone with edit access to the underlying Sheet can view the
  `Registrations` tab (who registered against which flat, and whether
  they've voted) and the `Ballots` tab (anonymous votes) separately, but
  Google Sheets' revision history could still let someone with edit access
  correlate the two by timing. Keep Sheet editor access restricted to the
  same people who would have had physical ballot-box access in the paper
  process.
