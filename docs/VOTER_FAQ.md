# Voter FAQ

Common questions from flat owners and residents using the society election
website. If your question isn't answered here, contact your election
committee/admin directly.

## Getting started

### How do I get a voting code?

You register yourself at the **Register** page. You'll need:

- Your flat number
- The **registration key** for your flat (given out by the election
  committee — see below)
- Your name, phone number, and email

Once you submit, you'll be shown a one-time **voting code** on screen.
That's your ballot — keep it private.

### What is a "registration key"? Where do I get it?

It's a short code assigned to your **flat**, not to a specific person. The
committee distributes it to the whole household — for example on the
notice board, in a circular, or in the society WhatsApp/email group. It is
not a secret meant for one individual; it just proves you actually live in
that flat before you're allowed to register.

### I don't have my flat's registration key. What do I do?

Ask your election committee/admin. They can tell you the key again, or
register you directly themselves if needed.

### Does it have to be the flat owner who registers?

No. Anyone in the household can register — whoever does it first, using
the flat's registration key, becomes that flat's voter for this election.
Only one person per flat can be registered at a time.

### Someone else in my flat already registered before me. What now?

Only one registration is allowed per flat. If you and another household
member (e.g. your spouse) both want to register, only the first one
succeeds — the second attempt will be told the flat is already
registered. If the household wants to change who's registered, contact
the admin: they can remove the earlier registration (as long as that
person hasn't voted yet) and register the right person instead.

### Can I register after voting has already opened?

Usually yes — registration normally stays open while voting is happening,
unless the admin has closed it. If you try and it's not available
anymore, contact the admin.

---

## Voting

### How do I actually vote?

Go to the election website, enter your voting code, and you'll see every
position being contested (e.g. President, Secretary) with its candidates.
Select one candidate per position (or more than one, if that position has
multiple open seats — you'll be told how many you can pick). You can also
choose **NOTA (None of the Above)** for any position if you don't want to
support any listed candidate.

### Can I vote more than once?

No. The moment you submit your ballot, your code is permanently marked as
used. Trying again with the same code — even right away — will be
rejected.

### Can I change my vote after submitting?

No — once submitted, a ballot cannot be changed or withdrawn. Make sure
you're happy with your choices before clicking submit.

### What if voting hasn't opened yet, or has already closed?

The site will tell you clearly if voting hasn't started yet (often with a
countdown to the opening time) or if it has already closed. You cannot
submit a ballot outside the voting window.

### I lost my voting code. What do I do?

Contact the election admin. If you haven't voted yet, they can invalidate
your old code and issue you a new one. (If you've already voted, there's
nothing to reissue — your vote is already recorded.)

---

## Privacy

### Is my vote private? Can the admin see who I voted for?

Your registration details (name, phone, email, whether you've voted) and
your actual ballot (which candidate you picked) are stored completely
separately, with nothing linking the two. Nobody looking at the voter
list or the results can join them together to see how you personally
voted.

This is a strong, practical guarantee for a society-level election, but
it isn't the same as the cryptographic anonymity used in government
elections — treat it as "administrative anonymity," not an absolute,
unbreakable guarantee.

### What does the receipt after voting show?

Just a receipt ID and the time you voted — never your candidate choice.
That's intentional: even you shouldn't be able to prove to someone else
how you voted using your own receipt.

### Is my name/phone/email visible to other voters?

No. Only the admin can see the registration list. Other voters only ever
see the public election status and, once published, the final results
(candidate names and vote counts) — not the roster.

---

## Results

### When can I see the results?

Only after the admin has both closed voting **and** explicitly published
the results — these are two separate, deliberate steps, so results are
never shown the instant voting closes. Once published, anyone can view
them from the **Results** page without needing a voting code.

### What if the same person was standing for two positions and won both?

The committee decides which position that person keeps; the other
position automatically goes to the next highest-voted candidate. This is
a normal, expected part of the process — it doesn't invalidate the
election.

---

## Scenario reference

A quick, scannable list of what to expect in different situations.

### ✅ Things that work

- Registering with the correct flat number, the correct registration key,
  and your name/phone/email — you get a voting code.
- Being the first person from your household to register for your flat.
- Entering a correct, unused voting code while voting is open — you reach
  the ballot.
- Picking one candidate for a single-seat position, or up to the allowed
  number of candidates for a multi-seat position.
- Picking NOTA for any position instead of a candidate.
- The same candidate appearing in two different positions — you can pick
  them in both; they're counted separately for each.
- Viewing the results page once the admin has published them — no code
  needed.
- Registering after voting has already opened, if the admin still allows
  new registrations at that point.

### 🚫 Things that are blocked (and why)

- Registering with a flat number that isn't on the eligible list —
  rejected as an unknown flat, to stop people inventing flat numbers.
- Registering with the wrong registration key for a flat — rejected.
- Registering for a flat that already has an active registration —
  rejected; only one registration per flat at a time.
- Registering with a blank name, phone, or email — all three are
  required.
- Voting before the scheduled opening time, or after voting has closed —
  rejected, with the reason shown.
- Entering a code that doesn't exist — "Invalid voting code."
- Trying to use the same code a second time, even immediately after
  voting — rejected as already used.
- Submitting a ballot without a selection for every position, or with
  more selections than a position's seat count allows — rejected, you're
  told what to fix.
- Viewing results before the admin has published them — you're told
  they're not available yet, not shown partial/raw counts.

### ⚠️ Edge cases worth knowing

- If two household members try to register for the same flat at almost
  the same moment, only one will succeed — the other gets the
  "already registered" message rather than both being accepted.
- If you lose your code **before** voting, the admin can invalidate it
  and issue you a new one. If you lose it **after** voting, there's
  nothing to reissue — your vote already counted.
- If your registration is revoked by the admin while you still have your
  code, that code stops working immediately, even mid-session — you'd
  need a new registration to get a new code.
- If your ballot submission arrives right as voting is auto-closing,
  either it completes just in time and counts, or it's rejected as
  "voting is not currently open" — there's no in-between or partial
  vote.
- Refreshing or reopening the voting page after you've already submitted
  does not let you vote again.
- If a position's results end up showing "VACANT" or an unusually close
  outcome, that reflects a decision the committee made (or a situation
  they're still resolving) — it isn't a website error.
