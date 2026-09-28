# Admin FAQ

Common questions for election committee members running an election on
this platform. For setup/technical details, see the technical
specification document instead — this covers day-to-day usage scenarios.

## Setting up an election

### How do I create a new election?

Log in to the admin area and fill in the election name, then add each
position being contested (e.g. President, Secretary), how many seats each
has, and the candidates standing for it. A "NOTA (None of the Above)"
option is added automatically to every position — you don't add it
yourself. There's a one-click shortcut to pre-fill the typical set of
society committee positions.

### Can I set up more than one election at a time?

No — only one election can be in progress (draft, scheduled, or open) at
a time. You can only create a new one once the current one is closed or
cancelled. Past elections stay on record; they're not deleted.

### How do voters actually get added to the election?

You don't add named voters directly anymore. Instead, you import the list
of **eligible flat numbers**, and the system generates a **registration
key** per flat, which you distribute (notice board, WhatsApp/email group,
etc.). Residents then self-register with that key to get their own
individual voting code. See the voter-facing FAQ for their side of this.

### Can I add more flats after voting has opened?

No — the eligible-flats list can only be changed before voting opens
(while the election is in draft or scheduled). If a flat was missed,
you'll need to plan for that before opening voting; talk to your
technical contact if you're mid-election and this happens.

### Can I register someone myself instead of making them self-register?

Yes. The admin dashboard has a "Register on behalf" option — enter the
flat number, name, phone, and email, and it issues a voting code
immediately, the same as if they'd self-registered. Useful for residents
who can't or won't use the registration page themselves.

---

## Running the election

### How do I control when voting opens and closes?

You can open voting immediately, or schedule a specific opening date/time
(and, optionally, an automatic closing time). Voters see a live countdown
once a schedule is set. Both opening and closing happen automatically at
the times you chose.

### Can I see how many people have voted while it's still open?

Yes — the dashboard shows how many eligible flats there are, how many
have registered, and how many have voted, updated live. You never see
what anyone voted for while this is happening.

### A voter says they lost their voting code. What do I do?

Look them up in the registrations table to confirm their identity (name,
phone, email) and check whether they've already voted.

- **Not voted yet:** revoke their registration (this kills the old code),
  then register them again (self-service or "register on behalf") to get
  a brand-new code to give them.
- **Already voted:** there's nothing to reissue — their vote is already
  recorded, and the code has served its purpose.

The original code itself can never be looked up or displayed again by
anyone, including you — it's stored as a one-way hash, not in reversible
form. This is intentional, the same way a password would never be stored
in plain text.

### A household registered the wrong person (e.g. spouse instead of owner). How do I fix it?

Same process as above: confirm with the flat that they want to change who
holds their vote, revoke the existing registration (only possible if that
person hasn't voted yet), then register the right person — either have
them self-register again with the flat's key, or register them yourself
from the admin side.

### Can I revoke someone's registration after they've voted?

No, and this is deliberate — it's blocked to stop a flat from voting
twice under two different names. If a dispute comes up after someone has
already voted, that vote stands; it cannot be undone by revoking.

### Can I cancel an election?

Yes, any time before it's closed. A cancelled election is kept for the
record, but no results are ever published from it, and votes already cast
in it don't count.

---

## Results

### When do voters get to see the results?

Only when you explicitly click **"Publish results to voters"** on the
closed-election screen — closing voting and publishing results are two
separate steps. This gives you time to review everything first.

### Two candidates won the same position — how are ties handled?

The system does not automatically break ties; it will just show a
leading candidate based on raw vote order. Check the vote counts
yourself in that situation and follow your society's bylaws for how to
resolve a tie before publishing.

### NOTA got more votes than any actual candidate — what happens?

The system still declares the top actual candidate as the winner for that
seat; it does not automatically leave the seat vacant or force a
re-election. If your bylaws say a NOTA majority should be handled
differently, that's a manual decision your committee needs to make before
publishing.

### The same person won two different positions. What now?

The dashboard flags this as a "conflict" after you close voting: it shows
you every position that person topped, and you pick which one they keep.
The position(s) they give up automatically go to the next-highest voted
candidate. Nothing is published until you've resolved every such
conflict.

### How do I get a record of the election for our files?

Download the audit export from the closed-election screen — it includes
the attendance list (who registered/voted, without showing their choice),
the full vote count for every candidate, and the final declared winners.

---

## Administration

### I forgot the admin password. What do I do?

Ask whoever manages the technical setup to reset it for you (it's done
from the server configuration, not from within the website itself).

### Can I switch where the data is stored (Google Sheet vs. the other
### database option) partway through an election?

No — the storage choice is fixed the moment an election is created and
cannot be changed while it's in progress. If you need to switch, you'll
need to cancel the current election and start a new one with the storage
option you want.

### Is voting anonymous, even from me as admin?

Yes, in the sense that nothing in the system links a specific voter to a
specific ballot — that separation is enforced by how data is stored, not
just hidden in the interface. See the voter FAQ's privacy section for the
honest limits of that guarantee.

---

## Scenario reference

A quick, scannable list of what to expect in different situations.

### ✅ Things that work

- Creating an election with a name and at least one position that has at
  least one candidate.
- Importing a batch of eligible flat numbers and getting back a
  downloadable file of per-flat registration keys.
- Scheduling voting to open and/or close automatically at chosen times,
  or opening it immediately without scheduling.
- Registering a voter yourself ("register on behalf of") instead of
  making them self-register.
- Revoking a registration that hasn't voted yet, freeing that flat up for
  a new registration.
- Closing voting to reveal vote counts, then resolving any winner
  conflicts before publishing.
- Publishing results once every conflict is resolved — voters can then
  see them without a code.
- Exporting the full audit file (attendance, vote counts, declared
  winners) at any point after closing.
- Cancelling an election at any point before it's closed.

### 🚫 Things that are blocked (and why)

- Creating a second election while one is already in draft, scheduled, or
  open — only one election can be in progress at a time.
- Importing more eligible flats once voting has opened — the eligible
  list is locked in before voting starts.
- Opening voting with zero registered voters — there's nothing to vote
  on yet.
- Revoking a registration that has **already voted** — blocked outright,
  since it would let that flat vote a second time under a different
  name. This is not adjustable; plan verification before voting opens
  rather than after.
- Revoking a registration that's already revoked — rejected as
  redundant.
- Publishing results while any winner conflict is still unresolved —
  you must resolve every conflict first.
- Publishing results for a cancelled election — cancelled elections never
  publish results.
- Closing voting on an election that isn't currently open (e.g. still in
  draft) — the status has to move through open first.
- Cancelling an election that's already closed — once closed, it's
  final; cancel only works before that point.
- Scheduling a closing time that isn't after the opening time, or
  entering an invalid date/time — rejected with a clear message.
- Any admin action attempted after your session has expired or you've
  logged out — you're sent back to the login screen.

### ⚠️ Edge cases worth knowing

- If two people try to revoke or register the same flat at almost the
  same instant, only one action succeeds — the other simply gets a
  "already registered/revoked" message rather than corrupting data.
- A scheduled opening or closing time takes effect automatically the
  next time anyone (voter or admin) loads the site — you don't need to
  be watching the dashboard at that exact moment for it to happen.
- A ballot submitted right at the scheduled close moment either
  completes and counts, or is rejected as "voting is not currently
  open" — there's no partially-counted state.
- If the same candidate is entered under two positions with inconsistent
  spelling or capitalization, the system may fail to recognize them as
  the same person when detecting winner conflicts — keep candidate name
  spelling consistent if they're standing for more than one position.
- If NOTA receives more votes than any actual candidate for a seat, the
  system still declares the top real candidate the winner rather than
  leaving the seat vacant automatically — if your bylaws require
  different handling of a NOTA majority, that's a manual decision your
  committee makes before publishing.
- Very small elections (few flats/candidates) make ties and winner
  conflicts more likely — double-check the raw vote counts yourself
  before publishing in those cases, since ties aren't broken
  automatically.
- Once you've closed voting, there is no way to reopen it or accept more
  ballots for that election — if something was missed, the only path
  forward is to cancel and run a new election.

