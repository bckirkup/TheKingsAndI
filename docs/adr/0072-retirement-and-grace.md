# ADR 0072 — The ceiling on a career, and the mercy nobody buys

- **Status:** accepted in principle (owner ruling, 2026-08-29); **not wired**
- **Resolves:** **D186** (trauma must be able to end a career on every path),
  **D187** (trauma relief exists, is unearned, and cannot be purchased)
- **Opens:** **D188** (the grace rate and magnitude), **D189** (what fills the
  square of a retired identity in the campaign path)
- **Refines:** ADR 0026 (accumulated trauma across all commanders can retire a
  piece permanently), ADR 0049 (capture trauma semantics), ADR 0071 (captivity
  and the exchange), ADR 0007 (nothing decays toward a baseline on its own)
- **Depends on:** the campaign-carry fix (`sim/campaign.ts`, PR #161) and the
  before/after attrition it measured

## Context

Until the campaign path carried departed state, trauma had never accrued: a
captured piece came back re-created, `B_i = 0`, so ADR 0026's claim that
accumulated trauma is the one permanent loss described nothing that happened.
Carrying the state made it true, and the first measurement of a world where it
is true is bad in an instructive way.

Fake engine, seed 7, 20 matches, opponent `tyrannical`:

| Leader | Desertions | Mean final `B_i` | Distinct identities ever surviving a match |
|---|---:|---:|---:|
| `tyrannical` | 15 → 37 | 0.00 → 79.06 | 12 → 14 |
| `redeemer` | 12 → **195** | 0.00 → 59.69 | 16 → **4** |

The mechanism is a ratchet for every in-range state, and it is visible in the
code rather than inferred:
`applyCaptureInjury` adds `CAPTURE_TRAUMA_GAIN = 20` and `applySustainedDread`
adds `DREAD_TRAUMA_GAIN = 5`, `clampTrauma` bounds `B_i` to `[0, 100]`, and
**no trauma transition anywhere in the tree lowers an in-range `B_i`**;
normalization only clamps malformed or out-of-range values to `[0, 100]`.
Trauma also feeds the exit decision directly — `traumaPermille = B_i × 10` is
one of the four terms in `alienationPermille` in
`src/psychology/desertion.ts` — so five captures take a piece from indifferent
to standing at the door, and it can never walk back.

Two things are therefore missing at once, and the owner ruled both:

> **"we need both retirement and amazing grace."**

Retirement, because a ratchet with no terminus produces a roster of pieces at the
ceiling who never leave — which is not a career ending, it is a career that
cannot end. The machinery already exists but only on one path:
`RETIREMENT_TRAUMA_THRESHOLD = 100` is checked by `statusForConscript` in
`src/orchestration/squadFielding.ts:329-334`, and
`retirementCause: 'trauma'` is recorded by the season fold in
`src/orchestration/squadFielding.ts:505-512`, consumed by the season pool. The
campaign path has no pool, so it has no retirement, so `B_i` saturates and stays
there.

Grace, because without it the ceiling is every piece's destination and the
design's only story about suffering is arithmetic.

## The decision

### D186 — trauma ends a career, on every path

Accumulated trauma at or above the threshold permanently retires a non-King
identity. This is ADR 0026's existing claim and the season path's existing
implementation; what is ruled here is that the campaign path may not be exempt,
because an exemption is what turned the ratchet into saturation. The King's
exemption stands: he is a character, not a piece the player may lose (ADR 0021).

Retirement is not a punishment for the piece and must not be modelled as one. It
is the accumulated cost of every commander who spent it — the ADR 0026 claim that
a piece belongs to the community, not to a save file, is precisely what makes a
retirement an indictment of a career rather than of a match.

### D187 — grace is real, unearned, and unpurchasable

Trauma can be relieved. The relief is **grace**: it arrives without cause, it
cannot be earned, and no leader may buy it.

> **"Amazing grace is when you expect nothing."**
> **"Nobody can buy grace."**

These are ruled as constraints on the eventual term, not as flavour. In
descending order of how much damage violating one would do:

1. **No leader-controlled input may appear in the grace term.** Not standing, not
   purse, not `τ_abil` or `τ_benev`, not leadership style, not the match result,
   not the override count, and — importantly, because it is the tempting
   design — **not whether the commander ransomed the piece**. The moment relief
   correlates with any of these it is a wage, and ADR 0071's economy would
   immediately price it.
2. **The leader receives no credit.** Grace writes no credence, no affinity, and
   no gratitude toward a commander, because the piece cannot attribute it to
   anyone. A relieved piece is not a grateful piece; it is a piece that got up.
3. **It is drawn from the seeded PRNG at a match boundary,** so it is exactly
   reproducible in replay and wholly unpredictable in-world. Determinism and
   unmerited-ness are not in tension: the world is fixed, the piece's
   expectation is not.
4. **No piece may anticipate it.** No hope-of-grace term may enter the desertion
   utility. ADR 0011 forbids damping the cascade with cooldowns, caps, or morale
   floors, and an anticipated mercy is a morale floor wearing a better name.
5. **It applies to both armies.** The opponent is a commander with a real roster
   (ADR 0025); a mercy that fell only on the player's pieces would be a handicap
   setting, not a property of the world.

### What varies, and the trap in it

Relief in `B_i` is **flat** — the same number for every piece, since anything
else re-introduces an input. What differs is how the same relief *registers*, and
that is where the owner's line does its work: measured against expectation
(D182), an identical mercy is nothing to a piece that expected rescue and
everything to one that had written itself off.

This is deliberately the riskiest part of the ruling, and it is recorded with its
own hazard: if despair pays better, a leader can farm grace by grinding his
roster into hopelessness. Two things are meant to prevent that, and **both must
be measured before any magnitude ships** — this is the acceptance gate for D188,
not an afterthought:

- grace is rare and unpredictable, so its expected value cannot dominate the
  certain, immediate costs of cruelty; and
- registration affects morale and outlook, never `B_i` itself, so cruelty still
  accrues the permanent quantity while grace only ever returns some of it.

The gate: **a cruel style must not out-perform a kind one on retention or
outcome through grace.** If the surface shows it does, the registration term is
wrong and flat registration is the fallback, whatever it costs in poetry.

## Consequences

- ADR 0071's ransom design gets sharper rather than weaker. Coming home cannot
  heal you — that would be purchased grace — so what the commander buys is the
  *career*, not the wound. Redemption keeps a piece available; only mercy makes
  it well.
- The cruel commander's veterans sometimes recover anyway. This is intended:
  fortune, not merit, is one of the two things the project set out to show about
  leadership, and grace is where it lives.
- Retirement in the campaign path removes an identity that the standard-lineup
  merge would otherwise re-field, which raises the question of what stands on its
  square. That is **D189**, and it is deliberately not answered here. It is
  adjacent to but distinct from **D180** (what a *returned* piece owes the
  replacement who took its square): D189 is about a square whose occupant is
  never coming back.
- No magnitude, rate, threshold, or knob is chosen. `RETIREMENT_TRAUMA_THRESHOLD`
  keeps its `100`, and the grace rate and relief are **D188**, open. Nothing in
  this ADR is wired.
## Amendment (2026-08-29) — wired, and the gate was wrong

Both rulings are now in tree, D189 turned out to be answered by construction, and
the D188 acceptance gate stated above is **withdrawn**. Each in turn.

### What shipped

- **Retirement is live on the campaign path.** A non-King career whose `B_i`
  reaches `ENGINE_CONFIG.RETIREMENT_TRAUMA_THRESHOLD` at a match boundary is not
  carried into the next match. The threshold is now a single number consumed by
  both paths — `SQUAD_CONFIG.RETIREMENT_TRAUMA_THRESHOLD` references the engine
  config value — so the season pool and the campaign harness cannot drift apart.
- **Grace is wired and inert.** `applyGrace` is a pure reducer that writes only
  `B_i`; `GRACE_RATE_PERMILLE` and `GRACE_RELIEF` both default to `0`, and the
  draw loop is skipped entirely at the default rate, so no PRNG draw is consumed
  and a default campaign is byte-identical to one without the mechanism apart
  from retirement. The magnitudes remain **D188**.
- **Registration is not implemented.** Relief is flat in `B_i`, full stop. The
  expectation-relative *registration* the ruling describes waits on D182's
  expectation state, which is not in tree; nothing about grace currently touches
  morale or outlook.

### D189 — the square is a seat, and a career is a seat plus a generation

D189 asked what fills a retired identity's square. Reading the identity scheme
answers it and removes the choice: `PieceId`s are square-derived
(`startingSquarePieceId`, e.g. `w:P:g2`), and `mergeCampaignRoster` rebuilds the
standard lineup keyed by that id every match. So a retired identity *cannot* be
left out — omitting it from the carried roster is precisely how the amnesia
defect of PR #161 behaved, and the next merge would re-field the same id with
reset state.

The square is therefore a **seat**, and what ends is a **career**: the campaign
carries a per-seat generation counter, retirement closes career
`${seatId}#${generation}` and increments the seat, and the next match fields a
new career on that seat with no memory of its predecessor. The retired career id
is retained for audit; the metrics report careers rather than seats, so roster
turnover and "distinct identities ever surviving a match" now mean what they say.

This is the "fresh identity" branch of D189, and the honest reading is that the
harness had always been doing it — what changes is that the previous career now
*ends* instead of silently continuing with its wounds erased.

### D188 — the gate is a trajectory, not a verdict

The gate stated above — *a cruel style must not out-perform a kind one on
retention or outcome through grace* — is withdrawn on the owner's ruling:

> **"we need to acknowledge that evil pays — in the mid run."**

It was the wrong invariant, and wrong in a way that would have made the
simulation dishonest. Abusive leadership attains the rewards it seeks; that is
why it persists, and a model in which kindness dominates at every horizon teaches
nothing a participant would recognise. Worse, tuning grace until the inequality
held would have made mercy into a corrective that pays the kind commander back —
which is a wage, and D187 forbids it.

The replacement gate is shaped by horizon rather than by sign:

1. **Structural (unchanged, and the only hard one).** No leader-controlled input
   may appear in the grace term, and grace credits no commander. This is
   enforced by construction — `applyGrace` takes a piece and a relief — and by
   the no-purchase probe, not by a magnitude.
2. **Trajectory, not verdict.** Cruel and kind styles are compared at several
   campaign lengths, and a cruel style leading at 10 or 20 matches is a **pass**,
   not a failure. What must hold is that its advantage does not *widen* with
   campaign length, and that its cost accrues in the permanent quantities at
   every horizon: retirements, career turnover per seat, surviving veterans, and
   affinity edges among them.
3. **Grace may not flatten the bill.** Raising the grace rate or relief must not
   reduce the cruel style's accumulated permanent cost to the kind style's level
   at any horizon. Grace returns some of the wound; it does not settle the
   account.

Flat registration remains the fallback for the farming hazard, and the hazard
itself is now unreachable until D182 lands, because there is no registration term
to farm.

### The boundary has no event log (D190)

Grace and retirement happen at the campaign boundary, after `runMatch` has
returned and its event log is closed, and the harness has no boundary event
stream to append to. They are therefore represented as derived campaign match
metrics — which does not violate the source-of-truth rule for match truth, but it
does mean two career-ending and career-relieving facts live outside the log that
audits fold over. Recorded as **D190**: whether the campaign boundary needs its
own event stream, or whether ADR 0062's journal is where these belong when it
lands.
