# Society Election System — User Guide

This application replaces the paper-based apartment society election
process — the attendance sheet, the paper ballot, and the manual counting —
with a website. It is written for two audiences: **voters** (flat owners)
and **admins** (the election committee members running the vote). If you
are looking for setup instructions, source code layout, or how the system
is built, see the separate technical specification document instead — this
guide only covers what the application does and how to use it.

## What this application is for

A society election has three phases: deciding who is eligible to vote,
collecting each person's choice for each committee position, and
announcing the result. This application handles all three phases online:
it keeps a list of eligible voters, gives each one a private one-time
voting code instead of a physical ballot paper, lets them vote from a
phone or computer, and lets the committee publish the final result once
everyone is satisfied it's correct.

It is designed for **one society's internal committee election** — for
example, electing a President, Secretary, Treasurer, and similar
positions — not for large-scale or legally regulated public elections.

---

## What voters can do

1. **Open the voting website.** If the election has been scheduled ahead
   of time, you'll see a live countdown to when voting opens. You don't
   need an account or a password.
2. **Register once, if you haven't already.** Each eligible flat is given
   a registration key by the committee (e.g. posted on the notice board
   or shared in the society group). The first household member to
   register enters the flat number, that key, and their name/phone/email,
   and gets back a private, one-time voting code shown on screen.
3. **Enter your voting code.** Type in the code from registration.
4. **Vote for each position.** You'll see every position being elected
   (e.g. President, Secretary) and the candidates standing for it,
   including a **"NOTA — None of the Above"** option if you don't want
   to support any of the listed candidates. For a position with more than
   one open seat, you can select more than one candidate, up to the
   number of seats available.
5. **Submit your ballot once.** After you submit, your code is marked as
   used and cannot vote again — even if you or someone else tries the
   same code a second time.
6. **Get a receipt.** You'll see a confirmation with a receipt ID and the
   time you voted. The receipt **does not show who you voted for** — this
   is intentional, so that even your own receipt can't be used as proof
   of your choice to someone else.
7. **View the results later.** Once the committee has finished counting
   and officially publishes the outcome, anyone can visit the results
   page and see the winner(s) and vote counts for every position — no
   code or login needed at that point.

If voting hasn't opened yet, or has already closed, the site will tell you
clearly instead of letting you try to vote.

---

## What admins (the election committee) can do

Everything below is done from a separate, password-protected admin area
that ordinary voters cannot see or reach.

- **Set up the election.** Give it a name, then add each position being
  contested (for example, President, Vice-President, Secretary, Joint
  Secretary, Treasurer, Joint Treasurer, Communications), how many seats
  each position has, and the candidates standing for each one. A "NOTA"
  option is added automatically to every position — you don't need to add
  it yourself. There is a one-click option to pre-fill the typical set of
  society committee positions if you want a starting point.
- **Import the eligible flats.** Upload a simple list of flat numbers (as
  a spreadsheet-style CSV file). The system generates one registration
  key per flat and gives you a downloadable file to distribute publicly
  per flat (notice board, WhatsApp/email group) — residents then
  register themselves to get their own individual voting code. You can
  also register someone directly yourself if they can't self-register,
  and see a live table of who has registered against which flat.
- **Fix a registration dispute.** If a flat was registered by the wrong
  household member, you can revoke that registration (as long as they
  haven't voted yet) and register the right person instead — the old
  code stops working immediately.
- **Choose when voting opens and closes.** You can either open voting
  immediately, or schedule a specific start date and time (and, if you
  like, an automatic closing time too). Voters see a live countdown once
  a schedule is set, and voting opens and closes automatically at the
  times you chose — you don't have to be online at that exact moment.
- **Watch turnout while voting is open.** See how many of your eligible
  voters have cast a ballot so far, without ever seeing what anyone
  voted for.
- **Close voting** whenever you're ready (or let a scheduled close time
  do it automatically), which reveals the vote counts to the committee.
- **Resolve the "won two positions" situation.** It's entirely normal for
  the same person to stand for more than one position (say, President
  and Secretary). If that person ends up winning both, the system flags
  this clearly and lets you record which position they've chosen to
  keep — the other position is then automatically given to the next
  highest-voted candidate, exactly as would happen in a real committee
  meeting.
- **Publish results to voters.** Counting a vote and announcing it are
  kept as two separate, deliberate steps. Nothing is shown to voters
  until you explicitly click "publish" — giving you time to double-check
  and resolve any of the situations above first.
- **Download a full audit record.** At any point after closing, you can
  export a spreadsheet-friendly file listing who voted (without showing
  their choice), the full vote count for every candidate, and the final
  declared winners — useful for your own records or if a member disputes
  the outcome later.
- **Cancel an election** if something goes wrong before it's closed (for
  example, if it needs to be redone) — cancelled elections are kept for
  the record but no results are ever published from them.
- **Choose where the data is stored.** The system can keep all election
  data in either a Google Sheet (easy to open and inspect yourself) or in
  a private Cloudflare database (recommended for a real election, as it
  offers stronger protection against accidental edits). This choice is
  made once per election and can't be changed midway through voting.

---

## How your vote stays private, and how duplicate voting is prevented

- **One code, one vote.** Every voting code can only be used once. The
  moment it's used, it's marked as "voted" and any further attempt with
  the same code — even at the exact same moment from two different
  devices — is rejected. This is checked in a way that can't be
  bypassed by refreshing the page or resubmitting.
- **Your identity and your ballot are kept apart.** The record of *who
  has voted* (your flat number and name) and the record of *what was
  voted* (which candidate got a vote) are stored completely separately,
  with nothing linking one to the other. Nobody browsing the results or
  the attendance list can join the two together to see how a specific
  person voted.
- **Be aware of the honest limitation:** this gives strong protection
  against ordinary snooping by other committee members or voters, but it
  is not the same as the cryptographic anonymity used in
  government-grade electronic voting systems. Someone with full
  technical access to the underlying data and server logs could, in
  theory, attempt to correlate timing information. For a society-level
  committee election this is a reasonable and common trade-off, but you
  should not present it to voters as an absolute, unbreakable guarantee.

---

## Benefits

- Replaces the physical attendance sheet and paper ballot entirely — no
  printing, no ballot box, no manual tallying.
- Voters can participate from home or their phone, at their own
  convenience within the voting window.
- Supports realistic committee elections out of the box: multiple
  positions in one election, multiple candidates per position, positions
  with more than one seat, and a "None of the Above" option.
- Turnout and results are available instantly once published, instead of
  a manual count.
- Keeps a downloadable audit trail for every election, so results can be
  reviewed or defended later if questioned.
- Handles the common real-world case of one candidate winning multiple
  positions, including correctly promoting the next candidate.
- Can be run at no cost, either entirely on a committee member's own
  computer for a trial run, or later on Google Sheets or Cloudflare's free
  tier for a real election.

## Things to know before relying on this for a real election

- **Not a certified legal voting system.** It is well suited to an
  internal society/association committee election, not a government or
  legally regulated election with formal certification requirements.
- **Anonymity is strong but administrative, not cryptographic** — see the
  privacy section above. Be transparent with your members about this if
  asked.
- **A registration key is shared per flat, not secret per person.** It
  only proves someone lives in that flat, not who specifically should
  vote — the first household member to use it claims the flat's vote.
  If that's the wrong person, the committee can revoke and re-register
  (see above), but only before that registration has voted. There's no
  additional identity check beyond the key and having a registration key
  reach the wrong household would still let them register.
- **Assumes voters have some device and basic comfort with a website.**
  Residents who aren't comfortable with a phone or computer will need
  an assisted-voting arrangement from the committee (for example, a
  volunteer helping them enter their code on a shared device) — this is
  a process decision for your committee, not something the app manages
  automatically.
- **Ties and "None of the Above" majorities are flagged, not decided, by
  the system.** If NOTA gets more votes than every candidate, or two
  candidates are exactly tied for the last seat, the system still shows
  a leading candidate rather than declaring "no result" — your
  committee's bylaws should define how such cases are handled, and you
  should check the vote counts yourself before publishing in that
  situation.
- **Free hosting tiers have usage limits.** These are generous enough for
  a typical society-sized election, but are worth checking if your
  society is unusually large.
- **Requires someone comfortable running or handing off the technical
  setup**, at least once, to get it deployed for real use — see the
  companion technical specification document for that part.
