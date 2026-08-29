# ADR 0071 — Captivity and the exchange: being taken is being held

- **Status:** accepted in principle (owner ruling, 2026-08-29); **not wired**
- **Resolves:** **D177** (do pieces stay together long enough for a social graph
  to exist)
- **Opens:** **D178** (what the exchange settles), **D179** (whether a commander
  may refuse an exchange), **D180** (what a returned piece owes the replacement
  who took its square)
- **Refines:** ADR 0026 (capture is never permanent), ADR 0052 (exit cost),
  ADR 0053 (capture truth), ADR 0070 (the room prices the victim)
- **Depends on:** `docs/calibration/2026-08-29-the-roster-nobody-stays-in.md`

## Context

> **"Being taken isn't being held as a POW, or if it is, there should be a
> prisoner exchange at the end of each match."**

The measurement that prompted this found that the campaign roster turns over
almost completely every match — mean survivors `1.95` of `16` fielded for
`tyrannical`, `2.85` for `redeemer`, with capture removing 10–15 pieces per
match against desertion's 0–1 — and that only one or two pieces out of a
twenty-match campaign survive five matches or more. Consequently half of all
witness attachments measured at override time are exactly `0`: the pieces
pricing an override under ADR 0070 are mostly strangers to the piece that was
overridden, and the affinity graph that ADR 0065 routes a private word through
holds two to four edges per piece.

Reading the harness rather than the intent shows the mechanism, and it is worse
than "pieces do not last":

- A captured piece **does** come back. `mergeCampaignRoster` rebuilds the full
  starting lineup each match and re-uses the same `PieceId` per starting square.
- But it comes back as a **stranger to its own life**. The merge carries
  psychological state only for pieces present in the roster handed back, which
  contains survivors only, so a captured piece is re-created by
  `createFreshPieceState`: `dyadicAffinity` empty, `B_i` zero, trust and
  credence reset.
- The state is not lost by design. `runMatch` already returns `departedRoster`
  — the captured piece's state *including* its capture injury — and the season
  pool path already folds it back into its members. **The campaign path throws
  it away**, and the campaign path is the instrument every psychology magnitude
  in `docs/calibration/` was calibrated on.

So today's model of capture is neither death nor captivity. It is **amnesia**:
the body returns on schedule, and nothing that happened to it did. That
contradicts ADR 0026 §1, which requires a captured piece to remember who took it
and who spent it, and it silently voids the accumulated-trauma pool that ADR
0026 §1 makes the only permanent loss.

## Decision

### 1. Capture is captivity, and captivity preserves the piece
A captured piece leaves the board into the **captor's hands** with its state
intact: affinity, both credence channels, class prestige, and the capture injury
already applied at the moment of capture. It does not re-enter the fielding
lineup while it is held. Nothing about a captured piece is re-created.

### 2. The exchange settles at the end of every match
Between matches, before lineups are formed, the two commanders exchange
prisoners. The exchange is **mutual and bounded by what each side holds**: a
commander who lost twelve pieces and took three gets three back. Attrition
therefore survives this ADR — it simply stops being automatic and becomes a
consequence of how the match was fought.

This is the reason to prefer exchange over respawn. Respawn would return the
whole roster and make capture cost nothing beyond the match; exchange keeps
capture expensive while making its cost *legible* and *bilateral*.

### 3. What is not exchanged is still held, and captivity is not neutral
An unexchanged piece remains captive across subsequent matches. While it is held:

- its benevolence credence in **its own commander** decays per match unexchanged
  — *you did not come for me* — which is the first mechanism in the model where a
  leader is judged for an omission rather than an act;
- its affinity toward the **captor** moves by how it was taken: cleanly, or spent
  carelessly by its own side, which is precisely the cross-roster affinity ADR
  0026 §3 requires and nothing has yet written.

On return it carries both into the room, and the room reads them. That is the
emotional content the LLM phase (ADR 0062, ADR 0063) exists to discover, and it
cannot be authored — it has to arrive with a piece that was gone for four
matches.

### 4. Squares left empty are filled by replacements, and the room notices
Chess needs a full lineup, so a captive's square is filled by a fresh piece.
A campaign lineup is therefore **veterans + returned prisoners + replacements**,
and a roster's social density becomes an *outcome* of leadership rather than a
constant. A commander who trades well fields a room that knows each other; one
who does not fields strangers, and the D170 pricing and ADR 0065 channel both go
quiet on him — not by an authored penalty, but because there is nobody in the
room with a bond to price.

### 5. Choosing whom to ask for is the leadership act
An exchange settled purely by a ledger is bookkeeping, not leadership. When a
commander holds fewer prisoners than the enemy does, he must **choose whom to
ask back**, and the roster observes the choice — including whom he left in enemy
hands. This is the strongest observable-favoritism channel in the design (ADR
0065 D168: even benevolence can be read as favoritism), and unlike the private
channel it needs no new perception mechanism: everyone can see who came home.

### 6. It ships inert, and the harness defect is fixed separately
Every magnitude here — carry-state-on-capture, exchange rate, captivity decay
per match, captor-affinity terms — is a separate knob whose default reproduces
today's behaviour, per rule 6 and rule 9. The campaign's discarded
`departedRoster` is a **harness defect** and is recorded as such in
`docs/adr/IMPLEMENTATION_STATUS.md`; repairing it changes measured attrition and
therefore requires its own before/after evidence, so it does not ride along with
a documentation change.

## Consequences

- **The existing calibration corpus is bounded, not void.** Every committed
  magnitude was chosen on a roster with near-zero attachment. Nothing in it is
  wrong, but no number in it may be quoted as evidence about a *dense* roster —
  in particular D170/D174/D176's few-percent redistribution is a measurement at
  attachment ≈ 0 and should be re-measured once captivity is live.
- **D168/D169 magnitudes must wait.** Choosing them now would tune the private
  channel against a roster with two intimates per piece.
- **Retirement becomes reachable.** With trauma carried across captivity, the
  ADR 0026 accumulated-trauma pool finally accrues, which is the first time
  "every careless leader contributes" can be measured rather than asserted.
- **New state must be persisted and portable.** A captive is roster state held
  by another commander, so the persistence schema and the ADR 0026 tier-1
  passport must both represent "held by", not merely "absent".

## Open questions

- **D178 — what does the exchange settle?** One-for-one by count, or by role
  value (a Queen for a Queen; a Queen for three pawns)? Count is simple and lets
  a leader buy back an officer with pawns, which is itself a leadership tell.
  Value is fairer and slower to recover from.
- **D179 — may a commander refuse?** A tyrant holding an officer as leverage is
  good drama and asymmetric play; a refusal that the AI can exercise but the
  player cannot read is an information problem.
- **D180 — what does a returned piece owe its replacement?** Two pieces now claim
  one square. Whether that is resentment, seniority, or nothing at all decides
  whether replacements are socially inert filler or a second faction.

## Addendum, 2026-08-29 — The ransom, the price, and the piece's own purse

**Status:** accepted in principle (owner ruling); **not wired**. Rules **D181**,
**D182**, **D183** in principle; opens **D184** and every magnitude below.

> *"I wonder if … pieces and players use leftover value from the draft process?"*
> *"I know people unwisely assess their own value by salary numbers; and for the
> sake of realism, pieces should be just as foolish."*
> *"Meanwhile, they also carry cash and can spring themselves from the clink or
> at least help with the process…"*

### D181 — captivity is priced, and it is paid out of leftover purse
An exchange settles in **money**, not in barter. The commander pays a ransom out
of the draft purse he did not spend (ADR 0059), which replaces §2's
holdings-bounded ledger with a budget constraint and largely dissolves D178: a
Queen costs more than a pawn because the market says so, and the class prejudice
of ADR 0019 then appears in *what the market charges* rather than in an authored
exchange table.

The money is already there and is currently wasted. On seed 7 (`pnpm sim:seminar
--seed=7 --weeks=2 --matches=1 --commanders=2 --engine=fake
--draft-at-cycle-one=true`) the cycle-2 draft cleared **all 8 lots at a mean
price of 19** and still ended with **393 unspent across four commanders** —
roughly 98 of a ~125 purse, i.e. about 80% dead money — and
`PURSE_CARRY_PERMILLE = 500` then destroys half of the remainder at the cycle
boundary. Ransom needs no new currency; it needs the existing one to stop being
burned.

The scarcity also lands in the right place without tuning. At ~19 a piece and
~125 a purse, a commander can buy back **five or six** of the 10–15 pieces a
match takes. He therefore *must* choose whom to ask for, which is the ADR 0071 §5
leadership act arriving as an arithmetic consequence rather than a rule.

The piece's side of the price is also already in tree:
`acceptanceDiscountPermille` (`src/core/draftEconomy.ts:116-135`) already
discounts what a piece asks by its benevolence credence in the commander and its
roster's testimony. Pointed at ransom, a piece that wants to come home is cheap
and a piece that was spent carelessly is expensive or declines outright (ADR 0026
free agency). **The same prisoner therefore has a different price for the leader
who lost him than for anyone else** — the first place in the design where a
leader's reputation is quoted back to him as a number.

### D182 — a piece reads its own price as a statement of its worth
Self-appraisal from salary is irrational and it is what people do, so pieces do
it too. A piece's clearing price and its ransom both feed its self-regard, which
means being bought back *cheaply* is an injury even though coming home is good
news — a leader can save money and insult a man with one act.

Two hazards constrain the magnitude, and neither is optional:

- **Absolute price would confirm the class hierarchy the model is already
  fighting.** Pawns are cheap by construction (D146's calibration recorded pawn
  standing as `0` by construction), so an absolute reading would demoralise every
  pawn in every cohort, deterministically, in the direction ADR 0019's class bias
  already leans. The comparison must therefore be **relative to what a piece of
  that role expects** — which is also the truer psychology: people compare
  salary to their peers, not to zero.
- **Nothing in game state carries a price today.** A clearing price exists only
  in the draft observation (`sim/seminarDraft.ts:443,713-744`); `PieceState`
  (`src/psychology/types.ts:50-62`) has no price, wage, or cash field. So this
  ruling adds *persistent* piece state, which the persistence schema and the ADR
  0026 tier-1 passport must both carry.

### D183 — pieces hold cash and may spring themselves
A piece holds money of its own and may pay part or all of its own ransom. This
gives wages a purpose they have never had — a piece's cash is bail — and turns
captivity into a four-way outcome: **he paid**, **I paid**, **we split it**, or
**nobody came**.

The consequence worth building for is the third-order one: a piece that bought
its own way out **owes the commander nothing, and knows it**. Independence is
precisely what stops paying for authority, so a bad leader's veterans return as
pieces he no longer commands cheaply — a decay path for authority that no
authored penalty produces. It also prices the leader's self-serving option
explicitly: let the cheap ones buy themselves out and spend the purse on the
Queen. The roster can see that, and under ADR 0065 §D168 it will read it.

### Consequences
- Piece-held cash and piece price are new persistent, portable state; a captive
  is already held by another commander, so persistence must represent *held by*,
  *priced at*, and *holding* together.
- Every term ships inert (rule 6): ransom price scale, acceptance discount reuse,
  self-appraisal weight and its role-relative baseline, wage rate, and the
  self-payment share all default to today's behaviour.
- No committed calibration number describes this economy: the draft economy
  helpers are documented as not connected to the default match path
  (`src/core/draftConfig.ts:1-5`), and every psychology magnitude was measured
  with no ransom, no wage, and no self-appraisal in the loop.

### Newly open
- **D184 — does an unransomed captive enter the next draft as a lot?** Failing to
  bring your people home would then mean watching a rival buy them, which is the
  harshest and most legible consequence available; it also risks a rich commander
  farming another's veterans.

## Addendum, 2026-08-29 (second) — The purse, the privacy, and the fatted calf

**Status:** accepted in principle (owner ruling); **not wired**. Closes the
boundary and information questions left open by the first addendum, confirms
D182's baseline, and opens **D185**.

> *"Expectation is everything. I think it is all drawn from the cycle purse. I
> think the conditions of ransom are private to the two players and the piece in
> question."*
> *"You never slaughtered the fatted calf for me…"*

### The baseline is expectation (D182 confirmed)
Self-appraisal is measured against what a piece of that role and history
*expected*, never against the absolute number. This is the owner's ruling, not an
implementation convenience, and it fixes the shape of the eventual magnitude: the
term is a signed difference from an expectation the piece carries, so a cheap
pawn is uninjured by a pawn's price and an officer is injured by one. It follows
that expectation is itself persistent state and must move — a piece bought high
once will price its own recovery against that memory, which is exactly the
foolishness D182 is for.

### The purse is the cycle purse (the boundary, ruled)
Ransom is drawn from the **cycle** purse, not from a per-match allowance. A match
that goes badly is therefore paid for over the weeks that follow, at the expense
of the next draft — the strongest available version, because the lesson survives
the match that taught it. Combined with the first addendum's measured numbers
(~19 a piece, ~125 a purse, 10–15 taken per match), a commander who loses badly
twice in a cycle cannot both redeem his people and compete at the next draft.

### The terms are private (the information rules, ruled)
The conditions of a ransom are known only to the two commanders and the piece
concerned. Under ADR 0025 this is the tighter reading, and it withdraws something
§5 of this ADR claimed: **the roster does not observe the exchange.** It observes
only *who came home*. Whether the commander paid, the piece paid, they split it,
or the enemy simply released him is not visible to anyone else.

The consequence is better than the mechanic it replaces. A return has to be
*inferred*, so the story of it travels as testimony and rumour through the ADR
0065 confidence channel rather than as fact — and every party to it has a motive
to shade it. A piece that sprang itself may let the room believe its commander
came for it (protecting a leader it still likes, or its own standing); a piece
nobody came for may claim it was redeemed rather than admit it was abandoned; a
commander may take credit for a release he did not buy. This is the first place in
the design where a piece has both a motive and the means to misrepresent its own
history, and the rumour system is the only thing that can carry it. It also means
the favoritism tell of §5 is real but *coarse*: presence is observable, generosity
is not.

### D185 — what claim does the loyal survivor have on the purse? (open)
The purse is one pot, so money spent redeeming the piece that got itself taken is
money not spent on wages, lots, or the pieces who were never captured. Redemption
is therefore paid for by the faithful, and the parable holds: the survivor of
twenty matches watches the returning captive bought back at a price nobody ever
spent on him. Unlike the ransom terms, this grievance needs no private
information — presence is observable and everyone knows what a purse is for — so
the room can hold it without violating the privacy ruling above.

That is a leadership trap with no clean answer, which is why it is a decision and
not a coefficient: redeem your people and the loyal pay for it; leave them and the
roster learns you do not come. It is also the first mechanism in the model that
prices *reliability*, which today earns a piece nothing at all (its regard for the
commander accrues, but the commander's ledger never records what it never had to
spend on it).

Unresolved: whether the claim is an expectation term (the veteran's expectation
rises with unrewarded service, so D182's machinery carries it), a benevolence
charge at redemption time (the commander pays the room for the spend, like an
override), or a standing claim on the next draft (the veteran expects a lot spent
on *his* cohort). The first is cheapest and reuses ruled machinery; the second is
the most legible as leadership; the third is the most economic and the slowest.
