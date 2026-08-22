# ADR 0059 — The draft: a scarce starting stock, a purse that runs backwards, and pieces who scout for you

- **Status:** Proposed. The shape is owner-directed; magnitudes (reserve depth,
  purse, carry cap, consultation budget, acceptance discount) are **open**
- **Date:** 2026-08-20
- **Scope:** Starting roster composition, acquisition between cycles, scouting
  information, cycle-end accounting
- **Opens:** **D153** (starting stock and the draft), **D154** (draft currency
  and priority order), **D155** (informant counsel and its bias), **D156** (TDY
  and demotion)
- **Bears on:** **D150** (what a commander may know about a piece) — answers the
  public half by construction, leaves the private half to §4
- **Related:** ADR 0014 (no position is unplayable), ADR 0016 (rumor carries
  appraisals only), ADR 0018 (no arithmetic on show), ADR 0021 (the King is a
  character), ADR 0023 §2 (D58: bench ~32, made safe by reputation transfer),
  ADR 0026 (a community of pieces), ADR 0031 (commendations), ADR 0051
  (non-selection is the sanction), ADR 0056 (the chair contest), ADR 0057 (the
  private squad), ADR 0058 (three-channel credence)

## Context

> **"Players should not start the first game with two queens, two kings, and
> four of each officer... I haven't settled on how a first 'draft' should work,
> nor how one might acquire choices for additional pieces."**

Shipped today, a career bootstraps a **doubled** standard army — one King, two
Queens, four of each officer, sixteen pawns
(`src/app/careerBootstrap.ts:54-70`), the harness's `POOL_DEPTH_FACTOR: 2`
lifted into the app by ADR 0057. Nothing ever decided that composition. What
*was* decided points the other way: **D7 — "a bench built up over time, not a
fixed 16."**

Underneath the composition sits the defect that actually blocks the market.
**A commander can never be short of a piece.** When a chair cannot be filled,
`conscript()` invents a stranger: unlimited, instant, free, at full role-baseline
ability, and pre-seeded with the roster's average trust in the commander
(`src/app/squadCareer.ts:282-345`). That is ADR 0026's *free commons* detector
describing our own shipped behaviour, and it means any draft is decoration —
there is no scarcity for a price to express and nothing for a market to sell.

The owner's design for the draft is a point-based bidding cycle in which every
commander sees the same public record, and the pieces a commander already holds
give him **private, informative and biased** counsel about the candidates he
might take. Priority runs backwards, as in the NBA: the claim on the pool comes
from losing.

## Decision

### 1. A career starts with a drafted stock, not a doubled army (D153)

Sixteen chairs must always be fillable (ADR 0014), so a draft yields **one legal
army plus a small reserve**, not two of everything. The King is not drafted — he
is the appointment, and a career holds up to three of them (ADR 0021, ADR 0023
§1). Reserve depth is open; the target shape is a stable bench with a handful of
spares rather than D58's ~32, because depth is now *earned* rather than issued.

### 2. The purse runs backwards; winning is paid in acceptance (D154)

Two currencies with opposite signs, so neither the strong nor the weak commander
runs away:

- **Priority and purse ∝ inverse standing.** The worst-placed commander of a
  cycle bids first and holds the larger purse.
- **Acceptance ∝ reputation.** A piece's willingness to sign discounts what a
  commander must pay for it — the relationship account if it has served him, the
  disposition prior plus roster testimony if it has not (ADR 0058). Winning buys
  **cheap consent, not more money**, which is ADR 0026's reputation-as-market
  position made into a price.

A dominant commander therefore cannot outbid, and a losing one cannot
out-attract. Both have a live path, which is the whole requirement.

### 3. Tanking must be dominated, not forbidden

A purse that rewards losing invites deliberate losing. It must not pay: losses
accrue global trauma, desertions and retirement contributions that no purse can
buy back (ADR 0026 §1), and a commander who tanks drafts first into a pool that
has learned what he is. **Detector:** if a tanking policy beats a competing one
across two or more cycles in the harness, the purse is too strong relative to
acceptance.

### 4. Your own pieces scout, and their bias is structural rather than random (D155)

**Public, identical for every commander:** name, origin role, attained role,
lifecycle status, which commanders it has served, and the service-record fold
already shipped in slice 1 — matches, captures, refusals, desertions,
commendations. Never trust, morale, trauma or ability, as numbers or otherwise
(ADR 0018).

**Private, and different for every commander:** a commander may consult a piece
he already holds. What she says is computed from *her* state and is honest to
her:

- her dyadic affinity toward the candidate, which crosses rosters (ADR 0026 §3);
- her class prejudice, `classPrestige[candidate.originRole]`;
- her rumour appraisal, which already diffuses weighted by a credibility term
  built from affinity and class bias (`src/psychology/belief.ts:14-41`);
- her credence in **him**, which shades how much she volunteers at all;
- **chair rivalry** — a candidate eligible for her chair under origin-inclusive
  eligibility (ADR 0056) is a rival, and self-interest may make her talk him
  down.

The counsel is qualitative (ADR 0018) and draws no new randomness: bias is a
systematic function of *who is telling you*, so it is learnable — "Rosalind
always talks down pawns" — and a commander who has damaged his roster is
misinformed by exactly the credence he damaged. This is the scouting problem
ADR 0054 §6 asked for, and it answers D150's private half without a visibility
table.

### 5. The price of information is attention, not points

A bounded number of consultations per cycle: free in purse, scarce in attention,
because attention is the resource this game already charges for — non-selection
is the sanction (ADR 0051). Whether counsel was **heeded** registers, since the
heeded channel is the one D149 measurement showed separates leadership styles at
all.

### 6. Stabilisers

This section, not the bidding, is where "playable by everyone who comes to the
table" is won or lost.

- **Floor — the levy replaces free conscription.** A chair that cannot be filled
  is still filled, but **greenly**: role-baseline ability, no bonds, no history,
  and a visible cost to the commander's standing. No board is ever unplayable
  (ADR 0014) and churn stops being free.
- **Cap on carry.** Unspent purse carries at most partially into the next cycle,
  so priority cannot be banked into a dynasty.
- **Hoarding already pays a tax.** Sixteen chairs mean a deep bench generates
  non-selection erosion (ADR 0051); depth beyond the reserve costs trust rather
  than merely costing nothing.
- **Reverse priority**, per §2.

### 7. The cycle closes with commendations, and they feed the next draft

ADR 0031 stands: awards are behavioural, computed at debrief, and never surfaced
during play (D93). What a cohort cycle adds is that the **facilitator** awards
currently stubbed `world-model-required` — `cohort_expenditure_evenness`,
`weakest_student_growth` — become computable, and cohort externalities (who
contributed trauma, who returned pieces whole) are the natural input to the next
cycle's priority.

**Guard:** priority keys on standing and on cohort externalities, never on award
identifiers. The moment an award buys purse, it stops measuring behaviour and
starts being farmed.

### 8. TDY and demotion — recorded, not decided (D156)

Temporary duty is the cheapest cross-commander circulation available: lend a
piece for a cycle and ADR 0058's relationship accounts plus global trauma
already carry the consequence, with no new state. Desirable versus undesirable
postings are a real instrument — a punishment posting is legible discipline, a
prestige loan is patronage. Demotion cannot mean anything until D148 fixes the
sign and magnitude of prestige movement. Both come after the draft ships.

## Consequences

**Slice 4b is resequenced.** The draft comes *before* free agency, because a
market needs a scarce stock:

| # | Slice | Contents |
|---|---|---|
| 4b-i | **The draft** | drafted starting stock, purse and reverse priority, public candidate record, informant counsel, the levy replacing free conscription |
| 4b-ii | **The market between cycles** | mutual recruitment, the right to decline, cross-commander trauma to permanent retirement, promotion as cohort news |
| 4b-iii | **Postings** | TDY, demotion — after D148 |

**Solo play stays whole** (ADR 0026 §5): AI commanders bid deterministically
from their style, so a player with no cohort loses no mechanic.

**New degeneracy detectors.**

- **Purse runaway.** One commander wins the majority of contested lots across
  cycles, or standing is monotone across the whole cohort.
- **Tanking dominance.** §3.
- **Informant noise.** Counsel is uncorrelated with a candidate's realized value,
  so scouting is decoration.
- **Informant sycophancy.** Counsel is perfectly correlated with realized value,
  so there is no scouting *problem* and bias is inert.
- **Price collapse.** Every lot clears at the minimum bid: no scarcity.
- **Cycle-one unplayability.** A commander cannot field sixteen without the levy
  in the first cycle, i.e. the drafted stock is too thin to start.

**Open and owner-owned:** reserve depth, purse magnitudes and carry cap, the
consultation budget, how large a discount acceptance buys, and whether the
first cycle is a draft at all or an issued army with the draft beginning at
cycle two.

## Alternatives considered

- **Equal purse for everyone.** Simplest, and rejected: acceptance alone then
  compounds for the winner, which is the runaway the owner's NBA framing exists
  to prevent.
- **Priority from winning.** Rewards the commander who least needs help and
  makes a bad start terminal. Foreclosed.
- **Snake draft with no bidding.** Cheap and deterministic, but removes the
  price signal, and with it the reason information is worth paying for.
- **Numeric candidate ratings on the draft board.** Rejected by ADR 0018, and it
  converts scouting from a judgement into a lookup.
- **Keep free conscription alongside the draft.** Rejected: it preserves exactly
  the *free commons* defect the market exists to remove, and makes every price
  in the draft optional.
- **Start with one legal army and no reserve.** Considered as the harshest
  reading of D7; rejected as the default because a single desertion in cycle one
  forces the levy immediately, though it remains a measurable extreme of the
  reserve-depth knob.
