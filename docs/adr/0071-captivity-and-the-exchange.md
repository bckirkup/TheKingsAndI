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
